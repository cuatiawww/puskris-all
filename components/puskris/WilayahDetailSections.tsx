/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Flame,
  MapPin,
  Package,
  Stethoscope,
  Users,
} from 'lucide-react'
import WilayahKarakteristik from '@/components/puskris/WilayahKarakteristik'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PUBLIC_BASE_PATH } from '@/lib/public-path'
import { fmtAngka, tglKejadian } from '@/lib/puskris/eoc-markers'
import { kejadianHref, wilayahHref } from '@/lib/puskris/eoc-event-layer'

const CHART = ['#0F766E', '#EA580C', '#7C3AED', '#2563EB', '#DB2777', '#CA8A04', '#16A34A']

function nf(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return Number(n).toLocaleString('id-ID')
}

function Empty({ pending }: { pending?: boolean }) {
  return (
    <div className="flex h-full min-h-[120px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs font-semibold text-slate-500">
      {pending ? 'Sedang mengambil data dari API…' : 'Data belum tersedia dari API'}
    </div>
  )
}

function Card({ title, icon: Icon, source, children, className = '', actions }: {
  title: string; icon?: any; source?: string; children?: ReactNode; className?: string; actions?: ReactNode
}) {
  return (
    <article className={`flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_4px_12px_rgba(0,0,0,0.02)] sm:p-5 ${className}`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {Icon ? <Icon className="h-4 w-4 shrink-0 text-[#047D78]" /> : null}
          <h5 className="m-0 text-sm font-black text-slate-900 sm:text-base">{title}</h5>
        </div>
        {actions}
      </div>
      <div className="flex-1">{children}</div>
      {source ? <p className="m-0 mt-3 border-t border-slate-100 pt-2 text-[10.5px] leading-snug text-slate-500">{source}</p> : null}
    </article>
  )
}

function KpiTile({ label, value, sub, tone = 'slate' }: { label: string; value: ReactNode; sub?: string; tone?: string }) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-50 border-slate-200 text-slate-900',
    orange: 'bg-orange-50 border-orange-200 text-orange-950',
    red: 'bg-rose-50 border-rose-200 text-rose-950',
    teal: 'bg-teal-50 border-teal-200 text-teal-950',
    violet: 'bg-violet-50 border-violet-200 text-violet-950',
    amber: 'bg-amber-50 border-amber-200 text-amber-950',
    dark: 'bg-slate-900 border-slate-800 text-white',
  }
  return (
    <div className={`flex min-h-[96px] min-w-[150px] flex-1 basis-[170px] flex-col justify-between rounded-xl border p-3 ${tones[tone] || tones.slate}`}>
      <div className="text-[10px] font-black uppercase tracking-wider opacity-70">{label}</div>
      <div className="mt-1 text-xl font-black leading-tight sm:text-2xl">{value}</div>
      {sub ? <div className="mt-0.5 text-[10.5px] font-semibold opacity-75">{sub}</div> : null}
    </div>
  )
}

function heatColor(n: number, max: number) {
  if (!n || max <= 0) return '#f8fafc'
  const t = Math.max(0.15, n / max)
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t)
  return `rgb(${mix(240, 4)}, ${mix(253, 125)}, ${mix(250, 120)})`
}

