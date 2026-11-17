'use client'

import Link from 'next/link'
import InfoHint from '@/components/puskris/InfoHint'
import { nf } from '@/lib/puskris/derive'
import { KORBAN_LABEL } from '@/lib/puskris/labels'
import { NASIONAL_NOTE, withQuery } from '@/lib/puskris/pages'
import type { PuskrisUiFilter } from '@/lib/puskris/ui-filter'

type Situasi = {
  meninggal?: number | null
  luka_berat?: number | null
  luka_ringan?: number | null
  hilang?: number | null
  korban_total?: number | null
  pengungsi?: number | null
  terdampak?: number | null
}

type Tile = {
  key: string
  label: string
  hint: string
  value: number | null | undefined
  tone: string
  trend?: { tahun: number; jumlah: number; krisis?: number }[]
  krisis?: number | null
}

function Spark({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null
  const max = Math.max(1, ...values)
  const w = 56, h = 18
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - (v / max) * (h - 2) - 1}`).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="shrink-0">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

/**
 * Pita KPI "Dampak terhadap penduduk": korban, pengungsi, dan penduduk terdampak.
 * Sumber: dasbor Pantauan Bencana (pusatkrisis.kemkes.go.id/dashboard-new). Istilah LB/RI dan LR/RJ dijelaskan lewat ikon info.
 */
export default function DampakPendudukStrip({ raw, situasi, f }: { raw: any; situasi: Situasi; f: PuskrisUiFilter }) {
  const resmi = raw?.eoc?.nasional || {}
  const krisis = resmi.krisis_tahun || {}
  const nasionalTahun = !f.provinsi && !f.kabupaten && !f.jenis && f.periode !== 'bulan'
  const provinsiScoped = Boolean(f.provinsi || f.kabupaten)
  const tiles: Tile[] = [
    { key: 'korban', label: 'Korban total', hint: KORBAN_LABEL.totalHint, value: situasi.korban_total, tone: '#0D6B67', krisis: krisis.korban_total },
    { key: 'meninggal', label: 'Meninggal', hint: 'Korban meninggal dunia akibat kejadian.', value: situasi.meninggal, tone: '#be123c', trend: resmi.tren_5_tahun_meninggal, krisis: krisis.meninggal },
    { key: 'hilang', label: 'Hilang', hint: KORBAN_LABEL.hilangHint, value: situasi.hilang, tone: '#7c3aed' },
    { key: 'lb', label: KORBAN_LABEL.lbShort, hint: KORBAN_LABEL.lbHint, value: situasi.luka_berat, tone: '#ea580c', trend: resmi.tren_5_tahun_luka_berat, krisis: krisis.luka_berat },
    { key: 'lr', label: KORBAN_LABEL.lrShort, hint: KORBAN_LABEL.lrHint, value: situasi.luka_ringan, tone: '#d97706', trend: resmi.tren_5_tahun_luka_ringan, krisis: krisis.luka_ringan },
    { key: 'pengungsi', label: 'Pengungsi', hint: KORBAN_LABEL.pengungsiHint, value: situasi.pengungsi, tone: '#0284c7', trend: resmi.tren_5_tahun_pengungsi, krisis: krisis.pengungsi },
    { key: 'terdampak', label: 'Penduduk terdampak', hint: KORBAN_LABEL.terdampakHint, value: situasi.terdampak, tone: '#0f766e', trend: resmi.tren_5_tahun_terdampak, krisis: krisis.terdampak },
  ]
  return (
    <div className="mt-2" data-testid="dampak-penduduk-strip">
      <div className="mb-1 flex flex-wrap items-center gap-x-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
        <span>Dampak terhadap penduduk</span>
        <span className="font-semibold normal-case tracking-normal text-slate-400">
          {raw?.eoc?.data_source === 'langsung' ? `${(situasi as any)?.sumber || 'API EOC Pusat Krisis (langsung)'}${f.jenis ? ` · jenis ${f.jenis}` : ''}` : provinsiScoped ? 'Agregat provinsi 2026 · luka & hilang hanya tersedia nasional' : f.jenis ? `Jenis: ${f.jenis} (agregat daftar kejadian)` : f.periode === 'bulan' ? 'Oktober 2026 · sumber Pantauan Bencana' : 'Tahun 2026 · sumber Pantauan Bencana'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {tiles.map((t) => {
          const series = (t.trend || []).map((x) => Number(x.jumlah || 0))
          const prev = series.length >= 2 ? series[series.length - 2] : null
          const cur = series.length ? series[series.length - 1] : null
          const delta = nasionalTahun && prev && cur != null ? Math.round(((cur - prev) * 1000) / prev) / 10 : null
          const krisisPct = nasionalTahun && t.krisis != null && t.value ? Math.round((t.krisis * 1000) / t.value) / 10 : null
          const missing = t.value == null
          return (
            <Link key={t.key} href={withQuery('/dashboard/situasi-krisis', f)}
              className="skdr-card block min-w-0 border-t-2 px-2.5 py-2 no-underline transition hover:shadow-sm"
              style={{ borderTopColor: t.tone }} data-testid={`kpi-dampak-${t.key}`}>
              <div className="flex items-center text-[10px] font-bold uppercase tracking-wide text-slate-500">
                <span className="truncate" title={t.label}>{t.label}</span>
                <InfoHint text={t.hint} label={`Penjelasan ${t.label}`} />
              </div>
              <div className="mt-0.5 flex items-end justify-between gap-1">
                <span className="text-lg font-black leading-tight tabular-nums text-slate-900">{missing ? '—' : nf(t.value as number)}</span>
                {nasionalTahun && series.length > 1 ? <Spark values={series} color={t.tone} /> : null}
              </div>
              <div className="mt-0.5 truncate text-[10px] font-semibold text-slate-500" title={missing && provinsiScoped ? NASIONAL_NOTE : undefined}>
                {missing
                  ? (provinsiScoped ? NASIONAL_NOTE : 'Belum tersedia untuk filter ini')
                  : delta != null
                    ? <span className={delta > 0 ? 'text-red-600' : 'text-emerald-700'}>{delta > 0 ? '▲' : '▼'} {Math.abs(delta).toLocaleString('id-ID')}% vs 2025</span>
                    : krisisPct != null ? `${krisisPct.toLocaleString('id-ID')}% dari kejadian krisis` : '\u00a0'}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
