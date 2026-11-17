/**
 * API EOC Pusat Krisis Kesehatan (data kejadian bencana) di sisi server.
 * - Autentikasi Basic dari env server PUSKRIS_EOC_AUTH ("user:pass"); tidak pernah dikirim ke klien / dicatat.
 * - Hanya GET baca: jenis_bencana.php, data_krisis.php. bencana_detail.php tidak dipakai dasbor
 *   (berisi deskripsi teks bebas, pos pengungsi, faskes).
 * - Rentang setahun penuh dalam satu panggilan membengkak (>170 MB karena array `perkembangan`),
 *   jadi diambil per bulan. `perkembangan`, `kecamatan`, `content_html` dibuang di sini.
 */

import { getEocAuth } from './puskris-auth-config'

const EOC_BASE = (process.env.PUSKRIS_EOC_BASE || 'https://pusatkrisis.kemkes.go.id/eoc/api/detail_bencana').replace(/\/$/, '')

export function eocEnabled() {
  return Boolean(getEocAuth())
}

/** Satu kejadian ringkas (agregat per kejadian, tanpa data perorangan). */
export type EocEvent = {
  u: string // uid kejadian (untuk tautan detail resmi)
  t: string // YYYY-MM-DD
  w: string | null // HH:MM (zona dari sumber, WIB)
  n: string // jenis kejadian
  k: string // kelompok: Alam | Non Alam | Sosial
  p: string // kode provinsi (Kemendagri)
  pn: string
  b: string // kode kab/kota
  bn: string
  s: 0 | 1 // berdampak krisis kesehatan
  kr: number; td: number; m: number; h: number; lb: number; lr: number; pg: number; fr: number
  la: number | null
  lo: number | null
}

async function getJson(path: string, timeoutMs = 60_000): Promise<any> {
  const auth = getEocAuth()
  if (!auth) throw new Error('Autentikasi EOC belum diatur')
  const ctl = new AbortController()
  const tm = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const r = await fetch(`${EOC_BASE}/${path}`, {
      method: 'GET',
      headers: { Authorization: `Basic ${Buffer.from(auth).toString('base64')}`, Accept: 'application/json' },
      cache: 'no-store',
      signal: ctl.signal,
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const j = await r.json()
    if (j && j.sukses === 0) throw new Error(String(j.error_message || 'API menolak permintaan'))
    return j
  } catch (e: any) {
    throw new Error(e?.name === 'AbortError' ? 'Batas waktu habis' : String(e?.message || e))
  } finally {
    clearTimeout(tm)
  }
}

const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0)
const trim = (v: any) => String(v ?? '').trim()

function slim(r: any): EocEvent | null {
  const m = /^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}:\d{2}))?/.exec(trim(r.tgl_kejadian))
  if (!m) return null
  const loc = (r.lokasi || []).map((l: any) => [Number(l.latitude), Number(l.longitude)]).find(([a, b]: number[]) => Number.isFinite(a) && Number.isFinite(b) && a > -12 && a < 7 && b > 94 && b < 142)
  return {
    u: trim(r.uid), t: `${m[3]}-${m[2]}-${m[1]}`, w: m[4] || null,
    n: trim(r.nama_bencana) || 'Lainnya', k: trim(r.jenis_bencana) || 'Lainnya',
    p: trim(r.provinsi_dagri).padStart(2, '0'), pn: trim(r.provinsi), b: trim(r.kabupaten_dagri), bn: trim(r.kabupaten),
    s: num(r.status_krisis) ? 1 : 0,
    kr: num(r.jml_korban), td: num(r.penduduk_terdampak), m: num(r.meninggal), h: num(r.hilang),
    lb: num(r.luka_berat), lr: num(r.luka_ringan), pg: num(r.pengungsi), fr: num(r.jml_faskes_rusak),
    la: loc ? Math.round(loc[0] * 1e5) / 1e5 : null, lo: loc ? Math.round(loc[1] * 1e5) / 1e5 : null,
  }
}

const pad = (n: number) => String(n).padStart(2, '0')
const todayWib = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)

/** Pecah rentang tanggal menjadi potongan per bulan kalender. */
export function monthChunks(from: string, to: string): [string, string][] {
  const out: [string, string][] = []
  let [y, mo] = from.slice(0, 7).split('-').map(Number)
  while (`${y}-${pad(mo)}` <= to.slice(0, 7)) {
    const last = new Date(Date.UTC(y, mo, 0)).getUTCDate()
    const a = `${y}-${pad(mo)}-01` < from ? from : `${y}-${pad(mo)}-01`
    const b = `${y}-${pad(mo)}-${pad(last)}` > to ? to : `${y}-${pad(mo)}-${pad(last)}`
    out.push([a, b])
    mo++
    if (mo > 12) { mo = 1; y++ }
  }
  return out
}

