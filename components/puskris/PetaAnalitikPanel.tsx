'use client'

import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import ApiKosong from '@/components/puskris/ApiKosong'
import { buildPetaAnalitik } from '@/lib/puskris/peta-analitik'
import { fmtAngka } from '@/lib/puskris/eoc-markers'

const nf = (n: number) => Number(n || 0).toLocaleString('id-ID')

export default function PetaAnalitikPanel({
  kejadian, drillProv, drillNama, compact = false,
}: {
  kejadian: any[] | null | undefined
  drillProv?: string | null
  drillNama?: string | null
  compact?: boolean
}) {
  const a = useMemo(
    () => buildPetaAnalitik(kejadian, { prov: drillProv || null, namaProv: drillNama || null }),
    [kejadian, drillProv, drillNama],
  )

  if (!kejadian) {
    return <ApiKosong pesan="Analitik kejadian menunggu data EOC" compact={compact} />
  }

  return (
    <div className={compact ? 'space-y-3 p-3' : 'space-y-3 p-3'} data-testid="peta-analitik">
      <div>
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Analitik kejadian</p>
        <h3 className="text-sm font-black text-slate-900">{a.ruang}</h3>
        <p className="text-[11px] text-slate-500">Mengikuti filter dasbor dan telusur peta · {nf(a.n)} kejadian</p>
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {[
          ['Kejadian', a.korban.kejadian],
          ['Krisis', a.korban.krisis],
          ['Meninggal', a.korban.meninggal],
          ['Pengungsi', a.korban.pengungsi],
        ].map(([l, v]) => (
          <div key={String(l)} className="rounded-lg bg-slate-50 px-2 py-1.5">
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{l}</div>
            <div className="text-sm font-black tabular-nums text-slate-900">{fmtAngka(v as number)}</div>
          </div>
        ))}
      </div>

      <div>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Tren {a.grain === 'minggu' ? 'mingguan' : 'bulanan'}</p>
        {a.tren.length ? (
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={a.tren} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
                <Tooltip formatter={(v: any, n: any) => [Number(v).toLocaleString('id-ID'), n]} />
                <Bar dataKey="kejadian" name="Kejadian" fill="#00705a" radius={[3, 3, 0, 0]} />
                <Bar dataKey="krisis" name="Krisis" fill="#be123c" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <ApiKosong compact pesan="Belum ada deret waktu dari API untuk filter ini" />}
      </div>

      <div>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Distribusi jenis</p>
        {a.jenis.length ? (
          <ul className="max-h-44 space-y-1 overflow-auto">
            {a.jenis.slice(0, 10).map((j) => {
              const pct = a.n ? Math.round((j.n / a.n) * 100) : 0
              return (
                <li key={j.jenis} className="flex items-center gap-1.5 text-[11px]">
                  {j.iconSrc ? <img alt="" aria-hidden src={j.iconSrc} className="h-5 w-4 object-contain" /> : <span className="h-2.5 w-2.5 rounded-sm" style={{ background: j.color }} />}
                  <span className="min-w-0 flex-1 truncate font-semibold text-slate-700">{j.jenis}</span>
                  <span className="tabular-nums font-bold text-slate-900">{nf(j.n)}</span>
                  <span className="w-8 text-right tabular-nums text-slate-400">{pct}%</span>
                </li>
              )
            })}
          </ul>
        ) : <ApiKosong compact />}
      </div>

      <div>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Teratas per {a.topLevel}</p>
        {a.topWilayah.length ? (
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={a.topWilayah} layout="vertical" margin={{ top: 0, right: 8, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 9 }} allowDecimals={false} />
                <YAxis type="category" dataKey="nama" width={88} tick={{ fontSize: 9 }} />
                <Tooltip formatter={(v: any) => Number(v).toLocaleString('id-ID')} />
                <Bar dataKey="n" name="Kejadian" radius={[0, 3, 3, 0]}>
                  {a.topWilayah.map((w) => <Cell key={w.kode} fill="#0f766e" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <ApiKosong compact />}
      </div>
    </div>
  )
}