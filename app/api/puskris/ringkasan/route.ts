import { after, NextResponse } from 'next/server'
import { loadPuskrisData } from '@/lib/puskris/load-data'
import { getLiveOverlay, mergeLive } from '@/lib/server/puskris-live'

/**
 * Data dasbor: seluruhnya dari API resmi (EOC, PSC 119, Asistensi, TCK, Logistik, NCC Apps Script).
 * Filter diterapkan di klien. Bila API lambat/gagal, bagian itu kosong dan ditandai
 * "tidak_tersedia" di live_status (tidak ada snapshot atau angka cadangan).
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
