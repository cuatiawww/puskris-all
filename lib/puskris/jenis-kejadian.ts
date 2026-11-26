/* eslint-disable @typescript-eslint/no-explicit-any */
import { eocKejadian, rekapKejadian } from '@/lib/puskris/derive'
import { padProv, trendBulanan, breakdownKab, jenisOptions } from '@/lib/puskris/wilayah-detail'
import { eocKindOf } from '@/lib/puskris/eoc-markers'

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

export function slugJenis(nama: string | null | undefined): string {
  const s = String(nama || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s || 'lainnya'
}

export function resolveJenis(slug: string | null | undefined, names: string[]): string | null {
  const s = slugJenis(slug)
  if (!s) return null
  return names.find((n) => slugJenis(n) === s) || null
}

export function jenisKejadianHref(
  nama: string,
  opts?: { tahun?: string | number | null; prov?: string | null },
) {
  const slug = slugJenis(nama)
  const q = new URLSearchParams()
  const tahun = String(opts?.tahun || '').slice(0, 4)
  if (/^\d{4}$/.test(tahun)) q.set('tahun', tahun)
  const prov = opts?.prov ? String(opts.prov).replace(/\D/g, '').padStart(2, '0').slice(0, 2) : ''
  if (prov.length === 2 && prov !== '00') q.set('prov', prov)
  const qs = q.toString()
  return `/dashboard/jenis-kejadian/${encodeURIComponent(slug)}${qs ? `?${qs}` : ''}`
}

export function jenisKejadianIndexHref(opts?: { tahun?: string | number | null; prov?: string | null }) {
  const q = new URLSearchParams()
  const tahun = String(opts?.tahun || '').slice(0, 4)
  if (/^\d{4}$/.test(tahun)) q.set('tahun', tahun)
  const prov = opts?.prov ? String(opts.prov).replace(/\D/g, '').padStart(2, '0').slice(0, 2) : ''
  if (prov.length === 2 && prov !== '00') q.set('prov', prov)
  const qs = q.toString()
  return `/dashboard/jenis-kejadian${qs ? `?${qs}` : ''}`
}

export function tahunPilihan(current: number): number[] {
  const y = Number.isFinite(current) ? current : new Date().getFullYear()
  const years: number[] = []
  for (let i = y; i >= y - 5; i--) years.push(i)
  return years
}

export function allJenisNames(raw: any): string[] {
  const set = new Set<string>()
  for (const e of raw?.eoc?.events || []) {
    const n = String(e?.n || e?.jenis || '').trim()
    if (n) set.add(n)
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'id'))
}

export function eventsNasional(raw: any, jenisNama: string | null, prov?: string | null) {
  const regionName = Object.fromEntries((raw?.regions || []).map((r: any) => [String(r.code), r.name]))
  let list = (raw?.eoc?.events || [])
    .map((e: any) => eocKejadian(e, regionName))
    .sort((a: any, b: any) => String(b.tanggal || '').localeCompare(String(a.tanggal || '')) || String(b.uid || '').localeCompare(String(a.uid || '')))
  if (jenisNama) list = list.filter((k: any) => String(k.jenis || '') === jenisNama)
  if (prov) {
    const p = String(prov).replace(/\D/g, '').padStart(2, '0').slice(0, 2)
    list = list.filter((k: any) => padProv(k.code) === p)
  }
  return { list, regionName }
}

export function breakdownProv(list: any[], regionName: Record<string, string> = {}) {
  const map = new Map<string, any>()
  for (const k of list || []) {
    const code = padProv(k.code) || '—'
    const row = map.get(code) || {
      code,
      nama: regionName[code] || k.provinsi || `Provinsi ${code}`,
      kejadian: 0,
      krisis: 0,
      meninggal: 0,
      luka: 0,
      hilang: 0,
      pengungsi: 0,
      terdampak: 0,
      faskes_rusak: 0,
    }
    if (k.provinsi) row.nama = k.provinsi
    else if (regionName[code]) row.nama = regionName[code]
    row.kejadian += 1
    if (k.krisis) row.krisis += 1
    row.meninggal += Number(k.meninggal || 0)
    row.luka += Number(k.luka_berat || 0) + Number(k.luka_ringan || 0)
    row.hilang += Number(k.hilang || 0)
    row.pengungsi += Number(k.pengungsi || 0)
    row.terdampak += Number(k.terdampak || 0)
    row.faskes_rusak += Number(k.faskes_rusak || 0)
    map.set(code, row)
  }
  return [...map.values()].sort((a, b) => b.kejadian - a.kejadian || String(a.nama).localeCompare(String(b.nama), 'id'))
}

