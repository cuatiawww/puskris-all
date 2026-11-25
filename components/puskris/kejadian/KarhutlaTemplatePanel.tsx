'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AlertTriangle, Compass, Flame, ShieldAlert, Stethoscope, Wind } from 'lucide-react'
import ApiKosong from '@/components/puskris/ApiKosong'
import { nf } from '@/lib/puskris/derive'
import type { PendukungPayload } from './types'

export default function KarhutlaTemplatePanel({
  kejadian,
  pendukung,
  pieKota,
}: {
  kejadian: any
  pendukung: PendukungPayload | null
  pieKota: any[]
}) {
  const aq = pendukung?.airQuality
  const aqCur = aq?.current
  const wxCur = pendukung?.weather?.current
  const kh = pendukung?.karhutla

  const pieRespRows = pieKota.filter((r) => /ispa|pneumo|asma|respir|paru|ili/i.test(String(r?.penyakit || r?.nama || '')))

  return (
    <section className="space-y-4" data-testid="template-karhutla-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider text-orange-700">Template Karhutla, Titik Panas & Kualitas Udara</span>
          <h2 className="text-base font-black text-slate-900">
            Pemantauan ISPU KLHK, Titik Panas NASA FIRMS, Arah Sebaran Asap & Kesiagaan ISPA
          </h2>
        </div>
        {aqCur?.ispu != null ? (
          <span className={`rounded-full border px-3 py-1 text-xs font-black ${aqCur.ispuBadgeClass}`}>
            ISPU Saat Ini: {aqCur.ispu} ({aqCur.ispuKategori})
          </span>
        ) : null}
      </div>

      {/* Multi-pollutant ISPU & Wind Plume Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Polutan Udara Card */}
        <div className="skdr-card space-y-3 p-4 lg:col-span-7">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <Wind className="h-4 w-4 text-amber-700" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">Kualitas Udara Multi-Polutan (Open-Meteo CAMS)</h3>
            </div>
            <span className="text-[10px] text-slate-500">Standar Permen LHK No. P.14/2020</span>
          </div>

          {aqCur ? (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <div className={`rounded-xl border p-3 ${aqCur.ispuBadgeClass}`}>
                <div className="text-[10px] font-bold uppercase opacity-80">ISPU (PM2.5)</div>
                <div className="text-2xl font-black tabular-nums">{aqCur.ispu ?? '—'}</div>
                <div className="text-[11px] font-bold">{aqCur.ispuKategori}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <div className="text-[10px] font-bold uppercase text-slate-400">PM2.5</div>
                <div className="text-xl font-black tabular-nums text-slate-900">{aqCur.pm25 ?? '—'}</div>
                <div className="text-[10.5px] text-slate-500">µg/m³</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <div className="text-[10px] font-bold uppercase text-slate-400">PM10</div>
                <div className="text-xl font-black tabular-nums text-slate-900">{aqCur.pm10 ?? '—'}</div>
                <div className="text-[10.5px] text-slate-500">µg/m³</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <div className="text-[10px] font-bold uppercase text-slate-400">CO / US AQI</div>
                <div className="text-xl font-black tabular-nums text-slate-900">{aqCur.co ?? '—'}</div>
                <div className="text-[10.5px] text-slate-500">µg/m³ · AQI {aqCur.usAqi ?? '—'}</div>
              </div>
            </div>
          ) : (
            <ApiKosong pesan="Data polutan udara belum tersedia" />
          )}

          {/* 7-day ISPU Bar Chart */}
          <div className="h-48 pt-1">
            {aq?.daily?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={aq.daily} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={36} />
                  <Tooltip formatter={(v: any, _n: any, p: any) => [`ISPU ${v} (${p?.payload?.kategori}) · PM2.5 ${p?.payload?.pm25Max} µg/m³`, 'Kualitas Udara']} />
                  <Bar dataKey="ispu" name="ISPU Harian" radius={[4, 4, 0, 0]}>
                    {aq.daily.map((d, idx) => (
                      <Cell key={idx} fill={d.barColor} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ApiKosong pesan="Grafik ISPU harian belum tersedia" />
            )}
          </div>
        </div>

        {/* Plume Arah Angin, Fire Danger & Ringkasan FIRMS */}
        <div className="skdr-card space-y-3 p-4 lg:col-span-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <Compass className="h-4 w-4 text-orange-700" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">Arah Plume Asap & Indeks Risiko Api</h3>
            </div>
            {kh?.fireDanger ? (
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${kh.fireDanger.badgeClass}`}>
                CBI: {kh.fireDanger.level}
              </span>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-3">
              <div className="text-[10px] font-bold uppercase text-orange-800">Hotspot Radius 50 km</div>
              <div className="mt-0.5 text-2xl font-black tabular-nums text-orange-950">{kh?.count24h50km ?? 0}</div>
              <div className="text-[10.5px] text-orange-800">{kh?.highConf50km ?? 0} confidence tinggi</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="text-[10px] font-bold uppercase text-slate-500">Radius 150 km / Nasional</div>
              <div className="mt-0.5 text-2xl font-black tabular-nums text-slate-900">{kh?.count24h150km ?? 0}</div>
              <div className="text-[10.5px] text-slate-500">Nasional 24j: {nf(kh?.nasional24h ?? 0)}</div>
            </div>
          </div>

          {wxCur?.windCompass ? (
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700">Arah Bawaan Asap Dominan</span>
                <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-bold text-white">
                  {wxCur.windCompass.fromCode} ({wxCur.windCompass.deg}°) → {wxCur.windCompass.toCode} ({wxCur.windCompass.toDeg}°)
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-600">
                Angin bertiup dari <b>{wxCur.windCompass.fromLabel}</b> berkecepatan <b>{wxCur.windSpeedKmh ?? '—'} km/jam</b>, sehingga kepulan asap berpotensi terbawa ke sektor <b>{wxCur.windCompass.toLabel}</b>.
              </p>
            </div>
          ) : null}

          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 text-xs">
            <div className="flex items-center gap-1.5 font-black text-amber-900">
              <Stethoscope className="h-3.5 w-3.5 text-amber-700" /> Kesiagaan Medis Kabut Asap & ISPA
            </div>
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[11px] text-slate-700">
              <li>Siagakan masker N95/bedah pada Puskesmas & sekolah untuk kelompok rentan (balita, lansia, ibu hamil, penderita asma/PPOK).</li>
              <li>Siapkan pojok/ruang bersih oksigen (O₂ konsentrator & nebulizer) jika PM2.5 melewati 55 µg/m³ (ISPU Tidak Sehat).</li>
              {pieRespRows.length ? (
                <li>PIE Terpantau: <b>{pieRespRows[0].penyakit || pieRespRows[0].nama}</b> ({pieRespRows[0].kasus ?? pieRespRows[0].status}).</li>
              ) : null}
            </ul>
          </div>
        </div>
      </div>

      {/* 7-Day Hotspot Chart + Nearest NASA FIRMS Table */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="skdr-card p-4 lg:col-span-5">
          <div className="mb-2 flex items-center gap-2">
            <Flame className="h-4 w-4 text-orange-700" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">Tren Titik Panas VIIRS (7 Hari)</h3>
          </div>
          <div className="h-52">
            {kh?.daily7d?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={kh.daily7d} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={40} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 10.5 }} />
                  <Line type="monotone" dataKey="sekitar150km" name="Sekitar ≤150 km" stroke="#ea580c" strokeWidth={2.4} />
                  <Line type="monotone" dataKey="nasional" name="Nasional (RI)" stroke="#64748b" strokeWidth={1.6} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <ApiKosong pesan="Data tren 7 hari NASA FIRMS belum tersedia" />
            )}
          </div>
        </div>

        <div className="skdr-card p-4 lg:col-span-7">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
              Daftar Titik Panas Aktif Terdekat (NASA FIRMS 24 Jam · Radius ≤ 150 km)
            </h3>
            {kh?.maxFrp150km != null ? (
              <span className="text-[11px] font-bold text-orange-700">FRP Puncak: {kh.maxFrp150km} MW</span>
            ) : null}
          </div>
          {kh?.points150km?.length ? (
            <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-[10px] font-black uppercase text-slate-500">
                  <tr>
                    <th className="px-2.5 py-1.5">Satelit</th>
                    <th className="px-2.5 py-1.5">Koordinat</th>
                    <th className="px-2.5 py-1.5 text-right">Jarak</th>
                    <th className="px-2.5 py-1.5 text-right">FRP (MW)</th>
                    <th className="px-2.5 py-1.5">Kepercayaan</th>
                    <th className="px-2.5 py-1.5">Tanggal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {kh.points150km.slice(0, 20).map((p, i) => (
                    <tr key={i} className="hover:bg-orange-50/40">
                      <td className="px-2.5 py-1.5 font-semibold text-slate-800">{p.satellite}</td>
                      <td className="px-2.5 py-1.5 font-mono text-[10.5px] text-slate-600">{p.lat.toFixed(3)}, {p.lon.toFixed(3)}</td>
                      <td className="px-2.5 py-1.5 text-right font-mono font-bold text-orange-800">{p.distKm} km</td>
                      <td className="px-2.5 py-1.5 text-right font-mono text-slate-800">{p.frp}</td>
                      <td className="px-2.5 py-1.5">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${p.confidence === 'h' || p.confidence === 'high' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-900'}`}>
                          {p.confidence}
                        </span>
                      </td>
                      <td className="px-2.5 py-1.5 font-mono text-[10.5px] text-slate-500">{p.acqDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center text-xs text-slate-500">
              {kh?.firmsAvailable
                ? 'Tidak terdeteksi titik panas satelit aktif (VIIRS) dalam radius 150 km selama 24 jam terakhir — pantauan api kemungkinan telah padam atau tertutup awan.'
                : 'Sedang menunggu sinkronisasi data satelit NASA FIRMS.'}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
