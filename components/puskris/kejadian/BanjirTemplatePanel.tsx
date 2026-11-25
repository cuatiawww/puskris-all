'use client'

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AlertTriangle, CloudRain, Droplets, ShieldCheck, Stethoscope, Waves } from 'lucide-react'
import ApiKosong from '@/components/puskris/ApiKosong'
import { nf } from '@/lib/puskris/derive'
import type { PendukungPayload } from './types'

export default function BanjirTemplatePanel({
  kejadian,
  pendukung,
  pieKota,
}: {
  kejadian: any
  pendukung: PendukungPayload | null
  pieKota: any[]
}) {
  const banjir = pendukung?.banjir
  const glofas = banjir?.glofas
  const soil = banjir?.soil
  const marine = banjir?.marine
  const pb = banjir?.petaBencana
  const dailyRain = pendukung?.weather?.daily7d || []

  // Indikator status peringatan berbasis ambang aktual
  const rainVal = pendukung?.weather?.eventDayRainMm ?? pendukung?.weather?.current?.rainMm ?? 0
  const rain7 = pendukung?.weather?.rain7dSumMm ?? 0
  const peakQ = glofas?.peakDischarge ?? 0
  const highRiskPostFlood = rainVal >= 50 || rain7 >= 150 || peakQ >= 180 || (kejadian?.pengungsi || 0) >= 100

  // Cari sinyal penyakit sensitif banjir dari PIE kabupaten bila tersedia
  const pieBanjirRows = pieKota.filter((r) => /diare|dbd|dengue|lepto|malaria|kulit|ispa|typhoid/i.test(String(r?.penyakit || r?.nama || '')))

  return (
    <section className="space-y-4" data-testid="template-banjir-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider text-sky-700">Template Hidrologi & Kesehatan Banjir</span>
          <h2 className="text-base font-black text-slate-900">
            Pemantauan Debit Sungai, Kejenuhan Tanah, Laporan Warga & Kewaspadaan Penyakit
          </h2>
        </div>
        {glofas ? (
          <span
            className={`rounded-full border px-3 py-1 text-xs font-black ${
              glofas.status === 'KRITIS'
                ? 'border-rose-300 bg-rose-50 text-rose-800'
                : glofas.status === 'SIAGA'
                ? 'border-amber-300 bg-amber-50 text-amber-900'
                : 'border-sky-200 bg-sky-50 text-sky-800'
            }`}
          >
            Status GloFAS: {glofas.status} ({glofas.peakDischarge} m³/s puncak)
          </span>
        ) : null}
      </div>

      {/* Charts Row: GloFAS River Discharge + Rainfall 7d */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Card: GloFAS River Discharge */}
        <div className="skdr-card flex flex-col justify-between p-4">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-sky-700">
                <Waves className="h-3.5 w-3.5" /> Open-Meteo Flood API (GloFAS v4)
              </div>
              <h3 className="text-sm font-black text-slate-900">Debit Aliran Sungai Harian (m³/s)</h3>
            </div>
            {glofas ? (
              <div className="flex gap-2 text-right text-[11px]">
                <div className="rounded-lg bg-slate-50 px-2 py-1">
                  <div className="text-[9.5px] text-slate-400">Rerata</div>
                  <div className="font-black text-slate-800">{glofas.avgDischarge}</div>
                </div>
                <div className="rounded-lg bg-sky-50 px-2 py-1">
                  <div className="text-[9.5px] text-sky-600">Puncak</div>
                  <div className="font-black text-sky-900">{glofas.peakDischarge}</div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="h-56">
            {glofas?.daily?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={glofas.daily} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="glofasFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0284c7" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#0284c7" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={48} />
                  <Tooltip formatter={(v: any) => [`${v} m³/s`, 'Debit Sungai']} />
                  <ReferenceLine y={glofas.avgDischarge} stroke="#64748b" strokeDasharray="4 4" label={{ value: 'Rerata', fontSize: 10, fill: '#475569' }} />
                  <Area type="monotone" dataKey="discharge" name="Debit (m³/s)" stroke="#0284c7" strokeWidth={2.2} fill="url(#glofasFill)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <ApiKosong pesan="Data debit sungai GloFAS belum tersedia untuk koordinat ini" />
            )}
          </div>
        </div>

        {/* Card: Rainfall 7-Day + ET0 */}
        <div className="skdr-card flex flex-col justify-between p-4">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-teal-700">
                <CloudRain className="h-3.5 w-3.5" /> Open-Meteo Presipitasi Harian
              </div>
              <h3 className="text-sm font-black text-slate-900">Curah Hujan & Penguapan Harian (mm)</h3>
            </div>
            <div className="rounded-lg bg-teal-50 px-2.5 py-1 text-right text-[11px]">
              <div className="text-[9.5px] text-teal-700">Total 7 Hari</div>
              <div className="font-black text-teal-950">{pendukung?.weather?.rain7dSumMm != null ? `${pendukung.weather.rain7dSumMm} mm` : '—'}</div>
            </div>
          </div>

          <div className="h-56">
            {dailyRain.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyRain} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={40} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="precipSum" name="Curah Hujan (mm)" fill="#0369a1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="et0" name="Evapotranspirasi ET0 (mm)" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ApiKosong pesan="Grafik curah hujan harian belum tersedia" />
            )}
          </div>
        </div>
      </div>

      {/* Soil Saturation + Marine Waves + PetaBencana Citizen Reports + Post-Flood Disease Watch */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Hidrologi Tanah & Pesisir */}
        <div className="skdr-card space-y-4 p-4 lg:col-span-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <Droplets className="h-4 w-4 text-sky-700" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">Kejenuhan Tanah & Tinggi Gelombang Pesisir</h3>
          </div>

          {soil ? (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700">Kejenuhan Tanah Lapisan Atas</span>
                <span className="font-black text-sky-800">{soil.saturationPct}% · {soil.status}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full ${soil.saturationPct >= 85 ? 'bg-rose-600' : soil.saturationPct >= 65 ? 'bg-amber-500' : 'bg-sky-600'}`}
                  style={{ width: `${soil.saturationPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>Kelembapan permukaan: {soil.topLayer} m³/m³</span>
                {soil.subLayer != null ? <span>Lapisan bawah: {soil.subLayer} m³/m³</span> : null}
              </div>
            </div>
          ) : (
            <ApiKosong pesan="Data kelembapan tanah belum tersedia" compact />
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700">Pemantauan Gelombang Pesisir / Rob (Marine API)</span>
              <span className="font-mono font-black text-slate-900">
                {marine ? `${marine.waveHeightMaxM} m` : 'Wilayah Daratan / Nihil'}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {marine
                ? `Tinggi gelombang maksimum ${marine.waveHeightMaxM} meter${marine.wavePeriodMaxS ? ` · Periode puncak ${marine.wavePeriodMaxS} detik` : ''}.`
                : 'Tidak terdeteksi anomali gelombang laut signifikan di koordinat ini (atau lokasi berada di pedalaman).'}
            </p>
          </div>

          {/* PetaBencana Citizen Reports */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                Laporan Banjir Warga (PetaBencana.id ≤ 100 km)
              </span>
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-black text-sky-900">
                {pb?.count || 0} laporan
              </span>
            </div>
            {pb?.items?.length ? (
              <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
                {pb.items.map((item) => (
                  <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-2 text-[11px]">
                    <div className="flex items-center justify-between font-bold text-slate-800">
                      <span>{item.floodDepthCm ? `TMA ±${item.floodDepthCm} cm` : 'Laporan genangan'}</span>
                      <span className="font-mono text-[10px] text-slate-500">{item.distKm} km · {item.createdAt}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-slate-600">{item.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-slate-200 px-3 py-2.5 text-[11px] text-slate-500">
                Tidak ada laporan PetaBencana aktif dalam radius 100 km selama 7 hari terakhir.
              </p>
            )}
          </div>
        </div>

        {/* Kewaspadaan Penyakit Pasca-Banjir & PIE */}
        <div className="skdr-card space-y-4 p-4 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-[#00705a]" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                Kewaspadaan Risiko Penyakit Pasca-Banjir & Protokol Kesehatan EOC
              </h3>
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10.5px] font-black ${
                highRiskPostFlood ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {highRiskPostFlood ? <AlertTriangle className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
              {highRiskPostFlood ? 'Siaga Penyakit Tular Air & Vektor' : 'Pemantauan Rutin'}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
              <div className="text-[11px] font-black text-amber-900">1. Leptospirosis</div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-700">
                Risiko meningkat saat warga dan relawan terpapar genangan air berlumpur. Pastikan APD sepatu bot, profilaksis sesuai indikasi klinis, & skrining demam akut.
              </p>
            </div>
            <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3">
              <div className="text-[11px] font-black text-sky-900">2. Diare & Air Bersih</div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-700">
                Prioritaskan distribusi kaporit, penjernih air cepat (PAC), oralit/zinc di posko ({nf(kejadian.pengungsi)} pengungsi), dan inspeksi sanitasi dapur umum.
              </p>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3">
              <div className="text-[11px] font-black text-rose-900">3. Penyakit Kulit & Vektor</div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-700">
                Antisipasi dermatitis kontak, infeksi luka terbuka, serta sarang nyamuk DBD pasca-surut air. Siapkan salep kulit, antiseptik, & RDT malaria/DBD jika endemis.
              </p>
            </div>
          </div>

          {/* Real PIE Disease Context in Region */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-500">
                Konteks Penyakit Infeksi Terpantau (API Peta Risiko PIE — {kejadian.kabupaten})
              </span>
              <span className="text-[10px] text-slate-500">{pieKota.length} catatan wilayah</span>
            </div>
            {pieBanjirRows.length ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {pieBanjirRows.slice(0, 4).map((r, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
                    <div>
                      <div className="font-bold text-slate-800">{r.penyakit || r.nama}</div>
                      <div className="text-[10.5px] text-slate-500">{r.wilayah || kejadian.provinsi}</div>
                    </div>
                    <div className="text-right font-mono font-black text-slate-900">
                      {r.kasus != null ? `${nf(r.kasus)} kasus` : r.status || 'Terpantau'}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500">
                Tidak ada lonjakan khusus penyakit sensitif banjir di API Peta Risiko PIE untuk kab/kota ini saat ini.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