export function heatmapProvBulan(list: any[], regionName: Record<string, string> = {}, maxProv = 15) {
  const prov = breakdownProv(list, regionName).slice(0, maxProv)
  const cells: Record<string, number> = {}
  let max = 0
  for (const k of list || []) {
    const code = padProv(k.code)
    const m = Number(String(k.tanggal || '').slice(5, 7))
    if (!code || !m) continue
    if (!prov.some((p) => p.code === code)) continue
    const key = `${code}|${m}`
    const n = (cells[key] || 0) + 1
    cells[key] = n
    if (n > max) max = n
  }
  return { prov, months: BULAN, cells, max }
}

function sumField(rows: any[], key: string) {
  return rows.reduce((s, r) => s + (r[key] != null && Number.isFinite(Number(r[key])) ? Number(r[key]) : 0), 0)
}

/** Kapasitas PSC/TCK/logistik di provinsi terdampak. Bukan penugasan per jenis — API tidak menautkan deployment ke jenis kejadian. */
export function konteksJenis(raw: any, provRows: { code: string; nama?: string; kejadian?: number }[] = []) {
  const livePsc = raw?.psc?.data_source === 'langsung'
  const liveTck = raw?.tck?.data_source === 'langsung'
  const liveLog = raw?.logistik?.data_source === 'langsung'
  const codes = (provRows || []).map((r) => padProv(r.code)).filter((c) => c && c !== '00')
  const codeSet = new Set(codes)
  const namaBy = Object.fromEntries((provRows || []).map((r) => [padProv(r.code), r.nama || `Provinsi ${r.code}`]))
  const kejadianBy = Object.fromEntries((provRows || []).map((r) => [padProv(r.code), Number(r.kejadian || 0)]))

  const pscAll = livePsc ? (raw?.psc?.provinsi || []) : []
  const tckAll = liveTck ? (raw?.tck?.provinsi || []) : []
  const pscRows = pscAll.filter((p: any) => codeSet.has(padProv(p.code)))
  const tckRows = tckAll.filter((p: any) => codeSet.has(padProv(p.code)))

  const logById = Object.fromEntries((raw?.logistik?.regional || []).map((r: any) => [r.id, r]))
  const logMap = raw?.logistik?.provinsi_regional || {}
  const seenGudang = new Set<string | number>()
  const gudangUnik: any[] = []
  const rows = codes.map((code) => {
    const psc = pscRows.find((p: any) => padProv(p.code) === code)
    const tck = tckRows.find((p: any) => padProv(p.code) === code)
    const regId = logMap[code]
    const gudang = liveLog
      ? (regId != null ? logById[regId] : (raw?.logistik?.regional || []).find((r: any) => padProv(r.code) === code)) || null
      : null
    if (gudang) {
      const key = gudang.id ?? gudang.nama ?? padProv(gudang.code)
      if (!seenGudang.has(key)) {
        seenGudang.add(key)
        gudangUnik.push(gudang)
      }
    }
    return {
      code,
      nama: psc?.nama || tck?.nama || namaBy[code] || `Provinsi ${code}`,
      kejadian: kejadianBy[code] || 0,
      psc_total: psc?.psc_total != null ? Number(psc.psc_total) : null,
      psc_aktif: psc?.psc_aktif != null ? Number(psc.psc_aktif) : null,
      ambulans: psc?.ambulans != null ? Number(psc.ambulans) : null,
      ambulans_baik: psc?.ambulans_baik != null ? Number(psc.ambulans_baik) : null,
      tck_individu: tck?.individu != null ? Number(tck.individu) : null,
      tck_tim: tck?.tim != null ? Number(tck.tim) : null,
      tck_nakes: tck?.nakes != null ? Number(tck.nakes) : null,
      logistik: gudang ? Number(gudang.total || gudang.stok || 0) : null,
      gudang: gudang?.nama || gudang?.wilayah || null,
    }
  }).sort((a, b) => b.kejadian - a.kejadian || String(a.nama).localeCompare(String(b.nama), 'id'))

  const psc = livePsc && pscRows.length ? {
    tersedia: true as const,
    psc_total: sumField(pscRows, 'psc_total'),
    psc_aktif: sumField(pscRows, 'psc_aktif'),
    ambulans: sumField(pscRows, 'ambulans'),
    ambulans_baik: sumField(pscRows, 'ambulans_baik'),
    panggilan: sumField(pscRows, 'panggilan'),
    provinsi: pscRows.length,
  } : { tersedia: false as const }
  const tck = liveTck && tckRows.length ? {
    tersedia: true as const,
    individu: sumField(tckRows, 'individu'),
    nakes: sumField(tckRows, 'nakes'),
    tim: sumField(tckRows, 'tim'),
    emt: sumField(tckRows, 'emt'),
    provinsi: tckRows.length,
  } : { tersedia: false as const }
  const logistik = liveLog && gudangUnik.length ? {
    tersedia: true as const,
    total: sumField(gudangUnik, 'total') || sumField(gudangUnik, 'stok'),
    gudang: gudangUnik.length,
  } : { tersedia: false as const }

  return { psc, tck, logistik, rows, provCount: codes.length, scope: 'provinsi_terdampak' as const }
}

