/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  Activity,
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  BarChart3,
  MapPin,
  Search,
  Users,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PUBLIC_BASE_PATH } from '@/lib/public-path'
import { eocIconOf, eocKindOf, fmtAngka, tglKejadian } from '@/lib/puskris/eoc-markers'
import { kejadianHref, wilayahHref } from '@/lib/puskris/eoc-event-layer'
import { jenisKejadianHref, tahunPilihan, type JenisKejadianPack, copyJenisDashboard, narasiJenis, heroUtama } from '@/lib/puskris/jenis-kejadian'
import WilayahKarakteristik from '@/components/puskris/WilayahKarakteristik'

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
    <div className={`flex min-h-[96px] min-w-[140px] flex-1 basis-[150px] flex-col justify-between rounded-xl border p-3 ${tones[tone] || tones.slate}`}>
      <div className="text-[10px] font-black uppercase tracking-wider opacity-70">{label}</div>
      <div className="mt-1 text-xl font-black leading-tight sm:text-2xl">{value}</div>
      {sub ? <div className="mt-0.5 text-[10.5px] font-semibold opacity-75">{sub}</div> : null}
    </div>
  )
}


function HeroBig({ label, value, sub, tone = 'teal' }: { label: string; value: ReactNode; sub?: string; tone?: string }) {
  const tones: Record<string, string> = {
    teal: 'bg-teal-50/80 border-teal-100 text-teal-950',
    orange: 'bg-orange-50/90 border-orange-100 text-orange-950',
    red: 'bg-rose-50/90 border-rose-100 text-rose-950',
    violet: 'bg-violet-50/90 border-violet-100 text-violet-950',
    amber: 'bg-amber-50/90 border-amber-100 text-amber-950',
    slate: 'bg-slate-50 border-slate-200 text-slate-900',
  }
  return (
    <div className={`flex min-h-[120px] flex-col justify-between rounded-2xl border px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${tones[tone] || tones.teal}`}>
      <div className="text-[10px] font-black uppercase tracking-wider opacity-70">{label}</div>
      <div className="mt-1 text-[28px] font-black leading-none tabular-nums sm:text-[32px]">{value}</div>
      {sub ? <div className="mt-2 text-[11px] font-semibold opacity-80">{sub}</div> : null}
    </div>
  )
}

function heatColor(n: number, max: number) {
  if (!n || max <= 0) return '#f8fafc'
  const t = Math.max(0.15, n / max)
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t)
  return `rgb(${mix(240, 4)}, ${mix(253, 125)}, ${mix(250, 120)})`
}

function shortNama(s: string, n = 22) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}

const tipStyle = { fontSize: 11 }

