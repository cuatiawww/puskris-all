import { NextRequest, NextResponse } from 'next/server'
import {
  fetchFaskesAgregat,
  fetchFaskesRekap,
  fetchFaskesTitikPage,
  fetchFaskesTitikScoped,
  FASKES_CACHE_SEC,
} from '@/lib/server/faskes-live'

export const dynamic = 'force-dynamic'

const cacheHdr = {
  'Cache-Control': `public, s-maxage=${FASKES_CACHE_SEC}, stale-while-revalidate=${FASKES_CACHE_SEC}`,
}

function pad(v: string | null, n: number): string {
  const s = String(v || '').replace(/\D/g, '')
  return s ? s.padStart(n, '0').slice(0, n) : ''
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const bagian = (q.get('bagian') || 'rekap').trim()
  const prov = pad(q.get('prov'), 2)
  const kab = pad(q.get('kab'), 4)
  try {
    if (bagian === 'rekap') {
      const data = await fetchFaskesRekap(prov, kab)
      return NextResponse.json({ ok: true, data }, { headers: cacheHdr })
    }
    if (bagian === 'agregat') {
      const data = await fetchFaskesAgregat(prov)
      return NextResponse.json({ ok: true, data }, { headers: cacheHdr })
    }
    if (bagian === 'titik') {
      const jenisRaw = q.get('jenis')
      const jenis = jenisRaw === 'puskesmas' ? 'puskesmas' : jenisRaw === 'rs' ? 'rs' : null
      if (!jenis) {
        return NextResponse.json({ ok: false, error: 'Parameter jenis harus rs atau puskesmas' }, { status: 400 })
      }
      if (prov) {
        const titik = await fetchFaskesTitikScoped(jenis, prov, kab)
        return NextResponse.json({
          ok: true,
          data: { titik, pagination: { page: 1, pageCount: 1, total: titik.length, hasMore: false } },
        }, { headers: cacheHdr })
      }
      const page = Math.max(1, Number(q.get('page') || 1) || 1)
      const per = Math.min(2000, Math.max(50, Number(q.get('per') || 2000) || 2000))
      const data = await fetchFaskesTitikPage(jenis, page, per)
      return NextResponse.json({ ok: true, data }, { headers: cacheHdr })
    }
    return NextResponse.json({ ok: false, error: 'Parameter bagian tidak dikenali' }, { status: 400 })
  } catch (e: any) {
    const error = String(e?.message || e)
    return NextResponse.json({ ok: false, error }, { status: 502 })
  }
}
