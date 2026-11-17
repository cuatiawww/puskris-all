import { after, NextResponse } from 'next/server'
import { loadPuskrisData } from '@/lib/puskris/load-data'
import { getLiveOverlay, mergeLive } from '@/lib/server/puskris-live'

/**
 * Data dasbor: snapshot data/puskris-data.json yang ditimpa data langsung dari API resmi
 * (Asistensi, PSC 119) bila token server tersedia. Filter diterapkan di klien.
 * Bila API lambat/gagal, bagian itu tetap memakai snapshot dan ditandai di live_status.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET() {
  const snapshot = loadPuskrisData()
  const codes = (snapshot.regions || []).map((r: any) => String(r.code))
  const ov = await getLiveOverlay(codes, 7000)
  if (ov.jobs.length) after(() => Promise.allSettled(ov.jobs))
  const data = mergeLive(snapshot, ov)
  const pending = Object.values(ov.status).some((s: any) => s.pending)
  return NextResponse.json(
    { success: true, data, pending },
    { headers: { 'Cache-Control': pending ? 'no-store' : 'private, max-age=60' } },
  )
}
