import { NextResponse } from 'next/server'
import { getUpstream, wibNow } from '@/lib/server/upstream'

// Proxy GET-only: pengamatan burung liar (Aves) di Indonesia dari GBIF.
export const dynamic = 'force-dynamic'

export async function GET() {
  const year = new Date().getFullYear()
  const r = await getUpstream(`https://api.gbif.org/v1/occurrence/search?country=ID&classKey=212&hasCoordinate=true&hasGeospatialIssue=false&year=${year - 1},${year}&limit=300`, { revalidate: 21600, timeoutMs: 15000 })
  const results = r.ok ? ((r.data as any)?.results || []).map((o: any) => ({
    key: o.key, decimalLatitude: o.decimalLatitude, decimalLongitude: o.decimalLongitude,
    species: o.vernacularName || o.species || null, scientificName: o.scientificName || null, genericName: o.genericName || o.genus || null,
    eventDate: o.eventDate || null, place: [o.locality, o.stateProvince].filter(Boolean).join(', ') || 'Indonesia',
    url: `https://www.gbif.org/occurrence/${o.key}`,
  })) : []
  return NextResponse.json({
    ok: r.ok, fetched_at: wibNow(), count: results.length, total_tersedia: r.ok ? (r.data as any)?.count : null,
    upstream: [{ nama: 'GBIF occurrence Aves', ok: r.ok, status: r.status, count: results.length, error: r.ok ? undefined : r.error }],
    results,
  }, { status: r.ok ? 200 : 502 })
}
