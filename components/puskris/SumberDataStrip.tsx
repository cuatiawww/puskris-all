'use client'

import { RefreshCw } from 'lucide-react'

const LABEL: Record<string, string> = {
  psc: 'PSC 119 & Ambulans',
  panggilan: 'Panggilan PSC 119',
  asistensi: 'Asistensi Risiko',
  eoc: 'Krisis Kesehatan',
  ncc: 'Panggilan 119 Nasional',
  tck: 'Tenaga Cadangan',
  logistik: 'Logistik',
}
const ORDER = ['psc', 'panggilan', 'asistensi', 'eoc', 'ncc', 'tck', 'logistik']

/** Penanda sumber tiap blok data: "langsung" (API resmi) atau "snapshot" (berkas tersimpan). */
export default function SumberDataStrip({ status, pending, compact = false }: { status?: Record<string, any> | null; pending?: boolean; compact?: boolean }) {
  if (!status) return null
  return (
    <div className={`flex flex-wrap items-center gap-1.5 text-[10.5px] ${compact ? '' : 'mb-3'}`} data-testid="sumber-data-strip">
      <span className="font-bold uppercase tracking-wider text-slate-400">Sumber data</span>
      {ORDER.filter((k) => status[k]).map((k) => {
        const s = status[k]
        const live = s.status === 'langsung'
        const tip = [live ? 'Diambil langsung dari API resmi' : 'Memakai snapshot tersimpan', s.at ? `per ${s.at}` : null, s.error ? `(${s.error})` : null].filter(Boolean).join(' ')
        return (
          <span
            key={k}
            title={tip}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold ${live ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {LABEL[k] || k}: {live ? 'langsung' : 'snapshot'}
            {s.pending ? <RefreshCw className="h-3 w-3 animate-spin" aria-label="sedang memuat" /> : null}
          </span>
        )
      })}
      {pending ? <span className="text-slate-400">Sebagian data langsung sedang diambil, halaman diperbarui otomatis.</span> : null}
    </div>
  )
}
