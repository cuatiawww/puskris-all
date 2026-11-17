import { nf, pf } from './derive'
import type { ProvinceRow } from './types'
import type { Centroids } from './to-spasial'
import type { PuskrisUiFilter } from './ui-filter'


export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLon = ((b.lon - a.lon) * Math.PI) / 180
  const s1 = Math.sin(dLat / 2)
  const s2 = Math.sin(dLon / 2)
  const h = s1 * s1 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * s2 * s2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export const RADIUS_KM = [50, 100, 200] as const

/** Daftar wilayah Asistensi dari API (kosong bila API belum tersedia). */
export function asistensiWilayah(raw: any): any[] {
  return (raw?.asistensi?.wilayah || []).filter((x: any) => x.level === 'provinsi')
}
export const asistensiLangsung = (raw: any) => Boolean(raw?.asistensi?.wilayah?.length)

/** Titik fasilitas asli dari API PSC: [lat, lon, aktif(0/1), ambulans, ambulansBaik, kodeProv]. */
export type TitikFasilitas = { psc: [number, number, number, number, number, string][]; rs: [number, number][] }
export function titikFasilitas(raw: any): TitikFasilitas | null {
  const psc = raw?.psc?.titik_psc
  return Array.isArray(psc) && psc.length ? { psc, rs: raw?.psc?.titik_rs || [] } : null
}

export type RadiusCounts = {
  km: number
  psc: number
  ambulans: number
  ambulansBaik: number
  tckIndividu: number
  tckTimPerkiraan: number
  gudang: number
  stok: number
  provinsi: string[]
  /** jumlah rumah sakit jejaring dalam radius (hanya bila titik asli tersedia) */
  rs?: number
  /** true bila PSC/ambulans/RS dihitung dari koordinat fasilitas asli */
  titikNyata?: boolean
  /** true bila jumlah tim dihitung dari tim + EMT per provinsi (API Tenaga Cadangan) */
  timNyata?: boolean
}

export function countRadius(center: { lat: number; lon: number }, rows: ProvinceRow[], centroids: Centroids, titik?: TitikFasilitas | null): RadiusCounts[] {
  return RADIUS_KM.map((km) => {
    const inside = rows.filter((r) => {
      const c = centroids[r.code]
      return c && haversineKm(center, c) <= km
    })
    const gudangRows = inside.filter((r) => r.stok != null)
    const tckIndividu = inside.reduce((a, r) => a + r.tck, 0)
    const tckTotal = rows.reduce((a, r) => a + r.tck, 0) || 1
    const timNasional = rows.reduce((a, r) => a + (r as any)._timNasional || 0, 0)
    if (titik) {
      const pts = titik.psc.filter((p) => haversineKm(center, { lat: p[0], lon: p[1] }) <= km)
      return {
        km,
        psc: pts.filter((p) => p[2] === 1).length,
        ambulans: pts.reduce((a, p) => a + p[3], 0),
        ambulansBaik: pts.reduce((a, p) => a + p[4], 0),
        tckIndividu,
        tckTimPerkiraan: 0,
        gudang: gudangRows.length,
        stok: gudangRows.reduce((a, r) => a + (r.stok || 0), 0),
        provinsi: inside.map((r) => r.nama),
        rs: titik.rs.filter((p) => haversineKm(center, { lat: p[0], lon: p[1] }) <= km).length,
        titikNyata: true,
      }
    }
    return {
      km,
      psc: inside.reduce((a, r) => a + r.pscAktif, 0),
      ambulans: inside.reduce((a, r) => a + r.ambulans, 0),
      ambulansBaik: inside.reduce((a, r) => a + (r.ambulansBaik || 0), 0),
      tckIndividu,
      tckTimPerkiraan: 0,
      gudang: gudangRows.length,
      stok: gudangRows.reduce((a, r) => a + (r.stok || 0), 0),
      provinsi: inside.map((r) => r.nama),
    }
  })
}

