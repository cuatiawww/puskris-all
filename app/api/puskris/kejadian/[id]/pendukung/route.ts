import { NextResponse } from 'next/server'
import { getKejadianPendukung } from '@/lib/server/kejadian-pendukung'

export const dynamic = 'force-dynamic'

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const uid = decodeURIComponent(id || '').trim()
  if (!uid) return NextResponse.json({ error: 'Kode kejadian diperlukan' }, { status: 400 })

  const { searchParams } = new URL(req.url)
  const latRaw = searchParams.get('lat')
  const lonRaw = searchParams.get('lon')
  const lat = latRaw !== null && latRaw !== '' && Number.isFinite(Number(latRaw)) ? Number(latRaw) : null
  const lon = lonRaw !== null && lonRaw !== '' && Number.isFinite(Number(lonRaw)) ? Number(lonRaw) : null
  const jenis = searchParams.get('jenis')
  const tanggal = searchParams.get('tanggal')
  const templateOverride = searchParams.get('template')

  try {
    const data = await getKejadianPendukung({
      uid,
      lat,
      lon,
      jenis,
      tanggal,
      templateOverride,
    })
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}
