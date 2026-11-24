import { after, NextResponse } from 'next/server'
import { loadPuskrisData } from '@/lib/puskris/load-data'
import { getLiveOverlay, mergeLive, parseRentang, type RentangApi } from '@/lib/server/puskris-live'
import { eocKejadian } from '@/lib/puskris/derive'
import { eocIconOf, eocKindOf, eocPinDataUri, LOK_LABEL, resolveEventCoord, type KabRow } from '@/lib/puskris/eoc-markers'
import { haversineKm } from '@/lib/puskris/integrasi'
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
  const nearby = nearbyAgregat(data, k, pos)

  return NextResponse.json({
    ok: true,
    pending,
    kejadian: {
      ...k,
      kind: eocKindOf(k.jenis),
      icon: { id: icon.id, label: icon.label, color: icon.color, src: eocPinDataUri(icon, { krisis: Boolean(k.krisis), approx: pos?.lok !== 'kejadian' }) },
      koordinat: pos ? { lat: pos.lat, lon: pos.lon, lok: pos.lok, label: LOK_LABEL[pos.lok] } : { lat: null, lon: null, lok: 'tidak_tersedia', label: LOK_LABEL.tidak_tersedia },
    },
    nearby,
    sumber: 'API EOC Pusat Krisis Kesehatan',
  })
}

function nearbyAgregat(data: any, k: any, pos: { lat: number; lon: number } | null) {
  const peta = data?.psc?.peta
  const pscAll: any[] = peta?.psc || []
  const ambAll: any[] = peta?.ambulans || []
  const sameKab = (p: any) => k.kab_code && p.kk && String(p.kk) === String(k.kab_code)
  const sameProv = (p: any) => k.code && p.p && String(p.p).padStart(2, '0') === String(k.code).padStart(2, '0')
  const near = (lat: number, lon: number) => pos ? haversineKm(pos, { lat, lon }) <= 50 : false

  const psc = pscAll.filter((p) => p.lat != null && p.lon != null && (sameKab(p) || near(p.lat, p.lon)))
  const amb = ambAll.filter((a) => {
    const ps = pscAll[a[7]]
    if (!ps) return false
    const lat = a[0], lon = a[1]
    return (sameKab(ps) || (lat != null && lon != null && near(lat, lon)))
  })
  const tck = (data?.tck?.provinsi || []).find((r: any) => String(r.code).padStart(2, '0') === String(k.code || '').padStart(2, '0')) || null
  const logistikBy = data?.logistik?.provinsi_regional && data?.logistik?.regional
    ? Object.fromEntries((data.logistik.regional || []).map((r: any) => [r.id, r]))
    : null
  const regId = data?.logistik?.provinsi_regional?.[String(k.code || '').padStart(2, '0')]
  const logistik = regId != null && logistikBy ? logistikBy[regId] : (data?.logistik?.regional || []).find((r: any) => String(r.code) === String(k.code)) || null

  const pscLive = data?.psc?.data_source === 'langsung'
  const tckLive = data?.tck?.data_source === 'langsung'
  const logLive = data?.logistik?.data_source === 'langsung'

  return {
    radius_km: 50,
    psc: pscLive ? {
      tersedia: true,
      total: psc.length,
      aktif: psc.filter((p) => p.a === 1).length,
      nama: psc.slice(0, 8).map((p) => p.n).filter(Boolean),
    } : { tersedia: false },
    ambulans: pscLive ? {
      tersedia: true,
      total: amb.length,
      siap: amb.filter((a) => a[2] === 1).length,
    } : { tersedia: false },
    tck: tckLive && tck ? {
      tersedia: true,
      level: 'provinsi',
      provinsi: tck.nama || k.provinsi,
      individu: Number(tck.individu || 0),
      nakes: Number(tck.nakes || 0),
      non_nakes: Number(tck.non_nakes || 0),
    } : { tersedia: false },
    logistik: logLive && logistik ? {
      tersedia: true,
      level: 'regional',
      nama: logistik.nama || logistik.wilayah || 'Regional',
      total: Number(logistik.total || logistik.stok || 0),
    } : { tersedia: false },
  }
}