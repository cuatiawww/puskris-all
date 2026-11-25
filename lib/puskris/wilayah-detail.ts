/* eslint-disable @typescript-eslint/no-explicit-any */
import { eocKejadian, rekapKejadian } from '@/lib/puskris/derive'
import { kodeKab4, risikoWilayah } from '@/lib/puskris/kejadian-detail'

export type WilayahLevel = 'provinsi' | 'kabupaten'

export type WilayahKode = {
  level: WilayahLevel
  prov: string
  kab: string | null
  valid: boolean
}

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

export function parseWilayahKode(kode: string | null | undefined): WilayahKode {
  const d = String(kode || '').replace(/\D/g, '')
  if (d.length >= 3) {
    const kab = d.padStart(4, '0').slice(0, 4)
    return { level: 'kabupaten', prov: kab.slice(0, 2), kab, valid: kab.length === 4 }
  }
  if (d.length >= 1) {
    return { level: 'provinsi', prov: d.padStart(2, '0').slice(0, 2), kab: null, valid: true }
  }
  return { level: 'provinsi', prov: '', kab: null, valid: false }
}

export function padProv(code: unknown): string {
  return String(code || '').replace(/\D/g, '').padStart(2, '0').slice(0, 2)
}

function bulanOf(tanggal?: string | null): number | null {
  const m = Number(String(tanggal || '').slice(5, 7))
  return m >= 1 && m <= 12 ? m : null
}

export function eventsInWilayah(raw: any, kode: string, regionName: Record<string, string>) {
  const w = parseWilayahKode(kode)
  const list = (raw?.eoc?.events || [])
    .map((e: any) => eocKejadian(e, regionName))
    .filter((k: any) => {
      if (padProv(k.code) !== w.prov) return false
      if (w.kab) return kodeKab4(k.kab_code) === w.kab
      return true
    })
    .sort((a: any, b: any) => String(b.tanggal || '').localeCompare(String(a.tanggal || '')) || String(b.uid).localeCompare(String(a.uid)))
  return { ...w, list }
}

export function namaWilayah(raw: any, w: WilayahKode, list: any[]): { nama: string; provinsi: string; kabupaten: string | null } {
  const regions: any[] = raw?.regions || []
  const provinsi = regions.find((r) => padProv(r.code) === w.prov)?.name
    || list.find((k) => k.provinsi && padProv(k.code) === w.prov)?.provinsi
    || (w.prov ? `Provinsi ${w.prov}` : 'Wilayah')
  if (w.level === 'kabupaten' && w.kab) {
    const kabupaten = list.find((k) => kodeKab4(k.kab_code) === w.kab)?.kabupaten
      || `Kab/Kota ${w.kab}`
    return { nama: `${kabupaten}, ${provinsi}`, provinsi, kabupaten }
  }
  return { nama: provinsi, provinsi, kabupaten: null }
}

export function filterWilayahList(list: any[], jenis?: string | null) {
  if (!jenis) return list
  return list.filter((k) => String(k.jenis || '') === jenis)
}

export function jenisOptions(list: any[]): { id: string; n: number }[] {
  const map = new Map<string, number>()
  for (const k of list) {
    const j = String(k.jenis || 'Tanpa jenis')
    map.set(j, (map.get(j) || 0) + 1)
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'id')).map(([id, n]) => ({ id, n }))
}

export function trendBulanan(list: any[]) {
  return BULAN.map((label, i) => {
    const items = list.filter((k) => bulanOf(k.tanggal) === i + 1)
    return {
      bulan: label,
      m: i + 1,
      kejadian: items.length,
      krisis: items.filter((k) => k.krisis).length,
      meninggal: items.reduce((s, k) => s + Number(k.meninggal || 0), 0),
      pengungsi: items.reduce((s, k) => s + Number(k.pengungsi || 0), 0),
      terdampak: items.reduce((s, k) => s + Number(k.terdampak || 0), 0),
    }
  })
}

export function heatmapJenisBulan(list: any[]) {
  const count = new Map<string, number>()
  const cells: Record<string, number> = {}
  let max = 0
  for (const k of list) {
    const j = String(k.jenis || 'Tanpa jenis')
    const m = bulanOf(k.tanggal)
    count.set(j, (count.get(j) || 0) + 1)
    if (!m) continue
    const key = `${j}|${m}`
    const n = (cells[key] || 0) + 1
    cells[key] = n
    if (n > max) max = n
  }
  const jenis = [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'id')).map(([id]) => id)
  return { jenis, months: BULAN, cells, max, totalJenis: jenis.length }
}

