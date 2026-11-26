/** Build the Analisa AI report from live EOC aggregates. No dummy fallback numbers. */

export type AiInsightStats = {
  terpantau: number
  krisis: number
  meninggal: number
  hilang: number
  luka: number
  pengungsi: number
  terdampak: number
  cfr: number | null
  topJenis: string | null
  topWilayah: string | null
  tahun: number
  regionLabel: string
}

export type AiInsightSection = {
  num: string
  title: string
  color: 'teal' | 'amber' | 'red' | 'indigo' | 'orange' | 'rose' | 'green' | 'slate'
  body: string
}

export type AiInsightReport = {
  available: boolean
  stats: AiInsightStats | null
  sections: AiInsightSection[]
  preview: string
  fullText: string
}

const nf = (n: number) => n.toLocaleString('id-ID')

function num(v: any): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function looksLikeCode(name: string | null | undefined): boolean {
  if (!name) return true
  const t = String(name).trim()
  // "32", "3201", "Provinsi 32", "Wilayah 402"
  return /^(provinsi|prov\.?|wilayah|kab(?:upaten)?|kota)?\s*\d+$/i.test(t)
}

export function resolveWilayahNama(opts: {
  preferred?: string | null
  code?: string | number | null
  rows?: any[]
}): string {
  const preferred = (opts.preferred || '').trim()
  if (preferred && !looksLikeCode(preferred)) return preferred
  const code = opts.code != null ? String(opts.code) : ''
  const rows = opts.rows || []
  const hit = rows.find((r: any) => String(r.code || r.id || '') === code)
  const nama = (hit?.nama || hit?.name || '').trim()
  if (nama && !looksLikeCode(nama)) return nama
  if (preferred && !/\d/.test(preferred)) return preferred
  return 'Nasional'
}