export function attachTimEstimate(counts: RadiusCounts[], timNasional: number | null, individuNasional: number, rows?: ProvinceRow[]): RadiusCounts[] {
  if (rows && rows.some((r) => r.tckTim != null)) {
    const by = new Map(rows.map((r) => [r.nama, r]))
    return counts.map((c) => ({ ...c, tckTimPerkiraan: c.provinsi.reduce((a, n) => a + (by.get(n)?.tckTim || 0) + (by.get(n)?.tckEmt || 0), 0), timNyata: true }))
  }
  // Tanpa tim per provinsi dari API: tidak diperkirakan (dibiarkan 0 dan ditandai bukan data nyata).
  void timNasional; void individuNasional
  return counts.map((c) => ({ ...c, tckTimPerkiraan: 0, timNyata: false }))
}

export type Peringatan = {
  id: string
  tingkat: 'tinggi' | 'sedang'
  judul: string
  detail: string
  contoh?: boolean
  code?: string
}

export function buildPeringatan(opts: {
  raw: any
  rows: ProvinceRow[]
  nccDays: { date: string; cof: number; acd?: number; available?: boolean }[]
  kejadian: any[]
}): Peringatan[] {
  const out: Peringatan[] = []
  const days = (opts.nccDays || []).filter((d) => d.available !== false && d.cof > 0)
  if (days.length >= 3) {
    const avg = days.reduce((a, d) => a + d.cof, 0) / days.length
    const spikes = days.filter((d) => d.cof > avg * 1.5).sort((a, b) => b.cof - a.cof)
    for (const d of spikes.slice(0, 3)) {
      out.push({
        id: `ncc-${d.date}`,
        tingkat: d.cof > avg * 2 ? 'tinggi' : 'sedang',
        judul: `Lonjakan panggilan 119 pada ${d.date}`,
        detail: `${nf(d.cof)} panggilan masuk, di atas rata-rata ${nf(Math.round(avg))} pada periode terfilter.`,
      })
    }
  }

  if (asistensiLangsung(opts.raw)) {
    const risk = asistensiWilayah(opts.raw)
      .filter((x: any) => /tinggi/i.test(String(x.status_risiko_irbi_2024 || x.status_risiko_irbi || '')) && /belum/i.test(String(x.status_kapasitas || '')))
      .map((x: any) => ({ x, row: opts.rows.find((r) => r.code === String(x.kode_wilayah).padStart(2, '0')) }))
      .sort((a: any, b: any) => (b.row?.indeksRespons || 0) - (a.row?.indeksRespons || 0))
    for (const { x, row } of risk.slice(0, 4)) {
      const code = String(x.kode_wilayah).padStart(2, '0')
      out.push({
        id: `irbi-${code}`,
        tingkat: 'tinggi',
        judul: `${row?.nama || x.nama} berisiko tinggi menurut Indeks Risiko Bencana Indonesia, belum mengisi kapasitas Asistensi`,
        detail: `Indeks kesenjangan ${row ? Math.round(row.indeksRespons) : 0} dari 100. Sumber: rekapitulasi Asistensi ${opts.raw?.asistensi?.tahun || ''} (langsung).`,
        code,
      })
    }
  }
  const withStock = opts.rows.filter((r) => r.stok != null)
  if (withStock.length) {
    const stocks = withStock.map((r) => r.stok || 0).sort((a, b) => a - b)
    const q1 = stocks[Math.floor((stocks.length - 1) * 0.25)]
    const codesWithEvent = new Set((opts.kejadian || []).map((k: any) => k.code))
    for (const r of withStock) {
      if ((r.stok || 0) <= q1 && (codesWithEvent.has(r.code) || r.kejadian > 0 || r.krisis > 0)) {
        const ev = (opts.kejadian || []).filter((k: any) => k.code === r.code).length
        out.push({
          id: `stok-${r.code}`,
          tingkat: 'sedang',
          judul: `Stok regional ${r.nama} menipis`,
          detail: `Stok ${nf(r.stok)} berada di kuartil bawah stok regional (API Logistik), sementara wilayah ini punya ${ev || r.krisis} jejak kejadian pada filter aktif.`,
          code: r.code,
        })
      }
    }
  }

  const gap = [...opts.rows].sort((a, b) => b.indeksRespons - a.indeksRespons).slice(0, 3)
  for (const r of gap) {
    if (r.indeksRespons >= 70 && !out.some((p) => p.code === r.code)) {
      out.push({
        id: `gap-${r.code}`,
        tingkat: r.indeksRespons >= 85 ? 'tinggi' : 'sedang',
        judul: `Kesenjangan respons tinggi di ${r.nama}`,
        detail: `Indeks ${Math.round(r.indeksRespons)} dari 100 (beban kejadian/korban/pengungsi lebih besar daripada kapasitas PSC, ambulans baik, SDM, stok, dan Asistensi yang tersedia).`,
        code: r.code,
      })
    }
  }
  return out.slice(0, 12)
}

