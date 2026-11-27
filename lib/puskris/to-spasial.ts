import type { Area, SpasialResp, Titik } from '@/lib/spasial-api'
import { deltaOf, jenisCategory } from '@/lib/puskris/jenis-meta'
import type { ProvinceRow } from './types'
import type { PuskrisUiFilter } from './ui-filter'
import { layerValue, nf } from './derive'

export type ChoroId =
  | 'kejadian' | 'krisis' | 'meninggal' | 'pengungsi' | 'terdampak' | 'luka_berat' | 'luka_ringan' | 'hilang'
  | 'psc' | 'ambulans' | 'panggilan' | 'tck' | 'tck_tim' | 'tck_emt' | 'logistik' | 'asistensi' | 'kesenjangan'

export const CHORO_OPTIONS: { id: ChoroId; label: string; group: string; kind: 'count' | 'diverge' | 'sparse' }[] = [
  { id: 'kejadian', label: 'Kejadian terpantau', group: 'Beban krisis', kind: 'count' },
  { id: 'krisis', label: 'Berdampak krisis', group: 'Beban krisis', kind: 'count' },
  { id: 'meninggal', label: 'Korban meninggal', group: 'Beban krisis', kind: 'count' },
  { id: 'pengungsi', label: 'Pengungsi', group: 'Beban krisis', kind: 'count' },
  { id: 'terdampak', label: 'Penduduk terdampak', group: 'Beban krisis', kind: 'count' },
  { id: 'luka_berat', label: 'Luka berat / rawat inap (semua tahun)', group: 'Dampak penduduk', kind: 'count' },
  { id: 'luka_ringan', label: 'Luka ringan / rawat jalan (semua tahun)', group: 'Dampak penduduk', kind: 'count' },
  { id: 'hilang', label: 'Korban hilang (semua tahun)', group: 'Dampak penduduk', kind: 'count' },
  { id: 'psc', label: 'PSC aktif', group: 'Kapasitas respons', kind: 'count' },
  { id: 'ambulans', label: 'Armada ambulans', group: 'Kapasitas respons', kind: 'count' },
  { id: 'panggilan', label: 'Panggilan 119', group: 'Kapasitas respons', kind: 'count' },
  { id: 'tck', label: 'Tenaga cadangan (individu)', group: 'Kesiapsiagaan', kind: 'count' },
  { id: 'tck_tim', label: 'Tim relawan tenaga cadangan', group: 'Kesiapsiagaan', kind: 'count' },
  { id: 'tck_emt', label: 'Tim Medis Darurat (EMT)', group: 'Kesiapsiagaan', kind: 'count' },
  { id: 'logistik', label: 'Stok logistik regional', group: 'Kesiapsiagaan', kind: 'sparse' },
  { id: 'asistensi', label: 'Poin Kapasitas Asistensi', group: 'Kesiapsiagaan', kind: 'sparse' },
  { id: 'kesenjangan', label: 'Indeks kesenjangan respons', group: 'Indeks', kind: 'count' },
]

/** Pil variabel di header peta — label Puskris, kunci metrik SpasialMap tetap. */
export const METRIC_PILLS: { key: 'kasus' | 'kematian' | 'laporan' | 'alert' | 'klb'; label: string; choro: ChoroId }[] = [
  { key: 'kasus', label: 'Kejadian', choro: 'kejadian' },
  { key: 'kematian', label: 'Korban', choro: 'meninggal' },
  { key: 'laporan', label: 'Pengungsi', choro: 'pengungsi' },
  { key: 'alert', label: 'Layanan 119', choro: 'panggilan' },
  { key: 'klb', label: 'Kapasitas', choro: 'psc' },
  { key: 'klb', label: 'TCK', choro: 'tck' },
  { key: 'kasus', label: 'Kesenjangan', choro: 'kesenjangan' },
]

export type Centroids = Record<string, { lat: number; lon: number; nama: string }>

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

export function monthLabel(ym: string) {
  const m = Number(String(ym).slice(5, 7))
  return MONTHS[m - 1] || ym
}

