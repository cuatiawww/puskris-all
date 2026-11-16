import { NextResponse } from 'next/server'
import { getUpstream, wibNow } from '@/lib/server/upstream'

// Proxy GET-only: pengamatan nyamuk (famili Culicidae) di Indonesia dari iNaturalist.
export const dynamic = 'force-dynamic'

export async function GET() {
  const r = await getUpstream('https://api.inaturalist.org/v1/observations?place_id=6966&taxon_id=52134&geo=true&per_page=200&order_by=observed_on&order=desc', { revalidate: 21600, timeoutMs: 15000 })
  const sightings = r.ok ? ((r.data as any)?.results || []).map((o: any) => {
    const c = o.geojson?.coordinates || []
    return {
      id: o.id, latitude: c[1], longitude: c[0],
      species: o.taxon?.preferred_common_name || o.taxon?.name || 'Nyamuk', scientificName: o.taxon?.name || null,
      place: o.place_guess || 'Indonesia', observed_on: o.observed_on || null, url: o.uri || `https://www.inaturalist.org/observations/${o.id}`,
    }
  }).filter((s: any) => s.latitude != null && s.longitude != null) : []
  return NextResponse.json({
    ok: r.ok, fetched_at: wibNow(), count: sightings.length, total_tersedia: r.ok ? (r.data as any)?.total_results : null,
    upstream: [{ nama: 'iNaturalist Culicidae', ok: r.ok, status: r.status, count: sightings.length, error: r.ok ? undefined : r.error }],
    sightings,
  }, { status: r.ok ? 200 : 502 })
}
