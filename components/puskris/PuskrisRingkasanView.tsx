'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle, Ambulance, Building2, CheckCircle, Clock, HeartPulse,
  Layers, Package, PhoneCall, ShieldCheck, Users, XCircle,
} from 'lucide-react'
import { applyDerive, nf, pf, situasiTerfilter } from '@/lib/puskris/derive'
import { buildJenisCards } from '@/lib/puskris/to-spasial'
import { toDeriveFilter, type PuskrisTab, type PuskrisUiFilter } from '@/lib/puskris/ui-filter'
import PuskrisSumberSections from '@/components/puskris/PuskrisSumberSections'
import PuskrisPetaTerpadu from '@/components/puskris/PuskrisPetaTerpadu'
import LiniMasaRespons from '@/components/puskris/LiniMasaRespons'
import SectionHead from '@/components/puskris/SectionHead'
import InfoHint from '@/components/puskris/InfoHint'
import DampakPendudukStrip from '@/components/puskris/DampakPendudukStrip'
import { EMT_LABEL, NCC_LABEL } from '@/lib/puskris/labels'
import { NASIONAL_NOTE, withQuery } from '@/lib/puskris/pages'
import { jenisTrendSeries } from '@/lib/puskris/analisis-charts'
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { buildTimeline, CONTOH_LABEL } from '@/lib/puskris/integrasi'

