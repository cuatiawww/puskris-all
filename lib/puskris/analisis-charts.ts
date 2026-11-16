import { CONTOH_LABEL } from '@/lib/puskris/integrasi'
import type { ProvinceRow } from '@/lib/puskris/types'
import type { PuskrisUiFilter } from '@/lib/puskris/ui-filter'

const MONTH_LABEL: Record<string, string> = {
  '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr', '05': 'Mei', '06': 'Jun',
  '07': 'Jul', '08': 'Agu', '09': 'Sep', '10': 'Okt', '11': 'Nov', '12': 'Des',
}

const PALETTE = ['#16B3AC', '#3899FE', '#F59E0B', '#DC2626', '#7C3AED', '#0F766E', '#64748B']

/** Puncak musiman contoh untuk membagi total bulanan resmi ke jenis tahunan resmi. */
function seasonWeight(nama: string, month: string): number {
  const n = nama.toLowerCase()
  const m = Number(month)
  if (n.includes('hutan') || n.includes('karhutla') || n.includes('asap')) {
    return [1, 1, 1, 2, 3, 4, 6, 6, 4, 2, 1, 1][m - 1] || 1
  }
  if (n.includes('banjir') || n.includes('longsor') || n.includes('puting') || n.includes('angin')) {
    return [5, 4, 3, 2, 2, 1, 1, 2, 3, 3, 4, 5][m - 1] || 1
  }
  if (n.includes('kekeringan')) {
    return [1, 1, 1, 2, 3, 5, 6, 5, 3, 2, 1, 1][m - 1] || 1
  }
  return 1
}

export function jenisTrendSeries(raw: any, filter: PuskrisUiFilter): {
  rows: Record<string, string | number>[]
  keys: string[]
  colors: Record<string, string>
  catatan: string
  contoh: boolean
  nasionalOnly: boolean
} {
  const official = (raw?.eoc?.jenis_2026 || []) as { nama: string; jumlah: number }[]
  const bulanan = (raw?.eoc?.bulanan_2026 || []) as { bulan: string; kejadian: number }[]
  const annualTotal = official.reduce((a, j) => a + Number(j.jumlah || 0), 0) || 1
  let jenis = official.map((j) => ({ nama: j.nama, share: Number(j.jumlah || 0) / annualTotal }))
  if (filter.jenis) {
    const hit = jenis.find((j) => j.nama === filter.jenis)
    jenis = hit ? [hit, { nama: 'Jenis lain', share: Math.max(0, 1 - hit.share) }] : jenis
  } else {
    const top = jenis.slice(0, 6)
    const rest = jenis.slice(6).reduce((a, j) => a + j.share, 0)
    if (rest > 0) top.push({ nama: 'Lainnya', share: rest })
    jenis = top
  }
  const keys = jenis.map((j) => j.nama)
  const colors: Record<string, string> = {}
  keys.forEach((k, i) => { colors[k] = PALETTE[i % PALETTE.length] })

  const rows = bulanan.map((b) => {
    const ym = String(b.bulan || '')
    const month = ym.slice(5, 7)
    const total = Number(b.kejadian || 0)
    const rawW = jenis.map((j) => j.share * seasonWeight(j.nama, month))
    const sumW = rawW.reduce((a, n) => a + n, 0) || 1
    const out: Record<string, string | number> = {
      bulan: ym,
      label: MONTH_LABEL[month] ? `${MONTH_LABEL[month]} ${ym.slice(0, 4)}` : ym,
    }
    let used = 0
    keys.forEach((k, i) => {
      const v = i === keys.length - 1 ? Math.max(0, total - used) : Math.round((total * rawW[i]) / sumW)
      out[k] = v
      used += i === keys.length - 1 ? 0 : v
    })
    return out
  })

  return {
    rows,
    keys,
    colors,
    contoh: true,
    nasionalOnly: Boolean(filter.provinsi || filter.kabupaten),
    catatan: `Sebaran per jenis per bulan memakai ${CONTOH_LABEL}, disusun dari total bulanan resmi dan porsi tahunan per jenis. Rincian resmi per jenis per bulan belum tersedia.`,
  }
}

const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0') + ':00')
const HOUR_CURVE = [1, 1, 1, 1, 2, 3, 5, 8, 10, 12, 11, 10, 12, 14, 16, 15, 13, 10, 8, 6, 4, 3, 2, 1]

export function busyHourSeries(raw: any, nccDays: { date: string; cof: number; acd?: number; available?: boolean }[], filter: PuskrisUiFilter): {
  rows: { jam: string; 'Panggilan masuk': number; 'Panggilan terjawab': number }[]
  catatan: string
  contoh: boolean
  nasionalOnly: boolean
} {
  const days = (nccDays || []).filter((d) => d.available !== false)
  const busiest = raw?.ncc?.busiest_interval || null
  const hours = HOURS.map((jam) => ({ jam, cof: 0, acd: 0 }))
  const sumW = HOUR_CURVE.reduce((a, n) => a + n, 0) || 1
  for (const d of days) {
    const total = Number(d.cof || 0)
    const answered = Number(d.acd || 0)
    let weights = HOUR_CURVE.slice()
    if (busiest?.date === d.date && typeof busiest.time === 'string') {
      const h = Number(String(busiest.time).slice(0, 2))
      if (h >= 0 && h < 24 && busiest.cof != null) {
        const rest = Math.max(0, total - Number(busiest.cof))
        const restW = sumW - weights[h] || 1
        weights = weights.map((w, i) => (i === h ? 0 : w))
        hours[h].cof += Number(busiest.cof)
        hours[h].acd += answered * (Number(busiest.cof) / (total || 1))
        hours.forEach((row, i) => {
          if (i === h) return
          row.cof += (rest * HOUR_CURVE[i]) / restW
          row.acd += answered * (rest / (total || 1)) * (HOUR_CURVE[i] / restW)
        })
        continue
      }
    }
    hours.forEach((row, i) => {
      row.cof += (total * HOUR_CURVE[i]) / sumW
      row.acd += (answered * HOUR_CURVE[i]) / sumW
    })
  }
  return {
    rows: hours.map((r) => ({
      jam: r.jam,
      'Panggilan masuk': Math.round(r.cof),
      'Panggilan terjawab': Math.round(r.acd),
    })),
    contoh: true,
    nasionalOnly: Boolean(filter.provinsi || filter.kabupaten),
    catatan: `Pembagian per jam memakai ${CONTOH_LABEL}, disusun dari total harian resmi dan jam tersibuk yang tercatat. Rincian interval 30 menit asli belum ada di berkas statis.`,
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
