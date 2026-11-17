import KAB_INDEX from './kabkota-index.json'

/** Satu kejadian bencana terbaru (agregat per kejadian, tanpa data individu). */
export type KejadianTerbaru = {
  id: string
  sumber: 'Pusat Krisis' | 'BMKG' | 'GDACS' | 'USGS' | 'EOC'
  kategori: 'krisis' | 'terpantau' | 'gempa' | 'peringatan'
  jenis: string
  lokasi: string | null
  provinsi: string | null
  provCode: string | null
  tanggal: string // YYYY-MM-DD
  jam: string | null // HH:MM
  zonaWib: boolean // true bila jam sudah WIB
  lat: number | null
  lon: number | null
  terdampak?: number | null
  korban?: number | null
  meninggal?: number | null
  pengungsi?: number | null
  magnitudo?: number | null
  kedalaman?: string | null
  tingkat?: 'red' | 'orange' | 'yellow' | null
  keterangan?: string | null
  url?: string | null
}

type KabRow = { n: string; p: string; pn: string; lat: number; lon: number }
const KABS = KAB_INDEX as KabRow[]

const norm = (s: string) => String(s || '').toUpperCase().replace(/^(KABUPATEN|KAB\.?)\s+/, '').replace(/\s+/g, ' ').trim()

export function titleCase(s: string | null | undefined) {
  return String(s || '').toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\bDki\b/, 'DKI').replace(/\bD\.i\.\b/, 'D.I.').trim()
}

/** Cari kab/kota menurut nama; bila tidak ketemu dan ada koordinat, pakai pusat kab/kota terdekat. */
export function lookupWilayah(nama: string | null, lat?: number | null, lon?: number | null): KabRow | null {
  const n = norm(nama || '')
  if (n) {
    const hit = KABS.find((k) => k.n === n) || KABS.find((k) => k.n === `KOTA ${n}`)
    if (hit) return hit
  }
  if (lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon)) {
    let best: KabRow | null = null, bd = Infinity
    for (const k of KABS) {
      const d = (k.lat - lat) ** 2 + ((k.lon - lon) * Math.cos((lat * Math.PI) / 180)) ** 2
      if (d < bd) { bd = d; best = k }
    }
    // > ~1,5 derajat (≈165 km) dianggap di laut / luar wilayah kab/kota
    return bd <= 2.25 ? best : null
  }
  return null
}

/** Normalisasi blok `crisisIncidents` + `incidents` dari HTML dashboard-new. */
export function fromEocApi(list: any[]): KejadianTerbaru[] {
  return (list || []).map((e) => {
    const w = e.la == null ? lookupWilayah(e.bn) : null
    return {
      id: `eoc-${e.u}`, sumber: 'Pusat Krisis', kategori: e.s ? 'krisis' : 'terpantau', jenis: String(e.n || 'Kejadian').trim(),
      lokasi: titleCase(e.bn), provinsi: titleCase(e.pn) || null, provCode: e.p || null,
      tanggal: e.t, jam: e.w || null, zonaWib: true,
      lat: e.la ?? w?.lat ?? null, lon: e.lo ?? w?.lon ?? null,
      terdampak: e.td ?? 0, korban: e.kr ?? 0, meninggal: e.m ?? 0, pengungsi: e.pg ?? 0,
      url: `https://pusatkrisis.kemkes.go.id/detail-bencana/${encodeURIComponent(e.u)}`,
    } as KejadianTerbaru
  })
}

/** Ubah ISO/UTC menjadi tanggal + jam WIB. */
export function toWib(iso: string | null | undefined): { tanggal: string; jam: string } | null {
  if (!iso) return null
  const s = /[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  const t = d.toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' })
  return { tanggal: t.slice(0, 10), jam: t.slice(11, 16) }
}

const KIND_JENIS: Record<string, string> = { earthquake: 'Gempa Bumi', flood: 'Banjir', volcano: 'Letusan Gunung Api', cyclone: 'Siklon Tropis', drought: 'Kekeringan', wildfire: 'Kebakaran Hutan dan Lahan' }

/** Normalisasi respons /api/v1/map-layers/hazards (BMKG, GDACS, USGS). */
export function fromHazards(events: any[]): KejadianTerbaru[] {
  const seenGempa = new Set<string>()
  return (events || []).map((e) => {
    const w = lookupWilayah(null, e.latitude, e.longitude)
    const t = toWib(e.time)
    const src = String(e.source || '')
    const sumber: KejadianTerbaru['sumber'] = src.startsWith('BMKG') ? 'BMKG' : src.startsWith('USGS') ? 'USGS' : 'GDACS'
    return {
      id: String(e.id), sumber, kategori: e.kind === 'earthquake' ? 'gempa' : 'peringatan',
      jenis: KIND_JENIS[e.kind] || 'Bencana', lokasi: e.place || null, provinsi: w?.pn || null, provCode: w?.p || null,
      tanggal: t?.tanggal || '', jam: t?.jam || null, zonaWib: Boolean(t),
      lat: e.latitude ?? null, lon: e.longitude ?? null,
      magnitudo: e.kind === 'earthquake' && e.magnitude != null ? Number(e.magnitude) : null,
      kedalaman: e.depth || null, tingkat: e.alert_level || null, keterangan: e.potensi || null, url: e.url || null,
    } as KejadianTerbaru
  }).filter((k) => {
    if (!k.tanggal) return false
    // BMKG memuat gempa yang sama di beberapa daftar (terkini, dirasakan, M5+): simpan satu saja
    if (k.sumber === 'BMKG') {
      const key = `${k.tanggal}|${k.jam}|${k.magnitudo}`
      if (seenGempa.has(key)) return false
      seenGempa.add(key)
    }
    return true
  })
}

/** Kejadian krisis dari API EOC (eoc.kejadian_krisis_terbaru; punya rincian meninggal & pengungsi). */
export function fromEocKrisis(list: any[]): KejadianTerbaru[] {
  const seen = new Set<string>()
  const out: KejadianTerbaru[] = []
  for (const k of list || []) {
    const key = `${k.tanggal}|${k.jenis}|${k.kabupaten}`
    if (seen.has(key)) continue
    seen.add(key)
    const w = lookupWilayah(k.kabupaten)
    out.push({
      id: `eoc-${key}`, sumber: 'EOC', kategori: 'krisis', jenis: k.jenis, lokasi: titleCase(k.kabupaten),
      provinsi: titleCase(k.provinsi) || w?.pn || null, provCode: k.code || w?.p || null,
      tanggal: k.tanggal, jam: null, zonaWib: false, lat: w?.lat ?? null, lon: w?.lon ?? null,
      terdampak: k.terdampak ?? null, korban: k.korban ?? null, meninggal: k.meninggal ?? null, pengungsi: k.pengungsi ?? null,
    })
  }
  return out
}
