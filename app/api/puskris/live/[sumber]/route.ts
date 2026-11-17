import { after, NextResponse } from 'next/server'
import { loadPuskrisData } from '@/lib/puskris/load-data'
import { getEocLive, getLiveOverlay, swr, wibStamp } from '@/lib/server/puskris-live'
import { eocEnabled, fetchEocRange, rekapEoc, type EocEvent } from '@/lib/server/eoc-live'

/**
 * Proksi API resmi (hasil agregat saja, tanpa data pribadi).
 * GET /api/puskris/live/asistensi | psc | panggilan
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const ALLOWED = ['asistensi', 'psc', 'panggilan', 'tck', 'eoc', 'logistik'] as const

export async function GET(req: Request, ctx: { params: Promise<{ sumber: string }> }) {
  const { sumber } = await ctx.params
  if (!ALLOWED.includes(sumber as any)) return NextResponse.json({ ok: false, error: 'Sumber tidak dikenal' }, { status: 404 })
  if (sumber === 'eoc') return eocResponse(req)
  const snapshot = loadPuskrisData()
  const codes = (snapshot.regions || []).map((r: any) => String(r.code))
  const ov = await getLiveOverlay(codes, 45000)
  if (ov.jobs.length) after(() => Promise.allSettled(ov.jobs))
  const key = sumber as (typeof ALLOWED)[number]
  const st = key === 'tck' ? (ov.tck.value || ov.tckRelawan.value ? { ...ov.status.tck, status: 'langsung' as const, at: ov.status.tck.at || ov.status.tckRelawan.at } : ov.status.tck) : ov.status[key]
  const value: any = key === 'tck' ? (ov.tck.value || ov.tckRelawan.value ? { inti: ov.tck.value || null, relawan: ov.tckRelawan.value || null } : undefined) : ov[key].value
  let count = 0
  let ringkas: any = null
  if (value && key === 'asistensi') {
    count = value.provinsi.length + value.kabkota.length
    ringkas = { tahun: value.tahun, provinsi: value.provinsi.length, kabkota: value.kabkota.length, provinsi_mengisi: value.provinsi.filter((r: any) => r.status_kapasitas !== 'Belum Mengisi').length, kabkota_mengisi: value.kabkota.filter((r: any) => r.status_kapasitas !== 'Belum Mengisi').length }
  } else if (value && key === 'psc') {
    count = value.summary.total_psc
    ringkas = value.summary
  } else if (value && key === 'tck') {
    const di = value.inti?.dashboard?.individu || {}
    count = Number(di.total_individu || 0) || (value.relawan?.provinsi || []).reduce((a: number, p: any) => a + p.individu, 0)
    ringkas = {
      individu: di.total_individu ?? null, tim: value.inti?.tim.total ?? null, emt: value.inti?.emt.total ?? null,
      relawan_provinsi: value.relawan ? value.relawan.provinsi.length : null, relawan_total: value.relawan ? value.relawan.provinsi.reduce((a: number, p: any) => a + p.individu, 0) : null,
      inti: ov.status.tck.status, relawan: ov.status.tckRelawan.status,
    }
  } else if (value && key === 'logistik') {
    count = value.nasional.barang
    ringkas = { regional: value.regional.length, regional_gagal: value.gagal.length, barang: value.nasional.barang, barang_unik: value.nasional.barang_unik, total_stok: value.nasional.stok, unit_masuk: value.nasional.masuk, unit_keluar: value.nasional.keluar, kedaluwarsa: value.nasional.kedaluwarsa, segera_kedaluwarsa: value.nasional.segera_kedaluwarsa, pergerakan_sampel: value.pergerakan.sampel_berhasil, pergerakan_cakupan_pct: value.pergerakan.cakupan_volume_pct }
  } else if (value && key === 'panggilan') {
    count = value.total
    ringkas = { tahun: value.tahun, total: value.total, selesai: value.selesai, total_tahun_lalu: value.total_tahun_lalu, sampel: { dari: value.sampel.dari, sampai: value.sampel.sampai, jumlah: value.sampel.jumlah } }
  }
  return NextResponse.json(
    { ok: st.status === 'langsung', sumber: key, status: st.status, fetched_at: st.at || null, count, error: st.error || null, ringkas, data: value || null },
    { status: st.status === 'langsung' ? 200 : 502, headers: { 'Cache-Control': 'no-store' } },
  )
}


const D = /^\d{4}-\d{2}-\d{2}$/
/**
 * GET /api/puskris/live/eoc?tanggal1=YYYY-MM-DD&tanggal2=YYYY-MM-DD&prov=32&kab=3201
 * Tanpa parameter = tahun berjalan. Rentang di dalam cache tahun berjalan disaring dari cache;
 * di luar itu diteruskan ke API EOC (per bulan, di-cache 15 menit). Hanya agregat + kejadian ringkas.
 */