export function buildAiInsightReport(opts: {
  raw?: any
  derived?: any
  f?: any
  regionLabel?: string
}): AiInsightReport {
  const { raw, derived, f } = opts
  const situasi = derived?.situasi || {}
  const terpantau = num(situasi.terpantau)
  const krisis = num(situasi.berdampak_krisis) ?? 0
  const meninggal = num(situasi.meninggal) ?? 0
  const hilang = num(situasi.hilang) ?? 0
  const luka = num(situasi.luka) ?? (num(situasi.luka_berat) || 0) + (num(situasi.luka_ringan) || 0)
  const pengungsi = num(situasi.pengungsi) ?? 0
  const terdampak = num(situasi.terdampak) ?? 0
  const tahun = Number(f?.tahun) || new Date().getFullYear()

  const regionLabel = resolveWilayahNama({
    preferred: opts.regionLabel,
    code: f?.kabupaten || f?.provinsi,
    rows: derived?.rows || raw?.regions || [],
  })

  // Dominant jenis from live events, never a hardcoded name.
  const list: any[] = (derived?.kejadianSemua || derived?.kejadian || raw?.eoc?.events || []).filter(Boolean)
  const jenisCount = new Map<string, number>()
  for (const k of list) {
    const nama = String(k.jenis || k.nama || '').trim()
    if (!nama) continue
    jenisCount.set(nama, (jenisCount.get(nama) || 0) + 1)
  }
  const topJenis = f?.jenis || [...jenisCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null

  const rows: any[] = derived?.rows || []
  const topWilayah = [...rows]
    .filter((r) => r?.nama && !looksLikeCode(r.nama))
    .sort((a, b) => Number(b.kejadian || 0) - Number(a.kejadian || 0))[0]?.nama || null

  if (terpantau == null) {
    return { available: false, stats: null, sections: [], preview: '', fullText: '' }
  }

  const korban = meninggal + luka + hilang
  const cfr = korban > 0 ? Math.round((meninggal / korban) * 1000) / 10 : null
  const stats: AiInsightStats = {
    terpantau,
    krisis,
    meninggal,
    hilang,
    luka,
    pengungsi,
    terdampak,
    cfr,
    topJenis,
    topWilayah,
    tahun,
    regionLabel,
  }

  const cakupan = regionLabel === 'Nasional' ? 'nasional' : `di ${regionLabel}`
  const jenisPhrase = topJenis ? `Jenis kejadian terbanyak adalah ${topJenis}` : 'Komposisi jenis kejadian mengikuti filter yang aktif'
  const wilayahPhrase = topWilayah ? `konsentrasi tertinggi tercatat di ${topWilayah}` : 'sebaran wilayah mengikuti data EOC yang tersedia'
  const cfrPhrase = cfr != null ? `Rasio meninggal terhadap total korban (meninggal, hilang, dan luka) adalah ${cfr.toLocaleString('id-ID')}%.` : 'Rasio meninggal terhadap total korban belum dapat dihitung karena data korban belum tersedia.'

  const keparahan = krisis >= 50 || meninggal >= 100
    ? 'SIAGA TINGGI'
    : krisis > 0 || meninggal > 0
      ? 'WASPADA'
      : 'TERPANTAU'

  const sections: AiInsightSection[] = [
    {
      num: '1',
      title: 'Executive Summary & Situasi Terkini',
      color: 'teal',
      body: `Berdasarkan data pantauan EOC Kementerian Kesehatan untuk tahun ${tahun} ${cakupan}, tercatat ${nf(terpantau)} kejadian terpantau, di antaranya ${nf(krisis)} berdampak krisis kesehatan. ${jenisPhrase}, dan ${wilayahPhrase}. Dampak yang tercatat mencakup ${nf(terdampak)} orang terdampak dan ${nf(pengungsi)} pengungsi.`,
    },
    {
      num: '2',
      title: 'Analisis Dampak Kesehatan',
      color: 'amber',
      body: `Korban yang tercatat: ${nf(meninggal)} meninggal, ${nf(hilang)} hilang, dan ${nf(luka)} luka-luka. ${cfrPhrase} Angka ini dihitung dari rekaman API EOC pada filter yang aktif, bukan dari model proyeksi. Area pengungsian (${nf(pengungsi)} orang) tetap menjadi perhatian untuk layanan kesehatan dasar, air bersih, dan sanitasi.`,
    },
    {
      num: '3',
      title: 'Klasifikasi Tingkat Keparahan',
      color: 'red',
      body: `Berdasarkan jumlah kejadian berdampak krisis (${nf(krisis)}) dan korban meninggal (${nf(meninggal)}), tingkat keparahan dinilai ${keparahan}. Klasifikasi ini hanya merangkum angka EOC yang tersedia, bukan hasil model prediktif.`,
    },
    {
      num: '4',
      title: 'Komparasi Internasional & Benchmark',
      color: 'indigo',
      body: `Kerangka rujukan operasional yang dipakai EOC merujuk pada penilaian risiko krisis kesehatan WHO (PHEOC). Perbandingan kuantitatif dengan negara lain tidak ditampilkan di sini karena tidak tersedia dari API EOC.`,
    },
    {
      num: '5',
      title: 'Dampak Terhadap Sistem Kesehatan Nasional',
      color: 'orange',
      body: `Beban layanan kesehatan ${cakupan} perlu dibaca bersama kesiapan PSC, ambulans, dan tenaga cadangan di provinsi terdampak. Data kerusakan faskes hanya ditampilkan bila ada di rekaman EOC. Tidak ada angka persentase beban faskes yang diisi secara otomatis karena metrik itu belum tersedia dari API.`,
    },
    {
      num: '6',
      title: 'Gap Analysis Respons Darurat',
      color: 'rose',
      body: `Titik yang perlu dicek dari data yang ada: (1) provinsi atau kab/kota dengan kejadian dan pengungsi tertinggi, (2) kesiapan PSC dan ambulans di wilayah itu, dan (3) ketersediaan tenaga cadangan. Rincian defisit logistik atau rasio toilet darurat tidak ditampilkan karena tidak ada di API EOC.`,
    },
    {
      num: '7',
      title: 'Rekomendasi Strategis Terstruktur',
      color: 'green',
      body: `Jangka pendek: pastikan layanan kesehatan dan air bersih di lokasi pengungsian, utamakan wilayah dengan korban dan pengungsi terbanyak${topWilayah ? ` (${topWilayah})` : ''}. Jangka menengah: pantau kondisi kesehatan pengungsi secara berkala dan rotasi tenaga bantuan bila diperlukan. Jangka panjang: pulihkan faskes yang tercatat rusak dan tinjau rencana kontinjensi dinas kesehatan berdasarkan data tahun ${tahun}.`,
    },
    {
      num: '8',
      title: 'Kesimpulan Strategis EOC',
      color: 'slate',
      body: `Pantauan ${tahun} ${cakupan} mencatat ${nf(terpantau)} kejadian terpantau dan ${nf(krisis)} berdampak krisis. ${jenisPhrase}. Pengawasan pada wilayah dengan pengungsi dan korban tertinggi perlu dijaga agar tidak muncul krisis kesehatan lanjutan.`,
    },
  ]

  const fullText = ['[ANALISIS RISK ASSESSMENT]', ...sections.map((s) => `${s.num}. ${s.title}\n${s.body}`)].join('\n\n')
  const preview = sections[0].body

  return { available: true, stats, sections, preview, fullText }
}
