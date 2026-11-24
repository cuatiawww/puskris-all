import { eocIconOf } from '@/lib/puskris/eoc-markers'
import { bencanaIconOf } from '@/lib/puskris/bencana-icons'

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function inScope(k: any, opts?: { prov?: string | null; kab?: string | null }) {
  if (opts?.prov && String(k.code || '').padStart(2, '0') !== String(opts.prov).padStart(2, '0')) return false
  if (opts?.kab && k.kab_code && String(k.kab_code).padStart(4, '0') !== String(opts.kab).padStart(4, '0')) return false
  return true
}

function weekKey(iso: string) {
  const d = new Date(`${iso}T00:00:00+07:00`)
  if (Number.isNaN(d.getTime())) return iso
  const onejan = new Date(d.getFullYear(), 0, 1)
  const w = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7)
  return `${d.getFullYear()}-W${String(w).padStart(2, '0')}`
}

export function buildPetaAnalitik(list: any[] | null | undefined, opts?: { prov?: string | null; kab?: string | null; namaProv?: string | null }) {
  const all = (list || []).filter((k) => inScope(k, opts))
  const dates = all.map((k) => String(k.tanggal || '')).filter((t) => /^\d{4}-\d{2}-\d{2}$/.test(t)).sort()
  const spanHari = dates.length >= 2
    ? Math.round((Date.parse(dates[dates.length - 1]) - Date.parse(dates[0])) / 86400000)
    : 0
  const grain: 'minggu' | 'bulan' = spanHari > 0 && spanHari <= 62 ? 'minggu' : 'bulan'
  const trenMap = new Map<string, { key: string; label: string; kejadian: number; krisis: number; meninggal: number; pengungsi: number }>()
  for (const k of all) {
    const t = String(k.tanggal || '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) continue
    const key = grain === 'minggu' ? weekKey(t) : t.slice(0, 7)
    const label = grain === 'minggu' ? key.replace('-W', ' M') : `${BULAN[Number(t.slice(5, 7)) - 1]} ${t.slice(0, 4)}`
    const row = trenMap.get(key) || { key, label, kejadian: 0, krisis: 0, meninggal: 0, pengungsi: 0 }
    row.kejadian += 1
    row.krisis += k.krisis ? 1 : 0
    row.meninggal += Number(k.meninggal || 0)
    row.pengungsi += Number(k.pengungsi || 0)
    trenMap.set(key, row)
  }
  const tren = [...trenMap.values()].sort((a, b) => a.key.localeCompare(b.key))

  const jenisMap = new Map<string, { jenis: string; n: number; color: string; iconSrc?: string }>()
  for (const k of all) {
    const jenis = String(k.jenis || 'Tanpa jenis')
    const row = jenisMap.get(jenis) || { jenis, n: 0, color: eocIconOf(jenis).color, iconSrc: bencanaIconOf(jenis)?.src }
    row.n += 1
    jenisMap.set(jenis, row)
  }
  const jenis = [...jenisMap.values()].sort((a, b) => b.n - a.n)

  const wilMap = new Map<string, { kode: string; nama: string; n: number; krisis: number; meninggal: number }>()
  for (const k of all) {
    const drilled = Boolean(opts?.prov)
    const kode = drilled ? String(k.kab_code || k.kabupaten || '') : String(k.code || '')
    const nama = drilled ? String(k.kabupaten || kode) : String(k.provinsi || kode)
    if (!nama) continue
    const row = wilMap.get(kode || nama) || { kode: kode || nama, nama, n: 0, krisis: 0, meninggal: 0 }
    row.n += 1
    row.krisis += k.krisis ? 1 : 0
    row.meninggal += Number(k.meninggal || 0)
    wilMap.set(kode || nama, row)
  }
  const topWilayah = [...wilMap.values()].sort((a, b) => b.n - a.n).slice(0, 8)

  const korban = {
    kejadian: all.length,
    krisis: all.filter((k) => k.krisis).length,
    meninggal: all.reduce((s, k) => s + Number(k.meninggal || 0), 0),
    hilang: all.reduce((s, k) => s + Number(k.hilang || 0), 0),
    luka_berat: all.reduce((s, k) => s + Number(k.luka_berat || 0), 0),
    luka_ringan: all.reduce((s, k) => s + Number(k.luka_ringan || 0), 0),
    pengungsi: all.reduce((s, k) => s + Number(k.pengungsi || 0), 0),
    terdampak: all.reduce((s, k) => s + Number(k.terdampak || 0), 0),
    faskes_rusak: all.reduce((s, k) => s + Number(k.faskes_rusak || 0), 0),
  }

  return {
    n: all.length,
    grain,
    ruang: opts?.prov ? (opts.namaProv || 'Provinsi terpilih') : 'Nasional',
    tren,
    jenis,
    topWilayah,
    topLevel: opts?.prov ? 'kabupaten/kota' : 'provinsi',
    korban,
  }
}

export type PetaAnalitik = ReturnType<typeof buildPetaAnalitik>