// Definisi matriks generik untuk halaman Analisis & Matriks (agregat saja).
import { fromDashboardNew, type KejadianTerbaru } from '@/lib/puskris/kejadian-terbaru'

export type MatriksFmt = 'int' | 'pct' | 'dec1' | 'text'
export type MatriksCol = {
  key: string
  label: string
  hint?: string
  fmt?: MatriksFmt
  heat?: boolean
  group?: string
  /** nilai baris total; default jumlah untuk kolom int, kosong untuk lainnya */
  total?: (rows: any[]) => number | string | null
}
export type MatriksDef = {
  id: string
  title: string
  desc: string
  rowLabel: string
  rowHint?: string
  cols: MatriksCol[]
  rows: MatriksRow[]
  notes: string[]
  contoh?: boolean
  provinsiRows?: boolean
}
export type MatriksRow = { id: string; code?: string; label: string; sub?: string; tanggal?: string; [k: string]: any }

export type PeriodeMatriks = 'semua' | '2026' | '30hari' | '7hari'

const sum = (rows: any[], k: string) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0)
const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0)

/** Tanggal acuan WIB hari ini (YYYY-MM-DD). */
export function todayWib(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)
}
export function inPeriode(tanggal: string | null | undefined, p: PeriodeMatriks, ref = todayWib()): boolean {
  if (p === 'semua') return true
  if (!tanggal) return false
  const t = String(tanggal).slice(0, 10)
  if (p === '2026') return t.startsWith('2026')
  const days = p === '30hari' ? 30 : 7
  const from = new Date(new Date(`${ref}T00:00:00Z`).getTime() - (days - 1) * 86400_000).toISOString().slice(0, 10)
  return t >= from && t <= ref
}

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

function provNames(raw: any): Map<string, string> {
  const m = new Map<string, string>()
  for (const r of raw?.regions || []) m.set(String(r.code), String(r.name || r.nama))
  return m
}

// ---------------------------------------------------------------- 1. Tenaga Cadangan
export function matriksTck(raw: any): MatriksDef {
  const names = provNames(raw)
  const kejByCode = new Map<string, number>()
  for (const p of raw?.eoc?.provinsi || []) kejByCode.set(String(p.code), Number(p.kejadian_2026 || 0))
  const list = raw?.tck?.provinsi || []
  const totalNas = list.reduce((a: number, p: any) => a + Number(p.individu || 0), 0) || 1
  const rows: MatriksRow[] = list.map((p: any) => {
    const code = String(p.code)
    const nakes = Number(p.nakes || 0)
    const non = Number(p.non_nakes || 0)
    const ind = Number(p.individu || nakes + non)
    const kej = kejByCode.get(code) || 0
    return {
      id: `tck-${code}`, code, label: names.get(code) || p.nama, sub: `Kode ${code}`,
      nakes, non_nakes: non, individu: ind, pct_nakes: pct(nakes, ind), porsi: pct(ind, totalNas),
      kejadian_2026: kej, per_kejadian: kej > 0 ? ind / kej : 0,
    }
  })
  const s = raw?.tck?.summary || {}
  return {
    id: 'tck', provinsiRows: true,
    title: 'Matriks Tenaga Cadangan Kesehatan per Provinsi',
    desc: 'Relawan Tenaga Cadangan Kesehatan (TCK) yang terdaftar menurut provinsi domisili, dipilah tenaga kesehatan dan non-kesehatan, dibandingkan dengan beban kejadian 2026.',
    rowLabel: 'Provinsi',
    cols: [
      { key: 'nakes', label: 'Tenaga Kesehatan', hint: 'Relawan berlatar profesi kesehatan (dokter, perawat, bidan, apoteker, dan lainnya).', fmt: 'int', heat: true, group: 'Komposisi relawan' },
      { key: 'non_nakes', label: 'Non-Kesehatan', hint: 'Relawan pendukung tanpa latar profesi kesehatan (logistik, komunikasi, administrasi, dan lainnya).', fmt: 'int', heat: true, group: 'Komposisi relawan' },
      { key: 'individu', label: 'Total Individu', hint: 'Jumlah seluruh relawan perorangan yang terdaftar.', fmt: 'int', heat: true, group: 'Komposisi relawan' },
      { key: 'pct_nakes', label: '% Tenaga Kesehatan', hint: 'Porsi tenaga kesehatan dari total relawan di provinsi itu.', fmt: 'pct', heat: true, group: 'Komposisi relawan', total: (r) => pct(sum(r, 'nakes'), sum(r, 'individu')) },
      { key: 'porsi', label: '% dari Nasional', hint: 'Porsi relawan provinsi ini terhadap seluruh relawan nasional.', fmt: 'pct', group: 'Komposisi relawan', total: (r) => sum(r, 'porsi') },
      { key: 'kejadian_2026', label: 'Kejadian 2026', hint: 'Jumlah kejadian krisis kesehatan terpantau di provinsi ini sepanjang 2026 (Pusat Krisis Kesehatan).', fmt: 'int', heat: true, group: 'Kebutuhan' },
      { key: 'per_kejadian', label: 'Relawan per Kejadian', hint: 'Total relawan dibagi jumlah kejadian 2026. Makin kecil berarti cadangan relawan makin tipis terhadap beban kejadian.', fmt: 'dec1', heat: true, group: 'Kebutuhan', total: (r) => { const k = sum(r, 'kejadian_2026'); return k ? sum(r, 'individu') / k : 0 } },
    ],
    rows,
    notes: [
      `Nasional: ${(s.individu ?? 0).toLocaleString('id-ID')} individu, ${(s.tim ?? 0).toLocaleString('id-ID')} tim, dan ${(s.emt ?? 0).toLocaleString('id-ID')} Tim Medis Darurat (Emergency Medical Team/EMT). Jumlah tim dan Tim Medis Darurat baru tersedia di tingkat nasional, belum per provinsi.`,
      'Rincian per profesi (dokter, perawat, bidan, dan seterusnya) belum tersedia di sumber publik, jadi kolom profesi diringkas menjadi tenaga kesehatan dan non-kesehatan.',
      `Sumber: Dasbor Tenaga Cadangan Kesehatan, diambil ${raw?.tck?.fetched_at_wib || '-'}. Angka kumulatif pendaftaran, tidak terpengaruh rentang waktu.`,
    ],
  }
}

