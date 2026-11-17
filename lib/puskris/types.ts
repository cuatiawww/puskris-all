export type Periode = 'tahun' | 'bulan' | '7hari' | '30hari'

export type PuskrisFilter = {
  periode: Periode
  tahun: number
  bulan: number | null
  provinsi: string | null
  kabupaten: string | null
}

export type Freshness = {
  sumber: string
  status: 'langsung' | 'tidak_tersedia'
  at: string
  label: string
  url: string
  filterable: { periode: boolean; provinsi: boolean; kabupaten: boolean }
}

export type MapLayerId =
  | 'kejadian'
  | 'meninggal'
  | 'pengungsi'
  | 'terdampak'
  | 'psc'
  | 'ambulans'
  | 'panggilan'
  | 'tck'
  | 'kesenjangan'

export type ProvinceRow = {
  code: string
  nama: string
  kejadian: number
  krisis: number
  meninggal: number
  pengungsi: number
  terdampak: number
  /** Kumulatif semua tahun (sumber belum merilis rincian 2026 per provinsi). */
  lukaBeratKum: number
  lukaRinganKum: number
  hilangKum: number
  panggilan: number
  pscTotal: number
  pscAktif: number
  ambulans: number
  tck: number
  tckNakes: number
  tckNonNakes: number
  /** Tim & Tim Medis Darurat per provinsi (null bila hanya snapshot nasional) */
  tckTim?: number | null
  tckEmt?: number | null
  tckEmtStandar?: number | null
  ambulansBaik: number
  ambulansRusakRingan: number
  ambulansRusakBerat: number
  ambulansGps: number
  stok: number | null
  asistensiPct: number | null
  beban: number
  kapasitas: number
  kesenjangan: number
  indeksRespons: number
}
