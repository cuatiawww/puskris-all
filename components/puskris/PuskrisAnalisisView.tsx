'use client'

import { useMemo } from 'react'
import dynamic from 'next/dynamic'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend,
  Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer,
  Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from 'recharts'
import { applyDerive, nf } from '@/lib/puskris/derive'
import { toDeriveFilter, type PuskrisUiFilter } from '@/lib/puskris/ui-filter'
import { NASIONAL_NOTE } from '@/lib/puskris/pages'
import { CONTOH_LABEL } from '@/lib/puskris/integrasi'
import type { ProvinceRow } from '@/lib/puskris/types'
import SectionHead from '@/components/puskris/SectionHead'
import InfoHint from '@/components/puskris/InfoHint'
import { busyHourSeries, gapRankRows, jenisTrendSeries, scatterRows } from '@/lib/puskris/analisis-charts'

const ChoroplethMap = dynamic(() => import('@/components/analytics/ChoroplethMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[360px] items-center justify-center text-xs font-bold text-slate-400">Memuat peta…</div>
  ),
})

function gapTone(v: number) {
  if (v >= 70) return 'bg-red-100 text-red-800'
  if (v >= 55) return 'bg-amber-100 text-amber-800'
  return 'bg-emerald-50 text-emerald-800'
}

export default function PuskrisAnalisisView({
  raw, f, onApply,
}: {
  raw: any
  f: PuskrisUiFilter
  onApply: (next: PuskrisUiFilter) => void
}) {
  const derived = useMemo(() => applyDerive(raw, toDeriveFilter(f)), [raw, f])
  const ranked = useMemo(
    () => [...derived.rows].sort((a, b) => b.indeksRespons - a.indeksRespons).map((r, i) => ({ ...r, rank: i + 1 })),
    [derived.rows],
  )
  const choroValues = useMemo(
    () => Object.fromEntries(derived.rows.map((r: ProvinceRow) => [r.code, r.indeksRespons])),
    [derived.rows],
  )
  const trend = useMemo(() => jenisTrendSeries(raw, f), [raw, f])
  const busy = useMemo(() => busyHourSeries(raw, derived.ncc?.days || [], f), [raw, derived.ncc, f])
  const rankBars = useMemo(() => gapRankRows(derived.rows, f), [derived.rows, f])
  const scatter = useMemo(() => scatterRows(derived.rows), [derived.rows])
  const pickProv = (code: string) => onApply({ ...f, provinsi: code, kabupaten: null })

  return (
    <div className="space-y-6" data-testid="puskris-analisis-view">
      <section className="skdr-section">
        <SectionHead
          eyebrow="Indeks terpadu"
          title="Indeks Kesenjangan Respons"
          desc="Membandingkan beban (kejadian, meninggal, pengungsi) dengan kapasitas (PSC aktif, ambulans layak, tenaga cadangan, stok, dan Asistensi jika ada). Semakin tinggi nilainya (merah), semakin besar kesenjangannya."
        />
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="skdr-card p-3 sm:p-4">
            <h3 className="text-sm font-black text-slate-900">Peta indeks per provinsi</h3>
            <p className="mb-2 text-[11px] text-slate-500">Klik provinsi untuk memfilter seluruh halaman Analisis.</p>
            <ChoroplethMap level="province" values={choroValues} hue="pe" height={420} onPick={pickProv} />
          </div>
          <div className="skdr-card overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-black text-slate-900">Peringkat 38 provinsi</h3>
              <InfoHint text={derived.rumusKesenjangan} label="Rumus indeks kesenjangan" />
            </div>
            <div className="max-h-[440px] overflow-auto">
              <table className="w-full text-[11px]" data-testid="kesenjangan-table">
                <thead className="sticky top-0 bg-slate-50 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Provinsi</th>
                    <th className="px-3 py-2 text-right">Indeks</th>
                    <th className="px-3 py-2 text-right">Beban</th>
                    <th className="px-3 py-2 text-right">Kapasitas</th>
                    <th className="px-3 py-2 text-right">Kejadian</th>
                    <th className="px-3 py-2 text-right">Meninggal</th>
                    <th className="px-3 py-2 text-right">Pengungsi</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((r) => (
                    <tr
                      key={r.code}
                      onClick={() => pickProv(r.code)}
                      className={`cursor-pointer border-t border-slate-100 hover:bg-slate-50 ${f.provinsi === r.code ? 'bg-teal-50' : ''}`}
                    >
                      <td className="px-3 py-1.5 font-bold text-slate-500">{r.rank}</td>
                      <td className="px-3 py-1.5 font-semibold text-slate-800">{r.nama}</td>
                      <td className="px-3 py-1.5 text-right">
                        <span className={`inline-flex min-w-[3rem] justify-end rounded-full px-2 py-0.5 font-bold tabular-nums ${gapTone(r.indeksRespons)}`}>
                          {r.indeksRespons.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">{(r.beban * 100).toFixed(1)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">{(r.kapasitas * 100).toFixed(1)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{nf(r.kejadian)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{nf(r.meninggal)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{nf(r.pengungsi)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section className="skdr-section">
        <SectionHead
          eyebrow="Tren jenis kejadian"
          title="Tren kejadian per jenis"
          desc="Total bulanan resmi dibagi ke jenis kejadian menurut porsi tahunan resmi."
        />
        <div className="skdr-card p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {trend.contoh ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">{CONTOH_LABEL}</span> : null}
            <p className="text-[11px] text-slate-500">{trend.catatan}</p>
          </div>
          {trend.nasionalOnly ? <p className="mb-2 text-[11px] font-semibold text-amber-800">{NASIONAL_NOTE} Deret bulanan tidak terpecah per provinsi.</p> : null}
          <div className="h-80">
            {trend.rows.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend.rows} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {trend.keys.map((k) => (
                    <Area key={k} type="monotone" dataKey={k} stackId="jenis" stroke={trend.colors[k]} fill={trend.colors[k]} fillOpacity={0.85} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-16 text-center text-sm text-slate-500">Tidak ada deret bulanan untuk filter ini.</p>
            )}
          </div>
        </div>
      </section>

      <section className="skdr-section">
        <SectionHead
          eyebrow="Kesenjangan wilayah"
          title="Peringkat kesenjangan provinsi"
          desc="Sepuluh provinsi dengan indeks tertinggi. Beban dan kapasitas ditampilkan dalam skala 0–100."
        />
        <div className="skdr-card p-4">
          <div className="h-[28rem]">
            {rankBars.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rankBars} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="nama" width={110} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Beban" fill="#F87171" radius={[0, 4, 4, 0]} cursor="pointer" onClick={(d: any) => d?.code && pickProv(d.code)} />
                  <Bar dataKey="Kapasitas" fill="#16B3AC" radius={[0, 4, 4, 0]} cursor="pointer" onClick={(d: any) => d?.code && pickProv(d.code)} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-16 text-center text-sm text-slate-500">Tidak ada data provinsi untuk filter ini.</p>
            )}
          </div>
        </div>
      </section>

      <section className="skdr-section">
        <SectionHead
          eyebrow="Posisi respons"
          title="Beban vs Kapasitas"
          desc="Setiap titik adalah satu provinsi. Kuadran merah (kiri atas) menandai beban tinggi dengan kapasitas relatif rendah — prioritas bantuan."
        />
        <div className="skdr-card p-4">
          <div className="relative h-[28rem]">
            <div className="pointer-events-none absolute inset-0 z-10 grid grid-cols-2 grid-rows-2 p-10 pr-6 pt-6 text-[10px] font-bold uppercase tracking-wide">
              <span className="self-start justify-self-start rounded bg-red-50/90 px-1.5 py-0.5 text-red-700">Beban tinggi · kapasitas rendah</span>
              <span className="self-start justify-self-end rounded bg-amber-50/90 px-1.5 py-0.5 text-amber-800">Beban tinggi · kapasitas tinggi</span>
              <span className="self-end justify-self-start rounded bg-slate-100/90 px-1.5 py-0.5 text-slate-600">Beban rendah · kapasitas rendah</span>
              <span className="self-end justify-self-end rounded bg-emerald-50/90 px-1.5 py-0.5 text-emerald-800">Beban rendah · kapasitas tinggi</span>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 16, right: 16, left: 8, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" dataKey="Kapasitas" name="Kapasitas" domain={[0, 100]} tick={{ fontSize: 10 }} label={{ value: 'Kapasitas', position: 'bottom', fontSize: 11 }} />
                <YAxis type="number" dataKey="Beban" name="Beban" domain={[0, 100]} tick={{ fontSize: 10 }} label={{ value: 'Beban', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                <ZAxis type="number" dataKey="Indeks" range={[40, 120]} />
                <ReferenceLine x={50} stroke="#94a3b8" strokeDasharray="4 4" />
                <ReferenceLine y={50} stroke="#94a3b8" strokeDasharray="4 4" />
                <ReferenceArea x1={0} x2={50} y1={50} y2={100} fill="#DC2626" fillOpacity={0.06} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(v: any, name: any) => [typeof v === 'number' ? v.toFixed(1) : v, name]} />
                <Scatter
                  data={scatter}
                  onClick={(d: any) => d?.code && pickProv(d.code)}
                  cursor="pointer"
                >
                  {scatter.map((r) => (
                    <Cell
                      key={r.code}
                      fill={r.prioritas ? '#DC2626' : r.Beban >= 50 ? '#F59E0B' : '#16B3AC'}
                      stroke={f.provinsi === r.code ? '#0f172a' : 'transparent'}
                      strokeWidth={f.provinsi === r.code ? 2 : 0}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="skdr-section">
        <SectionHead
          eyebrow="Pola layanan 119"
          title="Jam sibuk panggilan 119"
          desc="Rata-rata sebaran panggilan masuk dan terjawab sepanjang hari, untuk membantu pengaturan petugas."
        />
        <div className="skdr-card p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {busy.contoh ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">{CONTOH_LABEL}</span> : null}
            <p className="text-[11px] text-slate-500">{busy.catatan}</p>
          </div>
          {busy.nasionalOnly ? <p className="mb-2 text-[11px] font-semibold text-amber-800">{NASIONAL_NOTE}</p> : null}
          <div className="h-72">
            {busy.rows.some((r) => r['Panggilan masuk'] > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={busy.rows} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="jam" tick={{ fontSize: 10 }} interval={1} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="Panggilan masuk" stroke="#3899FE" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Panggilan terjawab" stroke="#16B3AC" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-16 text-center text-sm text-slate-500">Tidak ada data panggilan 119 untuk filter periode ini.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