// ---------------------------------------------------------------- 2. Panggilan
export function matriksNcc(raw: any, periode: PeriodeMatriks): MatriksDef {
  const days = (raw?.ncc?.days || []).filter((d: any) => d.available)
  const rows: MatriksRow[] = days
    .filter((d: any) => inPeriode(d.date, periode))
    .map((d: any) => {
      const dt = new Date(`${d.date}T00:00:00Z`)
      return {
        id: `ncc-${d.date}`, label: dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }),
        sub: HARI[dt.getUTCDay()], tanggal: d.date,
        cof: Number(d.cof || 0), acd: Number(d.acd || 0), abd: Number(d.abd || 0), scr: Number(d.scr || 0),
        pct_abd: pct(Number(d.abd || 0), Number(d.cof || 0)), change: d.change == null ? 0 : Number(d.change),
      }
    })
    .sort((a: any, b: any) => String(b.tanggal).localeCompare(String(a.tanggal)))
  return {
    id: 'ncc',
    title: 'Matriks Panggilan Darurat 119 Harian (Nasional)',
    desc: 'Rekap harian panggilan ke layanan darurat 119 di Pusat Panggilan Nasional (National Command Center/NCC): masuk, terjawab, tak terjawab, dan tingkat keberhasilan layanan.',
    rowLabel: 'Tanggal', rowHint: 'Tanggal layanan (WIB) dan nama hari.',
    cols: [
      { key: 'cof', label: 'Panggilan Masuk', hint: 'Seluruh panggilan yang masuk ke 119 pada hari itu.', fmt: 'int', heat: true },
      { key: 'acd', label: 'Panggilan Terjawab', hint: 'Panggilan yang berhasil dijawab petugas.', fmt: 'int', heat: true },
      { key: 'abd', label: 'Panggilan Tak Terjawab', hint: 'Panggilan yang terputus atau ditinggalkan penelepon sebelum dijawab.', fmt: 'int', heat: true },
      { key: 'pct_abd', label: '% Tak Terjawab', hint: 'Panggilan tak terjawab dibagi panggilan masuk.', fmt: 'pct', heat: true, total: (r) => pct(sum(r, 'abd'), sum(r, 'cof')) },
      { key: 'scr', label: 'Tingkat Keberhasilan Layanan (%)', hint: 'Panggilan terjawab dibagi panggilan masuk, dalam persen.', fmt: 'pct', total: (r) => pct(sum(r, 'acd'), sum(r, 'cof')) },
      { key: 'change', label: 'Perubahan vs Hari Sebelumnya (%)', hint: 'Perubahan jumlah panggilan masuk dibanding hari sebelumnya.', fmt: 'dec1', total: () => null },
    ],
    rows,
    notes: [
      'Data hanya tersedia di tingkat nasional. Filter provinsi tidak berlaku untuk matriks ini.',
      `Baru tersedia ${days.length} hari (${days[0]?.date || '-'} s.d. ${days[days.length - 1]?.date || '-'}); rincian per jam belum ada.`,
    ],
  }
}

