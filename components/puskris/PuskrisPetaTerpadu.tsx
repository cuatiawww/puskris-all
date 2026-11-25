'use client'

// Peta spasial terpadu Pusat Krisis Kesehatan: dipakai di Ringkasan (variant "card") dan Spatial Mode (variant "fullscreen").
// Seluruh state lapisan, dok kiri (Analisa / Kejadian Terbaru / Terpadu) dan pengaturan lapisan ada di sini supaya tidak terduplikasi.
import { logistikPerProvinsi, periodeRange } from '@/lib/puskris/derive'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Ambulance, Hospital, PhoneCall, ChevronLeft, ChevronRight, Crosshair, Layers, ListTree, MapPin, Maximize2, Minimize2, Settings, Shapes, Wind, X } from 'lucide-react'
import SpasialPanel from '@/components/spasial/SpasialPanel'
import { DEFAULT_LAYERS, type Focus, type Layers as MapLayers, type IntelLayerStatus } from '@/components/spasial/SpasialMap'
import { defaultFilter, type AFilter } from '@/lib/analisa-api'
import { type Area as SpasialArea, type Metric, type Titik } from '@/lib/spasial-api'
import { useChoroConfig } from '@/lib/choropleth-classes'
import { PUBLIC_BASE_PATH } from '@/lib/public-path'
import { CHORO_OPTIONS, METRIC_PILLS, centroidsFromGeo, toSpasial, type Centroids, type ChoroId } from '@/lib/puskris/to-spasial'
import { toDeriveFilter, type PuskrisUiFilter } from '@/lib/puskris/ui-filter'
import KejadianTerpaduCard from '@/components/puskris/KejadianTerpaduCard'
import KejadianTerbaruList from '@/components/puskris/KejadianTerbaruList'
import PetaAnalitikPanel from '@/components/puskris/PetaAnalitikPanel'
import KejadianSituasiDock, { KejadianAnalitikDock, KejadianKesiapanDock, KejadianRisikoDock } from '@/components/puskris/KejadianDock'
import { buildKejadianMapLayers, DEFAULT_SEKITAR, type SekitarToggles } from '@/lib/puskris/kejadian-map-layers'
import InfoHint from '@/components/puskris/InfoHint'
import KategoriBencanaFilter from '@/components/puskris/KategoriBencanaFilter'
import { hitungKategori, katOf, type JenisRow, type KategoriId } from '@/lib/puskris/kategori-bencana'
import { BNPB_LAYERS, INTEL_LAYER_APIS, type BnpbLayerId, type BnpbStatus, type IntelLayerId } from '@/lib/puskris/open-data'
import { KORBAN_LABEL } from '@/lib/puskris/labels'
import { buildInternalLayers, DEFAULT_INTERNAL, type InternalLayerToggles } from '@/lib/puskris/internal-layers'
import { buildEocEventLayer, kejadianHref, wilayahHref } from '@/lib/puskris/eoc-event-layer'
import ApiKosong from '@/components/puskris/ApiKosong'
import { buildRisikoAsistensi, asistensiTersedia, type RisikoAsisMode, type RisikoAsisLevel } from '@/lib/puskris/risiko-asistensi'
import { buildRisikoPie, pieDiseaseOptions, pieNamaKey, PIE_YEARS, PIE_TAHUN_BAWAAN, type PieDiseaseOption, type PiePayload } from '@/lib/puskris/risiko-pie'
import { buildKabNumeric, kabNetral } from '@/lib/puskris/kab-drill'
import { RISIKO_LAYERS } from '@/lib/puskris/risiko-layers'
import { asistensiWilayah, attachTimEstimate, titikFasilitas, buildTerpadu, countRadius } from '@/lib/puskris/integrasi'

const SpasialMap = dynamic(() => import('@/components/spasial/SpasialMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-slate-50 text-xs font-bold text-slate-400">
      Memuat peta…
    </div>
  ),
})

const GEO_URL = `${PUBLIC_BASE_PATH}/data/indonesia-38-provinces.geojson`

const nfi = (n: number | undefined | null) => Number(n || 0).toLocaleString('id-ID')

export function periodeLabel(f: PuskrisUiFilter) {
  return periodeRange(toDeriveFilter(f)).label.replace(/^tahun /, 'Tahun ')
}

