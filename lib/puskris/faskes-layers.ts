import type { ExtraPoint, ExtraPointLayer } from '@/lib/puskris/internal-layers'

export type FaskesJenis = 'rs' | 'puskesmas'

export type FaskesAgregat = {
  kode: string
  nama: string
  level: 'provinsi' | 'kabupaten'
  lat: number | null
  lon: number | null
  rs: number
  puskesmas: number
}

export type FaskesTitik = {
  id: string
  nama: string
  jenis: FaskesJenis
  subjenis: string
  prov: string
  kab: string
  kode_prov: string
  kode_kab: string
  alamat: string
  lat: number
  lon: number
}

export const FASKES_RS_COLOR = '#b91c1c'
export const FASKES_PUSKESMAS_COLOR = '#1d4ed8'
const SRC = 'API Dashboard Faskes (Pusat Krisis Kesehatan)'

const nf = (n: number) => Number(n || 0).toLocaleString('id-ID')

export type FaskesToggles = { rs: boolean; puskesmas: boolean }
export const DEFAULT_FASKES: FaskesToggles = { rs: false, puskesmas: false }

function titikToPoint(t: FaskesTitik): ExtraPoint {
  const rs = t.jenis === 'rs'
  const color = rs ? FASKES_RS_COLOR : FASKES_PUSKESMAS_COLOR
  return {
    lat: t.lat,
    lon: t.lon,
    color,
    radius: 7,
    title: t.nama,
    subtitle: [t.kab, t.prov].filter(Boolean).join(' · '),
    badgeText: rs ? 'RUMAH SAKIT' : 'PUSKESMAS',
    badgeColor: color,
    source: SRC,
    details: [
      { label: 'Jenis', value: t.subjenis || (rs ? 'Rumah Sakit' : 'Puskesmas') },
      { label: 'Kab/Kota', value: t.kab || '–' },
      { label: 'Provinsi', value: t.prov || '–' },
      { label: 'Alamat', value: t.alamat || 'Data belum tersedia dari API' },
    ],
  }
}

function agregatToPoint(a: FaskesAgregat, jenis: FaskesJenis, offsetLon: number): ExtraPoint | null {
  if (a.lat == null || a.lon == null) return null
  const rs = jenis === 'rs'
  const n = rs ? a.rs : a.puskesmas
  const color = rs ? FASKES_RS_COLOR : FASKES_PUSKESMAS_COLOR
  return {
    lat: a.lat,
    lon: a.lon + offsetLon,
    color,
    radius: 8,
    title: a.nama,
    subtitle: a.level === 'kabupaten' ? 'Kab/Kota' : 'Provinsi',
    badgeText: rs ? `${nf(n)} RS` : `${nf(n)} Puskesmas`,
    badgeColor: color,
    source: SRC,
    weight: n,
    label: nf(n),
    details: [
      { label: 'Rumah Sakit', value: nf(a.rs) },
      { label: 'Puskesmas', value: nf(a.puskesmas) },
      { label: 'Keterangan', value: 'Jumlah agregat wilayah. Titik fasilitas muncul setelah data titik selesai dimuat, atau saat wilayah dipilih.' },
    ],
  }
}

export function buildFaskesLayers(opts: {
  toggles: FaskesToggles
  agregat: FaskesAgregat[]
  titikRs: FaskesTitik[]
  titikPuskesmas: FaskesTitik[]
  titikRsReady: boolean
  titikPuskesmasReady: boolean
}): ExtraPointLayer[] {
  const layers: ExtraPointLayer[] = []
  if (opts.toggles.rs) {
    const useTitik = opts.titikRsReady && opts.titikRs.length > 0
    const points = useTitik
      ? opts.titikRs.map(titikToPoint)
      : opts.agregat.map((a) => agregatToPoint(a, 'rs', -0.12)).filter(Boolean) as ExtraPoint[]
    layers.push({
      id: 'faskes-rs',
      visible: points.length > 0,
      cluster: useTitik,
      color: FASKES_RS_COLOR,
      unit: 'RS',
      sumWeight: !useTitik,
      zIndex: 46,
      icon: 'rs',
      points,
      legend: [{ color: FASKES_RS_COLOR, label: useTitik ? 'Rumah Sakit' : 'Rumah Sakit (jumlah per wilayah)' }],
    })
  }
  if (opts.toggles.puskesmas) {
    const useTitik = opts.titikPuskesmasReady && opts.titikPuskesmas.length > 0
    const points = useTitik
      ? opts.titikPuskesmas.map(titikToPoint)
      : opts.agregat.map((a) => agregatToPoint(a, 'puskesmas', 0.12)).filter(Boolean) as ExtraPoint[]
    layers.push({
      id: 'faskes-puskesmas',
      visible: points.length > 0,
      cluster: useTitik,
      color: FASKES_PUSKESMAS_COLOR,
      unit: 'Puskesmas',
      sumWeight: !useTitik,
      zIndex: 45,
      icon: 'puskesmas',
      points,
      legend: [{ color: FASKES_PUSKESMAS_COLOR, label: useTitik ? 'Puskesmas' : 'Puskesmas (jumlah per wilayah)' }],
    })
  }
  return layers
}

export function faskesAgregatByKode(list: FaskesAgregat[]): Map<string, FaskesAgregat> {
  const m = new Map<string, FaskesAgregat>()
  for (const a of list) {
    m.set(a.kode, a)
    const digits = String(a.kode).replace(/\D/g, '')
    if (digits && digits !== a.kode) m.set(digits, a)
  }
  return m
}