export function centroidsFromGeo(fc: any): Centroids {
  const out: Centroids = {}
  for (const f of fc?.features || []) {
    const p = f.properties || {}
    const code = String(p.id_provinsi || p.kode || p.code || '').padStart(2, '0')
    const lat = Number(p.centerlat ?? p.lat)
    const lon = Number(p.centerlong ?? p.lon)
    if (code && Number.isFinite(lat) && Number.isFinite(lon)) out[code] = { lat, lon, nama: String(p.provinsi || p.nama || code) }
  }
  return out
}

function choroValue(row: ProvinceRow, id: ChoroId, extras: { logistik?: number | null; asistensi?: number | null }): number | null {
  if (id === 'logistik') return extras.logistik ?? null
  if (id === 'asistensi') return extras.asistensi ?? null
  if (id === 'kesenjangan') return row.indeksRespons
  return layerValue(row, id === 'psc' ? 'psc' : id)
}

export function buildMonths(raw: any): { ws: string; label: string; kejadian: number; krisis: number; meninggal: number }[] {
  return (raw?.eoc?.bulanan_2026 || []).map((b: any) => ({
    ws: b.bulan,
    label: monthLabel(b.bulan),
    kejadian: Number(b.kejadian || 0),
    krisis: Number(b.krisis || 0),
    meninggal: Number(b.meninggal || 0),
  }))
}

