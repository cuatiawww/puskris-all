'use client'
// PR 044: Spasial map (OpenLayers): choropleth provinsi / kab-kota (drill), titik unit pelapor (kluster / titik),
// heatmap kasus, popup indikator epidemiologi, legenda + ambang, putar ulang per minggu epid.
// Geometry: public/data GeoJSON (id_provinsi = master_locations.code, kode_kab = master_kabkota.code).
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import OlMap from 'ol/Map'
import View from 'ol/View'
import Overlay from 'ol/Overlay'
import { createPortal } from 'react-dom'
import TileLayer from 'ol/layer/Tile'
import ImageLayer from 'ol/layer/Image'
import VectorLayer from 'ol/layer/Vector'
import HeatmapLayer from 'ol/layer/Heatmap'
import VectorSource from 'ol/source/Vector'
import Cluster from 'ol/source/Cluster'
import XYZ from 'ol/source/XYZ'
import OSM from 'ol/source/OSM'
import TileArcGISRest from 'ol/source/TileArcGISRest'
import ImageArcGISRest from 'ol/source/ImageArcGISRest'
import { BNPB_LAYERS, type BnpbLayerId, type BnpbStatus } from '@/lib/puskris/open-data'
import GeoJSON from 'ol/format/GeoJSON'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import LineString from 'ol/geom/LineString'
import { Circle as CircleStyle, Fill, Stroke, Style, Text } from 'ol/style'
import { fromLonLat } from 'ol/proj'
import { circular } from 'ol/geom/Polygon'
import { boundingExtent, createEmpty, extend, isEmpty } from 'ol/extent'
import type { FeatureLike } from 'ol/Feature'
import 'ol/ol.css'
import { ArrowLeft, ChevronDown, ChevronUp, Crosshair, Layers, ListTree, Maximize2, Minimize2, Pause, PanelRight, Play, X } from 'lucide-react'
import { PUBLIC_BASE_PATH } from '@/lib/public-path'
import { nf } from '@/lib/analisa-api'
import { areaVal, classesFor, classOf, fmtPct, METRICS, STATUS, statusFor, titikVal, type Area, type MapClass, type Metric, type SpasialResp, type Titik } from '@/lib/spasial-api'
import type { ChoroConfig } from '@/lib/choropleth-classes'

export type BaseMap = 'light' | 'osm' | 'satellite' | 'terrain' | 'none'
export type PointMode = 'kluster' | 'titik' | 'off'
export interface Layers { base: BaseMap; choro: boolean; opChoro: number; points: PointMode; heat: boolean; status: string[]; kasusMin: number }
export const DEFAULT_LAYERS: Layers = { base: 'light', choro: true, opChoro: 0.78, points: 'kluster', heat: false, status: [], kasusMin: 0 }
export type Focus = { lat: number; lon: number; titik?: Titik | null; row?: any; area?: Area | null; zoom?: number; nonce: number }

const geoCache: Record<string, Promise<any>> = {}
const loadJson = (url: string) => (geoCache[url] ||= fetch(url).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json() }))
async function loadGeo(level: 'provinsi' | 'kabkota', provCode: string | null, provName: string | null) {
  if (level === 'provinsi') return (await loadJson(`${PUBLIC_BASE_PATH}/data/indonesia-38-provinces.geojson`)).features || []
  let fs: any[] = []
  try {
    const r = await loadJson(`${PUBLIC_BASE_PATH}/wilayah-data?level=kabupaten&province=${encodeURIComponent(provName || '')}`)
    fs = r?.geojson?.features || []
  } catch { fs = [] }
  if (!fs.some((f: any) => String(f.properties?.kode_prov) === String(provCode))) fs = (await loadJson(`${PUBLIC_BASE_PATH}/data/indonesia-kabupaten.geojson`)).features || []
  return fs.filter((f: any) => String(f.properties?.kode_prov) === String(provCode))
}

