import { NextResponse } from 'next/server'
import { getUpstream, wibNow } from '@/lib/server/upstream'
import { fromDashboardNew, fromEocApi } from '@/lib/puskris/kejadian-terbaru'
import { getEocLive, wibStamp } from '@/lib/server/puskris-live'
import data from '../../../../../data/puskris-data.json'

// Proxy GET-only: kejadian bencana terbaru dari HTML publik dashboard-new Pusat Krisis
// (blok crisisIncidents + incidents). Cadangan: snapshot di data/puskris-data.json.
export const dynamic = 'force-dynamic'

const URL_SRC = 'https://pusatkrisis.kemkes.go.id/dashboard-new'

function readArray(html: string, key: string): any[] | null {
  const i = html.indexOf(`"${key}":[`)
  if (i < 0) return null
  const start = i + key.length + 3 // posisi '['
  let depth = 0, inStr = false, esc = false
  for (let j = start; j < html.length; j++) {
    const ch = html[j]
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue }
    if (ch === '"') inStr = true
    else if (ch === '[' || ch === '{') depth++
    else if (ch === ']' || ch === '}') {
      depth--
      if (depth === 0) { try { return JSON.parse(html.slice(start, j + 1)) } catch { return null } }
    }
  }
  return null
}

export async function GET() {
  // 1) API EOC resmi (langsung): kejadian 45 hari terakhir + semua kejadian krisis tahun berjalan.
  const eoc = await getEocLive(4000)
  if (eoc.value) {
    const today = new Date(Date.now() + 7 * 3600_000)
    const from = new Date(today.getTime() - 45 * 86400_000).toISOString().slice(0, 10)
    const y = String(eoc.value.tahun)
    const pick = eoc.value.events.filter((e) => e.t.startsWith(y) && (e.t >= from || e.s))
    const events = fromEocApi(pick).sort((a, b) => `${b.tanggal} ${b.jam || ''}`.localeCompare(`${a.tanggal} ${a.jam || ''}`))
    return NextResponse.json({
      ok: true, mode: 'langsung', fetched_at: eoc.at ? wibStamp(eoc.at) : wibNow(), count: events.length,
      upstream: [{ nama: 'API EOC Pusat Krisis (data_krisis)', ok: true, status: 200, count: events.length }],
      events,
    })
  }
  const r = await getUpstream(URL_SRC, { as: 'text', revalidate: 1800, timeoutMs: 25000 })
  let crisisIncidents: any[] | null = null, incidents: any[] | null = null
  if (r.ok) {
    crisisIncidents = readArray(r.data as string, 'crisisIncidents')
    incidents = readArray(r.data as string, 'incidents')
  }
  const live = Boolean(crisisIncidents?.length || incidents?.length)
  const snap: any = (data as any).eoc?.dashboard_new_terbaru || {}
  const events = fromDashboardNew(live ? { crisisIncidents: crisisIncidents || [], incidents: incidents || [] } : snap)
    .sort((a, b) => `${b.tanggal} ${b.jam || ''}`.localeCompare(`${a.tanggal} ${a.jam || ''}`))
  return NextResponse.json({
    ok: true, mode: live ? 'langsung' : 'snapshot', fetched_at: live ? wibNow() : snap.fetched_at_wib, count: events.length,
    upstream: [{ nama: 'Pusat Krisis dashboard-new', ok: live, status: r.status, count: live ? events.length : 0, error: live ? undefined : (r.ok ? 'format halaman berubah, memakai snapshot' : `${(r as any).error}, memakai snapshot`) }],
    events,
  })
}