export function buildNarasi(opts: {
  filterLabel: string
  wilayahLabel: string
  situasi: any
  layanan: any
  rows: ProvinceRow[]
  peringatan: Peringatan[]
  jenis?: string | null
}): string {
  const { situasi, layanan, rows, peringatan } = opts
  const top = [...rows].sort((a, b) => b.indeksRespons - a.indeksRespons).slice(0, 3)
  const topKrisis = [...rows].sort((a, b) => b.krisis - a.krisis)[0]
  const jenis = opts.jenis ? ` untuk jenis ${opts.jenis}` : ''
  const scr = layanan.scr != null ? ` Tingkat keberhasilan layanan ${pf(layanan.scr, 1)}.` : ''
  const warn = peringatan.length ? ` Ada ${peringatan.length} peringatan otomatis yang perlu dicermati.` : ''
  const gap = top.length ? ` Kesenjangan respons paling tinggi terlihat di ${top.map((r) => r.nama).join(', ')}.` : ''
  const krisis = topKrisis && topKrisis.krisis ? ` Kejadian berdampak krisis paling banyak di ${topKrisis.nama} (${nf(topKrisis.krisis)}).` : ''
  return `Pada ${opts.filterLabel} di ${opts.wilayahLabel}${jenis}, tercatat ${nf(situasi.terpantau)} kejadian terpantau dan ${nf(situasi.berdampak_krisis)} yang berdampak krisis, dengan ${nf(situasi.meninggal)} meninggal dan ${nf(situasi.pengungsi)} pengungsi. Panggilan 119 tercatat ${nf(layanan.panggilan)}.${scr}${krisis}${gap}${warn}`
}

export type TimelinePoint = {
  tanggal: string
  label: string
  kejadian: number
  panggilan: number | null
  panggilanContoh: boolean
  meninggal: number
  pengungsi: number
}