export function matriksPsc(raw: any): MatriksDef {
  const names = provNames(raw)
  const rows: MatriksRow[] = (raw?.psc?.provinsi || []).map((p: any) => {
    const code = String(p.code)
    const aktif = Number(p.psc_aktif || 0)
    return {
      id: `psc-${code}`, code, label: names.get(code) || p.nama, sub: `Kode ${code}`,
      panggilan: Number(p.panggilan || 0), psc_total: Number(p.psc_total || 0), psc_aktif: aktif,
      pct_aktif: pct(aktif, Number(p.psc_total || 0)), ambulans: Number(p.ambulans || 0), ambulans_aktif: Number(p.ambulans_aktif || 0),
      rs_jejaring: Number(p.rs_jejaring || 0), per_psc: aktif > 0 ? Number(p.panggilan || 0) / aktif : 0,
    }
  })
  return {
    id: 'psc', provinsiRows: true,
    title: 'Matriks Panggilan & Kesiapan PSC 119 per Provinsi',
    desc: 'Panggilan yang ditangani Pusat Pelayanan Keselamatan Terpadu (Public Safety Center/PSC 119) di daerah, beserta jumlah PSC, armada ambulans, dan rumah sakit jejaring.',
    rowLabel: 'Provinsi',
    cols: [
      { key: 'panggilan', label: 'Panggilan Ditangani', hint: 'Jumlah panggilan yang tercatat ditangani PSC 119 provinsi ini (kumulatif).', fmt: 'int', heat: true, group: 'Panggilan' },
      { key: 'per_psc', label: 'Panggilan per PSC Aktif', hint: 'Panggilan dibagi jumlah PSC aktif; gambaran beban per pos.', fmt: 'dec1', heat: true, group: 'Panggilan', total: (r) => { const a = sum(r, 'psc_aktif'); return a ? sum(r, 'panggilan') / a : 0 } },
      { key: 'psc_total', label: 'PSC Terdaftar', hint: 'Jumlah PSC 119 kabupaten/kota yang terdaftar.', fmt: 'int', heat: true, group: 'Kesiapan' },
      { key: 'psc_aktif', label: 'PSC Aktif', hint: 'PSC 119 yang berstatus aktif melayani.', fmt: 'int', heat: true, group: 'Kesiapan' },
      { key: 'pct_aktif', label: '% PSC Aktif', hint: 'PSC aktif dibagi PSC terdaftar.', fmt: 'pct', group: 'Kesiapan', total: (r) => pct(sum(r, 'psc_aktif'), sum(r, 'psc_total')) },
      { key: 'ambulans', label: 'Ambulans', hint: 'Jumlah armada ambulans yang terdaftar di PSC.', fmt: 'int', heat: true, group: 'Kesiapan' },
      { key: 'ambulans_aktif', label: 'Ambulans Aktif', hint: 'Ambulans yang sedang aktif/terhubung saat data diambil.', fmt: 'int', heat: true, group: 'Kesiapan' },
      { key: 'rs_jejaring', label: 'RS Jejaring', hint: 'Rumah sakit rujukan yang terhubung dengan PSC 119.', fmt: 'int', heat: true, group: 'Kesiapan' },
    ],
    rows,
    notes: ['Angka PSC bersifat kumulatif sejak sistem berjalan, belum bisa disaring per periode.', `Sumber: Dasbor PSC 119, diambil ${raw?.psc?.fetched_at_wib || '-'}.`],
  }
}

