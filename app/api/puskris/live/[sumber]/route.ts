import { after, NextResponse } from 'next/server'
import { loadPuskrisData } from '@/lib/puskris/load-data'
import { getLiveOverlay } from '@/lib/server/puskris-live'

/**
 * Proksi API resmi (hasil agregat saja, tanpa data pribadi).
 * GET /api/puskris/live/asistensi | psc | panggilan
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const ALLOWED = ['asistensi', 'psc', 'panggilan'] as const

export async function GET(_req: Request, ctx: { params: Promise<{ sumber: string }> }) {
  const { sumber } = await ctx.params
  if (!ALLOWED.includes(sumber as any)) return NextResponse.json({ ok: false, error: 'Sumber tidak dikenal' }, { status: 404 })
  const snapshot = loadPuskrisData()
  const codes = (snapshot.regions || []).map((r: any) => String(r.code))
  const ov = await getLiveOverlay(codes, 45000)
  if (ov.jobs.length) after(() => Promise.allSettled(ov.jobs))
  const key = sumber as (typeof ALLOWED)[number]
  const st = ov.status[key]
  const value: any = ov[key].value
  let count = 0
  let ringkas: any = null
  if (value && key === 'asistensi') {
    count = value.provinsi.length + value.kabkota.length
    ringkas = { tahun: value.tahun, provinsi: value.provinsi.length, kabkota: value.kabkota.length, provinsi_mengisi: value.provinsi.filter((r: any) => r.status_kapasitas !== 'Belum Mengisi').length, kabkota_mengisi: value.kabkota.filter((r: any) => r.status_kapasitas !== 'Belum Mengisi').length }
  } else if (value && key === 'psc') {
    count = value.summary.total_psc
    ringkas = value.summary
  } else if (value && key === 'panggilan') {
    count = value.total
    ringkas = { tahun: value.tahun, total: value.total, selesai: value.selesai, total_tahun_lalu: value.total_tahun_lalu, sampel: { dari: value.sampel.dari, sampai: value.sampel.sampai, jumlah: value.sampel.jumlah } }
  }
  return NextResponse.json(
    { ok: st.status === 'langsung', sumber: key, status: st.status, fetched_at: st.at || null, count, error: st.error || null, ringkas, data: value || null },
    { status: st.status === 'langsung' ? 200 : 502, headers: { 'Cache-Control': 'no-store' } },
  )
}
