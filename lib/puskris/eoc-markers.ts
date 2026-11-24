/** Ikon pin kejadian EOC: dipetakan dari jenis bencana, digambar sebagai SVG (gaya pin Peta Puskris). */

export type EocIcon = {
  id: string
  label: string
  color: string
  /** Path/ikon lucide-style di viewBox 24x24, stroke putih. */
  glyph: string
}

const ICONS: Record<string, EocIcon> = {
  banjir: {
    id: 'banjir', label: 'Banjir', color: '#b91c1c',
    glyph: '<path d="M4 21V10l8-6 8 6v11"/><path d="M9 21v-6h6v6"/><path d="M3 16c1.5 0 1.5 2 3 2s1.5-2 3-2 1.5 2 3 2 1.5-2 3-2 1.5 2 3 2 1.5-2 3-2"/>',
  },
  'banjir-bandang': {
    id: 'banjir-bandang', label: 'Banjir Bandang', color: '#9f1239',
    glyph: '<path d="M4 21V10l8-6 8 6v11"/><path d="M9 21v-6h6v6"/><path d="M3 17c1.5 0 1.5 2 3 2s1.5-2 3-2 1.5 2 3 2 1.5-2 3-2 1.5 2 3 2 1.5-2 3-2"/>',
  },
  tsunami: {
    id: 'tsunami', label: 'Tsunami / Gelombang', color: '#0369a1',
    glyph: '<path d="M2 15c2 0 2 3 4 3s2-3 4-3 2 3 4 3 2-3 4-3 2 3 4 3"/><path d="M2 9c2.5-3 5.5-4 10-4s7.5 1 10 4"/><path d="M2 20c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2 2 2 4 2"/>',
  },
  karhutla: {
    id: 'karhutla', label: 'Kebakaran Hutan dan Lahan', color: '#ea580c',
    glyph: '<path d="M12 22c-4 0-6-2.5-6-6 0-4 3-7 6-10 3 3 6 6 6 10 0 3.5-2 6-6 6z"/><path d="M10 16c.5-2 1.5-3 2-5"/>',
  },
  kebakaran: {
    id: 'kebakaran', label: 'Kebakaran', color: '#c2410c',
    glyph: '<path d="M12 22c-4 0-6-2.5-6-6 0-4 3-7 6-10 3 3 6 6 6 10 0 3.5-2 6-6 6z"/>',
  },
  longsor: {
    id: 'longsor', label: 'Tanah Longsor', color: '#15803d',
    glyph: '<path d="M5 21l7-16 7 16z"/><path d="M9 14c.8-1.5 2-2.5 3-4"/><path d="M8 21h8"/>',
  },
  gempa: {
    id: 'gempa', label: 'Gempa Bumi', color: '#c2410c',
    glyph: '<path d="M2 12h3l2-5 3 10 3-8 2 3h7"/>',
  },
  'gunung-api': {
    id: 'gunung-api', label: 'Letusan Gunung Api', color: '#9f1239',
    glyph: '<path d="M6 21l6-12 6 12z"/><path d="M12 9V4"/><path d="M10 6l2-3 2 3"/>',
  },
  kekeringan: {
    id: 'kekeringan', label: 'Kekeringan', color: '#d97706',
    glyph: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  },
  angin: {
    id: 'angin', label: 'Angin / Cuaca Ekstrem', color: '#0e7490',
    glyph: '<path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>',
  },
  konflik: {
    id: 'konflik', label: 'Konflik Sosial', color: '#7c3aed',
    glyph: '<path d="M16 16l-4-9-4 9"/><path d="M8.2 12h7.6"/><circle cx="12" cy="19" r="1.4"/>',
  },
  kecelakaan: {
    id: 'kecelakaan', label: 'Kecelakaan', color: '#334155',
    glyph: '<circle cx="7" cy="17" r="2.5"/><circle cx="17" cy="17" r="2.5"/><path d="M5 17H3l2-7h9l3 5h2"/><path d="M10 10V7h5"/>',
  },
  klb: {
    id: 'klb', label: 'KLB / Penyakit', color: '#0f766e',
    glyph: '<path d="M12 7v10"/><path d="M7 12h10"/><circle cx="12" cy="12" r="9"/>',
  },
  industri: {
    id: 'industri', label: 'Industri / Teknologi', color: '#57534e',
    glyph: '<path d="M3 21V10l5 3V10l5 3V8l8-3v16z"/><path d="M7 21v-3M12 21v-3M17 21v-3"/>',
  },
  lain: {
    id: 'lain', label: 'Kejadian', color: '#475569',
    glyph: '<path d="M12 22s8-6.5 8-12a8 8 0 1 0-16 0c0 5.5 8 12 8 12z"/><circle cx="12" cy="10" r="2.5"/>',
  },
}

