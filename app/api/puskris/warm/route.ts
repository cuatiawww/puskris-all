import { after, NextResponse } from 'next/server'
import { loadPuskrisData } from '@/lib/puskris/load-data'
import { getLiveOverlay } from '@/lib/server/puskris-live'

/**
 * Pemanas cache ringkasan (untuk cron Vercel atau pemanggilan manual).
 * Tidak mengembalikan isi data; hanya memicu getLiveOverlay agar cache persist terisi.
 * Jadwal cron perlu diaktifkan di proyek Vercel (disarankan tiap 10 menit, paket Pro).
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 300
export const preferredRegion = 'sin1'

export async function GET() {
  const t0 = Date.now()
  const snapshot = loadPuskrisData()
  const codes = (snapshot.regions || []).map((r: any) => String(r.code))
  const ov = await getLiveOverlay(codes, 20_000)
  if (ov.jobs.length) after(() => Promise.allSettled(ov.jobs))
  const pending = Object.values(ov.status).some((s: any) => s.pending)
  const status = Object.fromEntries(
    Object.entries(ov.status).map(([k, v]: [string, any]) => [k, { status: v.status, pending: Boolean(v.pending) }]),
  )
  return NextResponse.json(
    { ok: true, pending, took_ms: Date.now() - t0, status },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
