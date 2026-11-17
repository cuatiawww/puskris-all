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
export type TckView = 'komposisi' | 'profesi' | 'tim-emt' | 'kabkota'
export const TCK_PROFESI_COLS = ['Tenaga Medis', 'Tenaga Keperawatan', 'Tenaga Kebidanan', 'Tenaga Kefarmasian', 'Tenaga Kesehatan Masyarakat', 'Tenaga Kesehatan Lingkungan', 'Tenaga Gizi', 'Tenaga Kesehatan Lainnya', 'Non-Kesehatan']
const PROFESI_HINT: Record<string, string> = {
  'Tenaga Medis': 'Dokter, dokter spesialis, dokter gigi.',
  'Tenaga Keperawatan': 'Perawat (ners dan vokasi).',
  'Tenaga Kebidanan': 'Bidan.',
  'Tenaga Kefarmasian': 'Apoteker dan tenaga teknis kefarmasian.',
  'Tenaga Kesehatan Masyarakat': 'Kesehatan masyarakat, promosi kesehatan, epidemiolog.',
  'Tenaga Kesehatan Lingkungan': 'Sanitarian dan kesehatan lingkungan.',
  'Tenaga Gizi': 'Nutrisionis dan dietisien.',
  'Tenaga Kesehatan Lainnya': 'Golongan kesehatan lain (laboratorium, radiografer, fisioterapis, keteknisian medis, dan lainnya).',
  'Non-Kesehatan': 'Relawan pendukung non-kesehatan (administrasi, logistik, komunikasi, manajemen data, pengemudi ambulans, dan lainnya).',
}
const slugP = (s: string) => 'pr_' + s.toLowerCase().replace(/[^a-z]+/g, '_')
const tckLive = (raw: any) => raw?.tck?.data_source === 'langsung'
const periodeTahun = (p: PeriodeMatriks) => (p === 'semua' ? null : todayWib().slice(0, 4))
const sumberTck = (raw: any) => tckLive(raw)
  ? `Sumber: API Tenaga Cadangan Kesehatan (langsung), diambil ${raw?.tck?.fetched_at_wib || '-'}.`
  : `Sumber: snapshot Dasbor Tenaga Cadangan Kesehatan, diambil ${raw?.tck?.fetched_at_wib || '-'}.`

