'use client'

// Peta spasial terpadu Pusat Krisis Kesehatan: dipakai di Ringkasan (variant "card") dan Spatial Mode (variant "fullscreen").
// Seluruh state lapisan, dok kiri (Analisa / Kejadian Terbaru / Terpadu) dan pengaturan lapisan ada di sini supaya tidak terduplikasi.
import { logistikPerProvinsi } from '@/lib/puskris/derive'
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
import type { PuskrisUiFilter } from '@/lib/puskris/ui-filter'
import KejadianTerpaduCard from '@/components/puskris/KejadianTerpaduCard'
import KejadianTerbaruList from '@/components/puskris/KejadianTerbaruList'
import InfoHint from '@/components/puskris/InfoHint'
import { BNPB_LAYERS, INTEL_LAYER_APIS, type BnpbLayerId, type BnpbStatus, type IntelLayerId } from '@/lib/puskris/open-data'
import { KORBAN_LABEL } from '@/lib/puskris/labels'
import { buildInternalLayers, DEFAULT_INTERNAL, type InternalLayerToggles } from '@/lib/puskris/internal-layers'
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
  if (f.periode === 'bulan') return 'Oktober 2026'
  if (f.periode === '7hari') return '7 hari terakhir'
  if (f.periode === '30hari') return '30 hari terakhir'
  return 'Tahun 2026'
}