export function konteksNasional(raw: any) {
  const regions = (raw?.regions || []).map((r: any) => ({ code: String(r.code), nama: r.name }))
  return konteksJenis(raw, regions)
}

export function copyJenisDashboard(jenis: string | null): string {
  if (!jenis) return 'Pilih satu jenis kejadian untuk melihat sebaran nasional, peta, chart, dan data pendukung dari API EOC.'
  const kind = eocKindOf(jenis)
  if (kind === 'banjir' || kind === 'longsor') {
    return `Analisis spasial kejadian ${jenis} di Indonesia: sebaran kab/kota terdampak, pengungsi, penduduk terdampak, serta tren korban dari API EOC.`
  }
  if (kind === 'gempa') {
    return `Analisis spasial kejadian ${jenis} di Indonesia: sebaran wilayah, dampak korban, serta magnitudo dan kedalaman bila data itu tersedia dari API.`
  }
  if (kind === 'karhutla') {
    return `Analisis spasial kejadian ${jenis} di Indonesia: sebaran kab/kota terdampak, penduduk terdampak, faskes rusak, dan tren kejadian dari API EOC.`
  }
  if (kind === 'erupsi') {
    return `Analisis spasial kejadian ${jenis} di Indonesia: sebaran wilayah terdampak, korban, dan faskes rusak dari API EOC.`
  }
  return `Analisis spasial kejadian ${jenis} di Indonesia: sebaran wilayah, dampak korban, tren, dan data pendukung dari API EOC.`
}

export function narasiJenis(jenis: string, tahun: number, rekap: any, provRows: any[], kabRows: any[], provFilter?: string | null) {
  const provNames = (provRows || []).map((r: any) => r.nama).filter(Boolean)
  const wilayah = provFilter && provNames.length === 1
    ? provNames[0]
    : (provNames.length ? `${provNames.slice(0, 8).join(', ')}${provNames.length > 8 ? `, dan ${provNames.length - 8} provinsi lain` : ''}` : 'Indonesia')
  const nf = (n: number) => Number(n || 0).toLocaleString('id-ID')
  return `${jenis} pada tahun ${tahun} tercatat di ${nf(kabRows?.length || 0)} kab/kota pada ${nf(provRows?.length || 0)} provinsi (${wilayah}). Tercatat ${nf(rekap?.terpantau)} kejadian (${nf(rekap?.berdampak_krisis)} berstatus krisis), ${nf(rekap?.meninggal)} meninggal, ${nf(rekap?.luka)} luka-luka, ${nf(rekap?.hilang)} hilang, ${nf(rekap?.pengungsi)} pengungsi, dan ${nf(rekap?.terdampak)} penduduk terdampak. ${nf(rekap?.faskes_rusak)} faskes tercatat rusak. Semua angka dihitung dari rekaman API EOC, tanpa data cadangan.`
}

