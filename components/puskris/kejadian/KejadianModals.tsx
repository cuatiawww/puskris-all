'use client'

import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, AlertTriangle, CheckCircle2, Info, Search, ShieldAlert, X } from 'lucide-react'
import type { HealthRiskBreakdown } from '@/lib/puskris/kejadian-template'
import type { PendukungPayload } from './types'

export function SeismicDetailModal({
  open,
  onClose,
  gempa,
  kabupaten,
}: {
  open: boolean
  onClose: () => void
  gempa: PendukungPayload['gempa']
  kabupaten: string
}) {
  const [minMag, setMinMag] = useState<'all' | '4' | '5'>('all')
  const [q, setQ] = useState('')

  const rows = useMemo(() => {
    const base = gempa?.catalog || []
    return base.filter((e) => {
      if (minMag === '4' && e.mag < 4) return false
      if (minMag === '5' && e.mag < 5) return false
      if (q.trim()) {
        const s = q.trim().toLowerCase()
        if (!`${e.place} ${e.source} ${e.mmi || ''}`.toLowerCase().includes(s)) return false
      }
      return true
    })
  }, [gempa, minMag, q])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs" role="dialog" aria-modal="true" aria-label="Detail Aktivitas Seismik">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 bg-rose-50/70 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <Activity className="h-5 w-5 text-rose-700" />
            <div>
              <h2 className="text-sm font-black text-slate-900">Katalog Seismik & Gempa Susulan — Sekitar {kabupaten}</h2>
              <p className="text-[11px] text-slate-600">Data gabungan resmi BMKG & USGS FDSN dalam radius ±350 km sekitar tanggal kejadian</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-slate-900" aria-label="Tutup modal">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {/* 7-day seismic bar chart */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-600">Frekuensi Kejadian Gempa Harian (M2.5+)</span>
              <span className="text-[11px] font-bold text-rose-700">Maks Magnitudo: {gempa?.maxMag != null ? `M ${gempa.maxMag.toFixed(1)}` : '—'}</span>
            </div>
            <div className="h-44">
              {(gempa?.timeline7d || []).length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gempa?.timeline7d || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={30} />
                    <Tooltip />
                    <Bar dataKey="count" name="Jumlah Gempa" fill="#be123c" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-12 text-center text-xs text-slate-500">Belum ada catatan aktivitas seismik M2.5+ di jendela waktu ini.</p>
              )}
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 text-xs">
              {([
                ['all', `Semua (${gempa?.catalog?.length || 0})`],
                ['4', 'M >= 4.0'],
                ['5', 'M >= 5.0'],
              ] as const).map(([k, lbl]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setMinMag(k)}
                  className={`rounded-lg px-2.5 py-1 font-bold ${minMag === k ? 'bg-rose-700 text-white' : 'text-slate-600 hover:bg-white'}`}
                >
                  {lbl}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari wilayah / MMI..."
                className="h-8 rounded-lg border border-slate-200 pl-8 pr-3 text-xs outline-none focus:border-rose-400"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2">Sumber</th>
                  <th className="px-3 py-2">Waktu (WIB)</th>
                  <th className="px-3 py-2 text-right">Mag</th>
                  <th className="px-3 py-2 text-right">Kedalaman</th>
                  <th className="px-3 py-2">Wilayah / Keterangan</th>
                  <th className="px-3 py-2 text-right">Jarak</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length ? (
                  rows.map((r) => (
                    <tr key={r.id} className="hover:bg-rose-50/30">
                      <td className="px-3 py-2">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-black ${r.source === 'BMKG' ? 'bg-teal-100 text-teal-800' : 'bg-slate-100 text-slate-700'}`}>
                          {r.source}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-slate-600">{r.timeWib}</td>
                      <td className="px-3 py-2 text-right font-black text-rose-700">M {r.mag.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-600">{r.depthKm} km</td>
                      <td className="px-3 py-2">
                        <div className="font-semibold text-slate-800">{r.place}</div>
                        {r.mmi || r.potensi ? (
                          <div className="text-[10.5px] text-slate-500">{[r.mmi, r.potensi].filter(Boolean).join(' · ')}</div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[11px] text-slate-600">{r.distKm != null ? `${r.distKm} km` : '—'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-500">
                      Tidak ada gempa yang cocok dengan filter ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export function HealthRiskModal({
  open,
  onClose,
  risk,
}: {
  open: boolean
  onClose: () => void
  risk: HealthRiskBreakdown
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs" role="dialog" aria-modal="true" aria-label="Metodologi Skor Risiko Kesehatan">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-[#00705a]" />
            <div>
              <h2 className="text-sm font-black text-slate-900">Rincian Skor Risiko Krisis Kesehatan</h2>
              <p className="text-[11px] text-slate-500">Dihitung otomatis hanya dari parameter API terukur</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 p-5">
          <div className={`flex items-center justify-between rounded-xl border px-4 py-3 ${risk.badgeClass}`}>
            <span className="text-xs font-bold uppercase tracking-wider">Skor Total</span>
            <span className="text-xl font-black tabular-nums">{risk.score} / 100 · {risk.level}</span>
          </div>
          <div className="space-y-2.5">
            {risk.factors.map((f, i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                  <span>{f.label}</span>
                  <span className="font-mono text-[#00705a]">{f.points} / {f.maxPoints}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-[#00705a]" style={{ width: `${Math.round((f.points / f.maxPoints) * 100)}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-slate-600">{f.basis}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function SumberApiModal({
  open,
  onClose,
  status,
  pendukung,
}: {
  open: boolean
  onClose: () => void
  status?: Record<string, any> | null
  pendukung: PendukungPayload | null
}) {
  if (!open) return null
  const externalSources = [
    { name: 'EOC Kemkes detail_bencana (bencana_detail.php)', ok: Boolean(pendukung?.eocDetail), desc: 'Kronologis resmi, kecamatan terdampak, perkembangan laporan, pos pengungsi' },
    { name: 'Open-Meteo Weather & Archive', ok: Boolean(pendukung?.weather?.available), desc: 'Cuaca real-time, curah hujan 7 hari, kecepatan & arah angin' },
    { name: 'Open-Meteo Air Quality (CAMS)', ok: Boolean(pendukung?.airQuality?.available), desc: 'PM2.5, PM10, CO, US AQI & konversi ISPU KLHK' },
    { name: 'Open-Meteo Flood (GloFAS) & Soil Moisture', ok: Boolean(pendukung?.banjir?.glofas || pendukung?.banjir?.soil), desc: 'Debit sungai model hidrologi & kejenuhan tanah' },
    { name: 'PetaBencana.id Community Reports', ok: Boolean(pendukung?.banjir?.petaBencana), desc: 'Laporan tinggi muka air & banjir warga radius ≤100 km' },
    { name: 'BMKG TEWS & USGS FDSN Earthquake Catalog', ok: Boolean(pendukung?.gempa?.bmkgAvailable || pendukung?.gempa?.usgsAvailable), desc: 'Parameter gempa, intensitas MMI, Shakemap, dan gempa susulan' },
    { name: 'NASA FIRMS VIIRS Active Fire (24j & 7h)', ok: Boolean(pendukung?.karhutla?.firmsAvailable), desc: 'Titik panas satelit NOAA-20 & Suomi-NPP radius 50-150 km' },
  ]
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs" role="dialog" aria-modal="true" aria-label="Status Sumber API">
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-[#00705a]" />
            <div>
              <h2 className="text-sm font-black text-slate-900">Status Integrasi Data API Resmi & Eksternal</h2>
              <p className="text-[11px] text-slate-500">Semua angka pada halaman ini berasal langsung dari endpoint resmi (tanpa data contoh)</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto p-5 text-xs">
          <div>
            <h3 className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">API Internal Kementerian Kesehatan</h3>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {Object.entries(status || {}).map(([k, s]: [string, any]) => (
                <div key={k} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                  <span className="font-bold uppercase text-slate-700">{k}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${s?.status === 'langsung' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                    {s?.status === 'langsung' ? 'Langsung' : s?.pending ? 'Memuat…' : 'Belum tersedia'}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">API Pendukung Real-Time per Kejadian</h3>
            <div className="space-y-1.5">
              {externalSources.map((src) => (
                <div key={src.name} className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
                  <div>
                    <div className="font-bold text-slate-800">{src.name}</div>
                    <div className="text-[11px] text-slate-500">{src.desc}</div>
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${src.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {src.ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                    {src.ok ? 'Aktif' : 'Standby'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
