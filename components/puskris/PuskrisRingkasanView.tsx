'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle, Ambulance, Building2, CheckCircle, Clock, HeartPulse,
  Layers, Package, PhoneCall, ShieldCheck, Users, XCircle,
} from 'lucide-react'
import { applyDerive, nf, pf, situasiTerfilter } from '@/lib/puskris/derive'
import { buildJenisCards } from '@/lib/puskris/to-spasial'
import { tahunIni, toDeriveFilter, type PuskrisTab, type PuskrisUiFilter } from '@/lib/puskris/ui-filter'
import PuskrisSumberSections from '@/components/puskris/PuskrisSumberSections'
import PuskrisPetaTerpadu from '@/components/puskris/PuskrisPetaTerpadu'
import LiniMasaRespons from '@/components/puskris/LiniMasaRespons'
import SectionHead from '@/components/puskris/SectionHead'
import InfoHint from '@/components/puskris/InfoHint'
import DampakPendudukStrip from '@/components/puskris/DampakPendudukStrip'
import { EMT_LABEL, NCC_LABEL } from '@/lib/puskris/labels'
import { NASIONAL_NOTE, withQuery } from '@/lib/puskris/pages'
import { jenisTrendSeries } from '@/lib/puskris/analisis-charts'
import { jenisKejadianHref, jenisKejadianIndexHref } from '@/lib/puskris/jenis-kejadian'
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { buildTimeline } from '@/lib/puskris/integrasi'
import ApiKosong from '@/components/puskris/ApiKosong'

