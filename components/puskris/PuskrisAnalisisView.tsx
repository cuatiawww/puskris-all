'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  Ambulance,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Eye,
  FileSpreadsheet,
  HeartPulse,
  PhoneCall,
  Printer,
  RotateCcw,
  Search,
  ShieldAlert,
  Square,
  Users,
  X,
  Grid3x3,
} from 'lucide-react'
import MatriksHeatTable, { fmtMatriks, matriksCsv, totalFor } from '@/components/puskris/MatriksHeatTable'
import {
  inPeriode,
  matriksBencana,
  matriksKategoriPanggilan,
  matriksNcc,
  matriksAsistensi,
  matriksPsc,
  matriksPscHarian,
  matriksPscProvJenis,
  matriksTck,
  type TckView,
  type MatriksDef,
} from '@/lib/puskris/matriks'
import type { KejadianTerbaru } from '@/lib/puskris/kejadian-terbaru'
import { PUBLIC_BASE_PATH } from '@/lib/public-path'
import { applyDerive, eocKejadian, nf, periodeRange, pf } from '@/lib/puskris/derive'
import { tahunIni, toDeriveFilter, type PuskrisUiFilter } from '@/lib/puskris/ui-filter'
import { PeriodePicker } from '@/components/puskris/PuskrisFilterPanel'
import type { PeriodeMatriks } from '@/lib/puskris/matriks'
import type { ProvinceRow } from '@/lib/puskris/types'

type GenericTab = 'tck' | 'panggilan' | 'bencana' | 'asistensi'
type ActiveMatrixTab = GenericTab | 'ambulans' | 'kejadian' | 'jenis' | 'kesenjangan'
const GENERIC_TABS: GenericTab[] = ['tck', 'panggilan', 'bencana', 'asistensi']

interface DetailModalData {
  title: string
  subtitle: string
  badgeText: string
  badgeColor: string
  docId: string
  timestamp: string
  kpis: { label: string; value: string; hint?: string }[]
  details: { label: string; value: string | number; tone?: string }[]
}

