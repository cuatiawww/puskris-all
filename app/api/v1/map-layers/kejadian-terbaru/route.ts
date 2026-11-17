import { NextResponse } from 'next/server'
import { wibNow } from '@/lib/server/upstream'
import { fromEocApi } from '@/lib/puskris/kejadian-terbaru'
import { getEocLive, wibStamp } from '@/lib/server/puskris-live'

// GET-only: kejadian bencana terbaru dari API EOC Pusat Krisis (data_krisis).
// Tanpa API -> daftar kosong + pesan (tidak ada snapshot/cadangan).
export const dynamic = 'force-dynamic'

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
  return NextResponse.json({
    ok: false, mode: 'tidak_tersedia', fetched_at: null, count: 0,
    upstream: [{ nama: 'API EOC Pusat Krisis (data_krisis)', ok: false, status: 0, count: 0, error: eoc.error || (eoc.pending ? 'Sedang mengambil data dari API EOC' : 'Data belum tersedia dari API EOC') }],
    events: [],
  }, { status: eoc.pending ? 202 : 502, headers: { 'Cache-Control': 'no-store' } })
}
