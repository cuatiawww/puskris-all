/**
 * Konsumsi API resmi Pusat Krisis Kesehatan (PSC 119, Asistensi) di sisi server.
 * - Token hanya dibaca dari env server PUSKRIS_TTOKEN (tidak pernah dikirim ke klien / dicatat).
 * - Hanya endpoint baca/rekap; tidak memanggil SSO atau endpoint ubah data.
 * - Keluaran SELALU agregat: field pribadi (nama, telepon, alamat, keluhan, plat nomor) dibuang di sini.
 * - Cache memori 15 menit + stale-while-revalidate; bila gagal, pemanggil memakai snapshot.
 */

import KAB_CENTROID from '../../data/kab-centroid.json'
import { fetchTckInti, fetchTckRelawan, TCK_PROFESI } from './tck-live'
import { eocEnabled, fetchEocTahun, rekapEoc, type EocEvent } from './eoc-live'

const TTL_MS = 15 * 60_000
const PSC_BASE = (process.env.PUSKRIS_PSC_BASE || 'https://psc.kemkes.go.id').replace(/\/$/, '')
const ASIS_BASE = (process.env.PUSKRIS_ASISTENSI_BASE || 'https://pusatkrisis.kemkes.go.id/asistensi').replace(/\/$/, '')

export function liveEnabled() {
  return Boolean(process.env.PUSKRIS_TTOKEN)
}