export function matriksTck(raw: any, view: TckView = 'komposisi', periode: PeriodeMatriks = 'semua'): MatriksDef {
  const names = provNames(raw)
  const live = tckLive(raw)
  const list: any[] = raw?.tck?.provinsi || []
  const s = raw?.tck?.summary || {}
  const hasProfesi = list.some((p) => p.profesi)
  const hasTim = list.some((p) => p.tim != null)
  if (view === 'profesi' && hasProfesi) {
    const rows: MatriksRow[] = list.map((p) => {
      const code = String(p.code)
      const r: MatriksRow = { id: `tckp-${code}`, code, label: names.get(code) || p.nama, sub: `Kode ${code}`, individu: Number(p.individu || 0) }
      for (const g of TCK_PROFESI_COLS) r[slugP(g)] = Number(p.profesi?.[g] || 0)
      return r
    })
    return {
      id: 'tck-profesi', provinsiRows: true,
      title: 'Matriks Relawan Tenaga Cadangan per Provinsi × Profesi',
      desc: 'Jumlah relawan Tenaga Cadangan Kesehatan (TCK) per provinsi menurut golongan profesi, dari API relawan TCK.',
      rowLabel: 'Provinsi',
      cols: [
        ...TCK_PROFESI_COLS.map((g) => ({ key: slugP(g), label: g, hint: PROFESI_HINT[g], fmt: 'int' as const, heat: true, group: 'Golongan profesi' })),
        { key: 'individu', label: 'Total Relawan', hint: 'Jumlah seluruh relawan terdaftar di provinsi ini.', fmt: 'int', heat: true, group: 'Total' },
      ],
      rows,
      notes: [
        'Golongan dikelompokkan dari isian "golongan" relawan. Kategori Nakes/Non-Nakes di sumber bisa berbeda tipis dengan kolom Non-Kesehatan karena sebagian relawan non-nakes mengisi golongan kesehatan.',
        'Angka kumulatif pendaftaran (sumber tidak memuat tanggal daftar per relawan), jadi tidak terpengaruh rentang waktu.',
        sumberTck(raw),
      ],
    }
  }
  if (view === 'tim-emt' && hasTim) {
    const th = periodeTahun(periode)
    const rows: MatriksRow[] = list.map((p) => {
      const code = String(p.code)
      return {
        id: `tcke-${code}`, code, label: names.get(code) || p.nama, sub: `Kode ${code}`,
        tim: Number(p.tim || 0), tim_baru: th ? Number(p.tim_per_tahun?.[th] || 0) : Number(p.tim || 0), tim_individu: Number(p.tim_individu || 0),
        emt: Number(p.emt || 0), emt_baru: th ? Number(p.emt_per_tahun?.[th] || 0) : Number(p.emt || 0), emt_standar: Number(p.emt_standar || 0), emt_sk: Number(p.emt_sk || 0),
        emt_respon_24: Number(p.emt_respon_24 || 0), emt_individu: Number(p.emt_individu || 0),
      }
    })
    const lbl = th ? `Terdaftar ${th}` : 'Terdaftar (semua tahun)'
    return {
      id: 'tck-tim-emt', provinsiRows: true,
      title: `Matriks Tim & Tim Medis Darurat (EMT) per Provinsi${th ? ` · pendaftaran ${th}` : ''}`,
      desc: 'Tim relawan dan Tim Medis Darurat (Emergency Medical Team/EMT) per provinsi: jumlah, anggota, standar, surat keputusan, dan waktu respons, dari API Tenaga Cadangan.',
      rowLabel: 'Provinsi',
      cols: [
        { key: 'tim', label: 'Jumlah Tim', hint: 'Tim relawan (lembaga, organisasi profesi, NGO, institusi pendidikan, dan lainnya) yang terdaftar.', fmt: 'int', heat: true, group: 'Tim relawan' },
        { key: 'tim_baru', label: lbl, hint: 'Tim yang tanggal bergabungnya pada periode terpilih (sumber hanya mencatat tanggal bergabung tim, dihitung per tahun).', fmt: 'int', heat: true, group: 'Tim relawan' },
        { key: 'tim_individu', label: 'Anggota Tim', hint: 'Jumlah anggota yang dilaporkan seluruh tim di provinsi ini.', fmt: 'int', heat: true, group: 'Tim relawan' },
        { key: 'emt', label: 'Jumlah EMT', hint: 'Tim Medis Darurat (Emergency Medical Team/EMT) yang terdaftar.', fmt: 'int', heat: true, group: 'Tim Medis Darurat (EMT)' },
        { key: 'emt_baru', label: lbl, hint: 'EMT yang tanggal bergabungnya pada periode terpilih (dihitung per tahun).', fmt: 'int', heat: true, group: 'Tim Medis Darurat (EMT)' },
        { key: 'emt_standar', label: 'Memenuhi Standar', hint: 'EMT berstatus "Memenuhi Tipe Fixed" sesuai standar EMT.', fmt: 'int', heat: true, group: 'Tim Medis Darurat (EMT)' },
        { key: 'emt_sk', label: 'Memiliki SK', hint: 'EMT yang sudah memiliki Surat Keputusan (SK) pembentukan.', fmt: 'int', heat: true, group: 'Tim Medis Darurat (EMT)' },
        { key: 'emt_respon_24', label: 'Respons < 24 Jam', hint: 'EMT yang menyatakan sanggup diberangkatkan kurang dari 24 jam.', fmt: 'int', heat: true, group: 'Tim Medis Darurat (EMT)' },
        { key: 'emt_individu', label: 'Anggota EMT', hint: 'Jumlah anggota yang dilaporkan seluruh EMT di provinsi ini.', fmt: 'int', heat: true, group: 'Tim Medis Darurat (EMT)' },
      ],
      rows,
      notes: [
        `Nasional: ${nfm(s.tim)} tim dan ${nfm(s.emt)} EMT (${nfm(s.emt_standar)} memenuhi standar, ${nfm(s.emt_sk)} memiliki SK).`,
        periode === '30hari' || periode === '7hari' ? 'Rentang 7/30 hari tidak tersedia untuk tim/EMT; kolom "Terdaftar" memakai tahun berjalan.' : 'Kolom "Terdaftar" mengikuti filter rentang waktu per tahun bergabung.',
        'Kode provinsi tim/EMT memakai kode Kemendagri; beberapa tim tanpa provinsi tidak masuk baris mana pun.',
        sumberTck(raw),
      ],
    }
  }
  if (view === 'kabkota' && hasProfesi) {
    const rows: MatriksRow[] = []
    for (const p of list) for (const k of p.kab || []) {
      rows.push({ id: `tckk-${p.code}-${k.nama}`, code: String(p.code), label: titleKab(k.nama), sub: names.get(String(p.code)) || p.nama, individu: k.n, nakes: k.nakes, non_nakes: k.n - k.nakes, pct_nakes: pct(k.nakes, k.n) })
    }
    return {
      id: 'tck-kabkota', provinsiRows: true,
      title: 'Matriks Relawan Tenaga Cadangan per Kabupaten/Kota',
      desc: 'Relawan Tenaga Cadangan Kesehatan (TCK) per kabupaten/kota domisili, dipilah tenaga kesehatan dan non-kesehatan. Saring provinsi di panel kiri.',
      rowLabel: 'Kabupaten/Kota',
      cols: [
        { key: 'nakes', label: 'Tenaga Kesehatan', hint: 'Relawan berkategori tenaga kesehatan.', fmt: 'int', heat: true, group: 'Relawan' },
        { key: 'non_nakes', label: 'Non-Kesehatan', hint: 'Relawan berkategori non-kesehatan.', fmt: 'int', heat: true, group: 'Relawan' },
        { key: 'individu', label: 'Total', hint: 'Jumlah relawan di kab/kota ini.', fmt: 'int', heat: true, group: 'Relawan' },
        { key: 'pct_nakes', label: '% Tenaga Kesehatan', hint: 'Porsi tenaga kesehatan dari total relawan kab/kota.', fmt: 'pct', heat: true, group: 'Relawan', total: (r) => pct(sum(r, 'nakes'), sum(r, 'individu')) },
      ],
      rows,
      notes: ['Nama kab/kota mengikuti isian relawan (tanpa kode wilayah).', sumberTck(raw)],
    }
  }
  const kejByCode = new Map<string, number>()
  for (const p of raw?.eoc?.provinsi || []) kejByCode.set(String(p.code), Number(p.kejadian_2026 || 0))
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
      pct_perempuan: pct(Number(p.perempuan || 0), ind), tim: Number(p.tim || 0), emt: Number(p.emt || 0),
      kejadian_2026: kej, per_kejadian: kej > 0 ? ind / kej : 0,
    }
  })
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
      ...(live && list.some((p) => p.perempuan != null) ? [{ key: 'pct_perempuan', label: '% Perempuan', hint: 'Porsi relawan perempuan dari total relawan provinsi.', fmt: 'pct' as const, group: 'Komposisi relawan', total: (r: any[]) => { const t = sum(r, 'individu'); return t ? (r.reduce((a, x) => a + (x.pct_perempuan * x.individu) / 100, 0) / t) * 100 : 0 } }] : []),
      { key: 'porsi', label: '% dari Nasional', hint: 'Porsi relawan provinsi ini terhadap seluruh relawan nasional.', fmt: 'pct', group: 'Komposisi relawan', total: (r) => sum(r, 'porsi') },
      ...(hasTim ? [
        { key: 'tim', label: 'Tim', hint: 'Tim relawan terdaftar di provinsi ini (API data-tim).', fmt: 'int' as const, heat: true, group: 'Tim' },
        { key: 'emt', label: 'Tim Medis Darurat (EMT)', hint: 'Emergency Medical Team terdaftar di provinsi ini (API data-emt).', fmt: 'int' as const, heat: true, group: 'Tim' },
      ] : []),
      { key: 'kejadian_2026', label: 'Kejadian 2026', hint: 'Jumlah kejadian krisis kesehatan terpantau di provinsi ini sepanjang 2026 (Pusat Krisis Kesehatan).', fmt: 'int', heat: true, group: 'Kebutuhan' },
      { key: 'per_kejadian', label: 'Relawan per Kejadian', hint: 'Total relawan dibagi jumlah kejadian 2026. Makin kecil berarti cadangan relawan makin tipis terhadap beban kejadian.', fmt: 'dec1', heat: true, group: 'Kebutuhan', total: (r) => { const k = sum(r, 'kejadian_2026'); return k ? sum(r, 'individu') / k : 0 } },
    ],
    rows,
    notes: [
      `Nasional: ${nfm(s.individu)} individu, ${nfm(s.tim)} tim, dan ${nfm(s.emt)} Tim Medis Darurat (Emergency Medical Team/EMT).${hasTim ? '' : ' Jumlah tim dan EMT baru tersedia di tingkat nasional, belum per provinsi.'}`,
      live && s.individu_provinsi_total && s.individu_provinsi_total !== s.individu ? `Jumlah per provinsi (${nfm(s.individu_provinsi_total)}) berselisih ${nfm(Math.abs(s.individu_provinsi_total - s.individu))} dengan total dasbor (${nfm(s.individu)}) karena sumbernya dua endpoint berbeda.` : '',
      hasProfesi ? 'Rincian per profesi ada di tampilan "Provinsi × Profesi".' : 'Rincian per profesi belum tersedia di snapshot, jadi kolom profesi diringkas menjadi tenaga kesehatan dan non-kesehatan.',
      `${sumberTck(raw)} Angka kumulatif pendaftaran, tidak terpengaruh rentang waktu.`,
    ].filter(Boolean),
  }
}
const nfm = (n: any) => Number(n || 0).toLocaleString('id-ID')
const titleKab = (s: string) => String(s || '').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/^Kab\.?\s*/i, 'Kab. ')

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
  const live = raw?.psc?.data_source === 'langsung'
  const sm = raw?.psc?.summary || {}
  const tahun = sm.tahun_panggilan
  const rows: MatriksRow[] = (raw?.psc?.provinsi || []).map((p: any) => {
    const code = String(p.code)
    const aktif = Number(p.psc_aktif || 0)
    const pg = Number(p.panggilan || 0)
    return {
      id: `psc-${code}`, code, label: names.get(code) || p.nama, sub: `Kode ${code}`,
      panggilan: pg, pct_selesai: p.panggilan_selesai != null && pg > 0 ? pct(Number(p.panggilan_selesai), pg) : null,
      psc_total: Number(p.psc_total || 0), psc_aktif: aktif,
      pct_aktif: pct(aktif, Number(p.psc_total || 0)), ambulans: Number(p.ambulans || 0), ambulans_baik: Number(p.ambulans_baik || 0), ambulans_aktif: Number(p.ambulans_aktif || 0),
      rs_jejaring: Number(p.rs_jejaring || 0), personil: p.personil != null ? Number(p.personil) : null, per_psc: aktif > 0 ? pg / aktif : 0,
    }
  })
  const hasPersonil = rows.some((r) => r.personil != null)
  return {
    id: 'psc', provinsiRows: true,
    title: 'Matriks Panggilan & Kesiapan PSC 119 per Provinsi',
    desc: 'Panggilan yang ditangani Pusat Pelayanan Keselamatan Terpadu (Public Safety Center/PSC 119) di daerah, beserta jumlah PSC, armada ambulans, personel, dan rumah sakit jejaring.',
    rowLabel: 'Provinsi',
    cols: [
      { key: 'panggilan', label: tahun ? `Panggilan ${tahun}` : 'Panggilan Ditangani', hint: tahun ? `Jumlah laporan panggilan PSC 119 provinsi ini sepanjang ${tahun} (API PSC 119).` : 'Jumlah panggilan yang tercatat ditangani PSC 119 provinsi ini (kumulatif).', fmt: 'int', heat: true, group: 'Panggilan' },
      ...(live && tahun ? [{ key: 'pct_selesai', label: '% Selesai Ditangani', hint: 'Laporan berstatus selesai dibagi seluruh laporan panggilan provinsi ini.', fmt: 'pct' as const, group: 'Panggilan', total: () => (sm.panggilan_selesai && sm.total_panggilan ? pct(sm.panggilan_selesai, sm.total_panggilan) : null) }] : []),
      { key: 'per_psc', label: 'Panggilan per PSC Aktif', hint: 'Panggilan dibagi jumlah PSC aktif; gambaran beban per pos.', fmt: 'dec1', heat: true, group: 'Panggilan', total: (r) => { const a = sum(r, 'psc_aktif'); return a ? sum(r, 'panggilan') / a : 0 } },
      { key: 'psc_total', label: 'PSC Terdaftar', hint: 'Jumlah PSC 119 kabupaten/kota yang terdaftar.', fmt: 'int', heat: true, group: 'Kesiapan' },
      { key: 'psc_aktif', label: 'PSC Aktif', hint: 'PSC 119 yang berstatus aktif melayani.', fmt: 'int', heat: true, group: 'Kesiapan' },
      { key: 'pct_aktif', label: '% PSC Aktif', hint: 'PSC aktif dibagi PSC terdaftar.', fmt: 'pct', group: 'Kesiapan', total: (r) => pct(sum(r, 'psc_aktif'), sum(r, 'psc_total')) },
      { key: 'ambulans', label: 'Ambulans', hint: 'Jumlah armada ambulans yang terdaftar di PSC.', fmt: 'int', heat: true, group: 'Kesiapan' },
      { key: 'ambulans_baik', label: 'Ambulans Kondisi Baik', hint: 'Ambulans yang kondisi kendaraannya tercatat baik.', fmt: 'int', heat: true, group: 'Kesiapan' },
      { key: 'ambulans_aktif', label: 'Ambulans Aktif', hint: 'Ambulans berstatus aktif.', fmt: 'int', heat: true, group: 'Kesiapan' },
      ...(hasPersonil ? [{ key: 'personil', label: 'Personel PSC', hint: 'Jumlah personel PSC (perawat, bidan, dokter, pengemudi ambulans, dan lainnya).', fmt: 'int' as const, heat: true, group: 'Kesiapan' }] : []),
      { key: 'rs_jejaring', label: 'RS Jejaring', hint: 'Rumah sakit rujukan yang terhubung dengan PSC 119.', fmt: 'int', heat: true, group: 'Kesiapan' },
    ],
    rows,
    notes: live
      ? [`Sumber: API PSC 119 (langsung, ${raw?.psc?.fetched_at_wib || '-'}). Panggilan = jumlah laporan tahun ${tahun || 'berjalan'}; armada, personel, dan rumah sakit = master data saat ini.`, 'Ambulans dihitung dari armada yang tertaut ke PSC; jumlah ini bisa sedikit berbeda dengan total terdaftar di sistem PSC.']
      : ['Angka PSC bersifat kumulatif sejak sistem berjalan, belum bisa disaring per periode.', `Sumber: snapshot Dasbor PSC 119, diambil ${raw?.psc?.fetched_at_wib || '-'}.`],
  }
}

