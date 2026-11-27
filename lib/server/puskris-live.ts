/**
 * Konsumsi API resmi Pusat Krisis Kesehatan (PSC 119, Asistensi) di sisi server.
 * - Token hanya dibaca dari env server PUSKRIS_TTOKEN (tidak pernah dikirim ke klien / dicatat).
 * - Hanya endpoint baca/rekap; tidak memanggil SSO atau endpoint ubah data.
 * - Keluaran SELALU agregat: field pribadi (nama, telepon, alamat, keluhan, plat nomor) dibuang di sini.
 * - Cache memori 15 menit + stale-while-revalidate; bila gagal, bagian itu kosong (status tidak_tersedia), tanpa angka cadangan.
 */

import { persist, REVALIDATE } from './persist'
import KAB_CENTROID from '../../data/kab-centroid.json'
import { fetchTckInti, fetchTckRelawan, TCK_PROFESI } from './tck-live'
import { fetchLogistik, LOG_KATEGORI } from './logistik-live'
import { nccEnabled, fetchNcc, type NccRingkasan } from './ncc-live'
import { eocEnabled, fetchEocRange, fetchEocTahun, fetchEocTren, rekapEoc, type EocEvent } from './eoc-live'
import { getPuskrisToken, getNccSheetUrl, getPieBase, getPieKey } from './puskris-auth-config'
import { puskrisFetchJson } from './puskris-http'
import { parsePieStatus, pieNamaKey, resolveKodeKab, type PieRecord } from '@/lib/puskris/risiko-pie'
import fs from 'node:fs'
import path from 'node:path'

const TTL_MS = 15 * 60_000
const PSC_BASE = (process.env.PUSKRIS_PSC_BASE || 'https://psc.kemkes.go.id').replace(/\/$/, '')
const ASIS_BASE = (process.env.PUSKRIS_ASISTENSI_BASE || 'https://pusatkrisis.kemkes.go.id/asistensi').replace(/\/$/, '')

export function liveEnabled() {
  return Boolean(getPuskrisToken())
}

