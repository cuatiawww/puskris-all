import { CONTOH_LABEL } from '@/lib/puskris/integrasi'
import { jenisCategory } from '@/lib/puskris/jenis-meta'
import { monthLabel } from '@/lib/puskris/to-spasial'
import type { ProvinceRow } from '@/lib/puskris/types'
import { NCC_LABEL } from '@/lib/puskris/labels'

export type HeatCell = { value: number | null; contoh?: boolean }
export type HeatRow = { id: string; name: string; cells: HeatCell[]; total: number }
export type HeatView = {
  id: string
  title: string
  rowLabel: string
  unit: string
  desc: string
  cols: { id: string; label: string; title?: string }[]
  rows: HeatRow[]
  contoh: boolean
  scale: 'count' | 'gap'
}

const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function monthKeys(raw: any): string[] {
  const official = (raw?.eoc?.bulanan_2026 || []).map((b: any) => String(b.bulan))
  if (official.length) return official
  return Array.from({ length: 11 }, (_, i) => `2026-${String(i + 1).padStart(2, '0')}`)
}

function monthShort(ym: string) {
  const m = Number(String(ym).slice(5, 7))
  const lab = MONTHS_ID[m - 1] || ym
  return `${lab} ${String(ym).slice(2, 4)}`
}

export const HEAT_OPTIONS: { id: string; label: string }[] = [
  { id: 'prov-bulan', label: 'Provinsi × Bulan — jumlah kejadian krisis' },
  { id: 'prov-jenis', label: 'Provinsi × Jenis kejadian' },
  { id: 'hari-jam', label: 'Hari × Jam (30 menit) — panggilan masuk 119' },
  { id: 'prov-pilar', label: 'Provinsi × Pilar kesiapsiagaan (kesenjangan)' },
  { id: 'reg-logistik', label: 'Regional × Kategori logistik — stok' },
]

const SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2)
  const m = i % 2 ? '30' : '00'
  return `${String(h).padStart(2, '0')}:${m}`
})

/** Pola harian contoh: sepi malam, naik pagi, puncak siang–sore. */
function slotWeight(i: number) {
  const curve = [1, 1, 1, 1, 2, 3, 5, 8, 10, 12, 11, 10, 12, 14, 16, 15, 13, 10, 8, 6, 4, 3, 2, 1]
  return curve[Math.floor(i / 2)] || 1
}

function distributeDay(total: number, date: string, busiest?: { date?: string; time?: string; cof?: number } | null) {
  const weights = SLOTS.map((_, i) => slotWeight(i))
  const sumW = weights.reduce((a, b) => a + b, 0) || 1
  let vals = weights.map((w) => (total * w) / sumW)
  if (busiest?.date === date && busiest.time && busiest.cof != null) {
    const idx = SLOTS.indexOf(busiest.time)
    if (idx >= 0 && busiest.cof <= total) {
      const rest = total - busiest.cof
      const restW = sumW - weights[idx] || 1
      vals = weights.map((w, i) => (i === idx ? busiest.cof : (rest * w) / restW))
    }
  }
  return vals.map((v) => Math.round(v))
}

function addRow(map: Map<string, HeatRow>, id: string, name: string, colCount: number) {
  let row = map.get(id)
  if (!row) {
    row = { id, name, cells: Array.from({ length: colCount }, () => ({ value: 0 })), total: 0 }
    map.set(id, row)
  }
  return row
}

