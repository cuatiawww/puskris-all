// Pilihan Filter Dasbor per halaman, diambil dari data API yang sudah dimuat (bukan daftar tetap).
import type { FilterOptions } from '@/components/puskris/PuskrisFilterPanel'
import type { PuskrisTab, PuskrisUiFilter } from './ui-filter'
import { tahunIni } from './ui-filter'
import { isHidrometJenis } from './jenis-meta'

const uniq = (xs: string[]) => Array.from(new Set(xs.map((x) => String(x || '').trim()).filter((x) => x && x !== '-'))).sort((a, b) => a.localeCompare(b, 'id'))
const cap = (s: string) => String(s || '').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/^Kab\.?\s+/i, 'Kab. ')

/** Tahun yang tersedia dari API EOC (tren tahunan berisi data) + tahun berjalan. */
export function tahunTersedia(raw: any): number[] {
  const y = tahunIni()
  const tr: any[] = raw?.eoc?.nasional?.tren_5_tahun_terpantau || []
  const ys = new Set<number>([y, ...tr.filter((t) => Number(t.jumlah) > 0).map((t) => Number(t.tahun))])
  return Array.from(ys).filter((n) => n > 2000).sort((a, b) => b - a)
}

export function buildFilterOptions(raw: any, f: PuskrisUiFilter, page: PuskrisTab, bagian: string | null, jenis: string[]): FilterOptions {
  const provinces = (raw?.regions || []).map((r: any) => ({ code: String(r.code), nama: r.name || r.nama }))
  const prov = f.provinsi
  // Kab/kota kejadian dari event EOC yang sudah dimuat untuk provinsi pada draf filter.
  let kab: string[] = prov ? uniq(((raw?.eoc?.events || []) as any[]).filter((e) => e.p === prov).map((e) => e.bn)) : []
  const catatan: string[] = []
  if (page === 'layanan') {
    kab = prov ? uniq((raw?.psc?.peta?.psc || []).filter((p: any) => p.p === prov).map((p: any) => p.kab)) : []
    if (!bagian || bagian === 'panggilan-119') catatan.push('Panggilan 119 (NCC) hanya nasional: filter provinsi tidak mengubah angka NCC.')
    catatan.push('Hitungan panggilan PSC 119 hanya per tahun berjalan; data master PSC/ambulans adalah kondisi terkini (tidak mengikuti periode).')
  } else if (page === 'kesiapsiagaan') {
    const p = prov ? (raw?.tck?.provinsi || []).find((x: any) => String(x.code) === prov) : null
    kab = p?.kab ? uniq(p.kab.map((k: any) => cap(k.nama))) : []
    catatan.push('Tenaga cadangan individu & profesi adalah jumlah terdaftar terkini; tim/EMT disaring per tahun pembentukan.')
    catatan.push('Stok logistik adalah posisi terkini per gudang regional (tidak mengikuti periode).')
  } else if (page === 'asistensi') {
    kab = prov ? uniq((raw?.asistensi?.wilayah_kabkota || []).filter((k: any) => String(k.kd_prop) === prov).map((k: any) => k.nama)) : []
    catatan.push(`Asistensi Risiko adalah rekapitulasi tahun ${raw?.asistensi?.tahun || tahunIni()} (tidak mengikuti periode harian/bulanan).`)
  } else if (page === 'ringkasan') {
    catatan.push('Kejadian (EOC) dan NCC mengikuti periode; PSC panggilan per tahun; stok logistik, TCK, dan Asistensi adalah posisi terkini.')
  } else if (page === 'hidrometeorologi') {
    kab = prov ? uniq(((raw?.eoc?.events || []) as any[]).filter((e) => e.p === prov && isHidrometJenis(e.n)).map((e) => e.bn)) : []
    catatan.push('Halaman ini hanya menampilkan kejadian hidrometeorologi dari API EOC.')
    catatan.push('PSC, TCK, dan stok logistik adalah kapasitas berdiri di provinsi terdampak, bukan penugasan per jenis.')
    catatan.push('Curah hujan dan peringatan dini BMKG belum tersedia di dasbor ini.')
  }
  const L = raw?.logistik || {}
  const regional = (L.regional || []).map((r: any) => ({ value: String(r.id), label: r.nama }))
  const kategori = (L.kategori_rekap || []).map((k: any) => ({ value: k.key, label: k.nama }))
  const tp = prov ? (raw?.tck?.provinsi || []).find((x: any) => String(x.code) === prov) : null
  const profesi = (tp?.profesi ? Object.keys(tp.profesi) : (raw?.tck?.profesi || []).map((x: any) => x.nama)).map((n: string) => ({ value: n, label: n }))
  const status = page === 'asistensi'
    ? ['Tinggi', 'Sedang', 'Rendah', 'Belum Mengisi'].filter((s) => raw?.asistensi?.provinsi?.status_kapasitas?.[s] != null || raw?.asistensi?.kabupaten_kota?.status_kapasitas?.[s] != null).map((s) => ({ value: s, label: s }))
    : [{ value: 'aktif', label: 'PSC aktif' }, { value: 'siap', label: 'Ambulans siap (aktif & baik)' }]
  return { provinces, kab, jenis, years: tahunTersedia(raw), regional, kategori, profesi, status, catatan }
}
