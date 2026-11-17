'use client'

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import InfoHint from '@/components/puskris/InfoHint'
import type { MatriksCol, MatriksDef, MatriksRow } from '@/lib/puskris/matriks'

export function fmtMatriks(v: any, fmt: MatriksCol['fmt'] = 'int'): string {
  if (v == null || v === '') return '—'
  if (fmt === 'text') return String(v)
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  if (fmt === 'pct') return `${n.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
  if (fmt === 'dec1') return n.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return Math.round(n).toLocaleString('id-ID')
}

export function totalFor(c: MatriksCol, rows: any[]): number | string | null {
  if (c.total) return c.total(rows)
  if ((c.fmt || 'int') !== 'int') return null
  return rows.reduce((a, r) => a + (Number(r[c.key]) || 0), 0)
}

/** Nilai CSV mentah untuk satu matriks generik. */
export function matriksCsv(def: MatriksDef, rows: MatriksRow[]): { headers: string[]; rows: string[][] } {
  const q = (s: any) => `"${String(s ?? '').replace(/"/g, '""')}"`
  const val = (v: any, c: MatriksCol) => (v == null ? '' : c.fmt === 'text' ? q(v) : c.fmt === 'int' ? String(Math.round(Number(v) || 0)) : (Number(v) || 0).toFixed(2))
  const headers = ['No', def.rowLabel, ...(def.provinsiRows ? ['Kode'] : []), ...def.cols.map((c) => q(c.group ? `${c.group} - ${c.label}` : c.label))]
  const body = rows.map((r, i) => [String(i + 1), q(r.label), ...(def.provinsiRows ? [r.code || ''] : []), ...def.cols.map((c) => val(r[c.key], c))])
  body.push(['', q('TOTAL'), ...(def.provinsiRows ? [''] : []), ...def.cols.map((c) => { const t = totalFor(c, rows); return t == null ? '' : val(t, c) })])
  return { headers, rows: body }
}