export function breakdownJenis(list: any[]) {
  const map = new Map<string, any>()
  for (const k of list) {
    const id = String(k.jenis || 'Tanpa jenis')
    const row = map.get(id) || { jenis: id, kejadian: 0, krisis: 0, meninggal: 0, luka: 0, pengungsi: 0, terdampak: 0, faskes_rusak: 0 }
    row.kejadian += 1
    if (k.krisis) row.krisis += 1
    row.meninggal += Number(k.meninggal || 0)
    row.luka += Number(k.luka_berat || 0) + Number(k.luka_ringan || 0)
    row.pengungsi += Number(k.pengungsi || 0)
    row.terdampak += Number(k.terdampak || 0)
    row.faskes_rusak += Number(k.faskes_rusak || 0)
    map.set(id, row)
  }
  return [...map.values()].sort((a, b) => b.kejadian - a.kejadian || a.jenis.localeCompare(b.jenis, 'id'))
}

export function breakdownKab(list: any[]) {
  const map = new Map<string, any>()
  for (const k of list) {
    const code = kodeKab4(k.kab_code) || String(k.kabupaten || 'Tidak diketahui')
    const row = map.get(code) || {
      code,
      nama: k.kabupaten || `Kab/Kota ${code}`,
      kejadian: 0,
      krisis: 0,
      meninggal: 0,
      luka: 0,
      pengungsi: 0,
      terdampak: 0,
      faskes_rusak: 0,
      jenis: new Map<string, number>(),
    }
    if (k.kabupaten) row.nama = k.kabupaten
    row.kejadian += 1
    if (k.krisis) row.krisis += 1
    row.meninggal += Number(k.meninggal || 0)
    row.luka += Number(k.luka_berat || 0) + Number(k.luka_ringan || 0)
    row.pengungsi += Number(k.pengungsi || 0)
    row.terdampak += Number(k.terdampak || 0)
    row.faskes_rusak += Number(k.faskes_rusak || 0)
    const j = String(k.jenis || 'Tanpa jenis')
    row.jenis.set(j, (row.jenis.get(j) || 0) + 1)
    map.set(code, row)
  }
  return [...map.values()]
    .map((r) => {
      const top = [...r.jenis.entries()].sort((a: [string, number], b: [string, number]) => b[1] - a[1])[0]
      return { ...r, jenis: undefined, jenis_utama: top ? `${top[0]} (${top[1]})` : '—', jenisMap: r.jenis as Map<string, number> }
    })
    .sort((a, b) => b.kejadian - a.kejadian || String(a.nama).localeCompare(String(b.nama), 'id'))
}

export function heatmapKabJenis(list: any[], maxJenis = 8) {
  const jenis = breakdownJenis(list).slice(0, maxJenis).map((r) => r.jenis)
  const kab = breakdownKab(list)
  const cells: Record<string, number> = {}
  let max = 0
  for (const k of kab) {
    for (const j of jenis) {
      const n = Number((k.jenisMap as Map<string, number>)?.get(j) || 0)
      cells[`${k.code}|${j}`] = n
      if (n > max) max = n
    }
  }
  return { kab, jenis, cells, max }
}

export function konteksWilayah(raw: any, w: WilayahKode, nama: { nama: string; provinsi: string; kabupaten: string | null }) {
  const livePsc = raw?.psc?.data_source === 'langsung'
  const liveTck = raw?.tck?.data_source === 'langsung'
  const liveLog = raw?.logistik?.data_source === 'langsung'
  const pscRow = livePsc ? (raw?.psc?.provinsi || []).find((p: any) => padProv(p.code) === w.prov) : null
  const tckRow = liveTck ? (raw?.tck?.provinsi || []).find((p: any) => padProv(p.code) === w.prov) : null
  const logistikBy = raw?.logistik?.provinsi_regional && raw?.logistik?.regional
    ? Object.fromEntries((raw.logistik.regional || []).map((r: any) => [r.id, r]))
    : null
  const regId = raw?.logistik?.provinsi_regional?.[w.prov]
  const logistik = liveLog
    ? (regId != null && logistikBy ? logistikBy[regId] : (raw?.logistik?.regional || []).find((r: any) => padProv(r.code) === w.prov) || null)
    : null
  const risiko = risikoWilayah(raw, {
    code: w.prov,
    kab_code: w.kab,
    kabupaten: nama.kabupaten,
    provinsi: nama.provinsi,
  })
  const psc = livePsc && pscRow ? {
    tersedia: true as const,
    nama: pscRow.nama || nama.provinsi,
    psc_total: pscRow.psc_total != null ? Number(pscRow.psc_total) : null,
    psc_aktif: pscRow.psc_aktif != null ? Number(pscRow.psc_aktif) : null,
    ambulans: pscRow.ambulans != null ? Number(pscRow.ambulans) : null,
    ambulans_baik: pscRow.ambulans_baik != null ? Number(pscRow.ambulans_baik) : null,
    ambulans_aktif: pscRow.ambulans_aktif != null ? Number(pscRow.ambulans_aktif) : null,
    panggilan: pscRow.panggilan != null ? Number(pscRow.panggilan) : null,
    rs_jejaring: pscRow.rs_jejaring != null ? Number(pscRow.rs_jejaring) : null,
  } : { tersedia: false as const }
  const tck = liveTck && tckRow ? {
    tersedia: tckRow.individu != null || tckRow.tim != null,
    nama: tckRow.nama || nama.provinsi,
    individu: tckRow.individu != null ? Number(tckRow.individu) : null,
    nakes: tckRow.nakes != null ? Number(tckRow.nakes) : null,
    tim: tckRow.tim != null ? Number(tckRow.tim) : null,
    emt: tckRow.emt != null ? Number(tckRow.emt) : null,
  } : { tersedia: false as const }
  const log = liveLog && logistik ? {
    tersedia: true as const,
    nama: logistik.nama || logistik.wilayah || 'Regional',
    total: Number(logistik.total || logistik.stok || 0),
    kedaluwarsa: logistik.kedaluwarsa != null ? Number(logistik.kedaluwarsa) : null,
  } : { tersedia: false as const }
  return { psc, tck, logistik: log, risiko }
}

