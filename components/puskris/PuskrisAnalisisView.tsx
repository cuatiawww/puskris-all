'use client'

import { useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { applyDerive, nf } from '@/lib/puskris/derive'
import { toDeriveFilter, type PuskrisUiFilter } from '@/lib/puskris/ui-filter'
import { NASIONAL_NOTE } from '@/lib/puskris/pages'
import type { ProvinceRow } from '@/lib/puskris/types'
import SectionHead from '@/components/puskris/SectionHead'
import PuskrisHeatmap from '@/components/puskris/PuskrisHeatmap'
import InfoHint from '@/components/puskris/InfoHint'

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

function shortName(nama: string) {
  return nama
    .replace('Kepulauan ', 'Kep. ')
    .replace('Sumatera ', 'Sum. ')
    .replace('Sulawesi ', 'Sul. ')
    .replace('Kalimantan ', 'Kal. ')
    .replace('Nusa Tenggara ', 'NT ')
}

export default function PuskrisAnalisisView({
  raw, f, onApply,
}: {
  raw: any
  f: PuskrisUiFilter
  onApply: (next: PuskrisUiFilter) => void
}) {
  const derived = useMemo(() => applyDerive(raw, toDeriveFilter(f)), [raw, f])
  const kejadian = useMemo(() => {
    const list = derived.kejadian || []
    return f.jenis ? list.filter((k: any) => k.jenis === f.jenis) : list
  }, [derived.kejadian, f.jenis])

  const ranked = useMemo(
    () => [...derived.rows].sort((a, b) => b.indeksRespons - a.indeksRespons).map((r, i) => ({ ...r, rank: i + 1 })),
    [derived.rows],
  )

  const choroValues = useMemo(
    () => Object.fromEntries(derived.rows.map((r: ProvinceRow) => [r.code, r.indeksRespons])),
    [derived.rows],
  )

  const pillarCompare = useMemo(() => {
    const src = f.provinsi ? ranked.filter((r) => r.code === f.provinsi) : ranked.slice(0, 10)
    return src.map((r) => ({
      nama: shortName(r.nama),
      code: r.code,
      Beban: Math.round(r.beban * 1000) / 10,
      Kapasitas: Math.round(r.kapasitas * 1000) / 10,
      Indeks: r.indeksRespons,
    }))
  }, [ranked, f.provinsi])

  const nccDays = (derived.ncc?.days || []).map((d: any) => ({
    label: String(d.date || '').slice(8, 10),
    'Panggilan masuk': d.cof,
    'Panggilan terjawab': d.acd,
  }))

  const bulanan = (derived.chartBulanan || []).map((b: any) => ({
    bulan: b.label || b.bulan,
    'Kejadian terpantau': b.kejadian,
    'Berdampak krisis': b.krisis,
  }))

  const pickProv = (code: string) => onApply({ ...f, provinsi: code, kabupaten: null })

  return (
    <div className="space-y-6" data-testid="puskris-analisis-view">
      <PuskrisHeatmap raw={raw} rows={derived.rows} kejadian={kejadian} nccDays={derived.ncc?.days || []} filter={f} />

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
                    <th className="px-3 py-2 text-right">PSC aktif</th>
                    <th className="px-3 py-2 text-right">Ambulans layak</th>
                    <th className="px-3 py-2 text-right">TCK</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((r) => {
                    const on = f.provinsi === r.code
                    return (
                      <tr
                        key={r.code}
                        onClick={() => pickProv(r.code)}
                        className={`cursor-pointer border-t border-slate-100 hover:bg-slate-50 ${on ? 'bg-teal-50' : ''}`}
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
                        <td className="px-3 py-1.5 text-right tabular-nums">{nf(r.pscAktif)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{nf(r.ambulansBaik)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{nf(r.tck)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section className="skdr-section">
        <SectionHead
          eyebrow="Perbandingan antar-pilar"
          title="Tren dan perbandingan pilar"
          desc="Kejadian memakai deret bulanan resmi Pantauan Bencana. Panggilan 119 memakai deret harian NCC. Perbandingan beban dan kapasitas per provinsi memakai snapshot kumulatif, bukan deret waktu."
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="skdr-card p-4">
            <h3 className="text-sm font-black text-slate-900">Tren kejadian 2026</h3>
            {f.provinsi ? (
              <p className="mt-1 text-[11px] font-semibold text-amber-800">Deret bulanan hanya tersedia nasional. Filter provinsi tidak memecah grafik ini.</p>
            ) : (
              <p className="mt-1 text-[11px] text-slate-500">Jumlah kejadian terpantau dan yang berdampak krisis per bulan.</p>
            )}
            <div className="mt-3 h-64">
              {bulanan.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={bulanan} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="bulan" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="Kejadian terpantau" stroke="#16B3AC" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Berdampak krisis" stroke="#DC2626" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-16 text-center text-sm text-slate-500">Tidak ada deret bulanan untuk filter ini.</p>
              )}
            </div>
          </div>
          <div className="skdr-card p-4">
            <h3 className="text-sm font-black text-slate-900">Tren panggilan 119</h3>
            {f.provinsi || f.kabupaten ? (
              <p className="mt-1 text-[11px] font-semibold text-amber-800">{NASIONAL_NOTE}</p>
            ) : (
              <p className="mt-1 text-[11px] text-slate-500">Panggilan masuk dan terjawab per hari pada periode yang tersedia.</p>
            )}
            <div className="mt-3 h-64">
              {nccDays.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={nccDays} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
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
        </div>
        <div className="skdr-card mt-4 p-4">
          <h3 className="text-sm font-black text-slate-900">
            {f.provinsi ? 'Beban, kapasitas, dan indeks di provinsi terpilih' : '10 provinsi dengan kesenjangan tertinggi'}
          </h3>
          <p className="mt-1 text-[11px] text-slate-500">Beban dan kapasitas ditampilkan dalam skala 0–100 agar bisa dibandingkan dengan indeks kesenjangan.</p>
          <div className="mt-3 h-80">
            {pillarCompare.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pillarCompare} margin={{ top: 8, right: 12, left: 0, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="nama" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Beban" fill="#F87171" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Kapasitas" fill="#16B3AC" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Indeks" fill="#7F1D1D" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-16 text-center text-sm text-slate-500">Tidak ada data provinsi untuk filter ini.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
