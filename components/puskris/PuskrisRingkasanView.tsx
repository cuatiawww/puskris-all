'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Ambulance, PhoneCall, Users } from 'lucide-react'
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
    () => buildJenisCards(useOfficialJenis ? raw : { ...raw, eoc: { ...raw.eoc, jenis_2026: [] } }, derived.kejadian || []),
    [raw, derived.kejadian, useOfficialJenis],
  )

  const situasi = useMemo(() => situasiTerfilter(derived.situasi, kejadian, jenisScoped), [derived.situasi, jenisScoped, kejadian])

  const layanan = derived.layanan
  const sdm = derived.sdm
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null)
  const footnote = [
    situasi.catatanPeriode,
    'Panggilan PSC bersifat kumulatif dan tidak mengikuti filter periode.',
    'Data NCC hanya tersedia untuk November 2026.',
    'Asistensi Risiko adalah snapshot manual 16 November 2026 (sumber butuh login); peta arsiran hanya memuat dua contoh wilayah.',
    'Titik kejadian diletakkan di pusat provinsi karena sumber belum punya koordinat tepat.',
    'Slider waktu mengikuti tren bulanan nasional; sebaran arsiran per provinsi tetap angka tahunan karena sumber tidak merilis deret bulanan per wilayah.',
  ].filter(Boolean).join(' ')


  const timeline = useMemo(() => buildTimeline({ kejadian, nccDays: derived.ncc?.days || [], selectedTanggal: selectedEvent?.tanggal || null }), [kejadian, derived.ncc, selectedEvent])

  return (
    <div className="space-y-4" data-testid="puskris-ringkasan-view">
      <section className="skdr-section">
      <SectionHead eyebrow="Indikator utama" title="Kinerja nasional krisis kesehatan" />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Link href={withQuery('/dashboard/situasi-krisis', f)} className="skdr-card relative block overflow-hidden border-l-4 border-l-primary p-3 no-underline transition hover:border-primary/60">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-black uppercase tracking-wider">Kejadian Krisis</span>
            <div className="rounded-lg bg-primary/10 p-1.5 text-primary"><AlertTriangle className="h-4 w-4" /></div>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-black tracking-tight text-slate-900">{nf(situasi.terpantau)}</span>
            <span className="text-xs font-semibold text-slate-500">kejadian</span>
          </div>
          <div className="mt-2 text-xs font-bold text-slate-600">{nf(situasi.berdampak_krisis)} berdampak krisis</div>
        </Link>

        <Link href={withQuery('/dashboard/layanan-gawat-darurat/panggilan-119', f)} className="skdr-card relative block overflow-hidden border-l-4 border-l-amber-500 p-3 no-underline transition hover:border-amber-400">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-black uppercase tracking-wider">Panggilan 119</span>
            <div className="rounded-lg bg-amber-50 p-1.5 text-amber-600"><PhoneCall className="h-4 w-4" /></div>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-black tracking-tight text-slate-900">{nf(layanan.panggilan)}</span>
            <span className="text-xs font-semibold text-slate-500">panggilan</span>
          </div>
          <div className="mt-2 text-xs font-bold text-amber-700">
            {layanan.scr != null ? `${NCC_LABEL.scr.replace(' (%)', '')} ${pf(layanan.scr, 1)}` : `${NCC_LABEL.scr.replace(' (%)', '')} tidak tersedia`}
            <InfoHint text={NCC_LABEL.scrHint} label={NCC_LABEL.scrHint} />
            {layanan.emergencyShare != null ? ` · darurat ${pf(layanan.emergencyShare, 1)}` : ''}
          </div>
          {(f.provinsi || f.kabupaten) ? <div className="mt-2 text-[10px] font-medium text-amber-800">{NASIONAL_NOTE}</div> : null}
        </Link>

        <Link href={withQuery('/dashboard/layanan-gawat-darurat', f)} className="skdr-card relative block overflow-hidden border-l-4 border-l-emerald-500 p-3 no-underline transition hover:border-emerald-400">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-black uppercase tracking-wider">Kapasitas Respons</span>
            <div className="rounded-lg bg-emerald-50 p-1.5 text-emerald-600"><Ambulance className="h-4 w-4" /></div>
          </div>
          <div className="mt-1.5 flex items-baseline gap-3">
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
          <div className="mt-2 text-xs text-slate-500">
            <span className="font-bold text-slate-800">{nf(layanan.pscAktif)} dari {nf(layanan.pscTotal)}</span> PSC aktif
          </div>
        </Link>

        <Link href={withQuery('/dashboard/kesiapsiagaan/tenaga-cadangan', f)} className="skdr-card relative block overflow-hidden border-l-4 border-l-blue-500 p-3 no-underline transition hover:border-blue-400">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-black uppercase tracking-wider">Kesiapsiagaan SDM</span>
            <div className="rounded-lg bg-blue-50 p-1.5 text-primary"><Users className="h-4 w-4" /></div>
          </div>
          <div className="mt-1.5 flex items-baseline gap-3">
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
          <div className="mt-2 text-xs font-semibold text-slate-600">
            {sdm.emt == null ? `${EMT_LABEL} hanya di angka nasional` : `${nf(sdm.emt)} ${EMT_LABEL}`}
          </div>
          {(f.provinsi || f.kabupaten) && sdm.tim == null ? <div className="mt-2 text-[10px] font-medium text-amber-800">{NASIONAL_NOTE}</div> : null}
        </Link>
      </div>
      <DampakPendudukStrip raw={raw} situasi={situasi} f={f} />
      <p className="mt-1.5 line-clamp-1 text-[10px] leading-relaxed text-slate-400" title={footnote}>{footnote}</p>
      </section>

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
