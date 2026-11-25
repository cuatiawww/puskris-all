import { after, NextResponse } from 'next/server'
import { loadPuskrisData } from '@/lib/puskris/load-data'
import { getLiveOverlay, mergeLive, parseRentang } from '@/lib/server/puskris-live'

/**
 * Data dasbor: seluruhnya dari API resmi (EOC, PSC 119, Asistensi, TCK, Logistik, NCC Apps Script).
 * Filter diterapkan di klien. Bila API lambat/gagal, bagian itu kosong dan ditandai
 * "tidak_tersedia" di live_status (tidak ada snapshot atau angka cadangan).
 */
export const dynamic = 'force-dynamic'
// Vercel (Fluid compute): sisa pengambilan berjalan lewat after() sampai batas ini; hasil per potongan tersimpan di Data Cache.
export const maxDuration = 300
// Server API Kemenkes ada di Indonesia: jalankan fungsi di Singapura (sin1) agar panggilan per bulan/provinsi tidak lambat.
export const preferredRegion = 'sin1'

export async function GET(req: Request) {
  // ?tanggal1&tanggal2 (opsional): rentang Filter Dasbor di luar tahun berjalan -> EOC & NCC diambil untuk rentang itu.
  const rentang = parseRentang(new URL(req.url).searchParams)
  const snapshot = loadPuskrisData()
  const codes = (snapshot.regions || []).map((r: any) => String(r.code))
  // Jangan tahan TTFB sampai 25 detik. Potongan yang belum siap ditandai pending;
  // after() + cache persist (15 menit) menyelesaikan sisanya, klien memuat ulang cepat.
  const ov = await getLiveOverlay(codes, 7_000, rentang)
  if (ov.jobs.length) after(() => Promise.allSettled(ov.jobs))
  const data = mergeLive(snapshot, ov)
  const pending = Object.values(ov.status).some((s: any) => s.pending)
  return NextResponse.json(
    { success: true, data: { ...data, rentang_api: rentang }, pending },
    { headers: { 'Cache-Control': pending ? 'no-store' : 'public, s-maxage=180, stale-while-revalidate=720, max-age=30' } },
  )
}
