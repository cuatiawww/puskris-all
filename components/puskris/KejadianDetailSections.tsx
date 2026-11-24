/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import ApiKosong from '@/components/puskris/ApiKosong'
import { KejadianKesiapanDock, KejadianRisikoDock } from '@/components/puskris/KejadianDock'
import { PUBLIC_BASE_PATH } from '@/lib/public-path'
import { fmtAngka, tglKejadian } from '@/lib/puskris/eoc-markers'

function nf(n: number | null | undefined, satuan?: string, digits = 1) {
  if (n == null || Number.isNaN(Number(n))) return '—'
  const s = Number(n).toLocaleString('id-ID', { maximumFractionDigits: digits })
  return satuan ? `${s} ${satuan}` : s
}

function sumInWindow(rows: any[] | undefined, field: string, hours: number) {
  if (!rows?.length) return null
  const now = Date.now()
  const from = now - hours * 3600_000
  let sum = 0
  let n = 0
  for (const r of rows) {
    const ts = Date.parse(String(r.waktu || r.tanggal || ''))
    if (!Number.isFinite(ts) || ts < from || ts > now) continue
    const v = r[field]
    if (v == null || Number.isNaN(Number(v))) continue
    sum += Number(v)
    n += 1
  }
  return n ? Math.round(sum * 10) / 10 : null
}

const PILL: Record<string, string> = {
  rose: 'bg-rose-700 text-white',
  amber: 'bg-amber-500 text-slate-900',
  teal: 'bg-teal-700 text-white',
  slate: 'bg-slate-600 text-white',
}

const KPI_TONE: Record<string, string> = {
  rose: 'border-rose-100 bg-rose-50/80',
  amber: 'border-amber-100 bg-amber-50/80',
  teal: 'border-teal-100 bg-teal-50/80',
  slate: 'border-slate-200 bg-slate-50',
}

const KPI_VALUE: Record<string, string> = {
  rose: 'text-rose-800',
  amber: 'text-amber-800',
  teal: 'text-[#00705a]',
  slate: 'text-slate-800',
}

const PRI: Record<string, string> = {
  tinggi: 'border-rose-200 bg-rose-50',
  sedang: 'border-amber-200 bg-amber-50',
  info: 'border-slate-200 bg-slate-50',
}