async function poolRun<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]) }
  }))
  return out
}

/** Ambil kejadian pada rentang (opsional prov/kab), per bulan, lalu ringkas. */
export async function fetchEocRange(q: { tanggal1: string; tanggal2: string; prov?: string | null; kab?: string | null }) {
  const chunks = monthChunks(q.tanggal1, q.tanggal2)
  const gagal: string[] = []
  const parts = await poolRun(chunks, 4, async ([a, b]) => {
    const sp = new URLSearchParams({ tanggal1: a, tanggal2: b })
    if (q.prov) sp.set('prov', q.prov)
    if (q.kab) sp.set('kab', q.kab)
    try {
      const j = await getJson(`data_krisis.php?${sp}`, 90_000)
      return (j?.data || []).map(slim).filter(Boolean) as EocEvent[]
    } catch (e: any) {
      gagal.push(`${a.slice(0, 7)}: ${String(e?.message || e)}`)
      return [] as EocEvent[]
    }
  })
  if (gagal.length === chunks.length) throw new Error(gagal[0] || 'Gagal')
  const seen = new Set<string>()
  const events: EocEvent[] = []
  for (const list of parts) for (const e of list) { if (seen.has(e.u)) continue; seen.add(e.u); events.push(e) }
  events.sort((a, b) => `${b.t} ${b.w || ''}`.localeCompare(`${a.t} ${a.w || ''}`))
  return { dari: q.tanggal1, sampai: q.tanggal2, prov: q.prov || null, kab: q.kab || null, events, gagal }
}

/** Kejadian tahun berjalan (1 Jan s.d. hari ini) + 31 hari terakhir tahun lalu bila perlu untuk filter 30 hari. */
export async function fetchEocTahun() {
  const today = todayWib()
  const y = Number(today.slice(0, 4))
  const from = today.slice(5) < '02-01' ? `${y - 1}-12-01` : `${y}-01-01`
  const [r, jenis] = await Promise.all([
    fetchEocRange({ tanggal1: from, tanggal2: today }),
    getJson('jenis_bencana.php', 30_000).then((j) => (j?.data || []).map((x: any) => ({ uid: trim(x.uid), nama: trim(x.nama_bencana) }))).catch(() => [] as { uid: string; nama: string }[]),
  ])
  return { tahun: y, ...r, jenis }
}

/** Ringkas daftar kejadian menjadi KPI (bentuk mirip KPI dashboard-new). */
export function rekapEoc(list: EocEvent[]) {
  const s = { terpantau: list.length, berdampak_krisis: 0, korban_total: 0, meninggal: 0, hilang: 0, luka_berat: 0, luka_ringan: 0, pengungsi: 0, terdampak: 0, faskes_rusak: 0, alam: 0, non_alam: 0, sosial: 0 }
  for (const e of list) {
    s.berdampak_krisis += e.s; s.korban_total += e.kr; s.meninggal += e.m; s.hilang += e.h; s.luka_berat += e.lb; s.luka_ringan += e.lr
    s.pengungsi += e.pg; s.terdampak += e.td; s.faskes_rusak += e.fr
    if (/^alam/i.test(e.k)) s.alam++; else if (/^non/i.test(e.k)) s.non_alam++; else if (/^sosial/i.test(e.k)) s.sosial++
  }
  return s
}

/** Rekap per tahun untuk tren 5 tahun (tahun-tahun sebelumnya; tahun berjalan dari fetchEocTahun). */
export async function fetchEocTren(nTahun = 4) {
  const y = Number(todayWib().slice(0, 4))
  const out: { tahun: number; semua: ReturnType<typeof rekapEoc>; krisis: ReturnType<typeof rekapEoc>; gagal: string[] }[] = []
  for (let t = y - nTahun; t < y; t++) {
    const r = await fetchEocRange({ tanggal1: `${t}-01-01`, tanggal2: `${t}-12-31` })
    out.push({ tahun: t, semua: rekapEoc(r.events), krisis: rekapEoc(r.events.filter((e) => e.s)), gagal: r.gagal })
  }
  return out
}
