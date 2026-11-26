export type PuskrisPageKey = 'ringkasan' | 'krisis' | 'hidrometeorologi' | 'layanan' | 'kesiapsiagaan' | 'asistensi' | 'analisis'

export type SourceLink = { label: string; href: string }

export type PuskrisNavItem = {
  key: PuskrisPageKey
  href: string
  label: string
  shortLabel: string
  eyebrow: string
  title: string
  desc: string
  sources: SourceLink[]
  children?: { key: string; href: string; label: string; sources: SourceLink[] }[]
}

export const SOURCE = {
  psc: { label: 'Dasbor PSC 119', href: 'https://psc.kemkes.go.id/dashboard' },
  ambulans: { label: 'Dasbor Ambulans', href: 'https://psc.kemkes.go.id/dashboard/dashboard-ambulans' },
  ncc: { label: 'Dasbor Panggilan 119', href: 'https://psc.kemkes.go.id/dashboard/dashboard-ncc' },
  eocResmi: { label: 'Dasbor Pantauan Bencana', href: 'https://pusatkrisis.kemkes.go.id/dashboard-new' },
  eocVercel: { label: 'Dasbor EOC', href: 'https://dashboard-eoc.vercel.app/dashboard-eoc/' },
  tck: { label: 'Dasbor Tenaga Cadangan', href: 'https://tenagacadangankesehatan.kemkes.go.id/web/site/dashboard-tck' },
  logistik: { label: 'Dasbor Logistik', href: 'https://pusatkrisis.kemkes.go.id/logistik/site/landing-page' },
  asisProv: { label: 'Dasbor Asistensi Provinsi', href: 'https://pusatkrisis.kemkes.go.id/asistensi/dashboard-provinsi/index?modul=58MFls8WhAeVFGXqpKj9KQ%3D%3D' },
  asisKab: { label: 'Dasbor Asistensi Kab/Kota', href: 'https://pusatkrisis.kemkes.go.id/asistensi/dashboard-kabkot/index?modul=%2FArN8EAs7d%2BDUOevVYliBA%3D%3D' },
} as const

export const PUSKRIS_NAV: PuskrisNavItem[] = [
  {
    key: 'ringkasan',
    href: '/dashboard/ringkasan',
    label: 'Dasbor Utama',
    shortLabel: 'Dasbor Utama',
    eyebrow: 'Dasbor Pusat Krisis Kesehatan',
    title: 'Dasbor Utama Krisis Kesehatan',
    desc: 'Gambaran nasional yang menyatukan pantauan bencana, layanan 119, tenaga cadangan, logistik, dan asesmen risiko.',
    sources: [],
  },
  {
    key: 'krisis',
    href: '/dashboard/situasi-krisis',
    label: 'Pantauan Krisis',
    shortLabel: 'Pantauan Krisis',
    eyebrow: 'Pantauan bencana',
    title: 'Pantauan Krisis Kesehatan',
    desc: 'Kejadian terpantau dan yang berdampak krisis, korban, pengungsi, penduduk terdampak, jenis kejadian, tren, dan peta sebaran.',
    sources: [SOURCE.eocResmi, SOURCE.eocVercel],
  },
  {
    key: 'hidrometeorologi',
    href: '/dashboard/hidrometeorologi',
    label: 'Hidrometeorologi',
    shortLabel: 'Hidrometeorologi',
    eyebrow: 'Hidrometeorologi',
    title: 'Hidrometeorologi',
    desc: 'Pantauan kejadian hidrometeorologi (banjir, longsor, cuaca ekstrem, gelombang, kekeringan). Peta, tren musiman, dampak kesehatan, dan kesiapan di provinsi terdampak — dari API EOC, bukan data curah hujan BMKG.',
    sources: [SOURCE.eocResmi, SOURCE.eocVercel],
  },
  {
    key: 'layanan',
    href: '/dashboard/layanan-gawat-darurat',
    label: 'Layanan Gawat Darurat',
    shortLabel: 'Layanan Gawat Darurat',
    eyebrow: 'Layanan 119',
    title: 'Layanan Gawat Darurat',
    desc: 'Panggilan 119, PSC aktif, dan armada ambulans — siap dikerahkan saat terjadi krisis.',
    sources: [SOURCE.psc, SOURCE.ambulans, SOURCE.ncc],
    children: [
      { key: 'psc', href: '/dashboard/layanan-gawat-darurat/psc', label: 'PSC', sources: [SOURCE.psc] },
      { key: 'ambulans', href: '/dashboard/layanan-gawat-darurat/ambulans', label: 'Ambulans', sources: [SOURCE.ambulans] },
      { key: 'panggilan-119', href: '/dashboard/layanan-gawat-darurat/panggilan-119', label: 'Panggilan 119', sources: [SOURCE.ncc] },
    ],
  },
  {
    key: 'kesiapsiagaan',
    href: '/dashboard/kesiapsiagaan',
    label: 'Kesiapsiagaan',
    shortLabel: 'Kesiapsiagaan',
    eyebrow: 'Sumber daya dan stok',
    title: 'Kesiapsiagaan SDM dan Logistik',
    desc: 'Tenaga cadangan kesehatan dan stok logistik regional untuk mendukung respons krisis.',
    sources: [SOURCE.tck, SOURCE.logistik],
    children: [
      { key: 'tenaga-cadangan', href: '/dashboard/kesiapsiagaan/tenaga-cadangan', label: 'Tenaga Cadangan', sources: [SOURCE.tck] },
      { key: 'logistik', href: '/dashboard/kesiapsiagaan/logistik', label: 'Logistik', sources: [SOURCE.logistik] },
    ],
  },
  {
    key: 'asistensi',
    href: '/dashboard/asistensi-risiko',
    label: 'Asistensi Risiko',
    shortLabel: 'Asistensi Risiko',
    eyebrow: 'Asesmen risiko daerah',
    title: 'Asistensi Risiko',
    desc: 'Status kapasitas dan kelengkapan asesmen risiko di tingkat provinsi dan kabupaten/kota.',
    sources: [SOURCE.asisProv, SOURCE.asisKab],
    children: [
      { key: 'provinsi', href: '/dashboard/asistensi-risiko/provinsi', label: 'Provinsi', sources: [SOURCE.asisProv] },
      { key: 'kabupaten-kota', href: '/dashboard/asistensi-risiko/kabupaten-kota', label: 'Kab/Kota', sources: [SOURCE.asisKab] },
    ],
  },
  {
    key: 'analisis',
    href: '/dashboard/analisis',
    label: 'Analisis & Matriks',
    shortLabel: 'Analisis',
    eyebrow: 'Matriks & Analisis Terpadu',
    title: 'Matriks Analisis & Rekap Data Krisis',
    desc: 'Matriks tenaga cadangan kesehatan, panggilan darurat 119, kejadian bencana per provinsi × jenis, armada ambulans, rekap jenis kejadian, dan indeks kesenjangan respons 38 provinsi. Klik judul kolom untuk mengurutkan, unduh sebagai CSV.',
    sources: [SOURCE.ambulans, SOURCE.psc, SOURCE.eocResmi, SOURCE.eocVercel],
  },
]