function RangeBtn({ options, value, onChange }: { options: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${value === o.id ? 'bg-[#00705a] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function ChartCard({ title, sumber, catatan, actions, empty, pending, children }: { title: string; sumber?: string; catatan?: string | null; actions?: ReactNode; empty?: boolean; pending?: boolean; children?: ReactNode }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" data-testid="kejadian-chart-card">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          {sumber ? <p className="mt-0.5 text-[10px] leading-relaxed text-slate-400">{sumber}</p> : null}
        </div>
        {actions}
      </div>
      {pending ? <ApiKosong pending pesan="Sedang mengambil data dari API…" /> : empty ? <ApiKosong pesan="Data belum tersedia dari API" detail={catatan || undefined} /> : <div className="h-56">{children}</div>}
      {!empty && catatan ? <p className="mt-2 text-[10px] leading-relaxed text-slate-400">{catatan}</p> : null}
    </article>
  )
}

export function susunNarasi({ k, status, nearby, riwayat, konteks }: { k: any; status?: any; nearby?: any; riwayat?: any; konteks?: any }) {
  const out: string[] = []
  const lokasi = [k?.kabupaten, k?.provinsi].filter(Boolean).join(', ')
  const tgl = k?.tanggal ? tglKejadian(k.tanggal, k.jam) : null
  out.push(`Telah terjadi ${k?.jenis || 'kejadian'} ${lokasi ? `di ${lokasi}` : 'pada lokasi yang tercatat di API EOC'}${tgl && tgl !== '—' ? ` pada ${tgl}` : ''}.`)
  if (status?.label) {
    const hari = status.hari != null ? ` (${status.hari} hari sejak kejadian)` : ''
    out.push(`Status operasional menurut data EOC: ${status.label}${hari}.`)
    if (status.catatan) out.push(status.catatan)
  }
  const dampak: string[] = []
  if (k?.meninggal != null) dampak.push(`${fmtAngka(k.meninggal)} meninggal`)
  if (k?.luka_berat != null) dampak.push(`${fmtAngka(k.luka_berat)} luka berat`)
  if (k?.luka_ringan != null) dampak.push(`${fmtAngka(k.luka_ringan)} luka ringan`)
  if (k?.hilang != null) dampak.push(`${fmtAngka(k.hilang)} hilang`)
  if (k?.pengungsi != null) dampak.push(`${fmtAngka(k.pengungsi)} pengungsi`)
  if (k?.terdampak != null) dampak.push(`${fmtAngka(k.terdampak)} terdampak`)
  if (k?.faskes_rusak != null) dampak.push(`${fmtAngka(k.faskes_rusak)} faskes rusak`)
  if (dampak.length) out.push(`Dampak menurut API EOC: ${dampak.join(', ')}.`)
  if (k?.koordinat?.lat != null && k?.koordinat?.lon != null) {
    const lok = k.koordinat.label || 'lokasi'
    out.push(`Titik yang dipakai peta (${lok}): ${Number(k.koordinat.lat).toFixed(4)}, ${Number(k.koordinat.lon).toFixed(4)}.`)
  }
  if (riwayat?.tersedia) {
    const kab = riwayat.kab
    const prov = riwayat.prov
    const bits: string[] = []
    if (kab?.total != null) bits.push(`${fmtAngka(kab.total)} kejadian di kab/kota yang sama${kab.serupa != null ? ` (termasuk ${fmtAngka(kab.serupa)} sejenis)` : ''}`)
    if (prov?.total != null) bits.push(`${fmtAngka(prov.total)} di provinsi yang sama`)
    if (bits.length) out.push(`Dalam 12 bulan terakhir, API EOC mencatat ${bits.join(' dan ')}.`)
  }
  const psc0 = nearby?.psc?.tersedia ? nearby.psc.daftar?.[0] : null
  if (psc0?.nama) {
    out.push(`PSC terdekat menurut API Pusat Krisis: ${psc0.nama}${psc0.jarak_km != null ? ` (${nf(psc0.jarak_km, 'km')})` : ''}.`)
  }
  const cuaca = konteks?.cuaca
  if (cuaca && !cuaca.kosong && cuaca.saat_ini) {
    const c = cuaca.saat_ini
    const bits: string[] = []
    if (c.kondisi) bits.push(String(c.kondisi))
    if (c.suhu != null) bits.push(`suhu ${nf(c.suhu, '°C')}`)
    if (c.hujan_mm != null) bits.push(`hujan ${nf(c.hujan_mm, 'mm')}`)
    if (c.angin != null) bits.push(`angin ${nf(c.angin, 'km/jam')}`)
    if (bits.length) out.push(`Cuaca model Open-Meteo di titik kejadian: ${bits.join(', ')}.`)
  }
  const udara = konteks?.udara
  if (udara && !udara.kosong && udara.saat_ini) {
    const u = udara.saat_ini
    const bits: string[] = []
    if (u.pm25 != null) bits.push(`PM2.5 ${nf(u.pm25, 'µg/m³')}`)
    if (u.us_aqi != null) bits.push(`US AQI ${nf(u.us_aqi, '', 0)}`)
    if (bits.length) out.push(`Kualitas udara model CAMS (bukan ISPU resmi): ${bits.join(', ')}.`)
  }
  const fire = konteks?.karhutla
  const t24 = fire?.total_24jam
  const t7 = fire?.total_7hari ?? fire?.total
  if (k?.kind === 'karhutla' || (typeof t7 === 'number' && t7 > 0) || (typeof t24 === 'number' && t24 > 0)) {
    if (fire && !fire.kosong && (t7 != null || t24 != null)) {
      out.push(`NASA FIRMS mencatat ${fmtAngka(t24 ?? 0)} titik panas dalam 24 jam dan ${fmtAngka(t7 ?? 0)} dalam 7 hari, dalam radius ${fire.radius_km || 50} km dari titik kejadian.`)
    } else if (k?.kind === 'karhutla') {
      out.push('Tidak ada titik panas NASA FIRMS dalam radius 50 km pada data 7 hari terakhir.')
    }
  }
  const bahaya = konteks?.bahaya
  if ((k?.kind === 'gempa' || k?.kind === 'erupsi') && bahaya) {
    const n = bahaya.items?.length
    if (!bahaya.kosong && n) {
      out.push(`${bahaya.sumber || 'BMKG/GDACS'} mencatat ${fmtAngka(n)} peristiwa terkait dalam radius ${bahaya.radius_km} km.`)
    }
  }
  return out
}

export function KejadianHeaderBand({ k, status, loadingRange }: { k: any; status?: any; loadingRange?: boolean }) {
  const pills: { text: string; tone: string }[] = []
  if (status?.label) pills.push({ text: status.label, tone: status.tone || 'slate' })
  if (k?.krisis) pills.push({ text: 'Krisis kesehatan', tone: 'rose' })
  if (k?.koordinat?.label) pills.push({ text: k.koordinat.label, tone: 'slate' })
  if (status?.hari != null) pills.push({ text: `${status.hari} hari sejak kejadian`, tone: 'teal' })
  return (
    <header className="relative overflow-hidden rounded-2xl border border-teal-100 bg-white" data-testid="kejadian-header-band">
      <div className="absolute inset-y-0 left-0 w-1.5 bg-[#00705a]" />
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-teal-50" />
      <div className="pointer-events-none absolute -bottom-16 right-24 h-32 w-32 rounded-full bg-emerald-50/80" />
      <div className="relative flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6 sm:py-6">
        <div className="min-w-0">
          <Link href={`${PUBLIC_BASE_PATH}/dashboard/spatial-mode`} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#00705a] hover:underline">
            ← Kembali ke peta
          </Link>
          <p className="skdr-eyebrow mt-2">Pusat Krisis Kesehatan · Detail kejadian</p>
          <div className="mt-2 flex items-start gap-3">
            {k.icon?.src ? <img alt="" aria-hidden src={k.icon.src} className="mt-0.5 h-11 w-10 shrink-0 object-contain" /> : null}
            <div className="min-w-0">
              <h1 className="text-xl font-bold leading-tight tracking-tight text-slate-900 sm:text-2xl lg:text-3xl">
                {k.jenis} · {[k.kabupaten, k.provinsi].filter(Boolean).join(', ')}
              </h1>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                {tglKejadian(k.tanggal, k.jam)}
                {loadingRange ? ' · memuat rentang…' : ''}
              </p>
              {pills.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {pills.map((p) => (
                    <span key={p.text} className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${PILL[p.tone] || PILL.slate}`}>
                      {p.text}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
        {k.url ? (
          <a href={k.url} target="_blank" rel="noreferrer" className="inline-flex h-9 shrink-0 items-center gap-1.5 self-start rounded-xl border border-teal-200 bg-teal-50 px-3 text-[11px] font-bold text-teal-800 hover:bg-teal-100">
            Sumber EOC <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </div>
    </header>
  )
}

function SituasiKpi({ label, value, tone }: { label: string; value: number | null | undefined; tone: string }) {
  return (
    <div className={`rounded-2xl border px-3.5 py-3 ${KPI_TONE[tone] || KPI_TONE.slate}`} data-testid="kejadian-kpi">
      <div className="truncate text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-black leading-none tabular-nums sm:text-3xl ${KPI_VALUE[tone] || KPI_VALUE.slate}`}>{fmtAngka(value)}</div>
    </div>
  )
}

export function KejadianRingkasanSituasi({ k, status, nearby, riwayat, konteks }: { k: any; status?: any; nearby?: any; riwayat?: any; konteks?: any }) {
  const narasi = useMemo(() => susunNarasi({ k, status, nearby, riwayat, konteks }), [k, status, nearby, riwayat, konteks])
  return (
    <section className="space-y-4" data-testid="kejadian-section-situasi">
      <div>
        <p className="skdr-eyebrow">Ringkasan situasi</p>
        <h2 className="text-lg font-bold text-slate-900 sm:text-xl">Gambaran kejadian dan dampak menurut API</h2>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-7">
          {narasi.length ? (
            <div className="space-y-3 text-[13.5px] leading-relaxed text-slate-700">
              {narasi.map((s, i) => <p key={i}>{s}</p>)}
            </div>
          ) : (
            <ApiKosong pesan="Data belum tersedia dari API" />
          )}
          {konteks?.fetched_at ? (
            <p className="mt-4 text-[10px] text-slate-400">Konteks terbuka diambil {konteks.fetched_at}.</p>
          ) : konteks === null ? (
            <p className="mt-4 text-[10px] text-slate-400">Sedang mengambil konteks terbuka dari API…</p>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:col-span-5 lg:grid-cols-2" data-testid="kejadian-kpi-strip">
          <SituasiKpi label="Meninggal" value={k.meninggal} tone="rose" />
          <SituasiKpi label="Luka berat" value={k.luka_berat} tone="amber" />
          <SituasiKpi label="Luka ringan" value={k.luka_ringan} tone="amber" />
          <SituasiKpi label="Hilang" value={k.hilang} tone="slate" />
          <SituasiKpi label="Pengungsi" value={k.pengungsi} tone="teal" />
          <SituasiKpi label="Terdampak" value={k.terdampak} tone="teal" />
          <SituasiKpi label="Faskes rusak" value={k.faskes_rusak} tone="slate" />
        </div>
      </div>
    </section>
  )
}

function Indikator({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5" data-testid="kejadian-indikator">
      <div className="truncate text-[9.5px] font-black uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-0.5 text-lg font-black tabular-nums text-slate-900">{value}</div>
      {sub ? <div className="text-[10px] text-slate-500">{sub}</div> : null}
    </div>
  )
}

function indikatorUntuk(k: any, riwayat: any, konteks: any, nearby: any) {
  const items: { label: string; value: string; sub?: string }[] = []
  if (riwayat?.tersedia) {
    items.push({ label: 'Riwayat kab 12 bln', value: fmtAngka(riwayat.kab?.total), sub: riwayat.kab?.serupa != null ? `${fmtAngka(riwayat.kab.serupa)} sejenis` : 'API EOC' })
  }
  if (nearby?.psc) {
    items.push({
      label: 'PSC dalam 50 km',
      value: nearby.psc.tersedia ? `${fmtAngka(nearby.psc.aktif)}/${fmtAngka(nearby.psc.total)}` : '—',
      sub: nearby.psc.tersedia ? 'aktif / tercatat' : 'Data belum tersedia dari API',
    })
  }
  const cuaca = konteks?.cuaca
  const hujan24 = sumInWindow(cuaca?.jam, 'hujan_mm', 24)
  const hujan7 = sumInWindow(cuaca?.jam, 'hujan_mm', 24 * 7)
  const konteksSiap = konteks && konteks.ok !== false
  if (konteksSiap && cuaca && !cuaca.kosong) {
    items.push({ label: 'Suhu saat ini', value: nf(cuaca.saat_ini?.suhu, '°C'), sub: 'Open-Meteo' })
    items.push({ label: 'Hujan 24 jam', value: nf(hujan24, 'mm'), sub: 'Open-Meteo, model' })
  }
  const kind = k?.kind
  if (konteksSiap && (kind === 'banjir' || kind === 'longsor')) {
    items.push({ label: 'Hujan 7 hari', value: nf(hujan7, 'mm'), sub: 'Open-Meteo, model' })
    const last = (konteks?.banjir?.harian || []).filter((r: any) => r.debit != null).at(-1)
    if (konteks?.banjir && !konteks.banjir.kosong) {
      items.push({ label: 'Debit model', value: last ? nf(last.debit, konteks.banjir.satuan || 'm³/s') : '—', sub: 'GloFAS, bukan peringatan resmi' })
    }
  }
  const fire = konteks?.karhutla
  if (konteksSiap && (kind === 'karhutla' || (fire && ((fire.total_7hari ?? fire.total ?? 0) > 0)))) {
    items.push({ label: 'Titik panas 24 jam', value: fmtAngka(fire?.total_24jam), sub: `FIRMS, ${fire?.radius_km || 50} km` })
    items.push({ label: 'Titik panas 7 hari', value: fmtAngka(fire?.total_7hari ?? fire?.total), sub: 'FIRMS VIIRS' })
    items.push({ label: 'Keyakinan tinggi', value: fmtAngka(fire?.per_confidence?.tinggi), sub: '7 hari, FIRMS' })
  }
  const udara = konteks?.udara
  if (konteksSiap && udara && !udara.kosong) {
    items.push({ label: 'PM2.5', value: nf(udara.saat_ini?.pm25, 'µg/m³'), sub: 'CAMS, bukan ISPU resmi' })
    items.push({ label: 'US AQI', value: nf(udara.saat_ini?.us_aqi, '', 0), sub: 'model CAMS' })
  }
  const bahaya = konteks?.bahaya
  if (konteksSiap && (kind === 'gempa' || kind === 'erupsi') && bahaya) {
    const itemsB = bahaya.items || []
    const mags = itemsB.map((r: any) => r.magnitude).filter((n: any) => n != null)
    items.push({ label: kind === 'gempa' ? 'Gempa/peringatan sekitar' : 'Peringatan sekitar', value: bahaya.kosong ? '0' : fmtAngka(itemsB.length), sub: `${bahaya.radius_km} km · BMKG/GDACS` })
    if (mags.length) items.push({ label: 'Magnitudo maks', value: `M${nf(Math.max(...mags), '', 1)}`, sub: 'BMKG/GDACS dalam radius' })
  }
  return items
}

export function KejadianAnalisisSection({ k, riwayat, konteks, nearby }: { k: any; riwayat?: any; konteks?: any; nearby?: any }) {
  const kind = k?.kind
  const [rentangRiwayat, setRentangRiwayat] = useState<'30h' | '12bln'>('12bln')
  const [rentangCuaca, setRentangCuaca] = useState<'7j' | '30h'>('7j')
  const [rentangUdara, setRentangUdara] = useState<'72j' | 'harian'>('harian')

  const indikator = useMemo(() => indikatorUntuk(k, riwayat, konteks, nearby), [k, riwayat, konteks, nearby])

  const riwayatData = useMemo(() => {
    if (!riwayat?.tersedia) return []
    if (rentangRiwayat === '30h') return (riwayat.tren30 || []).map((r: any) => ({ ...r, label: String(r.tanggal || '').slice(5) }))
    return (riwayat.tren || []).map((r: any) => ({ ...r, label: String(r.bulan || '').slice(2) }))
  }, [riwayat, rentangRiwayat])

  const korbanData = useMemo(() => {
    if (!riwayat?.tersedia) return []
    const src = rentangRiwayat === '30h' ? riwayat.korban30 : riwayat.korbanTren
    return (src || []).map((r: any) => ({ ...r, label: String(r.bulan || r.tanggal || '').slice(rentangRiwayat === '30h' ? 5 : 2) }))
  }, [riwayat, rentangRiwayat])

  const cuacaData = useMemo(() => {
    const c = konteks?.cuaca
    if (!c || c.kosong) return []
    if (rentangCuaca === '7j') return (c.jam || []).map((r: any) => ({ label: String(r.waktu || '').slice(5, 16).replace('T', ' '), hujan: r.hujan_mm, suhu: r.suhu }))
    return (c.harian30 || c.harian || []).map((r: any) => ({ label: String(r.tanggal || '').slice(5), hujan: r.hujan_mm, suhu: r.suhu_max ?? r.suhu }))
  }, [konteks, rentangCuaca])

  const udaraData = useMemo(() => {
    const jam = konteks?.udara?.jam
    if (!jam?.length) return []
    if (rentangUdara === '72j') {
      const from = Date.now() - 72 * 3600_000
      return jam
        .filter((r: any) => {
          const ts = Date.parse(r.waktu)
          return Number.isFinite(ts) && ts >= from
        })
        .map((r: any) => ({ label: String(r.waktu || '').slice(5, 16).replace('T', ' '), pm25: r.pm25, aqi: r.us_aqi }))
    }
    const byDay = new Map<string, { n: number; pm25: number; aqi: number; npm: number; naqi: number }>()
    for (const r of jam) {
      const day = String(r.waktu || '').slice(0, 10)
      if (!day) continue
      const row = byDay.get(day) || { n: 0, pm25: 0, aqi: 0, npm: 0, naqi: 0 }
      row.n += 1
      if (r.pm25 != null) { row.pm25 += Number(r.pm25); row.npm += 1 }
      if (r.us_aqi != null) { row.aqi += Number(r.us_aqi); row.naqi += 1 }
      byDay.set(day, row)
    }
    return [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([tanggal, r]) => ({
      label: tanggal.slice(5),
      pm25: r.npm ? Math.round((r.pm25 / r.npm) * 10) / 10 : null,
      aqi: r.naqi ? Math.round(r.aqi / r.naqi) : null,
    }))
  }, [konteks, rentangUdara])

  const firmsData = useMemo(() => (konteks?.karhutla?.tren || []).map((r: any) => ({
    label: String(r.tanggal || '').slice(5),
    n: r.n,
    tinggi: r.tinggi ?? 0,
    sedang: r.sedang ?? 0,
    rendah: r.rendah ?? 0,
  })), [konteks])

  const debitData = useMemo(() => (konteks?.banjir?.harian || []).map((r: any) => ({
    label: String(r.tanggal || '').slice(5),
    debit: r.debit,
    rerata: r.debit_rerata,
  })), [konteks])

  const showFirms = kind === 'karhutla' || firmsData.some((r: any) => r.n > 0)
  const showDebit = kind === 'banjir'
  const showBahaya = kind === 'gempa' || kind === 'erupsi'
  const bahayaItems = konteks?.bahaya?.items || []

  return (
    <section className="space-y-4" data-testid="kejadian-section-analitik">
      <div>
        <p className="skdr-eyebrow">Analisis dampak</p>
        <h2 className="text-lg font-bold text-slate-900 sm:text-xl">Data situasi per indikator</h2>
        <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-slate-500">
          Indikator dan grafik disusun dari API EOC serta sumber terbuka tanpa kunci, dibatasi pada kejadian ini
          (kab/kota, radius, atau titik koordinat). Bukan angka nasional atau data contoh.
        </p>
      </div>

      {indikator.length ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" data-testid="kejadian-indikator-strip">
          {indikator.map((it) => <Indikator key={it.label} {...it} />)}
        </div>
      ) : (
        <ApiKosong pesan="Data belum tersedia dari API" />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="Riwayat kejadian di wilayah yang sama"
          sumber="API EOC Pusat Krisis · agregat kab/kota dan kejadian sejenis"
          actions={<RangeBtn value={rentangRiwayat} onChange={(id) => setRentangRiwayat(id as '30h' | '12bln')} options={[{ id: '30h', label: '30 hari' }, { id: '12bln', label: '12 bulan' }]} />}
          empty={!riwayatData.length}
          catatan={riwayat?.tersedia ? `Kab/kota ${fmtAngka(riwayat.kab?.total)} (${fmtAngka(riwayat.kab?.serupa)} sejenis) · Provinsi ${fmtAngka(riwayat.prov?.total)}` : undefined}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={riwayatData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="kab" name="Kab/kota" fill="#00705a" radius={[3, 3, 0, 0]} />
              <Bar dataKey="serupa_kab" name="Sejenis" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Tren korban di kab/kota yang sama"
          sumber="API EOC Pusat Krisis · jumlah meninggal, luka, dan pengungsi pada kejadian lain di wilayah ini"
          actions={<RangeBtn value={rentangRiwayat} onChange={(id) => setRentangRiwayat(id as '30h' | '12bln')} options={[{ id: '30h', label: '30 hari' }, { id: '12bln', label: '12 bulan' }]} />}
          empty={!korbanData.length}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={korbanData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="meninggal" name="Meninggal" fill="#be123c" radius={[3, 3, 0, 0]} stackId="a" />
              <Bar dataKey="luka" name="Luka" fill="#d97706" radius={[3, 3, 0, 0]} stackId="a" />
              <Bar dataKey="pengungsi" name="Pengungsi" fill="#0f766e" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Curah hujan dan suhu di titik kejadian"
          sumber="Open-Meteo forecast dan arsip · model cuaca global, bukan prakiraan resmi BMKG"
          actions={<RangeBtn value={rentangCuaca} onChange={(id) => setRentangCuaca(id as '7j' | '30h')} options={[{ id: '7j', label: 'Jam (7 hari)' }, { id: '30h', label: '30 hari' }]} />}
          pending={konteks == null}
          empty={!cuacaData.length}
          catatan={konteks?.cuaca?.error ? `Gagal memuat: ${konteks.cuaca.error}` : undefined}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={cuacaData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis yAxisId="kiri" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="kanan" orientation="right" tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area yAxisId="kiri" type="monotone" dataKey="hujan" name="Hujan (mm)" stroke="#0284c7" fill="#bae6fd" strokeWidth={1.6} />
              <Line yAxisId="kanan" type="monotone" dataKey="suhu" name="Suhu (°C)" stroke="#b45309" strokeWidth={1.8} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Kualitas udara PM2.5 dan US AQI"
          sumber="Open-Meteo Air Quality · model CAMS Copernicus, bukan ISPU resmi"
          actions={<RangeBtn value={rentangUdara} onChange={(id) => setRentangUdara(id as '72j' | 'harian')} options={[{ id: '72j', label: '72 jam' }, { id: 'harian', label: 'Harian' }]} />}
          pending={konteks == null}
          empty={!udaraData.length}
          catatan="Nilai US AQI dan PM2.5 berasal dari model CAMS. Bukan ISPU resmi stasiun KLHK."
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={udaraData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis yAxisId="kiri" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="kanan" orientation="right" tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area yAxisId="kiri" type="monotone" dataKey="pm25" name="PM2.5 (µg/m³)" stroke="#7c3aed" fill="#ddd6fe" strokeWidth={1.6} />
              <Line yAxisId="kanan" type="monotone" dataKey="aqi" name="US AQI" stroke="#0f766e" strokeWidth={1.8} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        {showFirms ? (
          <ChartCard
            title="Titik panas FIRMS di sekitar kejadian"
            sumber={`NASA FIRMS VIIRS · radius ${konteks?.karhutla?.radius_km || 50} km, 24 jam vs 7 hari menurut keyakinan`}
            pending={konteks == null}
            empty={!firmsData.length}
            catatan={
              konteks?.karhutla
                ? `24 jam: ${fmtAngka(konteks.karhutla.total_24jam)} titik · 7 hari: ${fmtAngka(konteks.karhutla.total_7hari ?? konteks.karhutla.total)} titik · keyakinan tinggi ${fmtAngka(konteks.karhutla.per_confidence?.tinggi)}, sedang ${fmtAngka(konteks.karhutla.per_confidence?.sedang)}, rendah ${fmtAngka(konteks.karhutla.per_confidence?.rendah)}.`
                : undefined
            }
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={firmsData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="tinggi" name="Tinggi" stackId="a" fill="#be123c" radius={[0, 0, 0, 0]} />
                <Bar dataKey="sedang" name="Sedang" stackId="a" fill="#d97706" />
                <Bar dataKey="rendah" name="Rendah" stackId="a" fill="#94a3b8" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        ) : null}

        {showDebit ? (
          <ChartCard
            title="Debit sungai model di sekitar lokasi"
            sumber="GloFAS melalui Open-Meteo Flood · model debit global, bukan peringatan resmi BNPB atau BMKG"
            pending={konteks == null}
            empty={!debitData.length || !debitData.some((r: any) => r.debit != null)}
            catatan={konteks?.banjir?.error ? `Gagal memuat: ${konteks.banjir.error}` : 'Ditampilkan hanya jika API model mengembalikan data.'}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={debitData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="debit" name={`Debit (${konteks?.banjir?.satuan || 'm³/s'})`} stroke="#0369a1" fill="#bae6fd" strokeWidth={1.6} />
                <Line type="monotone" dataKey="rerata" name="Rerata model" stroke="#57534e" strokeWidth={1.4} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>
        ) : null}

        {showBahaya ? (
          <article className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 lg:col-span-2" data-testid="kejadian-bahaya">
            <h3 className="text-sm font-bold text-slate-900">Gempa dan peringatan di sekitar lokasi</h3>
            <p className="mt-0.5 text-[10px] text-slate-400">{konteks?.bahaya?.sumber || 'BMKG dan GDACS'} · radius {konteks?.bahaya?.radius_km || '—'} km</p>
            {konteks == null ? (
              <div className="mt-3"><ApiKosong pending pesan="Sedang mengambil data dari API…" /></div>
            ) : bahayaItems.length ? (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-[12px]">
                  <thead className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="pb-2 pr-3">Sumber</th>
                      <th className="pb-2 pr-3">Peristiwa</th>
                      <th className="pb-2 pr-3">Lokasi</th>
                      <th className="pb-2 pr-3">Magnitudo</th>
                      <th className="pb-2 pr-3">Waktu</th>
                      <th className="pb-2">Jarak</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bahayaItems.map((row: any, i: number) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="py-2 pr-3 font-semibold text-slate-600">{row.sumber || '—'}</td>
                        <td className="py-2 pr-3 font-semibold text-slate-800">{row.title || row.label || '—'}</td>
                        <td className="py-2 pr-3 text-slate-600">{row.place || '—'}</td>
                        <td className="py-2 pr-3 tabular-nums">{row.magnitude != null ? `M${nf(row.magnitude, '', 1)}` : '—'}</td>
                        <td className="py-2 pr-3 text-slate-600">{row.time || '—'}</td>
                        <td className="py-2 tabular-nums">{row.jarak_km != null ? `${nf(row.jarak_km, 'km')}` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-3"><ApiKosong pesan="Data belum tersedia dari API" detail={konteks?.magma?.catatan} /></div>
            )}
          </article>
        ) : null}
      </div>
    </section>
  )
}

export function KejadianResponSection({ nearby, rekomendasi, risiko, onShowAsis, onShowPie }: {
  nearby?: any
  rekomendasi?: { prioritas: 'tinggi' | 'sedang' | 'info'; judul: string; dasar: string }[]
  risiko?: any
  onShowAsis?: (mode: 'irbi' | 'kapasitas') => void
  onShowPie?: () => void
}) {
  return (
    <section className="space-y-4" data-testid="kejadian-section-respon">
      <div>
        <p className="skdr-eyebrow">Kesiapan respons</p>
        <h2 className="text-lg font-bold text-slate-900 sm:text-xl">Dukungan dan rekomendasi di sekitar lokasi</h2>
        <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-slate-500">
          Data PSC, ambulans, RS, TCK, dan logistik berasal dari API Pusat Krisis dalam radius 50 km.
          Rekomendasi disusun dari angka yang sama, bukan prosedur operasi resmi.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white" data-testid="kejadian-section-kesiapan">
          <div className="border-b border-slate-100 px-5 pt-4 pb-2">
            <h3 className="text-sm font-bold text-slate-900">Kesiapan di sekitar lokasi</h3>
          </div>
          <KejadianKesiapanDock nearby={nearby} />
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5" data-testid="kejadian-section-rekomendasi">
          <h3 className="text-sm font-bold text-slate-900">Rekomendasi berdasarkan data</h3>
          {rekomendasi?.length ? (
            <ul className="mt-3 space-y-2.5">
              {rekomendasi.map((r, i) => (
                <li key={i} className={`rounded-xl border px-3 py-2.5 ${PRI[r.prioritas] || PRI.info}`}>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{r.prioritas}</p>
                  <p className="mt-0.5 text-[13px] font-bold text-slate-900">{r.judul}</p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-slate-600">{r.dasar}</p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-3"><ApiKosong pesan="Data belum tersedia dari API" /></div>
          )}
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white lg:col-span-2" data-testid="kejadian-section-risiko">
          <div className="border-b border-slate-100 px-5 pt-4 pb-2">
            <h3 className="text-sm font-bold text-slate-900">Risiko wilayah · Asistensi, IRBI, dan PIE</h3>
            <p className="text-[11px] text-slate-500">Arsiran dapat ditampilkan di peta kejadian di atas.</p>
          </div>
          <KejadianRisikoDock risiko={risiko} onShowAsis={onShowAsis} onShowPie={onShowPie} />
        </article>
      </div>
    </section>
  )
}