export default function MatriksHeatTable({
  def, rows, allRows, sortField, sortOrder, onSort, onRowClick, startNo = 1,
}: {
  def: MatriksDef
  rows: MatriksRow[]
  /** baris terfilter (seluruh halaman) untuk total & skala warna */
  allRows: MatriksRow[]
  sortField: string
  sortOrder: 'asc' | 'desc'
  onSort: (k: string) => void
  onRowClick?: (r: MatriksRow) => void
  startNo?: number
}) {
  const max: Record<string, number> = {}
  const min: Record<string, number> = {}
  for (const c of def.cols)
    if (c.heat) {
      const vals = allRows.map((r) => Number(r[c.key]) || 0).filter((v) => v > 0)
      max[c.key] = vals.length ? Math.max(...vals) : 0
      min[c.key] = vals.length > 1 ? Math.min(...vals) : 0
    }
  const groups: { label: string; span: number }[] = []
  for (const c of def.cols) {
    const g = c.group || ''
    if (groups.length && groups[groups.length - 1].label === g) groups[groups.length - 1].span++
    else groups.push({ label: g, span: 1 })
  }
  const hasGroups = groups.some((g) => g.label)
  const SortIcon = ({ k }: { k: string }) =>
    sortField !== k ? <ArrowUpDown className="h-3 w-3 shrink-0 text-slate-300" /> : sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 shrink-0 text-primary" /> : <ArrowDown className="h-3 w-3 shrink-0 text-primary" />
  const heatStyle = (c: MatriksCol, v: any) => {
    if (!c.heat) return undefined
    const m = max[c.key] || 0
    const n = Number(v) || 0
    if (m <= 0 || n <= 0) return undefined
    const lo = min[c.key] < m ? min[c.key] : 0
    const a = 0.06 + 0.64 * ((n - lo) / (m - lo || 1))
    return { backgroundColor: `rgba(22,179,172,${a.toFixed(3)})`, color: a > 0.5 ? '#fff' : undefined }
  }
  return (
    <table className="w-full border-separate border-spacing-0 text-left text-xs" data-testid={`matriks-${def.id}-table`}>
      <thead className="sticky top-0 z-10 bg-slate-50 text-[10.5px] font-bold uppercase tracking-wide text-slate-600">
        {hasGroups ? (
          <tr>
            <th colSpan={2} className="border-b border-slate-200 bg-slate-50 px-2 py-1" />
            {groups.map((g, i) => (
              <th key={i} colSpan={g.span} className={`border-b border-l border-slate-200 px-2 py-1 text-center text-[10px] normal-case tracking-normal ${g.label ? 'bg-teal-50 text-[#0D6B67]' : 'bg-slate-50'}`}>
                {g.label}
              </th>
            ))}
          </tr>
        ) : null}
        <tr>
          <th className="w-8 border-b border-slate-200 bg-slate-50 px-2 py-2 text-center">#</th>
          <th className="sticky left-0 z-10 min-w-[150px] cursor-pointer border-b border-slate-200 bg-slate-50 px-2.5 py-2 hover:text-primary" onClick={() => onSort('label')}>
            <div className="flex items-center gap-1">
              <span>{def.rowLabel}</span>
              {def.rowHint ? <span onClick={(e) => e.stopPropagation()}><InfoHint text={def.rowHint} /></span> : null}
              <SortIcon k="label" />
            </div>
          </th>
          {def.cols.map((c) => (
            <th key={c.key} className="cursor-pointer border-b border-l border-slate-200 px-2 py-2 text-right align-bottom hover:text-primary" onClick={() => onSort(c.key)}>
              <div className="flex items-end justify-end gap-1">
                <span className="max-w-[110px] whitespace-normal text-right leading-tight">{c.label}</span>
                {c.hint ? <span onClick={(e) => e.stopPropagation()}><InfoHint text={c.hint} /></span> : null}
                <SortIcon k={c.key} />
              </div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={def.cols.length + 2} className="py-12 text-center text-slate-500">{def.kosong || "Tidak ada data yang cocok dengan filter."}</td>
          </tr>
        ) : (
          rows.map((r, i) => (
            <tr key={r.id} className={`group ${onRowClick ? 'cursor-pointer' : ''}`} onClick={onRowClick ? () => onRowClick(r) : undefined}>
              <td className="border-b border-slate-100 px-2 py-1.5 text-center font-bold text-slate-400">{startNo + i}</td>
              <td className="sticky left-0 border-b border-slate-100 bg-white px-2.5 py-1.5 group-hover:bg-slate-50">
                <div className="font-bold text-slate-900">{r.label}</div>
                {r.sub ? <div className="text-[10px] text-slate-400">{r.sub}</div> : null}
              </td>
              {def.cols.map((c) => (
                <td key={c.key} className={`border-b border-l border-slate-100 px-2 py-1.5 tabular-nums ${c.fmt === 'text' ? 'text-left text-slate-600' : 'text-right font-semibold text-slate-800'}`} style={heatStyle(c, r[c.key])}>
                  {c.fmt === 'int' && !Number(r[c.key]) ? <span className="font-normal text-slate-300">0</span> : fmtMatriks(r[c.key], c.fmt)}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
      {allRows.length ? (
        <tfoot>
          <tr className="bg-slate-100 font-black text-slate-900">
            <td className="border-t-2 border-slate-300 px-2 py-2" />
            <td className="sticky left-0 border-t-2 border-slate-300 bg-slate-100 px-2.5 py-2 uppercase">Total ({allRows.length})</td>
            {def.cols.map((c) => (
              <td key={c.key} className="border-l border-t-2 border-slate-200 border-t-slate-300 px-2 py-2 text-right tabular-nums">
                {fmtMatriks(totalFor(c, allRows), c.fmt)}
              </td>
            ))}
          </tr>
        </tfoot>
      ) : null}
    </table>
  )
}