function JenisBars({ items, selected, onSelect }: {
  items: { nama: string; kejadian: number }[]
  selected: string | null
  onSelect: (nama: string | null) => void
}) {
  const max = Math.max(1, ...items.map((i) => i.kejadian))
  return (
    <div className="skdr-card flex h-full flex-col p-3" data-testid="jenis-bars">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-700">Jenis kejadian</h3>
        {selected ? (
          <button type="button" onClick={() => onSelect(null)} className="text-[10px] font-bold text-primary hover:underline">Hapus filter</button>
        ) : null}
      </div>
      <ul className="min-h-0 flex-1 space-y-1 overflow-auto">
        {items.slice(0, 8).map((c) => {
          const on = selected === c.nama
          return (
            <li key={c.nama}>
              <button
                type="button"
                onClick={() => onSelect(on ? null : c.nama)}
                className={`flex w-full items-center gap-2 rounded-lg px-1 py-0.5 text-left ${on ? "bg-primary/10" : "hover:bg-slate-50"}`}
              >
                <span className="w-[46%] truncate text-[11px] font-semibold text-slate-700">{c.nama}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${(c.kejadian / max) * 100}%` }} />
                </span>
                <span className="w-9 text-right text-[11px] font-bold tabular-nums text-slate-800">{c.kejadian.toLocaleString("id-ID")}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function TrenJenisCard({ raw, f }: { raw: any; f: PuskrisUiFilter }) {
  const trend = jenisTrendSeries(raw, f)
  return (
    <div className="skdr-card flex h-full flex-col p-3" data-testid="tren-jenis-card">
      <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-700">Tren kejadian per jenis</h3>
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        {trend.contoh ? <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-800">{CONTOH_LABEL}</span> : null}
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
          <p className="py-10 text-center text-xs text-slate-500">Tidak ada deret bulanan untuk filter ini.</p>
        )}
      </div>
    </div>
  )
}

function KpiCardItem({
  label, value, unit, sub, icon: Icon, tone = 'primary', href, note,
}: {
  label: string
  value: React.ReactNode
  unit?: string
  sub?: React.ReactNode
  icon: any
  tone?: 'primary' | 'amber' | 'emerald' | 'blue' | 'rose' | 'orange' | 'teal'
  href?: string
  note?: string | null
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

  const content = (
    <div className={`skdr-card relative block overflow-hidden border-l-4 ${toneClasses.border} p-3 transition`}>
      <div className="flex items-center justify-between text-slate-500">
        <span className="text-[11px] font-black uppercase tracking-wider">{label}</span>
        <div className={`rounded-lg p-1.5 ${toneClasses.bg}`}><Icon className="h-4 w-4" /></div>
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="text-2xl font-black tracking-tight text-slate-900">{value}</span>
        {unit ? <span className="text-xs font-semibold text-slate-500">{unit}</span> : null}
      </div>
      {sub ? <div className="mt-2 text-xs font-bold text-slate-600">{sub}</div> : null}
      {note ? <div className="mt-2 text-[10px] font-medium text-amber-800">{note}</div> : null}
    </div>
  )

  if (href) {
    return <Link href={href} className="no-underline">{content}</Link>
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

  if (tab === 'krisis') {
    return (
      <section className="skdr-section">
        <SectionHead eyebrow="Situasi Krisis" title="Indikator Kejadian &amp; Dampak Bencana" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCardItem
            label="Kejadian Bencana"
            value={nf(situasi.terpantau)}
            unit="kejadian"
            sub={`${nf(situasi.berdampak_krisis)} berdampak krisis kesehatan`}
            icon={AlertTriangle}
            tone="primary"
          />
          <KpiCardItem
            label="Korban Jiwa"
            value={nf((situasi.meninggal || 0) + (situasi.hilang || 0))}
            unit="jiwa"
            sub={`${nf(situasi.meninggal)} meninggal · ${nf(situasi.hilang)} hilang`}
            icon={Users}
            tone="rose"
          />
          <KpiCardItem
            label="Korban Luka"
            value={nf((situasi.luka_berat || 0) + (situasi.luka_ringan || 0))}
            unit="orang"
            sub={`${nf(situasi.luka_berat)} rawat inap · ${nf(situasi.luka_ringan)} rawat jalan`}
            icon={HeartPulse}
            tone="orange"
          />
          <KpiCardItem
            label="Penduduk Terdampak"
            value={nf((situasi.pengungsi || 0) + (situasi.terdampak || 0))}
            unit="jiwa"
            sub={`${nf(situasi.pengungsi)} mengungsi · ${nf(situasi.terdampak)} terdampak`}
            icon={Users}
            tone="blue"
          />
        </div>
        <DampakPendudukStrip raw={raw} situasi={situasi} f={f} />
      </section>
    )
  }

  if (tab === 'layanan') {
    if (bagian === 'panggilan-119') {
      return (
        <section className="skdr-section">
          <SectionHead eyebrow="Layanan 119 · Panggilan" title="Indikator Panggilan Masuk &amp; Kedaruratan" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCardItem
              label="Total Panggilan 119"
              value={nf(layanan.panggilan)}
              unit="panggilan"
              sub={layanan.panggilanTahun ? `Tahun ${layanan.panggilanTahun}, langsung dari API PSC 119` : 'Snapshot kumulatif nasional'}
              icon={PhoneCall}
              tone="amber"
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
      const stokTotal = derived.logistik?.totalStok ?? raw.logistik?.summary?.total_stok ?? 0
      const gudangCount = raw.logistik?.regional?.length || derived.logistik?.rows?.length || 10
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
            href={withQuery('/dashboard/kesiapsiagaan/tenaga-cadangan', f)}
          />
          <KpiCardItem
            label={isWilayah && sdm.tim != null ? "Tim Tenaga Cadangan (wilayah)" : "Tim Tenaga Cadangan"}
            value={sdm.tim != null ? nf(sdm.tim) : '—'}
            unit={sdm.tim != null ? 'tim' : ''}
            sub="Tim cadangan siap mobilisasi"
            icon={ShieldCheck}
            tone="teal"
            note={isWilayah && sdm.tim == null ? NASIONAL_NOTE : null}
          />
          <KpiCardItem
            label={EMT_LABEL}
            value={sdm.emt != null ? nf(sdm.emt) : '—'}
            unit={sdm.emt != null ? 'tim' : ''}
            sub={(() => { const rs = isWilayah && derived.selected ? [derived.selected] : derived.rows || []; const st = rs.some((r: any) => r.tckEmtStandar != null) ? rs.reduce((a: number, r: any) => a + (r.tckEmtStandar || 0), 0) : null; return st != null ? `${nf(st)} memenuhi standar EMT` : 'terdaftar di Tenaga Cadangan' })()}
            icon={HeartPulse}
            tone="emerald"
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
            unit={`dari ${cak.provinsi_total ?? 38}`}
            sub={`${cak.provinsi_pct ?? 0}% provinsi sudah menilai kapasitas`}
            icon={ShieldCheck}
            tone="teal"
            href={withQuery('/dashboard/asistensi-risiko/provinsi', f)}
          />
          <KpiCardItem
            label="Kab/Kota Mengisi Kapasitas"
            value={`${cak.kabkot_mengisi_kapasitas ?? '—'}`}
            unit={`dari ${cak.kabkot_total ?? 514}`}
            sub={`${cak.kabkot_pct ?? 0}% kab/kota sudah menilai kapasitas`}
            icon={Building2}
            tone="emerald"
            href={withQuery('/dashboard/asistensi-risiko/kabupaten-kota', f)}
          />
          <KpiCardItem
            label="Risiko Bencana Tinggi"
            value={live ? `${irbiP.Tinggi ?? 0} prov · ${irbiK.Tinggi ?? 0} kab/kota` : 'Sedang / Tinggi'}
            sub="Status Indeks Risiko Bencana Indonesia (IRBI)"
            icon={AlertTriangle}
            tone="amber"
          />
          <KpiCardItem
            label="Sumber Data"
            value={live ? 'Langsung' : 'Snapshot'}
            sub={live ? `API rekapitulasi Asistensi ${asis.tahun} · ${asis.fetched_at_wib || ''}` : `Snapshot ${asis.fetched_at_wib || ''}`}
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
          label="Kejadian Krisis"
          value={nf(situasi.terpantau)}
          unit="kejadian"
          sub={`${nf(situasi.berdampak_krisis)} berdampak krisis`}
          icon={AlertTriangle}
          tone="primary"
          href={withQuery('/dashboard/situasi-krisis', f)}
        />
        <KpiCardItem
          label="Panggilan 119"
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
          href={withQuery('/dashboard/layanan-gawat-darurat/panggilan-119', f)}
          note={isWilayah ? NASIONAL_NOTE : null}
        />
        <KpiCardItem
          label="Kapasitas Respons"
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
        />
        <KpiCardItem
          label="Kesiapsiagaan SDM"
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
          href={withQuery('/dashboard/kesiapsiagaan/tenaga-cadangan', f)}
          note={isWilayah && sdm.tim == null ? NASIONAL_NOTE : null}
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
  const useOfficialJenis = !f.provinsi && !f.kabupaten && f.periode === 'tahun' && !f.jenis
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
    'Data NCC hanya tersedia untuk November 2026.',
    raw.asistensi?.data_source === 'langsung'
      ? `Asistensi Risiko diambil langsung dari API rekapitulasi Asistensi ${raw.asistensi.tahun || ''}.`
      : 'Asistensi Risiko adalah snapshot manual 16 November 2026; peta arsiran hanya memuat dua contoh wilayah.',
    'Titik kejadian diletakkan di pusat provinsi karena sumber belum punya koordinat tepat.',
    'Slider waktu mengikuti tren bulanan nasional; sebaran arsiran per provinsi tetap angka tahunan karena sumber tidak merilis deret bulanan per wilayah.',
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
          <section className="grid gap-3 lg:grid-cols-3" aria-label="Rekap ringkas">
            <JenisBars items={jenisCards} selected={f.jenis} onSelect={(nama) => onApply({ ...f, jenis: nama })} />
            <TrenJenisCard raw={raw} f={f} />
            <LiniMasaRespons rows={timeline.rows} catatan={timeline.catatan} compact />
          </section>
          <p className="text-[11px] text-slate-500">
            Detail pilar ada di{' '}
            <Link href={withQuery('/dashboard/situasi-krisis', f)} className="font-bold text-primary hover:underline">Situasi Krisis</Link>
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
              <JenisBars items={jenisCards} selected={f.jenis} onSelect={(nama) => onApply({ ...f, jenis: nama })} />
            </div>
          ) : null}
          {(tab === 'krisis' || tab === 'layanan') ? (
            <LiniMasaRespons rows={timeline.rows} catatan={timeline.catatan} />
          ) : null}
          <PuskrisSumberSections raw={raw} view={{ ...derived, situasi }} tab={tab} bagian={bagian} kejadian={kejadian} filteredWilayah={Boolean(f.provinsi || f.kabupaten)} />
        </>
      )}
    </div>
  )
}
