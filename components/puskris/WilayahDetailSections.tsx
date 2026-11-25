/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import ApiKosong from '@/components/puskris/ApiKosong'
import { PUBLIC_BASE_PATH } from '@/lib/public-path'
import { fmtAngka, tglKejadian } from '@/lib/puskris/eoc-markers'
import { kejadianHref, wilayahHref } from '@/lib/puskris/eoc-event-layer'

const PILL: Record<string, string> = {
  rose: 'bg-rose-700 text-white',
  amber: 'bg-amber-500 text-slate-900',
  teal: 'bg-[#00705a] text-white',
  slate: 'bg-slate-600 text-white',
}
const KPI_BOX: Record<string, string> = {
  rose: 'border-rose-100 bg-rose-50/80',
  amber: 'border-amber-100 bg-amber-50/80',
  teal: 'border-teal-100 bg-teal-50/70',
  slate: 'border-slate-200 bg-slate-50',
}
const KPI_VAL: Record<string, string> = {
  rose: 'text-rose-800',
  amber: 'text-amber-800',
  teal: 'text-[#00705a]',
  slate: 'text-slate-800',
}
const ANALISA_TONE: Record<string, string> = {
  tinggi: 'border-rose-200 bg-rose-50 text-rose-900',
  sedang: 'border-amber-200 bg-amber-50 text-amber-950',
  info: 'border-slate-200 bg-slate-50 text-slate-800',
}
const ANALISA_DOT: Record<string, string> = {
  tinggi: 'bg-rose-600',
  sedang: 'bg-amber-500',
  info: 'bg-slate-500',
}

function nf(n: number | null | undefined, satuan?: string) {
  if (n == null || Number.isNaN(Number(n))) return '—'
  const s = Number(n).toLocaleString('id-ID')
  return satuan ? `${s} ${satuan}` : s
}

function Kpi({ label, value, tone = 'slate', sub }: { label: string; value: ReactNode; tone?: string; sub?: string }) {
  return (
    <div className={`rounded-xl border px-2.5 py-2 ${KPI_BOX[tone] || KPI_BOX.slate}`}>
      <div className="truncate text-[9.5px] font-black uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-0.5 text-lg font-black leading-none tabular-nums sm:text-xl ${KPI_VAL[tone] || KPI_VAL.slate}`}>{value}</div>
      {sub ? <div className="mt-0.5 truncate text-[10px] text-slate-500">{sub}</div> : null}
    </div>
  )
}

function SectionCard({ id, eyebrow, title, source, kpis, actions, children }: {
  id: string; eyebrow: string; title: string; source?: string; kpis?: ReactNode; actions?: ReactNode; children?: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white" data-testid={id}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{eyebrow}</p>
          <h2 className="text-[15px] font-bold leading-tight text-slate-900 sm:text-base">{title}</h2>
          {source ? <p className="mt-0.5 text-[10px] text-slate-400">{source}</p> : null}
        </div>
        {actions}
      </div>
      {kpis ? <div className="grid grid-cols-[repeat(auto-fit,minmax(108px,1fr))] gap-2 px-5 py-3">{kpis}</div> : null}
      {children ? <div className={`px-5 pb-5 ${kpis ? '' : 'pt-4'}`}>{children}</div> : null}
    </section>
  )
}

function Empty({ pending }: { pending?: boolean }) {
  return <ApiKosong compact pending={pending} pesan={pending ? 'Sedang mengambil data dari API…' : 'Data belum tersedia dari API'} />
}

