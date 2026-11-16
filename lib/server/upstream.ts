/** GET ke API publik dengan batas waktu dan cache data Next.js. Hanya baca (GET), tanpa kunci. */
export async function getUpstream(url: string, opts: { timeoutMs?: number; revalidate?: number; as?: 'json' | 'text' } = {}) {
  const { timeoutMs = 12000, revalidate = 600, as = 'json' } = opts
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: ctrl.signal,
      headers: { 'User-Agent': 'PusatKrisisKesehatan-Dasbor/1.0 (+open data viewer)', Accept: as === 'json' ? 'application/json' : 'text/csv,text/plain,*/*' },
      next: { revalidate },
    })
    if (!res.ok) return { ok: false as const, status: res.status, error: `HTTP ${res.status}` }
    const data = as === 'json' ? await res.json() : await res.text()
    return { ok: true as const, status: res.status, data }
  } catch (e: any) {
    return { ok: false as const, status: 0, error: e?.name === 'AbortError' ? 'Batas waktu habis' : String(e?.message || e) }
  } finally {
    clearTimeout(timer)
  }
}

export type UpstreamReport = { nama: string; ok: boolean; status: number; count: number; error?: string }

export const ID_BBOX = { latMin: -11.5, latMax: 6.5, lonMin: 94, lonMax: 141.5 }
export const inIndonesia = (lat: number, lon: number) =>
  Number.isFinite(lat) && Number.isFinite(lon) && lat >= ID_BBOX.latMin && lat <= ID_BBOX.latMax && lon >= ID_BBOX.lonMin && lon <= ID_BBOX.lonMax

export function wibNow() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).slice(0, 16) + ' WIB'
}
