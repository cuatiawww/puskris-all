import type { Freshness, ProvinceRow, PuskrisFilter } from './types'

export const DEFAULT_FILTER: PuskrisFilter = {
  periode: 'tahun',
  tahun: 2026,
  bulan: null,
  provinsi: null,
  kabupaten: null,
}

export const nf = (v: number | null | undefined) => new Intl.NumberFormat('id-ID').format(v ?? 0)
export const pf = (v: number | null | undefined, d = 1) =>
  v === null || v === undefined || Number.isNaN(v) ? '—' : `${v.toFixed(d)}%`

const REF = new Date('2026-11-16T00:00:00+07:00')

function daysAgo(n: number) {
  const d = new Date(REF)
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function minMaxNorm(values: number[]) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min
  return (v: number) => (span <= 0 ? 0 : (v - min) / span)
}

export function applyDerive(data: any, filter: PuskrisFilter) {
  const regions: { code: string; name: string }[] = data.regions || []
  const pscBy = Object.fromEntries((data.psc?.provinsi || []).map((p: any) => [p.code, p]))
  const eocBy = Object.fromEntries((data.eoc?.provinsi || []).map((p: any) => [p.code, p]))
  const tckBy = Object.fromEntries((data.tck?.provinsi || []).map((p: any) => [p.code, p]))

  // Data langsung API EOC: kejadian per kejadian → semua filter (periode, provinsi, kab/kota) dihitung di sini.
  const evLive = data.eoc?.data_source === 'langsung' && Array.isArray(data.eoc?.events)
  const range = periodeRange(filter)
  const regionName = Object.fromEntries(regions.map((r) => [r.code, r.name]))
  const evPeriode: any[] = evLive ? data.eoc.events.filter((e: any) => e.t >= range.from && e.t <= range.to).map((e: any) => eocKejadian(e, regionName)) : []
  const evByProv: Record<string, any> = {}
  for (const k of evPeriode) {
    const a = (evByProv[k.code] ||= { kejadian_2026: 0, krisis_2026: 0, meninggal_2026: 0, pengungsi_2026: 0, terdampak_2026: 0 })
    a.kejadian_2026++; a.krisis_2026 += k.krisis ? 1 : 0; a.meninggal_2026 += k.meninggal; a.pengungsi_2026 += k.pengungsi; a.terdampak_2026 += k.terdampak
  }

  let rows: ProvinceRow[] = regions.map((r) => {
    const p = pscBy[r.code] || {}
    const e = evLive ? { ...(eocBy[r.code] || {}), kejadian_2026: 0, krisis_2026: 0, meninggal_2026: 0, pengungsi_2026: 0, terdampak_2026: 0, ...(evByProv[r.code] || {}) } : eocBy[r.code] || {}
    const t = tckBy[r.code] || {}
    return {
      code: r.code,
      nama: r.name,
      kejadian: Number(e.kejadian_2026 || 0),
      krisis: Number(e.krisis_2026 || 0),
      meninggal: Number(e.meninggal_2026 || 0),
      pengungsi: Number(e.pengungsi_2026 || 0),
      terdampak: Number(e.terdampak_2026 || 0),
      lukaBeratKum: Number(e.luka_berat || 0),
      lukaRinganKum: Number(e.luka_ringan || 0),
      hilangKum: Number(e.hilang || 0),
      panggilan: Number(p.panggilan || 0),
      pscTotal: Number(p.psc_total || 0),
      pscAktif: Number(p.psc_aktif || 0),
      ambulans: Number(p.ambulans || 0),
      tck: Number(t.individu || 0),
      tckNakes: Number(t.nakes || 0),
      tckNonNakes: Number(t.non_nakes || 0),
      tckTim: t.tim != null ? Number(t.tim) : null,
      tckEmt: t.emt != null ? Number(t.emt) : null,
      tckEmtStandar: t.emt_standar != null ? Number(t.emt_standar) : null,
      ambulansBaik: Number(p.ambulans_baik || 0),
      ambulansRusakRingan: Number(p.ambulans_rusak_ringan || 0),
      ambulansRusakBerat: Number(p.ambulans_rusak_berat || 0),
      ambulansGps: Number(p.ambulans_gps || 0),
      stok: null,
      asistensiPct: null,
      beban: 0,
      kapasitas: 0,
      kesenjangan: 0,
      indeksRespons: 0,
    }
  })

  const logLive = data.logistik?.data_source === 'langsung' && data.logistik?.provinsi_regional
  const logRegById = Object.fromEntries((data.logistik?.regional || []).map((r: any) => [r.id, r]))
  const logBy = logLive
    ? Object.fromEntries(Object.entries(data.logistik.provinsi_regional as Record<string, number>).map(([c, id]) => [c, Number(logRegById[id]?.total || 0)]))
    : Object.fromEntries((data.logistik?.regional || []).map((r) => [r.code, Number(r.total || 0)]))
  const asisBy = Object.fromEntries((data.asistensi?.wilayah?.length ? data.asistensi.wilayah : data.asistensi?.contoh_wilayah || [])
    .filter((x) => x.level === 'provinsi')
    .map((x) => [String(x.kode_wilayah).padStart(2, '0'), Number(x.poin_kapasitas_pct)]))
  rows = rows.map((r) => ({ ...r, stok: logBy[r.code] ?? null, asistensiPct: asisBy[r.code] ?? null }))

  // Indeks Kesenjangan Respons 0–100.
  // Beban = rata-rata min-max (kejadian, meninggal, pengungsi).
  // Kapasitas = rata-rata min-max indikator yang tersedia: PSC aktif, ambulans baik, TCK individu,
  // stok regional (hanya 11 regional), dan poin Asistensi (hanya wilayah yang ada di snapshot).
  // Indeks = ((beban - kapasitas + 1) / 2) × 100. Semakin tinggi (mendekati 100, merah) semakin besar kesenjangannya.
  const nBeban = [
    minMaxNorm(rows.map((r) => r.kejadian)),
    minMaxNorm(rows.map((r) => r.meninggal)),
    minMaxNorm(rows.map((r) => r.pengungsi)),
  ]
  const nPsc = minMaxNorm(rows.map((r) => r.pscAktif))
  const nAmb = minMaxNorm(rows.map((r) => r.ambulansBaik))
  const nTck = minMaxNorm(rows.map((r) => r.tck))
  const stokVals = rows.filter((r) => r.stok != null).map((r) => r.stok || 0)
  const nStok = stokVals.length ? minMaxNorm(stokVals) : null
  rows = rows.map((r) => {
    const beban = (nBeban[0](r.kejadian) + nBeban[1](r.meninggal) + nBeban[2](r.pengungsi)) / 3
    const kapParts = [nPsc(r.pscAktif), nAmb(r.ambulansBaik), nTck(r.tck)]
    if (nStok && r.stok != null) kapParts.push(nStok(r.stok))
    if (r.asistensiPct != null) kapParts.push(r.asistensiPct / 100)
    const kapasitas = kapParts.reduce((a, b) => a + b, 0) / kapParts.length
    const kesenjangan = beban - kapasitas
    const indeksRespons = Math.round(Math.max(0, Math.min(100, ((kesenjangan + 1) / 2) * 100)) * 10) / 10
    return { ...r, beban, kapasitas, kesenjangan, indeksRespons }
  })

  const selected = filter.provinsi ? rows.find((r) => r.code === filter.provinsi) || null : null
  const scoped = selected ? [selected] : rows

  const sum = (fn: (r: ProvinceRow) => number) => scoped.reduce((a, r) => a + fn(r), 0)

  const resmi = data.eoc?.nasional || {}
  const tahunKpi = resmi.kejadian_tahun || {}
  const bulanKpi = resmi.kejadian_oktober || {}
  const krisisTahun = resmi.krisis_tahun || {}
  const useBulan = filter.periode === 'bulan'
  const situasiNasional = useBulan ? bulanKpi : tahunKpi
  const situasiDariProvinsi = Boolean(selected)
  const kabU = filter.kabupaten ? filter.kabupaten.toUpperCase() : null
  const kejadianSemua: any[] | null = evLive
    ? evPeriode.filter((k) => (!filter.provinsi || k.code === filter.provinsi) && (!kabU || String(k.kabupaten).toUpperCase() === kabU))
    : null
  const situasi = kejadianSemua
    ? {
        ...rekapKejadian(kejadianSemua),
        sumber: `API EOC Pusat Krisis (langsung), ${range.label}${selected ? ` · ${selected.nama}` : ''}${filter.kabupaten ? ` · ${filter.kabupaten}` : ''}`,
        catatanPeriode: null as string | null,
      }
    : situasiDariProvinsi
    ? {
        terpantau: sum((r) => r.kejadian),
        berdampak_krisis: sum((r) => r.krisis),
        meninggal: sum((r) => r.meninggal),
        luka: null as number | null,
        luka_berat: null as number | null,
        luka_ringan: null as number | null,
        hilang: null as number | null,
        korban_total: null as number | null,
        pengungsi: sum((r) => r.pengungsi),
        terdampak: sum((r) => r.terdampak),
        sumber: 'agregat marker 2026 per provinsi (bukan KPI resmi nasional)',
        catatanPeriode: 'Angka provinsi memakai agregat marker 2026, bukan filter 7/30 hari.',
      }
    : {
        terpantau: situasiNasional.terpantau,
        berdampak_krisis: useBulan ? situasiNasional.berdampak_krisis : krisisTahun.kejadian ?? situasiNasional.berdampak_krisis,
        meninggal: useBulan ? situasiNasional.meninggal : tahunKpi.meninggal,
        luka: (situasiNasional.luka_berat || 0) + (situasiNasional.luka_ringan || 0),
        luka_berat: (situasiNasional.luka_berat ?? null) as number | null,
        luka_ringan: (situasiNasional.luka_ringan ?? null) as number | null,
        hilang: (situasiNasional.hilang ?? null) as number | null,
        korban_total: (situasiNasional.korban_total ?? null) as number | null,
        pengungsi: situasiNasional.pengungsi,
        terdampak: situasiNasional.terdampak,
        sumber: useBulan ? 'Dashboard EOC resmi, Oktober 2026' : 'Dashboard EOC resmi, tahun 2026',
        catatanPeriode: (filter.periode === '7hari' || filter.periode === '30hari') ? 'Filter 7/30 hari hanya memengaruhi tabel kejadian dan tren NCC. KPI EOC resmi tetap memakai angka tahun 2026.' : null,
      }

  const pscS = data.psc?.summary || {}
  const layanan = selected
    ? {
        panggilan: selected.panggilan,
        emergency: null as number | null,
        emergencyShare: null as number | null,
        emergencyPerkiraan: false,
        panggilanTahun: (pscS.tahun_panggilan as number | undefined) ?? null,
        scr: null as number | null,
        waktuRespons: pscS.waktu_respons_rata_rata,
        pscAktif: selected.pscAktif,
        pscTotal: selected.pscTotal,
        ambulans: selected.ambulans,
        ambulansBaik: null as number | null,
        ambulansRusakRingan: null as number | null,
        ambulansRusakBerat: null as number | null,
      }
    : {
        panggilan: pscS.total_panggilan,
        emergency: pscS.total_emergency,
        emergencyShare: pscS.emergency_share ?? (pscS.total_panggilan ? (pscS.total_emergency / pscS.total_panggilan) * 100 : null),
        emergencyPerkiraan: Boolean(pscS.emergency_perkiraan),
        panggilanTahun: (pscS.tahun_panggilan as number | undefined) ?? null,
        scr: data.ncc?.totals?.scr ?? null,
        waktuRespons: pscS.waktu_respons_rata_rata,
        pscAktif: pscS.psc_aktif,
        pscTotal: pscS.total_psc,
        ambulans: pscS.total_ambulan,
        ambulansBaik: pscS.ambulans_baik,
        ambulansRusakRingan: pscS.ambulans_rusak_ringan,
        ambulansRusakBerat: pscS.ambulans_rusak_berat,
      }

  let nccDays = (data.ncc?.days || []).filter((d: any) => d.available)
  if (filter.periode === '7hari') nccDays = nccDays.filter((d: any) => d.date >= daysAgo(7))
  if (filter.periode === '30hari') nccDays = nccDays.filter((d: any) => d.date >= daysAgo(30))
  if (filter.periode === 'bulan' && filter.bulan) {
    const prefix = `${filter.tahun}-${String(filter.bulan).padStart(2, '0')}`
    nccDays = nccDays.filter((d: any) => String(d.date).startsWith(prefix))
  }
  const nccTot = nccDays.reduce((a: any, d: any) => ({ cof: a.cof + d.cof, acd: a.acd + d.acd, abd: a.abd + d.abd }), { cof: 0, acd: 0, abd: 0 })
  const nccScr = nccTot.cof ? (nccTot.acd / nccTot.cof) * 100 : null
  if (!selected && nccScr !== null && (filter.periode === '7hari' || filter.periode === '30hari' || filter.periode === 'bulan')) {
    layanan.scr = nccScr
  }

  const tckS = data.tck?.summary || {}
  const sdm = selected
    ? { individu: selected.tck, nakes: selected.tckNakes, nonNakes: selected.tckNonNakes, tim: (selected.tckTim ?? null) as number | null, emt: (selected.tckEmt ?? null) as number | null, deltaIndividu: null as number | null }
    : { individu: tckS.individu, nakes: tckS.nakes_geojson, nonNakes: tckS.non_nakes_geojson, tim: tckS.tim, emt: tckS.emt, deltaIndividu: tckS.individu_delta_bulan }

  const logS = data.logistik?.summary || {}
  const logistikRegional = (data.logistik?.regional || []) as any[]
  const logRow = selected ? (logLive ? logRegById[data.logistik.provinsi_regional[selected.code]] : logistikRegional.find((r) => r.code === selected.code)) || null : null
  const logistik = {
    totalStok: selected ? (logRow ? logRow.total : null) : logS.total_stok,
    penerimaan: selected ? (logLive && logRow ? logRow.masuk : null) : logS.transaksi_penerimaan,
    pengeluaran: selected ? (logLive && logRow ? logRow.keluar : null) : logS.transaksi_pengeluaran,
    live: Boolean(logLive),
    regionalNama: logRow?.nama || null,
    regional: selected && !logRow ? 'Provinsi ini tidak masuk 11 regional yang dilaporkan landing Logistik.' : null,
    rows: selected && logRow ? [logRow] : logistikRegional,
  }

  const asis = data.asistensi || {}
  const asisCakupan = asis.cakupan || {}

  const from = filter.periode === '7hari' ? daysAgo(7) : filter.periode === '30hari' ? daysAgo(30) : filter.periode === 'bulan' ? `${filter.tahun}-${String(filter.bulan || 10).padStart(2, '0')}-01` : `${filter.tahun}-01-01`
  const to = filter.periode === 'bulan' ? `${filter.tahun}-${String(filter.bulan || 10).padStart(2, '0')}-31` : '9999-12-31'
  let kejadian = kejadianSemua ? kejadianSemua.filter((k) => k.krisis) : (data.eoc?.kejadian_krisis_terbaru || []).filter((k: any) => k.tanggal >= from && k.tanggal <= to)
  if (!kejadianSemua && filter.provinsi) kejadian = kejadian.filter((k: any) => k.code === filter.provinsi)
  if (!kejadianSemua && filter.kabupaten) {
    const q = filter.kabupaten.toLowerCase()
    kejadian = kejadian.filter((k: any) => String(k.kabupaten || '').toLowerCase().includes(q))
  }

  const kabOptions = evLive
    ? Array.from(new Set((data.eoc.events as any[]).filter((e) => e.t.startsWith(String(filter.tahun)) && (!filter.provinsi || e.p === filter.provinsi)).map((e) => e.bn).filter(Boolean))).sort()
    : Array.from(new Set((data.eoc?.kejadian_krisis_terbaru || [])
    .filter((k: any) => !filter.provinsi || k.code === filter.provinsi)
    .map((k: any) => k.kabupaten)
    .filter(Boolean))).sort()

  const chartBulanan = kejadianSemua
    ? Object.values(kejadianSemua.reduce((a: Record<string, any>, k: any) => {
        const b = (a[k.tanggal.slice(0, 7)] ||= { bulan: k.tanggal.slice(0, 7), label: k.tanggal.slice(0, 7), kejadian: 0, krisis: 0 })
        b.kejadian++; b.krisis += k.krisis ? 1 : 0
        return a
      }, {})).sort((x: any, y: any) => x.bulan.localeCompare(y.bulan))
    : (data.eoc?.bulanan_2026 || []).map((b: any) => ({
    bulan: b.bulan,
    label: b.bulan,
    kejadian: b.kejadian,
    krisis: b.krisis,
  }))

  const freshness: Record<string, Freshness> = {
    eoc: { sumber: 'Krisis Kesehatan / Pantauan Bencana', status: evLive ? 'langsung' : 'snapshot', at: data.eoc?.fetched_at_wib, label: data.eoc?.label, url: data.eoc?.sumber_resmi, filterable: { periode: !selected, provinsi: true, kabupaten: true } },
    psc: { sumber: 'PSC 119 & Ambulans', status: data.psc?.data_source === 'langsung' ? 'langsung' : 'snapshot', at: data.psc?.fetched_at_wib, label: data.psc?.data_source === 'langsung' ? data.psc.label : 'Snapshot kumulatif; filter periode sumber belum tersedia', url: data.psc?.sumber, filterable: { periode: false, provinsi: true, kabupaten: false } },
    ncc: { sumber: 'NCC Panggilan', status: 'snapshot', at: data.ncc?.fetched_at_wib, label: data.ncc?.label, url: data.ncc?.sumber, filterable: { periode: true, provinsi: false, kabupaten: false } },
    tck: { sumber: 'Tenaga Cadangan Kesehatan', status: data.tck?.data_source === 'langsung' ? 'langsung' : 'snapshot', at: data.tck?.fetched_at_wib, label: data.tck?.label, url: data.tck?.sumber, filterable: { periode: false, provinsi: true, kabupaten: false } },
    logistik: { sumber: 'Logistik', status: logLive ? 'langsung' : 'snapshot', at: data.logistik?.fetched_at_wib, label: data.logistik?.label, url: data.logistik?.sumber, filterable: { periode: false, provinsi: Boolean(logLive), kabupaten: false } },
    asistensi: { sumber: 'Asistensi Risiko', status: data.asistensi?.data_source === 'langsung' ? 'langsung' : 'snapshot', at: data.asistensi?.fetched_at_wib, label: data.asistensi?.label, url: data.asistensi?.sumber_provinsi, filterable: { periode: false, provinsi: false, kabupaten: false } },
  }

  const narrative = buildNarrative({ rows, selected, situasi, layanan, sdm, asisCakupan, asis, filter, resmi, nccTot, nccScr })

  return {
    generatedAt: data.generated_at_wib,
    mode: data.mode,
    filter,
    rows,
    selected,
    situasi,
    layanan,
    ncc: { days: nccDays, totals: { ...nccTot, scr: nccScr }, period: data.ncc?.period, busiest: data.ncc?.busiest_interval, quality: data.ncc?.quality },
    sdm,
    tckGrowth: selected ? null : { individuBulanIni: tckS.individu_bulan_ini, delta: tckS.individu_delta_bulan, deltaPct: tckS.individu_delta_pct, tim: tckS.tim, emt: tckS.emt },
    logistik,
    asistensi: asis,
    kejadian,
    kejadianSemua,
    eocLive: evLive,
    kabOptions,
    chartBulanan,
    jenisPanggilan: data.psc?.jenis_panggilan || [],
    tren5Tahun: { terpantau: resmi.tren_5_tahun_terpantau || [], krisis: resmi.tren_5_tahun_krisis || [] },
    freshness,
    narrative,
    rumusKesenjangan: 'Indeks Kesenjangan = skor beban dinormalisasi (0–1, rata-rata peringkat kejadian 2026, krisis 2026, meninggal 2026, pengungsi 2026, dan penduduk terdampak 2026) dikurangi skor kapasitas dinormalisasi (0–1, rata-rata peringkat PSC aktif, armada ambulans, dan tenaga cadangan individu). Nilai mendekati +1 berarti beban tinggi dengan kapasitas relatif rendah. Indeks Kesenjangan Respons (0–100) = ((beban − kapasitas + 1) / 2) × 100, dengan beban = rata-rata normalisasi min-max kejadian, meninggal, dan pengungsi; kapasitas = rata-rata normalisasi PSC aktif, ambulans baik, TCK individu, plus stok regional dan poin Asistensi jika data wilayah itu ada. Semakin tinggi (merah) semakin besar kesenjangan. Perhitungan memakai angka absolut (bukan per 10.000 penduduk) karena data penduduk resmi belum masuk ke berkas statis ini.',
  }
}