export type PuskrisTopBarTab = {
  id: string
  href: string
  label: string
  pageKey: PuskrisPageKey
  bagian: string | null
}

export const PUSKRIS_TOP_BAR_TABS: PuskrisTopBarTab[] = [
  {
    id: 'ringkasan',
    href: '/dashboard/ringkasan',
    label: 'Dasbor Utama',
    pageKey: 'ringkasan',
    bagian: null,
  },
  {
    id: 'krisis',
    href: '/dashboard/situasi-krisis',
    label: 'Pantauan Krisis',
    pageKey: 'krisis',
    bagian: null,
  },
  {
    id: 'psc',
    href: '/dashboard/layanan-gawat-darurat/psc',
    label: 'PSC 119',
    pageKey: 'layanan',
    bagian: 'psc',
  },
  {
    id: 'ambulans',
    href: '/dashboard/layanan-gawat-darurat/ambulans',
    label: 'Ambulans',
    pageKey: 'layanan',
    bagian: 'ambulans',
  },
  {
    id: 'ncc',
    href: '/dashboard/layanan-gawat-darurat/panggilan-119',
    label: 'Panggilan 119 (NCC)',
    pageKey: 'layanan',
    bagian: 'panggilan-119',
  },
  {
    id: 'tck',
    href: '/dashboard/kesiapsiagaan/tenaga-cadangan',
    label: 'Tenaga Cadangan (TCK)',
    pageKey: 'kesiapsiagaan',
    bagian: 'tenaga-cadangan',
  },
  {
    id: 'logistik',
    href: '/dashboard/kesiapsiagaan/logistik',
    label: 'Logistik Kesehatan',
    pageKey: 'kesiapsiagaan',
    bagian: 'logistik',
  },
  {
    id: 'asistensi',
    href: '/dashboard/asistensi-risiko',
    label: 'Asistensi Risiko',
    pageKey: 'asistensi',
    bagian: null,
  },
  {
    id: 'analisis',
    href: '/dashboard/analisis',
    label: 'Analisis & Matriks',
    pageKey: 'analisis',
    bagian: null,
  },
  {
    id: 'hidrometeorologi',
    href: '/dashboard/hidrometeorologi',
    label: 'Hidrometeorologi',
    pageKey: 'hidrometeorologi',
    bagian: null,
  },
]

