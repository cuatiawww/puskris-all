import { NextResponse } from 'next/server'
import { getUpstream, inIndonesia, wibNow, type UpstreamReport } from '@/lib/server/upstream'

// Proxy GET-only: posisi pesawat ADS-B terbuka (adsb.lol, cadangan adsb.fi) di atas Indonesia.
export const dynamic = 'force-dynamic'

const POINTS = [
  { n: 'Jakarta', lat: -6.13, lon: 106.65 }, { n: 'Surabaya', lat: -7.38, lon: 112.79 }, { n: 'Bali', lat: -8.75, lon: 115.17 },
  { n: 'Makassar', lat: -5.06, lon: 119.55 }, { n: 'Medan', lat: 3.64, lon: 98.88 }, { n: 'Balikpapan', lat: -1.27, lon: 116.89 },
  { n: 'Manado', lat: 1.55, lon: 124.93 }, { n: 'Ambon', lat: -3.71, lon: 128.09 }, { n: 'Jayapura', lat: -2.58, lon: 140.52 },
  { n: 'Pontianak', lat: -0.15, lon: 109.4 }, { n: 'Palembang', lat: -2.9, lon: 104.7 }, { n: 'Kupang', lat: -10.17, lon: 123.67 },
]

const toFlight = (a: any) => ({
  icao24: a.hex, callsign: String(a.flight || '').trim() || null, registration: a.r || null, type: a.t || null,
  latitude: a.lat, longitude: a.lon,
  altitude_m: typeof a.alt_baro === 'number' ? a.alt_baro * 0.3048 : null,
  velocity_ms: typeof a.gs === 'number' ? a.gs * 0.514444 : null,
  heading: typeof a.track === 'number' ? Math.round(a.track) : null,
  origin_country: a.r && String(a.r).startsWith('PK-') ? 'Indonesia' : null,
})

export async function GET() {
  const upstream: UpstreamReport[] = []
  const byHex = new Map<string, any>()
  const primary = await Promise.all(POINTS.map((p) => getUpstream(`https://api.adsb.lol/v2/lat/${p.lat}/lon/${p.lon}/dist/250`, { revalidate: 60, timeoutMs: 10000 })))
  let okPrimary = 0, failed: typeof POINTS = []
  primary.forEach((r, i) => {
    if (r.ok) { okPrimary++; for (const a of (r.data as any)?.ac || []) if (a.lat != null && inIndonesia(a.lat, a.lon)) byHex.set(a.hex, toFlight(a)) }
    else failed.push(POINTS[i])
  })
  upstream.push({ nama: `adsb.lol (${okPrimary}/${POINTS.length} titik)`, ok: okPrimary > 0, status: okPrimary ? 200 : primary[0]?.status || 0, count: byHex.size, error: okPrimary ? undefined : (primary[0] as any)?.error })
  if (failed.length) {
    // adsb.fi membatasi 1 permintaan/detik: panggil berurutan untuk titik yang gagal saja.
    let okFb = 0, err: string | undefined
    const before = byHex.size
    for (const p of failed.slice(0, 6)) {
      const r = await getUpstream(`https://opendata.adsb.fi/api/v2/lat/${p.lat}/lon/${p.lon}/dist/250`, { revalidate: 60, timeoutMs: 8000 })
      if (r.ok) { okFb++; for (const a of (r.data as any)?.aircraft || []) if (a.lat != null && inIndonesia(a.lat, a.lon)) byHex.set(a.hex, toFlight(a)) }
      else err = r.error
      await new Promise((res) => setTimeout(res, 1100))
    }
    upstream.push({ nama: `adsb.fi cadangan (${okFb}/${Math.min(6, failed.length)} titik)`, ok: okFb > 0, status: okFb ? 200 : 0, count: byHex.size - before, error: okFb ? undefined : err })
  }
  const flights = [...byHex.values()]
  const ok = upstream.some((u) => u.ok)
  return NextResponse.json({ ok, fetched_at: wibNow(), count: flights.length, upstream, flights }, { status: ok ? 200 : 502 })
}