function Matrix({ columns, rows, rowKey, highlight }: {
  columns: { key: string; label: string; align?: 'left' | 'right'; fmt?: (v: any, row: any) => ReactNode }[]
  rows: any[]
  rowKey: (row: any, i: number) => string
  highlight?: (row: any) => boolean
}) {
  if (!rows.length) return <Empty />
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-100">
      <table className="w-full min-w-[480px] text-left text-[12px]">
        <thead>
          <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400">
            {columns.map((c) => (
              <th key={c.key} className={`whitespace-nowrap px-3 py-2 ${c.align === 'right' ? 'text-right' : 'text-left'}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={rowKey(row, i)} className={`border-t border-slate-100 ${highlight?.(row) ? 'bg-teal-50/70' : 'bg-white'}`}>
              {columns.map((c) => (
                <td key={c.key} className={`px-3 py-1.5 ${c.align === 'right' ? 'text-right tabular-nums font-semibold text-slate-800' : 'text-slate-700'}`}>
                  {c.fmt ? c.fmt(row[c.key], row) : (row[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ChartBox({ empty, children }: { empty?: boolean; children?: ReactNode }) {
  if (empty) return <Empty />
  return <div className="h-40">{children}</div>
}

const tipStyle = { fontSize: 11 }

function heatColor(n: number, max: number) {
  if (!n || max <= 0) return '#f8fafc'
  const t = Math.max(0.15, n / max)
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t)
  return `rgb(${mix(240, 0)}, ${mix(253, 112)}, ${mix(250, 90)})`
}

function HeatGrid({
  rows, cols, value, max, rowHref, colLabels,
}: {
  rows: { key: string; label: string }[]
  cols: { key: string; label: string }[]
  value: (row: string, col: string) => number
  max: number
  rowHref?: (row: { key: string; label: string }) => string | null
  colLabels?: boolean
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
                {rowHref?.(r) ? <Link href={rowHref(r)!} className="text-[#00705a] hover:underline">{r.label}</Link> : r.label}
              </th>
              {cols.map((c) => {
                const n = value(r.key, c.key)
                return (
                  <td key={c.key} className="px-0.5 py-0.5 text-center">
                    <div
                      className="flex h-7 min-w-[2rem] items-center justify-center rounded-md tabular-nums font-bold"
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
      {colLabels === false ? null : (
        <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-500">
          <span>Sedikit</span>
          <span className="h-2 w-24 rounded-full" style={{ background: 'linear-gradient(90deg,#f0fdfa,#00705a)' }} />
          <span>Banyak</span>
          <span className="ml-auto tabular-nums">Maks. {max || 0}</span>
        </div>
      )}
    </div>
  )
}

export function WilayahHeaderBand({
  nama, level, kode, tahun, rekap, loadingRange,
}: {
  nama: { nama: string; provinsi: string; kabupaten: string | null }
  level: 'provinsi' | 'kabupaten'
  kode: string
  tahun: number
  rekap: { terpantau: number; berdampak_krisis: number; meninggal: number; pengungsi: number; terdampak: number }
  loadingRange?: boolean
}) {
  const pills: { text: string; tone: string }[] = [
    { text: level === 'kabupaten' ? 'Kabupaten/Kota' : 'Provinsi', tone: 'teal' },
    { text: `Kode ${kode}`, tone: 'slate' },
    { text: `Tahun ${tahun}`, tone: 'slate' },
  ]
  if (rekap.berdampak_krisis > 0) pills.push({ text: `${fmtAngka(rekap.berdampak_krisis)} krisis`, tone: 'rose' })
  return (
    <header className="relative overflow-hidden rounded-2xl border border-teal-100 bg-white" data-testid="wilayah-header-band">
      <div className="absolute inset-y-0 left-0 w-1.5 bg-[#00705a]" />
      <div className="relative flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="min-w-0">
          <Link href={`${PUBLIC_BASE_PATH}/dashboard/spatial-mode`} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#00705a] hover:underline">← Kembali ke peta</Link>
          <p className="mt-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Pusat Krisis Kesehatan · Detail wilayah</p>
          <h1 className="mt-1.5 text-xl font-bold leading-tight tracking-tight text-slate-900 sm:text-2xl">{nama.nama}</h1>
          <p className="mt-0.5 text-sm font-semibold text-slate-600">
            {fmtAngka(rekap.terpantau)} kejadian
            {rekap.terdampak ? ` · ${fmtAngka(rekap.terdampak)} terdampak` : ''}
            {rekap.meninggal ? ` · ${fmtAngka(rekap.meninggal)} meninggal` : ''}
            {rekap.pengungsi ? ` · ${fmtAngka(rekap.pengungsi)} pengungsi` : ''}
            {loadingRange ? ' · memuat…' : ''}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {pills.map((p) => (
              <span key={p.text} className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${PILL[p.tone] || PILL.slate}`}>{p.text}</span>
            ))}
          </div>
        </div>
        <a href="https://pusatkrisis.kemkes.go.id/" target="_blank" rel="noreferrer" className="inline-flex h-8 shrink-0 items-center self-start rounded-lg border border-teal-200 bg-teal-50 px-2.5 text-[11px] font-bold text-teal-800 hover:bg-teal-100">
          Sumber EOC
        </a>
      </div>
    </header>
  )
}