function buildNarrative(ctx: any): string[] {
  const { rows, selected, situasi, layanan, sdm, asisCakupan, asis, filter, resmi, nccTot, nccScr } = ctx
  const bullets: string[] = []
  if (selected) {
    bullets.push(`${selected.nama} mencatat ${nf(selected.kejadian)} kejadian terpantau pada 2026 (${nf(selected.krisis)} berdampak krisis), dengan ${nf(selected.meninggal)} meninggal dan ${nf(selected.pengungsi)} pengungsi.`)
    bullets.push(`Kapasitas di ${selected.nama}: ${nf(selected.pscAktif)} dari ${nf(selected.pscTotal)} PSC aktif, ${nf(selected.ambulans)} ambulans, dan ${nf(selected.tck)} tenaga cadangan individu.`)
    const ranked = [...rows].sort((a, b) => b.kesenjangan - a.kesenjangan)
    const pos = ranked.findIndex((r) => r.code === selected.code) + 1
    bullets.push(`Indeks kesenjangan ${selected.nama} berada di peringkat ${pos} dari 38 provinsi (nilai ${selected.kesenjangan.toFixed(2)}; semakin tinggi berarti beban relatif lebih besar daripada kapasitas).`)
  } else {
    const topK = [...rows].sort((a, b) => b.krisis - a.krisis).slice(0, 3)
    bullets.push(`Pada tahun 2026 tercatat ${nf(situasi.terpantau)} kejadian terpantau dan ${nf(situasi.berdampak_krisis)} yang berdampak krisis, dengan ${nf(situasi.meninggal)} meninggal dan ${nf(situasi.pengungsi)} pengungsi.`)
    bullets.push(`Tiga provinsi dengan kejadian berdampak krisis terbanyak pada 2026: ${topK.map((r: ProvinceRow) => `${r.nama} (${nf(r.krisis)})`).join(', ')}.`)
    const okt = resmi.kejadian_oktober
    if (okt && filter.periode !== 'bulan') {
      bullets.push(`Pada Oktober 2026 ada ${nf(okt.terpantau)} kejadian terpantau dan ${nf(okt.berdampak_krisis)} berdampak krisis — lebih rendah dari total tahunan, tetapi tetap perlu dipantau di Jawa Tengah, Sulawesi Utara, dan Nusa Tenggara Timur.`)
    }
    const gap = [...rows].sort((a, b) => b.kesenjangan - a.kesenjangan).slice(0, 3)
    bullets.push(`Kesenjangan terbesar (beban tinggi, kapasitas relatif rendah) terlihat di ${gap.map((r: ProvinceRow) => r.nama).join(', ')}.`)
  }
  if (nccScr !== null && !selected) {
    bullets.push(`Layanan 119 pada periode terpilih menjawab ${pf(nccScr)} dari ${nf(nccTot.cof)} panggilan masuk (tingkat keberhasilan layanan), dengan waktu respons rata-rata ${layanan.waktuRespons ?? 0} menit pada snapshot PSC.`)
  }
  if (!selected && sdm.deltaIndividu) {
    bullets.push(`Tenaga cadangan individu ${nf(sdm.individu)} orang, bertambah ${nf(sdm.deltaIndividu)} pada bulan berjalan, didukung ${nf(sdm.tim)} tim dan ${nf(sdm.emt)} Tim Medis Darurat (EMT).`)
  }
  if (!selected && asisCakupan.provinsi_pct !== undefined) {
    bullets.push(`Asistensi Risiko masih menipis pada sisi pelaporan: baru ${asisCakupan.provinsi_pct}% provinsi dan ${asisCakupan.kabkot_pct}% kabupaten/kota yang mengisi status kapasitas (${asis.data_source === 'langsung' ? `rekapitulasi ${asis.tahun || ''} langsung dari API Asistensi` : 'snapshot manual 16 November 2026'}).`)
  }
  return bullets.slice(0, 5)
}