export function matriksPscHarian(raw: any, periode: PeriodeMatriks): MatriksDef | null {
  const s = raw?.psc?.panggilan_sampel
  if (!s?.harian?.length) return null
  const rows: MatriksRow[] = s.harian
    .filter((d: any) => inPeriode(d.tanggal, periode))
    .map((d: any) => {
      const dt = new Date(`${d.tanggal}T00:00:00Z`)
      return {
        id: `pscd-${d.tanggal}`, tanggal: d.tanggal,
        label: dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }),
        sub: `${HARI[dt.getUTCDay()]}${d.berjalan ? ' · hari berjalan' : ''}`,
        total: d.total, gawat_darurat: d.gawat_darurat, bukan_gawat_darurat: d.bukan_gawat_darurat, tanpa_kategori: d.tanpa_kategori,
        selesai: d.selesai, diproses: d.diproses, pct_selesai: pct(d.selesai, d.total), ambulans: d.ambulans,
      }
    })
  return {
    id: 'psc-harian',
    title: 'Matriks Laporan Panggilan PSC 119 Harian (Seluruh Daerah)',
    desc: 'Laporan panggilan yang dicatat PSC 119 kabupaten/kota per hari, dipilah jenis layanan dan status penanganan.',
    rowLabel: 'Tanggal', rowHint: 'Tanggal laporan panggilan (WIB).',
    cols: [
      { key: 'total', label: 'Total Laporan', hint: 'Semua laporan panggilan pada hari itu.', fmt: 'int', heat: true, group: 'Jenis layanan' },
      { key: 'gawat_darurat', label: 'Gawat Darurat', hint: 'Panggilan dengan kondisi gawat darurat (emergency).', fmt: 'int', heat: true, group: 'Jenis layanan' },
      { key: 'bukan_gawat_darurat', label: 'Bukan Gawat Darurat', hint: 'Permintaan layanan yang tidak gawat darurat (non-emergency), misalnya informasi atau transportasi.', fmt: 'int', heat: true, group: 'Jenis layanan' },
      { key: 'tanpa_kategori', label: 'Tanpa Kategori', hint: 'Panggilan tidak valid atau belum dikategorikan (non category).', fmt: 'int', heat: true, group: 'Jenis layanan' },
      { key: 'selesai', label: 'Selesai', hint: 'Laporan yang penanganannya sudah selesai.', fmt: 'int', heat: true, group: 'Penanganan' },
      { key: 'diproses', label: 'Diproses', hint: 'Laporan yang masih dalam proses penanganan.', fmt: 'int', heat: true, group: 'Penanganan' },
      { key: 'pct_selesai', label: '% Selesai', hint: 'Laporan selesai dibagi total laporan.', fmt: 'pct', group: 'Penanganan', total: (r) => pct(sum(r, 'selesai'), sum(r, 'total')) },
      { key: 'ambulans', label: 'Ambulans Dikerahkan', hint: 'Laporan yang tercatat memakai layanan ambulans.', fmt: 'int', heat: true, group: 'Penanganan' },
    ],
    rows,
    notes: [
      `Sumber: API PSC 119 (langsung, ${raw?.psc?.fetched_at_wib || '-'}), dari ${Number(s.jumlah || 0).toLocaleString('id-ID')} laporan terbaru (${s.dari} s.d. ${s.sampai}). API belum punya filter tanggal, jadi hanya beberapa hari terakhir yang tersedia; hari berjalan belum lengkap.`,
      'Ini laporan PSC 119 daerah, berbeda dengan Panggilan 119 Nasional (Pusat Panggilan Nasional).',
    ],
  }
}

