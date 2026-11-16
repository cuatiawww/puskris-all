'use client'
// Grid heatmap bergaya TrendHeatmap / ZoonosisLiteHeatmap (SKDR): sel berwarna, legenda, tooltip, sumbu lengket.
import { useMemo, useState, type MouseEvent } from 'react'
import { Grid3x3 } from 'lucide-react'
import { fmt, shade } from '@/lib/analytics-api'
import { CONTOH_LABEL } from '@/lib/puskris/integrasi'
import { buildHeatView, HEAT_OPTIONS, type HeatRow, type HeatView } from '@/lib/puskris/heatmap'
import type { ProvinceRow } from '@/lib/puskris/types'
import type { PuskrisUiFilter } from '@/lib/puskris/ui-filter'
import SectionHead from '@/components/puskris/SectionHead'

const TOP_N = 16

function steps(max: number) {
  const out: { lo: number; hi: number; v: number }[] = []
  for (let k = 0; k < 5; k++) {
    const lo = k === 0 ? 1 : Math.ceil(max * (k / 4.999) ** 2)
    const hi = k === 4 ? max : Math.ceil(max * ((k + 1) / 4.999) ** 2) - 1
    if (max > 0 && lo <= hi && !out.some((s) => s.lo === lo)) out.push({ lo, hi, v: lo })
  }
  return out
}

function cellColor(value: number | null, max: number, scale: 'count' | 'gap') {
  if (value == null) return 'transparent'
  if (!value || max <= 0) return '#f1f5f9'
  return shade(value, max, scale === 'gap' ? 'pe' : 'ebs')
}

