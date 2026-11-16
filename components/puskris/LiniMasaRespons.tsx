'use client'

import { ComposedChart, Bar, Line, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TimelinePoint } from '@/lib/puskris/integrasi'
import SectionHead from '@/components/puskris/SectionHead'

export default function LiniMasaRespons({ rows, catatan, compact = false }: { rows: TimelinePoint[]; catatan: string; compact?: boolean }) {
  const chart = (
      <div className={compact ? "h-44" : "h-64"}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend />
            <Bar yAxisId="right" dataKey="kejadian" name="Kejadian" fill="#0F6E64" barSize={14} />
            <Bar yAxisId="right" dataKey="meninggal" name="Meninggal" fill="#be123c" barSize={8} />
            <Bar yAxisId="right" dataKey="pengungsi" name="Pengungsi" fill="#d97706" barSize={8} />
            <Line yAxisId="left" type="monotone" dataKey="panggilan" name="Panggilan 119" stroke="#2563eb" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
  )
  if (compact) {
    return (
      <div className="skdr-card flex h-full flex-col p-3" data-testid="lini-masa-respons">
        <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-700">Lini masa respons</h3>
        <p className="mb-1 line-clamp-2 text-[10px] text-slate-500">{catatan}</p>
        {chart}
      </div>
    )
  }
  return (
    <section className="skdr-section" data-testid="lini-masa-respons">
      <SectionHead eyebrow="Integrasi respons" title="Lini masa respons" desc={catatan} />
      <div className="skdr-card p-4">{chart}</div>
    </section>
  )
}