function JenisMark({ nama, size = 28 }: { nama: string; size?: number }) {
  const icon = eocIconOf(nama)
  return (
    <span className="flex shrink-0 items-center justify-center rounded-lg" style={{ background: icon.color, width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 24 24" width={size * 0.58} height={size * 0.58} fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <g dangerouslySetInnerHTML={{ __html: icon.glyph }} />
      </svg>
    </span>
  )
}

export function JenisKejadianSections({
  packed, names: _names, jenis, tahun, prov, onJenis, onTahun, onProv, heroMap, loadingRange, prevRekap, listSemua, regions: regionsProp,
}: {
  packed: JenisKejadianPack | null
  names: string[]
  jenis: string | null
  tahun: number
  prov: string | null
  onJenis: (nama: string | null) => void
  onTahun: (y: number) => void
  onProv: (code: string | null) => void
  heroMap: ReactNode
  loadingRange?: boolean
  prevRekap: { tahun: number; rekap: any; tren: any[] } | null
  listSemua?: any[]
  regions?: { code: string; nama: string }[]
}) {
  const [lihat, setLihat] = useState(25)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'tanggal', dir: 'desc' })

  const list: any[] = packed?.list || []
  const rekap = packed?.rekap
  const tren = packed?.tren || []
  const adaTren = tren.some((r: any) => r.kejadian > 0)
  const provRows = packed?.provRows || []
  const kabRows = packed?.kabRows || []
  const ctx = packed?.ctx
  const panas = packed?.panasProv
  const regions = (regionsProp && regionsProp.length) ? regionsProp : (packed?.regions || [])
  const kartuList = (listSemua && listSemua.length) ? listSemua : []
  const sumberEoc = `Sumber: API EOC Pusat Krisis Kesehatan, agregat kejadian ${jenis || 'terpilih'} di Indonesia pada tahun ${tahun}`
  const updated = packed?.updatedAt ? ` | Pembaruan: ${packed.updatedAt}` : ''
  const wilayahLabel = packed?.prov ? (provRows[0]?.nama || packed.prov) : 'Indonesia'

  const years = tahunPilihan(tahun)
  const filteredList = useMemo(() => {
    const needle = q.trim().toLowerCase()
    let rows = list
    if (needle) {
      rows = rows.filter((r) => [r.kabupaten, r.provinsi, r.uid, r.tanggal].filter(Boolean).join(' ').toLowerCase().includes(needle))
    }
    const dir = sort.dir === 'asc' ? 1 : -1
    const key = sort.key
    return [...rows].sort((a, b) => {
      const va = key === 'tanggal' ? String(a.tanggal || '') : key === 'wilayah' ? String(a.kabupaten || a.provinsi || '') : Number(a[key] || 0)
      const vb = key === 'tanggal' ? String(b.tanggal || '') : key === 'wilayah' ? String(b.kabupaten || b.provinsi || '') : Number(b[key] || 0)
      if (va < vb) return -1 * dir
      if (va > vb) return 1 * dir
      return 0
    })
  }, [list, q, sort])
  const more = Math.max(0, filteredList.length - lihat)

  const toggleSort = (key: string) => {
    setSort((s) => s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: key === 'tanggal' || key === 'wilayah' ? 'asc' : 'desc' })
  }

  const provChart = useMemo(() => provRows.slice(0, 12).map((r: any) => ({
    nama: shortNama(String(r.nama || r.code), 16),
    penuh: r.nama,
    code: r.code,
    kejadian: r.kejadian,
    terdampak: r.terdampak,
  })), [provRows])

  const kabChart = useMemo(() => kabRows.slice(0, 12).map((r: any) => ({
    nama: shortNama(String(r.nama || r.code), 18),
    penuh: r.nama,
    code: r.code,
    kejadian: r.kejadian,
    terdampak: r.terdampak,
  })), [kabRows])

  const dampakChart = useMemo(() => {
    if (!rekap) return []
    return [
      { nama: 'Meninggal', n: rekap.meninggal || 0 },
      { nama: 'Luka-luka', n: rekap.luka || 0 },
      { nama: 'Hilang', n: rekap.hilang || 0 },
      { nama: 'Pengungsi', n: rekap.pengungsi || 0 },
    ].filter((r) => r.n > 0)
  }, [rekap])

  const yoyChart = useMemo(() => {
    if (!prevRekap?.tren?.length || !tren.length) return []
    return tren.map((r: any, i: number) => ({
      bulan: r.bulan,
      [`${tahun}`]: r.kejadian,
      [`${prevRekap.tahun}`]: prevRekap.tren[i]?.kejadian || 0,
    }))
  }, [tren, prevRekap, tahun])

  return (
    <>
      <div className="min-w-0" data-testid="jenis-header-band">
        <Link href={`${PUBLIC_BASE_PATH}/dashboard/spatial-mode`} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#047D78] hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke peta
        </Link>
        <h1 className="mt-2 text-[22px] font-black uppercase tracking-wide text-slate-900 sm:text-[28px] lg:text-[30px]">
          {jenis ? `Dashboard situasi ${jenis} - Indonesia` : 'Dashboard situasi jenis kejadian - Indonesia'}
        </h1>
        <p className="mt-1 max-w-4xl text-sm text-slate-600 sm:text-base">
          {copyJenisDashboard(jenis)}
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_4px_12px_rgba(0,0,0,0.02)] sm:p-4" data-testid="jenis-toolbar">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[8rem] flex-col gap-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
            Tahun
            <select
              data-testid="jenis-filter-tahun"
              value={tahun}
              onChange={(e) => onTahun(Number(e.target.value))}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[12px] font-bold text-slate-800"
            >
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
            Provinsi (opsional)
            <select
              data-testid="jenis-filter-prov"
              value={prov || ''}
              onChange={(e) => onProv(e.target.value || null)}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[12px] font-bold text-slate-800"
            >
              <option value="">Seluruh Indonesia</option>
              {regions.map((r: any) => <option key={r.code} value={r.code}>{r.nama}</option>)}
            </select>
          </label>
        </div>
        <div data-testid="jenis-chips">
          <WilayahKarakteristik
            list={kartuList}
            selected={jenis}
            onSelect={onJenis}
            tahun={tahun}
            showNasionalLink={false}
          />
        </div>
      </div>

      {jenis && rekap ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_12px_rgba(0,0,0,0.02)] sm:p-6" data-testid="jenis-ringkasan-situasi">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-black uppercase tracking-wide text-slate-900 sm:text-xl">Ringkasan Situasi - {jenis}</h2>
              <p className="mt-0.5 text-sm text-slate-600">Pemantauan sebaran spasial, dampak korban, dan karakteristik {jenis} dari API EOC tahun {tahun}{prov ? ` di ${wilayahLabel}` : ' di seluruh Indonesia'}.</p>
            </div>
            <div className="shrink-0 text-xs text-slate-500 sm:text-right">
              {packed?.updatedAt ? <span>Terakhir Diperbarui: {packed.updatedAt}</span> : null}
              {loadingRange ? <span className="ml-2">memuat…</span> : null}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 xl:col-span-3" data-testid="jenis-identitas">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Jenis bencana</div>
              <div className="mt-2 flex items-start gap-3">
                <JenisMark nama={jenis} size={48} />
                <div className="min-w-0">
                  <div className="text-xl font-black uppercase leading-tight text-slate-900">{jenis}</div>
                  <p className="mt-1 text-xs font-semibold leading-snug text-slate-600">
                    {provRows.length ? provRows.map((r: any) => r.nama).slice(0, 6).join(', ') + (provRows.length > 6 ? `, +${provRows.length - 6} provinsi` : '') : 'Data belum tersedia dari API'}
                  </p>
                </div>
              </div>
              <div className="mt-3 space-y-1 text-[11px] font-semibold text-slate-600">
                <p>Kejadian terakhir: {list[0] ? tglKejadian(list[0].tanggal) : 'Data belum tersedia dari API'}</p>
                <p>{nf(rekap.terpantau)} kejadian · {nf(rekap.berdampak_krisis)} krisis</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 xl:col-span-5">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Kab/kota terdampak</div>
                  <div className="mt-0.5 text-lg font-black tabular-nums text-slate-900">{nf(kabRows.length)}</div>
                  <div className="text-[10.5px] font-semibold text-slate-500">{nf(provRows.length)} provinsi</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Status krisis</div>
                  <div className="mt-0.5 text-lg font-black tabular-nums text-slate-900">{nf(rekap.berdampak_krisis)}</div>
                  <div className="text-[10.5px] font-semibold text-slate-500">dari {nf(rekap.terpantau)} kejadian</div>
                </div>
                {(eocKindOf(jenis) === 'banjir' || eocKindOf(jenis) === 'longsor') ? (
                  <>
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Pengungsi</div>
                      <div className="mt-0.5 text-lg font-black tabular-nums text-slate-900">{nf(rekap.pengungsi)}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Penduduk terdampak</div>
                      <div className="mt-0.5 text-lg font-black tabular-nums text-slate-900">{nf(rekap.terdampak)}</div>
                    </div>
                  </>
                ) : eocKindOf(jenis) === 'gempa' ? (
                  <>
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Magnitudo terbesar</div>
                      <div className="mt-1 text-[11px] font-semibold text-slate-500">Data belum tersedia dari API</div>
                    </div>
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Kedalaman</div>
                      <div className="mt-1 text-[11px] font-semibold text-slate-500">Data belum tersedia dari API</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Penduduk terdampak</div>
                      <div className="mt-0.5 text-lg font-black tabular-nums text-slate-900">{nf(rekap.terdampak)}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Faskes rusak</div>
                      <div className="mt-0.5 text-lg font-black tabular-nums text-slate-900">{nf(rekap.faskes_rusak)}</div>
                    </div>
                  </>
                )}
              </div>
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7" data-testid="jenis-prov-mini">
                {provRows.slice(0, 7).map((r: any) => (
                  <Link key={r.code} href={wilayahHref(String(r.code), { tahun, jenis })} className="rounded-xl border border-slate-200 bg-white px-1.5 py-2 text-center hover:border-[#047D78]">
                    <div className="truncate text-[9px] font-black uppercase leading-tight text-slate-500" title={r.nama}>{shortNama(r.nama, 10)}</div>
                    <div className="mt-0.5 text-base font-black tabular-nums text-slate-900">{nf(r.kejadian)}</div>
                    <div className="text-[9px] font-semibold text-slate-400">kejadian</div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:col-span-4 xl:grid-cols-1" data-testid="jenis-hero-kpi">
              {heroUtama(jenis, rekap, kabRows.length).map((k) => (
                <HeroBig key={k.label} label={k.label} value={k.value} sub={k.sub} tone={k.tone} />
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-teal-100 bg-teal-50/50 px-4 py-3 text-sm leading-relaxed text-slate-700" data-testid="jenis-narasi">
            <span className="mr-2 text-[10px] font-black uppercase tracking-wider text-teal-800">Ringkasan</span>
            {narasiJenis(jenis, tahun, rekap, provRows, kabRows, prov)}
          </div>
        </section>
      ) : null}

      {heroMap}

      {jenis && rekap ? (
        <>
          <div data-testid="jenis-analisis-head">
            <h3 className="text-xl font-black uppercase text-slate-900 sm:text-2xl">Analisis Dampak {jenis} - {nf(provRows.length)} Provinsi Terdampak</h3>
            <p className="mt-1 text-sm text-slate-600">Visualisasi tren, sebaran, komposisi korban, dan perbandingan dari API EOC untuk jenis ini pada tahun {tahun}{prov ? ` di ${wilayahLabel}` : ''}.</p>
          </div>

          <Card title={`Tren kejadian dan korban per bulan · ${tahun}`} icon={BarChart3} source={`${sumberEoc}${updated}`} className="">
            {adaTren ? (
              <div className="h-[340px]" data-testid="jenis-chart-tren">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={tren} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="bulan" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="kiri" allowDecimals={false} tick={{ fontSize: 11 }} width={40} />
                    <YAxis yAxisId="kanan" orientation="right" allowDecimals={false} tick={{ fontSize: 11 }} width={44} />
                    <Tooltip contentStyle={tipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar yAxisId="kiri" dataKey="kejadian" name="Kejadian" fill="#0F766E" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="kiri" dataKey="krisis" name="Krisis" fill="#E11D48" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="kiri" type="monotone" dataKey="meninggal" name="Meninggal" stroke="#BE123C" strokeWidth={2} dot={false} />
                    <Line yAxisId="kiri" type="monotone" dataKey="luka" name="Luka-luka" stroke="#D97706" strokeWidth={2} dot={false} />
                    <Line yAxisId="kanan" type="monotone" dataKey="pengungsi" name="Pengungsi" stroke="#EA580C" strokeWidth={2} dot={false} />
                    <Line yAxisId="kanan" type="monotone" dataKey="terdampak" name="Terdampak" stroke="#7C3AED" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : <Empty />}
          </Card>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

            <Card title="Provinsi dengan kejadian terbanyak" icon={MapPin} source={`${sumberEoc}${updated}`}>
              {provChart.length ? (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={provChart} layout="vertical" margin={{ top: 0, right: 16, left: 4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="nama" width={88} tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={tipStyle} formatter={(v: any, _n: any, p: any) => [nf(Number(v)), p?.payload?.penuh]} />
                      <Bar dataKey="kejadian" name="Kejadian" fill="#0F766E" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <Empty />}
            </Card>

            <Card title="Kab/kota dengan kejadian terbanyak" icon={Users} source={`${sumberEoc}${updated}`}>
              {kabChart.length ? (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={kabChart} layout="vertical" margin={{ top: 0, right: 16, left: 4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="nama" width={100} tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={tipStyle} formatter={(v: any, _n: any, p: any) => [nf(Number(v)), p?.payload?.penuh]} />
                      <Bar dataKey="kejadian" name="Kejadian" fill="#2563EB" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <Empty />}
            </Card>

            <Card title="Komposisi dampak (korban)" icon={Activity} source={`${sumberEoc}${updated}`}>
              {dampakChart.length ? (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dampakChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="nama" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={40} />
                      <Tooltip contentStyle={tipStyle} />
                      <Bar dataKey="n" name="Jumlah" fill="#7C3AED" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <Empty />}
            </Card>

          <Card title={`Heatmap provinsi × bulan · ${jenis} ${tahun}`} icon={BarChart3} source={`${sumberEoc}${updated}`}>
            {panas && panas.prov.length && panas.max > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-[11px]">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-white px-2 py-1.5 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">Provinsi</th>
                      {panas.months.map((c: string, i: number) => (
                        <th key={c} className="px-1 py-1.5 text-center text-[10px] font-bold text-slate-500">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {panas.prov.map((r: any) => (
                      <tr key={r.code}>
                        <th className="sticky left-0 z-10 max-w-[160px] truncate bg-white px-2 py-0.5 text-left font-semibold text-slate-700">
                          <Link href={wilayahHref(r.code, { tahun, jenis })} className="text-[#047D78] hover:underline">{r.nama}</Link>
                        </th>
                        {panas.months.map((_: string, i: number) => {
                          const n = Number(panas.cells[`${r.code}|${i + 1}`] || 0)
                          return (
                            <td key={`${r.code}-${i}`} className="px-0.5 py-0.5 text-center">
                              <div
                                className="flex h-7 min-w-[2rem] items-center justify-center rounded-md font-bold tabular-nums"
                                style={{ background: heatColor(n, panas.max), color: n && n / Math.max(panas.max, 1) > 0.55 ? '#fff' : '#134e4a' }}
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
              </div>
            ) : <Empty />}
          </Card>

          <Card title={`Perbandingan dengan tahun ${tahun - 1}`} icon={BarChart3} source={prevRekap ? `${sumberEoc}${updated}` : 'Perbandingan hanya ditampilkan bila data tahun sebelumnya tersedia dari API.'}>
            {yoyChart.length ? (
              <>
                {prevRekap ? (
                  <p className="mb-2 text-xs text-slate-600">
                    {tahun}: {nf(rekap.terpantau)} kejadian
                    <span className="mx-1.5 text-slate-300">·</span>
                    {prevRekap.tahun}: {nf(prevRekap.rekap.terpantau)} kejadian
                  </p>
                ) : null}
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={yoyChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="bulan" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={36} />
                      <Tooltip contentStyle={tipStyle} />
                      <Bar dataKey={String(tahun)} name={String(tahun)} fill="#0F766E" radius={[4, 4, 0, 0]} />
                      <Bar dataKey={String(tahun - 1)} name={String(tahun - 1)} fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : <Empty />}
          </Card>

          <Card title="Sebaran status krisis" icon={Activity} source={`${sumberEoc}${updated}`}>
            {rekap.terpantau ? (
              <div className="flex h-[300px] items-center gap-4" data-testid="jenis-chart-krisis">
                <div className="h-full min-w-0 flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Krisis', value: rekap.berdampak_krisis },
                          { name: 'Terpantau', value: Math.max(0, rekap.terpantau - rekap.berdampak_krisis) },
                        ]}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={54}
                        outerRadius={90}
                        paddingAngle={2}
                      >
                        <Cell fill="#E11D48" />
                        <Cell fill="#0F766E" />
                      </Pie>
                      <Tooltip contentStyle={tipStyle} formatter={(v: any, n: any) => [nf(Number(v)), n]} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-40 shrink-0 space-y-2 text-sm">
                  <div className="rounded-xl bg-rose-50 px-3 py-2">
                    <div className="text-[10px] font-black uppercase tracking-wider text-rose-700">Krisis</div>
                    <div className="text-lg font-black tabular-nums text-rose-900">{nf(rekap.berdampak_krisis)}</div>
                  </div>
                  <div className="rounded-xl bg-teal-50 px-3 py-2">
                    <div className="text-[10px] font-black uppercase tracking-wider text-teal-700">Terpantau</div>
                    <div className="text-lg font-black tabular-nums text-teal-900">{nf(Math.max(0, rekap.terpantau - rekap.berdampak_krisis))}</div>
                  </div>
                </div>
              </div>
            ) : <Empty />}
          </Card>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_4px_12px_rgba(0,0,0,0.02)] sm:p-5" data-testid="jenis-sec-indikator">
            <h3 className="text-xl font-black uppercase text-slate-900">Data Situasi {jenis} per Indikator</h3>
            <p className="mt-1 text-sm text-slate-600">Seluruh angka dihitung dari rekaman EOC jenis ini pada tahun {tahun}{prov ? ' di provinsi terpilih' : ' di seluruh Indonesia'}.</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <KpiTile label="Kejadian" value={nf(rekap.terpantau)} sub={`${nf(rekap.berdampak_krisis)} krisis`} tone="teal" />
              <KpiTile label="Provinsi terdampak" value={nf(provRows.length)} sub={`${nf(kabRows.length)} kab/kota`} tone="violet" />
              <KpiTile label="Meninggal" value={nf(rekap.meninggal)} tone="red" />
              <KpiTile label="Luka-luka" value={nf(rekap.luka)} sub={`Berat ${nf(rekap.luka_berat)} · ringan ${nf(rekap.luka_ringan)}`} tone="amber" />
              <KpiTile label="Hilang" value={nf(rekap.hilang)} tone="orange" />
              <KpiTile label="Pengungsi" value={nf(rekap.pengungsi)} tone="orange" />
              <KpiTile label="Penduduk terdampak" value={nf(rekap.terdampak)} tone="violet" />
              <KpiTile label="Faskes rusak" value={nf(rekap.faskes_rusak)} tone="slate" />
            </div>
            <p className="m-0 mt-3 border-t border-slate-100 pt-2 text-[10.5px] leading-snug text-slate-500">{sumberEoc}{updated}</p>
          </div>

          <Card title={`Karakteristik ${jenis}`} icon={Activity} source="Hanya menampilkan metrik yang ada di API EOC. Magnitudo, kedalaman, tinggi air, atau titik panas tidak ditampilkan sebagai angka jika tidak ada di payload.">
            {eocKindOf(jenis) === 'gempa' ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="jenis-karakteristik">
                <div>
                  <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-500">Magnitudo (BMKG)</div>
                  <Empty />
                </div>
                <div>
                  <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-500">Kedalaman (BMKG)</div>
                  <Empty />
                </div>
              </div>
            ) : (eocKindOf(jenis) === 'banjir' || eocKindOf(jenis) === 'longsor') ? (
              <div className="space-y-3" data-testid="jenis-karakteristik">
                <div className="flex flex-wrap gap-3">
                  <KpiTile label="Kab/kota terdampak" value={nf(kabRows.length)} tone="violet" />
                  <KpiTile label="Pengungsi" value={nf(rekap.pengungsi)} tone="orange" />
                  <KpiTile label="Penduduk terdampak" value={nf(rekap.terdampak)} tone="teal" />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-left text-[12px]">
                    <thead>
                      <tr className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        <th className="px-2 py-1">Kab/kota</th>
                        <th className="px-2 py-1 text-right">Kejadian</th>
                        <th className="px-2 py-1 text-right">Pengungsi</th>
                        <th className="px-2 py-1 text-right">Terdampak</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kabRows.slice(0, 10).map((r: any) => (
                        <tr key={r.code || r.nama} className="border-t border-slate-100">
                          <td className="px-2 py-1.5 font-semibold text-slate-800">{r.nama}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{nf(r.kejadian)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{nf(r.pengungsi)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{nf(r.terdampak)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3" data-testid="jenis-karakteristik">
                <KpiTile label="Kab/kota terdampak" value={nf(kabRows.length)} tone="violet" />
                <KpiTile label="Penduduk terdampak" value={nf(rekap.terdampak)} tone="teal" />
                <KpiTile label="Faskes rusak" value={nf(rekap.faskes_rusak)} tone="slate" />
              </div>
            )}
          </Card>

          <Card
            title={`Kesiapan & respons di provinsi terdampak`}
            icon={Activity}
            source="Sumber: API PSC, TCK, dan Logistik (hanya jika statusnya langsung). Angka ini adalah kapasitas berdiri di provinsi yang terdampak jenis ini, bukan penugasan atau respons yang dikaitkan ke jenis kejadian — API tidak menyediakan tautan itu."
          >
            {ctx?.psc?.tersedia || ctx?.tck?.tersedia || ctx?.logistik?.tersedia ? (
              <div className="space-y-4" data-testid="jenis-kesiapan">
                <p className="text-sm text-slate-600">Kapasitas di {nf(ctx.provCount || provRows.length)} provinsi terdampak {jenis}{prov ? ` (filter ${wilayahLabel})` : ''}.</p>
                <div className="flex flex-wrap gap-3">
                  <KpiTile label="PSC aktif" value={ctx.psc.tersedia ? `${nf(ctx.psc.psc_aktif)}/${nf(ctx.psc.psc_total)}` : '—'} sub={ctx.psc.tersedia ? `${nf((ctx.psc as any).provinsi)} provinsi` : undefined} tone={ctx.psc.tersedia ? 'dark' : 'slate'} />
                  <KpiTile label="Ambulans" value={ctx.psc.tersedia ? nf(ctx.psc.ambulans) : '—'} sub={ctx.psc.tersedia ? `Baik ${nf(ctx.psc.ambulans_baik)}` : undefined} tone="teal" />
                  <KpiTile label="Relawan TCK" value={ctx.tck.tersedia ? nf(ctx.tck.individu) : '—'} sub={ctx.tck.tersedia ? `${nf(ctx.tck.tim)} tim` : undefined} tone="teal" />
                  <KpiTile label="Stok logistik regional" value={ctx.logistik.tersedia ? nf(ctx.logistik.total) : '—'} sub={ctx.logistik.tersedia ? `${nf(ctx.logistik.gudang)} gudang (unik, tanpa dihitung ganda)` : undefined} tone="slate" />
                </div>
                {ctx.rows?.length ? (
                  <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                    <div>
                      <h5 className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500">Relawan TCK per provinsi terdampak</h5>
                      <div className="h-[300px]" data-testid="jenis-chart-tck">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={ctx.rows.filter((r: any) => r.tck_individu != null).slice(0, 12).map((r: any) => ({ ...r, nama: shortNama(r.nama, 16) }))} layout="vertical" margin={{ top: 0, right: 16, left: 4, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                            <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                            <YAxis type="category" dataKey="nama" width={96} tick={{ fontSize: 10 }} />
                            <Tooltip contentStyle={tipStyle} formatter={(v: any, _n: any, p: any) => [nf(Number(v)), p?.payload?.nama]} />
                            <Bar dataKey="tck_individu" name="Relawan TCK" fill="#0F766E" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div>
                      <h5 className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500">PSC aktif per provinsi terdampak</h5>
                      <div className="h-[300px]" data-testid="jenis-chart-psc">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={ctx.rows.filter((r: any) => r.psc_aktif != null).slice(0, 12).map((r: any) => ({ ...r, nama: shortNama(r.nama, 16) }))} layout="vertical" margin={{ top: 0, right: 16, left: 4, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                            <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                            <YAxis type="category" dataKey="nama" width={96} tick={{ fontSize: 10 }} />
                            <Tooltip contentStyle={tipStyle} formatter={(v: any, _n: any, p: any) => [nf(Number(v)), p?.payload?.nama]} />
                            <Bar dataKey="psc_aktif" name="PSC aktif" fill="#0369A1" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : <Empty />}
          </Card>

          <Card title={`Daftar kejadian ${jenis}`} icon={Search} source={`${sumberEoc}${updated}`} actions={
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                data-testid="jenis-table-search"
                value={q}
                onChange={(e) => { setQ(e.target.value); setLihat(25) }}
                placeholder="Cari kab/kota, provinsi, atau tanggal"
                className="h-8 w-[14rem] rounded-lg border border-slate-200 bg-white pl-7 pr-2 text-[11px] font-semibold text-slate-700"
              />
            </div>
          }>
            <div className="overflow-x-auto">
              {filteredList.length ? (
                <table className="w-full min-w-[640px] text-left text-[12px]" data-testid="jenis-kejadian-table">
                  <thead>
                    <tr className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      {([
                        ['tanggal', 'Tanggal'],
                        ['wilayah', 'Wilayah'],
                        ['status', 'Status'],
                        ['meninggal', 'Meninggal'],
                        ['luka', 'Luka'],
                        ['pengungsi', 'Pengungsi'],
                        ['terdampak', 'Terdampak'],
                      ] as const).map(([key, label]) => (
                        <th key={key} className="px-3 py-1.5">
                          <button type="button" onClick={() => toggleSort(key === 'status' ? 'krisis' : key)} className="inline-flex items-center gap-0.5 font-black uppercase tracking-wider hover:text-slate-600">
                            {label}
                            {sort.key === (key === 'status' ? 'krisis' : key) ? (sort.dir === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />) : null}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredList.slice(0, lihat).map((r) => (
                      <tr key={r.uid} className={`border-t border-slate-100 ${r.krisis ? 'bg-rose-50/40' : 'bg-white'}`}>
                        <td className="whitespace-nowrap px-3 py-1.5 text-slate-700">{tglKejadian(r.tanggal, r.jam)}</td>
                        <td className="px-3 py-1.5">
                          <Link href={kejadianHref(String(r.uid), r.tanggal)} className="font-semibold text-[#047D78] hover:underline">{r.kabupaten || r.provinsi || r.uid}</Link>
                          <div className="text-[10px] text-slate-500">
                            {r.provinsi && r.code ? <Link href={wilayahHref(String(r.code), { tahun, jenis })} className="hover:underline">{r.provinsi}</Link> : (r.provinsi || '')}
                          </div>
                        </td>
                        <td className="px-3 py-1.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${r.krisis ? 'bg-rose-100 text-rose-800' : 'bg-teal-50 text-teal-800'}`}>{r.krisis ? 'Krisis' : 'Terpantau'}</span></td>
                        <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-slate-800">{nf(r.meninggal)}</td>
                        <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-slate-800">{nf((r.luka_berat || 0) + (r.luka_ringan || 0))}</td>
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
      ) : !jenis ? (
        <Empty />
      ) : (
        <Empty pending={loadingRange} />
      )}
    </>
  )
}

export { jenisKejadianHref }
