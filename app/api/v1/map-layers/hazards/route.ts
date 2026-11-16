import { NextResponse } from 'next/server'
import { getUpstream, inIndonesia, wibNow, type UpstreamReport } from '@/lib/server/upstream'

// Proxy GET-only: gempa BMKG (cadangan USGS) + peringatan bencana GDACS untuk Indonesia.
export const dynamic = 'force-dynamic'

type Ev = { id: string; latitude: number; longitude: number; kind: string; alert_level: 'red' | 'orange' | 'yellow'; title: string; place: string; magnitude: number | null; time: string | null; source: string; url?: string; depth?: string | null; potensi?: string | null }

const GDACS_KIND: Record<string, string> = { EQ: 'earthquake', FL: 'flood', VO: 'volcano', TC: 'cyclone', DR: 'drought', WF: 'wildfire' }

function bmkgEvents(data: any, label: string): Ev[] {
  const list: any[] = data?.Infogempa?.gempa ? (Array.isArray(data.Infogempa.gempa) ? data.Infogempa.gempa : [data.Infogempa.gempa]) : []
  return list.map((g, i) => {
    const [lat, lon] = String(g.Coordinates || '').split(',').map(Number)
    const mag = Number(g.Magnitude)
    return {
      id: `bmkg-${label}-${g.DateTime || i}`,
      latitude: lat, longitude: lon, kind: 'earthquake',
      alert_level: (mag >= 6 ? 'red' : mag >= 5 ? 'orange' : 'yellow') as Ev['alert_level'],
      title: `Gempa M${g.Magnitude} · ${label}`,
      place: g.Wilayah || 'Indonesia', magnitude: Number.isFinite(mag) ? mag : null,
      time: g.DateTime || `${g.Tanggal} ${g.Jam}`, source: 'BMKG', depth: g.Kedalaman || null, potensi: g.Potensi || g.Dirasakan || null,
      url: 'https://www.bmkg.go.id/gempabumi/gempabumi-terkini',
    }
  }).filter((e) => inIndonesia(e.latitude, e.longitude))
}

export async function GET() {
  const upstream: UpstreamReport[] = []
  const events: Ev[] = []

  const [terkini, dirasakan, gdacs] = await Promise.all([
    getUpstream('https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json', { revalidate: 600 }),
    getUpstream('https://data.bmkg.go.id/DataMKG/TEWS/gempadirasakan.json', { revalidate: 600 }),
    getUpstream('https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=EQ;FL;VO;TC;DR;WF&country=Indonesia', { revalidate: 900, timeoutMs: 15000 }),
  ])

  let bmkgCount = 0
  for (const [res, label, nama] of [[terkini, 'M5+ terkini', 'BMKG gempa terkini'], [dirasakan, 'dirasakan', 'BMKG gempa dirasakan']] as const) {
    const evs = res.ok ? bmkgEvents(res.data, label) : []
    bmkgCount += evs.length
    events.push(...evs)
    upstream.push({ nama, ok: res.ok, status: res.status, count: evs.length, error: res.ok ? undefined : res.error })
  }

  if (!bmkgCount) {
    const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)
    const usgs = await getUpstream(`https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minlatitude=-11.5&maxlatitude=6.5&minlongitude=94&maxlongitude=141.5&minmagnitude=4.5&starttime=${since}&orderby=time&limit=80`, { revalidate: 600 })
    const fs: any[] = usgs.ok ? usgs.data?.features || [] : []
    for (const f of fs) {
      const [lon, lat, depth] = f.geometry?.coordinates || []
      const mag = Number(f.properties?.mag)
      events.push({
        id: `usgs-${f.id}`, latitude: lat, longitude: lon, kind: 'earthquake',
        alert_level: mag >= 6 ? 'red' : mag >= 5 ? 'orange' : 'yellow',
        title: `Gempa M${mag.toFixed(1)}`, place: f.properties?.place || 'Indonesia', magnitude: mag,
        time: f.properties?.time ? new Date(f.properties.time).toISOString() : null, source: 'USGS (cadangan BMKG)', depth: depth != null ? `${Math.round(depth)} km` : null,
        url: f.properties?.url,
      })
    }
    upstream.push({ nama: 'USGS gempa (cadangan)', ok: usgs.ok, status: usgs.status, count: fs.length, error: usgs.ok ? undefined : usgs.error })
  }

  const gfs: any[] = gdacs.ok ? gdacs.data?.features || [] : []
  let gCount = 0
  for (const f of gfs) {
    const p = f.properties || {}
    const [lon, lat] = f.geometry?.coordinates || []
    if (!inIndonesia(lat, lon)) continue
    gCount += 1
    const lvl = String(p.alertlevel || '').toLowerCase()
    events.push({
      id: `gdacs-${p.eventtype}-${p.eventid}`, latitude: lat, longitude: lon, kind: GDACS_KIND[p.eventtype] || 'hazard',
      alert_level: lvl === 'red' ? 'red' : lvl === 'orange' ? 'orange' : 'yellow',
      title: p.name || 'Peringatan bencana', place: p.country || 'Indonesia',
      magnitude: p.severitydata?.severity ?? null, time: p.fromdate || null, source: 'GDACS', url: p.url?.report,
      potensi: p.severitydata?.severitytext || null,
    })
  }
  upstream.push({ nama: 'GDACS peringatan bencana', ok: gdacs.ok, status: gdacs.status, count: gCount, error: gdacs.ok ? undefined : gdacs.error })

  const ok = upstream.some((u) => u.ok)
  return NextResponse.json({ ok, fetched_at: wibNow(), count: events.length, upstream, events }, { status: ok ? 200 : 502 })
}