/** Lini masa 15 hari. Panggilan 119 dari API NCC bila tanggalnya ada; selain itu kosong (null). */
export function buildTimeline(opts: {
  kejadian: any[]
  nccDays: { date: string; cof: number; available?: boolean }[]
  selectedTanggal?: string | null
}): { rows: TimelinePoint[]; catatan: string } {
  const events = [...(opts.kejadian || [])].sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal)))
  const anchor = opts.selectedTanggal || events[events.length - 1]?.tanggal || (opts.nccDays.filter((d) => d.available !== false).slice(-1)[0]?.date) || new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)
  const start = addDays(anchor, -7)
  const days: TimelinePoint[] = []
  const nccBy = Object.fromEntries((opts.nccDays || []).map((d) => [d.date, d]))
  for (let i = 0; i < 15; i++) {
    const tanggal = addDays(start, i)
    const evs = events.filter((e) => e.tanggal === tanggal)
    const ncc = nccBy[tanggal]
    const hasReal = ncc && ncc.available !== false
    const panggilan: number | null = hasReal ? ncc.cof : null
    const panggilanContoh = false
    days.push({
      tanggal,
      label: tanggal.slice(5),
      kejadian: evs.length,
      panggilan,
      panggilanContoh,
      meninggal: evs.reduce((a, e) => a + Number(e.meninggal || 0), 0),
      pengungsi: evs.reduce((a, e) => a + Number(e.pengungsi || 0), 0),
    })
  }
  const kosong = days.filter((d) => d.panggilan == null).length
  const catatan = `Panggilan 119 dari API NCC${kosong ? ` (${kosong} hari tanpa data NCC dibiarkan kosong)` : ''}. Kejadian, korban, dan pengungsi dari API EOC sesuai filter.`
  return { rows: days, catatan }
}

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00+07:00`)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export type Terpadu = {
  judul: string
  sub: string
  eoc: { kejadian: number; krisis: number; meninggal: number; lukaBerat: number; lukaRingan: number; pengungsi: number; terdampak: number }
  layanan: { panggilan: number; pscAktif: number; pscTotal: number; scr: number | null }
  ambulans: { total: number; baik: number; rusakRingan: number; rusakBerat: number; gps: number }
  tck: { individu: number; nakes: number; nonNakes: number; tim: number | null; emt: number | null; emtStandar?: number | null; wilayah?: boolean }
  logistik: { nama: string | null; stok: number | null; catatan: string }
  asistensi: { nama: string; poin: number | null; status: string; irbi: string; catatan: string }
}

export function buildTerpadu(opts: {
  row: ProvinceRow | null
  kejadian: any[]
  raw: any
  layananNasional: any
  sdmNasional: any
  selectedEvent?: any | null
}): Terpadu | null {
  const { row, raw, selectedEvent } = opts
  if (!row) return null
  const evs = (opts.kejadian || []).filter((k: any) => k.code === row.code)
  const ev = selectedEvent && selectedEvent.code === row.code ? selectedEvent : evs[0]
  const asis = asistensiWilayah(raw).find((x: any) => String(x.kode_wilayah).padStart(2, '0') === row.code)
  const asisLive = asistensiLangsung(raw)
  const logName = row.stok != null ? row.nama : null
  return {
    judul: ev ? `${ev.jenis} · ${ev.kabupaten || row.nama}` : row.nama,
    sub: ev ? `${ev.tanggal} · ${row.nama}` : `Provinsi ${row.nama}`,
    eoc: {
      kejadian: ev ? 1 : row.kejadian,
      krisis: ev ? 1 : row.krisis,
      meninggal: ev ? Number(ev.meninggal || 0) : row.meninggal,
      lukaBerat: ev ? Number(ev.luka_berat || 0) : 0,
      lukaRingan: ev ? Number(ev.luka_ringan || 0) : 0,
      pengungsi: ev ? Number(ev.pengungsi || 0) : row.pengungsi,
      terdampak: ev ? Number(ev.terdampak || 0) : row.terdampak,
    },
    layanan: {
      panggilan: row.panggilan,
      pscAktif: row.pscAktif,
      pscTotal: row.pscTotal,
      scr: opts.layananNasional?.scr ?? null,
    },
    ambulans: {
      total: row.ambulans,
      baik: row.ambulansBaik || 0,
      rusakRingan: row.ambulansRusakRingan || 0,
      rusakBerat: row.ambulansRusakBerat || 0,
      gps: row.ambulansGps || 0,
    },
    tck: {
      individu: row.tck,
      nakes: row.tckNakes,
      nonNakes: row.tckNonNakes,
      tim: row.tckTim ?? opts.sdmNasional?.tim ?? null,
      emt: row.tckEmt ?? opts.sdmNasional?.emt ?? null,
      emtStandar: row.tckEmtStandar ?? null,
      wilayah: row.tckTim != null,
    },
    logistik: {
      nama: logName,
      stok: row.stok,
      catatan: raw?.logistik?.data_source === 'langsung'
        ? (() => { const g = (raw.logistik.regional || []).find((r: any) => r.id === raw.logistik.provinsi_regional?.[row.code]); return g ? `Dilayani gudang regional ${g.nama} (API Logistik langsung, ${raw.logistik.fetched_at_wib || ''}); ${g.kedaluwarsa || 0} barang kedaluwarsa.` : 'Belum terpetakan ke gudang regional.' })()
        : 'Data logistik belum tersedia dari API Logistik.',
    },
    asistensi: asis
      ? { nama: asis.nama, poin: asis.poin_kapasitas_pct, status: asis.status_kapasitas, irbi: asis.status_risiko_irbi_2024, catatan: `Rekapitulasi Asistensi ${raw.asistensi?.tahun || ''}, diambil langsung ${raw.asistensi?.fetched_at_wib || ''}.` }
      : { nama: row.nama, poin: null, status: asisLive ? 'Belum terpetakan' : 'Data belum tersedia', irbi: 'Tidak tersedia', catatan: asisLive ? 'Wilayah ini belum ada di rekapitulasi API Asistensi.' : 'Data Asistensi belum tersedia dari API.' },
  }
}