export function wibStamp(ms = Date.now()) {
  const d = new Date(ms + 7 * 3600_000)
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)} WIB`
}

export async function postForm(url: string, form: Record<string, string | number>, timeoutMs = 60_000): Promise<any> {
  const token = getPuskrisToken()
  if (!token) throw new Error('Token Puskris (TTOKEN) belum diatur')
  const body = new URLSearchParams()
  for (const [k, v] of Object.entries(form)) body.set(k, String(v))
  const j = await puskrisFetchJson(url, {
    method: 'POST',
    headers: { TTOKEN: token, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: body.toString(),
    timeoutMs,
  })
  if (j && (j.status === false || j.sukses === 0)) throw new Error(String(j.message || 'API menolak permintaan'))
  return j
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

export async function swr<T>(key: string, fn: () => Promise<T>, budgetMs: number, ttlMs = TTL_MS): Promise<LiveResult<T>> {
  const e = store.get(key) || { at: 0 }
  if (e.value !== undefined && Date.now() - e.at < ttlMs) return { value: e.value, at: e.at, fresh: true, pending: false }
  if (!e.pending) {
    e.pending = fn()
      .then((v) => {
        // Hasil sebagian (ada potongan gagal: bulan EOC / provinsi TCK / regional Logistik) hanya disimpan 30 detik
        // di memori, supaya permintaan berikutnya mengulang potongan yang gagal (yang berhasil sudah di cache persisten).
        const sebagian = (Array.isArray((v as any)?.gagal) && (v as any).gagal.length > 0) || (Array.isArray(v) && v.some((x: any) => Array.isArray(x?.gagal) && x.gagal.length > 0))
        store.set(key, { at: sebagian ? Date.now() - ttlMs + 30_000 : Date.now(), value: v })
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
  // Ada nilai lama: kembalikan segera (stale-while-revalidate). Cache dingin: tunggu sampai budgetMs.
  const wait = e.value !== undefined ? Math.min(budgetMs, 1500) : budgetMs
  const done = await Promise.race([job.then(() => true), new Promise<boolean>((r) => setTimeout(() => r(false), wait))])
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

// ------------------------------------------------------------------ PIE (Peta Risiko PIE)
// Satu panggilan per tahun: GET {PIE_BASE}/record-data?year=YYYY (read-only). Tingkat wilayah & penyakit
// dihitung dari rekaman tahun itu di klien, jadi kunci cache cukup per tahun.
// Kode kab/kota PIE memakai penomoran sendiri (mis. 2803 = Halmahera Barat, Kemendagri 8201), jadi
// dipetakan ke kode Kemendagri lewat nama + jenis (Kota/Kab) di GeoJSON kab/kota proyek.
// Rekaman tanpa status yang dikenali atau yang kodenya tidak terpetakan TIDAK diberi nilai pengganti;
// keduanya dikeluarkan dan dihitung di ringkasan (tanpa_status, tanpa_kode).
type KabGeoInfo = { code: string; prov: string; nama: string; lat: number | null; lon: number | null }
let kabGeoIndex: {
  byProvFull: Map<string, KabGeoInfo>
  byProvTight: Map<string, KabGeoInfo>
  byProvBare: Map<string, KabGeoInfo>
} | null = null

const normKabTck = (s: string) =>
  String(s || '')
    .toUpperCase()
    .replace(/^KABUPATEN\s+|^KAB\.?\s+|^KOTA\s+ADM\.?\s+|^KOTA\s+ADMINISTRASI\s+|^ADM\.?\s+/, '')
    .replace(/^KOTA\s+(?!BARU\b)/, '')
    .replace(/\bKEP\.?\s+/g, 'KEPULAUAN ')
    .replace(/\bADM\.?\s+/g, '')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()

function getKabGeoIndex() {
  if (kabGeoIndex) return kabGeoIndex
  const byProvFull = new Map<string, KabGeoInfo>()
  const byProvTight = new Map<string, KabGeoInfo>()
  const byProvBare = new Map<string, KabGeoInfo>()
  try {
    const fc = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public', 'data', 'indonesia-kabupaten.geojson'), 'utf8'))
    for (const f of fc.features || []) {
      const p = String(f.properties?.kode_prov || '').padStart(2, '0')
      const code = String(f.properties?.kode_kab || '').padStart(4, '0')
      const rawNama = String(f.properties?.nama_kab || '').trim()
      if (!p || !code || !rawNama) continue
      const upper = rawNama.toUpperCase()
      const isKota = /^KOTA\b/.test(upper)
      const bare = normKabTck(upper)
      const tight = bare.replace(/\s+/g, '')
      const full = `${isKota ? 'KOTA' : 'KAB'}|${tight}`
      const kc = kabPusat(code)
      const lat = Number(f.properties?.centerlat) || kc?.[0] || null
      const lon = Number(f.properties?.centerlong) || kc?.[1] || null
      const info: KabGeoInfo = { code, prov: p, nama: rawNama, lat: lat != null ? Math.round(lat * 1e4) / 1e4 : null, lon: lon != null ? Math.round(lon * 1e4) / 1e4 : null }
      byProvFull.set(`${p}|${full}`, info)
      if (!byProvTight.has(`${p}|${tight}`)) byProvTight.set(`${p}|${tight}`, info)
      if (!byProvBare.has(`${p}|${bare}`)) byProvBare.set(`${p}|${bare}`, info)
    }
  } catch { /* fallback to empty index */ }
  kabGeoIndex = { byProvFull, byProvTight, byProvBare }
  return kabGeoIndex
}

function resolveTckKabGeo(provCode: string, rawKabNama: string): KabGeoInfo | null {
  const raw = String(rawKabNama || '').toUpperCase().trim()
  if (!raw || raw === '-' || raw === 'TIDAK DIISI') return null
  const p = String(provCode || '').padStart(2, '0')
  const isKota = /^KOTA\b/.test(raw)
  const bare = normKabTck(raw)
  if (!bare) return null
  const tight = bare.replace(/\s+/g, '')
  const idx = getKabGeoIndex()
  return (
    idx.byProvFull.get(`${p}|${isKota ? 'KOTA' : 'KAB'}|${tight}`) ||
    idx.byProvTight.get(`${p}|${tight}`) ||
    idx.byProvBare.get(`${p}|${bare}`) ||
    null
  )
}

let kabNameMap: Map<string, string> | null = null
function getKabNameMap(): Map<string, string> {
  if (kabNameMap) return kabNameMap
  const fc = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public', 'data', 'indonesia-kabupaten.geojson'), 'utf8'))
  const m = new Map<string, string>()
  for (const f of fc.features || []) {
    const nama = f.properties?.nama_kab
    const kode = f.properties?.kode_kab
    if (nama && kode) m.set(pieNamaKey(nama), String(kode).padStart(4, '0'))
  }
  kabNameMap = m
  return m
}

export async function fetchRisikoPie(tahun: number) {
  const base = getPieBase()
  const key = getPieKey()
  const res = await fetch(`${base}/record-data?year=${tahun}`, {
    headers: {
      'X-API-KEY': key,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(25_000),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`PIE API HTTP ${res.status}`)
  const json = await res.json()
  if (!Array.isArray(json?.data)) throw new Error('PIE API: format respons tidak dikenal (data bukan larik)')
  const rawList: any[] = json.data
  const nameMap = getKabNameMap()
  let tanpaStatus = 0
  const tanpaKode: string[] = []
  const records: PieRecord[] = []
  for (const r of rawList) {
    const rawP = String(r.jns_penyakit || '')
    const pParts = rawP.split(',')
    const pId = pParts[0]?.trim() || ''
    const pName = pParts.slice(1).join(',').trim() || rawP
    const rawSt = String(r.status || '')
    const stParsed = parsePieStatus(rawSt)
    if (!stParsed) { tanpaStatus++; continue }
    const rawCode = String(r.kode_kako || '').padStart(4, '0')
    const kemenCode = resolveKodeKab(rawCode, r.nama_kako, nameMap)
    if (!kemenCode) { tanpaKode.push(`${rawCode} ${r.nama_kako || ''}`.trim()); continue }
    records.push({
      jns_penyakit: rawP,
      penyakit_nama: pName,
      penyakit_id: pId,
      tahun: String(r.tahun || tahun),
      timestamp_isi: r.timestamp_isi || '',
      kode_kako: rawCode,
      kode_kemendagri: kemenCode,
      kd_prop: kemenCode.slice(0, 2),
      nama_kako: r.nama_kako || '',
      status_raw: rawSt,
      status_label: stParsed.label,
      status_score: stParsed.score,
      warna: stParsed.color,
    })
  }
  const summary = {
    tahun,
    api_total: rawList.length,
    total_records: records.length,
    tinggi: records.filter((r) => r.status_score === 3).length,
    sedang: records.filter((r) => r.status_score === 2).length,
    rendah: records.filter((r) => r.status_score === 1).length,
    tanpa_status: tanpaStatus,
    tanpa_kode: tanpaKode.length,
    tanpa_kode_contoh: [...new Set(tanpaKode)].slice(0, 10),
  }
  return { tahun, records, summary }
}

/** Data Peta Risiko PIE satu tahun (cache memori + cache persisten per tahun). */
export function getRisikoPie(tahun: number, budgetMs = 25_000) {
  return swr(`pie:${tahun}`, () => P(['pie-data', tahun], () => fetchRisikoPie(tahun)), budgetMs)
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

// ------------------------------------------------------------------ gabung ke kerangka data
/** Hanya data EOC (untuk rute peta kejadian terbaru & proksi EOC). */
export async function getEocLive(budgetMs = 5000) {
  if (!eocEnabled()) return { fresh: false, pending: false, error: 'Akun API EOC (PUSKRIS_EOC_AUTH) belum diatur di server' } as LiveResult<Awaited<ReturnType<typeof fetchEocTahun>>>
  return swr('eoc:tahun', () => fetchEocTahun(), budgetMs)
}

export type LiveStatus = { status: 'langsung' | 'tidak_tersedia'; at?: string; error?: string; pending?: boolean }

/** Rentang tanggal opsional dari Filter Dasbor (dipakai bila di luar cakupan data tahun berjalan). */
export type RentangApi = { tanggal1: string; tanggal2: string } | null

/** Validasi ?tanggal1&tanggal2 (YYYY-MM-DD, urut, mulai 2015, maks. 6 tahun). */
export function parseRentang(sp: URLSearchParams): RentangApi {
  const a = sp.get('tanggal1'), b = sp.get('tanggal2')
  const ok = (v: string | null) => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)))
  if (!ok(a) || !ok(b) || a! > b! || a! < '2015-01-01') return null
  if (Date.parse(b!) - Date.parse(a!) > 6 * 366 * 86400_000) return null
  return { tanggal1: a!, tanggal2: b! }
}

const P = <T,>(key: (string | number)[], fn: () => Promise<T>) => persist(key, fn, REVALIDATE.singkat, ['live'])

export async function getLiveOverlay(provCodes: string[], budgetMs = 7000, rentang: RentangApi = null) {
  const nccOff = { fresh: false, pending: false, error: 'API NCC belum terhubung (PUSKRIS_NCC_URL belum diatur di server)' } as LiveResult<NccRingkasan>
  const nccP = nccEnabled()
    ? (rentang ? swr(`ncc:${rentang.tanggal1}:${rentang.tanggal2}`, () => P(['ncc', rentang.tanggal1, rentang.tanggal2], () => fetchNcc(rentang)), budgetMs) : swr('ncc:ringkasan', () => P(['ncc'], () => fetchNcc()), budgetMs))
    : Promise.resolve(nccOff)
  const tahun = Number(new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 4))
  const eocOff = { fresh: false, pending: false, error: 'Akun API EOC (PUSKRIS_EOC_AUTH) belum diatur di server' } as LiveResult<Awaited<ReturnType<typeof fetchEocTahun>>>
  // Rentang di luar tahun berjalan: ambil kejadian EOC tepat untuk tanggal1–tanggal2 (per bulan, cache 15 menit).
  const eocP = !eocEnabled() ? Promise.resolve(eocOff)
    : rentang ? swr(`eoc:rentang:${rentang.tanggal1}:${rentang.tanggal2}`, async () => ({ tahun: Number(rentang.tanggal2.slice(0, 4)), rentang: true, ...(await fetchEocRange(rentang)), jenis: [] as { uid: string; nama: string }[] }), budgetMs)
    : swr('eoc:tahun', () => fetchEocTahun(), budgetMs)
  // tren tahun-tahun sebelumnya: data historis jarang berubah, cache 6 jam
  const trenP = eocEnabled() ? swr(`eoc:tren:${tahun}`, () => fetchEocTren(4), Math.min(budgetMs, 1500), 6 * 3600_000) : Promise.resolve(eocOff as LiveResult<any>)
  const st = (r: LiveResult<any>): LiveStatus =>
    r.value !== undefined ? { status: 'langsung', at: r.at ? wibStamp(r.at) : undefined, pending: r.pending || undefined } : { status: 'tidak_tersedia', error: r.error || (r.pending ? 'Sedang mengambil data dari API' : 'Data belum tersedia dari API'), pending: r.pending || undefined }
  if (!liveEnabled()) {
    const stOff: LiveStatus = { status: 'tidak_tersedia', error: 'Token API (PUSKRIS_TTOKEN) belum diatur di server' }
    const e = { fresh: false, pending: false } as LiveResult<any>
    const [eoc, ncc, eocTren] = await Promise.all([eocP, nccP, trenP])
    return { asistensi: e, psc: e, panggilan: e, tck: e, tckRelawan: e, logistik: e as LiveResult<Awaited<ReturnType<typeof fetchLogistik>>>, eoc, ncc, eocTren: eocTren as LiveResult<Awaited<ReturnType<typeof fetchEocTren>>>, status: { asistensi: stOff, psc: stOff, panggilan: stOff, tck: stOff, tckRelawan: stOff, logistik: stOff, eoc: st(eoc), ncc: st(ncc) }, jobs: [eoc.job, ncc.job, eocTren.job].filter(Boolean) as Promise<any>[] }
  }
  const [asistensi, psc, panggilan, tck, tckRelawan, eoc, logistik, ncc, eocTren] = await Promise.all([
    // P(): hasil ringkas juga disimpan di cache persisten (lintas instance Vercel), 15 menit.
    swr(`asistensi:${tahun}`, () => P(['asistensi', tahun], () => fetchAsistensi(tahun)), budgetMs),
    swr('psc:master', () => P(['psc-master'], () => fetchPscMaster()), budgetMs),
    swr(`psc:panggilan:${tahun}`, () => P(['psc-panggilan', tahun], () => fetchPanggilan(tahun, provCodes)), budgetMs),
    swr('tck:inti', () => P(['tck-inti'], () => fetchTckInti()), budgetMs),
    swr('tck:relawan', () => fetchTckRelawan(provCodes), budgetMs),
    eocP,
    swr('logistik:stok', () => fetchLogistik(), budgetMs),
    nccP,
    trenP as Promise<LiveResult<Awaited<ReturnType<typeof fetchEocTren>>>>,
  ])
  return {
    asistensi, psc, panggilan, tck, tckRelawan, eoc, logistik, ncc, eocTren,
    status: { asistensi: st(asistensi), psc: st(psc), panggilan: st(panggilan), tck: st(tck), tckRelawan: st(tckRelawan), eoc: st(eoc), logistik: st(logistik), ncc: st(ncc) },
    jobs: [asistensi.job, psc.job, panggilan.job, tck.job, tckRelawan.job, eoc.job, logistik.job, ncc.job, eocTren.job].filter(Boolean) as Promise<any>[],
  }
}

function countBy<T>(list: T[], key: (t: T) => string) {
  const o: Record<string, number> = {}
  for (const t of list) o[key(t)] = (o[key(t)] || 0) + 1
  return o
}

/** Isi kerangka data (lib/puskris/load-data.ts, tanpa angka) dengan hasil API langsung. */
export function mergeLive(base: any, ov: Awaited<ReturnType<typeof getLiveOverlay>>) {
  const data = { ...base }
  const regions: { code: string; name: string }[] = base.regions || []
  const nameOf = (c: string) => regions.find((r) => r.code === c)?.name || c

  const asis = ov.asistensi.value
  if (asis) {
    const capOrder = ['Tinggi', 'Sedang', 'Rendah', 'Belum Mengisi']
    const capP = countBy(asis.provinsi, (r: any) => r.status_kapasitas)
    const capK = countBy(asis.kabkota, (r: any) => r.status_kapasitas)
    const isiP = asis.provinsi.filter((r: any) => r.status_kapasitas !== 'Belum Mengisi').length
    const isiK = asis.kabkota.filter((r: any) => r.status_kapasitas !== 'Belum Mengisi').length
    data.asistensi = {
      ...base.asistensi,
      data_source: 'langsung',
      fetched_at_wib: ov.status.asistensi.at,
      label: `langsung dari API Asistensi (rekapitulasi ${asis.tahun})`,
      tahun: asis.tahun,
      filterable_peta_provinsi: true,
      catatan: 'Poin dan status kapasitas serta status Indeks Risiko Bencana Indonesia per provinsi dan kab/kota diambil langsung dari API rekapitulasi Asistensi. Kelengkapan per modul belum tersedia di API.',
      provinsi: { ...(base.asistensi?.provinsi || {}), total: asis.provinsi.length, status_kapasitas: Object.fromEntries(capOrder.map((k) => [k, capP[k] || 0])), irbi: countBy(asis.provinsi, (r: any) => r.status_risiko_irbi) },
      kabupaten_kota: { ...(base.asistensi?.kabupaten_kota || {}), total: asis.kabkota.length, status_kapasitas: Object.fromEntries(capOrder.map((k) => [k, capK[k] || 0])), irbi: countBy(asis.kabkota, (r: any) => r.status_risiko_irbi) },
      cakupan: {
        provinsi_mengisi_kapasitas: isiP, provinsi_total: asis.provinsi.length, provinsi_pct: Math.round((isiP / (asis.provinsi.length || 1)) * 1000) / 10,
        kabkot_mengisi_kapasitas: isiK, kabkot_total: asis.kabkota.length, kabkot_pct: Math.round((isiK / (asis.kabkota.length || 1)) * 1000) / 10,
      },
      wilayah: asis.provinsi.map((r: any) => ({ ...r, nama: nameOf(r.kode_wilayah), status_risiko_irbi_2024: r.status_risiko_irbi })),
      wilayah_kabkota: asis.kabkota,
    }
  }

  const m = ov.psc.value
  const pg = ov.panggilan.value
  if (m || pg) {
    const basePsc = base.psc || {}
    const byM = Object.fromEntries((m?.provinsi || []).map((p: any) => [p.code, p]))
    const byPg = Object.fromEntries((pg?.provinsi || []).map((p: any) => [p.code, p]))
    const provinsi = regions.map((r) => {
      const s = (basePsc.provinsi || []).find((x: any) => x.code === r.code) || { code: r.code, nama: r.name }
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
      ...basePsc,
      data_source: 'langsung',
      fetched_at_wib: ov.status.psc.at || ov.status.panggilan.at,
      label: [m ? 'master PSC, ambulans, SDM, RS langsung dari API PSC 119' : null, pg ? `hitungan panggilan ${pg.tahun} langsung dari API PSC 119` : null].filter(Boolean).join('; '),
      provinsi,
      summary: {
        ...(basePsc.summary || {}),
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
  mergeTck(data, base, ov)
  mergeEoc(data, base, ov)
  mergeLogistik(data, base, ov)
  mergeNcc(data, ov)
  for (const k of ['asistensi', 'psc', 'tck', 'eoc', 'logistik'] as const) {
    if (data[k]?.data_source !== 'langsung') {
      const st: LiveStatus | undefined = (ov.status as any)[k]
      data[k] = { data_source: 'tidak_tersedia', error: st?.error || 'Data belum tersedia dari API', pending: st?.pending || undefined }
    }
  }
  data.generated_at_wib = wibStamp()
  const { tckRelawan: _rel, eoc: stEoc, logistik: stLog, ncc: stNcc, ...stRest } = ov.status as typeof ov.status & { eocTren?: LiveStatus }
  data.live_status = {
    ...stRest,
    tck: ov.tck.value || ov.tckRelawan.value
      ? { status: 'langsung', at: ov.status.tck.at || ov.status.tckRelawan.at, pending: ov.status.tck.pending || ov.status.tckRelawan.pending || undefined, error: !ov.tckRelawan.value ? 'Sebaran relawan per provinsi belum tersedia dari API' : !ov.tck.value ? 'Tim & EMT belum tersedia dari API' : undefined }
      : ov.status.tck,
    logistik: stLog,
    eoc: stEoc,
    ncc: ov.ncc.value ? stNcc : { status: 'tidak_tersedia', error: stNcc.error || ov.ncc.error, pending: stNcc.pending },
  }
  return data
}


/** Timpa data.tck base dengan agregat langsung API Tenaga Cadangan (bentuk lama tetap ada). */
function mergeTck(data: any, base: any, ov: Awaited<ReturnType<typeof getLiveOverlay>>) {
  const inti = ov.tck.value
  const rel = ov.tckRelawan.value
  if (!inti && !rel) return
  const snap = base.tck || {}
  const regions: { code: string; name: string }[] = base.regions || []
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
      ...(rp ? { individu: rp.individu, nakes: rp.nakes, non_nakes: rp.non_nakes, perempuan: rp.perempuan, laki: rp.laki, usia: rp.usia, terhubung_tim: rp.terhubung_tim, profesi: rp.profesi, kab: rp.kab, sumber_individu: 'langsung' } : { individu: null, nakes: null, non_nakes: null, sumber_individu: 'tidak_tersedia' }),
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
  // Agregat titik TCK per kab/kota (dipetakan ke kode Kemendagri + pusat kab/kota dari GeoJSON; tanpa data pribadi).
  const petaKabMap = new Map<string, { code: string; p: string; prov: string; nama: string; n: number; nakes: number; non_nakes: number; lat: number; lon: number }>()
  for (const provRow of provinsi) {
    const pCode = String(provRow.code || '').padStart(2, '0')
    for (const kb of provRow.kab || []) {
      const hit = resolveTckKabGeo(pCode, kb.nama)
      if (!hit || hit.lat == null || hit.lon == null) continue
      const nVal = Number(kb.n || 0)
      const nakesVal = Number(kb.nakes || 0)
      if (nVal <= 0) continue
      const existing = petaKabMap.get(hit.code)
      if (existing) {
        existing.n += nVal
        existing.nakes += nakesVal
        existing.non_nakes = Math.max(0, existing.n - existing.nakes)
      } else {
        petaKabMap.set(hit.code, {
          code: hit.code,
          p: pCode,
          prov: provRow.nama || pCode,
          nama: hit.nama,
          n: nVal,
          nakes: nakesVal,
          non_nakes: Math.max(0, nVal - nakesVal),
          lat: hit.lat,
          lon: hit.lon,
        })
      }
    }
  }
  const peta_kab = [...petaKabMap.values()].sort((a, b) => b.n - a.n)
  data.tck = {
    ...snap,
    data_source: 'langsung',
    fetched_at_wib: ov.status.tck.at || ov.status.tckRelawan.at,
    label: [d ? 'total, pendaftaran, tim & Tim Medis Darurat langsung dari API Tenaga Cadangan' : null, rel ? 'sebaran relawan per provinsi & kab/kota langsung dari API relawan-tck' : null].filter(Boolean).join('; '),
    sumber_status: { inti: inti ? 'langsung' : 'tidak_tersedia', relawan: rel ? 'langsung' : 'tidak_tersedia', relawan_gagal: rel?.gagal || [] },
    summary,
    provinsi,
    peta_kab,
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

/** Timpa data.eoc base dengan agregat langsung API EOC (data_krisis.php); bentuk lama tetap ada. */
function mergeEoc(data: any, base: any, ov: Awaited<ReturnType<typeof getLiveOverlay>>) {
  const v = ov.eoc.value
  if (!v) return
  const snap = base.eoc || {}
  const y = v.tahun
  const ev = (v as any).rentang ? v.events : v.events.filter((e) => e.t.startsWith(String(y)))
  const kpi = rekapEoc(ev)
  const kr = ev.filter((e) => e.s)
  const kk = rekapEoc(kr)
  const regions: { code: string; name: string }[] = base.regions || []
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
  // Tren 5 tahun: tahun sebelumnya dari API EOC (fetchEocTren, cache 6 jam) + tahun berjalan.
  const hist = ov.eocTren.value || []
  const thn = [...hist.map((h) => ({ tahun: h.tahun, a: h.semua, k: h.krisis })), { tahun: y, a: kpi, k: kk }]
  const tren = (key: keyof typeof kpi, withKrisis = false, krisisOnly = false) =>
    hist.length ? thn.map((t) => ({ tahun: t.tahun, jumlah: (krisisOnly ? t.k : t.a)[key], ...(withKrisis ? { krisis: t.k[key] } : {}) })) : []
  const nas = snap.nasional || {}
  const detailUrl = (u: string) => `https://pusatkrisis.kemkes.go.id/detail-bencana/${encodeURIComponent(u)}`
  data.eoc = {
    ...snap,
    data_source: 'langsung',
    fetched_at_wib: ov.status.eoc.at,
    label: `kejadian ${(v as any).rentang ? `${v.dari} s.d. ${v.sampai}` : y} langsung dari API EOC Pusat Krisis (data_krisis, ${ev.length.toLocaleString('id-ID')} kejadian)`,
    rentang: Boolean((v as any).rentang),
    sumber_api: 'https://pusatkrisis.kemkes.go.id/eoc/api/detail_bencana/data_krisis.php',
    gagal_bulan: v.gagal,
    nasional: {
      ...nas,
      tahun: y,
      fetched_at_wib: ov.status.eoc.at,
      kejadian_tahun: { ...kpi },
      krisis_tahun: { kejadian: kk.terpantau, korban_total: kk.korban_total, meninggal: kk.meninggal, hilang: kk.hilang, luka_berat: kk.luka_berat, luka_ringan: kk.luka_ringan, pengungsi: kk.pengungsi, terdampak: kk.terdampak, alam: kk.alam, non_alam: kk.non_alam, sosial: kk.sosial },
      tren_5_tahun_terpantau: tren('terpantau'),
      tren_5_tahun_krisis: tren('berdampak_krisis'),
      tren_5_tahun_korban_total: tren('korban_total', true),
      tren_5_tahun_meninggal: tren('meninggal'),
      tren_5_tahun_meninggal_krisis: tren('meninggal', false, true),
      tren_5_tahun_hilang: tren('hilang', true),
      tren_5_tahun_luka_berat: tren('luka_berat', true),
      tren_5_tahun_luka_ringan: tren('luka_ringan', true),
      tren_5_tahun_pengungsi: tren('pengungsi', true),
      tren_5_tahun_terdampak: tren('terdampak', true),
      tren_status: hist.length ? 'langsung' : ov.eocTren.pending ? 'memuat' : 'tidak_tersedia',
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


/** Timpa data.logistik base dengan agregat langsung API Logistik (bentuk lama tetap ada). */
function mergeLogistik(data: any, base: any, ov: Awaited<ReturnType<typeof getLiveOverlay>>) {
  const v = ov.logistik.value
  if (!v) return
  const snap = base.logistik || {}
  const regions: { code: string; name: string }[] = base.regions || []
  const norm = (x: string) => x.toLowerCase().replace(/[^a-z]/g, '')
  const homeCode = (r: any) => {
    if (/^pusat$/i.test(r.nama)) return '31'
    const hit = regions.find((g) => norm(g.name) === norm(r.nama))
    return hit?.code || (snap.regional || []).find((x: any) => norm(String(x.nama)).startsWith(norm(r.nama)))?.code || r.wilayah[0] || null
  }
  const covered = new Set<string>(v.regional.flatMap((r: any) => r.wilayah))
  const regional = v.regional.map((r: any) => {
    const code = homeCode(r)
    const wilayah = /^pusat$/i.test(r.nama) ? regions.map((g) => g.code).filter((c) => !covered.has(c)) : Array.from(new Set([...(r.wilayah as string[]), ...(code ? [code] : [])]))
    return { ...r, nama: /^pusat$/i.test(r.nama) ? 'Pusat (DKI Jakarta)' : r.nama, code, wilayah, total: r.stok }
  })
  const provRegional: Record<string, number> = {}
  for (const r of regional) for (const c of r.wilayah) provRegional[c] = r.id
  const n = v.nasional
  data.logistik = {
    ...snap,
    data_source: 'langsung',
    fetched_at_wib: ov.status.logistik.at,
    label: `stok ${n.barang.toLocaleString('id-ID')} baris barang di ${regional.length} regional langsung dari API Logistik; pergerakan ≈ sampel ${v.pergerakan.sampel_berhasil} barang teratas`,
    sumber_api: 'https://pusatkrisis.kemkes.go.id/logistik/web_api/v1/data-stok-logistik',
    filterable_provinsi: true,
    kategori: LOG_KATEGORI.map((k) => k.nama),
    kategori_rekap: v.kategori,
    summary: {
      ...(snap.summary || {}),
      total_stok: n.stok, unit_masuk: n.masuk, unit_keluar: n.keluar, saldo_awal: n.awal,
      transaksi_penerimaan: n.masuk, transaksi_pengeluaran: n.keluar, satuan_transaksi: 'unit',
      jumlah_barang: n.barang, barang_unik: n.barang_unik, kedaluwarsa: n.kedaluwarsa, stok_kedaluwarsa: n.stok_kedaluwarsa,
      segera_kedaluwarsa: n.segera_kedaluwarsa, dengan_kedaluwarsa: n.dengan_kedaluwarsa, stok_negatif: n.stok_negatif,
      kategori_count: LOG_KATEGORI.length, regional_count: regional.length,
    },
    regional,
    provinsi_regional: provRegional,
    barang_teratas: v.barang_teratas,
    kedaluwarsa: v.kedaluwarsa,
    asal_teratas: v.asal_teratas,
    pergerakan: v.pergerakan,
    gagal_regional: v.gagal,
  }
}


/** NCC 119 hanya dari API Apps Script; tanpa API -> kosong (tidak ada angka cadangan). */
function mergeNcc(data: any, ov: Awaited<ReturnType<typeof getLiveOverlay>>) {
  const v = ov.ncc.value
  const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
  const tglLabel = (d: string | null) => (d ? `${Number(d.slice(8, 10))} ${BULAN[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}` : '')
  if (!v) {
    data.ncc = {
      data_source: 'tidak_tersedia',
      error: ov.ncc.error || (ov.ncc.pending ? 'Sedang mengambil data dari API NCC' : 'API NCC belum terhubung'),
      pending: ov.ncc.pending || undefined,
      label: 'Data belum tersedia dari API NCC',
      days: [], totals: null, per_jam: [], busiest_interval: null, period: null,
    }
    return
  }
  let prev: number | null = null
  const days = v.days.map((d) => {
    const change = prev ? ((d.cof - prev) / prev) * 100 : null
    prev = d.cof
    return {
      date: d.tanggal, cof: d.cof, acd: d.acd, abd: d.abd, scr: d.cof ? (d.acd / d.cof) * 100 : null, available: true, change,
      pct_sl: d.pct_sl, aht: d.aht_detik, asa: d.asa_detik, avg_aban: d.avg_aban_detik, max_delay: d.max_delay_detik, staf: d.avg_pos_staff, staf_maks: d.max_staffed, okupansi: d.pct_occ_acw,
    }
  })
  const start = v.meta.tanggal_awal, end = v.meta.tanggal_akhir
  data.ncc = {
    data_source: 'langsung',
    sumber: getNccSheetUrl() || null,
    fetched_at_wib: ov.status.ncc.at,
    label: `langsung dari API NCC 119 (Apps Script)${v.meta.terakhir_sinkron ? `, sinkron sumber ${v.meta.terakhir_sinkron}` : ''}`,
    sumber_api: v.meta.sumber,
    terakhir_sinkron: v.meta.terakhir_sinkron,
    period: { start, end, label: start && end ? `${tglLabel(start)} – ${tglLabel(end)}` : '' },
    totals: { cof: v.totals.cof, acd: v.totals.acd, abd: v.totals.abd, scr: v.totals.cof ? (v.totals.acd / v.totals.cof) * 100 : null, hari_tersedia: v.totals.hari, pct_sl: v.totals.pct_sl, aht: v.totals.aht_detik, asa: v.totals.asa_detik },
    days,
    per_jam: v.per_jam,
    busiest_interval: v.busiest_interval ? { date: v.busiest_interval.tanggal, time: v.busiest_interval.interval_mulai, time_end: v.busiest_interval.interval_selesai, cof: v.busiest_interval.cof, acd: v.busiest_interval.acd, abd: v.busiest_interval.abd, scr: v.busiest_interval.pct_acd } : null,
    quality: null,
  }
}