export default function PuskrisPetaTerpadu({
  raw, f, onApply, derived, kejadian, selectedEvent, setSelectedEvent, variant = 'card', hudExtra, hudTitle,
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
  const [leftDockOpen, setLeftDockOpen] = useState(true)
  const [rightDockOpen, setRightDockOpen] = useState(true)
  const [sel, setSel] = useState<SpasialArea | null>(null)
  const [focus, setFocus] = useState<Focus | null>(null)
  const [pointOpacity, setPointOpacity] = useState(1)
  const [adminBoundaries, setAdminBoundaries] = useState(true)
  const [windFlow, setWindFlow] = useState(false)
  const [intelLayers, setIntelLayers] = useState({ flights: false, fires: false, hazards: false, wildlife: false, vectors: false })
  const [intelStatus, setIntelStatus] = useState<Partial<Record<IntelLayerId, IntelLayerStatus>>>({})
  const onIntelStatus = useCallback((id: IntelLayerId, st: IntelLayerStatus) => setIntelStatus((prev) => ({ ...prev, [id]: st })), [])
  const [bnpbLayers, setBnpbLayers] = useState<Partial<Record<BnpbLayerId, boolean>>>({})
  const [bnpbStatus, setBnpbStatus] = useState<Partial<Record<BnpbLayerId, BnpbStatus>>>({})
  const onBnpbStatus = useCallback((id: BnpbLayerId, st: BnpbStatus) => setBnpbStatus((prev) => (prev[id]?.state === st.state && prev[id]?.message === st.message ? prev : { ...prev, [id]: st })), [])
  const [dockTab, setDockTab] = useState<'analisa' | 'terbaru' | 'terpadu'>('analisa')
  const [terbaruCount, setTerbaruCount] = useState<number | null>(null)
  const [radiusOn, setRadiusOn] = useState(true)
  const [internal, setInternal] = useState<InternalLayerToggles>(DEFAULT_INTERNAL)
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

  const mapPack = useMemo(() => toSpasial({
    rows: derived.rows,
    kejadian,
    choro,
    centroids,
    filter: f,
    logistikByCode,
    asistensiByCode,
    ringkasanLabel: f.jenis ? `Jenis: ${f.jenis}` : 'Semua jenis kejadian',
    periodeLabel: periodeLabel(f),
    interpretasi: derived.narrative || [],
    raw,
  }), [derived.rows, derived.narrative, kejadian, choro, centroids, f, logistikByCode, asistensiByCode, raw])

  const choroLabel = CHORO_OPTIONS.find((o) => o.id === choro)?.label || 'Kejadian terpantau'
  const data = mapPack.data
  const titik = mapPack.titik
  const activeMetric = mapPack.metric as Metric

  const aFilter = useMemo<AFilter>(() => ({ ...defaultFilter(), sumber: 'ebs' }), [])
  const totalTitik = titik.length

  const selectedRow = sel ? derived.rows.find((r) => r.code === sel.code) || null : (f.provinsi ? derived.selected : null)
  const terpadu = useMemo(() => buildTerpadu({
    row: selectedRow || null,
    kejadian,
    raw,
    layananNasional: derived.layanan,
    sdmNasional: derived.sdm,
    selectedEvent,
  }), [selectedRow, kejadian, raw, derived.layanan, derived.sdm, selectedEvent])
  const radiusCenter = selectedRow && centroids[selectedRow.code] ? centroids[selectedRow.code] : (mapPack.titik[0] ? { lat: mapPack.titik[0].lat, lon: mapPack.titik[0].lon } : null)
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
                {([['analisa', 'Analisa'], ['terbaru', `Kejadian Terbaru${terbaruCount ? ` (${terbaruCount})` : ''}`], ['terpadu', 'Terpadu']] as const).map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setDockTab(k)}
                    className={`flex-1 rounded-lg px-1.5 py-1 text-[10px] font-bold ${dockTab === k ? 'bg-teal-50 text-teal-800' : 'text-slate-500 hover:bg-slate-100'}`}>
                    {l}
                  </button>
                ))}
              </div>
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
                            <span className="flex items-center gap-1">
                              <span className="h-2 w-2 rounded-full bg-blue-600" title="Titik kejadian" />
                              <span className="h-2 w-2 rounded-full bg-orange-500" title="Titik krisis" />
                            </span>
                            <span className="text-xs font-bold text-slate-800">Titik kejadian krisis</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black tabular-nums text-slate-800">{totalTitik.toLocaleString('id-ID')}</span>
                            <input
                              type="checkbox"
                              checked={layers.points !== 'off'}
                              onChange={(e) => setLayers({ ...layers, points: e.target.checked ? 'kluster' : 'off' })}
                              className="h-4 w-4 cursor-pointer rounded border-slate-300 text-teal-700 focus:ring-teal-500"
                              aria-label="Titik kejadian krisis"
                            />
                          </div>
                        </div>
                        <p className="ml-5 mt-0.5 text-[10px] text-slate-500">Klaster di pusat provinsi · {totalTitik.toLocaleString('id-ID')} kejadian terbaru</p>
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
                      <span className="normal-case tracking-normal text-slate-400">{RISIKO_LAYERS.filter((r) => r.status === 'siap').length} tersedia</span>
                    </div>
                    <div className="space-y-1.5">
                      {RISIKO_LAYERS.map((r) => (
                        <label key={r.id} data-testid={`risiko-${r.id}`} className="block cursor-not-allowed rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-2.5 select-none" title="Data segera tersedia">
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-slate-500"><span className="h-2.5 w-2.5 rounded-full opacity-50" style={{ background: r.warna }} />{r.nama}</span>
                            <span className="flex items-center gap-2">
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-800">Data segera tersedia</span>
                              <input type="checkbox" disabled checked={false} readOnly className="h-4 w-4 shrink-0 cursor-not-allowed rounded border-slate-300 opacity-50" aria-label={r.nama} />
                            </span>
                          </div>
                          <p className="mt-0.5 text-[10px] leading-tight text-slate-400">{r.deskripsi}</p>
                        </label>
                      ))}
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
                <div className="shrink-0 border-t border-slate-100 bg-white p-3">
                  <button type="button"
                    onClick={() => {
                      setLayers({ ...DEFAULT_LAYERS, base: 'osm' })
                      setPointOpacity(1)
                      setAdminBoundaries(true)
                      setWindFlow(false)
                      setBnpbLayers({})
                      setBnpbStatus({})
                      setIntelLayers({ flights: false, fires: false, hazards: false, wildlife: false, vectors: false })
                      setIntelStatus({})
                      setRadiusOn(true)
                      setInternal(DEFAULT_INTERNAL)
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
              titik={layers.points === 'off' ? [] : titik}
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
              onSelectArea={(a) => (a ? pickArea(a, true) : setSel(null))}
              onDrill={onDrill}
              onUp={onUp}
              focus={focus}
              panelOpen={false}
              setPanelOpen={() => {}}
              height={640}
              fullHeight={true}
              rightPanel={null}
              intelLayers={intelLayers}
              extraLayers={internalPack.layers}
              onIntelStatus={onIntelStatus as any}
              pointOpacity={pointOpacity}
              showBoundaries={adminBoundaries}
              windFlow={windFlow}
              bnpbLayers={bnpbLayers}
              onBnpbStatus={onBnpbStatus}
              metricLabel={choroLabel}
              radiusSupport={{ enabled: radiusOn && Boolean(radiusCenter), center: radiusCenter, ringsKm: [50, 100, 200] }}
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
                <span className="px-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Analisa wilayah</span>
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
                    <MapPin className="h-3.5 w-3.5 text-primary" /> Analisa & Kejadian Terbaru <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
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
      <div className="skdr-card flex w-full flex-col p-4" data-testid="peta-skdr-terpadu">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
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

        <div className="relative mt-3 flex h-[500px] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          {leftDockOpen ? (
            <div className="z-20 flex h-full w-[340px] shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white transition-all duration-300" data-testid="peta-left-dock">
              {leftBody}
            </div>
          ) : (
            <aside className="z-20 flex h-full w-10 shrink-0 flex-col border-r border-slate-200 bg-white/95 backdrop-blur transition-all duration-300" data-testid="peta-left-dock-collapsed">
              <button type="button" onClick={() => setLeftDockOpen(true)}
                className="flex h-full w-full flex-col items-center justify-start gap-3 py-3 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                title="Buka Analisa & Detail Wilayah" aria-label="Buka Analisa & Detail Wilayah">
                <ChevronRight className="h-4 w-4 text-slate-400" />
                <MapPin className="h-4 w-4 text-primary" />
                <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-wider text-slate-600" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Analisa Wilayah</span>
              </button>
            </aside>
          )}

          <div className="relative h-full min-w-0 flex-1">
            {renderMap({})}
          </div>

          <aside className={`z-20 flex h-full shrink-0 flex-col border-l border-slate-200 bg-white/95 backdrop-blur transition-all duration-300 ${rightDockOpen ? 'w-[320px]' : 'w-10'}`} data-testid="peta-right-dock">
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
