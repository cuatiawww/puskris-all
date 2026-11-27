/**
 * API Dashboard Faskes Pusat Krisis (sipkk-api) di sisi server.
 * Token hanya dari PUSKRIS_TTOKEN (tidak pernah dikirim ke klien / dicatat).
 * Hanya endpoint baca; keluaran sudah diringkas (tanpa email, telepon, website).
 */
import { getPuskrisToken } from '@/lib/server/puskris-auth-config'
import { puskrisFetchJson } from '@/lib/server/puskris-http'
import { persist } from '@/lib/server/persist'
import type { FaskesAgregat, FaskesJenis, FaskesTitik } from '@/lib/puskris/faskes-layers'

const FASKES_BASE = (process.env.PUSKRIS_FASKES_BASE || 'https://pusatkrisis.kemkes.go.id/sipkk-api').replace(/\/$/, '')
const CACHE_SEC = 3600

export type { FaskesAgregat, FaskesJenis, FaskesTitik }

export type FaskesRekap = {
  rs: number
  puskesmas: number
}

export type FaskesTitikPage = {
  titik: FaskesTitik[]
  pagination: { page: number; pageCount: number; total: number; hasMore: boolean }
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function pad(v: unknown, n: number): string {
  const s = String(v ?? '').replace(/\D/g, '')
  return s ? s.padStart(n, '0').slice(0, n) : ''
}

async function postJson(path: string, body: Record<string, unknown>, timeoutMs = 60_000): Promise<any> {
  const token = getPuskrisToken()
  if (!token) throw new Error('Token Puskris (TTOKEN) belum diatur')
  const j = await puskrisFetchJson(`${FASKES_BASE}/${path.replace(/^\//, '')}`, {
    method: 'POST',
    headers: {
      TTOKEN: token,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'PusatKrisisKesehatan-Dasbor/1.0',
    },
    body: JSON.stringify(body),
    timeoutMs,
  })
  if (j && (j.sukses === 0 || j.sukses === false || j.status === false)) {
    throw new Error(String(j.message || 'API menolak permintaan'))
  }
  return j
}

function slimTitik(row: any, jenis: FaskesJenis): FaskesTitik | null {
  const lat = Number(row?.latitude)
  const lon = Number(row?.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  if (lat === 0 && lon === 0) return null
  const id = String(row?.kode_sarana || row?.kode_satusehat || '').trim()
  const nama = String(row?.nama || '').trim()
  if (!nama) return null
  return {
    id: id || `${jenis}-${lat.toFixed(5)}-${lon.toFixed(5)}`,
    nama,
    jenis,
    subjenis: String(row?.nama_subjenis || (jenis === 'rs' ? 'Rumah Sakit' : 'Puskesmas')).trim(),
    prov: String(row?.nama_prop || row?.nama_provinsi || '').trim(),
    kab: String(row?.nama_kab || row?.nama_kabkota || '').trim(),
    kode_prov: pad(row?.kode_prop || row?.kode_provinsi, 2),
    kode_kab: pad(row?.kode_kab || row?.kode_kabkota, 4),
    alamat: String(row?.alamat || '').trim(),
    lat,
    lon,
  }
}

export async function fetchFaskesRekap(prov?: string, kab?: string): Promise<FaskesRekap> {
  const p = pad(prov, 2)
  const k = pad(kab, 4)
  return persist(['faskes-rekap', p, k], async () => {
    const j = await postJson('dashboard-faskes/rekap-total', {
      kode_provinsi: p,
      kode_kabupaten: k,
    })
    const d = j?.data || {}
    return { rs: num(d.total_rs), puskesmas: num(d.total_puskesmas) }
  }, CACHE_SEC, ['faskes'])
}

export async function fetchFaskesAgregat(prov?: string): Promise<FaskesAgregat[]> {
  const p = pad(prov, 2)
  return persist(['faskes-agregat', p || 'nasional'], async () => {
    const j = await postJson('dashboard-faskes/peta-sebaran', {
      kode_provinsi: p,
      kode_kabupaten: '',
    })
    const feats = Array.isArray(j?.features) ? j.features : []
    const out: FaskesAgregat[] = []
    for (const f of feats) {
      const pr = f?.properties || {}
      const lat = Number(pr.centerlat)
      const lon = Number(pr.centerlong)
      const kodeKab = pad(pr.kode_kabupaten, 4)
      const kodeProv = pad(pr.kode_provinsi, 2)
      const kode = kodeKab || kodeProv
      if (!kode) continue
      out.push({
        kode,
        nama: String(pr.nama_kabupaten || pr.nama_provinsi || '').trim(),
        level: kodeKab ? 'kabupaten' : 'provinsi',
        lat: Number.isFinite(lat) && lat !== 0 ? lat : null,
        lon: Number.isFinite(lon) && lon !== 0 ? lon : null,
        rs: num(pr.total_rs),
        puskesmas: num(pr.total_puskesmas),
      })
    }
    return out
  }, CACHE_SEC, ['faskes'])
}

type MemEntry = { at: number; value: FaskesTitik[] }
const titikMem: Map<string, MemEntry> = ((globalThis as any).__puskrisFaskesTitik ||= new Map())

async function fetchTitikUpstream(jenis: FaskesJenis, kodeProvinsi: number[] | null, page: number, per: number): Promise<{ titik: FaskesTitik[]; total: number; pageCount: number; page: number }> {
  const body: Record<string, unknown> = {
    page: String(page),
    'per-page': String(per),
    jenis,
    search: '',
  }
  if (kodeProvinsi && kodeProvinsi.length) body.kode_provinsi = kodeProvinsi
  const j = await postJson('dashboard-faskes/tabel-sebaran', body, 90_000)
  const rows = Array.isArray(j?.data) ? j.data : []
  const pag = j?.pagination || {}
  const titik = rows.map((r: any) => slimTitik(r, jenis)).filter(Boolean) as FaskesTitik[]
  const total = num(pag.totalCount) || titik.length
  const pageCount = num(pag.pageCount) || 1
  return { titik, total, pageCount, page: num(pag.currentPage) || page }
}

/** Satu halaman titik nasional (aman untuk batas waktu fungsi). */
export async function fetchFaskesTitikPage(jenis: FaskesJenis, page: number, per: number): Promise<FaskesTitikPage> {
  const safePer = Math.min(2000, Math.max(50, per || 2000))
  const safePage = Math.max(1, page || 1)
  const key = `page:${jenis}:${safePage}:${safePer}`
  const hit = titikMem.get(key)
  if (hit && Date.now() - hit.at < CACHE_SEC * 1000) {
    const meta = (hit as any).meta || { pageCount: 1, total: hit.value.length }
    return {
      titik: hit.value,
      pagination: { page: safePage, pageCount: meta.pageCount, total: meta.total, hasMore: safePage < meta.pageCount },
    }
  }
  const out = await fetchTitikUpstream(jenis, null, safePage, safePer)
  const entry: MemEntry & { meta?: { pageCount: number; total: number } } = { at: Date.now(), value: out.titik, meta: { pageCount: out.pageCount, total: out.total } }
  titikMem.set(key, entry)
  return {
    titik: out.titik,
    pagination: { page: out.page, pageCount: out.pageCount, total: out.total, hasMore: out.page < out.pageCount },
  }
}

/** Semua titik dalam satu provinsi (atau disaring kab/kota). */
export async function fetchFaskesTitikScoped(jenis: FaskesJenis, prov: string, kab?: string): Promise<FaskesTitik[]> {
  const p = pad(prov, 2)
  const k = pad(kab, 4)
  if (!p) return []
  const key = `scope:${jenis}:${p}`
  const hit = titikMem.get(key)
  let list: FaskesTitik[]
  if (hit && Date.now() - hit.at < CACHE_SEC * 1000) {
    list = hit.value
  } else {
    const first = await fetchTitikUpstream(jenis, [Number(p)], 1, 5000)
    list = first.titik
    let page = 2
    while (page <= first.pageCount) {
      const more = await fetchTitikUpstream(jenis, [Number(p)], page, 5000)
      list = list.concat(more.titik)
      page += 1
    }
    titikMem.set(key, { at: Date.now(), value: list })
  }
  return k ? list.filter((t) => t.kode_kab === k) : list
}

export { pad as padFaskesKode }
export const FASKES_CACHE_SEC = CACHE_SEC