export function toSpasial(opts: {
  rows: ProvinceRow[]
  kejadian: any[]
  choro: ChoroId
  centroids: Centroids
  filter: PuskrisUiFilter
  logistikByCode: Record<string, number>
  asistensiByCode: Record<string, number>
  ringkasanLabel: string
  periodeLabel: string
  interpretasi: string[]
  raw: any
}): { data: SpasialResp; titik: Titik[]; metric: 'kasus' | 'kematian' | 'laporan' | 'alert' | 'klb' | 'chg_minggu' } {
  const { rows, kejadian, choro, centroids, filter, logistikByCode, asistensiByCode, ringkasanLabel, periodeLabel, interpretasi, raw } = opts
  const kind = CHORO_OPTIONS.find((c) => c.id === choro)?.kind || 'count'
  const pill = METRIC_PILLS.find((p) => p.choro === choro)
  const metric: 'kasus' | 'kematian' | 'laporan' | 'alert' | 'klb' | 'chg_minggu' =
    kind === 'diverge' ? 'chg_minggu' : (pill?.key || (choro === 'meninggal' ? 'kematian' : choro === 'pengungsi' ? 'laporan' : choro === 'panggilan' ? 'alert' : choro === 'psc' || choro === 'ambulans' || choro === 'tck' || choro === 'tck_tim' || choro === 'tck_emt' ? 'klb' : 'kasus'))

  const months = buildMonths(raw)
  const last = months[months.length - 1]
  const prev = months[months.length - 2]
  const chg = last && prev && prev.kejadian ? Math.round(((last.kejadian - prev.kejadian) * 1000) / prev.kejadian) / 10 : null

  const wilayah: Area[] = rows.map((r, i) => {
    const c = centroids[r.code]
    const extras = { logistik: logistikByCode[r.code] ?? null, asistensi: asistensiByCode[r.code] ?? null }
    const v = choroValue(r, choro, extras)
    return {
      id: Number(r.code) || i + 1,
      code: r.code,
      nama: r.nama,
      lat: c?.lat ?? null,
      lon: c?.lon ?? null,
      // Field semantik untuk popup + metrik pil
      kasus: choro === 'kejadian' || !pill && metric === 'kasus' ? (v ?? r.kejadian) : r.kejadian,
      kematian: r.meninggal,
      laporan: r.pengungsi,
      alert: r.panggilan,
      klb: choro === 'psc' || choro === 'ambulans' || choro === 'tck' || choro === 'tck_tim' || choro === 'tck_emt' || choro === 'logistik' || choro === 'asistensi'
        ? (v ?? r.pscAktif)
        : r.krisis,
      unit: r.tck,
      cfr: null,
      porsi: null,
      kasus_prev: prev?.kejadian || 0,
      chg_periode: null,
      minggu_ini: last?.kejadian || r.kejadian,
      minggu_lalu: prev?.kejadian || 0,
      chg_minggu: kind === 'diverge' ? v : chg,
      seri: null,
      dipilih: filter.provinsi === r.code,
    }
  })

  // Jika variabel arsiran bukan field semantik default, tulis nilainya ke field metrik aktif.
  if (choro !== 'kejadian' && choro !== 'meninggal' && choro !== 'pengungsi' && choro !== 'panggilan' && choro !== 'krisis') {
    for (const a of wilayah) {
      const row = rows.find((r) => r.code === a.code)!
      const extras = { logistik: logistikByCode[a.code] ?? null, asistensi: asistensiByCode[a.code] ?? null }
      const v = choroValue(row, choro, extras)
      if (metric === 'kasus') a.kasus = v ?? 0
      else if (metric === 'kematian') a.kematian = v ?? 0
      else if (metric === 'laporan') a.laporan = v ?? 0
      else if (metric === 'alert') a.alert = v ?? 0
      else if (metric === 'klb') a.klb = v ?? 0
      else if (metric === 'chg_minggu') a.chg_minggu = v
    }
  } else if (choro === 'krisis') {
    for (const a of wilayah) a.kasus = a.klb
  }

  const titik: Titik[] = kejadian.map((k, idx) => {
    const c = centroids[k.code] || { lat: -2.5, lon: 118 }
    const jitter = ((idx % 7) - 3) * 0.04
    const meninggal = Number(k.meninggal || 0)
    const korban = Number(k.korban || 0) || meninggal + Number(k.luka_berat || 0) + Number(k.luka_ringan || 0)
    const ym = String(k.tanggal || '').slice(0, 7)
    const wi = months.findIndex((m) => m.ws === ym)
    const w: [number, number, number, number][] = wi >= 0 ? [[wi, Math.max(1, korban || 1), 1, meninggal > 0 ? 1 : 0]] : []
    return {
      idx,
      src: 'ebs',
      unit: k.jenis || 'Kejadian',
      kab_id: null,
      kab: k.kabupaten || null,
      kec: null,
      ju: k.jenis || null,
      lat: c.lat + jitter,
      lon: c.lon + jitter * 0.7,
      lokasi: 'c',
      k: Math.max(1, Number(k.terdampak || 0) || korban || 1),
      m: meninggal,
      l: 1,
      a: k.jenis ? 1 : 0,
      b: meninggal > 0 ? 1 : 0,
      v: 1,
      r: 1,
      rn: meninggal > 0 ? 2 : 1,
      st: meninggal > 0 ? 'klb' : (Number(k.pengungsi || 0) > 0 ? 'alert' : 'lapor'),
      w,
    }
  })

  const kurva = months.map((m) => ({ label: m.label, kasus: m.kejadian, alert: m.krisis }))
  const data: SpasialResp = {
    meta: {
      breadcrumb: [{ label: filter.provinsi ? (rows.find((r) => r.code === filter.provinsi)?.nama || 'Provinsi') : 'Indonesia' }],
      periode_label: periodeLabel,
      sumber_label: ringkasanLabel,
    },
    level: 'provinsi',
    prov: filter.provinsi ? Number(filter.provinsi) : null,
    kab: [],
    kec: null,
    minggu: months.map((m) => ({ ws: m.ws, label: m.label })),
    seri: months.length > 1,
    minggu_ini: last?.label || '',
    minggu_lalu: prev?.label || '',
    ringkasan: {
      kasus: wilayah.reduce((a, r) => a + (r.kasus || 0), 0),
      kematian: wilayah.reduce((a, r) => a + r.kematian, 0),
      laporan: titik.length,
      alert: titik.filter((t) => t.st === 'alert' || t.st === 'klb').length,
      klb: titik.filter((t) => t.st === 'klb').length,
      unit: rows.length,
      kurva,
      minggu_ini: last?.kejadian || 0,
      minggu_lalu: prev?.kejadian || 0,
      chg_minggu: chg,
    },
    wilayah,
    titik: [],
    titik_kolom: [],
    titik_terpotong: false,
    lokasi_label: {},
    kab_nama: {},
    interpretasi: interpretasi.slice(0, 5),
    ms: 0,
  }
  return { data, titik, metric }
}

