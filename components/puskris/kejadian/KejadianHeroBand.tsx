'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar,
  CloudRain,
  Compass,
  Flame,
  HeartPulse,
  Hospital,
  Info,
  Layers,
  MapPin,
  RefreshCw,
  ShieldAlert,
  Thermometer,
  Users,
  Waves,
  Wind,
  X,
} from 'lucide-react'
import { PUBLIC_BASE_PATH } from '@/lib/public-path'
import { nf } from '@/lib/puskris/derive'
import { dmy } from '@/lib/puskris/jenis-meta'
import { wilayahHref } from '@/lib/puskris/eoc-event-layer'
import { jenisKejadianHref } from '@/lib/puskris/jenis-kejadian'
import {
  templateMeta,
  type HealthRiskBreakdown,
  type KejadianTemplate,
} from '@/lib/puskris/kejadian-template'
import type { PendukungPayload } from './types'

export default function KejadianHeroBand({
  kejadian,
  template,
  pendukung,
  pendukungLoading,
  onRefreshPendukung,
  riskScore,
  ops,
  nearbyCount,
  pscCount,
  tckTotal,
  onOpenRiskModal,
  onOpenSeismicModal,
  onOpenSourcesModal,
}: {
  kejadian: any
  template: KejadianTemplate
  pendukung: PendukungPayload | null
  pendukungLoading: boolean
  onRefreshPendukung: () => void
  riskScore: HealthRiskBreakdown
  ops: any
  nearbyCount: number
  pscCount: number
  tckTotal: number | null
  onOpenRiskModal: () => void
  onOpenSeismicModal: () => void
  onOpenSourcesModal: () => void
}) {
  const meta = templateMeta(template)
  const [showFullChron, setShowFullChron] = useState(false)

  const kronologis = pendukung?.eocDetail?.kronologis || null
  const facts = pendukung?.eocDetail?.facts || null
  const kecamatan = pendukung?.eocDetail?.kecamatan || kejadian.kecamatan || null
  const wxCur = pendukung?.weather?.current
  const aqCur = pendukung?.airQuality?.current
  const glofas = pendukung?.banjir?.glofas
  const soil = pendukung?.banjir?.soil
  const gempa = pendukung?.gempa
  const karhutla = pendukung?.karhutla

  // Tentukan magnitudo / kedalaman / tsunami / MMI untuk template Gempa dari BMKG (hari sama) -> Narasi EOC -> USGS -> BMKG terdekat
  const bmkgSameWindow = gempa?.mainBmkg && (gempa.mainBmkg.dayDiff ?? 0) <= 2 ? gempa.mainBmkg : null
  const magVal =
    bmkgSameWindow?.mag ??
    facts?.magnitudo ??
    gempa?.maxMag ??
    gempa?.mainBmkg?.mag ??
    null
  const depthVal =
    bmkgSameWindow?.depthKm ??
    facts?.kedalamanKm ??
    gempa?.catalog?.[0]?.depthKm ??
    gempa?.mainBmkg?.depthKm ??
    null
  const tsunamiVal =
    bmkgSameWindow?.potensi ||
    facts?.tsunamiStatus ||
    gempa?.mainBmkg?.potensi ||
    (gempa?.marineWaveMaxM != null ? `Pantauan gelombang ${gempa.marineWaveMaxM} m` : null)
  const mmiVal = bmkgSameWindow?.mmi || facts?.feltNote || gempa?.mainBmkg?.mmi || null

  // 4 Parameter Karakteristik Dinamis berdasarkan Template
  const charRows: { icon: any; label: string; value: string; sub?: string; tone?: string }[] = (() => {
    if (template === 'gempa') {
      return [
        {
          icon: Activity,
          label: 'Magnitudo & Kedalaman',
          value: magVal != null ? `M ${Number(magVal).toFixed(1)} SR` : 'Belum tersedia di BMKG/EOC',
          sub: depthVal != null ? `Kedalaman ${depthVal} km` : 'Kedalaman belum tercatat',
          tone: magVal != null && magVal >= 5.5 ? 'text-rose-700' : 'text-slate-900',
        },
        {
          icon: Waves,
          label: 'Potensi Tsunami',
          value: tsunamiVal || 'Pemantauan BMKG',
          sub: gempa?.gdacsAlerts?.length ? `GDACS: ${gempa.gdacsAlerts[0].alertLevel}` : 'Tidak ada peringatan GDACS aktif',
        },
        {
          icon: ShieldAlert,
          label: 'Intensitas Guncangan',
          value: mmiVal || 'Tidak tercatat MMI',
          sub: gempa?.usgsCount ? `${gempa.usgsCount} kejadian M2.5+ (radius 350 km)` : 'Katalog USGS dalam jangkauan',
        },
        {
          icon: Thermometer,
          label: 'Cuaca Area Terdampak',
          value: wxCur ? `${wxCur.weatherLabel} · ${wxCur.tempC ?? '—'}°C` : 'Menghubungkan Open-Meteo',
          sub: wxCur ? `Kelembapan ${wxCur.humidityPct ?? '—'}% · Angin ${wxCur.windSpeedKmh ?? '—'} km/jam` : undefined,
        },
      ]
    }
    if (template === 'banjir') {
      return [
        {
          icon: CloudRain,
          label: 'Curah Hujan Pemicu / Hari Kejadian',
          value:
            pendukung?.weather?.eventDayRainMm != null
              ? `${pendukung.weather.eventDayRainMm} mm`
              : wxCur?.rainMm != null
              ? `${wxCur.rainMm} mm (saat ini)`
              : 'Menunggu data cuaca',
          sub:
            pendukung?.weather?.rain7dSumMm != null
              ? `Akumulasi 7 hari: ${pendukung.weather.rain7dSumMm} mm`
              : facts?.tinggiAirText
              ? `Tinggi genangan laporan: ${facts.tinggiAirText}`
              : undefined,
          tone: (pendukung?.weather?.eventDayRainMm || 0) >= 50 ? 'text-rose-700' : 'text-sky-800',
        },
        {
          icon: Waves,
          label: 'Debit Sungai GloFAS (Open-Meteo)',
          value: glofas ? `${glofas.currentDischarge} m³/s (${glofas.status})` : 'Data GloFAS belum tersedia',
          sub: glofas ? `Puncak: ${glofas.peakDischarge} m³/s · Rerata: ${glofas.avgDischarge} m³/s` : undefined,
        },
        {
          icon: Layers,
          label: 'Kejenuhan Tanah & Laporan Warga',
          value: soil ? `${soil.saturationPct}% Jenuh (${soil.status})` : facts?.tinggiAirText || 'Data tanah belum tersedia',
          sub: pendukung?.banjir?.petaBencana
            ? `PetaBencana ≤100km: ${pendukung.banjir.petaBencana.count} laporan`
            : undefined,
        },
        {
          icon: Thermometer,
          label: 'Cuaca & Kelembapan Real-Time',
          value: wxCur ? `${wxCur.weatherLabel} · ${wxCur.tempC ?? '—'}°C` : '—',
          sub: wxCur ? `RH ${wxCur.humidityPct ?? '—'}% · Tekanan ${wxCur.pressureHpa ?? '—'} hPa` : undefined,
        },
      ]
    }
    if (template === 'karhutla') {
      return [
        {
          icon: Wind,
          label: 'ISPU KLHK (Konversi PM2.5)',
          value: aqCur?.ispu != null ? `${aqCur.ispu} (${aqCur.ispuKategori})` : 'Menunggu data udara',
          sub: aqCur ? `PM2.5: ${aqCur.pm25 ?? '—'} µg/m³ · US AQI: ${aqCur.usAqi ?? '—'}` : undefined,
          tone: (aqCur?.ispu || 0) > 100 ? 'text-amber-800' : 'text-slate-900',
        },
        {
          icon: Flame,
          label: 'Titik Panas NASA FIRMS (VIIRS)',
          value: karhutla?.firmsAvailable
            ? `${karhutla.count24h50km} titik (≤50 km)`
            : 'Menghubungkan NASA FIRMS',
          sub: karhutla?.firmsAvailable
            ? `≤150 km: ${karhutla.count24h150km} titik · Nasional 24j: ${nf(karhutla.nasional24h)}`
            : facts?.luasTerbakarText
            ? `Luas terbakar laporan: ${facts.luasTerbakarText}`
            : undefined,
          tone: (karhutla?.count24h50km || 0) > 0 ? 'text-orange-700' : 'text-slate-900',
        },
        {
          icon: Compass,
          label: 'Arah & Sebaran Plume Asap',
          value: wxCur?.windCompass
            ? `Dari ${wxCur.windCompass.fromLabel} → Ke ${wxCur.windCompass.toLabel}`
            : 'Data angin belum tersedia',
          sub: wxCur ? `Kecepatan ${wxCur.windSpeedKmh ?? '—'} km/jam · Gust ${wxCur.windGustsKmh ?? '—'} km/jam` : undefined,
        },
        {
          icon: AlertTriangle,
          label: 'Risiko Kebakaran Cuaca (CBI)',
          value: karhutla?.fireDanger ? `${karhutla.fireDanger.level} (${karhutla.fireDanger.score})` : 'Dalam evaluasi',
          sub: karhutla?.fireDanger?.basis,
        },
      ]
    }
    return [
      {
        icon: Thermometer,
        label: 'Cuaca Terkini (Open-Meteo)',
        value: wxCur ? `${wxCur.weatherLabel} · ${wxCur.tempC ?? '—'}°C` : '—',
        sub: wxCur ? `RH ${wxCur.humidityPct ?? '—'}% · Tekanan ${wxCur.pressureHpa ?? '—'} hPa` : undefined,
      },
      {
        icon: CloudRain,
        label: 'Curah Hujan Harian & 7 Hari',
        value: pendukung?.weather?.eventDayRainMm != null ? `${pendukung.weather.eventDayRainMm} mm` : '—',
        sub: pendukung?.weather?.rain7dSumMm != null ? `Akumulasi 7 hari: ${pendukung.weather.rain7dSumMm} mm` : undefined,
      },
      {
        icon: Wind,
        label: 'Kualitas Udara (ISPU / PM2.5)',
        value: aqCur?.ispu != null ? `ISPU ${aqCur.ispu} · ${aqCur.ispuKategori}` : '—',
        sub: aqCur ? `PM2.5 ${aqCur.pm25 ?? '—'} µg/m³ · CO ${aqCur.co ?? '—'} µg/m³` : undefined,
      },
      {
        icon: Building2,
        label: 'Status Faskes & IRBI Wilayah',
        value: ops?.irbi != null ? `IRBI ${ops.irbi} (${ops.kelas || 'Terpetakan'})` : 'Data IRBI belum tersedia',
        sub: `Faskes rusak EOC: ${nf(kejadian.faskes_rusak)} unit`,
      },
    ]
  })()

  return (
    <div className="space-y-3" data-testid="kejadian-hero-band">
      {/* Top navigation & action bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Link
            href={`${PUBLIC_BASE_PATH}/dashboard/situasi-krisis`}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-bold text-slate-700 hover:bg-slate-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Pantauan Krisis
          </Link>
          <Link
            href={`${PUBLIC_BASE_PATH}/kejadian`}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-bold text-slate-700 hover:bg-slate-50"
          >
            Daftar Kejadian
          </Link>
          <Link
            href={`${PUBLIC_BASE_PATH}/dashboard/spatial-mode`}
            className="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50/70 px-2.5 py-1 font-bold text-teal-800 hover:bg-teal-100"
          >
            Peta Spasial
          </Link>
          {kejadian.code || kejadian.kab_code ? (
            <Link
              href={wilayahHref(String(kejadian.kab_code || kejadian.code), { tahun: kejadian.tanggal, jenis: kejadian.jenis })}
              className="inline-flex items-center gap-1 rounded-lg border border-[#00705a] bg-[#00705a] px-2.5 py-1 font-bold text-white hover:bg-[#005a48]"
            >
              Lihat detail wilayah
            </Link>
          ) : null}
          {kejadian.jenis ? (
            <Link
              href={jenisKejadianHref(String(kejadian.jenis), { tahun: kejadian.tanggal })}
              data-testid="kejadian-link-jenis-nasional"
              className="inline-flex items-center gap-1 rounded-lg border border-[#00705a] bg-white px-2.5 py-1 font-bold text-[#00705a] hover:bg-[#00705a]/10"
            >
              Lihat semua {kejadian.jenis}
            </Link>
          ) : null}
        </div>

        {/* Telemetry refresh + source status */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onRefreshPendukung}
            disabled={pendukungLoading}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            title="Muat ulang data real-time dari API pendukung"
          >
            <RefreshCw className={`h-3 w-3 ${pendukungLoading ? 'animate-spin text-teal-600' : ''}`} />
            <span className="hidden sm:inline">Perbarui</span>
          </button>

          <button
            type="button"
            onClick={onOpenSourcesModal}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
          >
            <Info className="h-3 w-3 text-teal-700" />
            <span>Sumber API</span>
          </button>
        </div>
      </div>

      {/* Main Hero Grid: Left 8-col Merged Identity/Characteristics/Timeline + Right 4-col 3 KPI Cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Card 1: 3-column summary + kronologis footer */}
        <section className={`flex flex-col justify-between rounded-2xl border bg-gradient-to-br p-5 shadow-2xs lg:col-span-8 ${meta.bannerClass}`}>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
            {/* Col 1: Disaster Identity & City */}
            <div className="flex flex-col justify-between space-y-3 md:col-span-4 md:border-r md:border-slate-200/80 md:pr-4">
              <div>
                <h1 className="text-xl font-black uppercase leading-tight text-slate-900 sm:text-2xl" data-testid="kejadian-judul">
                  {kejadian.jenis}
                </h1>

                <div className="mt-2 space-y-1 text-xs text-slate-600">
                  <p className="flex items-start gap-1.5 font-bold text-slate-800">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#00705a]" />
                    <span>
                      {kejadian.kabupaten}
                      {kejadian.provinsi ? `, ${kejadian.provinsi}` : ''}
                    </span>
                  </p>
                  {kecamatan ? (
                    <p className="pl-5 text-[11px] text-slate-600">
                      Kecamatan: <span className="font-semibold text-slate-800">{kecamatan}</span>
                    </p>
                  ) : null}
                  <p className="flex items-center gap-1.5 text-[11px] text-slate-600">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span>
                      {pendukung?.eocDetail?.tglDisplay || `${dmy(kejadian.tanggal)}${kejadian.jam ? ` · ${kejadian.jam} WIB` : ''}`}
                    </span>
                  </p>
                </div>
              </div>

              {/* Risk Score pill + Coordinates */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={onOpenRiskModal}
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition hover:brightness-95 ${riskScore.badgeClass}`}
                  data-testid="risk-score-trigger"
                >
                  <div>
                    <div className="text-[9.5px] font-black uppercase tracking-wider opacity-80">Skor Risiko Kesehatan</div>
                    <div className="text-sm font-black tabular-nums">
                      {riskScore.score} / 100 · {riskScore.level}
                    </div>
                  </div>
                  <Info className="h-4 w-4 shrink-0 opacity-75" />
                </button>
                <p className="font-mono text-[10px] text-slate-500">
                  Koordinat:{' '}
                  {kejadian.lat != null && kejadian.lon != null
                    ? `${Number(kejadian.lat).toFixed(4)}, ${Number(kejadian.lon).toFixed(4)}`
                    : 'Koordinat belum tersedia'}
                </p>
              </div>
            </div>

            {/* Col 2: Dynamic Characteristics per Template */}
            <div className="space-y-2 md:col-span-4 md:border-r md:border-slate-200/80 md:pr-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Karakteristik {template.toUpperCase()}
                </span>
                {pendukungLoading ? <span className="text-[10px] font-semibold text-teal-700">Memuat live…</span> : null}
              </div>
              <div className="space-y-2">
                {charRows.map((c, idx) => {
                  const Icon = c.icon
                  return (
                    <div key={idx} className="rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2 shadow-2xs">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <Icon className="h-3 w-3 text-[#00705a]" />
                        <span>{c.label}</span>
                      </div>
                      <div className={`mt-0.5 text-xs font-black ${c.tone || 'text-slate-900'}`}>{c.value}</div>
                      {c.sub ? <div className="mt-0.5 text-[10px] text-slate-500">{c.sub}</div> : null}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Col 3: 7-Day Timeline Strip per Template */}
            <div className="flex flex-col justify-between space-y-2 md:col-span-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{meta.stripTitle}</span>
                {template === 'gempa' ? (
                  <button
                    type="button"
                    onClick={onOpenSeismicModal}
                    className="rounded-md bg-rose-700 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-rose-800"
                  >
                    Katalog
                  </button>
                ) : null}
              </div>

              {/* Strip Content per Template */}
              {template === 'gempa' ? (
                <div className="grid grid-cols-1 gap-1.5">
                  {(gempa?.timeline7d || []).length ? (
                    (gempa?.timeline7d || []).slice(0, 7).map((d) => (
                      <div
                        key={d.date}
                        className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-[11px] ${
                          d.isEventDay
                            ? 'border-rose-300 bg-rose-50 font-bold text-rose-900'
                            : 'border-slate-200/80 bg-white/90 text-slate-700'
                        }`}
                      >
                        <span className="w-20 shrink-0">{d.label}</span>
                        <span className="font-mono font-bold">
                          {d.maxMag != null ? `M ${d.maxMag.toFixed(1)}` : 'Nihil M2.5+'}
                        </span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                          {d.count}x
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-white/70 p-3 text-[11px] text-slate-500">
                      {pendukungLoading ? 'Mengambil katalog seismik BMKG & USGS…' : 'Belum ada data harian USGS/BMKG di rentang tanggal ini.'}
                    </div>
                  )}
                </div>
              ) : template === 'karhutla' ? (
                <div className="grid grid-cols-1 gap-1.5">
                  {(pendukung?.airQuality?.daily || []).length ? (
                    (pendukung?.airQuality?.daily || []).slice(-7).map((d) => (
                      <div
                        key={d.date}
                        className="flex items-center justify-between rounded-lg border border-slate-200/80 bg-white/90 px-2.5 py-1.5 text-[11px]"
                      >
                        <span className="w-20 shrink-0 font-semibold text-slate-700">{d.label}</span>
                        <span className="font-mono text-[10.5px] font-bold text-slate-600">
                          PM2.5 {d.pm25Max}
                        </span>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-black text-white"
                          style={{ backgroundColor: d.barColor }}
                        >
                          ISPU {d.ispu ?? '—'}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-white/70 p-3 text-[11px] text-slate-500">
                      {pendukungLoading ? 'Memuat tren ISPU & titik panas harian…' : 'Data harian kualitas udara belum tersedia.'}
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-1.5">
                  {(pendukung?.weather?.daily7d || []).length ? (
                    (pendukung?.weather?.daily7d || []).slice(0, 7).map((d) => (
                      <div
                        key={d.date}
                        className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-[11px] ${
                          d.isEventDay
                            ? 'border-sky-300 bg-sky-50 font-bold text-sky-900'
                            : 'border-slate-200/80 bg-white/90 text-slate-700'
                        }`}
                      >
                        <span className="w-20 shrink-0">{d.label}</span>
                        <span className="truncate px-1 text-[10.5px] text-slate-600">{d.weatherLabel}</span>
                        <span className="shrink-0 font-mono font-bold text-sky-800">{d.precipSum} mm</span>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-white/70 p-3 text-[11px] text-slate-500">
                      {pendukungLoading ? 'Memuat histori cuaca 7 hari Open-Meteo…' : 'Histori curah hujan belum tersedia.'}
                    </div>
                  )}
                </div>
              )}

              <p className="text-[10px] text-slate-400">
                {template === 'gempa'
                  ? 'Radius ±350 km sekitar episentrum · BMKG & USGS'
                  : template === 'karhutla'
                  ? 'Konversi Permen LHK P.14/2020 · Open-Meteo CAMS'
                  : 'Jendela waktu kejadian · Open-Meteo Weather & Archive'}
              </p>
            </div>
          </div>

          {/* Bottom Bulletin / Kronologis */}
          <div className="mt-4 border-t border-slate-200/80 pt-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Kronologis
                </span>
                <p className={`mt-0.5 text-xs leading-relaxed text-slate-700 ${showFullChron ? '' : 'line-clamp-2'}`}>
                  {kronologis ||
                    `Laporan kejadian ${kejadian.jenis} di ${kejadian.kabupaten}${kejadian.provinsi ? `, ${kejadian.provinsi}` : ''} tanggal ${dmy(kejadian.tanggal)}. Kronologis naratif belum tersedia untuk kejadian ini.`}
                </p>
              </div>
              {kronologis && kronologis.length > 150 ? (
                <button
                  type="button"
                  onClick={() => setShowFullChron((s) => !s)}
                  className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10.5px] font-bold text-slate-700 hover:bg-slate-50"
                >
                  {showFullChron ? 'Ringkas' : 'Baca Lengkap'}
                </button>
              ) : null}
            </div>
          </div>
        </section>

        {/* Right 3 Stacked KPI Summary Cards */}
        <aside className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:col-span-4 lg:grid-cols-1">
          {/* Card 2: Total Korban Jiwa & Luka */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Dampak Korban Jiwa & Luka</span>
              <HeartPulse className="h-4 w-4 text-rose-600" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black tabular-nums text-slate-900">{nf(kejadian.korban)}</span>
              <span className="text-xs font-semibold text-slate-500">total tercatat</span>
            </div>
            <div className="mt-2.5 grid grid-cols-4 gap-1.5 text-center">
              <div className="rounded-lg bg-rose-50 px-1.5 py-1">
                <div className="text-[9.5px] font-bold text-rose-700">Meninggal</div>
                <div className="text-xs font-black tabular-nums text-rose-900">{nf(kejadian.meninggal)}</div>
              </div>
              <div className="rounded-lg bg-amber-50 px-1.5 py-1">
                <div className="text-[9.5px] font-bold text-amber-800">Hilang</div>
                <div className="text-xs font-black tabular-nums text-amber-950">{nf(kejadian.hilang)}</div>
              </div>
              <div className="rounded-lg bg-orange-50 px-1.5 py-1">
                <div className="text-[9.5px] font-bold text-orange-800">L. Berat</div>
                <div className="text-xs font-black tabular-nums text-orange-950">{nf(kejadian.luka_berat)}</div>
              </div>
              <div className="rounded-lg bg-slate-50 px-1.5 py-1">
                <div className="text-[9.5px] font-bold text-slate-600">L. Ringan</div>
                <div className="text-xs font-black tabular-nums text-slate-900">{nf(kejadian.luka_ringan)}</div>
              </div>
            </div>
          </div>

          {/* Card 3: Penduduk Terdampak & Pengungsi */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Penduduk Terdampak & Mengungsi</span>
              <Users className="h-4 w-4 text-sky-700" />
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <div>
                <span className="text-2xl font-black tabular-nums text-slate-900">{nf(kejadian.terdampak)}</span>
                <span className="ml-1.5 text-xs font-semibold text-slate-500">terdampak</span>
              </div>
              <div className="text-right">
                <span className="text-lg font-black tabular-nums text-sky-800">{nf(kejadian.pengungsi)}</span>
                <span className="ml-1 text-[11px] font-semibold text-slate-500">pengungsi</span>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              {(pendukung?.eocDetail?.posPengungsi?.length || 0) > 0
                ? `${pendukung?.eocDetail?.posPengungsi?.length} posko tercatat · ${(pendukung?.eocDetail?.perkembangan?.length || 0)} laporan perkembangan`
                : `${pendukung?.eocDetail?.perkembangan?.length || 0} pembaruan perkembangan EOC tercatat`}
            </p>
          </div>

          {/* Card 4: Kesiapan Faskes, PSC 119 & TCK */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Jejaring Kesehatan & TCK Provinsi</span>
              <Hospital className="h-4 w-4 text-[#00705a]" />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-teal-50/70 px-2 py-1.5">
                <div className="text-[9.5px] font-bold text-teal-800">Faskes / PSC</div>
                <div className="text-sm font-black tabular-nums text-teal-950">
                  {nf(nearbyCount)} <span className="text-[10px] font-semibold">({pscCount} PSC)</span>
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                <div className="text-[9.5px] font-bold text-slate-600">Faskes Rusak</div>
                <div className="text-sm font-black tabular-nums text-slate-900">{nf(kejadian.faskes_rusak)}</div>
              </div>
              <div className="rounded-lg bg-emerald-50/70 px-2 py-1.5">
                <div className="text-[9.5px] font-bold text-emerald-800">TCK Terdaftar</div>
                <div className="text-sm font-black tabular-nums text-emerald-950">{tckTotal != null ? nf(tckTotal) : '—'}</div>
              </div>
            </div>
            <p className="mt-2 text-[10.5px] text-slate-500">
              {ops?.statusLayanan ? `Status layanan sekitar: ${ops.statusLayanan}` : 'Menggabungkan data RS, PSC 119 & TCK regional'}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