export function wibStamp(ms = Date.now()) {
  const d = new Date(ms + 7 * 3600_000)
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)} WIB`
}

export async function postForm(url: string, form: Record<string, string | number>, timeoutMs = 60_000): Promise<any> {
  const token = process.env.PUSKRIS_TTOKEN
  if (!token) throw new Error('PUSKRIS_TTOKEN belum diatur di server')
  const body = new URLSearchParams()
  for (const [k, v] of Object.entries(form)) body.set(k, String(v))
  const ctl = new AbortController()
  const tm = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { TTOKEN: token, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body,
      cache: 'no-store',
      signal: ctl.signal,
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const j = await r.json()
    if (j && (j.status === false || j.sukses === 0)) throw new Error(String(j.message || 'API menolak permintaan'))
    return j
  } catch (e: any) {
    throw new Error(e?.name === 'AbortError' ? 'Batas waktu habis' : String(e?.message || e))
  } finally {
    clearTimeout(tm)
  }
}

export async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++
        out[k] = await fn(items[k])
      }
    }),
  )
  return out
}

// ------------------------------------------------------------------ cache SWR
type Entry = { at: number; value?: any; error?: string; pending?: Promise<any> }
const store: Map<string, Entry> = ((globalThis as any).__puskrisLive ||= new Map())

export type LiveResult<T> = { value?: T; at?: number; fresh: boolean; pending: boolean; error?: string; job?: Promise<any> }

export async function swr<T>(key: string, fn: () => Promise<T>, budgetMs: number): Promise<LiveResult<T>> {
  const e = store.get(key) || { at: 0 }
  if (e.value !== undefined && Date.now() - e.at < TTL_MS) return { value: e.value, at: e.at, fresh: true, pending: false }
  if (!e.pending) {
    e.pending = fn()
      .then((v) => {
        store.set(key, { at: Date.now(), value: v })
        return v
      })
      .catch((err) => {
        const cur = store.get(key) || { at: 0 }
        store.set(key, { at: cur.at, value: cur.value, error: String(err?.message || err) })
        return undefined
      })
    store.set(key, e)
  }
  const job = e.pending
  const done = await Promise.race([job.then(() => true), new Promise<boolean>((r) => setTimeout(() => r(false), budgetMs))])
  const now = store.get(key) || e
  return { value: now.value, at: now.at || undefined, fresh: done && !now.error, pending: !done, error: now.error, job }
}

// ------------------------------------------------------------------ Asistensi
const titleCase = (s: string) => String(s || '').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bKab\.\s*/i, 'Kab. ').replace(/\bDki\b/, 'DKI').replace(/\bDi\b/, 'DI')
const normStatus = (s: string) => titleCase(String(s || '').trim()) || 'Belum Mengisi'

export async function fetchAsistensi(tahun: number) {
  const [p, k] = await Promise.all([
    postForm(`${ASIS_BASE}/web_api/v1/rekapitulasi-asistensi-provinsi`, { tahun, kd_prop: '', id_user_level: '' }),
    postForm(`${ASIS_BASE}/web_api/v1/rekapitulasi-asistensi-kabupaten`, { tahun, kd_kab: '', id_user_level: '' }),
  ])
  const provinsi = (p.data || []).map((r: any) => ({
    level: 'provinsi',
    kode_wilayah: String(r.kode_wilayah).padStart(2, '0'),
    nama: titleCase(r.nama_provinsi),
    poin_kapasitas_pct: Number(r.poin_kapasitas || 0),
    status_kapasitas: normStatus(r.status_kapasitas?.label),
    warna: r.status_kapasitas?.color || null,
    status_risiko_irbi: normStatus(r.status_irbi),
  }))
  const kabkota = (k.data || []).map((r: any) => {
    const code = String(r.kode_wilayah).padStart(4, '0')
    return {
      level: 'kabkota',
      kode_wilayah: code,
      kd_prop: code.slice(0, 2),
      nama: titleCase(r.nama_kabupaten),
      poin_kapasitas_pct: Number(r.poin_kapasitas || 0),
      status_kapasitas: normStatus(r.status_kapasitas?.label),
      warna: r.status_kapasitas?.color || null,
      status_risiko_irbi: normStatus(r.status_irbi),
    }
  })
  return { tahun, provinsi, kabkota }
}

// ------------------------------------------------------------------ PSC (master data, agregat)
const num = (v: any) => {
  const n = Number(String(v ?? '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}
const coord = (v: any) => {
  const n = Number(String(v ?? '').trim())
  return Number.isFinite(n) && n !== 0 ? Math.round(n * 1e4) / 1e4 : null
}

const inIdn = (lat: number, lon: number) => lat > -12 && lat < 7 && lon > 94 && lon < 142
const kabPusat = (kk: string): [number, number] | null => ((KAB_CENTROID as unknown as Record<string, [number, number]>)[kk] || null)
const km = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], (a[1] - b[1]) * Math.cos((a[0] * Math.PI) / 180)) * 111
/** Koordinat yang dipakai berulang oleh banyak fasilitas berbeda = nilai bawaan formulir, bukan lokasi sebenarnya. */
const PLACEHOLDER_MIN = 5
const AMB_KONDISI = ['Baik', 'Rusak Ringan', 'Rusak Berat', 'Belum diisi']
/** Satu PSC untuk lapisan peta: n=nama, kk=kode kab/kota, p=kode provinsi, a=aktif, siap=ambulans aktif & baik, prs=personil, rs=RS jejaring. */
export type PscTitik = { n: string; kab: string; kk: string; p: string; prov: string; a: number; lat: number | null; lon: number | null; lok: 'psc' | 'kabkota' | null; amb: number; siap: number; prs: number; rs: number }
/** [lat, lon, siap(1/0), aktif(1/0/-1 tidak diisi), indeks kondisi, jenis(0 GD,1 transport,2 lain), lokasi(0 koordinat ambulans,1 koordinat PSC,2 pusat kab/kota PSC), indeks PSC] */
export type AmbTitik = [number, number, number, number, number, number, number, number]

export async function fetchPscMaster() {
  const first = await postForm(`${PSC_BASE}/web_api/v1/data-psc`, { page: 1, per_page: 100 }, 90_000)
  const pages = Number(first.total_page || 1)
  const rest = await pool(Array.from({ length: Math.max(0, pages - 1) }, (_, i) => i + 2), 4, (pg) =>
    postForm(`${PSC_BASE}/web_api/v1/data-psc`, { page: pg, per_page: 100 }, 90_000),
  )
  const list: any[] = [first, ...rest].flatMap((j) => j.data || [])
  const prov: Record<string, any> = {}
  const P = (code: string) =>
    (prov[code] ||= {
      code, psc_total: 0, psc_aktif: 0, ambulans: 0, ambulans_aktif: 0, ambulans_baik: 0, ambulans_rusak_ringan: 0,
      ambulans_rusak_berat: 0, ambulans_kondisi_kosong: 0, ambulans_gps: 0, rs_jejaring: 0, personil: 0,
      personil_medis: 0, personil_perawat: 0, personil_bidan: 0, personil_driver: 0, personil_lain: 0, anggaran_tahun_ini: 0,
    })
  const kondisi: Record<string, number> = {}
  const jenisAmb: Record<string, number> = {}
  const tenaga: Record<string, number> = {}
  const kepemilikan: Record<string, number> = {}
  const rsSeen = new Map<string, { lat: number; lon: number; prov: string }>()
  const titikPsc: [number, number, number, number, number, string][] = []
  // Lapisan peta "API Internal": daftar PSC (tanpa pimpinan/telepon/email/alamat) dan titik ambulans (tanpa plat nomor/petugas).
  const pscList: PscTitik[] = []
  const ambTitik: AmbTitik[] = []
  let ambTanpaLokasi = 0
  const tahunIni = String(new Date(Date.now() + 7 * 3600_000).getUTCFullYear())
  const keyOf = (la: any, lo: any) => `${coord(la)},${coord(lo)}`
  const pakai: Record<string, number> = {}
  for (const r of list) pakai[keyOf(r.latitude, r.longitude)] = (pakai[keyOf(r.latitude, r.longitude)] || 0) + 1
  const rsPakai: Record<string, number> = {}
  for (const r of list) for (const x of r.data_rumahsakit_sarana || []) rsPakai[keyOf(x.latitude, x.longitude)] = (rsPakai[keyOf(x.latitude, x.longitude)] || 0) + 1
  let pscPlaceholder = 0
  for (const r of list) {
    const code = String(r.kd_prop || '').padStart(2, '0')
    const p = P(code)
    const aktif = Number(r.status_psc) === 1
    p.psc_total++
    if (aktif) p.psc_aktif++
    const kp0 = String(r.kepemilikan || '').trim()
    const kp = /pemerintah|swasta|tni|polri|bumn|yayasan/i.test(kp0) ? kp0 : 'Tidak diisi'
    kepemilikan[kp] = (kepemilikan[kp] || 0) + 1
    let amb = 0
    let ambBaik = 0
    let ambSiap = 0
    // Lokasi PSC: koordinat sendiri bila wajar; bila kosong/bawaan (dipakai banyak PSC) → pusat kab/kota (perkiraan).
    const kk0 = String(r.kd_kab || '').padStart(4, '0')
    const pusat = kabPusat(kk0)
    let plat = coord(r.latitude)
    let plon = coord(r.longitude)
    let pLok: 'psc' | 'kabkota' | null = 'psc'
    const asli = plat != null && plon != null && inIdn(plat, plon) && (pakai[keyOf(r.latitude, r.longitude)] || 0) < PLACEHOLDER_MIN && (!pusat || km([plat, plon], pusat) < 150)
    if (!asli) {
      if (plat != null && (pakai[keyOf(r.latitude, r.longitude)] || 0) >= PLACEHOLDER_MIN) pscPlaceholder++
      if (pusat) { plat = pusat[0]; plon = pusat[1]; pLok = 'kabkota' } else { plat = null; plon = null; pLok = null }
    }
    const pscOk = plat != null && plon != null
    const pscIdx = pscList.length
    for (const a of r.data_ambulan_psc || []) {
      amb++
      p.ambulans++
      if (a.status_aktif === 'Aktif') p.ambulans_aktif++
      const k = String(a.kondisi_kendaraan || '')
      if (k === 'Baik') { p.ambulans_baik++; ambBaik++ } else if (k === 'Rusak Ringan') p.ambulans_rusak_ringan++
      else if (k === 'Rusak Berat') p.ambulans_rusak_berat++
      else p.ambulans_kondisi_kosong++
      const kn = ['Baik', 'Rusak Ringan', 'Rusak Berat'].includes(k) ? k : 'Belum diisi'
      kondisi[kn] = (kondisi[kn] || 0) + 1
      if (String(a.gps_imei || '').trim() || String(a.vendor_gps || '').trim() || String(a.nama_alat_gps || '').trim()) p.ambulans_gps++
      const jn = a.jenis === 'Gawat Darurat' ? 'Ambulans Gawat Darurat' : a.jenis === 'Transportasi' ? 'Ambulans Transport' : a.jenis || 'Tidak diketahui'
      jenisAmb[jn] = (jenisAmb[jn] || 0) + 1
      const stA = a.status_aktif === 'Aktif' ? 1 : a.status_aktif === 'Tidak Aktif' ? 0 : -1
      const siap = stA === 1 && k === 'Baik' ? 1 : 0
      if (siap) ambSiap++
      const alat = coord(a.latitude)
      const alon = coord(a.longitude)
      const own = alat != null && alon != null && inIdn(alat, alon) && (!pusat || km([alat, alon], pusat) < 150)
      if (own || pscOk) {
        ambTitik.push([own ? alat! : plat!, own ? alon! : plon!, siap, stA, AMB_KONDISI.indexOf(kn), a.jenis === 'Gawat Darurat' ? 0 : a.jenis === 'Transportasi' ? 1 : 2, own ? 0 : pLok === 'psc' ? 1 : 2, pscIdx])
      } else ambTanpaLokasi++
    }
    for (const t of r.data_personil_psc || []) {
      p.personil++
      const jt = String(t.jenis_tenaga || '').trim() || 'Tidak diisi'
      tenaga[jt] = (tenaga[jt] || 0) + 1
      if (/medis/i.test(jt) && !/kesehatan/i.test(jt)) p.personil_medis++
      else if (/keperawatan/i.test(jt)) p.personil_perawat++
      else if (/kebidanan/i.test(jt)) p.personil_bidan++
      else if (/driver/i.test(jt)) p.personil_driver++
      else p.personil_lain++
    }
    let rsPsc = 0
    for (const s of r.data_rumahsakit_sarana || []) {
      rsPsc++
      const lat = coord(s.latitude)
      const lon = coord(s.longitude)
      const rsAsli = (rsPakai[keyOf(s.latitude, s.longitude)] || 0) < 10 * PLACEHOLDER_MIN
      if (!rsSeen.has(String(s.id))) rsSeen.set(String(s.id), { lat: (rsAsli ? lat : null) as number, lon: (rsAsli ? lon : null) as number, prov: String(s.kode_prop || code).padStart(2, '0') })
    }
    for (const g of r.data_anggaran_psc || []) if (String(g.tahun) === tahunIni) p.anggaran_tahun_ini += num(g.jumlah_anggaran)
    if (pscOk) titikPsc.push([plat!, plon!, aktif ? 1 : 0, amb, ambBaik, code])
    // catatan: titik PSC di pusat kab/kota (perkiraan) tetap dipakai untuk radius dukungan; jumlahnya dilaporkan di peta.lokasi
    pscList.push({
      n: String(r.nama_psc || '').trim() || 'PSC tanpa nama', kab: titleCase(String(r.kabupaten || '').trim()), kk: String(r.kd_kab || '').padStart(4, '0'),
      p: code, prov: titleCase(String(r.provinsi || '').trim()), a: aktif ? 1 : 0, lat: pscOk ? plat : null, lon: pscOk ? plon : null, lok: pLok,
      amb, siap: ambSiap, prs: (r.data_personil_psc || []).length, rs: rsPsc,
    })
  }
  const titikRs: [number, number][] = []
  for (const s of rsSeen.values()) {
    P(s.prov).rs_jejaring++
    if (s.lat != null && s.lon != null && s.lat > -12 && s.lat < 7 && s.lon > 94 && s.lon < 142) titikRs.push([s.lat, s.lon])
  }
  const sum = (k: string) => Object.values(prov).reduce((a: number, p: any) => a + (p[k] || 0), 0)
  const toList = (o: Record<string, number>) => Object.entries(o).map(([nama, jumlah]) => ({ nama, jumlah })).sort((a, b) => b.jumlah - a.jumlah)
  const terdaftar = async (ep: string) => {
    try {
      return Number((await postForm(`${PSC_BASE}/web_api/v1/${ep}`, { kode_psc: '', page: 1, per_page: 1 })).total_data || 0)
    } catch {
      return null
    }
  }
  const [ambTerdaftar, rsTerdaftar] = await Promise.all([terdaftar('data-ambulan-psc'), terdaftar('data-rumahsakit-sarana')])
  return {
    provinsi: Object.values(prov),
    summary: {
      total_ambulan_terdaftar: ambTerdaftar, total_rs_terdaftar: rsTerdaftar,
      total_psc: list.length, psc_aktif: sum('psc_aktif'), total_ambulan: sum('ambulans'), ambulans_aktif: sum('ambulans_aktif'),
      ambulans_baik: sum('ambulans_baik'), ambulans_rusak_ringan: sum('ambulans_rusak_ringan'), ambulans_rusak_berat: sum('ambulans_rusak_berat'),
      ambulans_kondisi_kosong: sum('ambulans_kondisi_kosong'), ambulans_gps: sum('ambulans_gps'), total_personil: sum('personil'), total_rs: rsSeen.size,
      anggaran_tahun_ini: sum('anggaran_tahun_ini'), tahun_anggaran: Number(tahunIni),
    },
    kondisi_ambulans: toList(kondisi),
    jenis_ambulans: toList(jenisAmb),
    jenis_tenaga: toList(tenaga),
    kepemilikan: toList(kepemilikan),
    titik_psc: titikPsc,
    titik_rs: titikRs,
    peta: { psc: pscList, ambulans: ambTitik, ambulans_tanpa_lokasi: ambTanpaLokasi, psc_koordinat_bawaan: pscPlaceholder, kondisi: AMB_KONDISI, jenis: ['Gawat Darurat', 'Transportasi', 'Lainnya'] },
  }
}

// ------------------------------------------------------------------ PSC pelaporan panggilan (hanya hitungan)
const normSumber = (s: string) => {
  const t = String(s || '').trim().toLowerCase()
  if (!t) return 'Tidak diisi'
  if (t.includes('119') || t.includes('avaya') || t.includes('call center')) return 'Call Center 119'
  if (t.includes('whatsapp') || t === 'wa') return 'WhatsApp'
  if (t.includes('telp') || t.includes('telep') || t.includes('hp')) return 'Telepon'
  if (t.includes('langsung') || t.includes('datang')) return 'Datang langsung'
  if (t.includes('polisi') || t.includes('polri')) return 'Kepolisian'
  if (t.includes('aplikasi') || t.includes('app')) return 'Aplikasi'
  return 'Lainnya'
}
const normStatusPenanganan = (s: string) => (/selesai/i.test(s) ? 'Selesai' : /proses/i.test(s) ? 'Diproses' : 'Lainnya')
const normJenisLayanan = (s: string) => {
  const t = String(s || '').trim()
  if (/^emergency$/i.test(t)) return 'Gawat Darurat'
  if (/non\s*emergency/i.test(t)) return 'Bukan Gawat Darurat'
  if (/non\s*category/i.test(t)) return 'Tanpa Kategori'
  return t || 'Tanpa Kategori'
}

const MIN_PANGGILAN_TITIK = 5

export async function fetchPanggilan(tahun: number, provCodes: string[], samplePages = 35) {
  const url = `${PSC_BASE}/web_api/v1/data-pelaporan-panggilan`
  const count = async (f: Record<string, string | number>) => {
    const j = await postForm(url, { kode_psc: '', kd_prop: '', kd_kab: '', status_penanganan: '', page: 1, per_page: 1, ...f })
    return Number(j.total_data || 0)
  }
  const jobs: { key: string; f: Record<string, string | number> }[] = [
    { key: 'total', f: { tahun } },
    { key: 'selesai', f: { tahun, status_penanganan: 'Selesai' } },
    { key: 'prev', f: { tahun: tahun - 1 } },
    ...provCodes.flatMap((c) => [
      { key: `p:${c}`, f: { tahun, kd_prop: c } },
      { key: `s:${c}`, f: { tahun, kd_prop: c, status_penanganan: 'Selesai' } },
    ]),
  ]
  const counts = await pool(jobs, 8, async (j) => {
    try {
      return [j.key, await count(j.f)] as const
    } catch {
      return [j.key, null] as const
    }
  })
  const C = Object.fromEntries(counts)
  if (C.total == null) throw new Error('Hitungan panggilan gagal')

  // Sampel terbaru: hanya dihitung, field pribadi tidak disimpan.
  const pages = await pool(Array.from({ length: samplePages }, (_, i) => i + 1), 8, async (pg) => {
    try {
      const j = await postForm(url, { kode_psc: '', kd_prop: '', kd_kab: '', status_penanganan: '', tahun, page: pg, per_page: 100 })
      return (j.data || []).map((x: any) => ({
        t: String(x.tgl_pelaporan_panggilan || '').slice(0, 10),
        h: Number(String(x.jam_pelaporan_panggilan || '').slice(0, 2)),
        p: String(x.kd_prop || '').padStart(2, '0'),
        j: normJenisLayanan(x.jenis_layanan),
        k: String(x.kategori_layanan || '').trim() || 'Tanpa kategori',
        s: normStatusPenanganan(String(x.status_penanganan || '')),
        u: normSumber(x.sumber_panggilan),
        a: /tidak memerlukan/i.test(String(x.layanan_ambulance || '')) || !String(x.layanan_ambulance || '').trim() ? 0 : 1,
        kk: String(x.kd_kab || '').padStart(4, '0'),
        kn: titleCase(String(x.kabupaten || '').trim()),
        // koordinat lokasi panggilan hanya dipakai untuk rata-rata per kab/kota, tidak pernah dikirim per baris
        la: coord(x.latitude),
        lo: coord(x.longitude),
      }))
    } catch {
      return []
    }
  })
  const rows = pages.flat().filter((r: any) => /^\d{4}-\d{2}-\d{2}$/.test(r.t))
  // Data urut dari laporan terbaru. Hari milik baris terakhir terpotong halaman, dan laporan susulan
  // bertanggal lama tidak lengkap: keduanya dibuang supaya tiap hari di sampel utuh.
  const tail: Record<string, number> = {}
  for (const r of rows.slice(-100)) tail[r.t] = (tail[r.t] || 0) + 1
  const cutoff = Object.entries(tail).sort((a, b) => b[1] - a[1])[0]?.[0] || ''
  const sample = rows.filter((r: any) => r.t > cutoff)
  const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)
  const harian: Record<string, any> = {}
  const provJenis: Record<string, Record<string, number>> = {}
  const jam = new Array(24).fill(0)
  const kategori: Record<string, number> = {}
  const sumber: Record<string, number> = {}
  const kab: Record<string, any> = {}
  for (const r of sample) {
    const kb = (kab[r.kk] ||= { code: r.kk, nama: r.kn, p: r.p, n: 0, gd: 0, bgd: 0, tk: 0, selesai: 0, ambulans: 0, sLat: 0, sLon: 0, nc: 0 })
    kb.n++
    if (r.j === 'Gawat Darurat') kb.gd++
    else if (r.j === 'Bukan Gawat Darurat') kb.bgd++
    else kb.tk++
    if (r.s === 'Selesai') kb.selesai++
    kb.ambulans += r.a
    if (r.la != null && r.lo != null && inIdn(r.la, r.lo)) { kb.sLat += r.la; kb.sLon += r.lo; kb.nc++ }
    const d = (harian[r.t] ||= { tanggal: r.t, total: 0, gawat_darurat: 0, bukan_gawat_darurat: 0, tanpa_kategori: 0, selesai: 0, diproses: 0, ambulans: 0, berjalan: r.t === today })
    d.total++
    if (r.j === 'Gawat Darurat') d.gawat_darurat++
    else if (r.j === 'Bukan Gawat Darurat') d.bukan_gawat_darurat++
    else d.tanpa_kategori++
    if (r.s === 'Selesai') d.selesai++
    else if (r.s === 'Diproses') d.diproses++
    d.ambulans += r.a
    const pj = (provJenis[r.p] ||= { total: 0, gawat_darurat: 0, bukan_gawat_darurat: 0, tanpa_kategori: 0, selesai: 0, ambulans: 0 })
    pj.total++
    if (r.j === 'Gawat Darurat') pj.gawat_darurat++
    else if (r.j === 'Bukan Gawat Darurat') pj.bukan_gawat_darurat++
    else pj.tanpa_kategori++
    if (r.s === 'Selesai') pj.selesai++
    pj.ambulans += r.a
    if (r.h >= 0 && r.h < 24) jam[r.h]++
    kategori[r.k] = (kategori[r.k] || 0) + 1
    sumber[r.u] = (sumber[r.u] || 0) + 1
  }
  const toList = (o: Record<string, number>) => Object.entries(o).map(([nama, jumlah]) => ({ nama, jumlah })).sort((a, b) => b.jumlah - a.jumlah)
  return {
    tahun,
    total: C.total as number,
    selesai: (C.selesai as number) ?? null,
    total_tahun_lalu: (C.prev as number) ?? null,
    provinsi: provCodes.map((c) => ({ code: c, panggilan: C[`p:${c}`] ?? null, selesai: C[`s:${c}`] ?? null })),
    sampel: {
      dari: sample.length ? sample.reduce((a: string, r: any) => (r.t < a ? r.t : a), '9999') : null,
      sampai: sample.length ? sample.reduce((a: string, r: any) => (r.t > a ? r.t : a), '0000') : null,
      jumlah: sample.length,
      harian: Object.values(harian).sort((a: any, b: any) => b.tanggal.localeCompare(a.tanggal)),
      provinsi: Object.entries(provJenis).map(([code, v]) => ({ code, ...v })),
      jam: jam.map((n, h) => ({ jam: h, jumlah: n })),
      kategori: toList(kategori),
      sumber: toList(sumber),
      // Agregat per kab/kota. Titik = rata-rata koordinat panggilan bila >= 5 panggilan berkoordinat (tidak menunjuk satu orang),
      // selain itu diisi lokasi PSC kab/kota tsb. saat digabung (mergeLive).
      kabkota: Object.values(kab).map((k: any) => {
        const pusat = kabPusat(k.code)
        let ok = k.nc >= MIN_PANGGILAN_TITIK
        if (ok && pusat && km([k.sLat / k.nc, k.sLon / k.nc], pusat) > 100) ok = false
        return {
          code: k.code, nama: k.nama, p: k.p, n: k.n, gd: k.gd, bgd: k.bgd, tk: k.tk, selesai: k.selesai, ambulans: k.ambulans,
          lat: ok ? Math.round((k.sLat / k.nc) * 100) / 100 : pusat ? pusat[0] : null,
          lon: ok ? Math.round((k.sLon / k.nc) * 100) / 100 : pusat ? pusat[1] : null,
          lokasi: ok ? 'panggilan' : pusat ? 'kabkota' : null,
        }
      }),
    },
  }
}

// ------------------------------------------------------------------ gabung ke snapshot
/** Hanya data EOC (untuk rute peta kejadian terbaru & proksi EOC). */
export async function getEocLive(budgetMs = 5000) {
  if (!eocEnabled()) return { fresh: false, pending: false, error: 'Akun API EOC (PUSKRIS_EOC_AUTH) belum diatur di server' } as LiveResult<Awaited<ReturnType<typeof fetchEocTahun>>>
  return swr('eoc:tahun', () => fetchEocTahun(), budgetMs)
}

export type LiveStatus = { status: 'langsung' | 'snapshot'; at?: string; error?: string; pending?: boolean }

export async function getLiveOverlay(provCodes: string[], budgetMs = 7000) {
  const tahun = Number(new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 4))
  const eocOff = { fresh: false, pending: false, error: 'Akun API EOC (PUSKRIS_EOC_AUTH) belum diatur di server' } as LiveResult<Awaited<ReturnType<typeof fetchEocTahun>>>
  const eocP = eocEnabled() ? swr('eoc:tahun', () => fetchEocTahun(), budgetMs) : Promise.resolve(eocOff)
  const st = (r: LiveResult<any>): LiveStatus =>
    r.value !== undefined ? { status: 'langsung', at: r.at ? wibStamp(r.at) : undefined, pending: r.pending || undefined } : { status: 'snapshot', error: r.error || (r.pending ? 'Sedang mengambil data langsung' : undefined), pending: r.pending || undefined }
  if (!liveEnabled()) {
    const stOff: LiveStatus = { status: 'snapshot', error: 'Token API belum diatur di server' }
    const e = { fresh: false, pending: false } as LiveResult<any>
    const eoc = await eocP
    return { asistensi: e, psc: e, panggilan: e, tck: e, tckRelawan: e, eoc, status: { asistensi: stOff, psc: stOff, panggilan: stOff, tck: stOff, tckRelawan: stOff, eoc: st(eoc) }, jobs: [eoc.job].filter(Boolean) as Promise<any>[] }
  }
  const [asistensi, psc, panggilan, tck, tckRelawan, eoc] = await Promise.all([
    swr(`asistensi:${tahun}`, () => fetchAsistensi(tahun), budgetMs),
    swr('psc:master', () => fetchPscMaster(), budgetMs),
    swr(`psc:panggilan:${tahun}`, () => fetchPanggilan(tahun, provCodes), budgetMs),
    swr('tck:inti', () => fetchTckInti(), budgetMs),
    swr('tck:relawan', () => fetchTckRelawan(provCodes), budgetMs),
    eocP,
  ])
  return {
    asistensi, psc, panggilan, tck, tckRelawan, eoc,
    status: { asistensi: st(asistensi), psc: st(psc), panggilan: st(panggilan), tck: st(tck), tckRelawan: st(tckRelawan), eoc: st(eoc) },
    jobs: [asistensi.job, psc.job, panggilan.job, tck.job, tckRelawan.job, eoc.job].filter(Boolean) as Promise<any>[],
  }
}

function countBy<T>(list: T[], key: (t: T) => string) {
  const o: Record<string, number> = {}
  for (const t of list) o[key(t)] = (o[key(t)] || 0) + 1
  return o
}

/** Gabungkan hasil API langsung ke struktur snapshot data/puskris-data.json (bentuk tetap sama). */
export function mergeLive(snapshot: any, ov: Awaited<ReturnType<typeof getLiveOverlay>>) {
  const data = { ...snapshot }
  const regions: { code: string; name: string }[] = snapshot.regions || []
  const nameOf = (c: string) => regions.find((r) => r.code === c)?.name || c

  const asis = ov.asistensi.value
  if (asis) {
    const capOrder = ['Tinggi', 'Sedang', 'Rendah', 'Belum Mengisi']
    const capP = countBy(asis.provinsi, (r: any) => r.status_kapasitas)
    const capK = countBy(asis.kabkota, (r: any) => r.status_kapasitas)
    const isiP = asis.provinsi.filter((r: any) => r.status_kapasitas !== 'Belum Mengisi').length
    const isiK = asis.kabkota.filter((r: any) => r.status_kapasitas !== 'Belum Mengisi').length
    data.asistensi = {
      ...snapshot.asistensi,
      data_source: 'langsung',
      fetched_at_wib: ov.status.asistensi.at,
      label: `langsung dari API Asistensi (rekapitulasi ${asis.tahun})`,
      tahun: asis.tahun,
      filterable_peta_provinsi: true,
      catatan: 'Poin dan status kapasitas serta status Indeks Risiko Bencana Indonesia per provinsi dan kab/kota diambil langsung dari API rekapitulasi Asistensi. Kelengkapan per modul belum tersedia di API, jadi masih memakai snapshot.',
      provinsi: { ...(snapshot.asistensi?.provinsi || {}), total: asis.provinsi.length, status_kapasitas: Object.fromEntries(capOrder.map((k) => [k, capP[k] || 0])), irbi: countBy(asis.provinsi, (r: any) => r.status_risiko_irbi) },
      kabupaten_kota: { ...(snapshot.asistensi?.kabupaten_kota || {}), total: asis.kabkota.length, status_kapasitas: Object.fromEntries(capOrder.map((k) => [k, capK[k] || 0])), irbi: countBy(asis.kabkota, (r: any) => r.status_risiko_irbi) },
      cakupan: {
        provinsi_mengisi_kapasitas: isiP, provinsi_total: asis.provinsi.length, provinsi_pct: Math.round((isiP / (asis.provinsi.length || 1)) * 1000) / 10,
        kabkot_mengisi_kapasitas: isiK, kabkot_total: asis.kabkota.length, kabkot_pct: Math.round((isiK / (asis.kabkota.length || 1)) * 1000) / 10,
      },
      wilayah: asis.provinsi.map((r: any) => ({ ...r, nama: nameOf(r.kode_wilayah), status_risiko_irbi_2024: r.status_risiko_irbi })),
      wilayah_kabkota: asis.kabkota,
      contoh_wilayah: [],
    }
  }

  const m = ov.psc.value
  const pg = ov.panggilan.value
  if (m || pg) {
    const snapPsc = snapshot.psc || {}
    const byM = Object.fromEntries((m?.provinsi || []).map((p: any) => [p.code, p]))
    const byPg = Object.fromEntries((pg?.provinsi || []).map((p: any) => [p.code, p]))
    const provinsi = regions.map((r) => {
      const s = (snapPsc.provinsi || []).find((x: any) => x.code === r.code) || { code: r.code, nama: r.name }
      const x = byM[r.code]
      const y = byPg[r.code]
      return {
        ...s,
        nama: s.nama || nameOf(r.code),
        ...(x ? {
          psc_total: x.psc_total, psc_aktif: x.psc_aktif, ambulans: x.ambulans, ambulans_aktif: x.ambulans_aktif, ambulans_baik: x.ambulans_baik,
          ambulans_rusak_ringan: x.ambulans_rusak_ringan, ambulans_rusak_berat: x.ambulans_rusak_berat, ambulans_gps: x.ambulans_gps,
          rs_jejaring: x.rs_jejaring, personil: x.personil, personil_medis: x.personil_medis, personil_perawat: x.personil_perawat,
          personil_bidan: x.personil_bidan, personil_driver: x.personil_driver, personil_lain: x.personil_lain, anggaran_tahun_ini: x.anggaran_tahun_ini,
        } : {}),
        ...(y && y.panggilan != null ? { panggilan: y.panggilan, panggilan_selesai: y.selesai } : {}),
      }
    })
    data.psc = {
      ...snapPsc,
      data_source: 'langsung',
      fetched_at_wib: ov.status.psc.at || ov.status.panggilan.at,
      label: [m ? 'master PSC, ambulans, SDM, RS langsung dari API PSC 119' : null, pg ? `hitungan panggilan ${pg.tahun} langsung dari API PSC 119` : null].filter(Boolean).join('; '),
      provinsi,
      summary: {
        ...(snapPsc.summary || {}),
        ...(m ? m.summary : {}),
        ...(pg ? (() => {
          const gd = pg.sampel.harian.reduce((a: number, d: any) => a + d.gawat_darurat, 0)
          const bgd = pg.sampel.harian.reduce((a: number, d: any) => a + d.bukan_gawat_darurat, 0)
          const share = pg.sampel.jumlah ? gd / pg.sampel.jumlah : null
          return {
            total_panggilan: pg.total, panggilan_selesai: pg.selesai, total_panggilan_tahun_lalu: pg.total_tahun_lalu, tahun_panggilan: pg.tahun,
            // Sumber tidak punya filter jenis: angka darurat = proporsi sampel terbaru x total tahun ini (perkiraan).
            total_emergency: share != null ? Math.round(pg.total * share) : null,
            total_non_emergency: pg.sampel.jumlah ? Math.round(pg.total * (bgd / pg.sampel.jumlah)) : null,
            emergency_share: share != null ? share * 100 : null,
            emergency_perkiraan: true,
          }
        })() : {}),
      },
      ...(m ? { kondisi_ambulans: m.kondisi_ambulans, jenis_ambulans: m.jenis_ambulans, jenis_tenaga: m.jenis_tenaga, kepemilikan: m.kepemilikan, titik_psc: m.titik_psc, titik_rs: m.titik_rs } : {}),
      ...(pg ? { panggilan_sampel: pg.sampel } : {}),
      ...(m ? { peta: m.peta } : {}),
    }
  }
  mergeTck(data, snapshot, ov)
  mergeEoc(data, snapshot, ov)
  const { tckRelawan: _rel, eoc: stEoc, ...stRest } = ov.status
  data.live_status = {
    ...stRest,
    tck: ov.tck.value || ov.tckRelawan.value
      ? { status: 'langsung', at: ov.status.tck.at || ov.status.tckRelawan.at, pending: ov.status.tck.pending || ov.status.tckRelawan.pending || undefined, error: !ov.tckRelawan.value ? 'Sebaran relawan per provinsi masih dimuat / snapshot' : !ov.tck.value ? 'Tim & EMT masih snapshot' : undefined }
      : { ...ov.status.tck, at: ov.status.tck.at || snapshot.tck?.fetched_at_wib },
    logistik: { status: 'snapshot', at: snapshot.logistik?.fetched_at_wib, error: 'API Logistik belum tersedia (hanya alamat dasar)' },
    eoc: ov.eoc.value ? stEoc : { ...stEoc, at: snapshot.eoc?.fetched_at_wib },
    ncc: { status: 'snapshot', at: snapshot.ncc?.fetched_at_wib },
  }
  return data
}


/** Timpa data.tck snapshot dengan agregat langsung API Tenaga Cadangan (bentuk lama tetap ada). */
function mergeTck(data: any, snapshot: any, ov: Awaited<ReturnType<typeof getLiveOverlay>>) {
  const inti = ov.tck.value
  const rel = ov.tckRelawan.value
  if (!inti && !rel) return
  const snap = snapshot.tck || {}
  const regions: { code: string; name: string }[] = snapshot.regions || []
  const relBy: Record<string, any> = Object.fromEntries((rel?.provinsi || []).map((p: any) => [p.code, p]))
  const timBy: Record<string, any> = Object.fromEntries((inti?.tim.provinsi || []).map((p: any) => [p.code, p]))
  const emtBy: Record<string, any> = Object.fromEntries((inti?.emt.provinsi || []).map((p: any) => [p.code, p]))
  const snapBy: Record<string, any> = Object.fromEntries((snap.provinsi || []).map((p: any) => [p.code, p]))
  const provinsi = regions.map((r) => {
    const s0 = snapBy[r.code] || { code: r.code, nama: r.name, nakes: 0, non_nakes: 0, individu: 0 }
    const rp = relBy[r.code]
    const t = timBy[r.code]
    const e = emtBy[r.code]
    return {
      ...s0,
      ...(rp ? { individu: rp.individu, nakes: rp.nakes, non_nakes: rp.non_nakes, perempuan: rp.perempuan, laki: rp.laki, usia: rp.usia, terhubung_tim: rp.terhubung_tim, profesi: rp.profesi, kab: rp.kab, sumber_individu: 'langsung' } : { sumber_individu: 'snapshot' }),
      ...(inti ? {
        tim: t?.jumlah || 0, tim_individu: t?.individu || 0, tim_per_tahun: t?.per_tahun || {},
        emt: e?.jumlah || 0, emt_standar: e?.standar || 0, emt_sk: e?.sk || 0, emt_individu: e?.individu || 0, emt_respon_24: e?.respon_24 || 0, emt_per_tahun: e?.per_tahun || {},
      } : {}),
    }
  })
  const d = inti?.dashboard
  const di = d?.individu || {}
  const dt = d?.tim || {}
  const de = d?.emt || {}
  const delta = (now: number, prev: number) => ({ d: now - prev, pct: now ? Math.round(((now - prev) / now) * 10000) / 100 : 0 })
  const sumRel = (k: string) => (rel?.provinsi || []).reduce((a: number, p: any) => a + (p[k] || 0), 0)
  const profesi: Record<string, number> = {}
  for (const p of rel?.provinsi || []) for (const [k, v] of Object.entries(p.profesi || {})) profesi[k] = (profesi[k] || 0) + (v as number)
  const summary = { ...(snap.summary || {}) }
  if (d) {
    const iD = delta(Number(di.perdaftaran_bulan_ini || 0), Number(di.perdaftaran_bulan_sebelumnya || 0))
    const tD = delta(Number(dt.perdaftaran_bulan_ini || 0), Number(dt.perdaftaran_bulan_sebelumnya || 0))
    const eD = delta(Number(de.perdaftaran_bulan_ini || 0), Number(de.perdaftaran_bulan_sebelumnya || 0))
    Object.assign(summary, {
      individu: Number(di.total_individu || 0), individu_bulan_ini: Number(di.perdaftaran_bulan_ini || 0), individu_bulan_lalu: Number(di.perdaftaran_bulan_sebelumnya || 0), individu_delta_bulan: iD.d, individu_delta_pct: iD.pct, individu_hari_ini: Number(di.perdaftaran_hari_ini || 0),
      tim: Number(dt.total_tim || 0), tim_bulan_ini: Number(dt.perdaftaran_bulan_ini || 0), tim_delta_bulan: tD.d, tim_delta_pct: tD.pct, tim_hari_ini: Number(dt.perdaftaran_hari_ini || 0),
      emt: Number(de.total_emt || 0), emt_bulan_ini: Number(de.perdaftaran_bulan_ini || 0), emt_delta_bulan: eD.d, emt_delta_pct: eD.pct, emt_hari_ini: Number(de.perdaftaran_hari_ini || 0),
      emt_standar: inti!.emt.standar, emt_sk: inti!.emt.sk, emt_individu: inti!.emt.individu, tim_individu: inti!.tim.individu,
    })
  }
  if (rel) Object.assign(summary, { individu_provinsi_total: sumRel('individu'), nakes_geojson: sumRel('nakes'), non_nakes_geojson: sumRel('non_nakes'), individu_geojson: sumRel('individu'), perempuan: sumRel('perempuan'), laki: sumRel('laki'), terhubung_tim: sumRel('terhubung_tim') })
  data.tck = {
    ...snap,
    data_source: 'langsung',
    fetched_at_wib: ov.status.tck.at || ov.status.tckRelawan.at,
    label: [d ? 'total, pendaftaran, tim & Tim Medis Darurat langsung dari API Tenaga Cadangan' : null, rel ? 'sebaran relawan per provinsi langsung dari API relawan-tck' : null].filter(Boolean).join('; '),
    sumber_status: { inti: inti ? 'langsung' : 'snapshot', relawan: rel ? 'langsung' : 'snapshot', relawan_gagal: rel?.gagal || [] },
    summary,
    provinsi,
    ...(d ? { tren_pendaftaran: d.tren } : {}),
    ...(inti ? { emt_rekap: { jenis: inti.emt.jenis, waktu_respon: inti.emt.waktu_respon, per_tahun: inti.emt.per_tahun }, tim_rekap: { jenis: inti.tim.jenis, waktu_respon: inti.tim.waktu_respon, per_tahun: inti.tim.per_tahun } } : {}),
    ...(rel ? { profesi: TCK_PROFESI.map((nama) => ({ nama, jumlah: profesi[nama] || 0 })) } : {}),
  }
}


/** Bentuk ringkas untuk klien: field bernilai 0/null dihilangkan supaya muatan kecil. */
function packEvent(e: EocEvent) {
  const o: Record<string, any> = { u: e.u, t: e.t, n: e.n, k: /^alam/i.test(e.k) ? 'A' : /^non/i.test(e.k) ? 'N' : /^sosial/i.test(e.k) ? 'S' : 'L', p: e.p, bn: e.bn }
  if (e.w) o.w = e.w
  if (e.b) o.b = e.b
  for (const k of ['s', 'kr', 'td', 'm', 'h', 'lb', 'lr', 'pg', 'fr'] as const) if (e[k]) o[k] = e[k]
  if (e.la != null && e.lo != null) { o.la = e.la; o.lo = e.lo }
  return o
}

/** Timpa data.eoc snapshot dengan agregat langsung API EOC (data_krisis.php); bentuk lama tetap ada. */
function mergeEoc(data: any, snapshot: any, ov: Awaited<ReturnType<typeof getLiveOverlay>>) {
  const v = ov.eoc.value
  if (!v) return
  const snap = snapshot.eoc || {}
  const y = v.tahun
  const ev = v.events.filter((e) => e.t.startsWith(String(y)))
  const kpi = rekapEoc(ev)
  const kr = ev.filter((e) => e.s)
  const kk = rekapEoc(kr)
  const regions: { code: string; name: string }[] = snapshot.regions || []
  const byP = new Map<string, EocEvent[]>()
  for (const e of ev) { const a = byP.get(e.p) || []; a.push(e); byP.set(e.p, a) }
  const provinsi = regions.map((r) => {
    const s0 = (snap.provinsi || []).find((x: any) => String(x.code) === r.code) || { code: r.code, nama: r.name }
    const k = rekapEoc(byP.get(r.code) || [])
    return {
      ...s0,
      kejadian_2026: k.terpantau, krisis_2026: k.berdampak_krisis, meninggal_2026: k.meninggal, pengungsi_2026: k.pengungsi, terdampak_2026: k.terdampak,
      hilang_2026: k.hilang, luka_berat_2026: k.luka_berat, luka_ringan_2026: k.luka_ringan, korban_2026: k.korban_total, faskes_rusak_2026: k.faskes_rusak,
    }
  })
  const jenis: Record<string, number> = {}
  for (const e of ev) jenis[e.n] = (jenis[e.n] || 0) + 1
  const bulan: Record<string, any> = {}
  for (const e of ev) {
    const b = (bulan[e.t.slice(0, 7)] ||= { bulan: e.t.slice(0, 7), kejadian: 0, krisis: 0, meninggal: 0, hilang: 0, luka_berat: 0, luka_ringan: 0, pengungsi: 0, terdampak: 0 })
    b.kejadian++; b.krisis += e.s; b.meninggal += e.m; b.hilang += e.h; b.luka_berat += e.lb; b.luka_ringan += e.lr; b.pengungsi += e.pg; b.terdampak += e.td
  }
  const tren = (list: any[] | undefined, val: number, krisisVal?: number) =>
    (list || []).some((x) => Number(x.tahun) === y)
      ? (list || []).map((x) => (Number(x.tahun) === y ? { ...x, jumlah: val, ...(krisisVal != null && 'krisis' in x ? { krisis: krisisVal } : {}) } : x))
      : list
  const nas = snap.nasional || {}
  const detailUrl = (u: string) => `https://pusatkrisis.kemkes.go.id/detail-bencana/${encodeURIComponent(u)}`
  data.eoc = {
    ...snap,
    data_source: 'langsung',
    fetched_at_wib: ov.status.eoc.at,
    label: `kejadian ${y} langsung dari API EOC Pusat Krisis (data_krisis, ${ev.length.toLocaleString('id-ID')} kejadian)`,
    sumber_api: 'https://pusatkrisis.kemkes.go.id/eoc/api/detail_bencana/data_krisis.php',
    gagal_bulan: v.gagal,
    nasional: {
      ...nas,
      tahun: y,
      fetched_at_wib: ov.status.eoc.at,
      kejadian_tahun: { ...kpi },
      krisis_tahun: { kejadian: kk.terpantau, korban_total: kk.korban_total, meninggal: kk.meninggal, hilang: kk.hilang, luka_berat: kk.luka_berat, luka_ringan: kk.luka_ringan, pengungsi: kk.pengungsi, terdampak: kk.terdampak, alam: kk.alam, non_alam: kk.non_alam, sosial: kk.sosial },
      dashboard_new_kejadian_tahun: nas.kejadian_tahun,
      tren_5_tahun_terpantau: tren(nas.tren_5_tahun_terpantau, kpi.terpantau),
      tren_5_tahun_krisis: tren(nas.tren_5_tahun_krisis, kpi.berdampak_krisis),
      tren_5_tahun_meninggal: tren(nas.tren_5_tahun_meninggal, kpi.meninggal),
      tren_5_tahun_meninggal_krisis: tren(nas.tren_5_tahun_meninggal_krisis, kk.meninggal),
      tren_5_tahun_luka_berat: tren(nas.tren_5_tahun_luka_berat, kpi.luka_berat, kk.luka_berat),
      tren_5_tahun_luka_ringan: tren(nas.tren_5_tahun_luka_ringan, kpi.luka_ringan, kk.luka_ringan),
      tren_5_tahun_pengungsi: tren(nas.tren_5_tahun_pengungsi, kpi.pengungsi, kk.pengungsi),
      tren_5_tahun_terdampak: tren(nas.tren_5_tahun_terdampak, kpi.terdampak, kk.terdampak),
    },
    provinsi,
    jenis_2026: Object.entries(jenis).map(([nama, jumlah]) => ({ nama, jumlah })).sort((a, b) => b.jumlah - a.jumlah),
    bulanan_2026: Object.values(bulan).sort((a: any, b: any) => a.bulan.localeCompare(b.bulan)),
    kejadian_krisis_terbaru: kr.map((e) => ({
      tanggal: e.t, jenis: e.n, provinsi: e.pn, kabupaten: e.bn, code: e.p, terdampak: e.td, meninggal: e.m, hilang: e.h,
      luka_berat: e.lb, luka_ringan: e.lr, pengungsi: e.pg, korban: e.kr, uid: e.u, url: detailUrl(e.u), lat: e.la, lon: e.lo, jam: e.w,
    })),
    jenis_master: v.jenis,
    events: v.events.map(packEvent),
    events_dari: v.dari,
    events_sampai: v.sampai,
  }
}