export function matriksPscProvJenis(raw: any): MatriksDef | null {
  const s = raw?.psc?.panggilan_sampel
  if (!s?.provinsi?.length) return null
  const names = provNames(raw)
  const by = new Map<string, any>(s.provinsi.map((p: any) => [String(p.code), p]))
  const rows: MatriksRow[] = (raw?.regions || []).map((r: any) => {
    const code = String(r.code)
    const p = by.get(code) || {}
    return {
      id: `pscj-${code}`, code, label: names.get(code) || code, sub: `Kode ${code}`,
      total: Number(p.total || 0), gawat_darurat: Number(p.gawat_darurat || 0), bukan_gawat_darurat: Number(p.bukan_gawat_darurat || 0),
      tanpa_kategori: Number(p.tanpa_kategori || 0), pct_gd: pct(Number(p.gawat_darurat || 0), Number(p.total || 0)),
      selesai: Number(p.selesai || 0), ambulans: Number(p.ambulans || 0),
    }
  })
  return {
    id: 'psc-jenis', provinsiRows: true,
    title: 'Matriks Panggilan PSC 119 per Provinsi × Jenis Layanan',
    desc: 'Sebaran laporan panggilan terbaru per provinsi menurut jenis layanan, status selesai, dan pengerahan ambulans.',
    rowLabel: 'Provinsi',
    cols: [
      { key: 'total', label: 'Total Laporan', fmt: 'int', heat: true, group: 'Jenis layanan', hint: 'Laporan panggilan provinsi ini dalam rentang sampel.' },
      { key: 'gawat_darurat', label: 'Gawat Darurat', fmt: 'int', heat: true, group: 'Jenis layanan', hint: 'Panggilan dengan kondisi gawat darurat (emergency).' },
      { key: 'bukan_gawat_darurat', label: 'Bukan Gawat Darurat', fmt: 'int', heat: true, group: 'Jenis layanan', hint: 'Permintaan layanan tidak gawat darurat (non-emergency).' },
      { key: 'tanpa_kategori', label: 'Tanpa Kategori', fmt: 'int', heat: true, group: 'Jenis layanan', hint: 'Panggilan tidak valid atau belum dikategorikan.' },
      { key: 'pct_gd', label: '% Gawat Darurat', fmt: 'pct', heat: true, group: 'Jenis layanan', hint: 'Porsi panggilan gawat darurat dari total laporan.', total: (r) => pct(sum(r, 'gawat_darurat'), sum(r, 'total')) },
      { key: 'selesai', label: 'Selesai', fmt: 'int', heat: true, group: 'Penanganan', hint: 'Laporan yang penanganannya sudah selesai.' },
      { key: 'ambulans', label: 'Ambulans Dikerahkan', fmt: 'int', heat: true, group: 'Penanganan', hint: 'Laporan yang tercatat memakai layanan ambulans.' },
    ],
    rows,
    notes: [`Sumber: API PSC 119 (langsung), sampel ${Number(s.jumlah || 0).toLocaleString('id-ID')} laporan terbaru (${s.dari} s.d. ${s.sampai}); bukan total setahun. Total setahun per provinsi ada di tab PSC 119 per Provinsi.`],
  }
}

