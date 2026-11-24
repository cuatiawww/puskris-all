import { after, NextResponse } from 'next/server'
import { loadPuskrisData } from '@/lib/puskris/load-data'
import { getLiveOverlay, mergeLive, parseRentang, type RentangApi } from '@/lib/server/puskris-live'
import { eocKejadian } from '@/lib/puskris/derive'
import { eocIconOf, eocKindOf, eocPinDataUri, LOK_LABEL, resolveEventCoord, type KabRow } from '@/lib/puskris/eoc-markers'
import { bencanaIconOf, kejadianPinSrc } from '@/lib/puskris/bencana-icons'
import { nearbyDetail, rekomendasiDariData, risikoWilayah, riwayat12Bulan, statusOperasional } from '@/lib/puskris/kejadian-detail'
import kabIndex from '@/lib/puskris/kabkota-index.json'
import { centroidsFromGeo } from '@/lib/puskris/to-spasial'
import { readFile } from 'fs/promises'
import path from 'path'

export const dynamic = 'force-dynamic'
export const maxDuration = 300
export const preferredRegion = 'sin1'

function rentangDariTahun(tahun: string | null): RentangApi {
  if (!tahun || !/^\d{4}$/.test(tahun)) return null
  const y = Number(tahun)
  if (y < 2015 || y > 2100) return null
  const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)
  const tanggal1 = `${y}-01-01`
  const tanggal2 = today.startsWith(String(y)) ? today : `${y}-12-31`
  return { tanggal1, tanggal2 }
}

async function loadCentroids() {
  try {
    const p = path.join(process.cwd(), 'public', 'data', 'indonesia-38-provinces.geojson')
    const fc = JSON.parse(await readFile(p, 'utf8'))
    return centroidsFromGeo(fc)
  } catch {
    return {} as Record<string, { lat: number; lon: number; nama: string }>
  }
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const uid = decodeURIComponent(id || '').trim()
  if (!uid) return NextResponse.json({ ok: false, error: 'Identitas kejadian tidak lengkap' }, { status: 400 })

  const sp = new URL(req.url).searchParams
  const rentang = parseRentang(sp) || rentangDariTahun(sp.get('tahun'))
  const snapshot = loadPuskrisData()
  const codes = (snapshot.regions || []).map((r: any) => String(r.code))
  const ov = await getLiveOverlay(codes, 25_000, rentang)
  if (ov.jobs.length) after(() => Promise.allSettled(ov.jobs))
  const data = mergeLive(snapshot, ov)
  const pending = Object.values(ov.status).some((s: any) => s.pending)
  const regionName = Object.fromEntries((data.regions || []).map((r: any) => [r.code, r.name]))

  const rawEv = (data.eoc?.events || []).find((e: any) => String(e.u) === uid)
  if (!rawEv) {
    return NextResponse.json({
      ok: false,
      pending,
      kejadian: null,
      pesan: pending ? 'Sedang mengambil data dari API…' : 'Data belum tersedia dari API',
      detail: pending ? 'Kejadian ini belum ada di data EOC yang sudah termuat. Halaman akan mencoba lagi.' : 'Kejadian tidak ditemukan pada data EOC untuk rentang yang diminta.',
    })
  }

  const k = eocKejadian(rawEv, regionName)
  const centroids = await loadCentroids()
  const pos = resolveEventCoord(k, centroids, kabIndex as KabRow[])
  const icon = eocIconOf(k.jenis)
  const nearby = nearbyDetail(data, k, pos)
  const risiko = risikoWilayah(data, k)
  const riwayat = riwayat12Bulan(data, k, regionName)
  const status = statusOperasional(k)
  const official = bencanaIconOf(k.jenis)
  const rekomendasi = rekomendasiDariData(k, nearby, risiko, status)

  return NextResponse.json({
    ok: true,
    pending,
    kejadian: {
      ...k,
      kind: eocKindOf(k.jenis),
      icon: { id: icon.id, label: official?.label || icon.label, color: icon.color, src: official?.src || eocPinDataUri(icon, { krisis: Boolean(k.krisis), approx: pos?.lok !== 'kejadian' }), file: official?.file || null },
      koordinat: pos ? { lat: pos.lat, lon: pos.lon, lok: pos.lok, label: LOK_LABEL[pos.lok] } : { lat: null, lon: null, lok: 'tidak_tersedia', label: LOK_LABEL.tidak_tersedia },
    },
    status,
    nearby,
    risiko,
    riwayat,
    rekomendasi,
    sumber: 'API EOC Pusat Krisis Kesehatan',
  })
}
