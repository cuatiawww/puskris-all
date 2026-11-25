/**
 * Utilitas bersama untuk klasifikasi 3 template detail kejadian (Banjir, Gempa, Karhutla) + Umum,
 * konversi kualitas udara KLHK ISPU, kode cuaca WMO, arah angin/plume asap, dan kalkulasi
 * Skor Risiko Krisis Kesehatan berbasis indikator API resmi (tanpa angka fiktif).
 */

export type KejadianTemplate = 'banjir' | 'gempa' | 'karhutla' | 'umum'

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10
}

export function resolveKejadianTemplate(
  jenis?: string | null,
  override?: string | null,
): KejadianTemplate {
  const ov = String(override || '').trim().toLowerCase()
  if (ov === 'banjir' || ov === 'gempa' || ov === 'karhutla' || ov === 'umum') return ov
  const s = String(jenis || '').toLowerCase()
  if (/gempa|tsunami|tektonik|seismik/.test(s)) return 'gempa'
  if (/banjir|rob|bandang|genangan|luapan/.test(s)) return 'banjir'
  if (/karhutla|kebakaran hutan|hutan dan lahan|kebakaran lahan|asap/.test(s)) return 'karhutla'
  return 'umum'
}

export function templateMeta(tpl: KejadianTemplate) {
  switch (tpl) {
    case 'gempa':
      return {
        key: 'gempa' as const,
        label: 'Template Gempa Bumi & Tektonik',
        shortLabel: 'Gempa & Seismik',
        accentHex: '#b91c1c',
        badgeClass: 'border-rose-200 bg-rose-50 text-rose-800',
        bannerClass: 'from-rose-50/90 via-orange-50/40 to-white border-rose-200/80',
        stripTitle: 'TREN AKTIVITAS SEISMIK & GEMPA SUSULAN (BMKG & USGS)',
      }
    case 'banjir':
      return {
        key: 'banjir' as const,
        label: 'Template Banjir & Hidrometeorologi',
        shortLabel: 'Banjir & Hidrologi',
        accentHex: '#0369a1',
        badgeClass: 'border-sky-200 bg-sky-50 text-sky-800',
        bannerClass: 'from-sky-50/90 via-cyan-50/40 to-white border-sky-200/80',
        stripTitle: 'HISTORI CUACA & CURAH HUJAN HARIAN (OPEN-METEO)',
      }
    case 'karhutla':
      return {
        key: 'karhutla' as const,
        label: 'Template Karhutla & Kabut Asap',
        shortLabel: 'Karhutla & Udara',
        accentHex: '#c2410c',
        badgeClass: 'border-amber-200 bg-amber-50 text-amber-900',
        bannerClass: 'from-amber-50/90 via-orange-50/40 to-white border-amber-200/80',
        stripTitle: 'RINGKASAN KUALITAS UDARA (ISPU KLHK) & TITIK PANAS HARIAN',
      }
    default:
      return {
        key: 'umum' as const,
        label: 'Template Kejadian Krisis Kesehatan',
        shortLabel: 'Umum / Multi-Bahaya',
        accentHex: '#00705a',
        badgeClass: 'border-teal-200 bg-teal-50 text-teal-800',
        bannerClass: 'from-teal-50/80 via-emerald-50/30 to-white border-teal-200/80',
        stripTitle: 'HISTORI CUACA & KONDISI LINGKUNGAN (OPEN-METEO)',
      }
  }
}

export function wmoLabel(code?: number | null): { label: string; severity: 'normal' | 'waspada' | 'ekstrem' } {
  if (code == null || !Number.isFinite(Number(code))) return { label: 'Tidak tersedia', severity: 'normal' }
  const c = Number(code)
  if (c === 0) return { label: 'Cerah', severity: 'normal' }
  if (c === 1) return { label: 'Cerah Berawan', severity: 'normal' }
  if (c === 2) return { label: 'Berawan Sebagian', severity: 'normal' }
  if (c === 3) return { label: 'Mendung / Berawan Tebal', severity: 'normal' }
  if (c === 45 || c === 48) return { label: 'Berkabut', severity: 'normal' }
  if (c >= 51 && c <= 57) return { label: 'Gerimis', severity: 'normal' }
  if (c === 61 || c === 80) return { label: 'Hujan Ringan', severity: 'normal' }
  if (c === 63 || c === 81) return { label: 'Hujan Sedang', severity: 'waspada' }
  if (c === 65 || c === 66 || c === 67 || c === 82) return { label: 'Hujan Lebat', severity: 'ekstrem' }
  if (c >= 95) return { label: 'Hujan Petir / Ekstrem', severity: 'ekstrem' }
  return { label: `Kode Cuaca ${c}`, severity: 'normal' }
}