function HeatGrid({
  rows, cols, value, max, rowHref,
}: {
  rows: { key: string; label: string }[]
  cols: { key: string; label: string }[]
  value: (row: string, col: string) => number
  max: number
  rowHref?: (row: { key: string; label: string }) => string | null
}) {
  if (!rows.length) return <Empty />
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-[11px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-white px-2 py-1.5 text-left text-[10px] font-black uppercase tracking-wider text-slate-400"> </th>
            {cols.map((c) => (
              <th key={c.key} className="px-1 py-1.5 text-center text-[10px] font-bold text-slate-500">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <th className="sticky left-0 z-10 max-w-[160px] truncate bg-white px-2 py-0.5 text-left font-semibold text-slate-700">
                {rowHref?.(r) ? <Link href={rowHref(r)!} className="text-[#047D78] hover:underline">{r.label}</Link> : r.label}
              </th>
              {cols.map((c) => {
                const n = value(r.key, c.key)
                return (
                  <td key={c.key} className="px-0.5 py-0.5 text-center">
                    <div
                      className="flex h-7 min-w-[2rem] items-center justify-center rounded-md font-bold tabular-nums"
                      style={{ background: heatColor(n, max), color: n && n / Math.max(max, 1) > 0.55 ? '#fff' : '#134e4a' }}
                      title={`${r.label} · ${c.label}: ${n}`}
                    >
                      {n || ''}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-500">
        <span>Sedikit</span>
        <span className="h-2 w-24 rounded-full" style={{ background: 'linear-gradient(90deg,#f0fdfa,#0F766E)' }} />
        <span>Banyak</span>
        <span className="ml-auto tabular-nums">Maks. {max || 0}</span>
      </div>
    </div>
  )
}

function shortNama(s: string, n = 22) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}

const tipStyle = { fontSize: 11 }

export function WilayahIndikatorSections({
  packed, jenis, onJenis, tahun, heroMap, loadingRange,
}: {
  packed: any
  jenis: string | null
  onJenis: (id: string | null) => void
  tahun: number
  heroMap: ReactNode
  loadingRange?: boolean
}) {
  const [lihat, setLihat] = useState(25)
  const list: any[] = packed.filtered || []
  const rekap = packed.rekap
  const tren = packed.tren || []
  const adaTren = tren.some((r: any) => r.kejadian > 0)
  const panas = packed.panasJenis
  const panasKab = packed.panasKab
  const kabRows = packed.kabRows || []
  const jenisRows = packed.jenisRows || []
  const ctx = packed.ctx
  const more = Math.max(0, list.length - lihat)
  const sumberEoc = 'Sumber: API EOC Pusat Krisis Kesehatan, agregat kejadian di wilayah dan periode ini'
  const updated = packed.updatedAt ? ` | Pembaruan: ${packed.updatedAt}` : ''

  const kabChart = useMemo(() => kabRows.slice(0, 12).map((r: any) => ({
    nama: shortNama(String(r.nama || r.code), 18),
    penuh: r.nama,
    kejadian: r.kejadian,
    terdampak: r.terdampak,
    pengungsi: r.pengungsi,
  })), [kabRows])
  const topTerdampak = useMemo(() => [...kabRows].sort((a: any, b: any) => b.terdampak - a.terdampak || b.kejadian - a.kejadian).slice(0, 10).map((r: any) => ({
    nama: shortNama(String(r.nama || r.code), 22),
    penuh: r.nama,
    terdampak: r.terdampak,
    kejadian: r.kejadian,
  })), [kabRows])
  const jenisChart = useMemo(() => jenisRows.slice(0, 10).map((r: any) => ({
    nama: shortNama(r.jenis, 22),
    penuh: r.jenis,
    kejadian: r.kejadian,
    krisis: r.krisis,
  })), [jenisRows])

  const levelLabel = packed.level === 'kabupaten' ? 'Kabupaten/Kota' : 'Provinsi'

  return (
    <>
      <div className="min-w-0" data-testid="wilayah-header-band">
        <Link href={`${PUBLIC_BASE_PATH}/dashboard/spatial-mode`} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#047D78] hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke peta
        </Link>
        <h1 className="mt-2 text-[22px] font-black uppercase tracking-wide text-slate-900 sm:text-[28px] lg:text-[30px]">
          Dashboard situasi wilayah - {packed.nama.nama}
        </h1>
        <p className="mt-1 max-w-4xl text-sm text-slate-600 sm:text-base">
          Analisis spasial seluruh jenis kejadian EOC di {packed.nama.nama}: penduduk terdampak, tren, sebaran kab/kota, heatmap jenis kejadian, serta kesiapan PSC, TCK, logistik, dan asistensi.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between" data-testid="wilayah-ringkas-baris">
        <p className="min-w-0 text-sm leading-relaxed text-slate-700">
          <span className="font-black tabular-nums text-slate-900">{nf(rekap.terpantau)}</span> kejadian
          <span className="mx-1.5 text-slate-300">·</span>
          <span className="font-black tabular-nums text-slate-900">{nf(rekap.terdampak)}</span> penduduk terdampak
          <span className="mx-1.5 text-slate-300">·</span>
          <span className="font-black tabular-nums text-slate-900">{nf(kabRows.length)}</span> kab/kota
          <span className="mx-1.5 text-slate-300">·</span>
          <span className="font-black tabular-nums text-slate-900">{nf(rekap.berdampak_krisis)}</span> krisis
          {jenis ? <span className="ml-1.5 text-xs font-bold text-[#047D78]">· {jenis}</span> : <span className="ml-1.5 text-xs text-slate-500">· semua jenis</span>}
        </p>
        <div className="shrink-0 text-xs text-slate-500 sm:text-right">
          {packed.updatedAt ? <span>Terakhir Diperbarui: {packed.updatedAt}</span> : null}
          {loadingRange ? <span className="ml-2">memuat…</span> : null}
        </div>
      </div>

      <WilayahKarakteristik list={packed.list || []} selected={jenis} onSelect={onJenis} tahun={tahun} />

      {heroMap}

      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-[0_4px_12px_rgba(0,0,0,0.02)] sm:px-6">
        <h3 className="text-xl font-black text-slate-900 sm:text-2xl">Analisis Dampak Kejadian - {nf(kabRows.length)} Kabupaten/Kota Terdampak</h3>
        <p className="mt-1 text-sm text-slate-600">Visualisasi seluruh indikator dari API EOC di wilayah ini, dilengkapi agregat PSC, TCK, logistik, dan Asistensi bila tersedia.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_4px_12px_rgba(0,0,0,0.02)] sm:p-5" data-testid="wilayah-sec-indikator">
        <h3 className="text-xl font-black text-slate-900">Data Situasi Wilayah per Indikator</h3>
        <p className="mt-1 text-sm text-slate-600">Seluruh angka di bawah dihitung dari rekaman EOC di wilayah dan periode ini, serta agregat provinsi dari API terkait bila statusnya langsung.</p>
        <div className="mt-4 flex items-center gap-2">
          <Activity className="h-4 w-4 text-[#047D78]" />
          <h5 className="text-sm font-black text-slate-900 sm:text-base">Ringkasan Situasi</h5>
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          <KpiTile label="Penduduk terdampak" value={nf(rekap.terdampak)} sub={`${nf(kabRows.length)} kab/kota`} tone="violet" />
          <KpiTile label="Meninggal" value={nf(rekap.meninggal)} sub={`Hilang ${nf(rekap.hilang)}`} tone="red" />
          <KpiTile label="Kejadian" value={nf(rekap.terpantau)} sub={`${nf(rekap.berdampak_krisis)} krisis`} tone="teal" />
          <KpiTile label="Pengungsi" value={nf(rekap.pengungsi)} tone="orange" />
          <KpiTile label="Luka" value={nf(rekap.luka)} sub={`Faskes rusak ${nf(rekap.faskes_rusak)}`} tone="amber" />
          <KpiTile label="PSC aktif" value={ctx?.psc?.tersedia ? `${nf(ctx.psc.psc_aktif)}/${nf(ctx.psc.psc_total)}` : '—'} sub={ctx?.psc?.tersedia ? 'API PSC 119' : 'Data belum tersedia dari API'} tone={ctx?.psc?.tersedia ? 'dark' : 'slate'} />
          <KpiTile label="Relawan TCK" value={ctx?.tck?.tersedia ? nf(ctx.tck.individu) : '—'} sub={ctx?.tck?.tersedia && ctx.tck.tim != null ? `${nf(ctx.tck.tim)} tim` : undefined} tone="teal" />
          <KpiTile label="Stok logistik" value={ctx?.logistik?.tersedia ? nf(ctx.logistik.total) : '—'} sub={ctx?.logistik?.tersedia ? `Gudang regional: ${ctx.logistik.nama}` : undefined} tone="slate" />
        </div>
        <p className="m-0 mt-3 border-t border-slate-100 pt-2 text-[10.5px] leading-snug text-slate-500">{sumberEoc}{updated}</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title={`Kejadian per bulan · ${tahun}`} icon={BarChart3} source={`${sumberEoc}${updated}`}>
          {adaTren ? (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tren} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="bulan" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
                  <Tooltip contentStyle={tipStyle} />
                  <Bar dataKey="kejadian" name="Kejadian" fill="#0F766E" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="krisis" name="Krisis" fill="#E11D48" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <Empty />}
        </Card>

        <Card title="Kab/kota dengan penduduk terdampak terbanyak" icon={Users} source={`${sumberEoc}${updated}`}>
          {topTerdampak.some((r: any) => r.terdampak > 0) ? (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topTerdampak} layout="vertical" margin={{ top: 0, right: 16, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="nama" width={118} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={tipStyle} formatter={(v, _n, p: any) => [v, p?.payload?.penuh]} />
                  <Bar dataKey="terdampak" name="Terdampak" fill="#7C3AED" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <Empty />}
        </Card>

        <Card title="Kejadian per kab/kota" icon={MapPin} source={`${sumberEoc}${updated}`}>
          {kabChart.length ? (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={kabChart} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="nama" tick={{ fontSize: 10 }} interval={0} angle={-35} textAnchor="end" height={50} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                  <Tooltip contentStyle={tipStyle} formatter={(v, _n, p: any) => [v, p?.payload?.penuh]} />
                  <Bar dataKey="kejadian" name="Kejadian" fill="#0F766E" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <Empty />}
        </Card>

        <Card title="Sebaran jenis kejadian" icon={Flame} source={`${sumberEoc}${updated}`}>
          {jenisChart.length ? (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={jenisChart} layout="vertical" margin={{ top: 0, right: 16, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="nama" width={118} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={tipStyle} formatter={(v, _n, p: any) => [v, p?.payload?.penuh]} />
                  <Bar dataKey="kejadian" name="Kejadian" fill="#EA580C" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <Empty />}
        </Card>
      </div>

      <Card title={`Heatmap jenis kejadian × bulan · ${tahun}`} icon={Activity} source={`${sumberEoc}${updated}`} className="" >
        <div data-testid="wilayah-sec-heatmap">
          <HeatGrid
            rows={(panas?.jenis || []).map((j: string) => ({ key: j, label: j }))}
            cols={(panas?.months || []).map((m: string, i: number) => ({ key: String(i + 1), label: m }))}
            value={(row, col) => Number(panas?.cells?.[`${row}|${col}`] || 0)}
            max={panas?.max || 0}
          />
        </div>
      </Card>

      {packed.level === 'provinsi' && kabRows.length ? (
        <Card title="Kejadian per kab/kota × jenis" icon={MapPin} source={`${sumberEoc}${updated}`}>
          <div data-testid="wilayah-sec-kab">
            <HeatGrid
              rows={kabRows.slice(0, 16).map((r: any) => ({ key: r.code, label: r.nama }))}
              cols={(panasKab?.jenis || []).map((j: string) => ({ key: j, label: j.length > 14 ? `${j.slice(0, 12)}…` : j }))}
              value={(row, col) => Number(panasKab?.cells?.[`${row}|${col}`] || 0)}
              max={panasKab?.max || 0}
              rowHref={(r) => (String(r.key).length === 4 ? wilayahHref(packed.prov, { tahun, kab: r.key }) : null)}
            />
          </div>
        </Card>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_12px_rgba(0,0,0,0.02)] sm:p-6" data-testid="wilayah-sec-kesiapan">
        <h3 className="text-xl font-black text-slate-900 sm:text-2xl">Kesiapan &amp; Respons Wilayah</h3>
        <p className="mt-1 text-sm text-slate-600">Agregat tingkat provinsi dari API PSC 119, Tenaga Cadangan, Logistik, dan Asistensi, bila tersedia.</p>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-teal-200 bg-teal-50/40 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-[#047D78]" />
                <h5 className="text-sm font-black uppercase tracking-wide text-teal-900">Kesiapan layanan</h5>
              </div>
              {ctx?.psc?.tersedia ? <span className="rounded-full bg-[#047D78] px-2 py-0.5 text-[10px] font-black text-white">API PSC 119</span> : null}
            </div>
            <div className="space-y-2 text-sm">
              <Row k="PSC aktif" v={ctx?.psc?.tersedia ? `${nf(ctx.psc.psc_aktif)} / ${nf(ctx.psc.psc_total)}` : 'Data belum tersedia dari API'} />
              <Row k="Ambulans" v={ctx?.psc?.tersedia ? nf(ctx.psc.ambulans) : '—'} />
              <Row k="Relawan TCK" v={ctx?.tck?.tersedia ? nf(ctx.tck.individu) : 'Data belum tersedia dari API'} />
              <Row k="Tim TCK / EMT" v={ctx?.tck?.tersedia ? `${nf(ctx.tck.tim)} / ${nf(ctx.tck.emt)}` : '—'} />
              <Row k="Kapasitas asistensi" v={ctx?.risiko?.tersedia ? (ctx.risiko.kapasitas || '—') : 'Data belum tersedia dari API'} />
              <Row k="IRBI" v={ctx?.risiko?.tersedia ? (ctx.risiko.irbi || '—') : '—'} />
            </div>
          </div>
          <div className="rounded-2xl border border-orange-200 bg-orange-50/50 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-orange-700" />
                <h5 className="text-sm font-black uppercase tracking-wide text-orange-950">Distribusi logistik</h5>
              </div>
              {ctx?.logistik?.tersedia ? <span className="rounded-full bg-orange-600 px-2 py-0.5 text-[10px] font-black text-white">API Logistik</span> : null}
            </div>
            {ctx?.logistik?.tersedia ? (
              <div className="space-y-2 text-sm">
                <Row k="Stok tercatat" v={nf(ctx.logistik.total)} accent />
                <Row k="Gudang regional" v={ctx.logistik.nama || '—'} />
                <Row k="Kedaluwarsa" v={ctx.logistik.kedaluwarsa != null ? nf(ctx.logistik.kedaluwarsa) : '—'} />
                <p className="pt-1 text-[11px] font-semibold text-amber-800">Angka stok adalah gudang regional yang menanggung provinsi ini, bukan stok gudang di ibu kota provinsi semata.</p>
              </div>
            ) : <Empty />}
          </div>
        </div>
      </div>

      <Card
        title={`Daftar kejadian di wilayah ini (${fmtAngka(list.length)})`}
        icon={Activity}
        source="Setiap baris membuka halaman detail kejadian. Sumber: API EOC Pusat Krisis Kesehatan."
        className=""
      >
        <div data-testid="wilayah-sec-daftar" className="overflow-x-auto rounded-xl border border-slate-100">
          {list.length ? (
            <table className="w-full min-w-[640px] text-left text-[12px]">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2">Tanggal</th>
                  <th className="px-3 py-2">Jenis</th>
                  <th className="px-3 py-2">Kab/Kota</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Meninggal</th>
                  <th className="px-3 py-2 text-right">Pengungsi</th>
                  <th className="px-3 py-2 text-right">Terdampak</th>
                </tr>
              </thead>
              <tbody>
                {list.slice(0, lihat).map((r: any) => (
                  <tr key={r.uid} className={`border-t border-slate-100 ${r.krisis ? 'bg-rose-50/40' : 'bg-white'}`}>
                    <td className="whitespace-nowrap px-3 py-1.5 text-slate-700">{tglKejadian(r.tanggal, r.jam)}</td>
                    <td className="px-3 py-1.5"><Link href={kejadianHref(String(r.uid), r.tanggal)} className="font-semibold text-[#047D78] hover:underline">{r.jenis}</Link></td>
                    <td className="px-3 py-1.5 text-slate-700">{r.kabupaten || '—'}</td>
                    <td className="px-3 py-1.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${r.krisis ? 'bg-rose-100 text-rose-800' : 'bg-teal-50 text-teal-800'}`}>{r.krisis ? 'Krisis' : 'Terpantau'}</span></td>
                    <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-slate-800">{nf(r.meninggal)}</td>
                    <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-slate-800">{nf(r.pengungsi)}</td>
                    <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-slate-800">{nf(r.terdampak)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <Empty />}
        </div>
        {more > 0 ? (
          <button type="button" onClick={() => setLihat((n) => n + 25)} className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-[12px] font-bold text-slate-700 hover:bg-slate-50">
            Tampilkan 25 lagi ({fmtAngka(more)} tersisa)
          </button>
        ) : null}
      </Card>
    </>
  )
}

function Row({ k, v, accent }: { k: string; v: ReactNode; accent?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/60 py-1.5 last:border-0">
      <span className="text-[12px] font-semibold text-slate-600">{k}</span>
      <span className={`text-right text-[12px] font-black ${accent ? 'text-orange-700' : 'text-slate-900'}`}>{v}</span>
    </div>
  )
}
