/**
 * Proxy gambar Shakemap resmi BMKG melalui same-origin agar lolos CSP `img-src 'self'`.
 * Hanya mengizinkan nama file alfanumerik dengan ekstensi jpg/jpeg/png.
 */
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const file = String(searchParams.get('file') || '').trim()
  if (!/^[A-Za-z0-9_.\-]+\.(?:jpg|jpeg|png)$/i.test(file)) {
    return NextResponse.json({ error: 'Nama file shakemap tidak valid' }, { status: 400 })
  }
  const url = `https://data.bmkg.go.id/DataMKG/TEWS/${encodeURIComponent(file)}`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'PusatKrisisKemkes-EOC/1.0' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return NextResponse.json({ error: `BMKG ${res.status}` }, { status: res.status })
    const buf = await res.arrayBuffer()
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': res.headers.get('content-type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 502 })
  }
}