export function matriksKategoriPanggilan(raw: any): MatriksDef {
  const jenis = raw?.psc?.jenis_panggilan || []
  const spes = raw?.psc?.spesifikasi || []
  const tJ = jenis.reduce((a: number, c: any) => a + Number(c.jumlah || 0), 0)
  const tS = spes.reduce((a: number, c: any) => a + Number(c.jumlah || 0), 0)
  const rows: MatriksRow[] = [
    ...jenis.map((c: any, i: number) => ({ id: `jp-${i}`, label: c.nama, sub: 'Jenis panggilan', jumlah: Number(c.jumlah || 0), porsi: pct(Number(c.jumlah || 0), tJ), kelompok: 'Jenis panggilan' })),
    ...spes.map((c: any, i: number) => ({ id: `sp-${i}`, label: c.nama, sub: 'Spesifikasi kasus', jumlah: Number(c.jumlah || 0), porsi: pct(Number(c.jumlah || 0), tS), kelompok: 'Spesifikasi kasus' })),
  ]
  return {
    id: 'kategori',
    title: 'Matriks Kategori Panggilan PSC 119 (Nasional)',
    desc: 'Sebaran panggilan PSC 119 menurut jenis panggilan dan spesifikasi kasus.',
    rowLabel: 'Kategori',
    cols: [
      { key: 'kelompok', label: 'Kelompok', fmt: 'text', total: () => null },
      { key: 'jumlah', label: 'Jumlah Panggilan', hint: 'Jumlah panggilan pada kategori ini (kumulatif nasional).', fmt: 'int', heat: true, total: () => null },
      { key: 'porsi', label: '% dalam Kelompok', hint: 'Porsi kategori terhadap total kelompoknya (jenis panggilan atau spesifikasi kasus).', fmt: 'pct', heat: true, total: () => null },
    ],
    rows,
    notes: ['Kategori panggilan baru tersedia di tingkat nasional; rincian provinsi × kategori belum ada di sumber publik.'],
  }
}

// ---------------------------------------------------------------- 3. Kejadian Bencana provinsi × jenis
export function snapshotEvents(raw: any): KejadianTerbaru[] {
  const s = raw?.eoc?.dashboard_new_terbaru
  return s ? fromDashboardNew(s) : []
}

export function normJenis(j: string): string {
  const t = String(j || 'Lainnya').trim().toLowerCase()
  return t.replace(/\b\w/g, (c) => c.toUpperCase())
}