export const LEFT_LAYERS = [
  { id: 'kejadian', label: 'Kejadian terpantau 2026' },
  { id: 'krisis', label: 'Berdampak krisis 2026' },
  { id: 'meninggal', label: 'Korban meninggal 2026' },
  { id: 'pengungsi', label: 'Pengungsi 2026' },
  { id: 'terdampak', label: 'Penduduk terdampak 2026' },
] as const

export const RIGHT_LAYERS = [
  { id: 'psc', label: 'PSC aktif' },
  { id: 'ambulans', label: 'Armada ambulans' },
  { id: 'panggilan', label: 'Panggilan 119' },
  { id: 'tck', label: 'Tenaga cadangan (individu)' },
  { id: 'kesenjangan', label: 'Indeks kesenjangan' },
] as const

export function layerValue(row: ProvinceRow, layer: string): number {
  switch (layer) {

    case 'kejadian': return row.kejadian
    case 'krisis': return row.krisis
    case 'meninggal': return row.meninggal
    case 'pengungsi': return row.pengungsi
    case 'terdampak': return row.terdampak
    case 'luka_berat': return row.lukaBeratKum
    case 'luka_ringan': return row.lukaRinganKum
    case 'hilang': return row.hilangKum
    case 'psc': return row.pscAktif
    case 'ambulans': return row.ambulans
    case 'panggilan': return row.panggilan
    case 'tck': return row.tck
    case 'tck_tim': return row.tckTim || 0
    case 'tck_emt': return row.tckEmt || 0
    case 'kesenjangan': return row.indeksRespons
    default: return 0
  }
}