export function heroUtama(jenis: string, rekap: any, kabN: number) {
  const kind = eocKindOf(jenis)
  const nf = (n: number) => Number(n || 0).toLocaleString('id-ID')
  if (kind === 'banjir' || kind === 'longsor') {
    return [
      { label: 'Pengungsi', value: nf(rekap.pengungsi), sub: `${nf(rekap.meninggal)} meninggal`, tone: 'orange' },
      { label: 'Penduduk terdampak', value: nf(rekap.terdampak), sub: `${nf(kabN)} kab/kota`, tone: 'violet' },
      { label: 'Kejadian', value: nf(rekap.terpantau), sub: `${nf(rekap.berdampak_krisis)} krisis`, tone: 'teal' },
    ]
  }
  if (kind === 'gempa') {
    return [
      { label: 'Meninggal', value: nf(rekap.meninggal), sub: `${nf(rekap.hilang)} hilang`, tone: 'red' },
      { label: 'Luka-luka', value: nf(rekap.luka), sub: `Berat ${nf(rekap.luka_berat)} · ringan ${nf(rekap.luka_ringan)}`, tone: 'orange' },
      { label: 'Penduduk terdampak', value: nf(rekap.terdampak), sub: `${nf(kabN)} kab/kota`, tone: 'violet' },
    ]
  }
  if (kind === 'karhutla') {
    return [
      { label: 'Penduduk terdampak', value: nf(rekap.terdampak), sub: `${nf(kabN)} kab/kota`, tone: 'violet' },
      { label: 'Kejadian', value: nf(rekap.terpantau), sub: `${nf(rekap.berdampak_krisis)} krisis`, tone: 'teal' },
      { label: 'Faskes rusak', value: nf(rekap.faskes_rusak), sub: `${nf(rekap.pengungsi)} pengungsi`, tone: 'orange' },
    ]
  }
  return [
    { label: 'Kejadian', value: nf(rekap.terpantau), sub: `${nf(rekap.berdampak_krisis)} krisis`, tone: 'teal' },
    { label: 'Penduduk terdampak', value: nf(rekap.terdampak), sub: `${nf(kabN)} kab/kota`, tone: 'violet' },
    { label: 'Meninggal', value: nf(rekap.meninggal), sub: `${nf(rekap.luka)} luka-luka`, tone: 'red' },
  ]
}

export function packJenisKejadian(raw: any, jenisNama: string, tahun: number, prov?: string | null) {
  const names = allJenisNames(raw)
  const { list: allOfJenis, regionName } = eventsNasional(raw, jenisNama, null)
  const { list } = eventsNasional(raw, jenisNama, prov)
  const rekap = rekapKejadian(list)
  const provRows = breakdownProv(list, regionName)
  const kabRows = breakdownKab(list)
  const tren = trendBulanan(list)
  const panasProv = heatmapProvBulan(list, regionName)
  const ctx = konteksJenis(raw, provRows)
  const opsiJenis = jenisOptions((raw?.eoc?.events || []).map((e: any) => eocKejadian(e, regionName)))
  const regions = (raw?.regions || []).map((r: any) => ({ code: String(r.code).padStart(2, '0').slice(0, 2), nama: r.name })).sort((a: any, b: any) => String(a.nama).localeCompare(String(b.nama), 'id'))
  return {
    jenis: jenisNama,
    names,
    list,
    allOfJenis,
    regionName,
    rekap,
    provRows,
    kabRows,
    tren,
    panasProv,
    ctx,
    opsiJenis,
    regions,
    tahun,
    prov: prov || null,
    updatedAt: raw?.eoc?.fetched_at_wib || raw?.generated_at_wib || null,
  }
}

export type JenisKejadianPack = ReturnType<typeof packJenisKejadian>
export { rekapKejadian, trendBulanan }
