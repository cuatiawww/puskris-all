'use client'

import { ComposedChart, Bar, Line, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TimelinePoint } from '@/lib/puskris/integrasi'
import SectionHead from '@/components/puskris/SectionHead'

export default function LiniMasaRespons({ rows, catatan }: { rows: TimelinePoint[]; catatan: string }) {
  return (
    <section className="skdr-section" data-testid="lini-masa-respons">
      <SectionHead eyebrow="Integrasi respons" title="Lini masa respons" desc={catatan} />
      <div className="skdr-card p-4">
      <div className="h-64">
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
      </div>
    </section>
  )
}
