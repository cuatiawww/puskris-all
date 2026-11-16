'use client'

import { useEffect, useMemo, useRef } from 'react'
import OlMap from 'ol/Map'
import View from 'ol/View'
import { defaults as defaultControls } from 'ol/control'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import OSM from 'ol/source/OSM'
import GeoJSON from 'ol/format/GeoJSON'
import { Fill, Stroke, Style, Text } from 'ol/style'
import { fromLonLat } from 'ol/proj'
import type { FeatureLike } from 'ol/Feature'
import 'ol/ol.css'
import type { ProvinceRow } from '@/lib/puskris/types'
import { layerValue, nf } from '@/lib/puskris/derive'

const RISK = ['#288034', '#3CC14E', '#BBED56', '#FFCC14', '#FF8806', '#FF6A38', '#F02D2D', '#D50B0B']
const TEAL = ['#E1FBFA', '#B8EDEA', '#80DCD8', '#16B3AC', '#128F8A', '#0D6B67', '#094845']
const DIVERGE = ['#288034', '#3CC14E', '#BBED56', '#F1F2F3', '#FFCC14', '#FF6A38', '#F02D2D']

function colorFor(value: number, min: number, max: number, mode: 'risk' | 'teal' | 'diverge') {
  if (mode === 'diverge') {
    const abs = Math.max(Math.abs(min), Math.abs(max), 0.01)
    const t = (value + abs) / (2 * abs)
    const i = Math.min(DIVERGE.length - 1, Math.max(0, Math.floor(t * DIVERGE.length)))
    return DIVERGE[i]
  }
  const palette = mode === 'risk' ? RISK : TEAL
  if (max <= min) return palette[0]
  const t = Math.sqrt((value - min) / (max - min))
  const i = Math.min(palette.length - 1, Math.max(0, Math.floor(t * palette.length)))
  return palette[i]
}

function codeOf(f: FeatureLike): string {
  const p = f.getProperties() || {}
  return String(p.id_provinsi || p.kode || p.code || '').padStart(2, '0')
}

function nameOf(f: FeatureLike): string {
  const p = f.getProperties() || {}
  return String(p.provinsi || p.nama || '')
}

export default function PuskrisDualMap({
  title,
  rows,
  layer,
  layers,
  selected,
  onSelect,
  onLayer,
  tooltip,
  mode = 'risk',
}: {
  title: string
  rows: ProvinceRow[]
  layer: string
  layers: { id: string; label: string }[]
  selected: string | null
  onSelect: (code: string | null) => void
  onLayer: (id: string) => void
  tooltip?: string
  mode?: 'risk' | 'teal' | 'diverge'
}) {
  const host = useRef<HTMLDivElement>(null)
  const mapRef = useRef<OlMap | null>(null)
  const vecRef = useRef<VectorLayer<VectorSource> | null>(null)
  const rowsRef = useRef(rows)
  const layerRef = useRef(layer)
  const selectedRef = useRef(selected)
  const modeRef = useRef(mode)
  rowsRef.current = rows
  layerRef.current = layer
  selectedRef.current = selected
  modeRef.current = layer === 'kesenjangan' ? 'diverge' : mode

  const byCode = useMemo(() => Object.fromEntries(rows.map((r) => [r.code, r])), [rows])
  const vals = rows.map((r) => layerValue(r, layer))
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const label = layers.find((l) => l.id === layer)?.label || layer

  useEffect(() => {
    if (!host.current || mapRef.current) return
    const source = new VectorSource({
      url: '/data/indonesia-38-provinces.geojson',
      format: new GeoJSON(),
    })
    const vector = new VectorLayer({
      source,
      style: (feature) => {
        const code = codeOf(feature)
        const row = rowsRef.current.find((r) => r.code === code)
        const v = row ? layerValue(row, layerRef.current) : 0
        const numbers = rowsRef.current.map((r) => layerValue(r, layerRef.current))
        const mn = Math.min(...numbers)
        const mx = Math.max(...numbers)
        const md = layerRef.current === 'kesenjangan' ? 'diverge' : modeRef.current
        const fill = colorFor(v, mn, mx, md)
        const isSel = selectedRef.current === code
        return new Style({
          fill: new Fill({ color: fill + (isSel ? 'F2' : 'CC') }),
          stroke: new Stroke({ color: isSel ? '#0D6B67' : '#ffffff', width: isSel ? 2.4 : 0.8 }),
          text: new Text({
            text: isSel ? (row?.nama || nameOf(feature)) : '',
            font: '600 11px Manrope, sans-serif',
            fill: new Fill({ color: '#141313' }),
            stroke: new Stroke({ color: '#ffffff', width: 3 }),
          }),
        })
      },
    })
    const map = new OlMap({
      target: host.current,
      layers: [
        new TileLayer({ source: new OSM({ attributions: '© OpenStreetMap' }) }),
        vector,
      ],
      view: new View({ center: fromLonLat([118, -2.5]), zoom: 4.4 }),
      controls: defaultControls({ zoom: true, rotate: false, attribution: false }),
    })
    map.on('singleclick', (ev) => {
      const hit = map.forEachFeatureAtPixel(ev.pixel, (f) => f)
      if (!hit) {
        onSelect(null)
        return
      }
      const code = codeOf(hit)
      onSelect(selectedRef.current === code ? null : code)
    })
    map.on('pointermove', (ev) => {
      const hit = map.forEachFeatureAtPixel(ev.pixel, (f) => f)
      map.getTargetElement().style.cursor = hit ? 'pointer' : ''
    })
    mapRef.current = map
    vecRef.current = vector
    return () => {
      map.setTarget(undefined)
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    vecRef.current?.changed()
    vecRef.current?.getSource()?.changed()
  }, [rows, layer, selected, mode])

  const legendSteps = layer === 'kesenjangan' ? DIVERGE : mode === 'risk' ? RISK : TEAL

  return (
    <div className="skdr-card flex min-h-[420px] flex-col overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <div>
          <div className="text-sm font-extrabold text-slate-800">{title}</div>
          <div className="text-[11px] text-slate-500">{label}{tooltip ? ' · ' : ''}{tooltip}</div>
        </div>
        <select
          className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 outline-none hover:border-brand-300"
          value={layer}
          onChange={(e) => onLayer(e.target.value)}
        >
          {layers.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
      </div>
      <div ref={host} className="relative min-h-[320px] flex-1" />
      <div className="flex items-center gap-2 border-t border-line px-3 py-2 text-[10px] text-slate-500">
        <span className="font-bold tabular-nums">{layer === 'kesenjangan' ? min.toFixed(2) : nf(min)}</span>
        <div className="flex h-2 flex-1 overflow-hidden rounded-full">
          {legendSteps.map((c) => <div key={c} className="h-full flex-1" style={{ background: c }} />)}
        </div>
        <span className="font-bold tabular-nums">{layer === 'kesenjangan' ? max.toFixed(2) : nf(max)}</span>
        {selected && byCode[selected] ? (
          <span className="ml-auto font-semibold text-brand-700">{byCode[selected].nama}: {layer === 'kesenjangan' ? byCode[selected].kesenjangan.toFixed(2) : nf(layerValue(byCode[selected], layer))}</span>
        ) : null}
      </div>
    </div>
  )
}
