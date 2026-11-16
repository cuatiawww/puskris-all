import { NextResponse } from 'next/server'
import { getUpstream, inIndonesia, wibNow, type UpstreamReport } from '@/lib/server/upstream'

// Proxy GET-only: titik panas NASA FIRMS (berkas publik 24 jam, tanpa MAP_KEY), disaring ke wilayah Indonesia.
export const dynamic = 'force-dynamic'

const FILES = [
  { nama: 'NASA FIRMS VIIRS NOAA-20', url: 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_SouthEast_Asia_24h.csv' },
  { nama: 'NASA FIRMS VIIRS Suomi NPP', url: 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_SouthEast_Asia_24h.csv' },
]
const CONF: Record<string, string> = { l: 'rendah', n: 'nominal', h: 'tinggi', low: 'rendah', nominal: 'nominal', high: 'tinggi' }

function parseCsv(text: string) {
  const lines = String(text || '').trim().split(/\r?\n/)
  const head = (lines.shift() || '').split(',')
  const ix = (k: string) => head.indexOf(k)
  const iLat = ix('latitude'), iLon = ix('longitude'), iB = ix('bright_ti4') >= 0 ? ix('bright_ti4') : ix('brightness')
  const iD = ix('acq_date'), iT = ix('acq_time'), iS = ix('satellite'), iC = ix('confidence'), iF = ix('frp'), iDn = ix('daynight')
  return lines.map((l) => l.split(',')).map((c) => ({
    latitude: Number(c[iLat]), longitude: Number(c[iLon]), brightness: Number(c[iB]) || null,
    acq_date: c[iD], acq_time: c[iT], satellite: c[iS] === 'N20' ? 'NOAA-20' : c[iS] === 'N' ? 'Suomi NPP' : c[iS],
    confidence: CONF[String(c[iC] || '').toLowerCase()] || c[iC], frp: Number(c[iF]) || null, daynight: c[iDn] === 'D' ? 'siang' : 'malam',
  }))
}

export async function GET() {
  const upstream: UpstreamReport[] = []
  let hotspots: any[] = []
  const res = await Promise.all(FILES.map((f) => getUpstream(f.url, { as: 'text', revalidate: 1800, timeoutMs: 20000 })))
  res.forEach((r, i) => {
    const rows = r.ok ? parseCsv(r.data as string).filter((h) => inIndonesia(h.latitude, h.longitude)) : []
    hotspots.push(...rows)
    upstream.push({ nama: FILES[i].nama, ok: r.ok, status: r.status, count: rows.length, error: r.ok ? undefined : r.error })
  })
  const total = hotspots.length
  // Batasi jumlah titik agar peta tetap ringan: prioritaskan FRP (daya radiasi api) terbesar.
  hotspots = hotspots.sort((a, b) => (b.frp || 0) - (a.frp || 0)).slice(0, 1500)
  const ok = upstream.some((u) => u.ok)
  return NextResponse.json({ ok, fetched_at: wibNow(), count: hotspots.length, total_indonesia: total, upstream, hotspots }, { status: ok ? 200 : 502 })
}
