// Arsiran kab/kota saat menelusuri satu provinsi di Peta Terpadu.
// Hanya dari data API yang sudah ada di klien: daftar kejadian EOC (kab_code Kemendagri) untuk variabel
// beban krisis, dan rekap Asistensi kab/kota untuk poin kapasitas. Variabel lain belum punya rincian
// kab/kota dari API → hanya batas kab/kota (isi netral), tanpa angka pengganti.
import type { CatChoro } from '@/components/spasial/SpasialMap'
import { classesFor, classOf, type Metric } from '@/lib/spasial-api'
import type { ChoroConfig } from '@/lib/choropleth-classes'

const EOC_FIELD: Record<string, string | null> = {
  kejadian: null, krisis: 'krisis', meninggal: 'meninggal', pengungsi: 'pengungsi', terdampak: 'terdampak',
  luka_berat: 'luka_berat', luka_ringan: 'luka_ringan', hilang: 'hilang',
}
const nf = (n: number) => new Intl.NumberFormat('id-ID').format(n)
const kode4 = (v: any) => { const d = String(v ?? '').replace(/\D/g, ''); return d.length >= 4 ? d.slice(0, 4) : '' }

/** Kab/kota netral: hanya batas administrasi. */
export function kabNetral(prov: string, label: string, alasan: string): CatChoro {
  return { id: `kab-netral-${prov}`, level: 'kabkota', prov, judul: label, sumber: 'Batas kab/kota', items: {}, legend: [], catatan: alasan, kosong: 'batas kab/kota (variabel ini belum tersedia per kab/kota)' }
}

export function buildKabNumeric(opts: {
  prov: string
  choro: string
  label: string
  metric: Metric
  cfg: ChoroConfig | null
  /** kejadian EOC (semua, periode & filter terpakai); null bila tidak tersedia */
  kejadianSemua: any[] | null
  /** kejadian berdampak krisis (selalu ada bila EOC hidup) */
  kejadianKrisis: any[]
  raw: any
}): CatChoro {
  const { prov, choro, label, metric, cfg } = opts
  const val: Record<string, { v: number; nama: string }> = {}
  let sumber = ''
  if (choro in EOC_FIELD) {
    const list = (choro === 'krisis' || !opts.kejadianSemua ? opts.kejadianKrisis : opts.kejadianSemua) || []
    if (choro === 'kejadian' && !opts.kejadianSemua) return kabNetral(prov, label, 'Rincian kejadian per kab/kota belum tersedia dari API EOC untuk periode ini.')
    const field = EOC_FIELD[choro]
    for (const k of list) {
      if (String(k.code) !== prov) continue
      const c = kode4(k.kab_code)
      if (!c) continue
      val[c] ||= { v: 0, nama: k.kabupaten || c }
      val[c].v += field === null ? 1 : field === 'krisis' ? (k.krisis ? 1 : 0) : Number(k[field] || 0)
    }
    sumber = 'API EOC (kejadian per kab/kota)'
  } else if (choro === 'asistensi') {
    for (const r of opts.raw?.asistensi?.wilayah_kabkota || []) {
      if (String(r.kd_prop).padStart(2, '0') !== prov || typeof r.poin_kapasitas_pct !== 'number') continue
      val[String(r.kode_wilayah).padStart(4, '0')] = { v: r.poin_kapasitas_pct, nama: r.nama }
    }
    if (!Object.keys(val).length) return kabNetral(prov, label, 'Data Asistensi kab/kota belum tersedia dari API.')
    sumber = 'API Asistensi (kab/kota)'
  } else {
    return kabNetral(prov, label, `${label} belum tersedia per kab/kota dari API; hanya batas kab/kota.`)
  }
  const cls = classesFor(metric, Object.values(val).map((x) => x.v), cfg)
  const items: CatChoro['items'] = {}
  const n: Record<string, number> = {}
  for (const [c, x] of Object.entries(val)) {
    const k = classOf(x.v, cls, metric)
    n[k.label] = (n[k.label] || 0) + 1
    items[c] = { color: k.color, title: `${label}: ${nf(x.v)}`, details: [{ label, value: nf(x.v) }] }
  }
  const legend = cls.filter((c) => n[c.label]).map((c) => ({ label: c.label, color: c.color, n: n[c.label] }))
  return {
    id: `kab-${choro}-${prov}`, level: 'kabkota', prov, judul: label, sumber, items, legend,
    catatan: choro in EOC_FIELD ? 'Kab/kota tanpa kejadian tercatat berwarna abu-abu.' : 'Kab/kota tanpa data berwarna abu-abu.',
    kosong: choro in EOC_FIELD ? 'tidak ada kejadian tercatat' : 'tidak ada data dari API',
  }
}