export default function PuskrisAnalisisView({
  raw,
  f,
  onApply,
  years = [],
}: {
  raw: any
  f: PuskrisUiFilter
  onApply: (next: PuskrisUiFilter) => void
  years?: number[]
}) {
  // Matriks Tab state
  const [activeTab, setActiveTab] = useState<ActiveMatrixTab>('tck')
  const [panggilanView, setPanggilanView] = useState<'ncc' | 'psc-harian' | 'psc' | 'psc-jenis' | 'kategori'>('ncc')
  const [asisView, setAsisView] = useState<'provinsi' | 'kabkota'>('provinsi')
  const [tckView, setTckView] = useState<TckView>('komposisi')
  const [liveEvents, setLiveEvents] = useState<{ events: KejadianTerbaru[]; live: boolean } | null>(null)

  // Search and Filter states for the Left Panel
  const [searchTerm, setSearchTerm] = useState('')
  // Periode mengikuti filter periode global (URL); "Semua waktu" hanya berlaku di halaman Analisis.
  const [semuaWaktu, setSemuaWaktu] = useState(false)
  const periodeFilter = useMemo<PeriodeMatriks>(() => {
    if (semuaWaktu) return 'semua'
    const r = periodeRange(toDeriveFilter(f))
    return { from: r.from, to: r.to }
  }, [semuaWaktu, f])
  const [provSearch, setProvSearch] = useState('')
  const [selectedProvinces, setSelectedProvinces] = useState<string[]>([])
  const [selectedDisasters, setSelectedDisasters] = useState<string[]>([])

  // Special criteria checkboxes
  const [filterAdaKorban, setFilterAdaKorban] = useState(false)
  const [filterAdaPengungsi, setFilterAdaPengungsi] = useState(false)
  const [filterAdaAmbulansRusak, setFilterAdaAmbulansRusak] = useState(false)

  // In-table quick search
  const [tableSearch, setTableSearch] = useState('')

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(9999)

  // Sorting states
  const [sortField, setSortField] = useState<string>('')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // Modal preview state
  const [previewData, setPreviewData] = useState<DetailModalData | null>(null)

  // Base derived data
  const derived = useMemo(() => applyDerive(raw, toDeriveFilter(f)), [raw, f])

  // Extract master province list
  const allProvinces = useMemo(() => {
    return (raw?.regions || []).map((r: any) => ({
      code: String(r.code),
      nama: String(r.name || r.nama),
    }))
  }, [raw])

  // Filtered province options for left sidebar
  const visibleProvinceOptions = useMemo(() => {
    if (!provSearch.trim()) return allProvinces
    const q = provSearch.toLowerCase()
    return allProvinces.filter((p: any) => p.nama.toLowerCase().includes(q) || p.code.includes(q))
  }, [allProvinces, provSearch])

  // Disaster types
  const disasterOptions = useMemo(() => {
    const list = raw?.eoc?.jenis_2026 || []
    return list.map((item: any) => item.nama as string)
  }, [raw])

  // RS Jejaring map
  const rsMap = useMemo(() => {
    const map = new Map<string, number>()
    ;(raw?.psc?.provinsi || []).forEach((p: any) => {
      map.set(String(p.code), Number(p.rs_jejaring || 0))
    })
    return map
  }, [raw])

  // 1. Data Source: Matriks Ambulans & PSC
  const ambulansRows = useMemo(() => {
    return derived.rows.map((r: ProvinceRow, idx: number) => {
      const rsJejaring = rsMap.get(r.code) || 0
      const totalAmb = r.ambulans || 0
      const baik = r.ambulansBaik || 0
      const rusakRingan = r.ambulansRusakRingan || 0
      const rusakBerat = r.ambulansRusakBerat || 0
      const gps = r.ambulansGps || 0
      const persenBaik = totalAmb > 0 ? (baik / totalAmb) * 100 : 0

      let status = 'Siaga Prima'
      let statusTone = 'bg-emerald-50 text-emerald-800 border-emerald-200'
      if (persenBaik < 50 || rusakBerat > 5) {
        status = 'Perlu Peremajaan'
        statusTone = 'bg-red-50 text-red-800 border-red-200'
      } else if (persenBaik < 80 || rusakRingan > 5) {
        status = 'Siaga Cukup'
        statusTone = 'bg-amber-50 text-amber-800 border-amber-200'
      }

      return {
        id: `amb-${r.code}`,
        code: r.code,
        no: idx + 1,
        nama: r.nama,
        ambulans: totalAmb,
        ambulansBaik: baik,
        ambulansRusakRingan: rusakRingan,
        ambulansRusakBerat: rusakBerat,
        ambulansGps: gps,
        pscTotal: r.pscTotal || 0,
        pscAktif: r.pscAktif || 0,
        panggilan: r.panggilan || 0,
        rsJejaring,
        persenBaik,
        status,
        statusTone,
      }
    })
  }, [derived.rows, rsMap])

  // 2. Data Source: Matriks Kejadian Bencana
  const kejadianRows = useMemo(() => {
    const live = raw?.eoc?.data_source === 'langsung' && Array.isArray(raw?.eoc?.events)
    const regionName = Object.fromEntries((raw?.regions || []).map((r: any) => [String(r.code), r.name]))
    const list = live ? (raw.eoc.events as any[]).map((e) => eocKejadian(e, regionName)) : raw?.eoc?.kejadian_krisis_terbaru || []
    return list.map((item: any, idx: number) => {
      const meninggal = Number(item.meninggal || 0)
      const lb = Number(item.luka_berat || 0)
      const lr = Number(item.luka_ringan || 0)
      const pengungsi = Number(item.pengungsi || 0)
      const terdampak = Number(item.terdampak || 0)
      const isKrisis = typeof item.krisis === 'boolean' ? item.krisis : meninggal > 0 || pengungsi > 50 || lb > 0

      let statusText = isKrisis ? 'Darurat Krisis' : 'Pantauan Normal'
      let statusTone = isKrisis ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-100 text-slate-700 border-slate-200'

      return {
        id: `kej-${idx}`,
        no: idx + 1,
        tanggal: item.tanggal || '2026-08-15',
        jenis: item.jenis || 'Bencana Alam',
        provinsi: item.provinsi || '—',
        kabupaten: item.kabupaten || '—',
        code: item.code || '',
        meninggal,
        lukaBerat: lb,
        lukaRingan: lr,
        totalLuka: lb + lr,
        pengungsi,
        terdampak,
        korban: Number(item.korban || 0),
        statusText,
        statusTone,
      }
    })
  }, [raw])

  // 3. Data Source: Matriks Rekap Jenis Kejadian
  const jenisRekapRows = useMemo(() => {
    const list = raw?.eoc?.jenis_2026 || []
    const totalNasional = list.reduce((a: number, c: any) => a + Number(c.jumlah || 0), 0) || 1

    return list.map((item: any, idx: number) => {
      const nama = item.nama as string
      const frekuensi = Number(item.jumlah || 0)
      const proporsi = (frekuensi / totalNasional) * 100

      // Hitung agregat korban dari data kejadian yang cocok jenisnya
      const regionName0: Record<string, string> = {}
      const pool0 = raw?.eoc?.data_source === 'langsung' && Array.isArray(raw?.eoc?.events) ? (raw.eoc.events as any[]).map((e) => eocKejadian(e, regionName0)) : raw?.eoc?.kejadian_krisis_terbaru || []
      const matched = pool0.filter(
        (k: any) => (k.jenis || '').toLowerCase().trim() === nama.toLowerCase().trim()
      )
      const meninggal = matched.reduce((a: number, c: any) => a + Number(c.meninggal || 0), 0)
      const luka = matched.reduce((a: number, c: any) => a + Number(c.luka_berat || 0) + Number(c.luka_ringan || 0), 0)
      const pengungsi = matched.reduce((a: number, c: any) => a + Number(c.pengungsi || 0), 0)
      const terdampak = matched.reduce((a: number, c: any) => a + Number(c.terdampak || 0), 0)

      let tingkatBahaya = 'Rendah'
      let bahayaTone = 'bg-slate-100 text-slate-700 border-slate-200'
      if (frekuensi >= 500 || meninggal >= 5) {
        tingkatBahaya = 'Sangat Tinggi'
        bahayaTone = 'bg-red-50 text-red-800 border-red-200'
      } else if (frekuensi >= 100 || meninggal > 0 || pengungsi > 1000) {
        tingkatBahaya = 'Tinggi'
        bahayaTone = 'bg-amber-50 text-amber-800 border-amber-200'
      } else if (frekuensi >= 30) {
        tingkatBahaya = 'Sedang'
        bahayaTone = 'bg-sky-50 text-sky-800 border-sky-200'
      }

      return {
        id: `jenis-${idx}`,
        no: idx + 1,
        nama,
        frekuensi,
        meninggal,
        luka,
        pengungsi,
        terdampak,
        proporsi,
        tingkatBahaya,
        bahayaTone,
      }
    })
  }, [raw])

  // 4. Data Source: Matriks Kesenjangan Respons Wilayah
  const kesenjanganRows = useMemo(() => {
    return [...derived.rows]
      .sort((a, b) => b.indeksRespons - a.indeksRespons)
      .map((r, i) => {
        let levelPrioritas = 'Rendah'
        let prioritasTone = 'bg-emerald-50 text-emerald-800 border-emerald-200'
        if (r.indeksRespons >= 70) {
          levelPrioritas = 'Prioritas 1 (Kritis)'
          prioritasTone = 'bg-red-50 text-red-800 border-red-200'
        } else if (r.indeksRespons >= 55) {
          levelPrioritas = 'Prioritas 2 (Waspada)'
          prioritasTone = 'bg-amber-50 text-amber-800 border-amber-200'
        }

        return {
          id: `gap-${r.code}`,
          rank: i + 1,
          code: r.code,
          nama: r.nama,
          indeksRespons: r.indeksRespons,
          beban: r.beban * 100,
          kapasitas: r.kapasitas * 100,
          kejadian: r.kejadian,
          meninggal: r.meninggal,
          pengungsi: r.pengungsi,
          ambulansBaik: r.ambulansBaik,
          pscAktif: r.pscAktif,
          tck: r.tck,
          stok: r.stok,
          levelPrioritas,
          prioritasTone,
        }
      })
  }, [derived.rows])

  // 5. Matriks generik: Tenaga Cadangan, Panggilan, Kejadian Bencana (provinsi x jenis)
  useEffect(() => {
    let alive = true
    fetch(`${PUBLIC_BASE_PATH}/api/v1/map-layers/kejadian-terbaru`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && j?.events?.length) setLiveEvents({ events: j.events, live: j.mode === 'langsung' })
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  const eventsBencana = useMemo(() => liveEvents?.events || [], [liveEvents, raw])
  const genericDef: MatriksDef | null = useMemo(() => {
    if (activeTab === 'tck') return matriksTck(raw, tckView, periodeFilter)
    if (activeTab === 'panggilan') {
      if (panggilanView === 'psc') return matriksPsc(raw)
      if (panggilanView === 'psc-harian') return matriksPscHarian(raw, periodeFilter) || matriksNcc(raw, periodeFilter)
      if (panggilanView === 'psc-jenis') return matriksPscProvJenis(raw) || matriksPsc(raw)
      if (panggilanView === 'kategori') return matriksKategoriPanggilan(raw)
      return matriksNcc(raw, periodeFilter)
    }
    if (activeTab === 'asistensi') return matriksAsistensi(raw, asisView)
    if (activeTab === 'bencana')
      return matriksBencana(raw, eventsBencana, { periode: periodeFilter, jenis: selectedDisasters, sumberLive: Boolean(liveEvents?.live) })
    return null
  }, [activeTab, panggilanView, asisView, tckView, raw, periodeFilter, eventsBencana, selectedDisasters, liveEvents])
  const filteredGeneric = useMemo(() => {
    if (!genericDef) return []
    return genericDef.rows.filter((row) => {
      if (genericDef.provinsiRows && selectedProvinces.length > 0 && !selectedProvinces.includes(String(row.code))) return false
      if (genericDef.id === 'bencana') {
        if (filterAdaKorban && !row.meninggal_2026) return false
        if (filterAdaPengungsi && !row.pengungsi_2026) return false
      }
      for (const term of [searchTerm, tableSearch]) {
        const q = term.trim().toLowerCase()
        if (q && !`${row.label} ${row.sub || ''} ${row.code || ''} ${row.tanggal || ''}`.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [genericDef, selectedProvinces, filterAdaKorban, filterAdaPengungsi, searchTerm, tableSearch])
  const genericCounts = useMemo(
    () => ({
      tck: (raw?.tck?.provinsi || []).length,
      panggilan: (raw?.ncc?.days || []).filter((d: any) => d.available).length,
      bencana: (raw?.regions || []).length,
      asistensi: (raw?.asistensi?.wilayah || []).length,
    }),
    [raw],
  )

  // Filter Logic per Tab
  const filteredAmbulans = useMemo(() => {
    return ambulansRows.filter((row) => {
      if (selectedProvinces.length > 0 && !selectedProvinces.includes(row.code)) return false
      if (filterAdaAmbulansRusak && row.ambulansRusakRingan === 0 && row.ambulansRusakBerat === 0) return false
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase()
        if (!row.nama.toLowerCase().includes(q) && !row.code.includes(q)) return false
      }
      if (tableSearch.trim()) {
        const q = tableSearch.toLowerCase()
        if (!row.nama.toLowerCase().includes(q) && !row.status.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [ambulansRows, selectedProvinces, filterAdaAmbulansRusak, searchTerm, tableSearch])

  const filteredKejadian = useMemo(() => {
    return kejadianRows.filter((row) => {
      if (selectedProvinces.length > 0 && !selectedProvinces.includes(row.code)) return false
      if (selectedDisasters.length > 0 && !selectedDisasters.includes(row.jenis)) return false
      if (!inPeriode(row.tanggal, periodeFilter)) return false
      if (filterAdaKorban && row.meninggal === 0) return false
      if (filterAdaPengungsi && row.pengungsi === 0) return false
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase()
        const match =
          row.provinsi.toLowerCase().includes(q) ||
          row.kabupaten.toLowerCase().includes(q) ||
          row.jenis.toLowerCase().includes(q)
        if (!match) return false
      }
      if (tableSearch.trim()) {
        const q = tableSearch.toLowerCase()
        const match =
          row.provinsi.toLowerCase().includes(q) ||
          row.kabupaten.toLowerCase().includes(q) ||
          row.jenis.toLowerCase().includes(q) ||
          row.tanggal.includes(q)
        if (!match) return false
      }
      return true
    })
  }, [kejadianRows, selectedProvinces, selectedDisasters, periodeFilter, filterAdaKorban, filterAdaPengungsi, searchTerm, tableSearch])

  const filteredJenis = useMemo(() => {
    return jenisRekapRows.filter((row) => {
      if (selectedDisasters.length > 0 && !selectedDisasters.includes(row.nama)) return false
      if (filterAdaKorban && row.meninggal === 0) return false
      if (filterAdaPengungsi && row.pengungsi === 0) return false
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase()
        if (!row.nama.toLowerCase().includes(q)) return false
      }
      if (tableSearch.trim()) {
        const q = tableSearch.toLowerCase()
        if (!row.nama.toLowerCase().includes(q) && !row.tingkatBahaya.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [jenisRekapRows, selectedDisasters, filterAdaKorban, filterAdaPengungsi, searchTerm, tableSearch])

  const filteredKesenjangan = useMemo(() => {
    return kesenjanganRows.filter((row) => {
      if (selectedProvinces.length > 0 && !selectedProvinces.includes(row.code)) return false
      if (filterAdaKorban && row.meninggal === 0) return false
      if (filterAdaPengungsi && row.pengungsi === 0) return false
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase()
        if (!row.nama.toLowerCase().includes(q) && !row.code.includes(q)) return false
      }
      if (tableSearch.trim()) {
        const q = tableSearch.toLowerCase()
        if (!row.nama.toLowerCase().includes(q) && !row.levelPrioritas.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [kesenjanganRows, selectedProvinces, filterAdaKorban, filterAdaPengungsi, searchTerm, tableSearch])

  // Get active dataset
  const activeDataset = useMemo(() => {
    switch (activeTab) {
      case 'ambulans':
        return filteredAmbulans
      case 'kejadian':
        return filteredKejadian
      case 'jenis':
        return filteredJenis
      case 'kesenjangan':
        return filteredKesenjangan
      default:
        return filteredGeneric
    }
  }, [activeTab, filteredAmbulans, filteredKejadian, filteredJenis, filteredKesenjangan, filteredGeneric])

  // Sorting
  const sortedDataset = useMemo(() => {
    if (!sortField) return activeDataset
    const copy = [...activeDataset]
    copy.sort((a: any, b: any) => {
      const valA = a[sortField]
      const valB = b[sortField]
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA
      }
      const strA = String(valA || '').toLowerCase()
      const strB = String(valB || '').toLowerCase()
      return sortOrder === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA)
    })
    return copy
  }, [activeDataset, sortField, sortOrder])

  // Pagination
  const totalRows = sortedDataset.length
  const totalPages = pageSize >= 9999 ? 1 : Math.max(1, Math.ceil(totalRows / pageSize))
  const paginatedRows = useMemo(() => {
    if (pageSize >= 9999) return sortedDataset
    const start = (currentPage - 1) * pageSize
    return sortedDataset.slice(start, start + pageSize)
  }, [sortedDataset, currentPage, pageSize])

  // Top Summary Cards metrics
  const summaryMetrics = useMemo(() => {
    const totalKejadian = derived.situasi?.terpantau || 0
    const meninggal = derived.situasi?.meninggal || 0
    const eocLive = derived.eocLive
    const lukaBerat = eocLive ? Number(derived.situasi?.luka_berat || 0) : (raw?.eoc?.kejadian_krisis_terbaru || []).reduce((a: number, c: any) => a + Number(c.luka_berat || 0), 0)
    const lukaRingan = eocLive ? Number(derived.situasi?.luka_ringan || 0) : (raw?.eoc?.kejadian_krisis_terbaru || []).reduce((a: number, c: any) => a + Number(c.luka_ringan || 0), 0)
    const totalLuka = lukaBerat + lukaRingan
    const totalAmbulans = derived.layanan?.ambulans || raw?.psc?.summary?.total_ambulan || 0
    const ambulansBaik = derived.layanan?.ambulansBaik || raw?.psc?.summary?.ambulans_baik || 0
    const ambulansGps = raw?.psc?.summary?.ambulans_gps || 0
    const persenBaik = totalAmbulans > 0 ? (ambulansBaik / totalAmbulans) * 100 : 0
    const pscAktif = derived.layanan?.pscAktif || raw?.psc?.summary?.psc_aktif || 0
    const pscTotal = derived.layanan?.pscTotal || raw?.psc?.summary?.total_psc || 0
    const totalRs = raw?.psc?.summary?.total_rs || 0
    const totalTck = derived.sdm?.individu || raw?.tck?.summary?.individu || 0

    return {
      totalKejadian,
      meninggal,
      totalLuka,
      totalAmbulans,
      ambulansBaik,
      ambulansGps,
      persenBaik,
      pscAktif,
      pscTotal,
      totalRs,
      totalTck,
    }
  }, [derived, raw])

  // Reset Filters
  const handleResetFilters = () => {
    setSearchTerm('')
    setTableSearch('')
    setSemuaWaktu(false)
    onApply({ ...f, periode: 'tahun', tahun: tahunIni(), bulan: null, dari: null, sampai: null })
    setProvSearch('')
    setSelectedProvinces([])
    setSelectedDisasters([])
    setFilterAdaKorban(false)
    setFilterAdaPengungsi(false)
    setFilterAdaAmbulansRusak(false)
    setCurrentPage(1)
  }

  // Handle Sort Toggle
  const handleSort = (field: string) => {
    if (sortField === field) {
      if (sortOrder === 'asc') setSortOrder('desc')
      else {
        setSortField('')
        setSortOrder('asc')
      }
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  // Handle CSV Export
  const handleExportCSV = () => {
    let headers: string[] = []
    let rows: string[][] = []
    let filename = `matriks-${genericDef ? genericDef.id : activeTab}-puskris-${new Date().toISOString().slice(0, 10)}.csv`
    if (genericDef) {
      const out = matriksCsv(genericDef, sortedDataset as any[])
      headers = out.headers
      rows = out.rows
    } else

    if (activeTab === 'ambulans') {
      headers = [
        'No',
        'Kode Provinsi',
        'Nama Provinsi',
        'Total Ambulans',
        'Kondisi Baik',
        'Rusak Ringan',
        'Rusak Berat',
        'Ambulans Ber-GPS',
        'Persen Laik (%)',
        'PSC Aktif',
        'PSC Total',
        'RS Jejaring',
        'Panggilan 119',
        'Status Kesiapan',
      ]
      rows = (sortedDataset as any[]).map((r, i) => [
        String(i + 1),
        r.code,
        `"${r.nama}"`,
        String(r.ambulans),
        String(r.ambulansBaik),
        String(r.ambulansRusakRingan),
        String(r.ambulansRusakBerat),
        String(r.ambulansGps),
        r.persenBaik.toFixed(1),
        String(r.pscAktif),
        String(r.pscTotal),
        String(r.rsJejaring),
        String(r.panggilan),
        `"${r.status}"`,
      ])
    } else if (activeTab === 'kejadian') {
      headers = [
        'No',
        'Tanggal',
        'Jenis Kejadian',
        'Provinsi',
        'Kabupaten/Kota',
        'Korban Meninggal (MD)',
        'Luka Berat',
        'Luka Ringan',
        'Pengungsi',
        'Penduduk Terdampak',
        'Status Krisis',
      ]
      rows = (sortedDataset as any[]).map((r, i) => [
        String(i + 1),
        r.tanggal,
        `"${r.jenis}"`,
        `"${r.provinsi}"`,
        `"${r.kabupaten}"`,
        String(r.meninggal),
        String(r.lukaBerat),
        String(r.lukaRingan),
        String(r.pengungsi),
        String(r.terdampak),
        `"${r.statusText}"`,
      ])
    } else if (activeTab === 'jenis') {
      headers = [
        'No',
        'Jenis Bencana',
        'Frekuensi Kejadian',
        'Meninggal (MD)',
        'Luka-Luka',
        'Pengungsi',
        'Terdampak',
        'Proporsi (%)',
        'Tingkat Bahaya',
      ]
      rows = (sortedDataset as any[]).map((r, i) => [
        String(i + 1),
        `"${r.nama}"`,
        String(r.frekuensi),
        String(r.meninggal),
        String(r.luka),
        String(r.pengungsi),
        String(r.terdampak),
        r.proporsi.toFixed(2),
        `"${r.tingkatBahaya}"`,
      ])
    } else if (activeTab === 'kesenjangan') {
      headers = [
        'Peringkat',
        'Kode',
        'Provinsi',
        'Indeks Respons (0-100)',
        'Skor Beban',
        'Skor Kapasitas',
        'Kejadian Terpantau',
        'Meninggal',
        'Pengungsi',
        'Ambulans Baik',
        'PSC Aktif',
        'Tenaga Cadangan (TCK)',
        'Prioritas Intervensi',
      ]
      rows = (sortedDataset as any[]).map((r) => [
        String(r.rank),
        r.code,
        `"${r.nama}"`,
        r.indeksRespons.toFixed(1),
        r.beban.toFixed(1),
        r.kapasitas.toFixed(1),
        String(r.kejadian),
        String(r.meninggal),
        String(r.pengungsi),
        String(r.ambulansBaik),
        String(r.pscAktif),
        String(r.tck),
        `"${r.levelPrioritas}"`,
      ])
    }

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Handle Print PDF
  const handlePrint = () => {
    window.print()
  }

  // Open Preview Modal
  const handleOpenPreview = (item: any) => {
    const now = new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })
    if (genericDef) {
      const tot = genericDef.cols.filter((c) => c.heat).slice(0, 4)
      setPreviewData({
        title: genericDef.title,
        subtitle: `${genericDef.rowLabel}: ${item.label}${item.sub ? ` · ${item.sub}` : ''}`,
        badgeText: genericDef.id === 'tck' ? 'Kesiapsiagaan' : genericDef.id === 'bencana' ? 'Situasi Krisis' : 'Layanan Gawat Darurat',
        badgeColor: 'bg-teal-50 text-[#0D6B67] border-teal-200',
        docId: `MTX-${genericDef.id.toUpperCase()}-${item.code || item.tanggal || item.id}`,
        timestamp: now,
        kpis: tot.map((c) => {
          const t = totalFor(c, filteredGeneric)
          const share = typeof t === 'number' && t > 0 && c.fmt === 'int' ? ` · ${((Number(item[c.key]) / t) * 100).toFixed(1)}% total` : ''
          return { label: c.label, value: fmtMatriks(item[c.key], c.fmt), hint: share ? share.slice(3) : undefined }
        }),
        details: [
          { label: genericDef.rowLabel, value: item.label },
          ...genericDef.cols.map((c) => ({ label: c.group ? `${c.label} (${c.group})` : c.label, value: fmtMatriks(item[c.key], c.fmt) })),
        ],
      })
      return
    }
    if (activeTab === 'ambulans') {
      setPreviewData({
        title: `Profil Kesiapsiagaan Armada Ambulans & PSC 119`,
        subtitle: `Wilayah Provinsi ${item.nama} (Kode: ${item.code})`,
        badgeText: item.status,
        badgeColor: item.statusTone,
        docId: `PUSKRIS-AMB-${item.code}-2026`,
        timestamp: now,
        kpis: [
          { label: 'Total Unit Ambulans', value: `${nf(item.ambulans)} Unit` },
          { label: 'Kondisi Laik Operasi', value: `${nf(item.ambulansBaik)} Unit (${pf(item.persenBaik)})` },
          { label: 'PSC 119 Aktif', value: `${item.pscAktif} / ${item.pscTotal} PSC` },
          { label: 'Rumah Sakit Jejaring', value: `${nf(item.rsJejaring)} RS` },
        ],
        details: [
          { label: 'Provinsi', value: item.nama },
          { label: 'Kode Wilayah Kemendagri', value: item.code },
          { label: 'Total Armada Ambulans', value: `${nf(item.ambulans)} Unit` },
          { label: 'Ambulans Kondisi Baik', value: `${nf(item.ambulansBaik)} Unit`, tone: 'text-emerald-700 font-bold' },
          { label: 'Ambulans Rusak Ringan', value: `${nf(item.ambulansRusakRingan)} Unit`, tone: item.ambulansRusakRingan > 0 ? 'text-amber-700' : '' },
          { label: 'Ambulans Rusak Berat', value: `${nf(item.ambulansRusakBerat)} Unit`, tone: item.ambulansRusakBerat > 0 ? 'text-red-700 font-bold' : '' },
          { label: 'Ambulans Dilengkapi GPS Tracker', value: `${nf(item.ambulansGps)} Unit (${pf(item.ambulans > 0 ? (item.ambulansGps / item.ambulans) * 100 : 0)})` },
          { label: 'Pusat Komando PSC 119 Beroperasi', value: `${item.pscAktif} dari ${item.pscTotal} Pos Simpul` },
          { label: 'Fasilitas RS Jejaring Terkoneksi', value: `${nf(item.rsJejaring)} Rumah Sakit Rujukan` },
          { label: 'Riwayat Panggilan Kegawatdaruratan', value: `${nf(item.panggilan)} Panggilan Terlayani` },
          { label: 'Status Rekomendasi Alokasi', value: item.status },
        ],
      })
    } else if (activeTab === 'kejadian') {
      setPreviewData({
        title: `Laporan Ringkas Kejadian Bencana & Dampak Kesehatan`,
        subtitle: `${item.jenis} di Kab/Kota ${item.kabupaten}, Provinsi ${item.provinsi}`,
        badgeText: item.statusText,
        badgeColor: item.statusTone,
        docId: `EOC-RESUME-${item.no}-2026`,
        timestamp: now,
        kpis: [
          { label: 'Tanggal Terjadi', value: item.tanggal },
          { label: 'Korban Meninggal (MD)', value: `${nf(item.meninggal)} Jiwa`, hint: 'Konfirmasi Dinkes' },
          { label: 'Total Korban Luka', value: `${nf(item.totalLuka)} Jiwa (${item.lukaBerat} LB / ${item.lukaRingan} LR)` },
          { label: 'Jumlah Pengungsi', value: `${nf(item.pengungsi)} Jiwa` },
        ],
        details: [
          { label: 'Nomor Urut Register', value: `#${item.no}` },
          { label: 'Tanggal Laporan Kejadian', value: item.tanggal },
          { label: 'Jenis Bencana / Bahaya', value: item.jenis },
          { label: 'Provinsi', value: item.provinsi },
          { label: 'Kabupaten / Kota', value: item.kabupaten },
          { label: 'Korban Meninggal Dunia', value: `${nf(item.meninggal)} Orang`, tone: item.meninggal > 0 ? 'text-red-700 font-bold' : '' },
          { label: 'Korban Luka Berat', value: `${nf(item.lukaBerat)} Orang` },
          { label: 'Korban Luka Ringan', value: `${nf(item.lukaRingan)} Orang` },
          { label: 'Penduduk Mengungsi', value: `${nf(item.pengungsi)} Orang` },
          { label: 'Total Populasi Terdampak', value: `${nf(item.terdampak)} Jiwa` },
          { label: 'Klasifikasi Respons Krisis', value: item.statusText },
        ],
      })
    } else if (activeTab === 'jenis') {
      setPreviewData({
        title: `Ringkasan Agregat Jenis Kejadian Bencana`,
        subtitle: `Analisis Bencana: ${item.nama}`,
        badgeText: item.tingkatBahaya,
        badgeColor: item.bahayaTone,
        docId: `PUSKRIS-CAT-${item.no}-2026`,
        timestamp: now,
        kpis: [
          { label: 'Total Kejadian Terlapor', value: `${nf(item.frekuensi)} Kejadian` },
          { label: 'Proporsi Nasional', value: `${item.proporsi.toFixed(1)}%` },
          { label: 'Total Korban Meninggal', value: `${nf(item.meninggal)} Jiwa` },
          { label: 'Terdampak & Pengungsi', value: `${nf(item.pengungsi + item.terdampak)} Jiwa` },
        ],
        details: [
          { label: 'Kategori Bencana', value: item.nama },
          { label: 'Frekuensi Kumulatif 2026', value: `${nf(item.frekuensi)} Kali Kejadian` },
          { label: 'Porsi dari Total Bencana', value: `${item.proporsi.toFixed(2)}% dari Seluruh Kejadian Nasional` },
          { label: 'Korban Jiwa (Meninggal)', value: `${nf(item.meninggal)} Orang` },
          { label: 'Korban Luka (Berat & Ringan)', value: `${nf(item.luka)} Orang` },
          { label: 'Warga Mengungsi', value: `${nf(item.pengungsi)} Orang` },
          { label: 'Estimasi Terdampak Langsung', value: `${nf(item.terdampak)} Orang` },
          { label: 'Tingkat Bahaya Kesehatan Masyarakat', value: item.tingkatBahaya },
        ],
      })
    } else if (activeTab === 'kesenjangan') {
      setPreviewData({
        title: `Analisis Indeks Kesenjangan Respons Wilayah`,
        subtitle: `Provinsi ${item.nama} (Peringkat #${item.rank} Nasional)`,
        badgeText: item.levelPrioritas,
        badgeColor: item.prioritasTone,
        docId: `GAP-INDEX-${item.code}-2026`,
        timestamp: now,
        kpis: [
          { label: 'Skor Indeks Respons', value: `${item.indeksRespons.toFixed(1)} / 100`, hint: '0 (Kapasitas Baik) - 100 (Kritis)' },
          { label: 'Beban Respons (0-100)', value: `${item.beban.toFixed(1)}` },
          { label: 'Kapasitas Kesiapsiagaan', value: `${item.kapasitas.toFixed(1)}` },
          { label: 'Ambulans Laik Siaga', value: `${nf(item.ambulansBaik)} Unit` },
        ],
        details: [
          { label: 'Peringkat Kesenjangan Nasional', value: `Peringkat #${item.rank} dari 38 Provinsi` },
          { label: 'Provinsi', value: item.nama },
          { label: 'Skor Indeks Kesenjangan Respons', value: `${item.indeksRespons.toFixed(1)} Poin` },
          { label: 'Skor Beban Krisis (Kejadian & Dampak)', value: `${item.beban.toFixed(1)} Poin` },
          { label: 'Skor Kapasitas Daerah (PSC, Armada, SDM)', value: `${item.kapasitas.toFixed(1)} Poin` },
          { label: 'Jumlah Kejadian Terpantau', value: `${nf(item.kejadian)} Kejadian` },
          { label: 'Korban Meninggal', value: `${nf(item.meninggal)} Jiwa` },
          { label: 'Pengungsi yang Membutuhkan Bantuan', value: `${nf(item.pengungsi)} Jiwa` },
          { label: 'Armada Ambulans Siap Pakai', value: `${nf(item.ambulansBaik)} Unit` },
          { label: 'Pos Simpul PSC 119 Aktif', value: `${item.pscAktif} Unit` },
          { label: 'Tenaga Cadangan Kesehatan (TCK) Terdaftar', value: `${nf(item.tck)} Personil` },
          { label: 'Level Prioritas Dukungan Puskris Pusat', value: item.levelPrioritas },
        ],
      })
    }
  }

  // Active filter count
  const activeFiltersCount =
    (searchTerm ? 1 : 0) +
    (semuaWaktu || f.periode !== 'tahun' || f.tahun !== tahunIni() ? 1 : 0) +
    selectedProvinces.length +
    selectedDisasters.length +
    (filterAdaKorban ? 1 : 0) +
    (filterAdaPengungsi ? 1 : 0) +
    (filterAdaAmbulansRusak ? 1 : 0)

  return (
    <div className="space-y-6" data-testid="puskris-analisis-view">
      {/* TOP SUMMARY / KPI CARDS (Matching unduh-laporan top metrics) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 print:hidden">
        {/* Card 1: Total Kejadian */}
        <div className="skdr-card relative overflow-hidden p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Kejadian Terlapor</span>
            <div className="rounded-xl bg-teal-50 p-2 text-primary">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black tabular-nums text-slate-900">{nf(summaryMetrics.totalKejadian)}</span>
            <span className="text-xs font-semibold text-slate-500">kejadian</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Terfilter aktif di dasbor nasional Pusat Krisis Kesehatan
          </p>
        </div>

        {/* Card 2: Korban Jiwa & Luka */}
        <div className="skdr-card relative overflow-hidden p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Korban Jiwa & Luka</span>
            <div className="rounded-xl bg-red-50 p-2 text-red-600">
              <HeartPulse className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black tabular-nums text-red-600">{nf(summaryMetrics.meninggal)}</span>
            <span className="text-xs font-semibold text-slate-600">MD · {nf(summaryMetrics.totalLuka)} Luka</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Luka berat dan ringan membutuhkan penanganan medis
          </p>
        </div>

        {/* Card 3: Matriks Armada Ambulans */}
        <div className="skdr-card relative overflow-hidden p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Armada Ambulans</span>
            <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
              <Ambulance className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black tabular-nums text-slate-900">{nf(summaryMetrics.totalAmbulans)}</span>
            <span className="text-xs font-semibold text-emerald-700">({pf(summaryMetrics.persenBaik)} Baik)</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            {nf(summaryMetrics.ambulansGps)} unit dilengkapi GPS pelacak posisi
          </p>
        </div>

        {/* Card 4: Kesiapan PSC & Respons */}
        <div className="skdr-card relative overflow-hidden p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Kapasitas PSC & RS</span>
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
              <ShieldAlert className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black tabular-nums text-slate-900">
              {summaryMetrics.pscAktif}
            </span>
            <span className="text-xs font-semibold text-slate-600">
              / {summaryMetrics.pscTotal} PSC · {nf(summaryMetrics.totalRs)} RS
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            {nf(summaryMetrics.totalTck)} Tenaga Cadangan Kesehatan (TCK) siaga
          </p>
        </div>
      </div>

      {/* MAIN SPLIT LAYOUT: LEFT FILTER SIDEBAR + RIGHT MATRIX CONTENT */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* LEFT FILTER PANEL (Width ~ 3-4 cols on large screens) */}
        <div className="space-y-4 lg:col-span-4 xl:col-span-3 print:hidden">
          <div className="skdr-card p-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-black text-slate-900">Filter Matriks</h3>
              </div>
              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-50"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Reset ({activeFiltersCount})</span>
                </button>
              )}
            </div>

            <div className="mt-4 space-y-4 text-xs">
              {/* 1. Global Search Box */}
              <div>
                <label className="mb-1 block font-bold text-slate-700">Cari Wilayah / Kata Kunci</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Nama provinsi, kab, jenis..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-7 text-xs text-slate-800 placeholder-slate-400 focus:border-primary focus:bg-white focus:outline-none"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* 2. Rentang Waktu (Periode) */}
              <div>
                <label className="mb-1.5 flex items-center justify-between font-bold text-slate-700">
                  <span>Rentang Waktu</span>
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-slate-600">
                    <input type="checkbox" checked={semuaWaktu} onChange={(e) => setSemuaWaktu(e.target.checked)} data-testid="analisis-semua-waktu" /> Semua waktu
                  </span>
                </label>
                <div className={semuaWaktu ? 'pointer-events-none opacity-50' : ''}>
                  <PeriodePicker draft={f} setPatch={(p) => onApply({ ...f, ...p })} years={years} />
                </div>
                <p className="mt-1 text-[10px] leading-snug text-slate-500">Data bencana di luar tahun berjalan diambil dari API EOC sesuai rentang. Tim/EMT hanya bisa difilter per tahun pembentukan.</p>
              </div>

              {/* 3. Multi-Select Provinsi */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="font-bold text-slate-700">
                    Provinsi ({selectedProvinces.length > 0 ? selectedProvinces.length : 'Semua'})
                  </label>
                  <div className="flex gap-1">
                    {selectedProvinces.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setSelectedProvinces([])}
                        className="text-[10px] font-bold text-primary hover:underline"
                      >
                        Batal
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSelectedProvinces(allProvinces.map((p: any) => p.code))}
                        className="text-[10px] font-bold text-primary hover:underline"
                      >
                        Pilih Semua
                      </button>
                    )}
                  </div>
                </div>
                <div className="relative mb-1.5">
                  <input
                    type="text"
                    value={provSearch}
                    onChange={(e) => setProvSearch(e.target.value)}
                    placeholder="Saring nama provinsi..."
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-800 focus:border-primary focus:bg-white focus:outline-none"
                  />
                </div>
                <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/50 p-2">
                  {visibleProvinceOptions.map((prov: any) => {
                    const isChecked = selectedProvinces.includes(prov.code)
                    return (
                      <label
                        key={prov.code}
                        className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[11px] text-slate-700 hover:bg-white"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setSelectedProvinces(selectedProvinces.filter((c) => c !== prov.code))
                            } else {
                              setSelectedProvinces([...selectedProvinces, prov.code])
                            }
                          }}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-primary focus:ring-primary"
                        />
                        <span className="truncate">{prov.nama}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* 4. Multi-Select Jenis Bencana (jika tab kejadian/jenis) */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="font-bold text-slate-700">
                    Jenis Kejadian ({selectedDisasters.length > 0 ? selectedDisasters.length : 'Semua'})
                  </label>
                  <div className="flex gap-1">
                    {selectedDisasters.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setSelectedDisasters([])}
                        className="text-[10px] font-bold text-primary hover:underline"
                      >
                        Batal
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSelectedDisasters(disasterOptions)}
                        className="text-[10px] font-bold text-primary hover:underline"
                      >
                        Pilih Semua
                      </button>
                    )}
                  </div>
                </div>
                <div className="max-h-36 space-y-1 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/50 p-2">
                  {disasterOptions.map((jenis: string) => {
                    const isChecked = selectedDisasters.includes(jenis)
                    return (
                      <label
                        key={jenis}
                        className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[11px] text-slate-700 hover:bg-white"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setSelectedDisasters(selectedDisasters.filter((j) => j !== jenis))
                            } else {
                              setSelectedDisasters([...selectedDisasters, jenis])
                            }
                          }}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-primary focus:ring-primary"
                        />
                        <span className="truncate">{jenis}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* 5. Kriteria Spesifik / Dampak */}
              <div>
                <label className="mb-1.5 block font-bold text-slate-700">Kriteria Khusus</label>
                <div className="space-y-1.5">
                  <label className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-700">
                    <input
                      type="checkbox"
                      checked={filterAdaKorban}
                      onChange={(e) => setFilterAdaKorban(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    <span>Ada Korban Jiwa (MD &gt; 0)</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-700">
                    <input
                      type="checkbox"
                      checked={filterAdaPengungsi}
                      onChange={(e) => setFilterAdaPengungsi(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    <span>Ada Pengungsi</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-700">
                    <input
                      type="checkbox"
                      checked={filterAdaAmbulansRusak}
                      onChange={(e) => setFilterAdaAmbulansRusak(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    <span>Ada Ambulans Rusak / Perlu Perbaikan</span>
                  </label>
                </div>
              </div>

              {/* Action: Clear all */}
              <button
                type="button"
                onClick={handleResetFilters}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 text-center text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50"
              >
                Atur Ulang Semua Filter
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT MATRIX MAIN AREA (Width ~ 8-9 cols) */}
        <div className="space-y-4 lg:col-span-8 xl:col-span-9">
          {/* TAB SELECTOR (Matching unduh-laporan navigation) */}
          <div className="skdr-card overflow-hidden p-2 print:hidden">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {([
                { id: 'tck', label: 'Tenaga Cadangan', Icon: Users },
                { id: 'panggilan', label: 'Panggilan 119', Icon: PhoneCall },
                { id: 'bencana', label: 'Kejadian Bencana', Icon: Grid3x3 },
                ...(raw?.asistensi?.wilayah?.length ? [{ id: 'asistensi', label: 'Asistensi Risiko', Icon: ShieldAlert }] : []),
              ] as { id: GenericTab; label: string; Icon: any }[]).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  data-testid={`tab-${id}`}
                  onClick={() => {
                    setActiveTab(id)
                    setCurrentPage(1)
                    setPageSize(9999)
                    setSortField('')
                  }}
                  className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                    activeTab === id ? 'bg-primary text-white shadow-xs' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                  <span className={`rounded-full px-1.5 py-0.2 text-[10px] ${activeTab === id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    {activeTab === id ? filteredGeneric.length : genericCounts[id]}
                  </span>
                </button>
              ))}
              <span className="mx-0.5 hidden h-6 w-px bg-slate-200 sm:block" aria-hidden />
              <button
                type="button"
                onClick={() => {
                  setActiveTab('ambulans')
                  setCurrentPage(1)
                  setSortField('')
                }}
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                  activeTab === 'ambulans'
                    ? 'bg-primary text-white shadow-xs'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Ambulance className="h-4 w-4" />
                <span>Ambulans & PSC</span>
                <span className={`rounded-full px-1.5 py-0.2 text-[10px] ${activeTab === 'ambulans' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {filteredAmbulans.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('kejadian')
                  setCurrentPage(1)
                  setSortField('')
                }}
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                  activeTab === 'kejadian'
                    ? 'bg-primary text-white shadow-xs'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <AlertTriangle className="h-4 w-4" />
                <span>Daftar Laporan Kejadian</span>
                <span className={`rounded-full px-1.5 py-0.2 text-[10px] ${activeTab === 'kejadian' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {filteredKejadian.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('jenis')
                  setCurrentPage(1)
                  setSortField('')
                }}
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                  activeTab === 'jenis'
                    ? 'bg-primary text-white shadow-xs'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <HeartPulse className="h-4 w-4" />
                <span>Rekap Jenis Kejadian</span>
                <span className={`rounded-full px-1.5 py-0.2 text-[10px] ${activeTab === 'jenis' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {filteredJenis.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('kesenjangan')
                  setCurrentPage(1)
                  setSortField('')
                }}
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                  activeTab === 'kesenjangan'
                    ? 'bg-primary text-white shadow-xs'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <ShieldAlert className="h-4 w-4" />
                <span>Kesenjangan Wilayah</span>
                <span className={`rounded-full px-1.5 py-0.2 text-[10px] ${activeTab === 'kesenjangan' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {filteredKesenjangan.length}
                </span>
              </button>
            </div>
          </div>

          {/* TABLE CONTAINER CARD */}
          <div className="skdr-card overflow-hidden p-0 shadow-sm">
            {/* Header Toolbar */}
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
              <div>
                <h2 className="text-base font-black text-slate-900">
                  {genericDef?.title}
                  {activeTab === 'ambulans' && 'Matriks Data Armada Ambulans & PSC 119 per Provinsi'}
                  {activeTab === 'kejadian' && 'Matriks Laporan Kejadian Krisis & Bencana'}
                  {activeTab === 'jenis' && 'Matriks Rekapitulasi Kejadian Berdasarkan Jenis Bencana'}
                  {activeTab === 'kesenjangan' && 'Matriks Indeks Kesenjangan Respons & Beban Wilayah'}
                </h2>
                {genericDef ? <p className="mt-0.5 max-w-3xl text-xs text-slate-600">{genericDef.desc}</p> : null}
                <p className="mt-0.5 text-xs text-slate-500">
                  Menampilkan {paginatedRows.length} dari total {totalRows} data yang terfilter
                  {genericDef ? ' · klik judul kolom untuk mengurutkan, klik baris untuk rincian' : ''}
                </p>
                {activeTab === 'asistensi' ? (
                  <div className="mt-2 inline-flex rounded-xl bg-slate-100 p-0.5 text-[11px] font-bold">
                    {([['provinsi', 'Provinsi'], ['kabkota', 'Kabupaten/Kota']] as const).map(([k, l]) => (
                      <button key={k} type="button" onClick={() => { setAsisView(k); setSortField(''); setCurrentPage(1) }}
                        className={`rounded-lg px-2.5 py-1 transition ${asisView === k ? 'bg-white text-primary shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}>{l}</button>
                    ))}
                  </div>
                ) : null}
                {activeTab === 'tck' ? (
                  <div className="mt-2 inline-flex rounded-xl bg-slate-100 p-0.5 text-[11px] font-bold" data-testid="tck-view">
                    {([
                      ['komposisi', 'Komposisi per Provinsi'],
                      ...((raw?.tck?.provinsi || []).some((p: any) => p.profesi) ? [['profesi', 'Provinsi × Profesi']] : []),
                      ...((raw?.tck?.provinsi || []).some((p: any) => p.tim != null) ? [['tim-emt', 'Tim & EMT']] : []),
                      ...((raw?.tck?.provinsi || []).some((p: any) => p.kab) ? [['kabkota', 'Kabupaten/Kota']] : []),
                    ] as [TckView, string][]).map(([k, l]) => (
                      <button key={k} type="button" onClick={() => { setTckView(k); setSortField(''); setCurrentPage(1) }}
                        className={`rounded-lg px-2.5 py-1 transition ${tckView === k ? 'bg-white text-primary shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}>{l}</button>
                    ))}
                  </div>
                ) : null}
                {activeTab === 'panggilan' ? (
                  <div className="mt-2 inline-flex rounded-xl bg-slate-100 p-0.5 text-[11px] font-bold" data-testid="panggilan-view">
                    {([
                      ['ncc', 'Harian 119 Nasional'],
                      ...(raw?.psc?.panggilan_sampel ? [['psc-harian', 'PSC 119 Harian']] : []),
                      ['psc', 'PSC 119 per Provinsi'],
                      ...(raw?.psc?.panggilan_sampel ? [['psc-jenis', 'Provinsi × Jenis Layanan']] : []),
                      ['kategori', 'Kategori Panggilan'],
                    ] as [typeof panggilanView, string][]).map(([k, l]) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => {
                          setPanggilanView(k)
                          setSortField('')
                          setCurrentPage(1)
                        }}
                        className={`rounded-lg px-2.5 py-1 transition ${panggilanView === k ? 'bg-white text-primary shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Actions & Export toolbar */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Search in table */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={tableSearch}
                    onChange={(e) => {
                      setTableSearch(e.target.value)
                      setCurrentPage(1)
                    }}
                    placeholder="Saring tabel..."
                    className="w-36 rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-primary focus:bg-white focus:outline-none sm:w-44"
                  />
                  {tableSearch && (
                    <button
                      type="button"
                      onClick={() => setTableSearch('')}
                      className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Page Size dropdown */}
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs focus:border-primary focus:outline-none"
                >
                  <option value={10}>10 Baris</option>
                  <option value={25}>25 Baris</option>
                  <option value={50}>50 Baris</option>
                  <option value={9999}>Semua Baris</option>
                </select>

                {/* Unduh Excel / CSV */}
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-600 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 shadow-xs transition hover:bg-emerald-100"
                  title="Unduh format spreadsheet CSV"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Unduh CSV</span>
                </button>

                {/* Cetak / PDF */}
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50"
                  title="Cetak atau simpan ke PDF"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Cetak</span>
                </button>
              </div>
            </div>

            {/* TABEL DATA MATRIKS */}
            <div className={genericDef ? 'max-h-[70vh] overflow-auto' : 'overflow-x-auto'}>
              {genericDef && (
                <MatriksHeatTable
                  def={genericDef}
                  rows={paginatedRows as any[]}
                  allRows={sortedDataset as any[]}
                  sortField={sortField}
                  sortOrder={sortOrder}
                  onSort={handleSort}
                  onRowClick={handleOpenPreview}
                  startNo={pageSize >= 9999 ? 1 : (currentPage - 1) * pageSize + 1}
                />
              )}
              {activeTab === 'ambulans' && (
                <table className="w-full text-left text-xs" data-testid="matriks-ambulans-table">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    <tr>
                      <th className="px-3.5 py-2.5 text-center">#</th>
                      <th
                        className="cursor-pointer px-3.5 py-2.5 hover:text-primary"
                        onClick={() => handleSort('nama')}
                      >
                        <div className="flex items-center gap-1">
                          <span>Provinsi</span>
                          <ArrowUpDown className="h-3 w-3 text-slate-400" />
                        </div>
                      </th>
                      <th
                        className="cursor-pointer px-3.5 py-2.5 text-right hover:text-primary"
                        onClick={() => handleSort('ambulans')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Total Unit</span>
                          <ArrowUpDown className="h-3 w-3 text-slate-400" />
                        </div>
                      </th>
                      <th className="px-3 py-2.5 text-right">Kondisi Baik</th>
                      <th className="px-3 py-2.5 text-right">Rusak Ringan</th>
                      <th className="px-3 py-2.5 text-right">Rusak Berat</th>
                      <th className="px-3 py-2.5 text-right">GPS</th>
                      <th className="px-3 py-2.5 text-right">PSC Aktif</th>
                      <th className="px-3 py-2.5 text-right">RS Jejaring</th>
                      <th className="px-3.5 py-2.5 text-center">Kesiapan</th>
                      <th className="px-3.5 py-2.5 text-center print:hidden">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedRows.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-12 text-center text-slate-500">
                          Tidak ada data armada ambulans yang cocok dengan kriteria filter.
                        </td>
                      </tr>
                    ) : (
                      paginatedRows.map((r: any) => (
                        <tr key={r.id} className="transition hover:bg-slate-50/80">
                          <td className="px-3.5 py-2 text-center font-bold text-slate-400">{r.no}</td>
                          <td className="px-3.5 py-2 font-bold text-slate-900">
                            <div>{r.nama}</div>
                            <span className="text-[10px] text-slate-400">Kode: {r.code}</span>
                          </td>
                          <td className="px-3.5 py-2 text-right font-black tabular-nums text-slate-900">
                            {nf(r.ambulans)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700">
                              {nf(r.ambulansBaik)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            <span
                              className={`rounded-md px-2 py-0.5 font-bold ${
                                r.ambulansRusakRingan > 0
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'text-slate-400'
                              }`}
                            >
                              {nf(r.ambulansRusakRingan)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            <span
                              className={`rounded-md px-2 py-0.5 font-bold ${
                                r.ambulansRusakBerat > 0 ? 'bg-red-50 text-red-700' : 'text-slate-400'
                              }`}
                            >
                              {nf(r.ambulansRusakBerat)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold text-blue-700">
                            {nf(r.ambulansGps)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-700">
                            {r.pscAktif} / {r.pscTotal}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-700">
                            {nf(r.rsJejaring)}
                          </td>
                          <td className="px-3.5 py-2 text-center">
                            <span
                              className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${r.statusTone}`}
                            >
                              {r.status} ({pf(r.persenBaik)})
                            </span>
                          </td>
                          <td className="px-3.5 py-2 text-center print:hidden">
                            <button
                              type="button"
                              onClick={() => handleOpenPreview(r)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-2xs hover:border-primary hover:text-primary"
                            >
                              <Eye className="h-3 w-3" />
                              <span>Pratinjau</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {activeTab === 'kejadian' && (
                <table className="w-full text-left text-xs" data-testid="matriks-kejadian-table">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    <tr>
                      <th className="px-3.5 py-2.5 text-center">#</th>
                      <th
                        className="cursor-pointer px-3.5 py-2.5 hover:text-primary"
                        onClick={() => handleSort('tanggal')}
                      >
                        <div className="flex items-center gap-1">
                          <span>Tanggal</span>
                          <ArrowUpDown className="h-3 w-3 text-slate-400" />
                        </div>
                      </th>
                      <th
                        className="cursor-pointer px-3.5 py-2.5 hover:text-primary"
                        onClick={() => handleSort('jenis')}
                      >
                        <div className="flex items-center gap-1">
                          <span>Jenis Kejadian</span>
                          <ArrowUpDown className="h-3 w-3 text-slate-400" />
                        </div>
                      </th>
                      <th
                        className="cursor-pointer px-3.5 py-2.5 hover:text-primary"
                        onClick={() => handleSort('provinsi')}
                      >
                        <div className="flex items-center gap-1">
                          <span>Wilayah</span>
                          <ArrowUpDown className="h-3 w-3 text-slate-400" />
                        </div>
                      </th>
                      <th
                        className="cursor-pointer px-3 py-2.5 text-right hover:text-primary"
                        onClick={() => handleSort('meninggal')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>MD</span>
                          <ArrowUpDown className="h-3 w-3 text-slate-400" />
                        </div>
                      </th>
                      <th className="px-3 py-2.5 text-right">Luka</th>
                      <th
                        className="cursor-pointer px-3 py-2.5 text-right hover:text-primary"
                        onClick={() => handleSort('pengungsi')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Pengungsi</span>
                          <ArrowUpDown className="h-3 w-3 text-slate-400" />
                        </div>
                      </th>
                      <th className="px-3 py-2.5 text-right">Terdampak</th>
                      <th className="px-3.5 py-2.5 text-center">Status</th>
                      <th className="px-3.5 py-2.5 text-center print:hidden">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedRows.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-12 text-center text-slate-500">
                          Tidak ada laporan kejadian yang cocok dengan kriteria filter.
                        </td>
                      </tr>
                    ) : (
                      paginatedRows.map((r: any) => (
                        <tr key={r.id} className="transition hover:bg-slate-50/80">
                          <td className="px-3.5 py-2 text-center font-bold text-slate-400">{r.no}</td>
                          <td className="px-3.5 py-2 font-mono text-[11px] font-semibold text-slate-700">
                            {r.tanggal}
                          </td>
                          <td className="px-3.5 py-2 font-bold text-slate-900">
                            <span className="inline-block rounded-md bg-teal-50 px-2 py-0.5 text-teal-800">
                              {r.jenis}
                            </span>
                          </td>
                          <td className="px-3.5 py-2">
                            <div className="font-bold text-slate-800">{r.kabupaten}</div>
                            <div className="text-[10px] text-slate-500">{r.provinsi}</div>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            <span
                              className={`rounded-md px-2 py-0.5 font-bold ${
                                r.meninggal > 0 ? 'bg-red-50 text-red-700' : 'text-slate-400'
                              }`}
                            >
                              {nf(r.meninggal)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-700">
                            {nf(r.totalLuka)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-700">
                            {nf(r.pengungsi)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-700">
                            {nf(r.terdampak)}
                          </td>
                          <td className="px-3.5 py-2 text-center">
                            <span
                              className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${r.statusTone}`}
                            >
                              {r.statusText}
                            </span>
                          </td>
                          <td className="px-3.5 py-2 text-center print:hidden">
                            <button
                              type="button"
                              onClick={() => handleOpenPreview(r)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-2xs hover:border-primary hover:text-primary"
                            >
                              <Eye className="h-3 w-3" />
                              <span>Pratinjau</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {activeTab === 'jenis' && (
                <table className="w-full text-left text-xs" data-testid="matriks-jenis-table">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    <tr>
                      <th className="px-3.5 py-2.5 text-center">#</th>
                      <th
                        className="cursor-pointer px-3.5 py-2.5 hover:text-primary"
                        onClick={() => handleSort('nama')}
                      >
                        <div className="flex items-center gap-1">
                          <span>Jenis Kejadian / Bencana</span>
                          <ArrowUpDown className="h-3 w-3 text-slate-400" />
                        </div>
                      </th>
                      <th
                        className="cursor-pointer px-3.5 py-2.5 text-right hover:text-primary"
                        onClick={() => handleSort('frekuensi')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Frekuensi</span>
                          <ArrowUpDown className="h-3 w-3 text-slate-400" />
                        </div>
                      </th>
                      <th className="px-3 py-2.5 text-right">Korban MD</th>
                      <th className="px-3 py-2.5 text-right">Luka-Luka</th>
                      <th className="px-3 py-2.5 text-right">Pengungsi</th>
                      <th className="px-3 py-2.5 text-right">Terdampak</th>
                      <th className="px-3.5 py-2.5 text-right">Porsi Nasional</th>
                      <th className="px-3.5 py-2.5 text-center">Tingkat Bahaya</th>
                      <th className="px-3.5 py-2.5 text-center print:hidden">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedRows.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-12 text-center text-slate-500">
                          Tidak ada kategori jenis kejadian yang cocok dengan filter.
                        </td>
                      </tr>
                    ) : (
                      paginatedRows.map((r: any) => (
                        <tr key={r.id} className="transition hover:bg-slate-50/80">
                          <td className="px-3.5 py-2 text-center font-bold text-slate-400">{r.no}</td>
                          <td className="px-3.5 py-2 font-bold text-slate-900">{r.nama}</td>
                          <td className="px-3.5 py-2 text-right font-black tabular-nums text-slate-900">
                            {nf(r.frekuensi)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            <span
                              className={`rounded-md px-2 py-0.5 font-bold ${
                                r.meninggal > 0 ? 'bg-red-50 text-red-700' : 'text-slate-400'
                              }`}
                            >
                              {nf(r.meninggal)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-700">
                            {nf(r.luka)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-700">
                            {nf(r.pengungsi)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-700">
                            {nf(r.terdampak)}
                          </td>
                          <td className="px-3.5 py-2 text-right tabular-nums font-bold text-teal-800">
                            {r.proporsi.toFixed(1)}%
                          </td>
                          <td className="px-3.5 py-2 text-center">
                            <span
                              className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${r.bahayaTone}`}
                            >
                              {r.tingkatBahaya}
                            </span>
                          </td>
                          <td className="px-3.5 py-2 text-center print:hidden">
                            <button
                              type="button"
                              onClick={() => handleOpenPreview(r)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-2xs hover:border-primary hover:text-primary"
                            >
                              <Eye className="h-3 w-3" />
                              <span>Pratinjau</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {activeTab === 'kesenjangan' && (
                <table className="w-full text-left text-xs" data-testid="matriks-kesenjangan-table">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    <tr>
                      <th className="px-3.5 py-2.5 text-center">Rank</th>
                      <th
                        className="cursor-pointer px-3.5 py-2.5 hover:text-primary"
                        onClick={() => handleSort('nama')}
                      >
                        <div className="flex items-center gap-1">
                          <span>Provinsi</span>
                          <ArrowUpDown className="h-3 w-3 text-slate-400" />
                        </div>
                      </th>
                      <th
                        className="cursor-pointer px-3.5 py-2.5 text-right hover:text-primary"
                        onClick={() => handleSort('indeksRespons')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Indeks Respons</span>
                          <ArrowUpDown className="h-3 w-3 text-slate-400" />
                        </div>
                      </th>
                      <th className="px-3 py-2.5 text-right">Beban</th>
                      <th className="px-3 py-2.5 text-right">Kapasitas</th>
                      <th className="px-3 py-2.5 text-right">Ambulans Baik</th>
                      <th className="px-3 py-2.5 text-right">PSC Aktif</th>
                      <th className="px-3 py-2.5 text-right">TCK</th>
                      <th className="px-3.5 py-2.5 text-center">Prioritas</th>
                      <th className="px-3.5 py-2.5 text-center print:hidden">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedRows.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-12 text-center text-slate-500">
                          Tidak ada data kesenjangan yang cocok dengan filter.
                        </td>
                      </tr>
                    ) : (
                      paginatedRows.map((r: any) => (
                        <tr key={r.id} className="transition hover:bg-slate-50/80">
                          <td className="px-3.5 py-2 text-center font-bold text-slate-400">#{r.rank}</td>
                          <td className="px-3.5 py-2 font-bold text-slate-900">
                            <div>{r.nama}</div>
                            <span className="text-[10px] text-slate-400">Kode: {r.code}</span>
                          </td>
                          <td className="px-3.5 py-2 text-right">
                            <span
                              className={`inline-block min-w-[3.2rem] rounded-full px-2 py-0.5 text-center font-black tabular-nums ${
                                r.indeksRespons >= 70
                                  ? 'bg-red-100 text-red-800'
                                  : r.indeksRespons >= 55
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-50 text-emerald-800'
                              }`}
                            >
                              {r.indeksRespons.toFixed(1)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                            {r.beban.toFixed(1)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                            {r.kapasitas.toFixed(1)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold text-emerald-700">
                            {nf(r.ambulansBaik)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-700">
                            {r.pscAktif}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-700">
                            {nf(r.tck)}
                          </td>
                          <td className="px-3.5 py-2 text-center">
                            <span
                              className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${r.prioritasTone}`}
                            >
                              {r.levelPrioritas}
                            </span>
                          </td>
                          <td className="px-3.5 py-2 text-center print:hidden">
                            <button
                              type="button"
                              onClick={() => handleOpenPreview(r)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-2xs hover:border-primary hover:text-primary"
                            >
                              <Eye className="h-3 w-3" />
                              <span>Pratinjau</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {genericDef?.notes.length ? (
              <ul className="space-y-0.5 border-t border-slate-100 bg-amber-50/40 px-4 py-2 text-[11px] text-slate-600" data-testid="matriks-catatan">
                {genericDef.notes.map((n, i) => (
                  <li key={i} className="flex gap-1.5">
                    <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {/* PAGINATION FOOTER */}
            <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-4 py-3 sm:flex-row print:hidden">
              <div className="text-xs text-slate-500">
                Menampilkan{' '}
                <span className="font-bold text-slate-800">
                  {totalRows === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                </span>{' '}
                sampai{' '}
                <span className="font-bold text-slate-800">
                  {Math.min(currentPage * pageSize, totalRows)}
                </span>{' '}
                dari <span className="font-bold text-slate-800">{totalRows}</span> baris
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(1)}
                  className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 shadow-2xs hover:bg-slate-50 disabled:opacity-40"
                  title="Halaman Pertama"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 shadow-2xs hover:bg-slate-50 disabled:opacity-40"
                  title="Halaman Sebelumnya"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <div className="px-3 text-xs font-semibold text-slate-700">
                  Halaman <span className="font-bold">{currentPage}</span> dari{' '}
                  <span className="font-bold">{totalPages}</span>
                </div>

                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 shadow-2xs hover:bg-slate-50 disabled:opacity-40"
                  title="Halaman Berikutnya"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 shadow-2xs hover:bg-slate-50 disabled:opacity-40"
                  title="Halaman Terakhir"
                >
                  <ChevronsRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* DETAIL MODAL PREVIEW (Dokumen Ringkas Resmi) */}
      {previewData && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
        >
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            {/* Kop Resmi Dokumen */}
            <div className="border-b border-slate-200 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-primary">
                    Kementerian Kesehatan RI · Pusat Krisis Kesehatan
                  </div>
                  <h3 className="mt-1 text-lg font-black text-slate-900">{previewData.title}</h3>
                  <p className="text-xs font-semibold text-slate-600">{previewData.subtitle}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewData(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                <span className="font-mono font-bold text-slate-700">{previewData.docId}</span>
                <span>•</span>
                <span>Dicetak: {previewData.timestamp}</span>
                <span>•</span>
                <span className={`rounded-full border px-2 py-0.5 font-bold ${previewData.badgeColor}`}>
                  {previewData.badgeText}
                </span>
              </div>
            </div>

            {/* Quick KPI Strip */}
            <div className="my-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {previewData.kpis.map((kpi, idx) => (
                <div key={idx} className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {kpi.label}
                  </div>
                  <div className="mt-0.5 text-sm font-black text-slate-900">{kpi.value}</div>
                  {kpi.hint && <div className="text-[9px] text-slate-400">{kpi.hint}</div>}
                </div>
              ))}
            </div>

            {/* Detailed Table */}
            <div className="mt-4 rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="px-4 py-2">Parameter / Indikator</th>
                    <th className="px-4 py-2 text-right">Rincian Nilai</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewData.details.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2 font-medium text-slate-700">{row.label}</td>
                      <td className={`px-4 py-2 text-right tabular-nums ${row.tone || 'text-slate-900 font-semibold'}`}>
                        {row.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer Actions */}
            <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50"
              >
                <Printer className="h-4 w-4" />
                <span>Cetak Lembar Laporan</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewData(null)}
                className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-primary/90"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
