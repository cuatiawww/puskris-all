import { NextResponse } from 'next/server'
import { BNPB_LAYERS } from '@/lib/puskris/open-data'
import { wibNow, type UpstreamReport } from '@/lib/server/upstream'

// Cek ketersediaan lapisan BNPB InaRISK (GET exportImage kecil di wilayah Jawa). Hanya baca.
export const dynamic = 'force-dynamic'

const BBOX = '105,-8,112,-5'

async function probe(l: (typeof BNPB_LAYERS)[number]): Promise<UpstreamReport & { id: string; ms: number }> {
  const op = l.url.endsWith('ImageServer') ? 'exportImage' : 'export'
  const url = `${l.url}/${op}?bbox=${BBOX}&bboxSR=4326&imageSR=3857&size=128,128&format=png32&transparent=true&f=image`
  const t0 = Date.now()
  const ctl = new AbortController()
  const tm = setTimeout(() => ctl.abort(), 45000)
  try {
    const r = await fetch(url, { signal: ctl.signal, next: { revalidate: 3600 } })
    const type = r.headers.get('content-type') || ''
    const ok = r.ok && type.startsWith('image')
    const n = ok ? (await r.arrayBuffer()).byteLength : 0
    return { id: l.id, nama: l.nama, ok, status: r.status, count: n, ms: Date.now() - t0, error: ok ? undefined : `HTTP ${r.status} ${type}` }
  } catch (e: any) {
    return { id: l.id, nama: l.nama, ok: false, status: 0, count: 0, ms: Date.now() - t0, error: e?.name === 'AbortError' ? 'Batas waktu habis (server BNPB lambat)' : String(e?.message || e) }
  } finally { clearTimeout(tm) }
}

export async function GET() {
  const out: Awaited<ReturnType<typeof probe>>[] = []
  const queue = [...BNPB_LAYERS]
  // maksimal 4 permintaan bersamaan agar tidak membebani server BNPB
  await Promise.all(Array.from({ length: 4 }, async () => { while (queue.length) out.push(await probe(queue.shift()!)) }))
  const order = BNPB_LAYERS.map((l) => l.id)
  out.sort((a, b) => order.indexOf(a.id as any) - order.indexOf(b.id as any))
  const layers = out.filter((u) => u.ok).map((u) => ({ id: u.id, nama: u.nama, ms: u.ms }))
  return NextResponse.json({ ok: layers.length > 0, fetched_at: wibNow(), count: layers.length, upstream: out.map(({ id, ms, ...u }) => ({ ...u, count: u.ok ? 1 : 0, error: u.ok ? `${(ms / 1000).toFixed(1)} detik` : u.error })), layers }, { status: layers.length ? 200 : 502 })
}