export default function PuskrisHeatmap({
  raw, rows, kejadian, nccDays, filter,
}: {
  raw: any
  rows: ProvinceRow[]
  kejadian: any[]
  nccDays: { date: string; cof: number; available?: boolean }[]
  filter: PuskrisUiFilter
}) {
  const [mode, setMode] = useState(HEAT_OPTIONS[0].id)
  const [all, setAll] = useState(false)
  const [hover, setHover] = useState<{ row: HeatRow; i: number; x: number; y: number } | null>(null)

  const view: HeatView = useMemo(
    () => buildHeatView(mode, { raw, rows, kejadian, nccDays, filterProvinsi: filter.provinsi }),
    [mode, raw, rows, kejadian, nccDays, filter.provinsi],
  )

  const max = Math.max(0, ...view.rows.flatMap((r) => r.cells.map((c) => c.value || 0)))
  const shown = all || view.rows.length <= TOP_N ? view.rows : view.rows.slice(0, TOP_N)
  const narrow = view.cols.length <= 12
  const hue = view.scale === 'gap' ? 'pe' : 'ebs'

  const onMove = (row: HeatRow, i: number) => (e: MouseEvent) => setHover({ row, i, x: e.clientX, y: e.clientY })

  return (
    <section className="skdr-section" data-testid="puskris-heatmap">
      <SectionHead
        eyebrow="Analisis spasial-waktu"
        title="Heatmap dinamik"
        desc="Pilih tampilan matriks. Warna dan isi mengikuti filter di panel kiri."
        actions={
          <label className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
            <span className="sr-only">Pilih tampilan heatmap</span>
            <select
              value={mode}
              onChange={(e) => { setMode(e.target.value); setAll(false); setHover(null) }}
              className="max-w-[min(100%,28rem)] rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-700 shadow-sm focus:border-brand-400 focus:outline-none"
            >
              {HEAT_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
        }
      />
      <div className="skdr-card relative p-3 sm:p-4">
        <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="flex items-center gap-1.5 text-sm font-black text-slate-900">
              <Grid3x3 className="h-4 w-4 text-primary" />{view.title}
            </h3>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{view.desc}</p>
          </div>
          {view.contoh ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">{CONTOH_LABEL}</span> : null}
        </div>

        {!view.rows.length || !view.cols.length ? (
          <p className="py-8 text-center text-sm text-slate-500">Tidak ada data untuk filter ini.</p>
        ) : (
          <>
            <div className="overflow-x-auto" onMouseLeave={() => setHover(null)}>
              <table className="w-full border-separate text-[11px]" style={{ borderSpacing: 2 }} data-testid="puskris-heat-table">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 min-w-[130px] bg-card text-left font-semibold text-slate-500">{view.rowLabel}</th>
                    {view.cols.map((c) => (
                      <th key={c.id} className={`whitespace-nowrap px-0 text-center font-normal text-slate-400 ${narrow ? 'min-w-[52px]' : 'min-w-[16px]'}`} title={c.title || c.label}>
                        {c.label}
                      </th>
                    ))}
                    <th className="pl-2 text-right font-semibold text-slate-500">{view.scale === 'gap' ? 'Rata-rata' : 'Jumlah'}</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.id}>
                      <td className="sticky left-0 z-10 max-w-[200px] truncate bg-card pr-2 font-semibold text-slate-700" title={r.name}>{r.name}</td>
                      {r.cells.map((cell, i) => {
                        const on = hover?.row.id === r.id && hover.i === i
                        const missing = cell.value == null
                        return (
                          <td
                            key={view.cols[i].id}
                            aria-label={`${r.name}, ${view.cols[i].title || view.cols[i].label}: ${missing ? 'tidak ada data' : fmt(cell.value)}`}
                            onMouseMove={onMove(r, i)}
                            className={`h-5 cursor-crosshair rounded-sm ${on ? 'outline outline-2 outline-slate-700' : ''} ${missing ? 'border border-dashed border-slate-200' : ''}`}
                            style={{
                              background: missing
                                ? 'repeating-linear-gradient(135deg, #f8fafc, #f8fafc 3px, #e2e8f0 3px, #e2e8f0 6px)'
                                : cellColor(cell.value, max, view.scale),
                            }}
                          />
                        )
                      })}
                      <td className="pl-2 text-right font-mono text-slate-600">{fmt(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] text-slate-500">
              <span className="inline-flex flex-wrap items-center gap-1.5">
                <span className="font-semibold text-slate-600">{view.unit}</span>
                <span className="inline-flex items-center gap-0.5">
                  <span className="h-3 w-5 rounded-sm border border-slate-200" style={{ background: '#f1f5f9' }} title="0" />
                  {steps(max).map((s) => (
                    <span key={s.lo} className="h-3 w-5 rounded-sm" style={{ background: shade(s.v, max, hue) }} title={s.lo === s.hi ? fmt(s.lo) : `${fmt(s.lo)}–${fmt(s.hi)}`} />
                  ))}
                </span>
                <span className="tabular-nums">0 – {fmt(max)}</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-3 w-5 rounded-sm border border-dashed border-slate-200" style={{ background: 'repeating-linear-gradient(135deg, #f8fafc, #f8fafc 3px, #e2e8f0 3px, #e2e8f0 6px)' }} />
                Tidak ada data
              </span>
              {view.rows.length > TOP_N ? (
                <button type="button" onClick={() => setAll((x) => !x)} className="font-bold text-primary hover:underline">
                  {all ? `Tampilkan ${TOP_N} teratas` : `Tampilkan semua (${view.rows.length})`}
                </button>
              ) : null}
            </div>
          </>
        )}

        {hover ? (() => {
          const col = view.cols[hover.i]
          const cell = hover.row.cells[hover.i]
          const left = typeof window !== 'undefined' && hover.x > window.innerWidth - 240 ? hover.x - 228 : hover.x + 14
          return (
            <div
              role="tooltip"
              className="pointer-events-none fixed z-50 w-[214px] rounded-lg border border-slate-200 bg-white/95 px-2.5 py-2 text-[11px] shadow-lg backdrop-blur"
              style={{ left, top: hover.y + 14 }}
            >
              <div className="truncate text-xs font-black text-slate-900">{hover.row.name}</div>
              <div className="text-slate-500">{col.title || col.label}</div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span>{view.unit}</span>
                <b className="tabular-nums text-slate-900">{cell.value == null ? 'Tidak ada data' : fmt(cell.value)}</b>
              </div>
              {cell.contoh ? <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">{CONTOH_LABEL}</div> : null}
            </div>
          )
        })() : null}
      </div>
    </section>
  )
}