export function buildHeatView(
  id: string,
  opts: {
    raw: any
    rows: ProvinceRow[]
    kejadian: any[]
    nccDays: { date: string; cof: number; available?: boolean }[]
    filterProvinsi?: string | null
  },
): HeatView {
  const { raw, rows, kejadian, nccDays, filterProvinsi } = opts
  const nameOf = (code: string) => rows.find((r) => r.code === code)?.nama || raw.regions?.find((r: any) => r.code === code)?.name || code
  const scopedRows = filterProvinsi ? rows.filter((r) => r.code === filterProvinsi) : rows

  if (id === 'prov-bulan') {
    const cols = monthKeys(raw).map((ym) => ({ id: ym, label: monthShort(ym), title: monthLabel(ym) }))
    const map = new Map<string, HeatRow>()
    for (const k of kejadian || []) {
      const code = String(k.code || '')
      if (!code) continue
      const row = addRow(map, code, k.provinsi || nameOf(code), cols.length)
      const mi = cols.findIndex((c) => c.id === String(k.tanggal || '').slice(0, 7))
      if (mi >= 0) {
        row.cells[mi].value = (row.cells[mi].value || 0) + 1
        row.total += 1
      }
    }
    const list = (filterProvinsi ? scopedRows.map((r) => map.get(r.code) || addRow(map, r.code, r.nama, cols.length)) : [...map.values()])
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'id'))
    return {
      id, title: 'Provinsi × Bulan', rowLabel: 'Provinsi', unit: 'kejadian krisis', scale: 'count',
      contoh: false,
      desc: 'Jumlah kejadian krisis dari daftar marker terbaru, mengikuti filter. Angka resmi tahunan/bulanan nasional tidak pecah per provinsi, jadi sel ini memakai jejak kejadian (banyak sel bisa 0).',
      cols, rows: list,
    }
  }

  if (id === 'prov-jenis') {
    const names = new Set<string>()
    for (const x of raw?.eoc?.jenis_2026 || []) names.add(x.nama)
    for (const k of kejadian || []) if (k.jenis) names.add(String(k.jenis))
    const cols = [...names].sort((a, b) => a.localeCompare(b, 'id')).map((nama) => ({ id: nama, label: nama, title: `${nama} · ${jenisCategory(nama)}` }))
    const map = new Map<string, HeatRow>()
    for (const k of kejadian || []) {
      const code = String(k.code || '')
      if (!code) continue
      const row = addRow(map, code, k.provinsi || nameOf(code), cols.length)
      const mi = cols.findIndex((c) => c.id === String(k.jenis))
      if (mi >= 0) {
        row.cells[mi].value = (row.cells[mi].value || 0) + 1
        row.total += 1
      }
    }
    const list = (filterProvinsi ? scopedRows.map((r) => map.get(r.code) || addRow(map, r.code, r.nama, cols.length)) : [...map.values()])
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'id'))
    return {
      id, title: 'Provinsi × Jenis kejadian', rowLabel: 'Provinsi', unit: 'kejadian krisis', scale: 'count',
      contoh: false,
      desc: 'Sebaran jenis kejadian dari daftar marker terbaru, mengikuti filter. Jenis resmi tahunan yang belum punya jejak di daftar tetap tampil sebagai kolom kosong.',
      cols, rows: list,
    }
  }

  if (id === 'hari-jam') {
    const days = (nccDays || []).filter((d) => d.available !== false)
    const busiest = raw?.ncc?.busiest_interval || null
    const cols = SLOTS.map((t) => ({ id: t, label: t.endsWith(':00') ? t.slice(0, 2) : '', title: t }))
    const list: HeatRow[] = days.map((d) => {
      const vals = distributeDay(Number(d.cof || 0), d.date, busiest)
      return {
        id: d.date,
        name: d.date.slice(8, 10) + '/' + d.date.slice(5, 7),
        cells: vals.map((v) => ({ value: v, contoh: true })),
        total: vals.reduce((a, b) => a + b, 0),
      }
    })
    return {
      id, title: 'Hari × Jam (interval 30 menit)', rowLabel: 'Hari', unit: NCC_LABEL.cof, scale: 'count',
      contoh: true,
      desc: `Menunjukkan jam sibuk layanan 119. Pembagian per 30 menit memakai ${CONTOH_LABEL}, disusun dari total harian resmi dan jam tersibuk yang tercatat. Rincian interval asli belum ada di berkas statis. Filter provinsi tidak memecah angka ini (bersifat nasional).`,
      cols, rows: list,
    }
  }

  if (id === 'prov-pilar') {
    const cols = [
      { id: 'psc', label: 'PSC aktif', title: 'Pusat pelayanan 119 yang aktif' },
      { id: 'ambulans', label: 'Ambulans layak', title: 'Ambulans dalam kondisi baik' },
      { id: 'tck', label: 'Tenaga Cadangan', title: 'Individu tenaga cadangan kesehatan' },
      { id: 'logistik', label: 'Logistik', title: 'Stok gudang regional (hanya 11 regional)' },
      { id: 'asistensi', label: 'Asistensi', title: 'Poin kapasitas Asistensi Risiko' },
    ]
    const src = scopedRows.length ? scopedRows : rows
    const maxOf = (fn: (r: ProvinceRow) => number | null | undefined) => Math.max(1, ...src.map((r) => Number(fn(r) || 0)))
    const max = {
      psc: maxOf((r) => r.pscAktif),
      ambulans: maxOf((r) => r.ambulansBaik),
      tck: maxOf((r) => r.tck),
      logistik: maxOf((r) => r.stok),
      asistensi: maxOf((r) => r.asistensiPct),
    }
    const has = {
      logistik: (r: ProvinceRow) => r.stok != null && r.stok !== undefined,
      asistensi: (r: ProvinceRow) => r.asistensiPct != null && r.asistensiPct !== undefined,
    }
    const gap = (value: number, maxV: number) => Math.round((1 - value / maxV) * 100)
    const list: HeatRow[] = src.map((r) => {
      const cells: HeatCell[] = [
        { value: gap(r.pscAktif || 0, max.psc) },
        { value: gap(r.ambulansBaik || 0, max.ambulans) },
        { value: gap(r.tck || 0, max.tck) },
        has.logistik(r) ? { value: gap(Number(r.stok) || 0, max.logistik) } : { value: null },
        has.asistensi(r) ? { value: gap(Number(r.asistensiPct) || 0, max.asistensi), contoh: true } : { value: null },
      ]
      const known = cells.filter((c) => c.value != null).map((c) => c.value as number)
      return { id: r.code, name: r.nama, cells, total: known.length ? Math.round(known.reduce((a, b) => a + b, 0) / known.length) : 0 }
    }).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'id'))
    return {
      id, title: 'Provinsi × Pilar kesiapsiagaan', rowLabel: 'Provinsi', unit: 'kesenjangan (0–100)', scale: 'gap',
      contoh: true,
      desc: `Nilai sel adalah kesenjangan relatif (100 = paling rendah dibanding provinsi lain pada pilar itu). Sel kosong berarti data tidak tersedia. Stok hanya ada di 11 regional; poin Asistensi hanya untuk wilayah contoh — bagian itu ${CONTOH_LABEL}.`,
      cols, rows: list,
    }
  }

  // reg-logistik
  const regionals: any[] = raw?.logistik?.regional || []
  const cols = [
    { id: 'obat', label: 'Obat', title: 'Obat-obatan' },
    { id: 'sarpras', label: 'Sarpras', title: 'Sarana dan prasarana' },
    { id: 'alkes', label: 'Alkes', title: 'Alat kesehatan' },
    { id: 'bmhp', label: 'BMHP', title: 'Bahan medis habis pakai' },
  ]
  const filtered = filterProvinsi ? regionals.filter((r) => r.code === filterProvinsi) : regionals
  const list: HeatRow[] = (filtered.length ? filtered : regionals).map((r) => {
    const cells = cols.map((c) => ({ value: Number(r[c.id] || 0) }))
    return { id: r.code || r.nama, name: r.nama, cells, total: Number(r.total || cells.reduce((a, c) => a + (c.value || 0), 0)) }
  })
  return {
    id: 'reg-logistik', title: 'Regional × Kategori logistik', rowLabel: 'Regional', unit: 'stok', scale: 'count',
    contoh: false,
    desc: filterProvinsi && !filtered.length
      ? 'Provinsi yang dipilih bukan salah satu dari 11 gudang regional, jadi matriks menampilkan seluruh regional.'
      : 'Stok resmi landing SIMLOGKES untuk 11 regional, bukan 38 provinsi.',
    cols, rows: list,
  }
}