/** Situasi krisis sesuai filter jenis: bila jenis dipilih, dihitung dari daftar kejadian krisis terbaru (bukan KPI resmi). */
export function situasiTerfilter(situasi: any, kejadian: any[], jenisScoped: boolean): any {
    if (!jenisScoped) return situasi
    if (kejadian.length && typeof kejadian[0]?.krisis === 'boolean') {
      return { ...rekapKejadian(kejadian), sumber: `${situasi?.sumber || 'API EOC'} · jenis terpilih`, catatanPeriode: null }
    }
    const sum = (key: string) => kejadian.reduce((a: number, k: any) => a + Number(k[key] || 0), 0)
    return {
      terpantau: kejadian.length,
      berdampak_krisis: kejadian.length,
      meninggal: sum('meninggal'),
      luka: sum('luka_berat') + sum('luka_ringan'),
      luka_berat: sum('luka_berat'),
      luka_ringan: sum('luka_ringan'),
      hilang: null,
      korban_total: sum('korban') || (sum('meninggal') + sum('luka_berat') + sum('luka_ringan') + sum('pengungsi')),
      pengungsi: sum('pengungsi'),
      terdampak: sum('terdampak'),
      sumber: 'Agregat kejadian terbaru sesuai filter jenis (bukan KPI resmi nasional)',
      catatanPeriode: 'Filter jenis kejadian memakai daftar kejadian krisis terbaru, bukan angka resmi tahunan per jenis.',
    }
  }