export function matriksAsistensi(raw: any, level: 'provinsi' | 'kabkota'): MatriksDef | null {
  const a = raw?.asistensi
  const list = level === 'provinsi' ? a?.wilayah : a?.wilayah_kabkota
  if (!list?.length) return null
  const rank = (s: string) => ({ Tinggi: 3, Sedang: 2, Rendah: 1 } as Record<string, number>)[s] ?? 0
  const rows: MatriksRow[] = list.map((r: any) => ({
    id: `as-${r.kode_wilayah}`, code: level === 'provinsi' ? r.kode_wilayah : r.kd_prop, kode: r.kode_wilayah,
    label: r.nama, sub: `Kode ${r.kode_wilayah}`,
    poin: Number(r.poin_kapasitas_pct || 0), status: r.status_kapasitas, status_rank: rank(r.status_kapasitas),
    irbi: r.status_risiko_irbi || r.status_risiko_irbi_2024, irbi_rank: rank(r.status_risiko_irbi || r.status_risiko_irbi_2024),
    prioritas: /tinggi/i.test(r.status_risiko_irbi || '') && /belum|rendah/i.test(r.status_kapasitas) ? 'Perlu pendampingan' : '—',
  }))
  return {
    id: level === 'provinsi' ? 'asistensi-prov' : 'asistensi-kab', provinsiRows: true,
    title: `Matriks Asistensi Risiko per ${level === 'provinsi' ? 'Provinsi' : 'Kabupaten/Kota'} (${a.tahun})`,
    desc: 'Poin dan status kapasitas hasil asesmen mandiri daerah dalam modul Asistensi, berdampingan dengan status Indeks Risiko Bencana Indonesia (IRBI).',
    rowLabel: level === 'provinsi' ? 'Provinsi' : 'Kabupaten/Kota',
    cols: [
      { key: 'poin', label: 'Poin Kapasitas (%)', hint: 'Skor kapasitas penanggulangan krisis kesehatan hasil isian daerah (0–100). 0 berarti belum mengisi.', fmt: 'dec1', heat: true, total: (r) => { const f = r.filter((x) => x.poin > 0); return f.length ? f.reduce((s2, x) => s2 + x.poin, 0) / f.length : 0 } },
      { key: 'status', label: 'Status Kapasitas', hint: 'Tinggi, Sedang, Rendah, atau Belum Mengisi.', fmt: 'text', total: (r) => `${r.filter((x) => !/belum/i.test(x.status)).length} mengisi` },
      { key: 'irbi', label: 'Indeks Risiko Bencana (IRBI)', hint: 'Status Indeks Risiko Bencana Indonesia dari BNPB untuk wilayah ini.', fmt: 'text', total: (r) => `${r.filter((x) => /tinggi/i.test(x.irbi)).length} tinggi` },
      { key: 'prioritas', label: 'Catatan', hint: 'Ditandai "Perlu pendampingan" bila risiko bencana tinggi tetapi kapasitas rendah atau belum diisi.', fmt: 'text', total: (r) => `${r.filter((x) => x.prioritas !== '—').length} wilayah` },
    ],
    rows,
    notes: [`Sumber: API rekapitulasi Asistensi ${a.tahun} (langsung, ${a.fetched_at_wib || '-'}). Baris Total untuk poin = rata-rata wilayah yang sudah mengisi.`],
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
  if (raw?.eoc?.data_source === 'langsung' && Array.isArray(raw?.eoc?.events)) return matriksBencanaLive(raw, opt)
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


/** Matriks Kejadian Bencana dari API EOC langsung: semua kolom mengikuti filter jenis & rentang waktu. */
function matriksBencanaLive(raw: any, opt: { periode: PeriodeMatriks; jenis: string[]; maxJenis?: number }): MatriksDef {
  const names = provNames(raw)
  const sel = new Set(opt.jenis.map((j) => normJenis(j)))
  const ev = (raw.eoc.events as any[]).filter((e) => inPeriode(e.t, opt.periode) && (!sel.size || sel.has(normJenis(e.n))))
  const byJenis = new Map<string, number>()
  for (const e of ev) byJenis.set(normJenis(e.n), (byJenis.get(normJenis(e.n)) || 0) + 1)
  const ranked = [...byJenis.entries()].sort((a, b) => b[1] - a[1])
  const max = opt.maxJenis ?? 9
  const top = ranked.slice(0, max).map(([j]) => j)
  const hasLain = ranked.length > max
  const slug = (j: string) => `j_${j.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}`
  const codes = (raw?.regions || []).map((r: any) => String(r.code))
  const F = ['s', 'm', 'h', 'lb', 'lr', 'pg', 'td', 'kr', 'fr'] as const
  const rows: MatriksRow[] = codes.map((code: string) => {
    const r: MatriksRow = { id: `bnc-${code}`, code, label: names.get(code) || code, sub: `Kode ${code}`, peta_total: 0 }
    for (const j of top) r[slug(j)] = 0
    if (hasLain) r.j_lainnya = 0
    for (const f of F) r[f] = 0
    for (const e of ev) {
      if (e.p !== code) continue
      const j = normJenis(e.n)
      if (top.includes(j)) r[slug(j)]++
      else r.j_lainnya++
      r.peta_total++
      for (const f of F) r[f] += Number(e[f] || 0)
    }
    return r
  })
  const G1 = 'Jumlah kejadian per jenis'
  const G2 = 'Dampak (mengikuti filter)'
  const cols: MatriksCol[] = [
    ...top.map((j) => ({ key: slug(j), label: j, fmt: 'int' as const, heat: true, group: G1, hint: `Jumlah kejadian berjenis ${j} di provinsi ini.` })),
    ...(hasLain ? [{ key: 'j_lainnya', label: 'Lainnya', fmt: 'int' as const, heat: true, group: G1, hint: `Gabungan ${ranked.length - max} jenis kejadian lain yang lebih jarang.` }] : []),
    { key: 'peta_total', label: 'Total Kejadian', fmt: 'int', heat: true, group: G1, hint: 'Jumlah kejadian terpantau provinsi ini yang cocok dengan filter jenis dan waktu.' },
    { key: 's', label: 'Berdampak Krisis', fmt: 'int', heat: true, group: G2, hint: 'Kejadian berstatus krisis kesehatan di sumber (status_krisis).' },
    { key: 'm', label: 'Meninggal', fmt: 'int', heat: true, group: G2, hint: 'Korban meninggal dunia.' },
    { key: 'h', label: 'Hilang', fmt: 'int', heat: true, group: G2, hint: 'Korban yang belum ditemukan.' },
    { key: 'lb', label: 'Luka Berat / Rawat Inap', fmt: 'int', heat: true, group: G2, hint: 'Luka Berat/Rawat Inap (LB/RI): korban yang perlu dirawat inap.' },
    { key: 'lr', label: 'Luka Ringan / Rawat Jalan', fmt: 'int', heat: true, group: G2, hint: 'Luka Ringan/Rawat Jalan (LR/RJ): korban yang cukup dirawat jalan.' },
    { key: 'pg', label: 'Pengungsi', fmt: 'int', heat: true, group: G2, hint: 'Penduduk yang mengungsi.' },
    { key: 'kr', label: 'Korban Total', fmt: 'int', heat: true, group: G2, hint: 'Jumlah korban di sumber (jml_korban) = meninggal + hilang + LB/RI + LR/RJ + pengungsi.' },
    { key: 'td', label: 'Penduduk Terdampak', fmt: 'int', heat: true, group: G2, hint: 'Penduduk di wilayah kejadian yang terkena dampak.' },
    { key: 'fr', label: 'Faskes Rusak', fmt: 'int', heat: true, group: G2, hint: 'Jumlah fasilitas pelayanan kesehatan (faskes) yang rusak akibat kejadian.' },
  ]
  return {
    id: 'bencana', provinsiRows: true,
    title: 'Matriks Kejadian Bencana per Provinsi × Jenis Kejadian',
    desc: 'Jumlah kejadian per jenis dan dampaknya (korban, pengungsi, terdampak, faskes rusak) di tiap provinsi, langsung dari API EOC Pusat Krisis Kesehatan.',
    rowLabel: 'Provinsi',
    cols,
    rows,
    notes: [
      `${ev.length.toLocaleString('id-ID')} kejadian dari API EOC (data_krisis), diambil ${raw.eoc.fetched_at_wib || '-'}. Semua kolom mengikuti filter jenis dan rentang waktu.`,
      `Data langsung mencakup ${raw.eoc.events_dari || '-'} s.d. ${raw.eoc.events_sampai || '-'}; pilihan "Semua Waktu" sama dengan rentang itu.`,
      'Angka dampak diambil dari isian terakhir tiap kejadian; bisa berbeda dengan KPI dashboard-new (lihat catatan di Open Data).',
    ],
  }
}