async function eocResponse(req: Request) {
  const sp = new URL(req.url).searchParams
  const t1 = sp.get('tanggal1') || ''
  const t2 = sp.get('tanggal2') || ''
  const prov = (sp.get('prov') || '').replace(/\D/g, '').slice(0, 2) || null
  const kab = (sp.get('kab') || '').replace(/\D/g, '').slice(0, 4) || null
  if ((t1 && !D.test(t1)) || (t2 && !D.test(t2)) || (t1 && t2 && t1 > t2)) return NextResponse.json({ ok: false, error: 'Format tanggal1/tanggal2 harus YYYY-MM-DD' }, { status: 400 })
  if (!eocEnabled()) return NextResponse.json({ ok: false, sumber: 'eoc', status: 'snapshot', error: 'Akun API EOC (PUSKRIS_EOC_AUTH) belum diatur di server', data: null }, { status: 502 })
  const base = await getEocLive(45000)
  if (base.job) after(() => base.job)
  let events: EocEvent[] | null = null
  let at = base.at
  let dari = t1 || base.value?.dari || ''
  let sampai = t2 || base.value?.sampai || ''
  let error = base.error
  const inCache = base.value && (!t1 || t1 >= base.value.dari) && (!t2 || t2 <= base.value.sampai)
  if (base.value && inCache) {
    events = base.value.events.filter((e) => (!t1 || e.t >= t1) && (!t2 || e.t <= t2) && (!prov || e.p === prov) && (!kab || e.b === kab))
    if (!t1 && !t2) { dari = base.value.dari; sampai = base.value.sampai }
  } else if (t1 && t2) {
    const r = await swr(`eoc:range:${t1}:${t2}:${prov || ''}:${kab || ''}`, () => fetchEocRange({ tanggal1: t1, tanggal2: t2, prov, kab }), 55000)
    if (r.job) after(() => r.job)
    events = r.value?.events || null
    at = r.at
    error = r.error || (r.pending ? 'Sedang mengambil data langsung' : undefined)
  }
  if (!events) return NextResponse.json({ ok: false, sumber: 'eoc', status: 'snapshot', error: error || 'Data belum tersedia', data: null }, { status: 502, headers: { 'Cache-Control': 'no-store' } })
  const jenis: Record<string, number> = {}
  const provinsi: Record<string, any> = {}
  for (const e of events) {
    jenis[e.n] = (jenis[e.n] || 0) + 1
    const p = (provinsi[e.p] ||= { code: e.p, nama: e.pn, kejadian: 0, krisis: 0, meninggal: 0, hilang: 0, luka_berat: 0, luka_ringan: 0, pengungsi: 0, terdampak: 0 })
    p.kejadian++; p.krisis += e.s; p.meninggal += e.m; p.hilang += e.h; p.luka_berat += e.lb; p.luka_ringan += e.lr; p.pengungsi += e.pg; p.terdampak += e.td
  }
  const ringkas = { dari, sampai, prov, kab, ...rekapEoc(events) }
  return NextResponse.json({
    ok: true, sumber: 'eoc', status: 'langsung', fetched_at: at ? wibStamp(at) : null, count: events.length, error: null, ringkas,
    data: {
      jenis: Object.entries(jenis).map(([nama, jumlah]) => ({ nama, jumlah })).sort((a, b) => b.jumlah - a.jumlah),
      provinsi: Object.values(provinsi).sort((a: any, b: any) => a.code.localeCompare(b.code)),
      kejadian_terbaru: events.slice(0, 50),
      catatan: 'Agregat per kejadian dari data_krisis.php; field perkembangan, kecamatan dan content_html dibuang di server.',
    },
  }, { headers: { 'Cache-Control': 'no-store' } })
}
