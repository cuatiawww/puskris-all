'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import OlMap from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import ImageLayer from 'ol/layer/Image'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import OSM from 'ol/source/OSM'
import XYZ from 'ol/source/XYZ'
import ImageArcGISRest from 'ol/source/ImageArcGISRest'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import LineString from 'ol/geom/LineString'
import { circular } from 'ol/geom/Polygon'
import { fromLonLat } from 'ol/proj'
import { Circle as CircleStyle, Fill, Stroke, Style, Text as OlText } from 'ol/style'
import 'ol/ol.css'
import {
  Ambulance,
  Crosshair,
  Hospital,
  Layers,
  MapPin,
  Navigation,
  PhoneCall,
  Route,
  X,
} from 'lucide-react'
import { PUBLIC_BASE_PATH } from '@/lib/public-path'
import { BNPB_LAYERS, type BnpbLayerId } from '@/lib/puskris/open-data'
import { nf } from '@/lib/puskris/derive'
import { haversineKm, type KejadianTemplate } from '@/lib/puskris/kejadian-template'
import type { OsrmRouteResult, PendukungPayload } from './types'

type BaseMapKind = 'osm' | 'satellite' | 'terrain'

const TEMPLATE_BNPB_DEFAULT: Record<KejadianTemplate, BnpbLayerId> = {
  banjir: 'flood',
  gempa: 'earthquake',
  karhutla: 'forestFire',
  umum: 'multi',
}

function getBaseSource(base: BaseMapKind) {
  if (base === 'satellite') {
    return new XYZ({
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      crossOrigin: 'anonymous',
      attributions: 'Esri',
    })
  }
  if (base === 'terrain') {
    return new XYZ({
      url: 'https://{a-c}.tile.opentopomap.org/{z}/{x}/{y}.png',
      maxZoom: 17,
      attributions: 'OpenTopoMap',
    })
  }
  return new OSM({ url: `${PUBLIC_BASE_PATH}/osm-tiles/{z}/{x}/{y}.png`, crossOrigin: 'anonymous' })
}

