import { NextResponse } from 'next/server'
import { ID_AIRPORTS } from '@/lib/server/airports'
import { wibNow } from '@/lib/server/upstream'

export async function GET() {
  return NextResponse.json({ ok: true, fetched_at: wibNow(), count: ID_AIRPORTS.length, upstream: [{ nama: 'Daftar bandara statis', ok: true, status: 200, count: ID_AIRPORTS.length }], airports: ID_AIRPORTS })
}
