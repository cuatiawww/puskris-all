'use client'

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CloudRain, Wind } from 'lucide-react'
import ApiKosong from '@/components/puskris/ApiKosong'
import type { PendukungPayload } from './types'

export default function UmumTemplatePanel({
  pendukung,
}: {
  pendukung: PendukungPayload | null
}) {
  const daily = pendukung?.weather?.daily7d || []
  const aqCur = pendukung?.airQuality?.current
  const wxCur = pendukung?.weather?.current

  return (
    <section className="space-y-4" data-testid="template-umum-panel">
      <div>
        <span className="text-[10px] font-black uppercase tracking-wider text-teal-700">Pemantauan Cuaca & Lingkungan Kejadian</span>
        <h2 className="text-base font-black text-slate-900">Kondisi Meteorologi Lokal & Kualitas Udara di Sekitar Wilayah Kejadian</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="skdr-card p-4 lg:col-span-7">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CloudRain className="h-4 w-4 text-teal-700" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">Curah Hujan & Suhu Harian (Open-Meteo)</h3>
            </div>
            <span className="text-[11px] font-bold text-slate-600">
              Total 7 hari: {pendukung?.weather?.rain7dSumMm != null ? `${pendukung.weather.rain7dSumMm} mm` : '—'}
            </span>
          </div>
          <div className="h-52">
            {daily.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={daily} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={36} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 10.5 }} />
                  <Bar dataKey="precipSum" name="Curah Hujan (mm)" fill="#0f766e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="tempMax" name="Suhu Maks (°C)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ApiKosong pesan="Grafik cuaca harian belum tersedia" />
            )}
          </div>
        </div>

        <div className="skdr-card space-y-3 p-4 lg:col-span-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <Wind className="h-4 w-4 text-teal-700" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">Snapshot Atmosfer & Udara</h3>
          </div>
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="text-[10px] font-bold uppercase text-slate-400">Cuaca Saat Ini</div>
              <div className="mt-0.5 text-sm font-black text-slate-900">{wxCur?.weatherLabel || '—'}</div>
              <div className="text-[11px] text-slate-500">Suhu {wxCur?.tempC ?? '—'}°C · RH {wxCur?.humidityPct ?? '—'}%</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="text-[10px] font-bold uppercase text-slate-400">Angin & Tekanan</div>
              <div className="mt-0.5 text-sm font-black text-slate-900">{wxCur?.windSpeedKmh ?? '—'} km/jam</div>
              <div className="text-[11px] text-slate-500">Tekanan {wxCur?.pressureHpa ?? '—'} hPa</div>
            </div>
            <div className={`rounded-xl border p-3 ${aqCur?.ispuBadgeClass || 'border-slate-200 bg-slate-50'}`}>
              <div className="text-[10px] font-bold uppercase opacity-75">ISPU KLHK</div>
              <div className="mt-0.5 text-lg font-black">{aqCur?.ispu ?? '—'}</div>
              <div className="text-[11px] font-bold">{aqCur?.ispuKategori || 'Tidak Tersedia'}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="text-[10px] font-bold uppercase text-slate-400">PM2.5 & CO</div>
              <div className="mt-0.5 text-sm font-black text-slate-900">{aqCur?.pm25 ?? '—'} µg/m³</div>
              <div className="text-[11px] text-slate-500">CO {aqCur?.co ?? '—'} µg/m³</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