export function WilayahIndikatorSections({
  packed, jenis, onJenis, tahun, heroMap,
}: {
  packed: any
  jenis: string | null
  onJenis: (id: string | null) => void
  tahun: number
  heroMap: ReactNode
}) {
  const [lihat, setLihat] = useState(25)
  const list: any[] = packed.filtered || []
  const rekap = packed.rekap
  const opsi: { id: string; n: number }[] = packed.opsiJenis || []
  const tren = packed.tren || []
  const adaTren = tren.some((r: any) => r.kejadian > 0)
  const panas = packed.panasJenis
  const panasKab = packed.panasKab
  const kabRows = packed.kabRows || []
  const jenisRows = packed.jenisRows || []
  const ctx = packed.ctx
  const analisa = packed.analisa || []
  const more = Math.max(0, list.length - lihat)

  const jenisChart = useMemo(() => jenisRows.slice(0, 10).map((r: any) => ({
    nama: r.jenis.length > 28 ? `${r.jenis.slice(0, 26)}…` : r.jenis,
    penuh: r.jenis,
    kejadian: r.kejadian,
    krisis: r.krisis,
  })), [jenisRows])

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <div className="flex flex-wrap gap-1.5" data-testid="wilayah-filter-jenis">
        <button type="button" onClick={() => onJenis(null)} className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${!jenis ? 'bg-[#00705a] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Semua jenis</button>
        {opsi.map((o) => (
          <button key={o.id} type="button" onClick={() => onJenis(o.id)} className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${jenis === o.id ? 'bg-[#00705a] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {o.id} <span className="tabular-nums opacity-80">{o.n}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6 lg:items-start">
        <div className="flex flex-col gap-5 lg:col-span-5">
          <SectionCard
            id="wilayah-sec-analisa"
            eyebrow="Analisa & ringkasan"
            title="Temuan dari data yang tersedia"
            source="Dihitung dari EOC, PSC, TCK, logistik, dan Asistensi. Bukan arahan resmi."
            kpis={(
              <>
                <Kpi label="Kejadian" value={nf(rekap.terpantau)} tone="teal" />
                <Kpi label="Krisis" value={nf(rekap.berdampak_krisis)} tone={rekap.berdampak_krisis ? 'rose' : 'slate'} />
                <Kpi label="Kab/kota" value={nf(kabRows.length)} />
                <Kpi label="Jenis" value={nf(jenisRows.length)} />
                <Kpi label="Meninggal" value={nf(rekap.meninggal)} tone={rekap.meninggal ? 'rose' : 'slate'} />
                <Kpi label="Pengungsi" value={nf(rekap.pengungsi)} tone={rekap.pengungsi ? 'amber' : 'slate'} />
              </>
            )}
          >
            {analisa.length ? (
              <ul className="space-y-1.5">
                {analisa.map((it: any) => (
                  <li key={it.id} className={`flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold leading-snug ${ANALISA_TONE[it.tingkat]}`}>
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${ANALISA_DOT[it.tingkat]}`} aria-hidden />
                    <span>{it.teks}</span>
                  </li>
                ))}
              </ul>
            ) : <Empty />}
          </SectionCard>
        </div>
        <div className="lg:col-span-7">{heroMap}</div>
      </div>

      <SectionCard
        id="wilayah-sec-tren"
        eyebrow="Tren"
        title={`Kejadian per bulan · ${tahun}`}
        source="API EOC Pusat Krisis Kesehatan, agregat tanggal kejadian di wilayah ini"
        kpis={(
          <>
            <Kpi label="Puncak bulanan" value={adaTren ? nf(Math.max(...tren.map((r: any) => r.kejadian))) : '—'} sub={adaTren ? tren.reduce((a: any, b: any) => (b.kejadian > a.kejadian ? b : a)).bulan : undefined} tone="teal" />
            <Kpi label="Krisis (tahun)" value={nf(rekap.berdampak_krisis)} tone={rekap.berdampak_krisis ? 'rose' : 'slate'} />
          </>
        )}
      >
        <ChartBox empty={!adaTren}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={tren} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="bulan" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={28} />
              <Tooltip contentStyle={tipStyle} />
              <Bar dataKey="kejadian" name="Kejadian" fill="#00705a" radius={[3, 3, 0, 0]} />
              <Line type="monotone" dataKey="krisis" name="Krisis" stroke="#be123c" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartBox>
        {adaTren && tren.some((r: any) => r.meninggal || r.pengungsi) ? (
          <div className="mt-4">
            <p className="mb-2 text-[11px] font-semibold text-slate-500">Meninggal dan pengungsi per bulan (terdampak ada di ringkasan dampak)</p>
            <ChartBox>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tren} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="bulan" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={36} />
                  <Tooltip contentStyle={tipStyle} />
                  <Bar dataKey="meninggal" name="Meninggal" fill="#be123c" />
                  <Bar dataKey="pengungsi" name="Pengungsi" fill="#d97706" />
                </BarChart>
              </ResponsiveContainer>
            </ChartBox>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard
        id="wilayah-sec-heatmap"
        eyebrow="Heatmap"
        title={`Jenis kejadian × bulan · ${tahun}`}
        source="Jumlah kejadian EOC per jenis dan bulan di wilayah ini"
      >
        <HeatGrid
          rows={(panas?.jenis || []).map((j: string) => ({ key: j, label: j }))}
          cols={(panas?.months || []).map((m: string, i: number) => ({ key: String(i + 1), label: m }))}
          value={(row, col) => Number(panas?.cells?.[`${row}|${col}`] || 0)}
          max={panas?.max || 0}
        />
      </SectionCard>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
        <SectionCard id="wilayah-sec-jenis" eyebrow="Jenis bencana" title="Sebaran jenis kejadian" source="API EOC, dihitung di wilayah dan periode ini">
          <ChartBox empty={!jenisChart.length}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={jenisChart} layout="vertical" margin={{ top: 0, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="nama" width={120} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={tipStyle} formatter={(v, _n, p: any) => [v, p?.payload?.penuh]} />
                <Bar dataKey="kejadian" name="Kejadian" fill="#00705a" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartBox>
        </SectionCard>
        <SectionCard
          id="wilayah-sec-dampak"
          eyebrow="Dampak"
          title="Total dampak di wilayah ini"
          source="Jumlah kumulatif dari rekaman EOC, bukan estimasi"
          kpis={(
            <>
              <Kpi label="Terdampak" value={nf(rekap.terdampak)} tone="teal" />
              <Kpi label="Meninggal" value={nf(rekap.meninggal)} tone={rekap.meninggal ? 'rose' : 'slate'} />
              <Kpi label="Hilang" value={nf(rekap.hilang)} />
              <Kpi label="Luka" value={nf(rekap.luka)} />
              <Kpi label="Pengungsi" value={nf(rekap.pengungsi)} tone={rekap.pengungsi ? 'amber' : 'slate'} />
              <Kpi label="Faskes rusak" value={nf(rekap.faskes_rusak)} tone={rekap.faskes_rusak ? 'amber' : 'slate'} />
            </>
          )}
        />
      </div>

      {packed.level === 'provinsi' ? (
        <SectionCard
          id="wilayah-sec-kab"
          eyebrow="Kabupaten/Kota"
          title="Kejadian per kab/kota"
          source="API EOC, dikelompokkan menurut kode dan nama kab/kota"
        >
          <HeatGrid
            rows={kabRows.slice(0, 16).map((r: any) => ({ key: r.code, label: r.nama }))}
            cols={(panasKab?.jenis || []).map((j: string) => ({ key: j, label: j.length > 14 ? `${j.slice(0, 12)}…` : j }))}
            value={(row, col) => Number(panasKab?.cells?.[`${row}|${col}`] || 0)}
            max={panasKab?.max || 0}
            rowHref={(r) => (String(r.key).length === 4 ? wilayahHref(packed.prov, { tahun, kab: r.key }) : null)}
          />
          <div className="mt-4">
            <Matrix
              rowKey={(r) => r.code}
              rows={kabRows}
              columns={[
                { key: 'nama', label: 'Kab/Kota', fmt: (v, r) => (String(r.code).length === 4 ? <Link href={wilayahHref(packed.prov, { tahun, kab: r.code })} className="font-semibold text-[#00705a] hover:underline">{v}</Link> : v) },
                { key: 'kejadian', label: 'Kejadian', align: 'right', fmt: (v) => nf(v) },
                { key: 'krisis', label: 'Krisis', align: 'right', fmt: (v) => nf(v) },
                { key: 'meninggal', label: 'Meninggal', align: 'right', fmt: (v) => nf(v) },
                { key: 'pengungsi', label: 'Pengungsi', align: 'right', fmt: (v) => nf(v) },
                { key: 'terdampak', label: 'Terdampak', align: 'right', fmt: (v) => nf(v) },
                { key: 'jenis_utama', label: 'Jenis utama' },
              ]}
            />
          </div>
        </SectionCard>
      ) : null}

      <SectionCard
        id="wilayah-sec-kesiapan"
        eyebrow="Kesiapan wilayah"
        title="PSC, TCK, logistik, dan asistensi"
        source="Agregat tingkat provinsi dari API terkait, bila tersedia"
        kpis={(
          <>
            <Kpi label="PSC aktif" value={ctx?.psc?.tersedia ? `${nf(ctx.psc.psc_aktif)}/${nf(ctx.psc.psc_total)}` : '—'} tone="teal" sub={ctx?.psc?.tersedia ? 'API PSC 119' : undefined} />
            <Kpi label="Ambulans" value={ctx?.psc?.tersedia ? nf(ctx.psc.ambulans) : '—'} />
            <Kpi label="Relawan TCK" value={ctx?.tck?.tersedia ? nf(ctx.tck.individu) : '—'} sub={ctx?.tck?.tersedia && ctx.tck.tim != null ? `${nf(ctx.tck.tim)} tim` : undefined} />
            <Kpi label="Stok logistik" value={ctx?.logistik?.tersedia ? nf(ctx.logistik.total) : '—'} sub={ctx?.logistik?.tersedia ? `Gudang regional: ${ctx.logistik.nama}` : undefined} />
            <Kpi label="Kapasitas" value={ctx?.risiko?.tersedia ? (ctx.risiko.kapasitas || '—') : '—'} />
            <Kpi label="IRBI" value={ctx?.risiko?.tersedia ? (ctx.risiko.irbi || '—') : '—'} />
          </>
        )}
      >
        {!ctx?.psc?.tersedia && !ctx?.tck?.tersedia && !ctx?.logistik?.tersedia && !ctx?.risiko?.tersedia ? <Empty /> : (
          <p className="text-[11px] text-slate-500">Angka di atas adalah agregat provinsi dari API, bukan estimasi di sekitar satu titik kejadian.</p>
        )}
      </SectionCard>

      <SectionCard
        id="wilayah-sec-daftar"
        eyebrow="Daftar kejadian"
        title={`Kejadian di wilayah ini (${fmtAngka(list.length)})`}
        source="Setiap baris membuka halaman detail kejadian yang sudah ada"
      >
        <Matrix
          rowKey={(r) => r.uid}
          rows={list.slice(0, lihat)}
          highlight={(r) => Boolean(r.krisis)}
          columns={[
            { key: 'tanggal', label: 'Tanggal', fmt: (_v, r) => tglKejadian(r.tanggal, r.jam) },
            { key: 'jenis', label: 'Jenis', fmt: (v, r) => <Link href={kejadianHref(String(r.uid), r.tanggal)} className="font-semibold text-[#00705a] hover:underline">{v}</Link> },
            { key: 'kabupaten', label: 'Kab/Kota', fmt: (v) => v || '—' },
            { key: 'krisis', label: 'Status', fmt: (v) => <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${v ? 'bg-rose-100 text-rose-800' : 'bg-teal-50 text-teal-800'}`}>{v ? 'Krisis' : 'Terpantau'}</span> },
            { key: 'meninggal', label: 'Meninggal', align: 'right', fmt: (v) => nf(v) },
            { key: 'pengungsi', label: 'Pengungsi', align: 'right', fmt: (v) => nf(v) },
            { key: 'terdampak', label: 'Terdampak', align: 'right', fmt: (v) => nf(v) },
          ]}
        />
        {more > 0 ? (
          <button type="button" onClick={() => setLihat((n) => n + 25)} className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-[12px] font-bold text-slate-700 hover:bg-slate-50">
            Tampilkan 25 lagi ({fmtAngka(more)} tersisa)
          </button>
        ) : null}
      </SectionCard>
    </div>
  )
}
