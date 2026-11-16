import { NextResponse } from 'next/server'
import { loadPuskrisData } from '@/lib/puskris/load-data'

/** Data statis dari data/puskris-data.json. Filter diterapkan di klien. */
export const dynamic = 'force-static'

export async function GET() {
  const data = loadPuskrisData()
  return NextResponse.json({ success: true, data })
}