/** Rentang tanggal sesuai filter periode (YYYY-MM-DD, inklusif). */
export function periodeRange(filter: PuskrisFilter): { from: string; to: string; label: string } {
  if (filter.periode === '7hari') return { from: daysAgo(7), to: '9999-12-31', label: '7 hari terakhir' }
  if (filter.periode === '30hari') return { from: daysAgo(30), to: '9999-12-31', label: '30 hari terakhir' }
  if (filter.periode === 'bulan') {
    const b = String(filter.bulan || 10).padStart(2, '0')
    return { from: `${filter.tahun}-${b}-01`, to: `${filter.tahun}-${b}-31`, label: `bulan ${filter.tahun}-${b}` }
  }
  return { from: `${filter.tahun}-01-01`, to: `${filter.tahun}-12-31`, label: `tahun ${filter.tahun}` }
}

/** Kejadian ringkas API EOC → bentuk daftar kejadian dasbor. */
export function eocKejadian(e: any, regionName: Record<string, string> = {}) {
  return {
    uid: e.u, tanggal: e.t, jam: e.w || null, jenis: e.n,
    kelompok: e.k === 'A' ? 'Alam' : e.k === 'N' ? 'Non Alam' : e.k === 'S' ? 'Sosial' : 'Lainnya',
    provinsi: regionName[e.p] || e.p, code: e.p, kabupaten: e.bn, kab_code: e.b || null,
    krisis: Boolean(e.s), korban: e.kr || 0, terdampak: e.td || 0, meninggal: e.m || 0, hilang: e.h || 0,
    luka_berat: e.lb || 0, luka_ringan: e.lr || 0, pengungsi: e.pg || 0, faskes_rusak: e.fr || 0,
    lat: e.la ?? null, lon: e.lo ?? null, url: `https://pusatkrisis.kemkes.go.id/detail-bencana/${encodeURIComponent(e.u)}`,
  }
}