const RULES: { test: RegExp; id: keyof typeof ICONS }[] = [
  { test: /banjir\s*bandang/i, id: 'banjir-bandang' },
  { test: /banjir/i, id: 'banjir' },
  { test: /tsunami|gelombang\s*pasang|badai/i, id: 'tsunami' },
  { test: /hutan dan lahan|karhutla/i, id: 'karhutla' },
  { test: /kebakaran/i, id: 'kebakaran' },
  { test: /longsor/i, id: 'longsor' },
  { test: /gunung\s*api|letusan/i, id: 'gunung-api' },
  { test: /gempa/i, id: 'gempa' },
  { test: /kekeringan/i, id: 'kekeringan' },
  { test: /angin|puting\s*beliung|cuaca\s*ekstrem/i, id: 'angin' },
  { test: /konflik|kerusuhan|teror|sabotase/i, id: 'konflik' },
  { test: /kecelakaan/i, id: 'kecelakaan' },
  { test: /klb|wabah|penyakit|keracunan|epidemi|pandemi/i, id: 'klb' },
  { test: /industri|gagal\s*teknologi/i, id: 'industri' },
]

export function eocIconOf(jenis: string | null | undefined): EocIcon {
  const s = String(jenis || '').trim()
  if (s) {
    for (const r of RULES) if (r.test.test(s)) return ICONS[r.id]
  }
  return ICONS.lain
}

export function eocIconList(): EocIcon[] {
  return Object.values(ICONS)
}

/** Pin tetesan dengan glif jenis. Garis putus-putus = koordinat perkiraan (pusat kab/kota atau provinsi). */
export function eocPinSvg(icon: EocIcon, opts?: { krisis?: boolean; approx?: boolean; size?: number }): string {
  const h = Math.max(28, opts?.size || 32)
  const w = Math.round(h * 28 / 36)
  const stroke = opts?.approx ? 'stroke="#1e293b" stroke-width="1.4" stroke-dasharray="2.5 1.8"' : 'stroke="#ffffff" stroke-width="1.7"'
  const ring = opts?.krisis ? '<circle cx="14" cy="13" r="9.2" fill="none" stroke="#fbbf24" stroke-width="1.6"/>' : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 28 36">
    <path d="M14 1.6C7.2 1.6 1.7 7 1.7 13.8c0 8.7 12.3 20.4 12.3 20.4s12.3-11.7 12.3-20.4C26.3 7 20.8 1.6 14 1.6z" fill="${icon.color}" ${stroke}/>
    ${ring}
    <g transform="translate(5.1 4.3) scale(0.73)" fill="none" stroke="#ffffff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${icon.glyph}</g>
  </svg>`
}

export function eocPinDataUri(icon: EocIcon, opts?: { krisis?: boolean; approx?: boolean; size?: number }): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(eocPinSvg(icon, opts))}`
}

export function eocKindOf(jenis: string | null | undefined): 'banjir' | 'gempa' | 'erupsi' | 'karhutla' | 'longsor' | 'cuaca' | 'lain' {
  const id = eocIconOf(jenis).id
  if (id === 'banjir' || id === 'banjir-bandang') return 'banjir'
  if (id === 'gempa' || id === 'tsunami') return 'gempa'
  if (id === 'gunung-api') return 'erupsi'
  if (id === 'karhutla' || id === 'kebakaran') return 'karhutla'
  if (id === 'longsor') return 'longsor'
  if (id === 'angin' || id === 'kekeringan') return 'cuaca'
  return 'lain'
}

const namNorm = (s: string) => String(s || '')
  .toLowerCase()
  .replace(/^(kota|kabupaten|kab\.?)\s+/i, '')
  .replace(/[^a-z0-9]/g, '')

export type KabRow = { n: string; p: string; pn: string; lat: number; lon: number }

export type EventLok = 'kejadian' | 'kabkota' | 'provinsi' | 'tidak_tersedia'

export function resolveEventCoord(
  k: { lat?: number | null; lon?: number | null; la?: number | null; lo?: number | null; kabupaten?: string | null; bn?: string | null; code?: string | null; p?: string | null },
  centroids: Record<string, { lat: number; lon: number }>,
  kabList: KabRow[] = [],
): { lat: number; lon: number; lok: EventLok } | null {
  const lat = k.lat ?? k.la ?? null
  const lon = k.lon ?? k.lo ?? null
  if (lat != null && lon != null && lat > -12 && lat < 7 && lon > 94 && lon < 142) {
    return { lat, lon, lok: 'kejadian' }
  }
  const prov = String(k.code || k.p || '').padStart(2, '0')
  const nama = String(k.kabupaten || k.bn || '')
  if (nama && prov && kabList.length) {
    const target = namNorm(nama)
    const sameProv = kabList.filter((r) => r.p === prov)
    const hit = sameProv.find((r) => namNorm(r.n) === target)
      || sameProv.find((r) => namNorm(r.n).startsWith(target) || target.startsWith(namNorm(r.n)))
    if (hit) return { lat: hit.lat, lon: hit.lon, lok: 'kabkota' }
  }
  const c = centroids[prov]
  if (c) return { lat: c.lat, lon: c.lon, lok: 'provinsi' }
  return null
}

export const LOK_LABEL: Record<EventLok, string> = {
  kejadian: 'Koordinat kejadian (API EOC)',
  kabkota: 'Perkiraan: pusat kabupaten/kota',
  provinsi: 'Perkiraan: pusat provinsi',
  tidak_tersedia: 'Koordinat belum tersedia dari API',
}

export function fmtAngka(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return Number(n).toLocaleString('id-ID')
}

export function tglKejadian(iso?: string | null, jam?: string | null) {
  if (!iso) return '—'
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return iso
  const t = `${m[3]}/${m[2]}/${m[1]}`
  return jam ? `${t} · ${jam} WIB` : t
}
