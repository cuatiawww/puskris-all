/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Area,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import ApiKosong from '@/components/puskris/ApiKosong'
import { PUBLIC_BASE_PATH } from '@/lib/public-path'
import { wilayahHref } from '@/lib/puskris/eoc-event-layer'
import { jenisKejadianHref } from '@/lib/puskris/jenis-kejadian'
import { fmtAngka, tglKejadian } from '@/lib/puskris/eoc-markers'
import { analisaDariData, type AnalisaItem } from '@/lib/puskris/kejadian-detail'

const TCK_PROFESI = ['Tenaga Medis', 'Tenaga Keperawatan', 'Tenaga Kebidanan', 'Tenaga Kefarmasian', 'Tenaga Kesehatan Masyarakat', 'Tenaga Kesehatan Lingkungan', 'Tenaga Gizi', 'Tenaga Kesehatan Lainnya', 'Non-Kesehatan']
const USIA_LABEL = ['< 30 th', '30–39 th', '40–49 th', '50+ th', 'Tidak diisi']

function nf(n: number | null | undefined, satuan?: string, digits = 0) {
  if (n == null || Number.isNaN(Number(n))) return '—'
  const s = Number(n).toLocaleString('id-ID', { maximumFractionDigits: digits, minimumFractionDigits: 0 })
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
const STATUS_BADGE: Record<string, string> = {
  Tinggi: 'bg-rose-100 text-rose-800',
  Sedang: 'bg-amber-100 text-amber-800',
  Rendah: 'bg-teal-100 text-teal-800',
  aktif: 'bg-teal-100 text-teal-800',
  nonaktif: 'bg-slate-100 text-slate-600',
}

function badgeStatus(s?: string | null) {
  if (!s) return 'bg-slate-100 text-slate-600'
  if (/tinggi|rendah|segera|krisis/i.test(s) && /tinggi|segera|krisis/i.test(s)) return 'bg-rose-100 text-rose-800'
  if (/sedang|waspada|pantau/i.test(s)) return 'bg-amber-100 text-amber-800'
  if (/rendah|aman|baik|terpantau|memadai/i.test(s)) return 'bg-teal-100 text-teal-800'
  return STATUS_BADGE[s] || 'bg-slate-100 text-slate-700'
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

function Kpi({ label, value, tone = 'slate', sub }: { label: string; value: ReactNode; tone?: string; sub?: string }) {
  return (
    <div className={`rounded-xl border px-2.5 py-2 ${KPI_BOX[tone] || KPI_BOX.slate}`}>
      <div className="truncate text-[9.5px] font-black uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-0.5 text-lg font-black leading-none tabular-nums sm:text-xl ${KPI_VAL[tone] || KPI_VAL.slate}`}>{value}</div>
      {sub ? <div className="mt-0.5 truncate text-[10px] text-slate-500">{sub}</div> : null}
    </div>
  )
}

export function SectionCard({ id, eyebrow, title, source, kpis, actions, children, kpiClass }: {
  id: string; eyebrow: string; title: string; source?: string; kpis?: ReactNode; actions?: ReactNode; children?: ReactNode; kpiClass?: string
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white" data-testid={id}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{eyebrow}</p>
          <h2 className="text-[15px] font-bold uppercase leading-tight text-slate-900 sm:text-base">{title}</h2>
          {source ? <p className="mt-0.5 text-[10px] text-slate-400">{source}</p> : null}
        </div>
        {actions}
      </div>
      {kpis ? <div className={`grid grid-cols-[repeat(auto-fit,minmax(108px,1fr))] gap-2 px-5 py-3 ${kpiClass || ''}`}>{kpis}</div> : null}
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

function ChartBox({ empty, pending, children }: { empty?: boolean; pending?: boolean; children?: ReactNode }) {
  if (pending) return <Empty pending />
  if (empty) return <Empty />
  return <div className="h-36">{children}</div>
}

const tipStyle = { fontSize: 11 }

export function KejadianHeaderBand({ k, status, loadingRange }: { k: any; status?: any; loadingRange?: boolean }) {
  const pills: { text: string; tone: string }[] = []
  if (status?.label) pills.push({ text: status.label, tone: status.tone || 'slate' })
  if (k?.krisis) pills.push({ text: 'Krisis', tone: 'rose' })
  if (status?.hari != null) pills.push({ text: `${status.hari} hari`, tone: 'teal' })
  if (k?.koordinat?.label) pills.push({ text: k.koordinat.label, tone: 'slate' })
  const ringkas: string[] = []
  if (k?.terdampak != null) ringkas.push(`${fmtAngka(k.terdampak)} terdampak`)
  if (k?.meninggal != null) ringkas.push(`${fmtAngka(k.meninggal)} meninggal`)
  if (k?.pengungsi != null && Number(k.pengungsi) > 0) ringkas.push(`${fmtAngka(k.pengungsi)} pengungsi`)
  return (
    <header className="relative overflow-hidden rounded-2xl border border-teal-100 bg-white" data-testid="kejadian-header-band">
      <div className="absolute inset-y-0 left-0 w-1.5 bg-[#00705a]" />
      <div className="relative flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="min-w-0">
          <Link href={`${PUBLIC_BASE_PATH}/dashboard/spatial-mode`} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#00705a] hover:underline">← Kembali ke peta</Link>
          <p className="mt-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Pusat Krisis Kesehatan · Detail kejadian</p>
          <div className="mt-1.5 flex items-start gap-2.5">
            {k.icon?.src ? <img alt="" aria-hidden src={k.icon.src} className="mt-0.5 h-9 w-8 shrink-0 object-contain" /> : null}
            <div className="min-w-0">
              <h1 className="text-xl font-bold uppercase leading-tight tracking-tight text-slate-900 sm:text-2xl">
                {k.jenis} · {[k.kabupaten, k.provinsi].filter(Boolean).join(', ')}
              </h1>
              <p className="mt-0.5 text-sm font-semibold text-slate-600">
                {tglKejadian(k.tanggal, k.jam)}
                {loadingRange ? ' · memuat…' : ''}
                {ringkas.length ? ` · ${ringkas.join(' · ')}` : ''}
              </p>
              {pills.length ? (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {pills.map((p) => (
                    <span key={p.text} className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${PILL[p.tone] || PILL.slate}`}>{p.text}</span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-1.5 self-start">
          {k.code ? (
            <Link href={wilayahHref(String(k.code), { tahun: k.tanggal, jenis: k.jenis })} className="inline-flex h-8 items-center justify-center rounded-lg bg-[#00705a] px-2.5 text-[11px] font-bold text-white hover:bg-[#005a48]">
              Lihat detail wilayah
            </Link>
          ) : null}
          {k.jenis ? (
            <Link href={jenisKejadianHref(String(k.jenis), { tahun: k.tanggal })} data-testid="kejadian-link-jenis-nasional" className="inline-flex h-8 items-center justify-center rounded-lg border border-[#00705a] bg-white px-2.5 text-[11px] font-bold text-[#00705a] hover:bg-[#00705a]/10">
              Lihat semua {k.jenis}
            </Link>
          ) : null}
          {k.url ? (
            <a href={k.url} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-2.5 text-[11px] font-bold text-teal-800 hover:bg-teal-100">
              Sumber EOC <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>
      </div>
    </header>
  )
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

export function SecAnalisa({ items }: { items: AnalisaItem[] }) {
  return (
    <SectionCard
      id="kejadian-sec-analisa"
      eyebrow="Analisa & rekomendasi"
      title="Temuan dari data yang tersedia"
      source="Dihitung dari EOC, PSC, logistik, Asistensi, dan konteks terbuka. Bukan arahan resmi."
    >
      {items.length ? (
        <ul className="space-y-1.5">
          {items.map((it) => (
            <li key={it.id} className={`flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold leading-snug ${ANALISA_TONE[it.tingkat]}`}>
              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${ANALISA_DOT[it.tingkat]}`} aria-hidden />
              <span>{it.teks}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12px] text-slate-500">Belum ada temuan yang dapat disusun dari data API saat ini.</p>
      )}
    </SectionCard>
  )
}

export function SecDampak({ k, riwayat }: { k: any; riwayat?: any }) {
  const [rentang, setRentang] = useState<'30h' | '12bln'>('12bln')
  const data = useMemo(() => {
    if (!riwayat?.tersedia) return []
    const src = rentang === '30h' ? riwayat.korban30 : riwayat.korbanTren
    return (src || []).map((r: any) => ({
      label: String(r.bulan || r.tanggal || '').slice(rentang === '30h' ? 5 : 2),
      meninggal: r.meninggal || 0,
      luka: r.luka || 0,
      pengungsi: r.pengungsi || 0,
    }))
  }, [riwayat, rentang])
  return (
    <SectionCard
      id="kejadian-sec-dampak"
      eyebrow="Dampak & korban"
      title="Angka korban kejadian ini"
      source="API EOC Pusat Krisis"
      actions={<RangeBtn value={rentang} onChange={(id) => setRentang(id as any)} options={[{ id: '30h', label: '30 hari' }, { id: '12bln', label: '12 bulan' }]} />}
      kpis={
        <>
          <Kpi label="Meninggal" value={fmtAngka(k.meninggal)} tone="rose" />
          <Kpi label="Luka berat" value={fmtAngka(k.luka_berat)} tone="amber" />
          <Kpi label="Luka ringan" value={fmtAngka(k.luka_ringan)} tone="amber" />
          <Kpi label="Hilang" value={fmtAngka(k.hilang)} />
          <Kpi label="Pengungsi" value={fmtAngka(k.pengungsi)} tone="teal" />
          <Kpi label="Terdampak" value={fmtAngka(k.terdampak)} tone="teal" />
          <Kpi label="Faskes rusak" value={fmtAngka(k.faskes_rusak)} />
        </>
      }
    >
      <p className="mb-2 text-[11px] font-semibold text-slate-500">Tren korban di kab/kota yang sama</p>
      <ChartBox empty={!data.length}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip contentStyle={tipStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="meninggal" name="Meninggal" fill="#be123c" stackId="a" radius={[0, 0, 0, 0]} />
            <Bar dataKey="luka" name="Luka" fill="#d97706" stackId="a" />
            <Bar dataKey="pengungsi" name="Pengungsi" fill="#00705a" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartBox>
    </SectionCard>
  )
}

export function SecTck({ tck, kabNama }: { tck?: any; kabNama?: string }) {
  if (!tck?.tersedia) {
    return (
      <SectionCard id="kejadian-sec-tck" eyebrow="TCK" title="Tenaga cadangan kesehatan" source="API Tenaga Cadangan, tingkat provinsi">
        <Empty />
      </SectionCard>
    )
  }
  const profesiRows = TCK_PROFESI.map((nama) => ({ nama, jumlah: Number(tck.profesi?.[nama] || 0) })).filter((r) => tck.profesi)
  const showProfesi = Boolean(tck.profesi) && profesiRows.some((r) => r.jumlah > 0)
  const kabRows = (tck.kab || []).map((r: any) => ({
    nama: r.nama,
    n: r.n,
    nakes: r.nakes,
    non: Math.max(0, Number(r.n || 0) - Number(r.nakes || 0)),
  }))
  const usiaRows = Array.isArray(tck.usia) ? USIA_LABEL.map((nama, i) => ({ nama, jumlah: Number(tck.usia[i] || 0) })) : []
  const kabKey = String(kabNama || '').toUpperCase().replace(/^(KOTA|KAB\.?|KABUPATEN)\s+/i, '').replace(/[^A-Z0-9]/g, '')
  const hitKab = (nama: string) => {
    const n = String(nama || '').toUpperCase().replace(/^(KOTA|KAB\.?|KABUPATEN)\s+/i, '').replace(/[^A-Z0-9]/g, '')
    return Boolean(kabKey && n && (n === kabKey || n.includes(kabKey) || kabKey.includes(n)))
  }
  return (
    <SectionCard
      id="kejadian-sec-tck"
      eyebrow="TCK"
      title={`Tenaga cadangan · ${tck.provinsi || 'Provinsi'}`}
      source="API Tenaga Cadangan Kesehatan (agregat provinsi)"
      kpis={
        <>
          <Kpi label="Relawan" value={fmtAngka(tck.individu)} tone="teal" />
          <Kpi label="Nakes" value={fmtAngka(tck.nakes)} />
          <Kpi label="Non-nakes" value={fmtAngka(tck.non_nakes)} />
          <Kpi label="Tim" value={fmtAngka(tck.tim)} sub={tck.tim_individu != null ? `${fmtAngka(tck.tim_individu)} anggota` : undefined} />
          <Kpi label="EMT" value={fmtAngka(tck.emt)} sub={tck.emt_individu != null ? `${fmtAngka(tck.emt_individu)} anggota` : undefined} />
          <Kpi label="Terhubung tim" value={fmtAngka(tck.terhubung_tim)} />
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-[11px] font-semibold text-slate-500">Profesi</p>
          {showProfesi ? (
            <>
              <div className="mb-3 h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={profesiRows} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="nama" width={128} tick={{ fontSize: 9 }} />
                    <Tooltip contentStyle={tipStyle} />
                    <Bar dataKey="jumlah" name="Relawan" fill="#00705a" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <Matrix
                columns={[
                  { key: 'nama', label: 'Golongan' },
                  { key: 'jumlah', label: 'Jumlah', align: 'right', fmt: (v) => fmtAngka(v) },
                ]}
                rows={profesiRows}
                rowKey={(r) => r.nama}
              />
            </>
          ) : <Empty />}
        </div>
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-[11px] font-semibold text-slate-500">Per kab/kota di provinsi ini</p>
            <Matrix
              columns={[
                { key: 'nama', label: 'Kab/kota' },
                { key: 'n', label: 'Relawan', align: 'right', fmt: (v) => fmtAngka(v) },
                { key: 'nakes', label: 'Nakes', align: 'right', fmt: (v) => fmtAngka(v) },
                { key: 'non', label: 'Non-nakes', align: 'right', fmt: (v) => fmtAngka(v) },
              ]}
              rows={kabRows}
              rowKey={(r, i) => `${r.nama}-${i}`}
              highlight={(r) => hitKab(r.nama)}
            />
          </div>
          {usiaRows.length ? (
            <div>
              <p className="mb-2 text-[11px] font-semibold text-slate-500">Usia · jenis kelamin</p>
              <div className="mb-2 flex flex-wrap gap-3 text-[12px] font-semibold text-slate-700">
                <span>Perempuan {fmtAngka(tck.perempuan)}</span>
                <span>Laki-laki {fmtAngka(tck.laki)}</span>
              </div>
              <Matrix
                columns={[
                  { key: 'nama', label: 'Kelompok usia' },
                  { key: 'jumlah', label: 'Jumlah', align: 'right', fmt: (v) => fmtAngka(v) },
                ]}
                rows={usiaRows}
                rowKey={(r) => r.nama}
              />
            </div>
          ) : null}
        </div>
      </div>
    </SectionCard>
  )
}

export function SecLogistik({ log }: { log?: any }) {
  if (!log?.tersedia) {
    return (
      <SectionCard id="kejadian-sec-logistik" eyebrow="Logistik" title="Stok logistik regional" source="API Logistik Kesehatan (SIMLOGKES)">
        <Empty />
      </SectionCard>
    )
  }
  const kat = log.kategori || []
  const tren = (log.tren || []).map((r: any) => ({
    label: String(r.bulan || '').slice(2),
    masuk: r.penerimaan ?? r.masuk,
    keluar: r.pengeluaran ?? r.keluar,
  }))
  return (
    <SectionCard
      id="kejadian-sec-logistik"
      eyebrow="Logistik"
      title={`Stok regional · ${log.nama}`}
      source="API Logistik Kesehatan, agregat regional penanggung provinsi ini"
      kpis={
        <>
          <Kpi label="Stok" value={nf(log.total)} tone="teal" />
          <Kpi label="Baris barang" value={fmtAngka(log.barang)} />
          <Kpi label="Masuk" value={nf(log.masuk)} />
          <Kpi label="Keluar" value={nf(log.keluar)} />
          <Kpi label="Kedaluwarsa" value={fmtAngka(log.kedaluwarsa)} tone={log.kedaluwarsa ? 'rose' : 'slate'} />
          <Kpi label="Segera habis masa" value={fmtAngka(log.segera_kedaluwarsa)} tone={log.segera_kedaluwarsa ? 'amber' : 'slate'} />
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-[11px] font-semibold text-slate-500">Stok per kategori</p>
          <div className="mb-3 h-40">
            <ChartBox empty={!kat.some((r: any) => r.stok > 0)}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={kat} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="nama" tick={{ fontSize: 9 }} interval={0} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={tipStyle} />
                  <Bar dataKey="stok" name="Stok" fill="#00705a" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartBox>
          </div>
          <Matrix
            columns={[
              { key: 'nama', label: 'Kategori' },
              { key: 'stok', label: 'Stok', align: 'right', fmt: (v) => nf(v) },
            ]}
            rows={kat}
            rowKey={(r) => r.key}
          />
        </div>
        <div className="space-y-4">
          {tren.length ? (
            <div>
              <p className="mb-2 text-[11px] font-semibold text-slate-500">Pergerakan stok (sampel API)</p>
              <ChartBox empty={!tren.length}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={tren} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={tipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="masuk" name="Masuk" fill="#00705a" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="keluar" name="Keluar" fill="#d97706" radius={[3, 3, 0, 0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartBox>
            </div>
          ) : null}
          <div>
            <p className="mb-2 text-[11px] font-semibold text-slate-500">Barang stok teratas di regional ini</p>
            <Matrix
              columns={[
                { key: 'nama', label: 'Barang' },
                { key: 'kategori', label: 'Kategori' },
                { key: 'stok', label: 'Stok', align: 'right', fmt: (v) => nf(v) },
                { key: 'satuan', label: 'Satuan' },
              ]}
              rows={log.barang_teratas || []}
              rowKey={(r, i) => `${r.nama}-${i}`}
            />
          </div>
          {(log.kedaluwarsa_daftar || []).length ? (
            <div>
              <p className="mb-2 text-[11px] font-semibold text-slate-500">Mendekati atau sudah kedaluwarsa</p>
              <Matrix
                columns={[
                  { key: 'nama', label: 'Barang' },
                  { key: 'stok', label: 'Stok', align: 'right', fmt: (v) => nf(v) },
                  { key: 'expired', label: 'Exp', align: 'right' },
                  { key: 'lewat', label: 'Status', fmt: (v) => (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${v ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>{v ? 'Lewat' : '≤ 90 hari'}</span>
                  ) },
                ]}
                rows={log.kedaluwarsa_daftar}
                rowKey={(r, i) => `${r.nama}-exp-${i}`}
              />
            </div>
          ) : null}
        </div>
      </div>
    </SectionCard>
  )
}

export function SecFaskes({ nearby }: { nearby?: any }) {
  const psc = nearby?.psc
  const amb = nearby?.ambulans
  const rs = nearby?.rs
  const rows = psc?.tersedia ? (psc.daftar || []) : []
  return (
    <SectionCard
      id="kejadian-sec-faskes"
      eyebrow="Faskes & PSC"
      title="PSC, ambulans, dan RS dalam 50 km"
      source="API PSC 119 / Pusat Krisis"
      kpis={
        <>
          <Kpi label="PSC aktif" value={psc?.tersedia ? `${fmtAngka(psc.aktif)}/${fmtAngka(psc.total)}` : '—'} tone="teal" />
          <Kpi label="Ambulans siap" value={amb?.tersedia ? `${fmtAngka(amb.siap)}/${fmtAngka(amb.total)}` : '—'} tone="amber" />
          <Kpi label="RS jejaring" value={rs?.tersedia ? fmtAngka(rs.total) : '—'} />
        </>
      }
    >
      <p className="mb-2 text-[11px] font-semibold text-slate-500">Daftar PSC terdekat</p>
      <Matrix
        columns={[
          { key: 'nama', label: 'PSC' },
          { key: 'kab', label: 'Kab/kota', fmt: (v) => v || '—' },
          { key: 'aktif', label: 'Status', fmt: (v) => (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${v ? STATUS_BADGE.aktif : STATUS_BADGE.nonaktif}`}>{v ? 'Aktif' : 'Nonaktif'}</span>
          ) },
          { key: 'ambulans', label: 'Ambulans', align: 'right', fmt: (v) => fmtAngka(v) },
          { key: 'siap', label: 'Siap', align: 'right', fmt: (v) => fmtAngka(v) },
          { key: 'jarak_km', label: 'Jarak', align: 'right', fmt: (v) => (v != null ? nf(v, 'km', 1) : '—') },
        ]}
        rows={rows}
        rowKey={(r, i) => `${r.nama}-${i}`}
      />
      {rs?.catatan ? <p className="mt-2 text-[10px] text-slate-400">{rs.catatan}</p> : null}
    </SectionCard>
  )
}

export function SecRisiko({ risiko, pieKab, piePending, onShowAsis, onShowPie }: {
  risiko?: any
  pieKab?: { disease: string; status: string }[] | null
  piePending?: boolean
  onShowAsis?: (mode: 'irbi' | 'kapasitas') => void
  onShowPie?: () => void
}) {
  const rows = [risiko?.kab, risiko?.prov].filter(Boolean)
  const pie = pieKab || []
  const nT = pie.filter((p) => p.status === 'Tinggi').length
  const nS = pie.filter((p) => p.status === 'Sedang').length
  const nR = pie.filter((p) => p.status === 'Rendah').length
  return (
    <SectionCard
      id="kejadian-sec-risiko"
      eyebrow="Asistensi & risiko"
      title="Kapasitas, IRBI, dan PIE"
      source={risiko?.tahun ? `API Asistensi Risiko · PIE tahun ${risiko.tahun}` : 'API Asistensi Risiko · API Peta Risiko PIE'}
      actions={
        <div className="flex flex-wrap gap-1">
          {onShowAsis ? (
            <>
              <button type="button" onClick={() => onShowAsis('irbi')} className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-200">Arsiran IRBI</button>
              <button type="button" onClick={() => onShowAsis('kapasitas')} className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-200">Arsiran kapasitas</button>
            </>
          ) : null}
          {onShowPie ? <button type="button" onClick={onShowPie} className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-200">Arsiran PIE</button> : null}
        </div>
      }
      kpis={
        <>
          <Kpi label="Kapasitas" value={risiko?.kapasitas || '—'} tone={/rendah|belum/i.test(String(risiko?.kapasitas || '')) ? 'amber' : 'teal'} />
          <Kpi label="IRBI" value={risiko?.irbi || '—'} tone={/tinggi/i.test(String(risiko?.irbi || '')) ? 'rose' : 'slate'} />
          <Kpi label="Poin kapasitas" value={risiko?.poin != null ? `${nf(risiko.poin, '', 0)}%` : '—'} />
          <Kpi label="PIE tinggi" value={piePending ? '…' : fmtAngka(pie.length ? nT : null)} tone="rose" />
          <Kpi label="PIE sedang" value={piePending ? '…' : fmtAngka(pie.length ? nS : null)} tone="amber" />
          <Kpi label="PIE rendah" value={piePending ? '…' : fmtAngka(pie.length ? nR : null)} tone="teal" />
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-[11px] font-semibold text-slate-500">Asistensi wilayah</p>
          <Matrix
            columns={[
              { key: 'nama', label: 'Wilayah' },
              { key: 'level', label: 'Level' },
              { key: 'kapasitas', label: 'Kapasitas', fmt: (v) => v ? <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badgeStatus(v)}`}>{v}</span> : '—' },
              { key: 'irbi', label: 'IRBI', fmt: (v) => v ? <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badgeStatus(v)}`}>{v}</span> : '—' },
              { key: 'poin', label: 'Poin', align: 'right', fmt: (v) => (v != null ? `${nf(v, '', 0)}%` : '—') },
            ]}
            rows={risiko?.tersedia ? rows : []}
            rowKey={(r) => `${r.level}-${r.nama}`}
          />
        </div>
        <div>
          <p className="mb-2 text-[11px] font-semibold text-slate-500">PIE kab/kota ini</p>
          {piePending ? <Empty pending /> : (
            <Matrix
              columns={[
                { key: 'disease', label: 'Penyakit' },
                { key: 'status', label: 'Status', fmt: (v) => <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_BADGE[v] || badgeStatus(v)}`}>{v || '—'}</span> },
              ]}
              rows={pie}
              rowKey={(r, i) => `${r.disease}-${i}`}
            />
          )}
        </div>
      </div>
    </SectionCard>
  )
}

function SecLingkungan({ k, konteks }: { k: any; konteks?: any }) {
  const kind = k?.kind
  const [rentangCuaca, setRentangCuaca] = useState<'7j' | '30h'>('7j')
  const [rentangUdara, setRentangUdara] = useState<'72j' | 'harian'>('harian')
  const pending = konteks == null
  const cuaca = konteks?.cuaca
  const hujan24 = sumInWindow(cuaca?.jam, 'hujan_mm', 24)
  const hujan7 = sumInWindow(cuaca?.jam, 'hujan_mm', 24 * 7)
  const cuacaData = useMemo(() => {
    if (!cuaca || cuaca.kosong) return []
    if (rentangCuaca === '7j') return (cuaca.jam || []).map((r: any) => ({ label: String(r.waktu || '').slice(5, 16).replace('T', ' '), hujan: r.hujan_mm, suhu: r.suhu }))
    return (cuaca.harian30 || cuaca.harian || []).map((r: any) => ({ label: String(r.tanggal || '').slice(5), hujan: r.hujan_mm, suhu: r.suhu_max ?? r.suhu }))
  }, [cuaca, rentangCuaca])
  const udaraData = useMemo(() => {
    const jam = konteks?.udara?.jam
    if (!jam?.length) return []
    if (rentangUdara === '72j') {
      const from = Date.now() - 72 * 3600_000
      return jam.filter((r: any) => { const ts = Date.parse(r.waktu); return Number.isFinite(ts) && ts >= from })
        .map((r: any) => ({ label: String(r.waktu || '').slice(5, 16).replace('T', ' '), pm25: r.pm25, aqi: r.us_aqi }))
    }
    const byDay = new Map<string, { pm25: number; aqi: number; npm: number; naqi: number }>()
    for (const r of jam) {
      const day = String(r.waktu || '').slice(0, 10)
      if (!day) continue
      const row = byDay.get(day) || { pm25: 0, aqi: 0, npm: 0, naqi: 0 }
      if (r.pm25 != null) { row.pm25 += Number(r.pm25); row.npm += 1 }
      if (r.us_aqi != null) { row.aqi += Number(r.us_aqi); row.naqi += 1 }
      byDay.set(day, row)
    }
    return [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([t, r]) => ({
      label: t.slice(5),
      pm25: r.npm ? Math.round((r.pm25 / r.npm) * 10) / 10 : null,
      aqi: r.naqi ? Math.round(r.aqi / r.naqi) : null,
    }))
  }, [konteks, rentangUdara])
  const firmsData = useMemo(() => (konteks?.karhutla?.tren || []).map((r: any) => ({
    label: String(r.tanggal || '').slice(5), n: r.n, tinggi: r.tinggi ?? 0, sedang: r.sedang ?? 0, rendah: r.rendah ?? 0,
  })), [konteks])
  const debitData = useMemo(() => (konteks?.banjir?.harian || []).map((r: any) => ({
    label: String(r.tanggal || '').slice(5), debit: r.debit, rerata: r.debit_rerata,
  })), [konteks])
  const showFirms = kind === 'karhutla' || firmsData.some((r: any) => r.n > 0)
  const showDebit = kind === 'banjir'
  const showBahaya = kind === 'gempa' || kind === 'erupsi'
  const bahaya = konteks?.bahaya?.items || []
  const udara = konteks?.udara
  const fire = konteks?.karhutla

  return (
    <SectionCard
      id="kejadian-sec-lingkungan"
      eyebrow="Lingkungan"
      title="Cuaca, udara, dan ancaman di sekitar titik"
      source="Open-Meteo, NASA FIRMS, BMKG, GDACS · model bukan peringatan resmi"
      kpis={
        <>
          <Kpi label="Suhu" value={pending ? '…' : nf(cuaca?.saat_ini?.suhu, '°C', 1)} />
          <Kpi label="Hujan 24 jam" value={pending ? '…' : nf(hujan24, 'mm', 1)} tone="teal" />
          <Kpi label="Hujan 7 hari" value={pending ? '…' : nf(hujan7, 'mm', 1)} />
          <Kpi label="PM2.5" value={pending ? '…' : nf(udara?.saat_ini?.pm25, 'µg/m³', 1)} sub="CAMS, bukan ISPU" />
          <Kpi label="US AQI" value={pending ? '…' : nf(udara?.saat_ini?.us_aqi, '', 0)} />
          {showFirms ? <Kpi label="FIRMS 7 hari" value={pending ? '…' : fmtAngka(fire?.total_7hari ?? fire?.total)} sub={`${fmtAngka(fire?.total_24jam)} / 24 jam`} tone="amber" /> : null}
          {showBahaya ? <Kpi label="BMKG/GDACS" value={pending ? '…' : fmtAngka(bahaya.length)} sub={`${konteks?.bahaya?.radius_km || '—'} km`} /> : null}
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-slate-500">Hujan & suhu</p>
            <RangeBtn value={rentangCuaca} onChange={(id) => setRentangCuaca(id as any)} options={[{ id: '7j', label: 'Jam' }, { id: '30h', label: '30 hari' }]} />
          </div>
          <ChartBox pending={pending} empty={!cuacaData.length}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={cuacaData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis yAxisId="kiri" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="kanan" orientation="right" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={tipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area yAxisId="kiri" type="monotone" dataKey="hujan" name="Hujan (mm)" stroke="#0284c7" fill="#bae6fd" strokeWidth={1.5} />
                <Line yAxisId="kanan" type="monotone" dataKey="suhu" name="Suhu (°C)" stroke="#b45309" strokeWidth={1.7} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartBox>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-slate-500">PM2.5 & US AQI</p>
            <RangeBtn value={rentangUdara} onChange={(id) => setRentangUdara(id as any)} options={[{ id: '72j', label: '72 jam' }, { id: 'harian', label: 'Harian' }]} />
          </div>
          <ChartBox pending={pending} empty={!udaraData.length}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={udaraData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis yAxisId="kiri" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="kanan" orientation="right" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={tipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area yAxisId="kiri" type="monotone" dataKey="pm25" name="PM2.5" stroke="#7c3aed" fill="#ddd6fe" strokeWidth={1.5} />
                <Line yAxisId="kanan" type="monotone" dataKey="aqi" name="US AQI" stroke="#0f766e" strokeWidth={1.7} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartBox>
        </div>
        {showFirms ? (
          <div>
            <p className="mb-2 text-[11px] font-semibold text-slate-500">Titik panas FIRMS (50 km)</p>
            <ChartBox pending={pending} empty={!firmsData.length}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={firmsData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={tipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="tinggi" name="Tinggi" stackId="a" fill="#be123c" />
                  <Bar dataKey="sedang" name="Sedang" stackId="a" fill="#d97706" />
                  <Bar dataKey="rendah" name="Rendah" stackId="a" fill="#94a3b8" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartBox>
          </div>
        ) : null}
        {showDebit ? (
          <div>
            <p className="mb-2 text-[11px] font-semibold text-slate-500">Debit sungai (GloFAS, model)</p>
            <ChartBox pending={pending} empty={!debitData.length || !debitData.some((r: any) => r.debit != null)}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={debitData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={tipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="debit" name="Debit" stroke="#0369a1" fill="#bae6fd" strokeWidth={1.5} />
                  <Line type="monotone" dataKey="rerata" name="Rerata" stroke="#57534e" strokeWidth={1.4} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartBox>
          </div>
        ) : null}
        {showBahaya ? (
          <div className="lg:col-span-2">
            <p className="mb-2 text-[11px] font-semibold text-slate-500">Gempa & peringatan sekitar</p>
            {pending ? <Empty pending /> : (
              <Matrix
                columns={[
                  { key: 'sumber', label: 'Sumber' },
                  { key: 'title', label: 'Peristiwa', fmt: (v, r) => v || r.label || '—' },
                  { key: 'place', label: 'Lokasi' },
                  { key: 'magnitude', label: 'M', align: 'right', fmt: (v) => (v != null ? `M${nf(v, '', 1)}` : '—') },
                  { key: 'time', label: 'Waktu' },
                  { key: 'jarak_km', label: 'Jarak', align: 'right', fmt: (v) => (v != null ? nf(v, 'km', 1) : '—') },
                ]}
                rows={bahaya}
                rowKey={(_, i) => `b-${i}`}
              />
            )}
          </div>
        ) : null}
      </div>
    </SectionCard>
  )
}

export function SecRiwayat({ riwayat }: { riwayat?: any }) {
  const [rentang, setRentang] = useState<'30h' | '12bln'>('12bln')
  const data = useMemo(() => {
    if (!riwayat?.tersedia) return []
    if (rentang === '30h') return (riwayat.tren30 || []).map((r: any) => ({ ...r, label: String(r.tanggal || '').slice(5) }))
    return (riwayat.tren || []).map((r: any) => ({ ...r, label: String(r.bulan || '').slice(2) }))
  }, [riwayat, rentang])
  return (
    <SectionCard
      id="kejadian-sec-riwayat"
      eyebrow="Riwayat"
      title="Kejadian di wilayah yang sama"
      source="API EOC Pusat Krisis"
      actions={<RangeBtn value={rentang} onChange={(id) => setRentang(id as any)} options={[{ id: '30h', label: '30 hari' }, { id: '12bln', label: '12 bulan' }]} />}
      kpis={
        <>
          <Kpi label="Kab 12 bulan" value={fmtAngka(riwayat?.kab?.total)} tone="teal" />
          <Kpi label="Sejenis di kab" value={fmtAngka(riwayat?.kab?.serupa)} />
          <Kpi label="Provinsi 12 bulan" value={fmtAngka(riwayat?.prov?.total)} />
        </>
      }
    >
      <ChartBox empty={!data.length}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip contentStyle={tipStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="kab" name="Kab/kota" fill="#00705a" radius={[3, 3, 0, 0]} />
            <Bar dataKey="serupa_kab" name="Sejenis" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartBox>
    </SectionCard>
  )
}

export function KejadianIndikatorSections({ k, nearby, riwayat, konteks, risiko, pieKab, piePending, onShowAsis, onShowPie, status, heroMap }: {
  k: any
  nearby?: any
  riwayat?: any
  konteks?: any
  risiko?: any
  pieKab?: { disease: string; status: string }[] | null
  piePending?: boolean
  onShowAsis?: (mode: 'irbi' | 'kapasitas') => void
  onShowPie?: () => void
  status?: any
  heroMap?: ReactNode
}) {
  const temuan = useMemo(
    () => analisaDariData(k, nearby, risiko, status || null, konteks, pieKab),
    [k, nearby, risiko, status, konteks, pieKab],
  )
  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12 xl:items-stretch lg:gap-6">
        <div className="flex min-w-0 flex-col xl:col-span-5">
          <div className="flex-1 [&>section]:h-full">
            <SecAnalisa items={temuan} />
          </div>
        </div>
        <div className="min-w-0 xl:col-span-7">{heroMap}</div>
      </div>
      <SecDampak k={k} riwayat={riwayat} />
      <SecTck tck={nearby?.tck} kabNama={k?.kabupaten} />
      <SecLogistik log={nearby?.logistik} />
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2 lg:gap-6">
        <SecFaskes nearby={nearby} />
        <SecRisiko risiko={risiko} pieKab={pieKab} piePending={piePending} onShowAsis={onShowAsis} onShowPie={onShowPie} />
      </div>
      <SecLingkungan k={k} konteks={konteks} />
      <SecRiwayat riwayat={riwayat} />
    </div>
  )
}