function baseSource(b: BaseMap) {
  if (b === 'satellite') return new XYZ({ url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', crossOrigin: 'anonymous', attributions: 'Esri' })
  if (b === 'terrain') return new XYZ({ url: 'https://{a-c}.tile.opentopomap.org/{z}/{x}/{y}.png', maxZoom: 17, attributions: '© OpenTopoMap (CC-BY-SA)' })
  if (b === 'osm') return new OSM({ url: `${PUBLIC_BASE_PATH}/osm-tiles/{z}/{x}/{y}.png`, crossOrigin: 'anonymous' })
  // 'light' = the app's own OSM tile proxy, desaturated via CSS (no third-party key needed)
  return new OSM({ url: `${PUBLIC_BASE_PATH}/osm-tiles/{z}/{x}/{y}.png`, crossOrigin: 'anonymous' })
}

export interface ExternalIntelLayers {
  flights?: boolean
  fires?: boolean
  hazards?: boolean
  wildlife?: boolean
  vectors?: boolean
}

export type IntelLayerStatus = { state: 'loading' | 'ok' | 'empty' | 'error'; count?: number; message?: string; at?: string }
type IntelKey = keyof ExternalIntelLayers

const KIND_LABEL: Record<string, string> = { earthquake: 'Gempa Bumi', flood: 'Banjir', volcano: 'Gunung Api', cyclone: 'Siklon Tropis', drought: 'Kekeringan', wildfire: 'Kebakaran Hutan', landslide: 'Tanah Longsor' }
const KIND_ICON: Record<string, string> = { earthquake: '〰', flood: '🌊', volcano: '🌋', cyclone: '🌀', drought: '☀', wildfire: '🔥', landslide: '⛰' }

export type RadiusSupport = {
  enabled: boolean
  center: { lat: number; lon: number } | null
  ringsKm?: number[]
}

type Popup =
  | { kind: 'area'; area: Area }
  | { kind: 'titik'; t: Titik }
  | { kind: 'row'; row: any }
  | { kind: 'cluster'; items: Titik[] }
  | {
      kind: 'intel'
      type: string
      badgeText: string
      badgeColor: string
      source: string
      title: string
      subtitle?: string
      details: Array<{ label: string; value: string }>
      link?: string
    }

export interface MapHudCtrl {
  fitAll: () => void
  toggleFs: () => void
  fs: boolean
  showLegend: boolean
  setShowLegend: (v: boolean) => void
  showLayers: boolean
  setShowLayers: (v: boolean) => void
}

export default function SpasialMap({ data, titik, metric, setMetric, layers, setLayers, choroCfg, sumber, selectedId, onSelectArea, onDrill, onUp, focus, rightPanel, panelOpen, setPanelOpen, height = 680, fullHeight = false, topHud, leftDock, topOffset, hideDefaultToolbar = false, intelLayers, radiusSupport, onIntelStatus, pointOpacity = 1, showBoundaries = true, windFlow = false, metricLabel, bnpbLayers, onBnpbStatus }: {
  data: SpasialResp | null; titik: Titik[]; metric: Metric; setMetric: (m: Metric) => void; layers: Layers; setLayers: (l: Layers) => void
  choroCfg: ChoroConfig | null; sumber: string; selectedId: number | null; onSelectArea: (a: Area | null) => void; onDrill: (a: Area) => void; onUp: (() => void) | null
  focus: Focus | null; rightPanel: ReactNode; panelOpen: boolean; setPanelOpen: (v: boolean) => void; height?: number
  fullHeight?: boolean; topHud?: ReactNode | ((ctrl: MapHudCtrl) => ReactNode); leftDock?: ReactNode; topOffset?: number; hideDefaultToolbar?: boolean
  intelLayers?: ExternalIntelLayers
  radiusSupport?: RadiusSupport
  /** Status muat tiap lapisan API intelijen (untuk ditampilkan di panel pengaturan). */
  onIntelStatus?: (id: IntelKey, st: IntelLayerStatus) => void
  pointOpacity?: number
  showBoundaries?: boolean
  windFlow?: boolean
  bnpbLayers?: Partial<Record<BnpbLayerId, boolean>>
  onBnpbStatus?: (id: BnpbLayerId, st: BnpbStatus) => void
  /** Label variabel arsiran (mengganti label metrik bawaan di legenda & tooltip). */
  metricLabel?: string
}) {
  const statusRef = useRef(onIntelStatus)
  statusRef.current = onIntelStatus
  const report = (id: IntelKey, st: IntelLayerStatus) => statusRef.current?.(id, st)
  const getJson = async (path: string) => {
    const r = await fetch(`${PUBLIC_BASE_PATH}${path}`)
    let j: any = null
    try { j = await r.json() } catch { j = null }
    if (!r.ok) {
      const up = (j?.upstream || []).filter((u: any) => !u.ok).map((u: any) => `${u.nama}: ${u.error || u.status}`).join('; ')
      throw new Error(up || `HTTP ${r.status}`)
    }
    return j
  }
  const fail = (id: IntelKey) => (e: any) => report(id, { state: 'error', message: `Sumber tidak dapat diakses (${String(e?.message || e).slice(0, 140)})` })
  const done = (id: IntelKey, n: number, j: any) => report(id, { state: n ? 'ok' : 'empty', count: n, at: j?.fetched_at, message: n ? undefined : 'Sumber aktif, tetapi tidak ada data saat ini' })
  const wrap = useRef<HTMLDivElement>(null)
  const el = useRef<HTMLDivElement>(null)
  // OL moves the overlay element into its own container, so it must not be a React-managed node (portal into a detached div)
  const [popNode] = useState<HTMLDivElement | null>(() => (typeof document !== 'undefined' ? document.createElement('div') : null))
  const map = useRef<OlMap | null>(null)
  const tile = useRef<TileLayer<any> | null>(null)
  const choroSrc = useRef(new VectorSource())
  const ptSrc = useRef(new VectorSource())
  const clusterSrc = useRef(new Cluster({ distance: 42, minDistance: 12, source: ptSrc.current }))
  const choroL = useRef<VectorLayer<any> | null>(null)
  const ptL = useRef<VectorLayer<any> | null>(null)
  const clL = useRef<VectorLayer<any> | null>(null)
  const heatL = useRef<HeatmapLayer | null>(null)
  const overlay = useRef<Overlay | null>(null)

  const flightsSrc = useRef(new VectorSource())
  const firesSrc = useRef(new VectorSource())
  const hazardsSrc = useRef(new VectorSource())
  const wildlifeSrc = useRef(new VectorSource())
  const vectorsSrc = useRef(new VectorSource())
  const radiusSrc = useRef(new VectorSource())
  const [windErr, setWindErr] = useState<string | null>(null)

  const flightsL = useRef<VectorLayer<any> | null>(null)
  const firesL = useRef<VectorLayer<any> | null>(null)
  const hazardsL = useRef<VectorLayer<any> | null>(null)
  const wildlifeL = useRef<VectorLayer<any> | null>(null)
  const vectorsL = useRef<VectorLayer<any> | null>(null)
  const radiusL = useRef<VectorLayer<any> | null>(null)
  const styleCtx = useRef<{ byCode: Record<string, Area>; cls: MapClass[]; wi: number; metric: Metric; sel: number | null; hover: string | null; op: number; maxK: number; bounds: boolean; label: string | null }>({ byCode: {}, cls: [], wi: -1, metric: 'kasus', sel: null, hover: null, op: 0.78, maxK: 1, bounds: true, label: null })
  const onSelectRef = useRef(onSelectArea)
  onSelectRef.current = onSelectArea
  const [geoErr, setGeoErr] = useState(false)
  const [geoReady, setGeoReady] = useState(0)
  const [wi, setWi] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const [popup, setPopup] = useState<Popup | null>(null)
  const [hover, setHover] = useState<{ x: number; y: number; text: string } | null>(null)
  const [showLayers, setShowLayers] = useState(false)
  const [showLegend, setShowLegend] = useState(true)
  const [fs, setFs] = useState(false)
  const weeks = data?.minggu || []
  const level = data?.level || 'provinsi'
  const areas = data?.wilayah || []

  // ── map init ──
  useEffect(() => {
    if (!el.current || map.current) return
    tile.current = new TileLayer({ source: baseSource('light'), zIndex: 0, className: 'spasial-base' })
    const choroStyle = (f: FeatureLike) => {
      const c = styleCtx.current
      const a = c.byCode[String(f.get('code'))]
      const v = a ? areaVal(a, c.metric, c.wi) : null
      const k = classOf(v, c.cls, c.metric)
      const sel = a && a.id === c.sel
      const hov = c.hover === f.get('code')
      const col = k.color
      const r = parseInt(col.slice(1, 3), 16), g = parseInt(col.slice(3, 5), 16), b = parseInt(col.slice(5, 7), 16)
      return new Style({
        fill: new Fill({ color: `rgba(${r},${g},${b},${c.op})` }),
        stroke: new Stroke({ color: sel ? '#0f172a' : hov ? '#334155' : c.bounds ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0)', width: sel ? 3 : hov ? 2 : c.bounds ? 0.8 : 0 }),
        zIndex: sel ? 2 : hov ? 1 : 0,
      })
    }
    choroL.current = new VectorLayer({ source: choroSrc.current, style: choroStyle, zIndex: 1 })
    heatL.current = new HeatmapLayer({ source: ptSrc.current, blur: 24, radius: 14, weight: (f) => f.get('hw') || 0, zIndex: 2, visible: false, opacity: 0.85 })
    const cache: Record<string, Style> = {}
    const ptStyle = (f: FeatureLike) => {
      const t: Titik = f.get('t'); const v = f.get('v') as ReturnType<typeof titikVal>
      const rad = Math.round(4 + Math.sqrt(Math.max(0, v.k) / Math.max(1, styleCtx.current.maxK)) * 13)
      const late = t.rn > t.r
      const key = `${v.st}|${rad}|${t.lokasi === 'c'}|${late}`
      if (!cache[key]) {
        const color = STATUS[v.st]?.color || '#64748b'
        cache[key] = new Style({
          image: new CircleStyle({ radius: rad, fill: new Fill({ color: t.lokasi === 'c' ? 'rgba(255,255,255,0.7)' : color + 'd9' }),
            stroke: new Stroke({ color: t.lokasi === 'c' ? color : late ? '#111827' : '#ffffff', width: t.lokasi === 'c' ? 2 : late ? 1.6 : 1.2, lineDash: t.lokasi === 'c' ? [3, 2] : undefined }) }),
          zIndex: v.st === 'klb' ? 4 : v.st === 'verif' ? 3 : 2,
        })
      }
      return cache[key]
    }
    ptL.current = new VectorLayer({ source: ptSrc.current, style: ptStyle, zIndex: 3, visible: false })
    const clCache: Record<string, Style> = {}
    const order = ['klb', 'verif', 'alert', 'rumor', 'lapor', 'discarded']
    const clStyle = (f: FeatureLike) => {
      const fs2: Feature[] = f.get('features') || []
      if (fs2.length === 1) return ptStyle(fs2[0])
      let k = 0, worst = 99
      for (const x of fs2) { const v = x.get('v'); k += v.k; worst = Math.min(worst, order.indexOf(v.st) < 0 ? 98 : order.indexOf(v.st)) }
      const st = order[worst] || 'lapor'
      const rad = Math.round(9 + Math.min(14, Math.log10(1 + k) * 3))
      const key = `${st}|${rad}|${fs2.length}`
      if (!clCache[key]) {
        const color = STATUS[st]?.color || '#0f766e'
        clCache[key] = new Style({
          image: new CircleStyle({ radius: rad, fill: new Fill({ color: color + 'cc' }), stroke: new Stroke({ color: '#ffffff', width: 2.5 }) }),
          text: new Text({ text: fs2.length > 999 ? `${Math.round(fs2.length / 100) / 10}rb` : String(fs2.length), font: 'bold 11px Inter, sans-serif', fill: new Fill({ color: '#fff' }) }),
        })
      }
      return clCache[key]
    }
    clL.current = new VectorLayer({ source: clusterSrc.current, style: clStyle, zIndex: 3 })
    flightsL.current = new VectorLayer({ source: flightsSrc.current, zIndex: 10 })
    firesL.current = new VectorLayer({ source: firesSrc.current, zIndex: 11 })
    hazardsL.current = new VectorLayer({ source: hazardsSrc.current, zIndex: 12 })
    wildlifeL.current = new VectorLayer({ source: wildlifeSrc.current, zIndex: 13 })
    vectorsL.current = new VectorLayer({ source: vectorsSrc.current, zIndex: 14 })
    radiusL.current = new VectorLayer({
      source: radiusSrc.current,
      zIndex: 15,
      style: (f) => {
        const km = Number(f.get('km') || 0)
        const fill = km <= 50 ? 'rgba(13,107,103,0.10)' : km <= 100 ? 'rgba(217,119,6,0.08)' : 'rgba(190,18,60,0.07)'
        const stroke = km <= 50 ? '#0D6B67' : km <= 100 ? '#d97706' : '#be123c'
        return new Style({ fill: new Fill({ color: fill }), stroke: new Stroke({ color: stroke, width: 2, lineDash: [6, 4] }) })
      },
    })

    overlay.current = new Overlay({ element: popNode!, positioning: 'bottom-center', offset: [0, -12], stopEvent: true, autoPan: { animation: { duration: 200 }, margin: 60 } })
    const m = new OlMap({
      target: el.current,
      layers: [
        tile.current,
        choroL.current,
        heatL.current,
        clL.current,
        ptL.current,
        flightsL.current,
        firesL.current,
        hazardsL.current,
        wildlifeL.current,
        vectorsL.current,
        radiusL.current,
      ],
      overlays: [overlay.current],
      view: new View({ center: fromLonLat([118, -2.5]), zoom: 4.6, minZoom: 3.5, maxZoom: 17 }),
      controls: [],
    })
    map.current = m
    m.on('pointermove', (e) => {
      if (e.dragging) return
      const hit = m.forEachFeatureAtPixel(e.pixel, (f, l) => ({ f, l }), { hitTolerance: 3 })
      let code: string | null = null, text: string | null = null
      if (hit?.f.get('intelType')) {
        const it = hit.f.get('intelType')
        const t = hit.f.get('title') || ''
        const sub = hit.f.get('subtitle') || ''
        text = `${it === 'flight' ? '✈️ Penerbangan' : it === 'fire' ? '🔥 Titik Panas FIRMS' : it === 'hazard' ? '⚠️ Bahaya Bencana' : it === 'wildlife' ? '🦅 Satwa Liar GBIF' : it === 'wind' ? '🌬️ Angin' : '🦟 Vektor Nyamuk'}: ${t}${sub ? ` · ${sub}` : ''}`
      } else if (hit?.l === choroL.current) {
        code = String(hit.f.get('code'))
        const a = styleCtx.current.byCode[code]
        const mt = METRICS.find((x) => x.key === styleCtx.current.metric)
        const v = a ? areaVal(a, styleCtx.current.metric, styleCtx.current.wi) : null
        text = `${hit.f.get('name')}: ${styleCtx.current.label || mt?.label} ${v === null ? '–' : styleCtx.current.metric === 'cfr' || styleCtx.current.metric === 'chg_minggu' ? fmtPct(v, styleCtx.current.metric === 'chg_minggu') : nf(v)}`
      } else if (hit) {
        const fs2: Feature[] = hit.f.get('features') || [hit.f]
        const t: Titik | undefined = fs2[0]?.get('t')
        text = fs2.length > 1 ? `${nf(fs2.length)} unit pelapor · klik untuk memperbesar` : t ? `${t.unit || '(unit tanpa nama)'} · ${nf(fs2[0].get('v').k)} kasus` : null
      }
      if (styleCtx.current.hover !== code) { styleCtx.current.hover = code; choroL.current?.changed() }
      m.getTargetElement().style.cursor = hit ? 'pointer' : ''
      setHover(text ? { x: e.pixel[0], y: e.pixel[1], text } : null)
    })
    m.on('singleclick', (e) => {
      const hit = m.forEachFeatureAtPixel(e.pixel, (f, l) => ({ f, l }), { hitTolerance: 3, layerFilter: (l) => l !== heatL.current })
      if (!hit) { setPopup(null); overlay.current?.setPosition(undefined); return }
      if (hit.f.get('intelType')) {
        const it = hit.f.get('intelType')
        setPopup({
          kind: 'intel',
          type: it,
          badgeText: hit.f.get('badgeText') || it.toUpperCase(),
          badgeColor: hit.f.get('badgeColor') || '#0f766e',
          source: hit.f.get('source') || 'SKDR Intelijen',
          title: hit.f.get('title') || '',
          subtitle: hit.f.get('subtitle'),
          details: hit.f.get('details') || [],
          link: hit.f.get('link'),
        })
        overlay.current?.setPosition(e.coordinate)
        return
      }
      if (hit.l === choroL.current) {
        const a = styleCtx.current.byCode[String(hit.f.get('code'))]
        if (a) { onSelectRef.current(a); setPopup({ kind: 'area', area: a }); overlay.current?.setPosition(e.coordinate) }
        return
      }
      const fs2: Feature[] = hit.f.get('features') || [hit.f]
      if (fs2.length > 1) {
        const ext = boundingExtent(fs2.map((x) => (x.getGeometry() as Point).getCoordinates()))
        const z = m.getView().getZoom() || 5
        if (z < 13 && ext[2] - ext[0] + (ext[3] - ext[1]) > 30) { m.getView().fit(ext, { padding: [80, 80, 80, 80], duration: 350, maxZoom: Math.min(15, z + 3) }); setPopup(null); overlay.current?.setPosition(undefined) }
        else { setPopup({ kind: 'cluster', items: fs2.map((x) => x.get('t')) }); overlay.current?.setPosition((fs2[0].getGeometry() as Point).getCoordinates()) }
        return
      }
      const t: Titik = fs2[0].get('t')
      setPopup({ kind: 'titik', t }); overlay.current?.setPosition((fs2[0].getGeometry() as Point).getCoordinates())
    })
    const onFs = () => { setFs(Boolean(document.fullscreenElement)); setTimeout(() => m.updateSize(), 60) }
    document.addEventListener('fullscreenchange', onFs)
    const ro = new ResizeObserver(() => m.updateSize())
    ro.observe(el.current)
    return () => { document.removeEventListener('fullscreenchange', onFs); ro.disconnect(); m.setTarget(undefined); map.current = null }
  }, [])


  // ── radius dukungan (lingkaran 50/100/200 km) ──
  useEffect(() => {
    const src = radiusSrc.current
    src.clear()
    const on = Boolean(radiusSupport?.enabled && radiusSupport.center)
    if (radiusL.current) radiusL.current.setVisible(on)
    if (!on || !radiusSupport?.center) return
    const rings = radiusSupport.ringsKm?.length ? radiusSupport.ringsKm : [50, 100, 200]
    const { lon, lat } = radiusSupport.center
    for (const km of rings) {
      const geom = circular([lon, lat], km * 1000, 64).transform('EPSG:4326', 'EPSG:3857')
      const f = new Feature({ geometry: geom })
      f.set('km', km)
      src.addFeature(f)
    }
  }, [radiusSupport?.enabled, radiusSupport?.center?.lat, radiusSupport?.center?.lon, radiusSupport?.ringsKm])

  // ── base map ──
  useEffect(() => { if (!tile.current) return; tile.current.setVisible(layers.base !== 'none'); if (layers.base !== 'none') tile.current.setSource(baseSource(layers.base)) }, [layers.base])

  // ── geometry ──
  const geoKey = data ? `${level}|${data.prov ?? ''}` : ''
  useEffect(() => {
    if (!data) return
    let alive = true
    setGeoErr(false)
    const provName = data.meta?.breadcrumb?.[1]?.label || null
    const pc = level === 'kabkota' ? (data.wilayah[0]?.code || '').slice(0, 2) : null
    loadGeo(level, pc, provName).then((fs2) => {
      if (!alive) return
      const feats = new GeoJSON().readFeatures({ type: 'FeatureCollection', features: fs2 }, { featureProjection: 'EPSG:3857' }) as Feature[]
      feats.forEach((f) => { const p = f.getProperties(); f.set('code', String(level === 'provinsi' ? p.id_provinsi : p.kode_kab)); f.set('name', String(level === 'provinsi' ? p.provinsi : p.nama_kab)) })
      choroSrc.current.clear(); choroSrc.current.addFeatures(feats)
      setGeoReady((n) => n + 1)
    }).catch(() => alive && setGeoErr(true))
    return () => { alive = false }
  }, [geoKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── external intel layers (tiap lapisan dimuat terpisah lewat proxy GET /api/v1/map-layers/*) ──
  const dot = (color: string, radius: number, emoji?: string, label?: string) => new Style({
    image: new CircleStyle({ radius, fill: new Fill({ color }), stroke: new Stroke({ color: '#ffffff', width: 2 }) }),
    text: emoji || label ? new Text({ text: emoji || label, font: emoji ? '10px Inter, sans-serif' : 'bold 9px Inter, sans-serif', fill: new Fill({ color: '#0f172a' }), stroke: label ? new Stroke({ color: '#ffffff', width: 2 }) : undefined, offsetY: label ? 12 : 0 }) : undefined,
  })
  const intelFeat = (lon: number, lat: number, props: Record<string, any>, style: Style) => {
    const feat = new Feature({ geometry: new Point(fromLonLat([lon, lat])) })
    Object.entries(props).forEach(([k, v]) => feat.set(k, v))
    feat.setStyle(style)
    return feat
  }

  useEffect(() => {
    let alive = true
    const src = flightsSrc.current
    if (!intelLayers?.flights) { src.clear(); return }
    report('flights', { state: 'loading' })
    Promise.allSettled([getJson('/api/v1/map-layers/flight-airports'), getJson('/api/v1/map-layers/flights')]).then(([apR, flR]) => {
      if (!alive) return
      src.clear()
      const airports: any[] = apR.status === 'fulfilled' ? apR.value?.airports || [] : []
      const flights: any[] = flR.status === 'fulfilled' ? flR.value?.flights || [] : []
      const airportMap: Record<string, [number, number]> = {}
      airports.forEach((ap) => {
        airportMap[ap.iata] = [ap.longitude, ap.latitude]
        src.addFeature(intelFeat(ap.longitude, ap.latitude, {
          intelType: 'flight', badgeText: 'BANDARA', badgeColor: '#0284c7', source: 'Daftar bandara utama (statis)',
          title: `${ap.name} (${ap.iata})`, subtitle: `${ap.city}, Indonesia`,
          details: [{ label: 'Kode ICAO', value: ap.icao || '–' }, { label: 'Perkiraan konektivitas', value: `${ap.degree || 0} rute langsung` }, { label: 'Tipe', value: ap.band === 'hub' ? 'Bandara pengumpul utama' : ap.band === 'regional' ? 'Bandara regional' : 'Bandara pengumpan' }],
        }, dot(ap.band === 'hub' ? '#0284c7' : '#38bdf8', ap.band === 'hub' ? 7 : 5, undefined, ap.iata)))
      })
      const cgk = airportMap.CGK
      if (cgk) ['DPS', 'SUB', 'UPG', 'KNO', 'BPN', 'YIA', 'BTH'].forEach((dest) => {
        const d = airportMap[dest]
        if (!d) return
        const lf = new Feature({ geometry: new LineString([fromLonLat(cgk), fromLonLat(d)]) })
        lf.setStyle(new Style({ stroke: new Stroke({ color: 'rgba(2, 132, 199, 0.45)', width: 1.5, lineDash: [4, 4] }) }))
        src.addFeature(lf)
      })
      flights.forEach((fl) => {
        const st = new Style({
          text: new Text({ text: '✈', font: 'bold 14px sans-serif', rotation: ((fl.heading || 0) - 90) * Math.PI / 180, fill: new Fill({ color: '#0369a1' }), stroke: new Stroke({ color: '#ffffff', width: 3 }) }),
        })
        src.addFeature(intelFeat(fl.longitude, fl.latitude, {
          intelType: 'flight', badgeText: 'PESAWAT', badgeColor: '#0369a1', source: 'ADS-B terbuka (adsb.lol / adsb.fi)',
          title: `Penerbangan ${fl.callsign || fl.icao24}`, subtitle: [fl.type, fl.registration].filter(Boolean).join(' · ') || 'Indonesia',
          details: [
            { label: 'Nomor penerbangan', value: fl.callsign || '–' },
            { label: 'Ketinggian', value: fl.altitude_m ? `${Math.round(fl.altitude_m).toLocaleString('id-ID')} m` : 'di darat / tidak ada' },
            { label: 'Kecepatan', value: fl.velocity_ms ? `${Math.round(fl.velocity_ms * 3.6)} km/jam` : '–' },
            { label: 'Arah', value: fl.heading != null ? `${fl.heading}°` : '–' },
          ],
        }, st))
      })
      if (flR.status === 'rejected' && !airports.length) report('flights', { state: 'error', message: `Sumber tidak dapat diakses (${String((flR as any).reason?.message || '').slice(0, 140)})` })
      else report('flights', {
        state: flights.length ? 'ok' : 'empty', count: flights.length, at: flR.status === 'fulfilled' ? flR.value?.fetched_at : undefined,
        message: flR.status === 'rejected' ? `Posisi pesawat gagal dimuat; hanya ${airports.length} bandara ditampilkan` : flights.length ? `${flights.length} pesawat · ${airports.length} bandara` : `Tidak ada pesawat terpantau; ${airports.length} bandara ditampilkan`,
      })
    })
    return () => { alive = false }
  }, [intelLayers?.flights]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let alive = true
    const src = firesSrc.current
    if (!intelLayers?.fires) { src.clear(); return }
    report('fires', { state: 'loading' })
    getJson('/api/v1/map-layers/fires').then((res) => {
      if (!alive) return
      src.clear()
      const hotspots: any[] = res?.hotspots || []
      hotspots.forEach((hs) => {
        const frp = Number(hs.frp || 0)
        src.addFeature(intelFeat(hs.longitude, hs.latitude, {
          intelType: 'fire', badgeText: 'TITIK PANAS', badgeColor: '#ef4444', source: `NASA FIRMS (${hs.satellite || 'VIIRS'})`,
          title: `Titik panas · keyakinan ${hs.confidence || 'nominal'}`, subtitle: `${hs.acq_date || ''} ${hs.acq_time ? `${String(hs.acq_time).padStart(4, '0').replace(/(\d\d)(\d\d)/, '$1:$2')} UTC` : ''} · ${hs.daynight || ''}`,
          details: [
            { label: 'Suhu kecerahan', value: hs.brightness ? `${hs.brightness} K` : '–' },
            { label: 'Daya radiasi api (FRP)', value: frp ? `${frp} MW` : '–' },
            { label: 'Koordinat', value: `${Number(hs.latitude).toFixed(3)}, ${Number(hs.longitude).toFixed(3)}` },
          ],
          link: `https://firms.modaps.eosdis.nasa.gov/map/#d:24hrs;@${hs.longitude},${hs.latitude},10z`,
        }, new Style({ image: new CircleStyle({ radius: frp > 50 ? 6 : frp > 10 ? 4.5 : 3.5, fill: new Fill({ color: frp > 50 ? 'rgba(185,28,28,0.95)' : 'rgba(239,68,68,0.85)' }), stroke: new Stroke({ color: '#fff7ed', width: 1 }) }) })))
      })
      done('fires', hotspots.length, res)
    }).catch(fail('fires'))
    return () => { alive = false }
  }, [intelLayers?.fires]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let alive = true
    const src = hazardsSrc.current
    if (!intelLayers?.hazards) { src.clear(); return }
    report('hazards', { state: 'loading' })
    getJson('/api/v1/map-layers/hazards').then((res) => {
      if (!alive) return
      src.clear()
      const events: any[] = res?.events || []
      events.forEach((ev) => {
        const color = ev.alert_level === 'red' ? '#dc2626' : ev.alert_level === 'orange' ? '#ea580c' : '#eab308'
        const jenis = KIND_LABEL[ev.kind] || 'Bencana'
        src.addFeature(intelFeat(ev.longitude, ev.latitude, {
          intelType: 'hazard', badgeText: jenis.toUpperCase(), badgeColor: color, source: ev.source || 'BMKG / GDACS',
          title: ev.title || jenis, subtitle: ev.place || 'Indonesia',
          details: [
            { label: 'Jenis', value: jenis },
            { label: 'Tingkat peringatan', value: ev.alert_level === 'red' ? 'Merah (tinggi)' : ev.alert_level === 'orange' ? 'Oranye (sedang)' : 'Kuning (rendah)' },
            ...(ev.magnitude != null && ev.kind === 'earthquake' ? [{ label: 'Magnitudo', value: String(ev.magnitude) }] : []),
            ...(ev.depth ? [{ label: 'Kedalaman', value: String(ev.depth) }] : []),
            ...(ev.time ? [{ label: 'Waktu', value: String(ev.time).replace('T', ' ').slice(0, 19) }] : []),
            ...(ev.potensi ? [{ label: 'Keterangan', value: String(ev.potensi) }] : []),
          ],
          link: ev.url,
        }, new Style({
          image: new CircleStyle({ radius: ev.kind === 'earthquake' ? Math.max(6, Math.min(12, (Number(ev.magnitude) || 5) * 1.6)) : 9, fill: new Fill({ color: color + 'cc' }), stroke: new Stroke({ color: '#ffffff', width: 2.5 }) }),
          text: new Text({ text: KIND_ICON[ev.kind] || '⚠', font: '10px sans-serif', fill: new Fill({ color: '#ffffff' }) }),
        })))
      })
      done('hazards', events.length, res)
    }).catch(fail('hazards'))
    return () => { alive = false }
  }, [intelLayers?.hazards]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let alive = true
    const src = wildlifeSrc.current
    if (!intelLayers?.wildlife) { src.clear(); return }
    report('wildlife', { state: 'loading' })
    getJson('/api/v1/map-layers/wildlife').then((res) => {
      if (!alive) return
      src.clear()
      let n = 0
      for (const item of res?.results || []) {
        const lat = item.decimalLatitude ?? item.latitude, lon = item.decimalLongitude ?? item.longitude
        if (lat == null || lon == null) continue
        n++
        src.addFeature(intelFeat(lon, lat, {
          intelType: 'wildlife', badgeText: 'BURUNG LIAR', badgeColor: '#059669', source: 'GBIF (kelas Aves)',
          title: item.species || item.scientificName || 'Burung liar', subtitle: item.place || 'Indonesia',
          details: [{ label: 'Nama ilmiah', value: item.scientificName || '–' }, { label: 'Genus', value: item.genericName || '–' }, { label: 'Tanggal pengamatan', value: item.eventDate ? String(item.eventDate).slice(0, 10) : '–' }],
          link: item.url,
        }, dot('#059669', 5)))
      }
      done('wildlife', n, res)
    }).catch(fail('wildlife'))
    return () => { alive = false }
  }, [intelLayers?.wildlife]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let alive = true
    const src = vectorsSrc.current
    if (!intelLayers?.vectors) { src.clear(); return }
    report('vectors', { state: 'loading' })
    getJson('/api/v1/map-layers/vectors').then((res) => {
      if (!alive) return
      src.clear()
      const sightings: any[] = res?.sightings || []
      sightings.forEach((sg) => {
        src.addFeature(intelFeat(sg.longitude, sg.latitude, {
          intelType: 'vector', badgeText: 'VEKTOR NYAMUK', badgeColor: '#7c3aed', source: 'iNaturalist (famili Culicidae)',
          title: sg.species || 'Nyamuk', subtitle: sg.place || 'Indonesia', link: sg.url,
          details: [{ label: 'Nama ilmiah', value: sg.scientificName || '–' }, { label: 'Lokasi', value: sg.place || '–' }, { label: 'Tanggal pengamatan', value: sg.observed_on || '–' }],
        }, dot('#7c3aed', 5)))
      })
      done('vectors', sightings.length, res)
    }).catch(fail('vectors'))
    return () => { alive = false }
  }, [intelLayers?.vectors]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── lapisan BNPB InaRISK (ArcGIS REST ImageServer / MapServer, viewport overlay seperti ABVC/kemkes-web) ──
  const bnpbRefs = useRef<Partial<Record<BnpbLayerId, ImageLayer<ImageArcGISRest>>>>({})
  useEffect(() => {
    const m = map.current
    if (!m) return
    for (const def of BNPB_LAYERS) {
      const on = Boolean(bnpbLayers?.[def.id])
      let l = bnpbRefs.current[def.id]
      if (!l && on) {
        const src = new ImageArcGISRest({
          url: def.url,
          ratio: 1,
          params: {
            format: 'png32',
            transparent: true,
          },
        })
        src.on('imageloadstart', () => onBnpbStatus?.(def.id, { state: 'loading' }))
        src.on('imageloadend', () => onBnpbStatus?.(def.id, { state: 'ok', message: 'Lapisan berhasil dimuat' }))
        src.on('imageloaderror', () => onBnpbStatus?.(def.id, { state: 'error', message: 'Server BNPB tidak merespons' }))
        l = new ImageLayer({ source: src, opacity: def.opacity, zIndex: 5, visible: false })
        bnpbRefs.current[def.id] = l
        m.addLayer(l)
      }
      if (l) l.setVisible(on)
    }
  }, [bnpbLayers]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── aliran angin animasi (ol-wind, sama seperti ABVC) dari GFS u/v lewat /wind-data ──
  const windAnim = useRef<any>(null)
  useEffect(() => {
    let alive = true
    const m = map.current
    if (!windFlow) {
      if (windAnim.current) { try { windAnim.current.setVisible?.(false); windAnim.current.stop?.() } catch {} }
      setWindErr(null)
      return
    }
    if (windAnim.current) {
      try { windAnim.current.setVisible?.(true); windAnim.current.start?.() } catch {}
      return
    }
    Promise.all([getJson('/wind-data'), import('ol-wind')]).then(([res, mod]) => {
      if (!alive || !m) return
      const [u, v] = Array.isArray(res) ? res : []
      if (!u?.header || !Array.isArray(u?.data) || !Array.isArray(v?.data)) throw new Error('format GFS tidak dikenali')
      const WindLayer = (mod as any).WindLayer
      const layer = new WindLayer(res, {
        zIndex: 18,
        windOptions: {
          velocityScale: 0.015, paths: 350, lineWidth: 2.2, generateParticleOption: true,
          colorScale: ['rgb(15,60,140)', 'rgb(70,150,145)', 'rgb(85,160,115)', 'rgb(215,195,60)', 'rgb(210,125,35)', 'rgb(185,35,10)', 'rgb(155,8,12)'],
        },
        fieldOptions: { wrapX: true },
      })
      m.addLayer(layer)
      windAnim.current = layer
      setWindErr(null)
    }).catch((e) => { if (alive) setWindErr(`Data angin tidak tersedia (${String(e?.message || e).slice(0, 80)})`) })
    return () => { alive = false }
  }, [windFlow]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => {
    const l = windAnim.current
    if (l) { try { map.current?.removeLayer(l); l.dispose?.() } catch {} ; windAnim.current = null }
  }, [])

  // ── opasitas titik & garis batas wilayah ──
  useEffect(() => { clL.current?.setOpacity(pointOpacity); ptL.current?.setOpacity(pointOpacity) }, [pointOpacity])
  useEffect(() => { styleCtx.current.bounds = showBoundaries; styleCtx.current.label = metricLabel || null; choroL.current?.changed() }, [showBoundaries, metricLabel])

  // ── fit to scope (selected kab or whole level) ──
  const kabSel = data?.kab?.[0] ?? null
  useEffect(() => {
    const m = map.current
    if (!m || !geoReady) return
    let ext = createEmpty()
    const selA = kabSel ? areas.find((a) => a.id === kabSel) : null
    choroSrc.current.getFeatures().forEach((f) => { if (!selA || f.get('code') === selA.code) extend(ext, f.getGeometry()!.getExtent()) })
    if (isEmpty(ext)) return
    const right = panelOpen && (wrap.current?.clientWidth || 0) > 900 ? (fullHeight ? 400 : 380) : 40
    const topPad = topOffset ? topOffset + 16 : 70
    m.getView().fit(ext, { padding: [topPad, right, 70, 40], duration: 300, maxZoom: kabSel ? 11 : 9 })
  }, [geoReady, kabSel]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── choropleth style context ──
  const allWeekVals = useMemo(() => {
    if (wi < 0) return null
    const key = METRICS.find((m) => m.key === metric)?.seri
    if (!key) return null
    return areas.flatMap((a) => a.seri?.[key] || [])
  }, [areas, metric, wi])
  const cls = useMemo(() => classesFor(metric, allWeekVals || areas.map((a) => areaVal(a, metric, -1)), choroCfg), [metric, areas, choroCfg, allWeekVals])
  useEffect(() => {
    const byCode: Record<string, Area> = {}
    areas.forEach((a) => { byCode[a.code] = a })
    Object.assign(styleCtx.current, { byCode, cls, wi, metric, sel: selectedId, op: layers.opChoro })
    choroL.current?.changed()
  }, [areas, cls, wi, metric, selectedId, layers.opChoro, geoReady])
  useEffect(() => { choroL.current?.setVisible(layers.choro) }, [layers.choro])

  // ── points ──
  const statusOpts = statusFor(sumber)
  useEffect(() => {
    const on = layers.status.length ? new Set(layers.status) : null
    const feats: Feature[] = []
    let maxK = 1
    for (const t of titik) {
      const v = titikVal(t, wi)
      if (wi >= 0 && v.k <= 0 && v.a <= 0) continue
      if (on && !on.has(v.st)) continue
      if (layers.kasusMin > 0 && v.k < layers.kasusMin) continue
      maxK = Math.max(maxK, v.k)
      const f = new Feature({ geometry: new Point(fromLonLat([t.lon, t.lat])) })
      f.set('t', t); f.set('v', v)
      feats.push(f)
    }
    feats.forEach((f) => f.set('hw', Math.sqrt(f.get('v').k / maxK)))
    styleCtx.current.maxK = maxK
    ptSrc.current.clear(); ptSrc.current.addFeatures(feats)
  }, [titik, wi, layers.status, layers.kasusMin])
  useEffect(() => {
    ptL.current?.setVisible(layers.points === 'titik'); clL.current?.setVisible(layers.points === 'kluster'); heatL.current?.setVisible(layers.heat)
  }, [layers.points, layers.heat])

  // ── playback ──
  useEffect(() => { setWi(-1); setPlaying(false) }, [data?.meta?.mulai, data?.meta?.akhir])
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setWi((x) => (x + 1 >= weeks.length ? (setPlaying(false), weeks.length - 1) : x + 1)), 1300)
    return () => clearInterval(id)
  }, [playing, weeks.length])

  // ── focus from table / hotspot ──
  useEffect(() => {
    const m = map.current
    if (!m || !focus) return
    const c = fromLonLat([focus.lon, focus.lat])
    m.getView().animate({ center: c, zoom: focus.zoom ?? Math.max(m.getView().getZoom() || 5, 12), duration: 450 })
    if (focus.area) setPopup({ kind: 'area', area: focus.area })
    else if (focus.titik) setPopup({ kind: 'titik', t: focus.titik })
    else if (focus.row) setPopup({ kind: 'row', row: focus.row })
    overlay.current?.setPosition(c)
  }, [focus])
  // close popups when data changes
  useEffect(() => { setPopup(null); overlay.current?.setPosition(undefined) }, [data])

  const closePop = () => { setPopup(null); overlay.current?.setPosition(undefined) }
  const fitAll = useCallback(() => { setGeoReady((n) => n + 1) }, [])
  const toggleFs = () => { if (document.fullscreenElement) document.exitFullscreen?.(); else wrap.current?.requestFullscreen?.() }
  const mt = METRICS.find((x) => x.key === metric)!
  const lvLabel = level === 'provinsi' ? 'provinsi' : 'kab/kota'
  const btn = (on: boolean) => `flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-bold transition ${on ? 'bg-teal-50 text-teal-800' : 'text-slate-600 hover:bg-slate-100'}`
  const crumbs: any[] = data?.meta?.breadcrumb || []

  return (
    <div ref={wrap} className={fullHeight ? "relative h-full w-full overflow-hidden bg-slate-100" : "relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-2xs"} style={{ height: fs ? '100vh' : fullHeight ? '100%' : height }} data-testid="spasial-map" data-base={layers.base}>
      <style>{`[data-base="light"] .spasial-base canvas{filter:grayscale(1) brightness(1.08) contrast(0.88)}`}</style>
      <div ref={el} className="absolute inset-0" />
      {windErr ? <div className="absolute left-1/2 top-28 z-30 -translate-x-1/2 rounded-lg bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-800">{windErr}</div> : null}
      {geoErr ? <div className="absolute left-1/2 top-20 z-30 -translate-x-1/2 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700">Batas wilayah gagal dimuat; titik tetap ditampilkan.</div> : null}

      {fullHeight ? (
        <div className="pointer-events-none absolute inset-0 z-30 flex flex-col gap-2.5 p-3">
          {topHud ? (
            <div className="shrink-0">
              {typeof topHud === 'function' ? topHud({ fitAll, toggleFs, fs, showLegend, setShowLegend, showLayers, setShowLayers }) : topHud}
            </div>
          ) : null}
          <div className="flex min-h-0 flex-1 items-start justify-between gap-3">
            <div className="flex max-h-full flex-col gap-2 overflow-y-auto pr-0.5">
              {leftDock}
              {showLegend ? <Legend metric={metric} label={metricLabel} cls={cls} lvLabel={lvLabel} sumber={sumber} weekly={wi >= 0} points={layers.points !== 'off'} heat={layers.heat} onClose={() => setShowLegend(false)} inline /> : null}
            </div>
            <div className="flex min-w-0 flex-1 flex-col items-center justify-end self-stretch pb-0.5">
              {weeks.length > 1 ? (
                <div className="pointer-events-auto flex w-[min(560px,100%)] items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur" data-testid="spasial-playback">
                  <button type="button" disabled={!data?.seri} onClick={() => { if (!playing && wi >= weeks.length - 1) setWi(0); else if (!playing && wi < 0) setWi(0); setPlaying(!playing) }}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-700 text-white disabled:opacity-40" aria-label={playing ? 'Jeda' : 'Putar per minggu epid'} data-testid="spasial-play">
                    {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>
                  <input type="range" min={-1} max={weeks.length - 1} value={wi} disabled={!data?.seri} onChange={(e) => { setPlaying(false); setWi(Number(e.target.value)) }} className="min-w-0 flex-1 accent-teal-700" aria-label="Minggu epid" data-testid="spasial-week" />
                  <span className="w-[150px] shrink-0 text-right text-[11px] font-extrabold text-slate-700">{wi < 0 ? `Semua minggu (${weeks[0]?.label} – ${weeks[weeks.length - 1]?.label})` : `Minggu ${weeks[wi]?.label}`}</span>
                </div>
              ) : null}
            </div>
            {panelOpen ? (
              <div className="pointer-events-auto h-full w-[380px] shrink-0 max-w-[calc(100vw-24px)]" data-testid="spasial-panel">
                {rightPanel}
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          {/* toolbar */}
          {!hideDefaultToolbar ? (
            <div className="absolute left-1/2 top-3 z-40 flex max-w-[calc(100%-24px)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white/95 px-1.5 py-1 shadow-lg backdrop-blur" data-testid="spasial-toolbar">
              {onUp ? <button type="button" onClick={onUp} className={btn(false)} title="Naik satu tingkat wilayah" data-testid="spasial-up"><ArrowLeft className="h-4 w-4" /><span className="hidden md:inline">Kembali</span></button> : null}
              <span className="mx-1 hidden whitespace-nowrap text-[11px] font-black text-slate-800 lg:inline">{crumbs.map((c) => c.label).join(' › ') || 'Indonesia'}</span>
              <span className="mx-1 h-5 w-px bg-slate-200" />
              <button type="button" onClick={() => setShowLayers(!showLayers)} className={btn(showLayers)} aria-pressed={showLayers} data-testid="spasial-toggle-layers"><Layers className="h-4 w-4" /><span className="hidden xl:inline">Lapisan</span></button>
              <button type="button" onClick={() => setShowLegend(!showLegend)} className={btn(showLegend)} aria-pressed={showLegend} data-testid="spasial-toggle-legend"><ListTree className="h-4 w-4" /><span className="hidden xl:inline">Legenda</span></button>
              <button type="button" onClick={() => setPanelOpen(!panelOpen)} className={btn(panelOpen)} aria-pressed={panelOpen} data-testid="spasial-toggle-panel"><PanelRight className="h-4 w-4" /><span className="hidden xl:inline">Hotspot & detail</span></button>
              <span className="mx-1 h-5 w-px bg-slate-200" />
              <button type="button" onClick={fitAll} className={btn(false)} title="Tampilkan seluruh wilayah terpilih" data-testid="spasial-fit"><Crosshair className="h-4 w-4" /></button>
              <button type="button" onClick={toggleFs} className={btn(fs)} title={fs ? 'Keluar layar penuh' : 'Layar penuh'}>{fs ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</button>
            </div>
          ) : null}

          {/* layer switcher */}
          {showLayers ? (
            <div className="absolute left-3 z-30 w-[250px] space-y-2 rounded-2xl border border-slate-200 bg-white/95 p-3 text-[11px] shadow-xl backdrop-blur" style={{ top: topOffset ?? 64 }} data-testid="spasial-layers">
              <div className="flex items-center justify-between"><b className="text-xs font-black text-slate-800">Lapisan peta</b><button type="button" onClick={() => setShowLayers(false)} className="rounded p-0.5 text-slate-400 hover:bg-slate-100" aria-label="Tutup"><X className="h-3.5 w-3.5" /></button></div>
              <div>
                <p className="mb-1 font-extrabold uppercase tracking-wider text-slate-500">Peta dasar</p>
                <div className="grid grid-cols-4 gap-1">{([['light', 'Terang'], ['osm', 'OSM'], ['satellite', 'Satelit'], ['none', 'Polos']] as [BaseMap, string][]).map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setLayers({ ...layers, base: k })} className={`rounded-md border px-1 py-1 font-bold ${layers.base === k ? 'border-teal-600 bg-teal-50 text-teal-800' : 'border-slate-200 text-slate-600'}`}>{l}</button>))}</div>
              </div>
              <label className="flex items-center justify-between gap-2 font-bold text-slate-700"><span>Choropleth {lvLabel}</span><input type="checkbox" checked={layers.choro} onChange={(e) => setLayers({ ...layers, choro: e.target.checked })} data-testid="layer-choro" /></label>
              <label className="block"><span className="mb-0.5 block font-bold text-slate-600">Indikator warna wilayah</span>
                <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)} className="h-8 w-full rounded-lg border border-slate-200 px-2 font-bold" data-testid="layer-metric">
                  {METRICS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
                </select></label>
              <label className="block"><span className="font-bold text-slate-600">Transparansi choropleth</span>
                <input type="range" min={0.2} max={1} step={0.05} value={layers.opChoro} onChange={(e) => setLayers({ ...layers, opChoro: Number(e.target.value) })} className="w-full" /></label>
              <div><p className="mb-1 font-extrabold uppercase tracking-wider text-slate-500">Titik unit pelapor</p>
                <div className="grid grid-cols-3 gap-1">{([['kluster', 'Kluster'], ['titik', 'Titik'], ['off', 'Sembunyi']] as [PointMode, string][]).map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setLayers({ ...layers, points: k })} data-testid={`layer-points-${k}`} className={`rounded-md border px-1 py-1 font-bold ${layers.points === k ? 'border-teal-600 bg-teal-50 text-teal-800' : 'border-slate-200 text-slate-600'}`}>{l}</button>))}</div></div>
              <label className="flex items-center justify-between gap-2 font-bold text-slate-700"><span>Heatmap kasus</span><input type="checkbox" checked={layers.heat} onChange={(e) => setLayers({ ...layers, heat: e.target.checked })} data-testid="layer-heat" /></label>
              <div><p className="mb-1 font-extrabold uppercase tracking-wider text-slate-500">Status titik</p>
                <div className="flex flex-wrap gap-1">{statusOpts.map((s) => { const on = !layers.status.length || layers.status.includes(s); return (
                  <button key={s} type="button" title={STATUS[s].tip} onClick={() => { const cur = layers.status.length ? layers.status : statusOpts; const n = on ? cur.filter((x) => x !== s) : [...cur, s]; setLayers({ ...layers, status: n.length === statusOpts.length ? [] : n }) }}
                    className={`flex items-center gap-1 rounded-full border px-2 py-0.5 font-bold ${on ? 'border-slate-300 bg-white text-slate-700' : 'border-slate-200 bg-slate-100 text-slate-400 line-through'}`}>
                    <span className="h-2 w-2 rounded-full" style={{ background: STATUS[s].color }} />{STATUS[s].label}</button>) })}</div></div>
              <label className="flex items-center justify-between gap-2 font-bold text-slate-700"><span>Kasus minimal per unit</span>
                <input type="number" min={0} value={layers.kasusMin || ''} placeholder="0" onChange={(e) => setLayers({ ...layers, kasusMin: Math.max(0, Number(e.target.value) || 0) })} className="h-7 w-20 rounded-md border border-slate-200 px-1.5 text-right" /></label>
            </div>
          ) : null}

          {/* legend */}
          {showLegend && !showLayers ? <Legend metric={metric} label={metricLabel} cls={cls} lvLabel={lvLabel} sumber={sumber} weekly={wi >= 0} points={layers.points !== 'off'} heat={layers.heat} onClose={() => setShowLegend(false)} /> : null}

          {/* right panel */}
          {panelOpen ? <div className="absolute bottom-3 right-3 z-30 w-[350px] max-w-[calc(100%-24px)] transition-all duration-200" style={{ top: topOffset ?? 64 }} data-testid="spasial-panel">{rightPanel}</div> : null}

          {/* playback */}
          {weeks.length > 1 ? (
            <div className={`absolute bottom-3 left-1/2 z-30 flex w-[min(560px,calc(100%-24px))] -translate-x-1/2 items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur ${panelOpen ? 'lg:-ml-[175px]' : ''}`} data-testid="spasial-playback">
              <button type="button" disabled={!data?.seri} onClick={() => { if (!playing && wi >= weeks.length - 1) setWi(0); else if (!playing && wi < 0) setWi(0); setPlaying(!playing) }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-700 text-white disabled:opacity-40" aria-label={playing ? 'Jeda' : 'Putar per minggu epid'} data-testid="spasial-play">
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>
              <input type="range" min={-1} max={weeks.length - 1} value={wi} disabled={!data?.seri} onChange={(e) => { setPlaying(false); setWi(Number(e.target.value)) }} className="min-w-0 flex-1 accent-teal-700" aria-label="Minggu epid" data-testid="spasial-week" />
              <span className="w-[150px] shrink-0 text-right text-[11px] font-extrabold text-slate-700">{wi < 0 ? `Semua minggu (${weeks[0]?.label} – ${weeks[weeks.length - 1]?.label})` : `Minggu ${weeks[wi]?.label}`}</span>
            </div>
          ) : null}
        </>
      )}

      {hover && !popup ? <div className="pointer-events-none absolute z-30 rounded-lg border border-slate-200 bg-white/95 px-2 py-1 text-[11px] font-semibold text-slate-700 shadow" style={{ left: hover.x + 14, top: hover.y + 10 }}>{hover.text}</div> : null}

      {/* popup (positioned by OL overlay) */}
      {popNode ? createPortal(<div className={popup ? '' : 'hidden'}>
        {popup ? (
          <div className="w-[290px] rounded-xl border border-slate-200 bg-white p-3 text-[11px] text-slate-700 shadow-xl" data-testid="spasial-popup">
            <div className="mb-1.5 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-900">{popup.kind === 'area' ? popup.area.nama : popup.kind === 'titik' ? popup.t.unit || '(unit tanpa nama)' : popup.kind === 'row' ? popup.row.unit : popup.kind === 'intel' ? popup.title : `${nf(popup.items.length)} unit pelapor`}</p>
                <p className="text-[10.5px] text-slate-500">{popup.kind === 'area' ? `${level === 'provinsi' ? 'Provinsi' : 'Kab/Kota'} · ${data?.meta?.periode_label}${wi >= 0 ? ` · ${weeks[wi]?.label}` : ''}`
                  : popup.kind === 'titik' ? [popup.t.ju, popup.t.kec ? `Kec. ${popup.t.kec}` : null, popup.t.kab].filter(Boolean).join(' · ')
                  : popup.kind === 'row' ? [popup.row.kecamatan, popup.row.kabkota].filter(Boolean).join(' · ')
                  : popup.kind === 'intel' ? popup.subtitle || popup.source : 'Unit berdekatan / satu lokasi'}</p>
              </div>
              <button type="button" onClick={closePop} className="rounded p-0.5 text-slate-400 hover:bg-slate-100" aria-label="Tutup"><X className="h-3.5 w-3.5" /></button>
            </div>
            {popup.kind === 'area' ? <AreaPopup a={popup.area} wi={wi} weeks={weeks} data={data!} onDrill={level === 'provinsi' || !popup.area.dipilih ? () => { closePop(); onDrill(popup.area) } : null} sumber={sumber} /> : null}
            {popup.kind === 'titik' ? <TitikPopup t={popup.t} wi={wi} label={data?.lokasi_label?.[popup.t.lokasi]} weeks={weeks} /> : null}
            {popup.kind === 'row' ? <div className="space-y-0.5"><p><b>{popup.row.penyakit}</b> · {popup.row.minggu_label}</p><p>Kasus {nf(popup.row.kasus)} · Kematian {nf(popup.row.kematian)}</p>{popup.row.klb ? <p>KLB: {popup.row.klb} · Verifikasi: {popup.row.verif || '–'} · Respons: {popup.row.respon || '–'}</p> : null}</div> : null}
            {popup.kind === 'cluster' ? <ul className="max-h-48 space-y-1 overflow-auto">{[...popup.items].sort((a, b) => b.k - a.k).slice(0, 30).map((t) => (
              <li key={t.idx}><button type="button" className="flex w-full items-center justify-between gap-2 rounded px-1 py-0.5 text-left hover:bg-slate-50" onClick={() => setPopup({ kind: 'titik', t })}>
                <span className="flex min-w-0 items-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: STATUS[titikVal(t, wi).st]?.color }} /><span className="truncate">{t.unit}</span></span><b className="tabular-nums">{nf(titikVal(t, wi).k)}</b></button></li>))}</ul> : null}
            {popup.kind === 'intel' ? (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: popup.badgeColor || '#0f766e' }}>{popup.badgeText}</span>
                  <span className="text-[10px] text-slate-500 font-medium">{popup.source}</span>
                </div>
                <div className="border-t border-slate-100 pt-1 mt-1 space-y-0.5">
                  {popup.details.map((d, i) => (
                    <Row key={i} l={d.label} v={d.value} />
                  ))}
                </div>
                {popup.link ? (
                  <a href={popup.link} target="_blank" rel="noreferrer" className="block mt-2 text-center rounded-lg bg-teal-50 px-2 py-1 text-[10px] font-bold text-teal-700 hover:bg-teal-100">Buka Sumber Data ↗</a>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>, popNode) : null}
      {!data ? <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/40 text-xs font-bold text-slate-500">Memuat peta…</div> : null}
      <span className="sr-only">{mt.label}</span>
    </div>
  )
}

function Row({ l, v, tone }: { l: string; v: ReactNode; tone?: string }) {
  return <div className="flex items-center justify-between gap-2 border-b border-slate-100 py-0.5 last:border-0"><span className="text-slate-500">{l}</span><b className={`tabular-nums ${tone || 'text-slate-800'}`}>{v}</b></div>
}
const chgTone = (v: number | null) => (v === null ? 'text-slate-400' : v > 0 ? 'text-red-600' : v < 0 ? 'text-emerald-600' : 'text-slate-600')

function AreaPopup({ a, wi, weeks, data, onDrill, sumber }: { a: Area; wi: number; weeks: { label: string }[]; data: SpasialResp; onDrill: (() => void) | null; sumber: string }) {
  const w = wi >= 0 && a.seri
  const k = w ? a.seri!.k[wi] : a.kasus, m = w ? a.seri!.m[wi] : a.kematian
  const cur = w ? a.seri!.k[wi] : a.minggu_ini
  const prev = w ? (wi > 0 ? a.seri!.k[wi - 1] : null) : a.minggu_lalu
  const ch = prev ? Math.round(((cur - prev) * 1000) / prev) / 10 : null
  return (
    <div>
      <Row l="Kasus" v={nf(k)} />
      <Row l="Kematian" v={nf(m)} />
      <Row l="CFR" v={k > 0 ? fmtPct(Math.round((m * 1000) / k) / 10) : '–'} />
      <Row l={w ? `Perubahan vs ${wi > 0 ? weeks[wi - 1]?.label : 'minggu sebelumnya'}` : `Perubahan ${data.minggu_ini} vs ${data.minggu_lalu}`} v={<span className={chgTone(ch)}>{prev === null ? '–' : `${nf(prev)} → ${nf(cur)} (${fmtPct(ch, true)})`}</span>} />
      {!w ? <Row l="Perubahan vs periode sebelumnya" v={<span className={chgTone(a.chg_periode)}>{fmtPct(a.chg_periode, true)}</span>} /> : null}
      <Row l="Laporan" v={nf(w ? a.seri!.l[wi] : a.laporan)} />
      <Row l={sumber === 'ebs' ? 'Sinyal EBS' : 'Alert / sinyal'} v={nf(w ? a.seri!.a[wi] : a.alert)} />
      <Row l="KLB" v={nf(w ? a.seri!.b[wi] : a.klb)} tone={(w ? a.seri!.b[wi] : a.klb) > 0 ? 'text-red-600' : undefined} />
      {!w ? <Row l="Unit pelapor" v={nf(a.unit)} /> : null}
      {!w && a.porsi !== null ? <Row l="Porsi kasus dari total" v={fmtPct(a.porsi)} /> : null}
      {onDrill ? <button type="button" onClick={onDrill} className="mt-2 w-full rounded-lg bg-teal-700 px-2 py-1.5 text-[11px] font-bold text-white hover:bg-teal-800" data-testid="spasial-drill">{data.level === 'provinsi' ? 'Perbesar ke kab/kota provinsi ini' : 'Fokus ke kab/kota ini'}</button> : null}
    </div>
  )
}

function TitikPopup({ t, wi, label, weeks }: { t: Titik; wi: number; label?: string; weeks: { label: string }[] }) {
  const v = titikVal(t, wi)
  return (
    <div>
      <div className="mb-1 flex flex-wrap gap-1">
        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: STATUS[v.st]?.color || '#64748b' }}>{STATUS[v.st]?.label || v.st}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{t.src === 'ebs' ? 'Laporan EBS' : 'Laporan Agregat IBS'}</span>
      </div>
      <Row l={wi >= 0 ? `Kasus ${weeks[wi]?.label}` : 'Kasus'} v={nf(v.k)} />
      {wi < 0 ? <><Row l="Kematian" v={nf(t.m)} /><Row l="CFR" v={t.k > 0 ? fmtPct(Math.round((t.m * 1000) / t.k) / 10) : '–'} /><Row l="Laporan" v={nf(t.l)} /></> : null}
      <Row l={t.src === 'ebs' ? 'Sinyal' : 'Alert'} v={nf(v.a)} />
      <Row l="KLB" v={nf(v.b)} tone={v.b > 0 ? 'text-red-600' : undefined} />
      {wi < 0 && t.v ? <Row l="Terverifikasi" v={nf(t.v)} /> : null}
      {wi < 0 && t.rn ? <Row l="Respons ≤ 24 jam" v={`${nf(t.r)} / ${nf(t.rn)} (${fmtPct(Math.round((t.r * 1000) / t.rn) / 10)})`} tone={t.r < t.rn ? 'text-amber-700' : 'text-emerald-700'} /> : null}
      <p className={`mt-1 text-[10px] ${t.lokasi === 'c' ? 'font-bold text-amber-700' : 'text-slate-400'}`}>Lokasi: {label || t.lokasi}</p>
    </div>
  )
}

function Legend({ metric, label, cls, lvLabel, sumber, weekly, points, heat, onClose, inline = false }: { metric: Metric; label?: string; cls: MapClass[]; lvLabel: string; sumber: string; weekly: boolean; points: boolean; heat: boolean; onClose: () => void; inline?: boolean }) {
  const [col, setCol] = useState(false)
  const mt = METRICS.find((x) => x.key === metric)!
  return (
    <div className={inline ? "pointer-events-auto w-[265px] rounded-2xl border border-slate-200 bg-white/95 p-3 text-[10.5px] text-slate-600 shadow-lg backdrop-blur" : "absolute bottom-16 left-3 z-30 w-[240px] rounded-xl border border-slate-200 bg-white/95 p-2.5 text-[10.5px] text-slate-600 shadow-lg backdrop-blur"} data-testid="spasial-legend">
      <div className="flex items-center justify-between gap-1">
        <button type="button" onClick={() => setCol(!col)} className="flex flex-1 items-center gap-1 text-left text-[10px] font-black uppercase tracking-wide text-slate-500">Legenda {col ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}</button>
        <button type="button" onClick={onClose} className="rounded p-0.5 text-slate-400 hover:bg-slate-100" aria-label="Tutup legenda"><X className="h-3 w-3" /></button>
      </div>
      {!col ? (
        <div className="mt-1.5 space-y-2">
          <div>
            <p className="font-bold text-slate-700">{label || mt.label} per {lvLabel}</p>
            <ul className="mt-1 space-y-0.5">{cls.map((c) => <li key={c.label} className="flex items-center gap-1.5"><span className="h-3 w-5 rounded-[2px] border border-slate-300/70" style={{ background: c.color }} /><span className="tabular-nums">{c.label}</span></li>)}
              <li className="flex items-center gap-1.5"><span className="h-3 w-5 rounded-[2px] border border-slate-300/70" style={{ background: '#e5e7eb' }} />{metric === 'chg_minggu' ? 'Tidak ada pembanding' : metric === 'cfr' ? 'Tidak ada kasus' : 'Tidak ada data'}</li></ul>
            <p className="mt-1 leading-snug text-slate-400">{metric === 'chg_minggu' || metric === 'cfr' ? 'Ambang tetap.' : `Kelas: 0 lalu kuartil wilayah bernilai > 0${weekly ? ' (skala sama untuk semua minggu)' : ''}.`}</p>
          </div>
          {points ? (
            <div>
              <p className="font-bold text-slate-700">Titik unit pelapor</p>
              <ul className="mt-1 space-y-0.5">{statusFor(sumber).map((s) => <li key={s} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-white shadow" style={{ background: STATUS[s].color }} />{STATUS[s].label}</li>)}
                <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-[1.6px] border-slate-900 bg-amber-400" />Ada alert direspons &gt; 24 jam</li>
                <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-dashed border-teal-700 bg-white" />Lokasi perkiraan (pusat kab/kota)</li>
                <li className="flex items-center gap-1.5"><span className="flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[8px] font-black text-white">12</span>Kluster: jumlah unit, warna = status terberat</li></ul>
              <p className="mt-1 leading-snug text-slate-400">Ukuran titik sebanding √kasus.</p>
            </div>
          ) : null}
          {heat ? <div className="flex items-center gap-1.5"><span className="h-2.5 w-10 rounded-sm" style={{ background: 'linear-gradient(90deg,#00f,#0ff,#0f0,#ff0,#f00)' }} />Heatmap: kepadatan kasus</div> : null}
        </div>
      ) : null}
    </div>
  )
}
