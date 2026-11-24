'use client'

import { useEffect, useRef } from 'react'
import OlMap from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import OSM from 'ol/source/OSM'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import { Icon, Style } from 'ol/style'
import { fromLonLat } from 'ol/proj'
import 'ol/ol.css'

export default function KejadianMiniMap({ lat, lon, iconSrc, approx }: { lat: number; lon: number; iconSrc?: string; approx?: boolean }) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<OlMap | null>(null)

  useEffect(() => {
    if (!el.current || map.current) return
    const src = new VectorSource()
    const layer = new VectorLayer({
      source: src,
      style: iconSrc
        ? new Style({ image: new Icon({ src: iconSrc, width: 28, height: 36, anchor: [0.5, 1] }) })
        : undefined,
      zIndex: 4,
    })
    const m = new OlMap({
      target: el.current,
      layers: [
        new TileLayer({ source: new OSM(), zIndex: 0 }),
        layer,
      ],
      view: new View({ center: fromLonLat([lon, lat]), zoom: approx ? 8 : 10, minZoom: 4, maxZoom: 16 }),
      controls: [],
    })
    const f = new Feature({ geometry: new Point(fromLonLat([lon, lat])) })
    src.addFeature(f)
    map.current = m
    const ro = new ResizeObserver(() => m.updateSize())
    ro.observe(el.current)
    return () => { ro.disconnect(); m.setTarget(undefined); map.current = null }
  }, [lat, lon, iconSrc, approx])

  return <div ref={el} className="h-full w-full rounded-xl" data-testid="kejadian-minimap" />
}