function JenisBars({ items, selected, onSelect, tahun }: {
  items: { nama: string; kejadian: number }[]
  selected: string | null
  onSelect: (nama: string | null) => void
  tahun?: number
}) {
  const max = Math.max(1, ...items.map((i) => i.kejadian))
  return (
    <div className="skdr-card flex h-full flex-col p-3" data-testid="jenis-bars">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-700">Jenis kejadian</h3>
        <div className="flex items-center gap-2">
          <Link href={jenisKejadianIndexHref({ tahun })} data-testid="jenis-bars-lihat-semua" className="text-[10px] font-bold text-primary hover:underline">Lihat per jenis kejadian</Link>
          {selected ? (
            <Link href={jenisKejadianHref(selected, { tahun })} data-testid="jenis-bars-lihat-nasional" className="text-[10px] font-bold text-primary hover:underline">Lihat {selected}</Link>
          ) : null}
          {selected ? (
            <button type="button" onClick={() => onSelect(null)} className="text-[10px] font-bold text-primary hover:underline">Hapus filter</button>
          ) : null}
        </div>
      </div>
      {!items.length ? <ApiKosong pesan="Tidak ada data jenis kejadian dari API EOC untuk filter ini" compact /> : null}
      <ul className="min-h-0 flex-1 space-y-1 overflow-auto">
        {items.slice(0, 8).map((c) => {
          const on = selected === c.nama
          return (
            <li key={c.nama} className={`flex items-center gap-1 rounded-lg px-1 py-0.5 ${on ? "bg-primary/10" : "hover:bg-slate-50"}`}>
              <button
                type="button"
                onClick={() => onSelect(on ? null : c.nama)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                title="Saring ringkasan ke jenis ini"
              >
                <span className="w-[46%] truncate text-[11px] font-semibold text-slate-700">{c.nama}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${(c.kejadian / max) * 100}%` }} />
                </span>
                <span className="w-9 text-right text-[11px] font-bold tabular-nums text-slate-800">{c.kejadian.toLocaleString("id-ID")}</span>
              </button>
              <Link
                href={jenisKejadianHref(c.nama, { tahun })}
                data-testid="jenis-bars-row-link"
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-[#047D78] hover:bg-[#047D78]/10 hover:underline"
                title={`Buka dashboard ${c.nama}`}
              >
                Lihat
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

const lLiveTop = (raw: any) => raw?.logistik?.data_source === 'langsung'

function TrenJenisCard({ kejadian, f }: { kejadian: any[] | null; f: PuskrisUiFilter }) {
  const trend = jenisTrendSeries(kejadian, f)
  return (
    <div className="skdr-card flex h-full flex-col p-3" data-testid="tren-jenis-card">
      <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-700">Tren kejadian per jenis</h3>
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        <p className="line-clamp-2 text-[10px] text-slate-500">{trend.catatan}</p>
      </div>
      {trend.nasionalOnly ? <p className="mb-1 text-[10px] font-semibold text-amber-800">{NASIONAL_NOTE} Deret bulanan tidak terpecah per provinsi.</p> : null}
      <div className="h-44">
        {trend.rows.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend.rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} width={32} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {trend.keys.map((k) => (
                <Area key={k} type="monotone" dataKey={k} stackId="jenis" stroke={trend.colors[k]} fill={trend.colors[k]} fillOpacity={0.85} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          kejadian ? <p className="py-10 text-center text-xs text-slate-500">Tidak ada kejadian untuk filter ini.</p> : <ApiKosong pesan="Data kejadian belum tersedia dari API EOC" />
        )}
      </div>
    </div>
  )
}

type KpiTrend = {
  pct: number
  vsLabel: string
  /** true untuk metrik bencana/korban (turun = hijau/baik, naik = merah/waspada) */
  invertGood?: boolean
}

function seriesTrend(arr?: { tahun: number; jumlah: number }[], invertGood = true): KpiTrend | null {
  if (!arr || arr.length < 2) return null
  const prev = arr[arr.length - 2]
  const cur = arr[arr.length - 1]
  if (!prev || !prev.jumlah || prev.jumlah <= 0 || cur == null) return null
  const pct = Math.round(((cur.jumlah - prev.jumlah) * 1000) / prev.jumlah) / 10
  return { pct, vsLabel: `vs ${prev.tahun}`, invertGood }
}

function sumSeriesTrend(a?: { tahun: number; jumlah: number }[], b?: { tahun: number; jumlah: number }[], invertGood = true): KpiTrend | null {
  if (!a || a.length < 2) return null
  const mapB = new Map((b || []).map((x) => [x.tahun, Number(x.jumlah || 0)]))
  const combined = a.map((x) => ({ tahun: x.tahun, jumlah: Number(x.jumlah || 0) + (mapB.get(x.tahun) || 0) }))
  return seriesTrend(combined, invertGood)
}

function pairTrend(cur: number | null | undefined, prev: number | null | undefined, vsLabel: string, invertGood = false): KpiTrend | null {
  if (cur == null || prev == null || prev <= 0) return null
  const pct = Math.round(((cur - prev) * 1000) / prev) / 10
  return { pct, vsLabel, invertGood }
}

function KpiCardItem({
  label, value, unit, sub, icon: Icon, tone = 'primary', href, note, trend, source,
}: {
  label: string
  value: React.ReactNode
  unit?: string
  sub?: React.ReactNode
  icon: any
  tone?: 'primary' | 'amber' | 'emerald' | 'blue' | 'rose' | 'orange' | 'teal'
  href?: string
  note?: string | null
  trend?: KpiTrend | null
  source?: string | null
}) {
  const toneClasses = {
    primary: { border: 'border-l-primary hover:border-primary/60', bg: 'bg-primary/10 text-primary' },
    amber: { border: 'border-l-amber-500 hover:border-amber-400', bg: 'bg-amber-50 text-amber-600' },
    emerald: { border: 'border-l-emerald-500 hover:border-emerald-400', bg: 'bg-emerald-50 text-emerald-600' },
    blue: { border: 'border-l-blue-500 hover:border-blue-400', bg: 'bg-blue-50 text-primary' },
    rose: { border: 'border-l-rose-500 hover:border-rose-400', bg: 'bg-rose-50 text-rose-600' },
    orange: { border: 'border-l-orange-500 hover:border-orange-400', bg: 'bg-orange-50 text-orange-600' },
    teal: { border: 'border-l-teal-600 hover:border-teal-500', bg: 'bg-teal-50 text-teal-700' },
  }[tone] || { border: 'border-l-primary', bg: 'bg-primary/10 text-primary' }

  const trendBadge = trend ? (() => {
    const up = trend.pct > 0
    const down = trend.pct < 0
    const good = trend.invertGood ? down : up
    const bad = trend.invertGood ? up : down
    const cls = good
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : bad
        ? 'border-rose-200 bg-rose-50 text-rose-700'
        : 'border-slate-200 bg-slate-50 text-slate-600'
    const dir = up ? '▲ Naik' : down ? '▼ Turun' : '● Stabil'
    return (
      <div className="mt-2">
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-extrabold tabular-nums ${cls}`}>
          <span>{dir} {Math.abs(trend.pct).toLocaleString('id-ID')}%</span>
          <span className="font-semibold opacity-80">{trend.vsLabel}</span>
        </span>
      </div>
    )
  })() : null

  const content = (
    <div className={`skdr-card relative flex h-full flex-col overflow-hidden border-l-4 ${toneClasses.border} p-3 transition`}>
      <div className="flex items-start justify-between gap-2 text-slate-500">
        <span className={`text-[11px] font-black uppercase leading-tight tracking-wider ${source ? 'min-h-[2.25rem]' : ''}`}>{label}</span>
        <div className={`shrink-0 rounded-lg p-1.5 ${toneClasses.bg}`}><Icon className="h-4 w-4" /></div>
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="text-2xl font-black tracking-tight text-slate-900">{value}</span>
        {unit ? <span className="text-xs font-semibold text-slate-500">{unit}</span> : null}
      </div>
      {sub ? <div className="mt-2 text-xs font-bold text-slate-600">{sub}</div> : null}
      {trendBadge}
      {note ? <div className="mt-2 text-[10px] font-medium text-amber-800">{note}</div> : null}
      {source ? <div className="mt-auto pt-2 text-[10px] font-medium leading-snug text-slate-400">{source}</div> : null}
    </div>
  )

  if (href) {
    return <Link href={href} className="block h-full no-underline">{content}</Link>
  }
  return content
}

function DynamicKpiCards({
  tab, bagian, f, situasi, layanan, sdm, raw, derived,
}: {
  tab: PuskrisTab
  bagian?: string | null
  f: PuskrisUiFilter
  situasi: any
  layanan: any
  sdm: any
  raw: any
  derived: any
}) {
  const isWilayah = Boolean(f.provinsi || f.kabupaten)
  const nasionalTahun = !isWilayah && !f.jenis && f.periode === 'tahun' && f.tahun === tahunIni() && !raw?.eoc?.rentang
  const eocNas = raw?.eoc?.nasional || {}
  const pscSum = raw?.psc?.summary || {}
  const tckSum = raw?.tck?.summary || {}

  const trendKejadian = nasionalTahun ? seriesTrend(eocNas.tren_5_tahun_terpantau, true) : null
  const trendKorbanJiwa = nasionalTahun ? sumSeriesTrend(eocNas.tren_5_tahun_meninggal, eocNas.tren_5_tahun_hilang, true) : null
  const trendKorbanLuka = nasionalTahun ? sumSeriesTrend(eocNas.tren_5_tahun_luka_berat, eocNas.tren_5_tahun_luka_ringan, true) : null
  const trendTerdampak = nasionalTahun ? sumSeriesTrend(eocNas.tren_5_tahun_pengungsi, eocNas.tren_5_tahun_terdampak, true) : null
  const trendPanggilan = !isWilayah
    ? pairTrend(pscSum.total_panggilan, pscSum.total_panggilan_tahun_lalu, `vs ${(pscSum.tahun_panggilan || tahunIni()) - 1}`, false)
    : null
  const trendTckIndividu = !isWilayah && typeof tckSum.individu_delta_pct === 'number' && Number.isFinite(tckSum.individu_delta_pct)
    ? { pct: Math.round(tckSum.individu_delta_pct * 10) / 10, vsLabel: 'vs bulan lalu', invertGood: false }
    : null
  const trendTckTim = !isWilayah && typeof tckSum.tim_delta_pct === 'number' && Number.isFinite(tckSum.tim_delta_pct)
    ? { pct: Math.round(tckSum.tim_delta_pct * 10) / 10, vsLabel: 'vs bulan lalu', invertGood: false }
    : null
  const trendTckEmt = !isWilayah && typeof tckSum.emt_delta_pct === 'number' && Number.isFinite(tckSum.emt_delta_pct)
    ? { pct: Math.round(tckSum.emt_delta_pct * 10) / 10, vsLabel: 'vs bulan lalu', invertGood: false }
    : null

  if (tab === 'krisis') {
    return (
      <section className="skdr-section">
        <SectionHead eyebrow="Pantauan Krisis" title="Indikator Kejadian &amp; Dampak Bencana" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCardItem
            label="Kejadian Bencana"
            value={nf(situasi.terpantau)}
            unit="kejadian"
            sub={`${nf(situasi.berdampak_krisis)} berdampak krisis kesehatan`}
            icon={AlertTriangle}
            tone="primary"
            trend={trendKejadian}
          />
          <KpiCardItem
            label="Korban Jiwa"
            value={situasi.meninggal == null ? '—' : nf((situasi.meninggal || 0) + (situasi.hilang || 0))}
            unit="jiwa"
            sub={`${nf(situasi.meninggal)} meninggal · ${nf(situasi.hilang)} hilang`}
            icon={Users}
            tone="rose"
            trend={trendKorbanJiwa}
          />
          <KpiCardItem
            label="Korban Luka"
            value={situasi.luka_berat == null ? '—' : nf((situasi.luka_berat || 0) + (situasi.luka_ringan || 0))}
            unit="orang"
            sub={`${nf(situasi.luka_berat)} rawat inap · ${nf(situasi.luka_ringan)} rawat jalan`}
            icon={HeartPulse}
            tone="orange"
            trend={trendKorbanLuka}
          />
          <KpiCardItem
            label="Penduduk Terdampak"
            value={situasi.pengungsi == null ? '—' : nf((situasi.pengungsi || 0) + (situasi.terdampak || 0))}
            unit="jiwa"
            sub={`${nf(situasi.pengungsi)} mengungsi · ${nf(situasi.terdampak)} terdampak`}
            icon={Users}
            tone="blue"
            trend={trendTerdampak}
          />
        </div>
        <DampakPendudukStrip raw={raw} situasi={situasi} f={f} />
      </section>
    )
  }

  if (tab === 'layanan') {
    if (bagian === 'psc') {
      return (
        <section className="skdr-section">
          <SectionHead eyebrow="Layanan 119 · PSC 119" title="Kapasitas &amp; Keaktifan Pos Simpul PSC 119" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCardItem
              label="PSC 119 Aktif"
              value={nf(layanan.pscAktif)}
              unit="PSC"
              sub={`${nf(layanan.pscAktif)} dari ${nf(layanan.pscTotal)} kab/kota terdaftar`}
              icon={Building2}
              tone="teal"
            />
            <KpiCardItem
              label="Tingkat Keaktifan"
              value={layanan.pscTotal ? `${Math.round(((layanan.pscAktif || 0) / (layanan.pscTotal || 1)) * 100)}` : '—'}
              unit="%"
              sub="Rasio PSC beroperasi aktif di kab/kota"
              icon={CheckCircle}
              tone="emerald"
            />
            <KpiCardItem
              label="Armada Pendukung"
              value={nf(layanan.ambulans)}
              unit="unit"
              sub="Total ambulans terhubung PSC 119"
              icon={Ambulance}
              tone="blue"
              href={withQuery('/dashboard/layanan-gawat-darurat/ambulans', f)}
            />
            <KpiCardItem
              label="Waktu Respons Rata-rata"
              value={`${layanan.waktuRespons ?? 0}`}
              unit="menit"
              sub="Kecepatan respons PSC 119"
              icon={Clock}
              tone="amber"
            />
          </div>
        </section>
      )
    }

    if (bagian === 'panggilan-119') {
      return (
        <section className="skdr-section">
          <SectionHead eyebrow="Layanan 119 · Panggilan" title="Indikator Panggilan Masuk &amp; Kedaruratan" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCardItem
              label="Total Panggilan 119"
              value={nf(layanan.panggilan)}
              unit="panggilan"
              sub={layanan.panggilanTahun ? `Tahun ${layanan.panggilanTahun}, langsung dari API PSC 119` : 'Data belum tersedia dari API PSC 119'}
              icon={PhoneCall}
              tone="amber"
              trend={trendPanggilan}
              note={isWilayah ? NASIONAL_NOTE : null}
            />
            <KpiCardItem
              label="Tingkat Terjawab (SCR)"
              value={layanan.scr != null ? `${pf(layanan.scr, 1)}` : '—'}
              unit={layanan.scr != null ? '%' : ''}
              sub={NCC_LABEL.scr.replace(' (%)', '')}
              icon={CheckCircle}
              tone="emerald"
            />
            <KpiCardItem
              label="Panggilan Kedaruratan"
              value={`${layanan.emergencyPerkiraan ? '≈ ' : ''}${nf(layanan.emergency || 0)}`}
              unit="kasus"
              sub={layanan.emergencyShare != null ? (layanan.emergencyPerkiraan ? `≈ ${pf(layanan.emergencyShare, 1)} gawat darurat (perkiraan dari sampel panggilan terbaru)` : `${pf(layanan.emergencyShare, 1)} kedaruratan medik`) : 'Kasus darurat 119'}
              icon={AlertTriangle}
              tone="rose"
            />
            <KpiCardItem
              label="Waktu Respons Rata-rata"
              value={`${layanan.waktuRespons ?? 0}`}
              unit="menit"
              sub="Kecepatan respons PSC 119"
              icon={Clock}
              tone="teal"
            />
          </div>
        </section>
      )
    }

    if (bagian === 'ambulans') {
      return (
        <section className="skdr-section">
          <SectionHead eyebrow="Layanan 119 · Ambulans" title="Kapasitas &amp; Kelaikan Armada Ambulans" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCardItem
              label="Total Ambulans"
              value={nf(layanan.ambulans)}
              unit="unit"
              sub="Armada penanganan &amp; transport"
              icon={Ambulance}
              tone="emerald"
            />
            <KpiCardItem
              label="Kondisi Baik"
              value={nf(layanan.ambulansBaik || 0)}
              unit="unit"
              sub={layanan.ambulans ? `${Math.round(((layanan.ambulansBaik || 0) / (layanan.ambulans || 1)) * 100)}% siap operasi` : 'Siap operasi'}
              icon={CheckCircle}
              tone="teal"
            />
            <KpiCardItem
              label="Rusak Ringan"
              value={nf(layanan.ambulansRusakRingan || 0)}
              unit="unit"
              sub="Perlu pemeliharaan berkala"
              icon={AlertTriangle}
              tone="amber"
            />
            <KpiCardItem
              label="Rusak Berat"
              value={nf(layanan.ambulansRusakBerat || 0)}
              unit="unit"
              sub="Tidak siap operasi"
              icon={XCircle}
              tone="rose"
            />
          </div>
        </section>
      )
    }

    return (
      <section className="skdr-section">
        <SectionHead eyebrow="Layanan Gawat Darurat" title="Indikator Kesiapsiagaan PSC &amp; Layanan 119" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCardItem
            label="Total Panggilan 119"
            value={nf(layanan.panggilan)}
            unit="panggilan"
            sub={`${layanan.panggilanTahun ? `Tahun ${layanan.panggilanTahun} · ` : ''}${layanan.emergencyShare != null ? `darurat ${layanan.emergencyPerkiraan ? '≈ ' : ''}${pf(layanan.emergencyShare, 1)}` : 'Panggilan masyarakat'}`}
            icon={PhoneCall}
            tone="amber"
            trend={trendPanggilan}
            href={withQuery('/dashboard/layanan-gawat-darurat/panggilan-119', f)}
            note={isWilayah ? NASIONAL_NOTE : null}
          />
          <KpiCardItem
            label="Tingkat Layanan (SCR)"
            value={layanan.scr != null ? `${pf(layanan.scr, 1)}` : '—'}
            unit={layanan.scr != null ? '%' : ''}
            sub="Keberhasilan layanan NCC 119"
            icon={CheckCircle}
            tone="emerald"
          />
          <KpiCardItem
            label="PSC 119 Aktif"
            value={nf(layanan.pscAktif)}
            unit="PSC"
            sub={`${nf(layanan.pscAktif)} dari ${nf(layanan.pscTotal)} kab/kota`}
            icon={Building2}
            tone="teal"
            href={withQuery('/dashboard/layanan-gawat-darurat/psc', f)}
          />
          <KpiCardItem
            label="Armada Ambulans"
            value={nf(layanan.ambulans)}
            unit="unit"
            sub={`${layanan.waktuRespons ?? 0} mnt respons rata-rata`}
            icon={Ambulance}
            tone="blue"
            href={withQuery('/dashboard/layanan-gawat-darurat/ambulans', f)}
          />
        </div>
      </section>
    )
  }

  if (tab === 'kesiapsiagaan') {
    if (bagian === 'logistik') {
      const stokTotal = lLiveTop(raw) ? (derived.logistik?.totalStok ?? raw.logistik?.summary?.total_stok ?? null) : null
      const gudangCount = raw.logistik?.regional?.length ?? null
      const lS = raw.logistik?.summary || {}
      const lLive = raw.logistik?.data_source === 'langsung'
      const selReg: any = lLive && derived.selected ? (raw.logistik.regional || []).find((r: any) => r.id === raw.logistik.provinsi_regional?.[derived.selected!.code]) : null
      return (
        <section className="skdr-section">
          <SectionHead eyebrow="Kesiapsiagaan · Logistik" title="Ketersediaan Stok &amp; Buffer Logistik Regional" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCardItem
              label="Total Stok Logistik"
              value={nf(stokTotal)}
              unit="unit"
              sub={selReg ? `Gudang regional ${selReg.nama} (melayani ${derived.selected!.nama})` : lLive ? `${nf(lS.jumlah_barang || 0)} baris barang, satuan campuran` : 'Buffer logistik kesehatan regional'}
              icon={Package}
              tone="emerald"
            />
            <KpiCardItem
              label={lLive ? 'Kedaluwarsa' : 'Gudang Regional'}
              value={lLive ? nf(selReg ? selReg.kedaluwarsa : lS.kedaluwarsa || 0) : `${gudangCount}`}
              unit={lLive ? 'barang' : 'lokasi'}
              sub={lLive ? `${nf(selReg ? selReg.segera_kedaluwarsa : lS.segera_kedaluwarsa || 0)} lagi kedaluwarsa ≤ 90 hari · ${gudangCount} gudang regional` : 'Pusat sebaran logistik se-Indonesia'}
              icon={Building2}
              tone="teal"
            />
            <KpiCardItem
              label="Kategori Logistik"
              value={`${raw.logistik?.summary?.kategori_count || 5}`}
              unit="kategori"
              sub={lLive ? 'Obat, BMHP (bahan medis habis pakai), alat kesehatan, sarana prasarana, lainnya' : 'Obat, tenda, MPASI, hygiene kit'}
              icon={Layers}
              tone="blue"
            />
            <KpiCardItem
              label={lLive ? 'Unit Keluar' : 'Tenaga Cadangan Siaga'}
              value={lLive ? nf(selReg ? selReg.keluar : lS.unit_keluar || 0) : nf(sdm.individu)}
              unit={lLive ? 'unit' : 'personel'}
              sub={lLive ? `masuk ${nf(selReg ? selReg.masuk : lS.unit_masuk || 0)} unit, semua transaksi tercatat` : 'Tenaga cadangan terlatih'}
              icon={lLive ? Package : Users}
              tone="amber"
            />
          </div>
        </section>
      )
    }

    if (bagian === 'tenaga-cadangan') {
      return (
        <section className="skdr-section">
          <SectionHead eyebrow="Kesiapsiagaan · SDM" title="Tenaga Cadangan Kesehatan (TCK) Siaga Bencana" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCardItem
              label="Tenaga Cadangan Individu"
              value={nf(sdm.individu)}
              unit="personel"
              sub={`${nf(sdm.nakes || 0)} nakes · ${nf(sdm.nonNakes || 0)} non-kesehatan`}
              icon={Users}
              tone="blue"
              trend={trendTckIndividu}
            />
            <KpiCardItem
              label="Tenaga Kesehatan (Nakes)"
              value={nf(sdm.nakes || 0)}
              unit="nakes"
              sub={sdm.individu ? `${Math.round(((sdm.nakes || 0) / (sdm.individu || 1)) * 100)}% dari total tenaga terdaftar` : 'Tenaga kesehatan terlatih'}
              icon={HeartPulse}
              tone="emerald"
            />
            <KpiCardItem
              label={isWilayah && sdm.tim != null ? "Tim Tenaga Cadangan (wilayah)" : "Tim Tenaga Cadangan"}
              value={sdm.tim != null ? nf(sdm.tim) : '—'}
              unit={sdm.tim != null ? 'tim' : ''}
              sub="Tim cadangan siap mobilisasi"
              icon={ShieldCheck}
              tone="teal"
              trend={trendTckTim}
              note={isWilayah && sdm.tim == null ? NASIONAL_NOTE : null}
            />
            <KpiCardItem
              label={EMT_LABEL}
              value={sdm.emt != null ? nf(sdm.emt) : '—'}
              unit={sdm.emt != null ? 'tim' : ''}
              sub={(() => { const rs = isWilayah && derived.selected ? [derived.selected] : derived.rows || []; const st = rs.some((r: any) => r.tckEmtStandar != null) ? rs.reduce((a: number, r: any) => a + (r.tckEmtStandar || 0), 0) : null; return st != null ? `${nf(st)} memenuhi standar EMT` : 'Terdaftar di Tenaga Cadangan' })()}
              icon={CheckCircle}
              tone="teal"
              trend={trendTckEmt}
              note={isWilayah && sdm.emt == null ? NASIONAL_NOTE : null}
            />
          </div>
        </section>
      )
    }

    return (
      <section className="skdr-section">
        <SectionHead eyebrow="Kesiapsiagaan SDM &amp; Logistik" title="Tenaga Cadangan &amp; Tim Siaga Bencana" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCardItem
            label="Tenaga Cadangan Individu"
            value={nf(sdm.individu)}
            unit="personel"
            sub={`${nf(sdm.nakes || 0)} tenaga kesehatan · ${nf(sdm.nonNakes || 0)} non-kesehatan`}
            icon={Users}
            tone="blue"
            trend={trendTckIndividu}
            href={withQuery('/dashboard/kesiapsiagaan/tenaga-cadangan', f)}
          />
          <KpiCardItem
            label={isWilayah && sdm.tim != null ? "Tim Tenaga Cadangan (wilayah)" : "Tim Tenaga Cadangan"}
            value={sdm.tim != null ? nf(sdm.tim) : '—'}
            unit={sdm.tim != null ? 'tim' : ''}
            sub="Tim cadangan siap mobilisasi"
            icon={ShieldCheck}
            tone="teal"
            trend={trendTckTim}
            note={isWilayah && sdm.tim == null ? NASIONAL_NOTE : null}
          />
          <KpiCardItem
            label={EMT_LABEL}
            value={sdm.emt != null ? nf(sdm.emt) : '—'}
            unit={sdm.emt != null ? 'tim' : ''}
            sub={(() => { const rs = isWilayah && derived.selected ? [derived.selected] : derived.rows || []; const st = rs.some((r: any) => r.tckEmtStandar != null) ? rs.reduce((a: number, r: any) => a + (r.tckEmtStandar || 0), 0) : null; return st != null ? `${nf(st)} memenuhi standar EMT` : 'terdaftar di Tenaga Cadangan' })()}
            icon={HeartPulse}
            tone="emerald"
            trend={trendTckEmt}
            note={isWilayah && sdm.emt == null ? NASIONAL_NOTE : null}
          />
          <KpiCardItem
            label="Buffer Logistik"
            value={derived.logistik?.totalStok == null ? '—' : nf(derived.logistik.totalStok)}
            unit="unit"
            sub={derived.logistik?.regionalNama ? `Gudang regional ${derived.logistik.regionalNama}` : 'Stok logistik regional siap salur'}
            icon={Package}
            tone="amber"
            href={withQuery('/dashboard/kesiapsiagaan/logistik', f)}
          />
        </div>
      </section>
    )
  }

  if (tab === 'asistensi') {
    const asis = raw.asistensi || {}
    const live = asis.data_source === 'langsung'
    const cak = asis.cakupan || {}
    const irbiP = asis.provinsi?.irbi || {}
    const irbiK = asis.kabupaten_kota?.irbi || {}
    return (
      <section className="skdr-section">
        <SectionHead eyebrow="Asistensi Risiko Daerah" title="Cakupan Pendampingan &amp; Kesiapsiagaan Daerah" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCardItem
            label="Provinsi Mengisi Kapasitas"
            value={`${cak.provinsi_mengisi_kapasitas ?? '—'}`}
            unit={cak.provinsi_total != null ? `dari ${cak.provinsi_total}` : undefined}
            sub={cak.provinsi_pct != null ? `${cak.provinsi_pct}% provinsi sudah menilai kapasitas` : 'Data belum tersedia dari API Asistensi'}
            icon={ShieldCheck}
            tone="teal"
            href={withQuery('/dashboard/asistensi-risiko/provinsi', f)}
          />
          <KpiCardItem
            label="Kab/Kota Mengisi Kapasitas"
            value={`${cak.kabkot_mengisi_kapasitas ?? '—'}`}
            unit={cak.kabkot_total != null ? `dari ${cak.kabkot_total}` : undefined}
            sub={cak.kabkot_pct != null ? `${cak.kabkot_pct}% kab/kota sudah menilai kapasitas` : 'Data belum tersedia dari API Asistensi'}
            icon={Building2}
            tone="emerald"
            href={withQuery('/dashboard/asistensi-risiko/kabupaten-kota', f)}
          />
          <KpiCardItem
            label="Risiko Bencana Tinggi"
            value={live ? `${irbiP.Tinggi ?? 0} prov · ${irbiK.Tinggi ?? 0} kab/kota` : '—'}
            sub="Status Indeks Risiko Bencana Indonesia (IRBI)"
            icon={AlertTriangle}
            tone="amber"
          />
          <KpiCardItem
            label="Sumber Data"
            value={live ? 'Langsung' : 'Belum terhubung'}
            sub={live ? `API rekapitulasi Asistensi ${asis.tahun} · ${asis.fetched_at_wib || ''}` : 'Data belum tersedia dari API Asistensi'}
            icon={CheckCircle}
            tone="blue"
          />
        </div>
      </section>
    )
  }

  // Default: tab === 'ringkasan' (Ringkasan Utama)
  return (
    <section className="skdr-section">
      <SectionHead eyebrow="Indikator utama" title="Kinerja nasional krisis kesehatan" />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCardItem
          label="Pantauan Bencana/Krisis Kesehatan"
          value={nf(situasi.terpantau)}
          unit="kejadian"
          sub={`${nf(situasi.berdampak_krisis)} berdampak krisis`}
          icon={AlertTriangle}
          tone="primary"
          trend={trendKejadian}
          href={withQuery('/dashboard/situasi-krisis', f)}
          source="Sumber: Sistem Informasi Penanggulangan Krisis Kesehatan"
        />
        <KpiCardItem
          label="Panggilan NCC 119"
          value={nf(layanan.panggilan)}
          unit="panggilan"
          sub={
            <>
              {layanan.scr != null ? `${NCC_LABEL.scr.replace(' (%)', '')} ${pf(layanan.scr, 1)}` : `${NCC_LABEL.scr.replace(' (%)', '')} tidak tersedia`}
              <InfoHint text={NCC_LABEL.scrHint} label={NCC_LABEL.scrHint} />
              {layanan.emergencyShare != null ? ` · darurat ${layanan.emergencyPerkiraan ? '≈ ' : ''}${pf(layanan.emergencyShare, 1)}` : ''}
            </>
          }
          icon={PhoneCall}
          tone="amber"
          trend={trendPanggilan}
          href={withQuery('/dashboard/layanan-gawat-darurat/panggilan-119', f)}
          note={isWilayah ? NASIONAL_NOTE : null}
          source="Sumber: NCC 119 melalui Aplikasi SIAP PSC 119"
        />
        <KpiCardItem
          label="PSC"
          value={
            <div className="flex items-baseline gap-3">
              <div>
                <span className="text-2xl font-black text-slate-900">{nf(layanan.pscAktif)}</span>
                <span className="block text-[10px] font-bold uppercase text-slate-500">PSC aktif</span>
              </div>
              <div className="h-7 w-px bg-slate-200" />
              <div>
                <span className="text-2xl font-black text-slate-900">{nf(layanan.ambulans)}</span>
                <span className="block text-[10px] font-bold uppercase text-slate-500">Ambulans</span>
              </div>
            </div>
          }
          sub={<span className="font-bold text-slate-800">{nf(layanan.pscAktif)} dari {nf(layanan.pscTotal)} PSC aktif</span>}
          icon={Ambulance}
          tone="emerald"
          href={withQuery('/dashboard/layanan-gawat-darurat', f)}
          source="Sumber: Aplikasi SIAP PSC 119"
        />
        <KpiCardItem
          label="Tenaga Cadangan Kesehatan"
          value={
            <div className="flex items-baseline gap-3">
              <div>
                <span className="text-2xl font-black text-slate-900">{nf(sdm.individu)}</span>
                <span className="block text-[10px] font-bold uppercase text-slate-500">Individu</span>
              </div>
              <div className="h-7 w-px bg-slate-200" />
              <div>
                <span className="text-2xl font-black text-slate-900">{sdm.tim == null ? '—' : nf(sdm.tim)}</span>
                <span className="block text-[10px] font-bold uppercase text-slate-500">Tim</span>
              </div>
            </div>
          }
          sub={sdm.emt == null ? `${EMT_LABEL} hanya di angka nasional` : `${nf(sdm.emt)} ${EMT_LABEL}`}
          icon={Users}
          tone="blue"
          trend={trendTckIndividu}
          href={withQuery('/dashboard/kesiapsiagaan/tenaga-cadangan', f)}
          note={isWilayah && sdm.tim == null ? NASIONAL_NOTE : null}
          source="Sumber: Sistem Informasi Tenaga Cadangan Kesehatan (SITCK)"
        />
      </div>
      <DampakPendudukStrip raw={raw} situasi={situasi} f={f} />
    </section>
  )
}

export default function PuskrisRingkasanView({
  raw, f, tab, bagian = null, onApply,
}: {
  raw: any
  f: PuskrisUiFilter
  tab: PuskrisTab
  bagian?: string | null
  onApply: (next: PuskrisUiFilter) => void
}) {
  const derived = useMemo(() => applyDerive(raw, toDeriveFilter(f)), [raw, f])
  const kejadian = useMemo(() => {
    const list = derived.kejadian || []
    return f.jenis ? list.filter((k: any) => k.jenis === f.jenis) : list
  }, [derived.kejadian, f.jenis])

  const jenisScoped = Boolean(f.jenis)
  const useOfficialJenis = !f.provinsi && !f.kabupaten && f.periode === 'tahun' && f.tahun === tahunIni() && !raw?.eoc?.rentang && !f.jenis
  const jenisCards = useMemo(
    () => buildJenisCards(useOfficialJenis ? raw : { ...raw, eoc: { ...raw.eoc, jenis_2026: [] } }, derived.kejadianSemua || derived.kejadian || []),
    [raw, derived.kejadian, derived.kejadianSemua, useOfficialJenis],
  )

  const situasi = useMemo(() => situasiTerfilter(derived.situasi, derived.kejadianSemua ? derived.kejadianSemua.filter((k: any) => k.jenis === f.jenis) : kejadian, jenisScoped), [derived.situasi, derived.kejadianSemua, f.jenis, jenisScoped, kejadian])

  const layanan = derived.layanan
  const sdm = derived.sdm
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null)
  const footnote = [
    situasi.catatanPeriode,
    raw.psc?.summary?.tahun_panggilan
      ? `Panggilan PSC 119 adalah hitungan tahun ${raw.psc.summary.tahun_panggilan} langsung dari API PSC 119 (belum bisa disaring per bulan/minggu).`
      : 'Panggilan PSC bersifat kumulatif dan tidak mengikuti filter periode.',
    raw.ncc?.data_source === 'langsung' ? `Data NCC 119 langsung dari API NCC (${raw.ncc.period?.label || ''}), tingkat nasional.` : 'Data NCC 119 belum tersedia dari API NCC.',
    raw.asistensi?.data_source === 'langsung'
      ? `Asistensi Risiko diambil langsung dari API rekapitulasi Asistensi ${raw.asistensi.tahun || ''}.`
      : 'Data Asistensi Risiko belum tersedia dari API.',
    'Titik kejadian memakai koordinat dari API EOC; kejadian tanpa koordinat diletakkan di pusat kab/kota atau provinsi.',
  ].filter(Boolean).join(' ')


  const timeline = useMemo(() => buildTimeline({ kejadian, nccDays: derived.ncc?.days || [], selectedTanggal: selectedEvent?.tanggal || null }), [kejadian, derived.ncc, selectedEvent])

  return (
    <div className="space-y-4" data-testid="puskris-ringkasan-view">
      <DynamicKpiCards
        tab={tab}
        bagian={bagian}
        f={f}
        situasi={situasi}
        layanan={layanan}
        sdm={sdm}
        raw={raw}
        derived={derived}
      />
      <p className="mt-1.5 line-clamp-1 text-[10px] leading-relaxed text-slate-400" title={footnote}>{footnote}</p>

      <PuskrisPetaTerpadu raw={raw} f={f} onApply={onApply} derived={derived} kejadian={kejadian} selectedEvent={selectedEvent} setSelectedEvent={setSelectedEvent} />

      {tab === 'ringkasan' ? (
        <>
          <div className="flex flex-col gap-2 rounded-2xl border border-teal-200 bg-teal-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between" data-testid="jenis-kejadian-cta">
            <div className="min-w-0">
              <p className="text-sm font-black text-slate-900">Dashboard per jenis kejadian</p>
              <p className="text-[11px] font-medium text-slate-600">Buka peta, chart, dampak, dan kesiapan di provinsi terdampak untuk satu jenis — Banjir, Gempa Bumi, Karhutla, dan lainnya.</p>
            </div>
            <Link href={jenisKejadianIndexHref({ tahun: f.tahun, prov: f.provinsi })} className="inline-flex shrink-0 items-center justify-center rounded-lg bg-[#047D78] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#036661]" data-testid="jenis-kejadian-cta-link">
              Lihat per jenis kejadian
            </Link>
          </div>
          <section className="grid gap-3 lg:grid-cols-3" aria-label="Rekap ringkas">
            <JenisBars items={jenisCards} selected={f.jenis} tahun={f.tahun} onSelect={(nama) => onApply({ ...f, jenis: nama })} />
            <TrenJenisCard kejadian={derived.kejadianSemua} f={f} />
            <LiniMasaRespons rows={timeline.rows} catatan={timeline.catatan} compact />
          </section>
          <p className="text-[11px] text-slate-500">
            Detail pilar ada di{' '}
            <Link href={jenisKejadianIndexHref({ tahun: f.tahun, prov: f.provinsi })} className="font-bold text-primary hover:underline">Jenis Kejadian</Link>
            {', '}
            <Link href={withQuery('/dashboard/situasi-krisis', f)} className="font-bold text-primary hover:underline">Pantauan Krisis</Link>
            {', '}
            <Link href={withQuery('/dashboard/layanan-gawat-darurat', f)} className="font-bold text-primary hover:underline">Layanan Gawat Darurat</Link>
            {', '}
            <Link href={withQuery('/dashboard/kesiapsiagaan', f)} className="font-bold text-primary hover:underline">Kesiapsiagaan</Link>
            {', dan analisis lengkap di '}
            <Link href={withQuery('/dashboard/analisis', f)} className="font-bold text-primary hover:underline">Analisis</Link>.
          </p>
        </>
      ) : (
        <>
          {tab === 'krisis' ? (
            <div className="max-w-xl">
              <JenisBars items={jenisCards} selected={f.jenis} tahun={f.tahun} onSelect={(nama) => onApply({ ...f, jenis: nama })} />
            </div>
          ) : null}
          {(tab === 'krisis' || tab === 'layanan') ? (
            <LiniMasaRespons rows={timeline.rows} catatan={timeline.catatan} />
          ) : null}
          <PuskrisSumberSections raw={raw} view={{ ...derived, situasi }} tab={tab} bagian={bagian} kejadian={kejadian} filteredWilayah={Boolean(f.provinsi || f.kabupaten)} f={f} />
        </>
      )}
    </div>
  )
}
