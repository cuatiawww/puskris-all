import type { Periode, PuskrisFilter } from './types'

export type Pilar = 'semua' | 'krisis' | 'layanan' | 'kesiapsiagaan'
export type PuskrisTab = 'ringkasan' | 'krisis' | 'layanan' | 'kesiapsiagaan' | 'asistensi' | 'analisis'

export type PuskrisUiFilter = PuskrisFilter & {
  pilar: Pilar
  jenis: string | null
}

export const defaultUiFilter = (): PuskrisUiFilter => ({
  periode: 'tahun',
  tahun: 2026,
  bulan: null,
  provinsi: null,
  kabupaten: null,
  pilar: 'semua',
  jenis: null,
})

export function toDeriveFilter(f: PuskrisUiFilter): PuskrisFilter {
  return {
    periode: f.periode as Periode,
    tahun: f.tahun,
    bulan: f.bulan,
    provinsi: f.provinsi,
    kabupaten: f.kabupaten,
  }
}

export function activeFilterCount(f: PuskrisUiFilter): number {
  let n = 0
  if (f.pilar && f.pilar !== 'semua') n++
  if (f.periode && f.periode !== 'tahun') n++
  if (f.provinsi) n++
  if (f.kabupaten) n++
  if (f.jenis) n++
  return n
}

export const PUSKRIS_PAGES: { key: PuskrisTab; label: string; eyebrow: string; title: string; desc: string }[] = [
  {
    key: 'ringkasan',
    label: 'Ringkasan Utama',
    eyebrow: 'Dasbor Pusat Krisis Kesehatan',
    title: 'Ringkasan Eksekutif Krisis Kesehatan',
    desc: 'Gambaran nasional yang menyatukan pantauan bencana, layanan 119, tenaga cadangan, logistik, dan asesmen risiko.',
  },
  {
    key: 'krisis',
    label: 'Situasi Krisis',
    eyebrow: 'Dasbor Pusat Krisis Kesehatan',
    title: 'Situasi Krisis Kesehatan',
    desc: 'Kejadian terpantau, berdampak krisis, korban, pengungsi, dan penduduk terdampak.',
  },
  {
    key: 'layanan',
    label: 'Layanan Gawat Darurat',
    eyebrow: 'Dasbor Pusat Krisis Kesehatan',
    title: 'Layanan Gawat Darurat',
    desc: 'Panggilan 119, tingkat keberhasilan layanan, PSC aktif, dan armada ambulans.',
  },
  {
    key: 'kesiapsiagaan',
    label: 'Kesiapsiagaan',
    eyebrow: 'Dasbor Pusat Krisis Kesehatan',
    title: 'Kesiapsiagaan SDM dan Logistik',
    desc: 'Tenaga cadangan kesehatan, tim, Tim Medis Darurat (EMT), dan stok logistik regional.',
  },
  {
    key: 'asistensi',
    label: 'Asistensi Risiko',
    eyebrow: 'Dasbor Pusat Krisis Kesehatan',
    title: 'Asistensi Risiko',
    desc: 'Cakupan pengisian asesmen risiko di tingkat provinsi dan kabupaten/kota.',
  },
  {
    key: 'analisis',
    label: 'Analisis',
    eyebrow: 'Dasbor Pusat Krisis Kesehatan',
    title: 'Analisis Krisis Kesehatan',
    desc: 'Heatmap, indeks kesenjangan respons, dan perbandingan tren antar-pilar.',
  },
]