export default function KejadianMapAndFaskes({
  kejadian,
  template,
  nearby,
  raw,
  pendukung,
}: {
  kejadian: any
  template: KejadianTemplate
  nearby: any
  raw: any
  pendukung: PendukungPayload | null
}) {
  const lat = Number.isFinite(Number(kejadian?.lat)) ? Number(kejadian.lat) : null
  const lon = Number.isFinite(Number(kejadian?.lon)) ? Number(kejadian.lon) : null

  const mapHostRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<OlMap | null>(null)
  const baseLayerRef = useRef<TileLayer<any> | null>(null)
  const bnpbLayerRef = useRef<ImageLayer<any> | null>(null)
  const vectorSourceRef = useRef<VectorSource | null>(null)

  const [basemap, setBasemap] = useState<BaseMapKind>('osm')
  const [showRadius, setShowRadius] = useState(true)
  const [showFaskes, setShowFaskes] = useState(true)
  const [showHazardLayer, setShowHazardLayer] = useState(true)
  const [showInarisk, setShowInarisk] = useState(false)
  const [pickedInfo, setPickedInfo] = useState<{ title: string; badge: string; lines: string[] } | null>(null)
  const [routeResult, setRouteResult] = useState<OsrmRouteResult | null>(null)
  const [routeLoadingId, setRouteLoadingId] = useState<string | null>(null)
  const [routeError, setRouteError] = useState<string | null>(null)

  const pscList: any[] = nearby?.psc?.tersedia ? (nearby.psc.daftar || []) : []
  const rsNearbyPoints = useMemo(() => {
    if (lat == null || lon == null) return []
    const rsAll: [number, number][] = raw?.psc?.titik_rs || []
    return rsAll
      .filter((r) => Array.isArray(r) && r[0] != null && r[1] != null)
      .map((r, i) => ({
        id: `rs-${i}`,
        nama: `Rumah Sakit Jejaring #${i + 1}`,
        lat: Number(r[0]),
        lon: Number(r[1]),
        jarak_km: Math.round(haversineKm(lat, lon, Number(r[0]), Number(r[1])) * 10) / 10,
      }))
      .filter((r) => r.jarak_km <= 80)
      .sort((a, b) => a.jarak_km - b.jarak_km)
      .slice(0, 40)
  }, [raw, lat, lon])

  const computeRoute = async (targetLat: number, targetLon: number, targetName: string, targetJenis: string, keyId: string) => {
    if (lat == null || lon == null) return
    setRouteLoadingId(keyId)
    setRouteError(null)
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${lon},${lat};${targetLon},${targetLat}?overview=full&geometries=geojson`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`)
      const j = await res.json()
      const rt = j?.routes?.[0]
      if (!rt?.geometry?.coordinates?.length) throw new Error('Rute jalan darat tidak ditemukan (kemungkinan terpisah laut)')
      setRouteResult({
        targetName,
        targetJenis,
        distanceKm: Math.round((Number(rt.distance || 0) / 1000) * 10) / 10,
        durationMin: Math.max(1, Math.round(Number(rt.duration || 0) / 60)),
        coordinates: rt.geometry.coordinates,
        from: [lon, lat],
        to: [targetLon, targetLat],
      })
    } catch (e: any) {
      setRouteError(String(e?.message || 'Gagal menghitung rute OSRM'))
    } finally {
      setRouteLoadingId(null)
    }
  }

  // Inisialisasi OpenLayers Map sekali ketika lat/lon tersedia
  useEffect(() => {
    if (!mapHostRef.current || lat == null || lon == null) return
    const baseLayer = new TileLayer({ source: getBaseSource(basemap) })
    const vecSrc = new VectorSource()
    const vecLayer = new VectorLayer({ source: vecSrc, zIndex: 20 })
    const bnpbLayer = new ImageLayer({ visible: false, opacity: 0.58, zIndex: 10 })

    baseLayerRef.current = baseLayer
    vectorSourceRef.current = vecSrc
    bnpbLayerRef.current = bnpbLayer

    const map = new OlMap({
      target: mapHostRef.current,
      layers: [baseLayer, bnpbLayer, vecLayer],
      view: new View({
        center: fromLonLat([lon, lat]),
        zoom: 9,
      }),
    })

    map.on('singleclick', (evt) => {
      const hit = map.forEachFeatureAtPixel(evt.pixel, (f) => f)
      if (hit && hit.get('metaTitle')) {
        setPickedInfo({
          title: hit.get('metaTitle'),
          badge: hit.get('metaBadge') || 'INFO',
          lines: hit.get('metaLines') || [],
        })
      } else {
        setPickedInfo(null)
      }
    })

    mapRef.current = map
    return () => {
      map.setTarget(undefined)
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon])

  // Update basemap
  useEffect(() => {
    if (!baseLayerRef.current) return
    baseLayerRef.current.setSource(getBaseSource(basemap))
  }, [basemap])

  // Update BNPB InaRISK layer
  useEffect(() => {
    const lyr = bnpbLayerRef.current
    if (!lyr) return
    if (!showInarisk) {
      lyr.setVisible(false)
      return
    }
    const bnpbId = TEMPLATE_BNPB_DEFAULT[template]
    const def = BNPB_LAYERS.find((x) => x.id === bnpbId) || BNPB_LAYERS[0]
    lyr.setSource(
      new ImageArcGISRest({
        url: def.url,
        ratio: 1,
        params: { F: 'image', FORMAT: 'PNG32', TRANSPARENT: true },
      }),
    )
    lyr.setOpacity(def.opacity)
    lyr.setVisible(true)
  }, [showInarisk, template])

  // Sync markers, circles, template layers, and OSRM route
  useEffect(() => {
    const src = vectorSourceRef.current
    if (!src || lat == null || lon == null) return
    src.clear()

    // 1. Radius Rings (50 km & 100 km)
    if (showRadius) {
      for (const [km, strokeColor, fillAlpha] of [
        [100, 'rgba(15,118,110,0.45)', 'rgba(15,118,110,0.03)'],
        [50, 'rgba(15,118,110,0.75)', 'rgba(15,118,110,0.06)'],
      ] as const) {
        const ring = circular([lon, lat], km * 1000, 64).transform('EPSG:4326', 'EPSG:3857')
        const f = new Feature({ geometry: ring })
        f.setStyle(
          new Style({
            stroke: new Stroke({ color: strokeColor, width: 1.5, lineDash: km === 100 ? [6, 4] : undefined }),
            fill: new Fill({ color: fillAlpha }),
          }),
        )
        src.addFeature(f)
      }
    }

    // 2. Template Hazard Features
    if (showHazardLayer) {
      if (template === 'gempa' && pendukung?.gempa?.catalog?.length) {
        for (const q of pendukung.gempa.catalog) {
          if (q.lat == null || q.lon == null) continue
          const f = new Feature({ geometry: new Point(fromLonLat([q.lon, q.lat])) })
          const r = Math.max(5, Math.min(16, q.mag * 2.2))
          f.setStyle(
            new Style({
              image: new CircleStyle({
                radius: r,
                fill: new Fill({ color: q.mag >= 5 ? 'rgba(220,38,38,0.65)' : 'rgba(249,115,22,0.55)' }),
                stroke: new Stroke({ color: '#ffffff', width: 1.5 }),
              }),
            }),
          )
          f.set('metaTitle', `Gempa M ${q.mag.toFixed(1)} (${q.source})`)
          f.set('metaBadge', 'SEISMIK')
          f.set('metaLines', [
            q.place,
            `Waktu: ${q.timeWib}`,
            `Kedalaman: ${q.depthKm} km · Jarak: ${q.distKm ?? '—'} km`,
            q.mmi ? `MMI: ${q.mmi}` : '',
          ].filter(Boolean))
          src.addFeature(f)
        }
      } else if (template === 'karhutla' && pendukung?.karhutla?.points150km?.length) {
        for (const h of pendukung.karhutla.points150km) {
          const f = new Feature({ geometry: new Point(fromLonLat([h.lon, h.lat])) })
          const isHigh = h.confidence === 'h' || h.confidence === 'high'
          f.setStyle(
            new Style({
              image: new CircleStyle({
                radius: isHigh ? 6.5 : 5,
                fill: new Fill({ color: isHigh ? '#dc2626' : '#f97316' }),
                stroke: new Stroke({ color: '#fef08a', width: 1.2 }),
              }),
            }),
          )
          f.set('metaTitle', `Hotspot ${h.satellite}`)
          f.set('metaBadge', `FIRMS · ${h.confidence.toUpperCase()}`)
          f.set('metaLines', [
            `FRP: ${h.frp} MW · Suhu BT4: ${h.bright} K`,
            `Jarak: ${h.distKm} km · Tanggal: ${h.acqDate}`,
          ])
          src.addFeature(f)
        }
      } else if (template === 'banjir') {
        for (const g of pendukung?.weather?.hujanGrid || []) {
          const f = new Feature({ geometry: new Point(fromLonLat([g.lon, g.lat])) })
          f.setStyle(
            new Style({
              image: new CircleStyle({
                radius: g.rainMm >= 30 ? 9 : g.rainMm >= 10 ? 7 : 5,
                fill: new Fill({ color: g.rainMm >= 30 ? 'rgba(3,105,161,0.75)' : 'rgba(56,189,248,0.55)' }),
                stroke: new Stroke({ color: '#ffffff', width: 1 }),
              }),
            }),
          )
          f.set('metaTitle', 'Kisi Curah Hujan (Open-Meteo)')
          f.set('metaBadge', 'HUJAN 3 HARI')
          f.set('metaLines', [`Akumulasi 3 hari: ${g.rainMm} mm`, `Koordinat: ${g.lat}, ${g.lon}`])
          src.addFeature(f)
        }
        for (const p of pendukung?.banjir?.petaBencana?.items || []) {
          const f = new Feature({ geometry: new Point(fromLonLat([p.lon, p.lat])) })
          f.setStyle(
            new Style({
              image: new CircleStyle({
                radius: 7,
                fill: new Fill({ color: '#0284c7' }),
                stroke: new Stroke({ color: '#ffffff', width: 2 }),
              }),
            }),
          )
          f.set('metaTitle', 'Laporan Warga (PetaBencana.id)')
          f.set('metaBadge', p.floodDepthCm ? `TMA ${p.floodDepthCm} CM` : 'GENANGAN')
          f.set('metaLines', [p.text, `${p.distKm} km · ${p.createdAt}`])
          src.addFeature(f)
        }
      }
    }

    // 3. Faskes (RS + PSC 119)
    if (showFaskes) {
      for (const rs of rsNearbyPoints) {
        const f = new Feature({ geometry: new Point(fromLonLat([rs.lon, rs.lat])) })
        f.setStyle(
          new Style({
            image: new CircleStyle({
              radius: 5.5,
              fill: new Fill({ color: '#0f766e' }),
              stroke: new Stroke({ color: '#ffffff', width: 1.5 }),
            }),
          }),
        )
        f.set('metaTitle', rs.nama)
        f.set('metaBadge', 'RS JEJARING')
        f.set('metaLines', [`Jarak lurus: ${rs.jarak_km} km`, `Koordinat: ${rs.lat.toFixed(4)}, ${rs.lon.toFixed(4)}`])
        src.addFeature(f)
      }
      for (const p of pscList) {
        if (p.lat == null || p.lon == null || !Number.isFinite(Number(p.lat))) continue
        const f = new Feature({ geometry: new Point(fromLonLat([Number(p.lon), Number(p.lat)])) })
        f.setStyle(
          new Style({
            image: new CircleStyle({
              radius: 7,
              fill: new Fill({ color: p.aktif ? '#059669' : '#64748b' }),
              stroke: new Stroke({ color: '#ffffff', width: 2 }),
            }),
          }),
        )
        f.set('metaTitle', p.nama || 'PSC 119')
        f.set('metaBadge', p.aktif ? 'PSC AKTIF' : 'PSC NON-AKTIF')
        f.set('metaLines', [
          `Ambulans siap: ${nf(p.siap)} / ${nf(p.ambulans)}`,
          p.jarak_km != null ? `Jarak lurus: ${p.jarak_km} km` : '',
        ].filter(Boolean))
        src.addFeature(f)
      }
    }

    // 4. OSRM Driving Route
    if (routeResult?.coordinates?.length) {
      const line = new LineString(routeResult.coordinates.map(([cLon, cLat]) => fromLonLat([cLon, cLat])))
      const rf = new Feature({ geometry: line })
      rf.setStyle(
        new Style({
          stroke: new Stroke({ color: '#2563eb', width: 4.5 }),
        }),
      )
      rf.set('metaTitle', `Rute Evakuasi → ${routeResult.targetName}`)
      rf.set('metaBadge', 'OSRM DARAT')
      rf.set('metaLines', [`Jarak tempuh: ${routeResult.distanceKm} km`, `Estimasi waktu: ±${routeResult.durationMin} menit`])
      src.addFeature(rf)
    }

    // 5. Center Disaster Pin (rendered last so it stays on top)
    const centerColor =
      template === 'gempa' ? '#be123c' : template === 'karhutla' ? '#ea580c' : template === 'banjir' ? '#0284c7' : '#00705a'
    const cFeat = new Feature({ geometry: new Point(fromLonLat([lon, lat])) })
    cFeat.setStyle(
      new Style({
        image: new CircleStyle({
          radius: 10,
          fill: new Fill({ color: centerColor }),
          stroke: new Stroke({ color: '#ffffff', width: 3 }),
        }),
        text: new OlText({
          text: kejadian.jenis || 'Kejadian',
          offsetY: -18,
          font: 'bold 11px sans-serif',
          fill: new Fill({ color: '#0f172a' }),
          stroke: new Stroke({ color: '#ffffff', width: 3 }),
        }),
      }),
    )
    cFeat.set('metaTitle', `${kejadian.jenis} — ${kejadian.kabupaten}`)
    cFeat.set('metaBadge', `UID: ${kejadian.uid}`)
    cFeat.set('metaLines', [
      `Provinsi: ${kejadian.provinsi || '—'}`,
      `Koordinat: ${lat.toFixed(4)}, ${lon.toFixed(4)}`,
    ])
    src.addFeature(cFeat)
  }, [lat, lon, showRadius, showFaskes, showHazardLayer, template, pendukung, pscList, rsNearbyPoints, routeResult, kejadian])

  const recenter = () => {
    if (!mapRef.current || lat == null || lon == null) return
    mapRef.current.getView().animate({ center: fromLonLat([lon, lat]), zoom: 9, duration: 350 })
  }

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-12" data-testid="kejadian-map-and-faskes">
      {/* Interactive OpenLayers Map */}
      <div className="skdr-card flex flex-col overflow-hidden p-4 lg:col-span-7">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#00705a]">
              <MapPin className="h-3.5 w-3.5" /> Peta Situasi Spasial & Rute Rujukan
            </div>
            <h3 className="text-sm font-black text-slate-900">
              Episentrum Kejadian, Jejaring RS/PSC 119 & Lapisan Bahaya {template.toUpperCase()}
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {(['osm', 'satellite', 'terrain'] as const).map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBasemap(b)}
                className={`rounded-lg border px-2 py-1 text-[10.5px] font-bold uppercase ${
                  basemap === b ? 'border-[#00705a] bg-teal-50 text-[#00705a]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {b === 'satellite' ? 'Satelit' : b === 'terrain' ? 'Medan' : 'OSM'}
              </button>
            ))}
            <button
              type="button"
              onClick={recenter}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
              title="Pusatkan ke koordinat kejadian"
            >
              <Crosshair className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Layer Checkboxes */}
        <div className="mb-2.5 flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-1.5 text-[11px] font-semibold text-slate-700">
          <label className="inline-flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={showFaskes} onChange={(e) => setShowFaskes(e.target.checked)} className="rounded text-[#00705a]" />
            <span>RS & PSC 119</span>
          </label>
          <label className="inline-flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={showHazardLayer} onChange={(e) => setShowHazardLayer(e.target.checked)} className="rounded text-[#00705a]" />
            <span>
              {template === 'gempa'
                ? 'Titik Gempa USGS/BMKG'
                : template === 'karhutla'
                ? 'Titik Panas FIRMS'
                : 'PetaBencana & Hujan'}
            </span>
          </label>
          <label className="inline-flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={showRadius} onChange={(e) => setShowRadius(e.target.checked)} className="rounded text-[#00705a]" />
            <span>Radius 50/100 km</span>
          </label>
          <label className="inline-flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={showInarisk} onChange={(e) => setShowInarisk(e.target.checked)} className="rounded text-[#00705a]" />
            <Layers className="h-3 w-3 text-slate-500" />
            <span>InaRISK BNPB</span>
          </label>
        </div>

        {/* Map Canvas */}
        <div className="relative h-[420px] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
          {lat != null && lon != null ? (
            <div ref={mapHostRef} className="h-full w-full" data-testid="ol-kejadian-map" />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-xs text-slate-500">
              Koordinat kejadian belum tersedia dari API EOC sehingga peta spasial belum dapat dipusatkan.
            </div>
          )}

          {/* Picked Marker Info Popup */}
          {pickedInfo ? (
            <div className="absolute bottom-3 left-3 z-10 max-w-xs rounded-xl border border-slate-200 bg-white/95 p-3 text-xs shadow-lg backdrop-blur">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[9.5px] font-black text-white">{pickedInfo.badge}</span>
                  <div className="mt-1 font-black text-slate-900">{pickedInfo.title}</div>
                </div>
                <button type="button" onClick={() => setPickedInfo(null)} className="rounded p-0.5 text-slate-400 hover:bg-slate-100">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <ul className="mt-1.5 space-y-0.5 text-[11px] text-slate-600">
                {pickedInfo.lines.map((l, idx) => (
                  <li key={idx}>{l}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Active OSRM Route Banner */}
          {routeResult ? (
            <div className="absolute right-3 top-3 z-10 max-w-xs rounded-xl border border-blue-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 font-black text-blue-800">
                  <Route className="h-3.5 w-3.5" /> Rute OSRM Aktif
                </div>
                <button type="button" onClick={() => setRouteResult(null)} className="text-[10px] font-bold text-slate-400 hover:text-slate-800">
                  Hapus
                </button>
              </div>
              <p className="mt-0.5 font-semibold text-slate-800">{routeResult.targetName}</p>
              <p className="font-mono text-[11px] text-blue-700">
                {routeResult.distanceKm} km · ±{routeResult.durationMin} menit
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Right Column: Nearby PSC 119, Ambulans & RS Jejaring Directory + OSRM Route Trigger */}
      <div className="skdr-card flex flex-col justify-between p-4 lg:col-span-5">
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#00705a]">
                <Hospital className="h-3.5 w-3.5" /> Jejaring Rujukan & Gawat Darurat (≤ 80 km)
              </div>
              <h3 className="text-sm font-black text-slate-900">PSC 119, Ambulans & RS Sekitar Kota</h3>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-2">
              <div className="text-[9.5px] font-bold uppercase text-emerald-800">PSC Aktif</div>
              <div className="text-base font-black text-emerald-950">
                {nearby?.psc?.tersedia ? `${nf(nearby.psc.aktif)}/${nf(nearby.psc.total)}` : '—'}
              </div>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-2">
              <div className="text-[9.5px] font-bold uppercase text-amber-800">Ambulans Siap</div>
              <div className="text-base font-black text-amber-950">
                {nearby?.ambulans?.tersedia ? `${nf(nearby.ambulans.siap)}/${nf(nearby.ambulans.total)}` : '—'}
              </div>
            </div>
            <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-2">
              <div className="text-[9.5px] font-bold uppercase text-teal-800">Titik RS (50 km)</div>
              <div className="text-base font-black text-teal-950">
                {nearby?.rs?.tersedia ? nf(nearby.rs.total) : '—'}
              </div>
            </div>
          </div>

          {routeError ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-900">
              {routeError}
            </div>
          ) : null}

          {/* Scrollable List of PSC + Nearest RS */}
          <div className="max-h-[295px] space-y-2 overflow-y-auto pr-1">
            {pscList.map((p, i) => {
              const hasCoord = Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lon))
              const rowKey = `psc-${i}`
              return (
                <div key={rowKey} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <PhoneCall className="h-3 w-3 shrink-0 text-emerald-700" />
                      <span className="truncate font-bold text-slate-900">{p.nama}</span>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-black uppercase ${p.aktif ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                        {p.aktif ? 'Aktif' : 'Off'}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10.5px] text-slate-500">
                      <span className="inline-flex items-center gap-1"><Ambulance className="h-3 w-3" /> {nf(p.siap)}/{nf(p.ambulans)} siap</span>
                      <span>Jarak lurus: <b>{p.jarak_km != null ? `${p.jarak_km} km` : '—'}</b></span>
                    </div>
                  </div>
                  {hasCoord && lat != null && lon != null ? (
                    <button
                      type="button"
                      onClick={() => computeRoute(Number(p.lat), Number(p.lon), p.nama, 'PSC 119', rowKey)}
                      disabled={routeLoadingId === rowKey}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10.5px] font-bold text-blue-800 hover:bg-blue-100 disabled:opacity-50"
                    >
                      <Navigation className="h-3 w-3" />
                      {routeLoadingId === rowKey ? '...' : 'Rute'}
                    </button>
                  ) : null}
                </div>
              )
            })}

            {rsNearbyPoints.slice(0, 6).map((rs) => (
              <div key={rs.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Hospital className="h-3 w-3 shrink-0 text-teal-700" />
                    <span className="truncate font-bold text-slate-800">{rs.nama}</span>
                  </div>
                  <div className="mt-0.5 text-[10.5px] text-slate-500">
                    Jarak lurus: <b>{rs.jarak_km} km</b> · Titik koordinat API PSC
                  </div>
                </div>
                {lat != null && lon != null ? (
                  <button
                    type="button"
                    onClick={() => computeRoute(rs.lat, rs.lon, rs.nama, 'RS Jejaring', rs.id)}
                    disabled={routeLoadingId === rs.id}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10.5px] font-bold text-blue-800 hover:bg-blue-100 disabled:opacity-50"
                  >
                    <Navigation className="h-3 w-3" />
                    {routeLoadingId === rs.id ? '...' : 'Rute'}
                  </button>
                ) : null}
              </div>
            ))}

            {!pscList.length && !rsNearbyPoints.length ? (
              <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-[11px] text-slate-500">
                Belum ada titik PSC 119 / RS jejaring dalam radius 50–80 km dari API PSC Kemkes.
              </p>
            ) : null}
          </div>
        </div>

        <p className="mt-2 text-[10px] text-slate-400">
          Rute darat dihitung real-time via Open Source Routing Machine (OSRM). Titik RS menampilkan lokasi koordinat jejaring resmi tanpa mempublikasikan data sensitif pasien.
        </p>
      </div>
    </section>
  )
}