export type JenisCardModel = {
  nama: string
  category: string
  kejadian: number
  korban: number
  meninggal: number
  pengungsi: number
  terdampak: number
  provinces: number
  share: number
  sparkKejadian: number[]
  sparkPengungsi: number[]
  deltaKejadian: { last4: number; prev4: number } | null
  deltaPengungsi: { last4: number; prev4: number } | null
  lastDate: string | null
}
export type JenisCard = JenisCardModel

function monthAxis(raw: any): string[] {
  const official = (raw?.eoc?.bulanan_2026 || []).map((b: any) => String(b.bulan))
  if (official.length) return official
  return Array.from({ length: 11 }, (_, i) => `2026-${String(i + 1).padStart(2, '0')}`)
}

export function buildJenisCards(raw: any, kejadian: any[]): JenisCardModel[] {
  const months = monthAxis(raw)
  const byEvent: Record<string, {
    kejadian: number; meninggal: number; pengungsi: number; terdampak: number; korban: number
    sparkK: number[]; sparkP: number[]; provinces: Set<string>; lastDate: string | null
  }> = {}
  const ensure = (nama: string) => {
    if (!byEvent[nama]) {
      byEvent[nama] = {
        kejadian: 0, meninggal: 0, pengungsi: 0, terdampak: 0, korban: 0,
        sparkK: months.map(() => 0), sparkP: months.map(() => 0), provinces: new Set(), lastDate: null,
      }
    }
    return byEvent[nama]
  }
  for (const k of kejadian || []) {
    const nama = String(k.jenis || 'Lainnya')
    const cur = ensure(nama)
    cur.kejadian += 1
    cur.meninggal += Number(k.meninggal || 0)
    cur.pengungsi += Number(k.pengungsi || 0)
    cur.terdampak += Number(k.terdampak || 0)
    cur.korban += Number(k.korban || k.meninggal || 0) + Number(k.luka_berat || 0) + Number(k.luka_ringan || 0)
    const mi = months.indexOf(String(k.tanggal || '').slice(0, 7))
    if (mi >= 0) {
      cur.sparkK[mi] += 1
      cur.sparkP[mi] += Number(k.pengungsi || 0)
    }
    if (k.code) cur.provinces.add(String(k.code))
    const tgl = String(k.tanggal || '')
    if (tgl && (!cur.lastDate || tgl > cur.lastDate)) cur.lastDate = tgl
  }
  const official: { nama: string; jumlah: number }[] = raw?.eoc?.jenis_2026 || []
  const names = new Set([...official.map((x) => x.nama), ...Object.keys(byEvent)])
  const totalOff = official.reduce((a, x) => a + x.jumlah, 0) || 1
  return [...names].map((nama) => {
    const ev = byEvent[nama]
    const off = official.find((x) => x.nama === nama)
    const sparkKejadian = ev?.sparkK || months.map(() => 0)
    const sparkPengungsi = ev?.sparkP || months.map(() => 0)
    return {
      nama,
      category: jenisCategory(nama),
      kejadian: off?.jumlah || ev?.kejadian || 0,
      korban: ev?.korban || 0,
      meninggal: ev?.meninggal || 0,
      pengungsi: ev?.pengungsi || 0,
      terdampak: ev?.terdampak || 0,
      provinces: ev?.provinces.size || 0,
      share: off?.jumlah ? (off.jumlah / totalOff) * 100 : 0,
      sparkKejadian,
      sparkPengungsi,
      deltaKejadian: deltaOf(sparkKejadian),
      deltaPengungsi: deltaOf(sparkPengungsi),
      lastDate: ev?.lastDate || null,
    }
  }).filter((c) => c.kejadian > 0).sort((a, b) => b.kejadian - a.kejadian)
}

export function jenisOptions(raw: any): string[] {
  const official: string[] = (raw?.eoc?.jenis_2026 || []).map((x: any) => x.nama)
  const ev: string[] = (raw?.eoc?.kejadian_krisis_terbaru || []).map((x: any) => x.jenis).filter(Boolean)
  return [...new Set([...official, ...ev])]
}

export { nf }