/** KPI situasi dari daftar kejadian (API EOC). */
export function rekapKejadian(list: any[]) {
  const s = { terpantau: list.length, berdampak_krisis: 0, meninggal: 0, hilang: 0, luka_berat: 0, luka_ringan: 0, luka: 0, korban_total: 0, pengungsi: 0, terdampak: 0, faskes_rusak: 0, alam: 0, non_alam: 0, sosial: 0 }
  for (const k of list) {
    s.berdampak_krisis += k.krisis ? 1 : 0; s.meninggal += k.meninggal; s.hilang += k.hilang; s.luka_berat += k.luka_berat; s.luka_ringan += k.luka_ringan
    s.korban_total += k.korban; s.pengungsi += k.pengungsi; s.terdampak += k.terdampak; s.faskes_rusak += k.faskes_rusak
    if (k.kelompok === 'Alam') s.alam++; else if (k.kelompok === 'Non Alam') s.non_alam++; else if (k.kelompok === 'Sosial') s.sosial++
  }
  s.luka = s.luka_berat + s.luka_ringan
  return s
}

/** Stok logistik per provinsi untuk peta: langsung = stok regional penanggung provinsi itu; snapshot = hanya provinsi lokasi gudang. */
export function logistikPerProvinsi(raw: any): Record<string, number> {
  const l = raw?.logistik || {}
  if (l.data_source === 'langsung' && l.provinsi_regional) {
    const byId = Object.fromEntries((l.regional || []).map((r: any) => [r.id, Number(r.total || 0)]))
    return Object.fromEntries(Object.entries(l.provinsi_regional as Record<string, number>).map(([c, id]) => [c, byId[id] ?? 0]))
  }
  return Object.fromEntries((l.regional || []).map((r: any) => [r.code, r.total]))
}
