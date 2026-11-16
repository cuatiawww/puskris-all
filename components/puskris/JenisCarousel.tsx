'use client'
// Mekanika disalin dari DiseaseCarousel (SKDR): auto-scroll 30 px/s, jeda saat hover,
// loop, drag, serta tombol prev/next/jeda di kanan atas.
import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import JenisCard from '@/components/puskris/JenisCard'
import type { JenisCardModel } from '@/lib/puskris/to-spasial'

const SPEED = 30

export default function JenisCarousel({
  items, selected, onSelect,
}: {
  items: JenisCardModel[]
  selected: string | null
  onSelect: (nama: string | null) => void
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)
  const hover = useRef(false)
  const dragging = useRef(false)

  useEffect(() => {
    const el = scroller.current
    if (!el || items.length < 2) return
    let raf = 0, last = 0
    const tick = (now: number) => {
      if (!last) last = now
      const dt = Math.min(48, now - last); last = now
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const hidden = document.visibilityState === 'hidden'
      if (!paused && !hover.current && !dragging.current && !reduced && !hidden) {
        el.scrollLeft += SPEED * (dt / 1000)
        const half = el.scrollWidth / 2
        if (half > 0 && el.scrollLeft >= half) el.scrollLeft -= half
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [items, paused])

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    let startX = 0, startLeft = 0, moved = false
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      dragging.current = true
      moved = false
      startX = e.clientX
      startLeft = el.scrollLeft
      el.setPointerCapture(e.pointerId)
    }
    const move = (e: PointerEvent) => {
      if (!dragging.current) return
      const dx = e.clientX - startX
      if (Math.abs(dx) > 4) moved = true
      el.scrollLeft = startLeft - dx
    }
    const up = () => { dragging.current = false }
    const click = (e: MouseEvent) => { if (moved) { e.preventDefault(); e.stopPropagation() } }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('click', click, true)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      el.removeEventListener('click', click, true)
    }
  }, [items])

  const step = (dir: -1 | 1) => {
    const el = scroller.current
    if (!el) return
    const card = el.querySelector<HTMLElement>(':scope > *')
    const w = (card?.offsetWidth ?? 280) + 16
    el.scrollBy({ left: dir * w, behavior: 'smooth' })
  }

  const list = items.length > 1 ? [...items, ...items] : items

  return (
    <section className="skdr-section" aria-labelledby="jenis-carousel-title">
      <div className="skdr-section-head flex items-end justify-between gap-2">
        <div>
          <div className="skdr-eyebrow">Kejadian dipantau</div>
          <h2 id="jenis-carousel-title" className="skdr-section-title">Ringkasan per jenis kejadian</h2>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => step(-1)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label="Geser ke kiri">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setPaused((p) => !p)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label={paused ? 'Putar otomatis' : 'Jeda'}>
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
          <button type="button" onClick={() => step(1)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label="Geser ke kanan">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        ref={scroller}
        onMouseEnter={() => { hover.current = true }}
        onMouseLeave={() => { hover.current = false }}
        onFocus={() => { hover.current = true }}
        onBlur={() => { hover.current = false }}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        tabIndex={0}
      >
        {list.map((c, i) => (
          <JenisCard
            key={`${c.nama}-${i}`}
            card={c}
            selected={selected === c.nama}
            onSelect={(nama) => onSelect(selected === nama ? null : nama)}
          />
        ))}
      </div>
    </section>
  )
}
