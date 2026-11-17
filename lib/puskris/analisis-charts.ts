import type { ProvinceRow } from '@/lib/puskris/types'
import type { PuskrisUiFilter } from '@/lib/puskris/ui-filter'

const MONTH_LABEL: Record<string, string> = {
  '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr', '05': 'Mei', '06': 'Jun',
  '07': 'Jul', '08': 'Agu', '09': 'Sep', '10': 'Okt', '11': 'Nov', '12': 'Des',
}

const PALETTE = ['#16B3AC', '#3899FE', '#F59E0B', '#DC2626', '#7C3AED', '#0F766E', '#64748B']

/**
 * Tren kejadian per jenis per bulan, dihitung langsung dari daftar kejadian API EOC
 * (sudah tersaring periode, provinsi, kab/kota). Tanpa API -> kosong.
 */
export function jenisTrendSeries(kejadian: any[] | null | undefined, filter: PuskrisUiFilter): {
  rows: Record<string, string | number>[]
  keys: string[]
  colors: Record<string, string>
  catatan: string
  contoh: boolean
  nasionalOnly: boolean
} {
  if (!kejadian) return { rows: [], keys: [], colors: {}, contoh: false, nasionalOnly: false, catatan: 'Data belum tersedia dari API EOC.' }
  const list = filter.jenis ? kejadian.filter((k) => k.jenis === filter.jenis) : kejadian
  const tot: Record<string, number> = {}
  for (const k of list) tot[k.jenis] = (tot[k.jenis] || 0) + 1
  const ranked = Object.entries(tot).sort((a, b) => b[1] - a[1]).map(([n]) => n)
  const top = ranked.slice(0, 6)
  const hasLain = ranked.length > 6
  const keys = hasLain ? [...top, 'Lainnya'] : top
  const colors: Record<string, string> = {}
  keys.forEach((k, i) => { colors[k] = PALETTE[i % PALETTE.length] })
  const byMonth: Record<string, Record<string, number>> = {}
  for (const k of list) {
    const ym = String(k.tanggal).slice(0, 7)
    const m = (byMonth[ym] ||= {})
    const key = top.includes(k.jenis) ? k.jenis : 'Lainnya'
    m[key] = (m[key] || 0) + 1
  }
  const rows = Object.keys(byMonth).sort().map((ym) => {
    const out: Record<string, string | number> = { bulan: ym, label: MONTH_LABEL[ym.slice(5, 7)] ? `${MONTH_LABEL[ym.slice(5, 7)]} ${ym.slice(0, 4)}` : ym }
    for (const k of keys) out[k] = byMonth[ym][k] || 0
    return out
  })
  return {
    rows, keys, colors, contoh: false, nasionalOnly: false,
    catatan: `Jumlah kejadian per jenis per bulan dari ${list.length.toLocaleString('id-ID')} kejadian API EOC (data_krisis), mengikuti filter periode, wilayah, dan jenis.`,
  }
}

const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0') + ':00')

/** Pola panggilan per jam dari API NCC (slot 30 menit asli, dijumlah per jam). Tanpa API -> kosong. */
export function busyHourSeries(raw: any, _nccDays: { date: string; cof: number; acd?: number; available?: boolean }[], filter: PuskrisUiFilter): {
  rows: { jam: string; 'Panggilan masuk': number; 'Panggilan terjawab': number }[]
  catatan: string
  contoh: boolean
  nasionalOnly: boolean
} {
  const slots: any[] = raw?.ncc?.data_source === 'langsung' ? raw.ncc.per_jam || [] : []
  if (!slots.length) return { rows: [], contoh: false, nasionalOnly: Boolean(filter.provinsi || filter.kabupaten), catatan: 'Data belum tersedia dari API NCC.' }
  const hours = HOURS.map((jam) => ({ jam, cof: 0, acd: 0 }))
  for (const x of slots) {
    const h = Number(String(x.interval_mulai).slice(0, 2))
    if (h >= 0 && h < 24) { hours[h].cof += Number(x.cof || 0); hours[h].acd += Number(x.acd || 0) }
  }
  return {
    rows: hours.map((r) => ({ jam: r.jam, 'Panggilan masuk': r.cof, 'Panggilan terjawab': r.acd })),
    contoh: false,
    nasionalOnly: Boolean(filter.provinsi || filter.kabupaten),
    catatan: `Jumlah panggilan per jam dari slot 30 menit API NCC, seluruh rentang ${raw.ncc.period?.label || ''}.`,
  }
}

export function gapRankRows(rows: ProvinceRow[], filter: PuskrisUiFilter, topN = 10) {
  const ranked = [...rows].sort((a, b) => b.indeksRespons - a.indeksRespons)
  const src = filter.provinsi ? ranked.filter((r) => r.code === filter.provinsi) : ranked.slice(0, topN)
  return src.map((r) => ({
    nama: r.nama
      .replace('Kepulauan ', 'Kep. ')
      .replace('Sumatera ', 'Sum. ')
      .replace('Sulawesi ', 'Sul. ')
      .replace('Kalimantan ', 'Kal. ')
      .replace('Nusa Tenggara ', 'NT ')
      .replace('Daerah Istimewa ', 'DI '),
    code: r.code,
    Beban: Math.round(r.beban * 1000) / 10,
    Kapasitas: Math.round(r.kapasitas * 1000) / 10,
    Indeks: r.indeksRespons,
  }))
}

export function scatterRows(rows: ProvinceRow[]) {
  return rows.map((r) => ({
    nama: r.nama,
    code: r.code,
    Beban: Math.round(r.beban * 1000) / 10,
    Kapasitas: Math.round(r.kapasitas * 1000) / 10,
    Indeks: r.indeksRespons,
    prioritas: r.beban >= 0.5 && r.kapasitas < 0.5,
  }))
}

/** Ambang sama dengan lencana tabel: hijau < 55, kuning 55–69, merah ≥ 70. */
export const GAP_COLOR_CLASSES = [
  { min: 0, max: 54.999, label: '< 55', color: '#10B981' },
  { min: 55, max: 69.999, label: '55–69', color: '#F59E0B' },
  { min: 70, max: null, label: '≥ 70', color: '#DC2626' },
]

export { PALETTE }