export function analisaWilayah(list: any[], rekap: ReturnType<typeof rekapKejadian>, kab: ReturnType<typeof breakdownKab>, jenis: ReturnType<typeof breakdownJenis>, ctx: ReturnType<typeof konteksWilayah>) {
  const items: { id: string; tingkat: 'tinggi' | 'sedang' | 'info'; teks: string }[] = []
  const push = (id: string, tingkat: 'tinggi' | 'sedang' | 'info', teks: string) => items.push({ id, tingkat, teks })
  if (!list.length) {
    push('kosong', 'info', 'Belum ada kejadian EOC di wilayah ini pada periode yang dipilih.')
    return items
  }
  const nf = (n: number) => n.toLocaleString('id-ID')
  push('jumlah', rekap.berdampak_krisis > 0 ? 'sedang' : 'info', `${nf(rekap.terpantau)} kejadian tercatat, ${nf(rekap.berdampak_krisis)} berdampak krisis kesehatan.`)
  if (jenis[0]) push('jenis', 'info', `Jenis terbanyak: ${jenis[0].jenis} (${nf(jenis[0].kejadian)} kejadian).`)
  if (kab[0] && kab.length > 1) push('kab', 'info', `Kab/kota dengan kejadian terbanyak: ${kab[0].nama} (${nf(kab[0].kejadian)}).`)
  if (rekap.meninggal > 0) push('meninggal', 'tinggi', `${nf(rekap.meninggal)} meninggal tercatat pada kejadian di wilayah ini.`)
  else if (rekap.pengungsi > 0) push('pengungsi', 'sedang', `${nf(rekap.pengungsi)} pengungsi tercatat pada kejadian di wilayah ini.`)
  if (rekap.faskes_rusak > 0) push('faskes', 'sedang', `${nf(rekap.faskes_rusak)} faskes rusak tercatat dari API EOC.`)
  const psc = ctx.psc
  if (psc.tersedia && psc.psc_total != null && psc.psc_aktif != null && psc.psc_total > 0) {
    if (psc.psc_aktif === 0) push('psc', 'sedang', `Tidak ada PSC aktif (${nf(psc.psc_aktif)}/${nf(psc.psc_total)}) di provinsi ini.`)
    else if (psc.psc_total - psc.psc_aktif >= psc.psc_aktif) push('psc', 'info', `${nf(psc.psc_total - psc.psc_aktif)} dari ${nf(psc.psc_total)} PSC provinsi ini tidak aktif.`)
  }
  if (ctx.risiko?.tersedia && ctx.risiko.kapasitas && /rendah|belum|tidak/i.test(String(ctx.risiko.kapasitas))) {
    push('kapasitas', 'sedang', `Status kapasitas asistensi: ${ctx.risiko.kapasitas}${ctx.risiko.irbi ? ` · IRBI ${ctx.risiko.irbi}` : ''}.`)
  } else if (ctx.risiko?.tersedia && (ctx.risiko.kapasitas || ctx.risiko.irbi)) {
    push('kapasitas', 'info', `Asistensi wilayah: ${[ctx.risiko.kapasitas, ctx.risiko.irbi ? `IRBI ${ctx.risiko.irbi}` : null].filter(Boolean).join(' · ')}.`)
  }
  if (ctx.tck.tersedia && ctx.tck.individu === 0) push('tck', 'info', `Belum ada relawan TCK tercatat di ${ctx.tck.nama || 'provinsi ini'}.`)
  return items
}

export { BULAN, rekapKejadian }
