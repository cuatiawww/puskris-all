'use client'

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, AlertTriangle, Building2, Clock, ShieldAlert, Waves } from 'lucide-react'
import ApiKosong from '@/components/puskris/ApiKosong'
import { PUBLIC_BASE_PATH } from '@/lib/public-path'
import { nf } from '@/lib/puskris/derive'
import type { PendukungPayload } from './types'

export default function GempaTemplatePanel({
  kejadian,
  pendukung,
  onOpenSeismicModal,
}: {
  kejadian: any
  pendukung: PendukungPayload | null
  onOpenSeismicModal: () => void
}) {
  const gempa = pendukung?.gempa
  const eoc = pendukung?.eocDetail
  const facts = eoc?.facts
  const mainBmkg = gempa?.mainBmkg

  const shakemapSrc = mainBmkg?.shakemapProxyUrl
    ? `${PUBLIC_BASE_PATH}${mainBmkg.shakemapProxyUrl}`
    : null

  return (
    <section className="space-y-4" data-testid="template-gempa-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider text-rose-700">Template Gempa Bumi & Seismik Tektonik</span>
          <h2 className="text-base font-black text-slate-900">
            Parameter BMKG/USGS, Peta Guncangan (Shakemap), Aktivitas Susulan & Kesiapan Rujukan Trauma
          </h2>
        </div>
        <button
          type="button"
          onClick={onOpenSeismicModal}
          className="inline-flex items-center gap-1.5 rounded-xl bg-rose-700 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-rose-800"
        >
          <Activity className="h-3.5 w-3.5" /> Buka Katalog Lengkap ({gempa?.catalog?.length || 0} gempa)
        </button>
      </div>

      {/* Main Row: BMKG Shakemap/Highlights + USGS 7-Day Aftershock Frequency Chart */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* BMKG Official Event & Shakemap */}
        <div className="skdr-card flex flex-col justify-between p-4 lg:col-span-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-700">
                Konfirmasi Tektonik & Shakemap BMKG
              </span>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                {mainBmkg ? 'Matched ≤ 380 km' : 'Dari Laporan EOC'}
              </span>
            </div>

            {mainBmkg ? (
              <div className="space-y-2 rounded-xl border border-rose-200 bg-rose-50/50 p-3 text-xs">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-lg font-black text-rose-800">M {mainBmkg.mag.toFixed(1)}</span>
                  <span className="font-mono text-[11px] text-slate-600">{mainBmkg.timeWib}</span>
                </div>
                <p className="font-bold text-slate-800">{mainBmkg.place}</p>
                <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-700">
                  <div>Kedalaman: <b>{mainBmkg.depthKm} km</b></div>
                  <div>Jarak: <b>{mainBmkg.distKm != null ? `${mainBmkg.distKm} km` : '—'}</b></div>
                  <div className="col-span-2">MMI: <b>{mainBmkg.mmi || 'Belum ada laporan MMI'}</b></div>
                  {mainBmkg.potensi ? <div className="col-span-2 text-rose-800"><b>{mainBmkg.potensi}</b></div> : null}
                </div>
              </div>
            ) : (
              <div className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs">
                <p className="font-bold text-slate-800">Parameter dari Kronologis</p>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700">
                  <div>Magnitudo: <b>{facts?.magnitudo ? `M ${facts.magnitudo}` : '—'}</b></div>
                  <div>Kedalaman: <b>{facts?.kedalamanKm ? `${facts.kedalamanKm} km` : '—'}</b></div>
                  <div className="col-span-2">Tsunami: <b>{facts?.tsunamiStatus || '—'}</b></div>
                  <div className="col-span-2">Guncangan: <b>{facts?.feltNote || '—'}</b></div>
                </div>
              </div>
            )}

            {/* Shakemap Image (CSP-safe via /api/puskris/open/shakemap) */}
            {shakemapSrc ? (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950/5">
                <img
                  src={shakemapSrc}
                  alt={`Peta Guncangan BMKG ${mainBmkg?.place || kejadian.kabupaten}`}
                  className="h-52 w-full object-contain bg-white"
                />
                <div className="border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-[10px] text-slate-500">
                  Peta Guncangan (Shakemap) resmi BMKG · Diambil aman melalui proxy server
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-center text-[11px] text-slate-500">
                Gambar Shakemap BMKG tidak dilampirkan pada feed terbaru untuk episentrum ini (feed M5+/dirasakan hanya menyimpan Shakemap gempa signifikan terkini).
              </div>
            )}
          </div>
        </div>

        {/* USGS & BMKG Aftershock Frequency & Progression */}
        <div className="skdr-card flex flex-col justify-between p-4 lg:col-span-7">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-rose-700">
                <Activity className="h-3.5 w-3.5" /> USGS FDSN Catalog (M2.5+ · Radius 350 km)
              </div>
              <h3 className="text-sm font-black text-slate-900">Tren Harian Kejadian Gempa Utama & Susulan</h3>
            </div>
            <div className="flex gap-2 text-right text-[11px]">
              <div className="rounded-lg bg-slate-50 px-2.5 py-1">
                <div className="text-[9.5px] text-slate-400">Total Tercatat</div>
                <div className="font-black text-slate-900">{gempa?.usgsCount ?? 0} gempa</div>
              </div>
              <div className="rounded-lg bg-rose-50 px-2.5 py-1">
                <div className="text-[9.5px] text-rose-700">Maks Magnitudo</div>
                <div className="font-black text-rose-900">{gempa?.maxMag != null ? `M ${gempa.maxMag.toFixed(1)}` : '—'}</div>
              </div>
            </div>
          </div>

          <div className="h-56">
            {(gempa?.timeline7d || []).length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gempa?.timeline7d || []} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={36} />
                  <Tooltip
                    formatter={(val: any, _name: any, p: any) => [
                      `${val} gempa (Maks: ${p?.payload?.maxMag != null ? `M ${p.payload.maxMag}` : '—'})`,
                      'Frekuensi',
                    ]}
                  />
                  <Bar dataKey="count" name="Frekuensi Gempa" fill="#be123c" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ApiKosong pesan="Belum ada data seri 7 hari USGS di jangkauan ini" />
            )}
          </div>

          {/* GDACS + Marine coastal check + Protokol Trauma Medis */}
          <div className="mt-4 grid grid-cols-1 gap-2.5 border-t border-slate-100 pt-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs">
              <div className="flex items-center gap-1.5 font-black text-slate-800">
                <Waves className="h-3.5 w-3.5 text-sky-700" /> Evaluasi Tsunami & Gelombang Pesisir
              </div>
              <p className="mt-1 text-[11px] text-slate-600">
                {facts?.tsunamiStatus || mainBmkg?.potensi || 'Belum ada peringatan tsunami aktif.'}
                {gempa?.marineWaveMaxM != null ? ` · Tinggi gelombang pesisir terdekat: ${gempa.marineWaveMaxM} m.` : ''}
              </p>
              {gempa?.gdacsAlerts?.length ? (
                <p className="mt-1 text-[10.5px] font-bold text-amber-800">
                  GDACS Alert: {gempa.gdacsAlerts[0].title} ({gempa.gdacsAlerts[0].alertLevel})
                </p>
              ) : null}
            </div>

            <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-3 text-xs">
              <div className="flex items-center gap-1.5 font-black text-rose-900">
                <ShieldAlert className="h-3.5 w-3.5 text-rose-700" /> Protokol Triase Trauma & RS Lapangan
              </div>
              <p className="mt-1 text-[11px] text-slate-700">
                Pastikan integritas struktural IGD ({nf(kejadian.faskes_rusak)} faskes rusak tercatat), kesiagaan tim ortopedi/bedah untuk luka berat ({nf(kejadian.luka_berat)} jiwa), dan tenda triase luar ruang saat potensi susulan berlangsung.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* EOC Perkembangan & Recent Seismic List Preview */}
      {(eoc?.perkembangan?.length || gempa?.catalog?.length) ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* EOC Perkembangan */}
          <div className="skdr-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-600" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">Perkembangan Laporan EOC ({eoc?.perkembangan?.length || 0} pembaruan)</h3>
            </div>
            {eoc?.perkembangan?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500">
                    <tr>
                      <th className="px-2.5 py-1.5">Waktu Laporan</th>
                      <th className="px-2.5 py-1.5 text-right">Terdampak</th>
                      <th className="px-2.5 py-1.5 text-right">Mengungsi</th>
                      <th className="px-2.5 py-1.5 text-right">Meninggal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {eoc.perkembangan.map((p, i) => (
                      <tr key={i}>
                        <td className="px-2.5 py-1.5 font-semibold text-slate-800">{p.label || p.tanggal}</td>
                        <td className="px-2.5 py-1.5 text-right font-mono">{nf(p.terdampak)}</td>
                        <td className="px-2.5 py-1.5 text-right font-mono">{nf(p.pengungsi)}</td>
                        <td className="px-2.5 py-1.5 text-right font-mono text-rose-700">{nf(p.meninggal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500">Baru terdapat 1 laporan awal (belum ada log perkembangan susulan di EOC).</p>
            )}
          </div>

          {/* Faskes Terdampak & Top 5 Gempa Sekitar */}
          <div className="skdr-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-rose-700" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">Ringkasan Gempa Terbesar Sekitar Lokasi (≤ 350 km)</h3>
            </div>
            {gempa?.catalog?.length ? (
              <div className="space-y-1.5">
                {gempa.catalog.slice(0, 5).map((g) => (
                  <div key={g.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs">
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-rose-700">M {g.mag.toFixed(1)}</span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">{g.source}</span>
                        <span className="truncate font-semibold text-slate-800">{g.place}</span>
                      </div>
                      <div className="text-[10.5px] text-slate-500">
                        {g.timeWib} · Kedalaman {g.depthKm} km{g.mmi ? ` · ${g.mmi}` : ''}
                      </div>
                    </div>
                    <span className="shrink-0 font-mono text-[11px] font-bold text-slate-600">{g.distKm != null ? `${g.distKm} km` : '—'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500">Tidak ada kejadian gempa tambahan dalam katalog USGS/BMKG radius 350 km.</p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}