export default function PuskrisPetaTerpadu({
  raw, f, onApply, derived, kejadian, selectedEvent, setSelectedEvent, variant = 'card', hudExtra, hudTitle,
  mode = 'dasbor', fokusKejadian = null, fokusWilayah = null, kejadianPaket = null, embed = false, rightDockDefaultOpen, onRisikoControl,
}: {
  raw: any
  f: PuskrisUiFilter
  onApply: (next: PuskrisUiFilter) => void
  derived: any
  kejadian: any[]
  selectedEvent: any | null
  setSelectedEvent: (k: any | null) => void
  /** "card" = kartu di Ringkasan (tinggi 500px). "fullscreen" = Spatial Mode, peta memenuhi wadah dengan panel mengambang. */
  variant?: 'card' | 'fullscreen'
  /** Isi tambahan di bilah atas mode layar penuh (mis. strip KPI ringkas). */
  hudExtra?: ReactNode
  /** Judul + navigasi di kiri bilah atas mode layar penuh. */
  hudTitle?: ReactNode
  /** "kejadian" = halaman detail: peta terfokus ke satu kejadian, dok kiri menampilkan situasinya. "wilayah" = hanya kejadian di satu provinsi/kab. */
  mode?: 'dasbor' | 'kejadian' | 'wilayah'
  fokusKejadian?: any | null
  fokusWilayah?: { code: string; nama?: string; kab?: string | null } | null
  kejadianPaket?: { status?: any; nearby?: any; risiko?: any; riwayat?: any; rekomendasi?: any[]; konteks?: any } | null
  /** Kartu peta di halaman detail: isi wadah induk, tanpa judul kartu dan tanpa dok kiri. */
  embed?: boolean
  /** Buka dok "Pengaturan Lapisan" secara bawaan walau mode embed aktif. */
  rightDockDefaultOpen?: boolean
  onRisikoControl?: (ctrl: { showAsis: (mode: 'irbi' | 'kapasitas') => void; showPie: () => void }) => void
}) {
  const full = variant === 'fullscreen'
  const [centroids, setCentroids] = useState<Centroids>({})
  useEffect(() => {
    let on = true
    fetch(GEO_URL).then((r) => r.json()).then((fc) => { if (on) setCentroids(centroidsFromGeo(fc)) }).catch(() => {})
    return () => { on = false }
  }, [])

  const [metric, setMetric] = useState<Metric>('kasus')
  const [choro, setChoro] = useState<ChoroId>('kejadian')
  const [layers, setLayers] = useState<MapLayers>({ ...DEFAULT_LAYERS, base: 'osm' })
  const [leftDockOpen, setLeftDockOpen] = useState(!embed)
  const [rightDockOpen, setRightDockOpen] = useState(rightDockDefaultOpen ?? !embed)
  const [sel, setSel] = useState<SpasialArea | null>(null)
  const [focus, setFocus] = useState<Focus | null>(null)
  const [pointOpacity, setPointOpacity] = useState(1)
  const [adminBoundaries, setAdminBoundaries] = useState(true)
  const [windFlow, setWindFlow] = useState(false)
  const [intelLayers, setIntelLayers] = useState({ fires: false, hazards: false })
  const [intelStatus, setIntelStatus] = useState<Partial<Record<IntelLayerId, IntelLayerStatus>>>({})
  const onIntelStatus = useCallback((id: IntelLayerId, st: IntelLayerStatus) => setIntelStatus((prev) => ({ ...prev, [id]: st })), [])
  const [bnpbLayers, setBnpbLayers] = useState<Partial<Record<BnpbLayerId, boolean>>>({})
  const [bnpbStatus, setBnpbStatus] = useState<Partial<Record<BnpbLayerId, BnpbStatus>>>({})
  const onBnpbStatus = useCallback((id: BnpbLayerId, st: BnpbStatus) => setBnpbStatus((prev) => (prev[id]?.state === st.state && prev[id]?.message === st.message ? prev : { ...prev, [id]: st })), [])
  const [dockTab, setDockTab] = useState<'analisa' | 'terbaru' | 'terpadu' | 'analitik' | 'situasi' | 'kesiapan' | 'risiko'>(mode === 'kejadian' ? 'situasi' : 'analisa')
  const [sekitar, setSekitar] = useState<SekitarToggles>(mode === 'kejadian' ? { ...DEFAULT_SEKITAR, riwayat: false } : DEFAULT_SEKITAR)
  const [terbaruCount, setTerbaruCount] = useState<number | null>(null)
  const [radiusOn, setRadiusOn] = useState(true)
  const [internal, setInternal] = useState<InternalLayerToggles>(DEFAULT_INTERNAL)
  // Filter Dasbor "Status" (PSC aktif / ambulans siap) menyalakan lapisan terkait di peta.
  useEffect(() => {
    if (f.status === 'aktif') setInternal((p) => ({ ...p, psc: true, pscAktifOnly: true }))
    else if (f.status === 'siap') setInternal((p) => ({ ...p, ambulans: true, ambSiapOnly: true }))
    else setInternal((p) => ({ ...p, pscAktifOnly: false, ambSiapOnly: false }))
  }, [f.status])
  const internalPack = useMemo(() => buildInternalLayers(raw, f, internal), [raw, f, internal])
  const iInfo = internalPack.info
  const baseChoro = useChoroConfig()
  const RED_CHORO = { mode: 'quantile' as const, zeroColor: '#FDE8E8', colors: ['#FECACA', '#F87171', '#DC2626', '#7F1D1D'], quantiles: [0.25, 0.5, 0.75] }
  const choroCfg = choro === 'kesenjangan' ? RED_CHORO : baseChoro

  const setPill = (key: Metric, nextChoro: ChoroId) => {
    setMetric(key)
    setChoro(nextChoro)
  }

  const logistikByCode = useMemo(() => logistikPerProvinsi(raw), [raw])
  const asistensiByCode = useMemo(
    () => Object.fromEntries(asistensiWilayah(raw).map((r: any) => [String(r.kode_wilayah).padStart(2, '0'), r.poin_kapasitas_pct])),
    [raw],
  )

  // Filter lapisan: kategori & jenis bencana (dari data EOC yang sudah tersaring Filter Dasbor).
  const [katOff, setKatOff] = useState<Set<KategoriId>>(new Set())
  // Risiko Krisis Kesehatan (API Asistensi): satu arsiran kategorikal aktif pada satu waktu.
  const [risikoAsis, setRisikoAsis] = useState<RisikoAsisMode | null>(null)
  // Risiko Emerging (API Peta Risiko PIE Kemenkes)
  const [risikoPie, setRisikoPie] = useState<boolean>(false)
  const [pieDisease, setPieDisease] = useState<PieDiseaseOption>('all')
  // Tahun PIE: mengikuti tahun Filter Dasbor bila tersedia di PIE, bisa diganti lewat pilihan tahun di kartu lapisan.
  const tahunPieAwal = (PIE_YEARS as readonly number[]).includes(f.tahun) ? f.tahun : PIE_TAHUN_BAWAAN
  const [pieYear, setPieYear] = useState<number>(tahunPieAwal)
  useEffect(() => { setPieYear(tahunPieAwal) }, [tahunPieAwal])
  // Hasil API per tahun (tidak pernah menampilkan data tahun lain saat tahun terpilih gagal / sedang dimuat).
  const [pieByYear, setPieByYear] = useState<Record<number, { data?: PiePayload; error?: string; loading?: boolean }>>({})
  useEffect(() => {
    if (pieByYear[pieYear]?.data) return
    let alive = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const ambil = (coba: number) => {
      setPieByYear((m) => ({ ...m, [pieYear]: { loading: true } }))
      fetch(`${PUBLIC_BASE_PATH}/api/puskris/live/pie?tahun=${pieYear}`)
        .then(async (r) => ({ status: r.status, j: await r.json().catch(() => null) }))
        .then(({ status, j }) => {
          if (!alive) return
          if (j?.ok && j?.data && Number(j.data.tahun) === pieYear) setPieByYear((m) => ({ ...m, [pieYear]: { data: j.data } }))
          else if ((status === 202 || j?.pending) && coba < 8) timer = setTimeout(() => ambil(coba + 1), 5000)
          else setPieByYear((m) => ({ ...m, [pieYear]: { error: j?.error || `HTTP ${status}` } }))
        })
        .catch((e) => { if (alive) setPieByYear((m) => ({ ...m, [pieYear]: { error: String(e?.message || e) } })) })
    }
    ambil(0)
    return () => { alive = false; if (timer) clearTimeout(timer) }
  }, [pieYear]) // eslint-disable-line react-hooks/exhaustive-deps
  const pieState = pieByYear[pieYear] || { loading: true }
  const pieData = pieState.data && pieState.data.records.length ? pieState.data : null
  const [risikoLevel, setRisikoLevel] = useState<RisikoAsisLevel>('provinsi')
  useEffect(() => {
    if (!onRisikoControl) return
    onRisikoControl({
      showAsis: (m) => { setRisikoPie(false); setRisikoAsis(m); setRisikoLevel('provinsi'); setLayers((prev) => ({ ...prev, choro: true })) },
      showPie: () => { setRisikoAsis(null); setRisikoPie(true); setRisikoLevel('provinsi'); setLayers((prev) => ({ ...prev, choro: true })) },
    })
  }, [onRisikoControl])

  const asisOk = asistensiTersedia(raw)
  const pieOk = Boolean(pieData)
  const pieOpsi = useMemo(() => pieDiseaseOptions(pieData), [pieData])
  useEffect(() => { if (pieData && !pieOpsi.some((o) => o.id === pieDisease)) setPieDisease('all') }, [pieData, pieOpsi, pieDisease])
  const provKode = f.provinsi ? String(f.provinsi).padStart(2, '0') : null
  const catChoro = useMemo(() => {
    if (risikoAsis) return buildRisikoAsistensi(raw, risikoAsis, risikoLevel, provKode)
    if (risikoPie) return buildRisikoPie(pieData, pieDisease, risikoLevel, provKode)
    return null
  }, [raw, risikoAsis, risikoPie, pieData, pieDisease, risikoLevel, provKode])
  const legendAsis = useMemo(() => ({
    kapasitas: asisOk ? buildRisikoAsistensi(raw, 'kapasitas', risikoLevel, provKode)?.legend || [] : [],
    irbi: asisOk ? buildRisikoAsistensi(raw, 'irbi', risikoLevel, provKode)?.legend || [] : [],
  }), [raw, asisOk, risikoLevel, provKode])
  const legendPie = useMemo(() => (pieData ? buildRisikoPie(pieData, pieDisease, risikoLevel, provKode)?.legend || [] : []), [pieData, pieDisease, risikoLevel, provKode])
  const [jenisOff, setJenisOff] = useState<Set<string>>(new Set())
  const katHitung = useMemo(() => hitungKategori(kejadian || []), [kejadian])
  const kejadianPeta = useMemo(
    () => (katOff.size || jenisOff.size ? (kejadian || []).filter((k: any) => !katOff.has(katOf(k)) && !jenisOff.has(String(k.jenis || 'Tanpa jenis'))) : kejadian || []),
    [kejadian, katOff, jenisOff],
  )
  const onKategori = (id: KategoriId, on: boolean) => {
    setKatOff((s) => { const n = new Set(s); if (on) n.delete(id); else n.add(id); return n })
    if (on) setJenisOff((s) => { const n = new Set(s); katHitung.jenis.filter((r) => r.kategori === id).forEach((r) => n.delete(r.jenis)); return n })
  }
  const onJenis = (r: JenisRow, on: boolean) => {
    if (on && katOff.has(r.kategori)) {
      // menyalakan satu jenis di kategori yang mati: kategori dinyalakan, jenis lain di kategori itu tetap mati
      setKatOff((s) => { const n = new Set(s); n.delete(r.kategori); return n })
      setJenisOff((s) => { const n = new Set(s); katHitung.jenis.filter((x) => x.kategori === r.kategori && x.jenis !== r.jenis).forEach((x) => n.add(x.jenis)); n.delete(r.jenis); return n })
      return
    }
    setJenisOff((s) => { const n = new Set(s); if (on) n.delete(r.jenis); else n.add(r.jenis); return n })
  }
  const eocLive = (raw as any)?.eoc?.data_source === 'langsung'

  const mapPack = useMemo(() => toSpasial({
    rows: derived.rows,
    kejadian: kejadianPeta,
    choro,
    centroids,
    filter: f,
    logistikByCode,
    asistensiByCode,
    ringkasanLabel: f.jenis ? `Jenis: ${f.jenis}` : 'Semua jenis kejadian',
    periodeLabel: periodeLabel(f),
    interpretasi: derived.narrative || [],
    raw,
  }), [derived.rows, derived.narrative, kejadianPeta, choro, centroids, f, logistikByCode, asistensiByCode, raw])

  const choroLabel = CHORO_OPTIONS.find((o) => o.id === choro)?.label || 'Kejadian terpantau'
  const data = mapPack.data
  const titik = mapPack.titik
  const activeMetric = mapPack.metric as Metric
  // ── Telusur provinsi: klik provinsi → zoom, provinsi lain redup, arsiran + batas kab/kota provinsi itu ──
  const [drillProv, setDrillProv] = useState<string | null>(provKode)
  useEffect(() => {
    if (mode !== 'kejadian') return
    const ev = fokusKejadian
    if (!ev) return
    const lat = ev.koordinat?.lat ?? ev.lat
    const lon = ev.koordinat?.lon ?? ev.lon
    const applyFocus = () => {
      if (lat != null && lon != null) setFocus({ lat, lon, zoom: 10, nonce: Date.now() })
    }
    applyFocus()
    const timers = [80, 300, 600, 1800].map((ms) => setTimeout(applyFocus, ms))
    setRadiusOn(true)
    setInternal((prev) => ({ ...prev, psc: true, ambulans: true }))
    setDockTab('situasi')
    const jenis = String(ev.jenis || '')
    if (/karhutla|kebakaran/i.test(jenis)) setIntelLayers((prev) => ({ ...prev, fires: true }))
    if (/gempa|tsunami|gunung|letusan|banjir/i.test(jenis)) setIntelLayers((prev) => ({ ...prev, hazards: true }))
    setSelectedEvent(ev)
    return () => { timers.forEach(clearTimeout) }
  }, [mode, fokusKejadian?.uid]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (mode !== 'kejadian' && mode !== 'wilayah') setDrillProv(provKode) }, [provKode, mode])
  useEffect(() => {
    if (mode !== 'wilayah' || !fokusWilayah?.code) return
    setDrillProv(String(fokusWilayah.code).replace(/\D/g, '').padStart(2, '0').slice(0, 2))
    setRadiusOn(false)
    setDockTab('analitik')
  }, [mode, fokusWilayah?.code])
  const drillNama = drillProv ? (derived.rows.find((r: any) => r.code === drillProv)?.nama || (raw?.regions || []).find((r: any) => String(r.code) === drillProv)?.name || drillProv) : ''
  const kejadianSemuaPeta = useMemo(() => {
    const all: any[] | null = (derived as any).kejadianSemua || null
    if (!all) return null
    return all.filter((k: any) => (!f.jenis || k.jenis === f.jenis) && !katOff.has(katOf(k)) && !jenisOff.has(String(k.jenis || 'Tanpa jenis')))
  }, [derived, f.jenis, katOff, jenisOff])
  const drillCat = useMemo(() => {
    if (!drillProv) return null
    if (risikoAsis) return buildRisikoAsistensi(raw, risikoAsis, 'kabkota', drillProv) || kabNetral(drillProv, 'Risiko Asistensi', 'Data Asistensi kab/kota belum tersedia dari API.')
    if (risikoPie) return (pieData && buildRisikoPie(pieData, pieDisease, 'kabkota', drillProv)) || kabNetral(drillProv, 'Risiko Emerging (PIE)', 'Data PIE kab/kota untuk provinsi ini belum tersedia dari API.')
    return buildKabNumeric({ prov: drillProv, choro, label: choroLabel, metric: activeMetric, cfg: choroCfg, kejadianSemua: kejadianSemuaPeta, kejadianKrisis: kejadianPeta, raw })
  }, [drillProv, risikoAsis, risikoPie, pieData, pieDisease, raw, choro, choroLabel, activeMetric, choroCfg, kejadianSemuaPeta, kejadianPeta])
  const keluarDrill = useCallback(() => {
    setDrillProv(null)
    setSel(null)
    if (mode === 'kejadian' || mode === 'wilayah') return
    setSelectedEvent(null)
    if (f.provinsi) onApply({ ...f, provinsi: null, kabupaten: null })
  }, [f, onApply, setSelectedEvent, mode])

  const fokusProv = String(fokusWilayah?.code || '').replace(/\D/g, '')
  const alreadyThisProv = mode === 'wilayah' && !fokusWilayah?.kab && fokusProv.length > 0 && fokusProv.length <= 2 && fokusProv.padStart(2, '0').slice(0, 2) === drillProv
  const selKabDigits = String(sel?.code || '').replace(/\D/g, '')
  const selKabCode = selKabDigits.length >= 3 ? selKabDigits.padStart(4, '0').slice(0, 4) : ''
  const fokusKab = String(fokusWilayah?.kab || (fokusProv.length >= 3 ? fokusProv : '') || '').replace(/\D/g, '')
  const alreadyThisKab = mode === 'wilayah' && Boolean(selKabCode) && fokusKab.padStart(4, '0').slice(0, 4) === selKabCode
  const drillWilayah = drillProv ? {
    prov: drillProv,
    nama: drillNama,
    onExit: mode === 'wilayah' ? undefined : keluarDrill,
    wilayahHref: alreadyThisProv ? undefined : wilayahHref(drillProv, { tahun: f.tahun, jenis: f.jenis }),
    wilayahLabel: `Lihat Provinsi ${drillNama || drillProv}`,
    kabHref: selKabCode && !alreadyThisKab ? wilayahHref(selKabCode, { tahun: f.tahun, jenis: f.jenis }) : undefined,
    kabLabel: selKabCode ? `Lihat Kab/Kota ${sel?.nama || selKabCode}` : undefined,
  } : null

  const aFilter = useMemo<AFilter>(() => ({ ...defaultFilter(), sumber: 'ebs' }), [])
  const eocLayer = useMemo(() => {
    let list = (mode === 'kejadian' && fokusKejadian) ? [fokusKejadian] : (kejadianSemuaPeta || kejadianPeta || [])
    if (mode === 'wilayah' && fokusWilayah?.code) {
      const prov = String(fokusWilayah.code).replace(/\D/g, '').padStart(2, '0').slice(0, 2)
      const kab = fokusWilayah.kab ? String(fokusWilayah.kab).replace(/\D/g, '').padStart(4, '0').slice(0, 4) : ''
      list = list.filter((k: any) => {
        if (String(k.code || '').replace(/\D/g, '').padStart(2, '0').slice(0, 2) !== prov) return false
        if (!kab) return true
        return String(k.kab_code || '').replace(/\D/g, '').padStart(4, '0').slice(0, 4) === kab
      })
    }
    return buildEocEventLayer(list, centroids, layers.points !== 'off')
  }, [mode, fokusKejadian, fokusWilayah, kejadianSemuaPeta, kejadianPeta, centroids, layers.points])
  const totalTitik = eocLayer.points.length
  const kejadianLayers = useMemo(
    () => (mode === 'kejadian' ? buildKejadianMapLayers({ raw, fokus: fokusKejadian, riwayat: kejadianPaket?.riwayat, konteks: kejadianPaket?.konteks, toggles: sekitar }) : []),
    [mode, raw, fokusKejadian, kejadianPaket?.riwayat, kejadianPaket?.konteks, sekitar],
  )
  const mapExtraLayers = useMemo(() => [...internalPack.layers, eocLayer, ...kejadianLayers], [internalPack.layers, eocLayer, kejadianLayers])
  const pieKab = useMemo(() => {
    if (mode !== 'kejadian' || !pieData || !fokusKejadian) return null
    const kabCode = fokusKejadian.kab_code ? String(fokusKejadian.kab_code).padStart(4, '0') : ''
    const kabNama = pieNamaKey(String(fokusKejadian.kabupaten || ''))
    const rows = pieData.records.filter((r) => {
      const kd = String(r.kode_kemendagri || r.kode_kako || '').replace(/\D/g, '').padStart(4, '0')
      if (kabCode && kd === kabCode) return true
      return Boolean(kabNama && pieNamaKey(r.nama_kako) === kabNama)
    })
    return rows.map((r) => ({ disease: r.penyakit_nama, status: r.status_label }))
  }, [mode, pieData, fokusKejadian])

  const selectedRow = sel ? derived.rows.find((r) => r.code === sel.code) || null : (f.provinsi ? derived.selected : null)
  const terpadu = useMemo(() => buildTerpadu({
    row: selectedRow || null,
    kejadian,
    raw,
    layananNasional: derived.layanan,
    sdmNasional: derived.sdm,
    selectedEvent,
  }), [selectedRow, kejadian, raw, derived.layanan, derived.sdm, selectedEvent])
  const radiusCenter = (mode === 'kejadian' && (fokusKejadian?.koordinat?.lat != null || fokusKejadian?.lat != null))
    ? { lat: fokusKejadian.koordinat?.lat ?? fokusKejadian.lat, lon: fokusKejadian.koordinat?.lon ?? fokusKejadian.lon }
    : (selectedRow && centroids[selectedRow.code] ? centroids[selectedRow.code] : (mapPack.titik[0] ? { lat: mapPack.titik[0].lat, lon: mapPack.titik[0].lon } : null))
  const radiusCounts = useMemo(() => {
    if (!radiusCenter) return null
    const rawCounts = countRadius(radiusCenter, derived.rows, centroids, titikFasilitas(raw))
    return attachTimEstimate(rawCounts, derived.sdm?.tim ?? null, derived.sdm?.individu || 1, derived.rows)
  }, [radiusCenter, derived.rows, derived.sdm, centroids, raw])

  const pickArea = (a: SpasialArea, fromMap = false) => {
    setSel(a)
    setSelectedEvent((kejadian || []).find((k: any) => k.code === a.code) || null)
    setDockTab('terpadu')
    if (!fromMap && a.lat != null && a.lon != null) {
      setFocus({ lat: a.lat, lon: a.lon, area: a, zoom: 6.5, nonce: Date.now() })
    }
  }
  const onUp = f.provinsi ? () => onApply({ ...f, provinsi: null, kabupaten: null }) : null
  const onDrill = (a: SpasialArea) => onApply({ ...f, provinsi: a.code, kabupaten: null })

  useEffect(() => {
    if (!full) return
    const narrow = window.innerWidth < 1500
    if (narrow) setRightDockOpen(false)
  }, [full])

  const controls = (
    <>
            <div className="flex items-center rounded-xl bg-slate-100 p-0.5 text-xs font-bold">
              {METRIC_PILLS.map((m) => (
                <button key={`${m.key}-${m.choro}`} type="button" onClick={() => setPill(m.key, m.choro)}
                  className={`rounded-lg px-2.5 py-1 transition ${metric === m.key && choro === m.choro ? 'bg-white text-primary shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}>
                  {m.label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
              <span className="sr-only">Variabel peta lainnya</span>
              <select value={choro} onChange={(e) => {
                  const id = e.target.value as ChoroId
                  const pill = METRIC_PILLS.find((p) => p.choro === id)
                  setPill((pill?.key || 'kasus') as Metric, id)
                }}
                className="max-w-[190px] rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700 focus:border-primary focus:outline-none"
                title="Pilih variabel arsiran peta" data-testid="peta-variabel-select">
                {Array.from(new Set(CHORO_OPTIONS.map((o) => o.group))).map((g) => (
                  <optgroup key={g} label={g}>
                    {CHORO_OPTIONS.filter((o) => o.group === g).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </optgroup>
                ))}
              </select>
              {choro === 'luka_berat' || choro === 'luka_ringan' || choro === 'hilang' ? (
                <InfoHint text={`${choro === 'luka_berat' ? KORBAN_LABEL.lbHint : choro === 'luka_ringan' ? KORBAN_LABEL.lrHint : KORBAN_LABEL.hilangHint} Sebaran per provinsi memakai jumlah kumulatif semua tahun karena sumber belum merilis rincian 2026 per provinsi.`} label="Penjelasan variabel peta" />
              ) : null}
            </label>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{periodeLabel(f)}</span>
            <div className="flex items-center gap-1.5 border-l border-slate-200 pl-2">
              <button type="button" onClick={() => setLeftDockOpen(!leftDockOpen)}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition ${leftDockOpen ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                title="Buka / Ciutkan Analisa & Detail Wilayah">
                <MapPin className="h-3.5 w-3.5" /><span className="hidden sm:inline">Analisa Wilayah</span>
              </button>
              <button type="button" onClick={() => setRightDockOpen(!rightDockOpen)}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition ${rightDockOpen ? 'border-teal-700 bg-teal-50 text-teal-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                title="Buka / Ciutkan Pengaturan Peta & Lapisan">
                <Settings className="h-3.5 w-3.5 text-emerald-700" /><span className="hidden sm:inline">Pengaturan Lapisan</span>
              </button>
            </div>
    </>
  )

  const leftBody = (
    <>
              <div className="flex shrink-0 gap-1 border-b border-slate-200 bg-white px-2 py-1.5">
                {(mode === 'kejadian'
                  ? ([['situasi', 'Situasi'], ['analitik', 'Analitik'], ['kesiapan', 'Kesiapan'], ['risiko', 'Risiko']] as const)
                  : ([['analisa', 'Analisa'], ['analitik', 'Analitik'], ['terbaru', `Terbaru${terbaruCount ? ` (${terbaruCount})` : ''}`], ['terpadu', 'Terpadu']] as const)
                ).map(([key, l]) => (
                  <button key={key} type="button" onClick={() => setDockTab(key)}
                    className={`flex-1 rounded-lg px-1.5 py-1 text-[10px] font-bold ${dockTab === key ? 'bg-teal-50 text-teal-800' : 'text-slate-500 hover:bg-slate-100'}`}>
                    {l}
                  </button>
                ))}
              </div>
              {mode === 'dasbor' && drillProv ? (
                <div className="shrink-0 border-b border-slate-100 px-3 py-2" data-testid="peta-cta-wilayah">
                  <p className="truncate text-[12px] font-bold text-slate-800">{drillNama || `Prov. ${drillProv}`}</p>
                  <div className="mt-1.5 flex flex-col gap-1">
                    <Link href={wilayahHref(drillProv, { tahun: f.tahun, jenis: f.jenis })} className="block rounded-lg bg-[#00705a] px-2 py-1.5 text-center text-[11px] font-bold text-white hover:bg-[#005a48]">Lihat detail wilayah</Link>
                    {(kejadianSemuaPeta || kejadianPeta || []).filter((k: any) => String(k.code || '').replace(/\D/g, '').padStart(2, '0').slice(0, 2) === String(drillProv).padStart(2, '0')).sort((a: any, b: any) => String(b.tanggal || '').localeCompare(String(a.tanggal || ''))).slice(0, 1).map((k: any) => (
                      <Link key={k.uid} href={kejadianHref(String(k.uid), k.tanggal)} className="block rounded-lg border border-teal-200 bg-teal-50 px-2 py-1.5 text-center text-[11px] font-bold text-teal-800 hover:bg-teal-100">Lihat detail kejadian</Link>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="min-h-0 flex-1 overflow-y-auto">
                {dockTab === 'analisa' && (
                  <SpasialPanel
                    f={aFilter}
                    data={data}
                    titik={titik}
                    metric={activeMetric}
                    selected={sel}
                    onPickArea={(a) => pickArea(a)}
                    onPickTitik={(t: Titik) => {
                      setSelectedEvent((kejadian || []).find((k: any) => k.jenis === t.unit && k.kabupaten === t.kab) || null)
                      setDockTab('terpadu')
                      setFocus({ lat: t.lat, lon: t.lon, titik: t, nonce: Date.now() })
                    }}
                    onClose={() => setLeftDockOpen(false)}
                    onClear={() => { setSel(null); setSelectedEvent(null) }}
                    className="h-full rounded-none border-none bg-slate-50/70 shadow-none"
                    closeIcon="left"
                    metricLabel={choroLabel}
                  />
                )}
                <div className={dockTab === 'terbaru' ? 'h-full' : 'hidden'}>
                  <KejadianTerbaruList f={f as any} eocKrisis={(raw as any).eoc?.kejadian_krisis_terbaru} onCount={setTerbaruCount}
                    onPick={(k) => {
                      if (k.lat != null && k.lon != null) setFocus({ lat: k.lat, lon: k.lon, zoom: 9, nonce: Date.now() })
                      else if (k.provCode && centroids[k.provCode]) setFocus({ lat: centroids[k.provCode].lat, lon: centroids[k.provCode].lon, zoom: 6.5, nonce: Date.now() })
                    }} />
                </div>
                {dockTab === 'terpadu' && (
                  <div className="p-3">
                    {terpadu ? (
                      <KejadianTerpaduCard data={terpadu} radius={radiusCounts} radiusOn={radiusOn} />
                    ) : (
                      <p className="text-[11px] text-slate-500">Klik kejadian atau provinsi pada peta untuk membuka kartu terpadu.</p>
                    )}
                  </div>
                )}
                <div className={dockTab === 'analitik' ? 'h-full overflow-y-auto' : 'hidden'}>
                  {mode === 'kejadian' && fokusKejadian
                    ? <KejadianAnalitikDock riwayat={kejadianPaket?.riwayat} konteks={kejadianPaket?.konteks} layers={{ fires: intelLayers.fires, hujan: sekitar.hujan, riwayat: sekitar.riwayat }} />
                    : <PetaAnalitikPanel kejadian={kejadianSemuaPeta || kejadianPeta || []} drillProv={drillProv} drillNama={drillNama} />}
                </div>
                {mode === 'kejadian' && dockTab === 'situasi' && (
                  <KejadianSituasiDock k={fokusKejadian} status={kejadianPaket?.status} rekomendasi={kejadianPaket?.rekomendasi} />
                )}
                {mode === 'kejadian' && dockTab === 'kesiapan' && (
                  <KejadianKesiapanDock nearby={kejadianPaket?.nearby} />
                )}
                {mode === 'kejadian' && dockTab === 'risiko' && (
                  <KejadianRisikoDock
                    risiko={kejadianPaket?.risiko}
                    pieKab={pieKab}
                    onShowAsis={(m) => { setRisikoPie(false); setRisikoAsis(m); setRisikoLevel('kabkota') }}
                    onShowPie={() => { setRisikoAsis(null); setRisikoPie(true); setRisikoLevel('kabkota') }}
                  />
                )}
              </div>
    </>
  )

  const rightBody = (
              <div className="flex h-full flex-col overflow-hidden">
                <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-white p-3">
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4 text-emerald-700" />
                    <span className="text-sm font-bold text-slate-800">Pengaturan Peta & Lapisan</span>
                  </div>
                  <button type="button" onClick={() => setRightDockOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Tutup pengaturan peta">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex-1 space-y-3.5 overflow-y-auto p-3.5 text-xs">
                  <div>
                    <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Visualisasi Kasus &amp; Wilayah</div>
                    <div className="space-y-2">
                      <label className={`block cursor-pointer rounded-xl border p-2.5 transition select-none ${layers.points !== 'off' ? 'border-teal-200 bg-white shadow-2xs' : 'border-slate-100 bg-slate-50'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-0.5">
                              {eocLayer.legend.slice(0, 6).map((g) => (
                                g.iconSrc
                                  ? <img key={g.label} alt="" aria-hidden src={g.iconSrc} className="h-5 w-3.5 object-contain" title={g.label} />
                                  : <span key={g.label} className="h-2 w-2 rounded-full" style={{ background: g.color }} title={g.label} />
                              ))}
                            </span>
                            <span className="text-xs font-bold text-slate-800">Ikon kejadian EOC</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black tabular-nums text-slate-800">{totalTitik.toLocaleString('id-ID')}</span>
                            <input
                              type="checkbox"
                              checked={layers.points !== 'off'}
                              onChange={(e) => setLayers({ ...layers, points: e.target.checked ? 'kluster' : 'off' })}
                              className="h-4 w-4 cursor-pointer rounded border-slate-300 text-teal-700 focus:ring-teal-500"
                              aria-label="Ikon kejadian EOC"
                            />
                          </div>
                        </div>
                        <p className="ml-5 mt-0.5 text-[10px] text-slate-500">Ikon sesuai jenis bencana · koordinat kejadian dari API EOC, atau perkiraan pusat kab/kota (garis putus-putus) · {totalTitik.toLocaleString('id-ID')} titik</p>
                        {layers.points !== 'off' && (
                          <div className="ml-5 mt-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Opasitas</span>
                            <input type="range" min={0.2} max={1} step={0.05} value={pointOpacity} onChange={(e) => setPointOpacity(Number(e.target.value))} className="h-1 flex-1 cursor-pointer accent-[#00705a]" />
                            <span className="w-8 text-right text-[10px] font-bold tabular-nums text-slate-600">{Math.round(pointOpacity * 100)}%</span>
                          </div>
                        )}
                      </label>
                      <label className={`block cursor-pointer rounded-xl border p-2.5 transition select-none ${radiusOn ? 'border-teal-200 bg-white shadow-2xs' : 'border-slate-100 bg-slate-50'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-800">Radius dukungan 50/100/200 km</span>
                          <input
                            type="checkbox"
                            checked={radiusOn}
                            onChange={(e) => setRadiusOn(e.target.checked)}
                            className="h-4 w-4 cursor-pointer rounded border-slate-300 text-teal-700 focus:ring-teal-500"
                            aria-label="Radius dukungan"
                          />
                        </div>
                        <p className="mt-0.5 text-[10px] text-slate-500">Lingkaran di sekitar titik/provinsi terpilih. {titikFasilitas(raw) ? 'PSC, ambulans, dan rumah sakit dihitung dari koordinat API PSC 119 (PSC tanpa koordinat valid memakai pusat kab/kota); tenaga cadangan dan gudang masih memakai pusat provinsi.' : 'Koordinat fasilitas belum tersedia dari API PSC 119; jarak memakai pusat provinsi.'}</p>
                      </label>
                      <label className={`block cursor-pointer rounded-xl border p-2.5 transition select-none ${layers.choro ? 'border-teal-200 bg-white shadow-2xs' : 'border-slate-100 bg-slate-50'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Shapes className="h-3.5 w-3.5 text-teal-700" />
                            <span className="text-xs font-bold text-slate-800">Arsiran wilayah</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={layers.choro}
                            onChange={(e) => setLayers({ ...layers, choro: e.target.checked })}
                            className="h-4 w-4 cursor-pointer rounded border-slate-300 text-teal-700 focus:ring-teal-500"
                            aria-label="Arsiran wilayah"
                          />
                        </div>
                        <p className="ml-5 mt-0.5 text-[10px] text-slate-500">Mengikuti pil variabel di atas peta (legenda kiri bawah)</p>
                        {layers.choro && (
                          <div className="ml-5 mt-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Opasitas</span>
                            <input type="range" min={0.2} max={1} step={0.05} value={layers.opChoro} onChange={(e) => setLayers({ ...layers, opChoro: Number(e.target.value) })} className="h-1 flex-1 cursor-pointer accent-teal-700" />
                            <span className="w-8 text-right text-[10px] font-bold tabular-nums text-slate-600">{Math.round(layers.opChoro * 100)}%</span>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>

                  <KategoriBencanaFilter live={eocLive} error={(raw as any)?.eoc?.error} kat={katHitung.kat} jenis={katHitung.jenis}
                    katOff={katOff} jenisOff={jenisOff} onKategori={onKategori} onJenis={onJenis}
                    onReset={() => { setKatOff(new Set()); setJenisOff(new Set()) }} />

                  <div data-testid="internal-group">
                    <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
                      <span className="inline-flex items-center gap-1">API Internal
                        <InfoHint text="Titik fasilitas dan agregat panggilan dari API resmi PSC 119 Kementerian Kesehatan, diringkas di server. Tidak memuat data perorangan (nama, telepon, plat nomor, pelapor)." label="Penjelasan API Internal" />
                      </span>
                      <span className={`normal-case tracking-normal ${iInfo?.live ? 'text-emerald-700' : 'text-amber-700'}`}>{iInfo?.live ? `langsung${iInfo.at ? ` · ${iInfo.at}` : ''}` : 'menunggu data'}</span>
                    </div>
                    {!iInfo ? (
                      <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-[10px] text-amber-800" data-testid="internal-empty">Data API PSC 119 belum termuat (token server belum diatur atau API sedang lambat). Lapisan akan muncul otomatis.</p>
                    ) : (
                      <div className="space-y-1.5">
                        <label className={`block cursor-pointer rounded-xl border p-2.5 transition select-none ${internal.psc ? 'border-teal-300 bg-teal-50/50' : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/60'}`} data-testid="internal-psc">
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-slate-800"><span className="flex h-4 w-4 items-center justify-center rounded-full bg-teal-600 text-white"><Hospital className="h-2.5 w-2.5" /></span>Titik PSC 119</span>
                            <span className="flex items-center gap-2">
                              <span className="text-xs font-black tabular-nums text-slate-800">{nfi(internal.psc ? iInfo.psc.tampil : iInfo.psc.dgnKoordinat)}</span>
                              <input type="checkbox" checked={internal.psc} onChange={(e) => setInternal((p) => ({ ...p, psc: e.target.checked }))} className="h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-teal-700 focus:ring-teal-500" aria-label="Titik PSC 119" />
                            </span>
                          </div>
                          <p className="mt-0.5 text-[10px] leading-tight text-slate-500">{nfi(iInfo.psc.koordinatAsli)} dari {nfi(iInfo.psc.total)} PSC berkoordinat asli; {nfi(iInfo.psc.pusatKab)} lainnya di pusat kab/kota (garis putus-putus){iInfo.psc.bawaan ? `, karena ${nfi(iInfo.psc.bawaan)} PSC memakai koordinat bawaan yang sama` : ''}. {nfi(iInfo.psc.aktif)} aktif. Klik titik untuk status, ambulans, personel, RS jejaring.</p>
                          {internal.psc ? (
                            <label className="ml-1 mt-1.5 flex items-center gap-1.5 text-[10px] font-bold text-slate-700" onClick={(e) => e.stopPropagation()}>
                              <input type="checkbox" checked={internal.pscAktifOnly} onChange={(e) => setInternal((p) => ({ ...p, pscAktifOnly: e.target.checked }))} className="h-3.5 w-3.5 rounded border-slate-300 text-teal-700" data-testid="internal-psc-aktif" />
                              Hanya PSC aktif / siap
                            </label>
                          ) : null}
                        </label>
                        <label className={`block cursor-pointer rounded-xl border p-2.5 transition select-none ${internal.ambulans ? 'border-teal-300 bg-teal-50/50' : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/60'}`} data-testid="internal-ambulans">
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-slate-800"><span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-600 text-white"><Ambulance className="h-2.5 w-2.5" /></span>Titik Ambulans</span>
                            <span className="flex items-center gap-2">
                              <span className="text-xs font-black tabular-nums text-slate-800">{nfi(internal.ambulans ? iInfo.ambulans.tampil : iInfo.ambulans.koordinatSendiri + iInfo.ambulans.diLokasiPsc)}</span>
                              <input type="checkbox" checked={internal.ambulans} onChange={(e) => setInternal((p) => ({ ...p, ambulans: e.target.checked }))} className="h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-teal-700 focus:ring-teal-500" aria-label="Titik Ambulans" />
                            </span>
                          </div>
                          <p className="mt-0.5 text-[10px] leading-tight text-slate-500">{nfi(iInfo.ambulans.koordinatSendiri)} ambulans punya koordinat sendiri (GPS/tercatat); {nfi(iInfo.ambulans.diLokasiPsc + iInfo.ambulans.diPusatKab)} lainnya diletakkan di lokasi PSC induk atau pusat kab/kota (garis putus-putus){iInfo.ambulans.tanpaLokasi ? `; ${nfi(iInfo.ambulans.tanpaLokasi)} tanpa lokasi sama sekali` : ''}. Siap = aktif dan kondisi baik ({nfi(iInfo.ambulans.siap)}).</p>
                          {internal.ambulans ? (
                            <label className="ml-1 mt-1.5 flex items-center gap-1.5 text-[10px] font-bold text-slate-700" onClick={(e) => e.stopPropagation()}>
                              <input type="checkbox" checked={internal.ambSiapOnly} onChange={(e) => setInternal((p) => ({ ...p, ambSiapOnly: e.target.checked }))} className="h-3.5 w-3.5 rounded border-slate-300 text-teal-700" data-testid="internal-amb-siap" />
                              Hanya ambulans siap (aktif &amp; baik)
                            </label>
                          ) : null}
                        </label>
                        <label className={`block cursor-pointer rounded-xl border p-2.5 transition select-none ${internal.panggilan ? 'border-teal-300 bg-teal-50/50' : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/60'}`} data-testid="internal-panggilan">
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-slate-800"><span className="flex h-4 w-4 items-center justify-center rounded-full bg-violet-600 text-white"><PhoneCall className="h-2.5 w-2.5" /></span>Titik Panggilan 119</span>
                            <span className="flex items-center gap-2">
                              <span className="text-xs font-black tabular-nums text-slate-800">{nfi(iInfo.panggilan.tampil)}</span>
                              <input type="checkbox" checked={internal.panggilan} onChange={(e) => setInternal((p) => ({ ...p, panggilan: e.target.checked }))} className="h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-teal-700 focus:ring-teal-500" aria-label="Titik Panggilan 119" />
                            </span>
                          </div>
                          <p className="mt-0.5 text-[10px] leading-tight text-slate-500">Agregat per kab/kota dari sampel {nfi(iInfo.panggilan.sampel)} panggilan terbaru ({iInfo.panggilan.dari || '–'} s.d. {iInfo.panggilan.sampai || '–'}), bukan titik penelepon. Lingkaran di rata-rata koordinat panggilan ({nfi(iInfo.panggilan.kabKoordinatPanggilan)} kab/kota) atau pusat kab/kota ({nfi(iInfo.panggilan.kabPusat)}, garis putus-putus).</p>
                        </label>
                      </div>
                    )}
                  </div>

                  <div data-testid="risiko-group">
                    <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
                      <span>Risiko</span>
                      <span className="normal-case tracking-normal text-slate-400">{asisOk ? 1 : 0} tersedia</span>
                    </div>
                    <div className="space-y-1.5">
                      <div data-testid="risiko-risiko-krisis" className={`rounded-xl border p-2.5 ${risikoAsis ? 'border-rose-300 bg-rose-50/40' : 'border-slate-100 bg-white'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-slate-800"><span className="h-2.5 w-2.5 rounded-full" style={{ background: '#e11d48' }} />Risiko Krisis Kesehatan</span>
                          {asisOk ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-800">API Asistensi</span> : null}
                        </div>
                        {asisOk ? (
                          <>
                            <p className="mt-0.5 text-[10px] leading-tight text-slate-500">Arsir poligon wilayah dengan warna status dari API Asistensi{raw?.asistensi?.tahun ? ` ${raw.asistensi.tahun}` : ''}. Hanya satu arsiran aktif.</p>
                            <div className="mt-1.5 flex items-center gap-1 text-[10px]" data-testid="risiko-level">
                              <span className="font-bold text-slate-500">Tingkat:</span>
                              {(['provinsi', 'kabkota'] as const).map((lv) => (
                                <button key={lv} type="button" onClick={() => setRisikoLevel(lv)} data-testid={`risiko-level-${lv}`}
                                  className={`rounded-full px-2 py-0.5 font-bold ${risikoLevel === lv ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{lv === 'provinsi' ? 'Provinsi' : 'Kab/Kota'}</button>
                              ))}
                            </div>
                            {([
                              { id: 'kapasitas' as const, nama: 'Risiko Asistensi — Status Kapasitas', info: 'Warna dari API Asistensi (status_kapasitas.color); poin kapasitas di tooltip.', lg: legendAsis.kapasitas },
                              { id: 'irbi' as const, nama: 'Status IRBI', info: 'IRBI = Indeks Risiko Bencana Indonesia. API tidak mengirim warna, dipakai skala baku: TINGGI merah, SEDANG jingga, RENDAH hijau.', lg: legendAsis.irbi },
                            ]).map((o) => (
                              <label key={o.id} data-testid={`risiko-asis-${o.id}`} className="mt-1.5 block cursor-pointer rounded-lg border border-slate-100 bg-white p-2 select-none hover:bg-slate-50/60">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="flex min-w-0 items-center gap-1 text-[11px] font-bold text-slate-800">{o.nama}<span title={o.info} className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-slate-200 text-[8px] font-black text-slate-600">i</span></span>
                                  <input type="checkbox" checked={risikoAsis === o.id} aria-label={o.nama}
                                    onChange={(e) => {
                                      setRisikoAsis(e.target.checked ? o.id : null)
                                      if (e.target.checked) {
                                        setRisikoPie(false)
                                        if (!layers.choro) setLayers({ ...layers, choro: true })
                                      }
                                    }}
                                    className="h-4 w-4 shrink-0 rounded border-slate-300 text-rose-600" />
                                </div>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {o.lg.map((g) => <span key={g.label} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-bold text-slate-600"><span className="h-2 w-2 rounded-full border border-slate-300" style={{ background: g.color }} />{g.label} {g.n}</span>)}
                                </div>
                              </label>
                            ))}
                            {risikoAsis ? <p className="mt-1 text-[10px] leading-tight text-slate-400">Arsiran ini menggantikan arsiran angka selama aktif.{risikoLevel === 'kabkota' && !provKode ? ' Kab/kota seluruh Indonesia (pilih provinsi di Filter Dasbor untuk memperbesar).' : ''}</p> : null}
                          </>
                        ) : (
                          <ApiKosong compact pesan="Data belum tersedia dari API Asistensi" detail={raw?.asistensi?.error} pending={Boolean(raw?.asistensi?.pending)} />
                        )}
                      </div>
                      {/* Lapisan Risiko Emerging (PIE) dari petarisikopie.id */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-2.5 transition select-none" data-testid="risiko-pie-card">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-slate-800">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#9333ea' }} />
                            <span>Risiko Emerging (Peta PIE)</span>
                          </span>
                          <span className="flex items-center gap-1.5">
                            {pieOk ? (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-800">API Langsung</span>
                            ) : pieState.loading ? (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-600">Memuat...</span>
                            ) : (
                              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-bold text-rose-700" title={pieState.error}>Tidak tersedia</span>
                            )}
                            <input
                              type="checkbox"
                              checked={risikoPie}
                              onChange={(e) => {
                                setRisikoPie(e.target.checked)
                                if (e.target.checked) {
                                  setRisikoAsis(null)
                                  if (!layers.choro) setLayers({ ...layers, choro: true })
                                }
                              }}
                              className="h-4 w-4 shrink-0 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                              aria-label="Risiko Emerging (Peta PIE)"
                            />
                          </span>
                        </div>
                        <p className="mt-0.5 text-[10px] leading-tight text-slate-500">
                          Tingkat risiko penyakit infeksi emerging per wilayah (Peta Risiko PIE Kemenkes {pieYear}).
                        </p>

                        {risikoPie ? (
                          <div className="mt-2.5 space-y-2 border-t border-slate-200/80 pt-2">
                            {/* Pilihan Tahun (sama dengan SKDR); data diambil ulang dari API per tahun */}
                            <div className="flex items-center justify-between text-[10px]" data-testid="pie-tahun">
                              <span className="font-bold text-slate-500">Tahun:</span>
                              <div className="flex items-center gap-1">
                                {PIE_YEARS.map((yr) => (
                                  <button
                                    key={yr}
                                    type="button"
                                    data-testid={`pie-tahun-${yr}`}
                                    onClick={() => setPieYear(yr)}
                                    className={`rounded-full px-2 py-0.5 font-bold transition ${
                                      pieYear === yr
                                        ? 'bg-purple-700 text-white shadow-xs'
                                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                                    }`}
                                  >
                                    {yr}
                                  </button>
                                ))}
                              </div>
                            </div>
                            {!pieOk ? (
                              pieState.loading ? (
                                <p className="text-[10px] text-slate-500">Memuat data Peta Risiko PIE {pieYear} dari API…</p>
                              ) : (
                                <ApiKosong compact pesan={`Data belum tersedia dari API (Peta Risiko PIE ${pieYear})`} detail={pieState.error || (pieState.data ? 'API mengembalikan 0 rekaman untuk tahun ini' : null)} />
                              )
                            ) : (
                            <>
                            {/* Pilihan Tingkat Wilayah */}
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="font-bold text-slate-500">Tingkat wilayah:</span>
                              <div className="flex items-center gap-1">
                                {(['provinsi', 'kabkota'] as const).map((lv) => (
                                  <button
                                    key={lv}
                                    type="button"
                                    onClick={() => setRisikoLevel(lv)}
                                    className={`rounded-full px-2 py-0.5 font-bold transition ${
                                      risikoLevel === lv
                                        ? 'bg-purple-700 text-white shadow-xs'
                                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                                    }`}
                                  >
                                    {lv === 'provinsi' ? 'Provinsi' : 'Kab/Kota'}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Pilihan Penyakit */}
                            <div>
                              <label className="mb-1 block text-[10px] font-bold text-slate-500">Penyakit Emerging:</label>
                              <select
                                value={pieDisease}
                                onChange={(e) => setPieDisease(e.target.value as PieDiseaseOption)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 shadow-xs focus:border-purple-500 focus:outline-none"
                              >
                                {pieOpsi.map((d) => (
                                  <option key={d.id} value={d.id}>
                                    {d.label} ({d.n})
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Legend pills */}
                            <div className="flex flex-wrap gap-1 pt-1">
                              {legendPie.map((g) => (
                                <span
                                  key={g.label}
                                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-bold text-slate-700"
                                >
                                  <span className="h-2 w-2 rounded-full" style={{ background: g.color }} />
                                  <span>{g.label}</span>
                                  <span className="font-normal text-slate-400">({g.n})</span>
                                </span>
                              ))}
                            </div>
                            <p className="text-[10px] leading-tight text-slate-400">
                              Skala risiko: TINGGI (merah), SEDANG (jingga), RENDAH (hijau). Menimpa arsiran angka selama aktif.
                            </p>
                            <p className="text-[10px] leading-tight text-slate-400" data-testid="pie-ringkas">
                              API {pieYear}: {pieData!.summary.api_total} rekaman{pieData!.summary.tanpa_status || pieData!.summary.tanpa_kode ? ` · ${pieData!.summary.tanpa_status} tanpa status & ${pieData!.summary.tanpa_kode} kab/kota tak terpetakan tidak ditampilkan` : ''}.
                            </p>
                            </>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
                      <span>API Intelijen Eksternal</span>
                      <Link href="/dashboard/open-data" className="normal-case tracking-normal text-primary hover:underline">Lihat Open Data</Link>
                    </div>
                    <div className="space-y-1.5">
                      {INTEL_LAYER_APIS.map((api) => {
                        const active = Boolean((intelLayers as any)[api.id])
                        const st = intelStatus[api.id]
                        return (
                          <label key={api.id}
                            className={`block cursor-pointer rounded-xl border p-2.5 transition select-none ${active ? 'border-teal-300 bg-teal-50/50' : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/60'}`}
                            data-testid={`intel-${api.id}`}>
                            <div className="flex items-center justify-between gap-2">
                              <span className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-slate-800">
                                <span>{api.icon}</span><span className="truncate">{api.nama}</span>
                              </span>
                              <input
                                type="checkbox"
                                checked={active}
                                onChange={(e) => setIntelLayers((prev) => ({ ...prev, [api.id]: e.target.checked }))}
                                className="h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-teal-700 focus:ring-teal-500"
                                aria-label={api.nama}
                              />
                            </div>
                            <p className="mt-0.5 line-clamp-2 text-[10px] leading-tight text-slate-500">{api.deskripsi}</p>
                            {active && st ? (
                              <p className={`mt-1 text-[10px] font-bold leading-tight ${st.state === 'error' ? 'text-red-700' : st.state === 'empty' ? 'text-amber-700' : st.state === 'loading' ? 'text-slate-500' : 'text-emerald-700'}`} data-testid={`intel-status-${api.id}`}>
                                {st.state === 'loading' ? 'Memuat data langsung…' : st.state === 'error' ? st.message : st.message || `${(st.count || 0).toLocaleString('id-ID')} titik dimuat`}
                                {st.at && st.state !== 'error' ? <span className="font-medium text-slate-400"> · {st.at}</span> : null}
                              </p>
                            ) : null}
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  <div data-testid="bnpb-group">
                    <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
                      <span className="inline-flex items-center gap-1">BNPB InaRISK
                        <InfoHint text="InaRISK: peta indeks bahaya bencana resmi dari BNPB (Badan Nasional Penanggulangan Bencana). Diambil langsung dari gis.bnpb.go.id; server BNPB kadang lambat." label="Penjelasan BNPB InaRISK" />
                      </span>
                      <span className="normal-case tracking-normal text-slate-400">{Object.values(bnpbLayers).filter(Boolean).length} aktif</span>
                    </div>
                    <div className="space-y-1">
                      {BNPB_LAYERS.map((l) => {
                        const on = Boolean(bnpbLayers[l.id])
                        const st = bnpbStatus[l.id]
                        return (
                          <label key={l.id} data-testid={`bnpb-${l.id}`}
                            className={`block cursor-pointer rounded-lg border px-2.5 py-1.5 transition select-none ${on ? 'border-teal-300 bg-teal-50/50' : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/60'}`}>
                            <div className="flex items-center justify-between gap-2">
                              <span className="min-w-0">
                                <span className="block truncate text-[11px] font-bold text-slate-800">{l.nama}</span>
                                <span className="block truncate text-[9.5px] leading-tight text-slate-500">{l.deskripsi}</span>
                              </span>
                              <input
                                type="checkbox"
                                checked={on}
                                onChange={(e) => setBnpbLayers((p) => ({ ...p, [l.id]: e.target.checked }))}
                                className="h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-teal-700 focus:ring-teal-500"
                                aria-label={l.nama}
                              />
                            </div>
                            {on && st ? (
                              <p className={`mt-0.5 text-[9.5px] font-bold ${st.state === 'error' ? 'text-red-700' : st.state === 'loading' ? 'text-slate-500' : 'text-emerald-700'}`} data-testid={`bnpb-status-${l.id}`}>
                                {st.state === 'loading' ? 'Memuat citra dari gis.bnpb.go.id…' : st.message}
                              </p>
                            ) : null}
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Konteks Spasial &amp; Risiko</div>
                    <div className="space-y-1.5">
                      <label className="flex cursor-pointer items-start justify-between gap-2.5 rounded-lg border border-slate-100 bg-white p-2.5 hover:bg-slate-50">
                        <div className="flex min-w-0 items-start gap-2">
                          <Layers className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
                          <div>
                            <span className="block text-xs font-bold text-slate-800">Batas Administrasi</span>
                            <span className="block text-[10px] leading-tight text-slate-500">Garis batas provinsi dan kabupaten/kota (GeoJSON) di atas arsiran</span>
                          </div>
                        </div>
                        <input type="checkbox" checked={adminBoundaries} onChange={(e) => setAdminBoundaries(e.target.checked)} className="mt-1 h-4 w-4 cursor-pointer rounded border-slate-300 text-teal-700 focus:ring-teal-500" />
                      </label>
                      <label className="flex cursor-pointer items-start justify-between gap-2.5 rounded-lg border border-slate-100 bg-white p-2.5 hover:bg-slate-50">
                        <div className="flex min-w-0 items-start gap-2">
                          <Wind className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
                          <div>
                            <span className="block text-xs font-bold text-slate-800">Aliran Angin</span>
                            <span className="block text-[10px] leading-tight text-slate-500">Partikel angin bergerak (animasi) model GFS (NOAA, Badan Kelautan dan Atmosfer AS) sebagai konteks sebaran asap/abu</span>
                          </div>
                        </div>
                        <input type="checkbox" checked={windFlow} onChange={(e) => setWindFlow(e.target.checked)} className="mt-1 h-4 w-4 cursor-pointer rounded border-slate-300 text-teal-700 focus:ring-teal-500" />
                      </label>
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Peta Dasar</div>
                    <div className="grid grid-cols-2 gap-2">
                      {[{ id: 'osm', label: 'OpenStreetMap' }, { id: 'terrain', label: 'Medan' }, { id: 'satellite', label: 'Satelit' }, { id: 'light', label: 'Terang' }].map((b) => (
                        <button key={b.id} type="button" onClick={() => setLayers({ ...layers, base: b.id as any })}
                          className={`rounded-xl border px-3 py-2 text-left text-xs font-bold transition ${layers.base === b.id ? 'border-teal-700 bg-teal-50/70 text-teal-800 shadow-2xs ring-1 ring-teal-700/30' : 'border-slate-200 bg-slate-50/60 text-slate-600 hover:border-slate-300 hover:bg-white'}`}>
                          {b.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-[10px] leading-relaxed text-slate-600">
                    <p className="font-semibold text-slate-700">Observasi {periodeLabel(f)} · Seluruh Indonesia</p>
                    <p className="mt-0.5 text-slate-500">Arahkan kursor ke wilayah untuk melihat angka; klik untuk memperbesar dan memfilter detail di panel kiri. Putar slider bawah untuk melihat tren bulanan nasional.</p>
                  </div>
                </div>
                {mode === 'kejadian' ? (
                  <div className="mx-3 mb-3 rounded-xl border border-slate-200 bg-white p-2.5" data-testid="lapisan-sekitar-kejadian">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Konteks kejadian di peta</p>
                    <p className="mb-1.5 text-[10px] text-slate-500">Titik dan kisi di sekitar lokasi. PSC, ambulans, titik panas, dan peringatan BMKG/GDACS diatur di bagian lapisan masing-masing. TCK dan gudang logistik tidak punya koordinat di API.</p>
                    {([['rs', 'RS jejaring'], ['riwayat', 'Riwayat 12 bulan'], ['cuaca', 'Cuaca lokasi'], ['hujan', 'Kisi hujan']] as const).map(([key, label]) => (
                      <label key={key} className="mt-1 flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-700">
                        <span>{label}</span>
                        <input type="checkbox" checked={sekitar[key]} onChange={(e) => setSekitar((p) => ({ ...p, [key]: e.target.checked }))} className="h-4 w-4 cursor-pointer rounded border-slate-300 text-teal-700 focus:ring-teal-500" />
                      </label>
                    ))}
                  </div>
                ) : null}
                                <div className="shrink-0 border-t border-slate-100 bg-white p-3">
                  <button type="button"
                    onClick={() => {
                      setLayers({ ...DEFAULT_LAYERS, base: 'osm' })
                      setPointOpacity(1)
                      setAdminBoundaries(true)
                      setWindFlow(false)
                      setBnpbLayers({})
                      setBnpbStatus({})
                      setIntelLayers({ fires: false, hazards: false })
                      setIntelStatus({})
                      setRadiusOn(true)
                      setInternal(DEFAULT_INTERNAL)
                      setKatOff(new Set())
                      setJenisOff(new Set())
                      setRisikoAsis(null)
                      setRisikoLevel('provinsi')
                      setPill('kasus', 'kejadian')
                    }}
                    className="w-full rounded-xl bg-[#00705a] py-2.5 text-center text-xs font-bold text-white shadow-sm transition hover:bg-[#005a48] active:scale-[0.99]">
                    Atur Ulang Pengaturan Lapisan
                  </button>
                </div>
              </div>
  )

  const renderMap = (extra: Record<string, any>) => (
            <SpasialMap
              data={data}
              titik={[]}
              metric={activeMetric}
              setMetric={(m) => {
                setMetric(m)
                const pill = METRIC_PILLS.find((p) => p.key === m)
                if (pill) setChoro(pill.choro)
              }}
              layers={layers}
              setLayers={setLayers}
              choroCfg={choroCfg}
              sumber="ebs"
              selectedId={sel?.id ?? null}
              onSelectArea={(a) => { if (mode === 'kejadian') { setSel(a || null); return } if (a) { pickArea(a, true); if (mapPack.data?.level !== 'kabkota') setDrillProv(String(a.code).padStart(2, '0')) } else setSel(null) }}
              onDrill={onDrill}
              onUp={onUp}
              focus={focus}
              panelOpen={false}
              setPanelOpen={() => {}}
              height={640}
              fullHeight={true}
              rightPanel={null}
              intelLayers={intelLayers}
              extraLayers={mapExtraLayers}
              onIntelStatus={onIntelStatus as any}
              pointOpacity={pointOpacity}
              showBoundaries={adminBoundaries}
              windFlow={windFlow}
              bnpbLayers={bnpbLayers}
              onBnpbStatus={onBnpbStatus}
              metricLabel={choroLabel}
              catChoro={drillCat || catChoro || (mode === 'kejadian' ? { id: 'kejadian-fokus', level: 'provinsi' as const, judul: 'Fokus satu kejadian', sumber: 'Halaman detail', items: {}, legend: [], catatan: 'Arsiran angka nasional dimatikan pada halaman detail. Aktifkan lapisan risiko untuk melihat arsiran wilayah.' } : null)}
              drill={drillWilayah}
              drillOnClick={mode === 'dasbor'}
              skipAutoFit={mode === 'kejadian' || mode === 'wilayah'}
              keepDrillFit={mode === 'wilayah'}
              areaExtra={(a) => a?.code ? (
                <div className="mt-2 flex flex-col gap-1">
                  <a href={wilayahHref(String(a.code), { tahun: f.tahun, jenis: f.jenis })} className="block rounded-lg bg-[#00705a] px-2 py-1.5 text-center text-[11px] font-bold text-white hover:bg-[#005a48]" data-testid="peta-link-detail-wilayah">Lihat detail wilayah</a>
                </div>
              ) : null}
              radiusSupport={{ enabled: radiusOn && Boolean(radiusCenter) && (mode === 'kejadian' || !drillProv), center: radiusCenter, ringsKm: [50, 100, 200] }}
              {...extra}
            />
  )

  if (full) {
    return (
      <div className="relative h-full w-full" data-testid="peta-spatial-mode">
        {renderMap({
          height: undefined,
          fullHeight: true,
          legendDefaultOpen: typeof window === 'undefined' || window.innerHeight >= 900,
          fitPadding: [150, rightDockOpen ? 400 : 30, 70, leftDockOpen ? 365 : 30],
          panelOpen: rightDockOpen,
          setPanelOpen: setRightDockOpen,
          rightPanel: (
            <div className="pointer-events-auto flex h-full max-h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-xl backdrop-blur" data-testid="peta-right-dock">
              {rightBody}
            </div>
          ),
          leftDock: leftDockOpen ? (
            <div className="pointer-events-auto flex w-[340px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-xl backdrop-blur" style={{ height: 'calc(100vh - 210px)', minHeight: 300 }} data-testid="peta-left-dock">
              <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-2 pt-1.5">
                <span className="px-1 text-[10px] font-black uppercase tracking-wider text-slate-400">{mode === 'kejadian' ? 'Detail kejadian' : 'Analisa wilayah'}</span>
                <button type="button" onClick={() => setLeftDockOpen(false)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Ciutkan panel analisa"><ChevronLeft className="h-3.5 w-3.5" /></button>
              </div>
              {leftBody}
            </div>
          ) : null,
          topHud: (ctrl: any) => (
            <div className="pointer-events-auto flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur" data-testid="spatial-toolbar">
                {hudTitle}
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  {controls}
                  <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
                    <button type="button" onClick={() => ctrl.setShowLegend(!ctrl.showLegend)} className={`flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-bold ${ctrl.showLegend ? 'bg-teal-50 text-teal-800' : 'text-slate-600 hover:bg-slate-100'}`} aria-pressed={ctrl.showLegend} title="Tampilkan / sembunyikan legenda"><ListTree className="h-3.5 w-3.5" /><span className="hidden 2xl:inline">Legenda</span></button>
                    <button type="button" onClick={ctrl.fitAll} className="flex h-7 items-center rounded-lg px-2 text-slate-600 hover:bg-slate-100" title="Tampilkan seluruh Indonesia" aria-label="Tampilkan seluruh Indonesia"><Crosshair className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={ctrl.toggleFs} className={`flex h-7 items-center rounded-lg px-2 ${ctrl.fs ? 'bg-teal-50 text-teal-800' : 'text-slate-600 hover:bg-slate-100'}`} title={ctrl.fs ? 'Keluar layar penuh' : 'Layar penuh'} aria-label={ctrl.fs ? 'Keluar layar penuh' : 'Layar penuh'} data-testid="spatial-fullscreen">{ctrl.fs ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}</button>
                  </div>
                </div>
              </div>
              {hudExtra}
              {!leftDockOpen ? (
                <div>
                  <button type="button" onClick={() => setLeftDockOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/95 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 shadow backdrop-blur hover:bg-white" data-testid="peta-left-dock-collapsed">
                    <MapPin className="h-3.5 w-3.5 text-primary" /> {mode === 'kejadian' ? 'Detail kejadian' : 'Analisa & Kejadian Terbaru'} <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                  </button>
                </div>
              ) : null}
            </div>
          ),
        })}
      </div>
    )
  }

  return (
      <div className={embed ? 'flex h-full w-full flex-col' : 'skdr-card flex w-full flex-col p-4'} data-testid={embed ? 'peta-kejadian-embed' : 'peta-skdr-terpadu'}>
        <div className={embed ? 'hidden' : 'flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between'}>
          <div>
            <div className="skdr-eyebrow flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> Peta spasial
            </div>
            <h2 className="skdr-section-title">
              Sebaran kejadian, korban, layanan 119, dan kapasitas respons
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {controls}
          </div>
        </div>

        <div className={embed ? 'relative flex min-h-0 w-full flex-1 overflow-hidden rounded-xl border border-slate-200 bg-slate-50' : 'relative mt-3 flex h-[500px] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50'}>
          {!embed && leftDockOpen ? (
            <div className="z-20 flex h-full w-[340px] shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white transition-all duration-300" data-testid="peta-left-dock">
              {leftBody}
            </div>
          ) : !embed ? (
            <aside className="z-20 flex h-full w-10 shrink-0 flex-col border-r border-slate-200 bg-white/95 backdrop-blur transition-all duration-300" data-testid="peta-left-dock-collapsed">
              <button type="button" onClick={() => setLeftDockOpen(true)}
                className="flex h-full w-full flex-col items-center justify-start gap-3 py-3 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                title="Buka Analisa & Detail Wilayah" aria-label="Buka Analisa & Detail Wilayah">
                <ChevronRight className="h-4 w-4 text-slate-400" />
                <MapPin className="h-4 w-4 text-primary" />
                <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-wider text-slate-600" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Analisa Wilayah</span>
              </button>
            </aside>
          ) : null}

          <div className="relative h-full min-w-0 flex-1">
            {renderMap({})}
          </div>

          <aside className={`z-20 flex h-full shrink-0 flex-col border-l border-slate-200 bg-white/95 backdrop-blur transition-all duration-300 ${rightDockOpen ? 'w-[280px] sm:w-[320px]' : 'w-10'}`} data-testid="peta-right-dock">
            {rightDockOpen ? (
              rightBody
            ) : (
              <button type="button" onClick={() => setRightDockOpen(true)}
                className="flex h-full w-full flex-col items-center justify-start gap-3 py-3 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                title="Buka Pengaturan Peta & Lapisan" aria-label="Buka Pengaturan Peta & Lapisan">
                <ChevronLeft className="h-4 w-4 text-slate-400" />
                <Settings className="h-4 w-4 text-emerald-700" />
                <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-wider text-slate-600" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Pengaturan Lapisan</span>
              </button>
            )}
          </aside>
        </div>
      </div>
  )
}