export function matriksBencana(
  raw: any,
  events: KejadianTerbaru[],
  opt: { periode: PeriodeMatriks; jenis: string[]; maxJenis?: number; sumberLive: boolean },
): MatriksDef {
  const names = provNames(raw)
  const sel = new Set(opt.jenis.map((j) => normJenis(j)))
  const ev = events.filter((e) => e.provCode && inPeriode(e.tanggal, opt.periode) && (!sel.size || sel.has(normJenis(e.jenis))))
  const byJenis = new Map<string, number>()
  for (const e of ev) byJenis.set(normJenis(e.jenis), (byJenis.get(normJenis(e.jenis)) || 0) + 1)
  const ranked = [...byJenis.entries()].sort((a, b) => b[1] - a[1])
  const max = opt.maxJenis ?? 9
  const top = ranked.slice(0, max).map(([j]) => j)
  const hasLain = ranked.length > max
  const slug = (j: string) => `j_${j.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}`
  const eocBy = new Map<string, any>()
  for (const p of raw?.eoc?.provinsi || []) eocBy.set(String(p.code), p)
  const codes = (raw?.regions || []).map((r: any) => String(r.code))
  const rows: MatriksRow[] = codes.map((code: string) => {
    const r: MatriksRow = { id: `bnc-${code}`, code, label: names.get(code) || code, sub: `Kode ${code}` }
    let tot = 0
    for (const j of top) r[slug(j)] = 0
    if (hasLain) r.j_lainnya = 0
    for (const e of ev) {
      if (e.provCode !== code) continue
      const j = normJenis(e.jenis)
      if (top.includes(j)) r[slug(j)]++
      else r.j_lainnya++
      tot++
    }
    r.peta_total = tot
    const p = eocBy.get(code) || {}
    r.kejadian_2026 = Number(p.kejadian_2026 || 0)
    r.krisis_2026 = Number(p.krisis_2026 || 0)
    r.meninggal_2026 = Number(p.meninggal_2026 || 0)
    r.pengungsi_2026 = Number(p.pengungsi_2026 || 0)
    r.terdampak_2026 = Number(p.terdampak_2026 || 0)
    r.hilang = Number(p.hilang || 0)
    r.luka_berat = Number(p.luka_berat || 0)
    r.luka_ringan = Number(p.luka_ringan || 0)
    return r
  })
  const G1 = 'Jumlah kejadian per jenis (titik peta)'
  const G2 = 'Dampak resmi 2026'
  const G3 = 'Korban kumulatif semua tahun'
  const cols: MatriksCol[] = [
    ...top.map((j) => ({ key: slug(j), label: j, fmt: 'int' as const, heat: true, group: G1, hint: `Jumlah kejadian berjenis ${j} di provinsi ini (dari titik peta Pusat Krisis Kesehatan).` })),
    ...(hasLain ? [{ key: 'j_lainnya', label: 'Lainnya', fmt: 'int' as const, heat: true, group: G1, hint: `Gabungan ${ranked.length - max} jenis kejadian lain yang lebih jarang.` }] : []),
    { key: 'peta_total', label: 'Total Titik', fmt: 'int', heat: true, group: G1, hint: 'Jumlah seluruh titik kejadian provinsi ini yang cocok dengan filter jenis dan waktu.' },
    { key: 'kejadian_2026', label: 'Kejadian Terpantau', fmt: 'int', heat: true, group: G2, hint: 'Jumlah kejadian terpantau 2026 menurut rekap resmi Pusat Krisis Kesehatan (semua jenis).' },
    { key: 'krisis_2026', label: 'Berdampak Krisis', fmt: 'int', heat: true, group: G2, hint: 'Kejadian 2026 yang menimbulkan krisis kesehatan (ada korban atau pengungsi).' },
    { key: 'meninggal_2026', label: 'Meninggal', fmt: 'int', heat: true, group: G2, hint: 'Korban meninggal dunia 2026.' },
    { key: 'pengungsi_2026', label: 'Pengungsi', fmt: 'int', heat: true, group: G2, hint: 'Penduduk yang mengungsi 2026.' },
    { key: 'terdampak_2026', label: 'Penduduk Terdampak', fmt: 'int', heat: true, group: G2, hint: 'Penduduk yang terdampak kejadian 2026.' },
    { key: 'hilang', label: 'Hilang', fmt: 'int', heat: true, group: G3, hint: 'Korban hilang, kumulatif semua tahun (data 2026 per provinsi belum tersedia).' },
    { key: 'luka_berat', label: 'Luka Berat / Rawat Inap', fmt: 'int', heat: true, group: G3, hint: 'Luka Berat/Rawat Inap (LB/RI) — korban yang perlu dirawat inap. Kumulatif semua tahun.' },
    { key: 'luka_ringan', label: 'Luka Ringan / Rawat Jalan', fmt: 'int', heat: true, group: G3, hint: 'Luka Ringan/Rawat Jalan (LR/RJ) — korban cukup dirawat jalan. Kumulatif semua tahun.' },
  ]
  return {
    id: 'bencana', provinsiRows: true,
    title: 'Matriks Kejadian Bencana per Provinsi × Jenis Kejadian',
    desc: 'Jumlah kejadian per jenis di tiap provinsi, berdampingan dengan dampak resmi 2026 (meninggal, pengungsi, terdampak) dan korban kumulatif.',
    rowLabel: 'Provinsi',
    cols,
    rows,
    notes: [
      `Kolom jenis dihitung dari ${ev.length.toLocaleString('id-ID')} titik kejadian di peta Pusat Krisis Kesehatan (${opt.sumberLive ? 'diambil langsung dari dashboard-new' : 'snapshot tersimpan'}), bukan total resmi; sebagian titik tidak punya tanggal/lokasi lengkap.`,
      'Kolom dampak resmi 2026 tidak dipilah per jenis dan tidak mengikuti rentang waktu; hilang, luka berat, dan luka ringan per provinsi untuk 2026 belum tersedia sehingga ditampilkan kumulatif.',
    ],
  }
}