export function isTopBarTabActive(tab: PuskrisTopBarTab, pageKey: PuskrisPageKey, bagian: string | null): boolean {
  if (tab.pageKey !== pageKey) return false
  if (tab.bagian) {
    if (bagian === tab.bagian) return true
    if (!bagian) {
      if (pageKey === 'layanan' && tab.bagian === 'psc') return true
      if (pageKey === 'kesiapsiagaan' && tab.bagian === 'tenaga-cadangan') return true
    }
    return false
  }
  return true
}

export const NASIONAL_NOTE = 'Data nasional, belum tersedia per provinsi.'

export function matchPuskrisPath(pathname: string): { item: PuskrisNavItem; bagian: string | null } {
  const path = (pathname || '').replace(/\/$/, '') || '/'
  const sorted = [...PUSKRIS_NAV].sort((a, b) => b.href.length - a.href.length)
  for (const item of sorted) {
    if (path === item.href) return { item, bagian: null }
    if (item.children) {
      for (const ch of item.children) {
        if (path === ch.href) return { item, bagian: ch.key }
      }
      if (path.startsWith(item.href + '/')) {
        const key = path.slice(item.href.length + 1)
        const ch = item.children.find((c) => c.key === key)
        return { item, bagian: ch ? ch.key : null }
      }
    }
  }
  return { item: PUSKRIS_NAV[0], bagian: null }
}

export function sourcesFor(item: PuskrisNavItem, bagian: string | null): SourceLink[] {
  const ch = bagian ? item.children?.find((c) => c.key === bagian) : null
  return ch?.sources?.length ? ch.sources : item.sources
}

type QF = { periode?: string | null; tahun?: number | null; bulan?: number | null; dari?: string | null; sampai?: string | null; provinsi?: string | null; kabupaten?: string | null; jenis?: string | null; [k: string]: any }

/** Query string filter. Default hanya filter bersama (periode, wilayah, jenis) supaya ikut saat pindah halaman;
 *  withExtras = true juga menulis filter khusus halaman (regional, kategori, profesi, status, …). */
export function filterQuery(f: QF, withExtras = false) {
  const sp = new URLSearchParams()
  const yNow = Number(new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 4))
  if (f.periode && f.periode !== 'tahun') sp.set('periode', f.periode)
  if ((f.periode === 'tahun' || f.periode === 'bulan') && f.tahun && (f.tahun !== yNow || f.periode === 'bulan')) sp.set('tahun', String(f.tahun))
  if (f.periode === 'bulan' && f.bulan) sp.set('bulan', String(f.bulan))
  if (f.periode === 'rentang') { if (f.dari) sp.set('dari', f.dari); if (f.sampai) sp.set('sampai', f.sampai) }
  if (f.provinsi) sp.set('provinsi', f.provinsi)
  if (f.kabupaten) sp.set('kabupaten', f.kabupaten)
  if (f.jenis) sp.set('jenis', f.jenis)
  if (withExtras) for (const k of ['regional', 'kategori', 'kedaluwarsa', 'profesi', 'tim', 'status']) if (f[k]) sp.set(k, String(f[k]))
  const q = sp.toString()
  return q ? `?${q}` : ''
}

/** Baca filter dari query string (kebalikan filterQuery). */
export function parseFilterQuery(search: string, base: Record<string, any>) {
  const sp = new URLSearchParams(search)
  const next: Record<string, any> = { ...base }
  const periode = sp.get('periode')
  if (periode && ['tahun', 'bulan', 'bulanini', '7hari', '30hari', 'rentang'].includes(periode)) next.periode = periode
  const th = Number(sp.get('tahun'))
  if (th >= 2000 && th <= 2100) next.tahun = th
  const bl = Number(sp.get('bulan'))
  next.bulan = next.periode === 'bulan' ? (bl >= 1 && bl <= 12 ? bl : Number(new Date(Date.now() + 7 * 3600_000).toISOString().slice(5, 7))) : null
  const iso = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)
  next.dari = iso(sp.get('dari')); next.sampai = iso(sp.get('sampai'))
  if (next.periode === 'rentang' && (!next.dari || !next.sampai)) next.periode = 'tahun'
  for (const k of ['provinsi', 'kabupaten', 'jenis', 'regional', 'kategori', 'kedaluwarsa', 'profesi', 'tim', 'status']) if (sp.get(k)) next[k] = sp.get(k)
  return next
}

export function withQuery(href: string, f: QF) {
  return `${href}${filterQuery(f)}`
}