export type IspuResult = {
  ispu: number | null
  kategori: 'Baik' | 'Sedang' | 'Tidak Sehat' | 'Sangat Tidak Sehat' | 'Berbahaya' | 'Tidak Tersedia'
  badgeClass: string
  barColor: string
}

/** Konversi konsentrasi PM2.5 (µg/m³) ke indeks ISPU sesuai Permen LHK No. P.14/2020. */
export function calcKlhkIspuFromPm25(pm25?: number | null): IspuResult {
  if (pm25 == null || !Number.isFinite(Number(pm25)) || Number(pm25) < 0) {
    return { ispu: null, kategori: 'Tidak Tersedia', badgeClass: 'border-slate-200 bg-slate-50 text-slate-500', barColor: '#94a3b8' }
  }
  const c = Number(pm25)
  const bp: [number, number, number, number][] = [
    [0, 15.5, 0, 50],
    [15.5, 55.4, 51, 100],
    [55.4, 150.4, 101, 200],
    [150.4, 250.4, 201, 300],
    [250.4, 500, 301, 500],
  ]
  let ispu = 500
  for (const [cLo, cHi, iLo, iHi] of bp) {
    if (c <= cHi) {
      ispu = Math.round(((iHi - iLo) / Math.max(0.1, cHi - cLo)) * (c - cLo) + iLo)
      break
    }
  }
  if (ispu <= 50) return { ispu, kategori: 'Baik', badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-800', barColor: '#10b981' }
  if (ispu <= 100) return { ispu, kategori: 'Sedang', badgeClass: 'border-sky-200 bg-sky-50 text-sky-800', barColor: '#0284c7' }
  if (ispu <= 200) return { ispu, kategori: 'Tidak Sehat', badgeClass: 'border-amber-200 bg-amber-50 text-amber-900', barColor: '#d97706' }
  if (ispu <= 300) return { ispu, kategori: 'Sangat Tidak Sehat', badgeClass: 'border-rose-200 bg-rose-50 text-rose-800', barColor: '#dc2626' }
  return { ispu, kategori: 'Berbahaya', badgeClass: 'border-slate-700 bg-slate-900 text-white', barColor: '#111827' }
}

const COMPASS_ID: { code: string; label: string }[] = [
  { code: 'U', label: 'Utara' },
  { code: 'TL', label: 'Timur Laut' },
  { code: 'T', label: 'Timur' },
  { code: 'TG', label: 'Tenggara' },
  { code: 'S', label: 'Selatan' },
  { code: 'BD', label: 'Barat Daya' },
  { code: 'B', label: 'Barat' },
  { code: 'BL', label: 'Barat Laut' },
]

export function windCardinalId(deg?: number | null) {
  if (deg == null || !Number.isFinite(Number(deg))) return null
  const d = ((Number(deg) % 360) + 360) % 360
  const idx = Math.round(d / 45) % 8
  const toDeg = (d + 180) % 360
  const toIdx = Math.round(toDeg / 45) % 8
  return {
    deg: Math.round(d),
    fromCode: COMPASS_ID[idx].code,
    fromLabel: COMPASS_ID[idx].label,
    toDeg: Math.round(toDeg),
    toCode: COMPASS_ID[toIdx].code,
    toLabel: COMPASS_ID[toIdx].label,
  }
}

export type ParsedEocFacts = {
  magnitudo: number | null
  kedalamanKm: number | null
  tsunamiStatus: string | null
  feltNote: string | null
  tinggiAirText: string | null
  luasTerbakarText: string | null
  kecamatanText: string | null
}

/** Ekstrak metrik terstruktur dari deskripsi kronologis EOC (tanpa mengarang). */
export function parseEocNarrativeFacts(text?: string | null, kecamatanRaw?: string | null): ParsedEocFacts {
  const s = String(text || '').replace(/\s+/g, ' ').trim()
  const magM = s.match(/\bM(?:agnitudo)?\s*([0-9]+(?:[.,][0-9]+)?)\s*(?:SR|Mw|M)?\b/i)
  const depthM = s.match(/kedalaman\s*([0-9]+(?:[.,][0-9]+)?)\s*km/i)
  let tsunamiStatus: string | null = null
  if (/tidak\s+berpotensi\s+tsunami/i.test(s)) tsunamiStatus = 'Tidak Berpotensi Tsunami'
  else if (/berpotensi\s+tsunami/i.test(s)) tsunamiStatus = 'Berpotensi Tsunami'

  let feltNote: string | null = null
  if (/gempa\s+tidak\s+di\s*rasakan|tidak\s+dirasakan/i.test(s)) feltNote = 'Tidak dirasakan'
  else {
    const mmiM = s.match(/((?:I|V|X)+(?:\s*[-–]\s*(?:I|V|X)+)?\s*MMI)/i)
    if (mmiM) feltNote = mmiM[1]
    else if (/dirasakan/i.test(s)) feltNote = 'Dirasakan masyarakat'
  }

  const tmaM = s.match(/(?:ketinggian\s*air|tma|tinggi\s*air)[^.;\n]*?(\d+(?:\s*[-–]\s*\d+)?\s*(?:cm|meter|m))/i)
  const luasM = s.match(/(?:seluas|luas(?:\s+lahan)?|hangus\s+terbakar)[^.;\n]*?(\d+(?:[.,]\d+)?\s*(?:Ha|hektar|m2))/i)

  const kecClean = String(kecamatanRaw || '').trim()
  return {
    magnitudo: magM ? Number(magM[1].replace(',', '.')) : null,
    kedalamanKm: depthM ? Number(depthM[1].replace(',', '.')) : null,
    tsunamiStatus,
    feltNote,
    tinggiAirText: tmaM ? tmaM[1] : null,
    luasTerbakarText: luasM ? luasM[1] : null,
    kecamatanText: kecClean || null,
  }
}

export type HealthRiskBreakdown = {
  score: number
  level: 'RENDAH' | 'SEDANG' | 'TINGGI' | 'KRITIS'
  badgeClass: string
  factors: { label: string; points: number; maxPoints: number; basis: string }[]
}

/** Hitung Skor Risiko Krisis Kesehatan (0-100) dari indikator dampak & kapasitas yang terukur. */
export function computeHealthRiskScore(input: {
  template: KejadianTemplate
  krisis?: number
  korban?: number
  meninggal?: number
  pengungsi?: number
  terdampak?: number
  faskesRusak?: number
  rainMm?: number | null
  riverDischarge?: number | null
  ispu?: number | null
  magnitudo?: number | null
  hotspot50km?: number | null
  indeksRisikoIrbi?: number | null
}): HealthRiskBreakdown {
  const factors: HealthRiskBreakdown['factors'] = []

  // 1. Status Krisis & Korban Kesehatan (maks 35)
  const victimRaw = (input.meninggal || 0) * 5 + (input.korban || 0) * 2
  const krisisPts = Math.min(35, (input.krisis ? 18 : 4) + (victimRaw > 0 ? Math.min(17, Math.round(Math.log10(victimRaw + 1) * 8)) : 0))
  factors.push({
    label: 'Korban Jiwa & Status Krisis EOC',
    points: krisisPts,
    maxPoints: 35,
    basis: `${input.krisis ? 'Berdampak Krisis Kesehatan' : 'Pantauan Krisis'} · ${input.korban || 0} korban (${input.meninggal || 0} meninggal)`,
  })

  // 2. Pengungsi, Terdampak & Gangguan Faskes (maks 30)
  const dispRaw = (input.pengungsi || 0) * 2 + (input.terdampak || 0) * 0.2 + (input.faskesRusak || 0) * 80
  const dispPts = dispRaw > 0 ? Math.min(30, Math.round(Math.log10(dispRaw + 1) * 7.5)) : 2
  factors.push({
    label: 'Paparan Penduduk & Kerusakan Faskes',
    points: dispPts,
    maxPoints: 30,
    basis: `${(input.pengungsi || 0).toLocaleString('id-ID')} mengungsi · ${(input.terdampak || 0).toLocaleString('id-ID')} terdampak · ${input.faskesRusak || 0} faskes rusak`,
  })

  // 3. Intensitas Bahaya Real-Time sesuai Template (maks 25)
  let hazPts = 5
  let hazBasis = 'Parameter bahaya dalam pemantauan dasar'
  if (input.template === 'banjir') {
    const rain = input.rainMm || 0
    const q = input.riverDischarge || 0
    hazPts = Math.min(25, Math.round((rain >= 50 ? 14 : rain >= 20 ? 9 : rain > 0 ? 5 : 2) + (q >= 300 ? 11 : q >= 100 ? 7 : q > 20 ? 4 : 1)))
    hazBasis = `Hujan ${input.rainMm != null ? `${input.rainMm} mm` : '—'} · Debit GloFAS ${input.riverDischarge != null ? `${input.riverDischarge} m³/s` : '—'}`
  } else if (input.template === 'gempa') {
    const mag = input.magnitudo || 0
    hazPts = mag >= 6.5 ? 25 : mag >= 5.5 ? 18 : mag >= 4.5 ? 12 : mag > 0 ? 7 : 5
    hazBasis = mag > 0 ? `Magnitudo M ${mag.toFixed(1)}` : 'Data magnitudo belum tersedia'
  } else if (input.template === 'karhutla') {
    const ispu = input.ispu || 0
    const hs = input.hotspot50km || 0
    hazPts = Math.min(25, (ispu > 200 ? 15 : ispu > 100 ? 11 : ispu > 50 ? 6 : 2) + (hs >= 20 ? 10 : hs >= 5 ? 7 : hs > 0 ? 4 : 1))
    hazBasis = `ISPU ${input.ispu ?? '—'} · ${hs} hotspot (radius 50 km)`
  } else if (input.rainMm != null && input.rainMm > 0) {
    hazPts = input.rainMm >= 50 ? 16 : input.rainMm >= 15 ? 10 : 5
    hazBasis = `Curah hujan terukur ${input.rainMm} mm`
  }
  factors.push({
    label: 'Intensitas Bahaya Lingkungan (Real-Time)',
    points: hazPts,
    maxPoints: 25,
    basis: hazBasis,
  })

  // 4. Kerentanan Wilayah IRBI / Asistensi (maks 10)
  const irbiPts = input.indeksRisikoIrbi != null ? Math.min(10, Math.round((input.indeksRisikoIrbi / 200) * 10)) : 4
  factors.push({
    label: 'Indeks Risiko Bencana Wilayah (IRBI)',
    points: irbiPts,
    maxPoints: 10,
    basis: input.indeksRisikoIrbi != null ? `Skor IRBI kabupaten ${input.indeksRisikoIrbi}` : 'Menggunakan ambang dasar IRBI',
  })

  const score = Math.max(5, Math.min(100, factors.reduce((s, f) => s + f.points, 0)))
  const level: HealthRiskBreakdown['level'] =
    score >= 75 ? 'KRITIS' : score >= 52 ? 'TINGGI' : score >= 30 ? 'SEDANG' : 'RENDAH'
  const badgeClass =
    level === 'KRITIS'
      ? 'border-rose-300 bg-rose-50 text-rose-800'
      : level === 'TINGGI'
      ? 'border-amber-300 bg-amber-50 text-amber-900'
      : level === 'SEDANG'
      ? 'border-sky-200 bg-sky-50 text-sky-800'
      : 'border-emerald-200 bg-emerald-50 text-emerald-800'

  return { score, level, badgeClass, factors }
}
