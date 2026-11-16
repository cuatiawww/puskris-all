'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Activity, AlertTriangle, Ambulance, Box, Building2, Download, PhoneCall,
  RefreshCw, Shield, Skull, Tent, Truck, Users,
} from 'lucide-react'
import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { KpiCard, RatioBar } from '@/components/dasbor-mbg/MbgUi'
import PuskrisDualMap from '@/components/puskris/PuskrisDualMap'
import { applyDerive, DEFAULT_FILTER, LEFT_LAYERS, RIGHT_LAYERS, nf, pf } from '@/lib/puskris/derive'
import type { PuskrisFilter } from '@/lib/puskris/types'
import { downloadXlsx } from '@/lib/xlsx-lite'
import PageHeader from '@/components/PageHeader'

function Badge({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'slate' | 'amber' | 'teal' }) {
  const cls = tone === 'amber' ? 'border-amber-200 bg-amber-50 text-amber-800' : tone === 'teal' ? 'border-teal-200 bg-teal-50 text-teal-800' : 'border-slate-200 bg-slate-100 text-slate-600'
  return <span className={`ml-1 inline-flex rounded-full border px-1.5 py-px text-[9px] font-bold uppercase tracking-wide ${cls}`}>{children}</span>
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-extrabold text-slate-900">{title}</h2>
        {desc ? <p className="text-xs text-slate-500">{desc}</p> : null}
      </div>
      {children}
    </section>
  )
}

export default function RingkasanClient() {
  const [raw, setRaw] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<PuskrisFilter>(DEFAULT_FILTER)
  const [left, setLeft] = useState('kejadian')
  const [right, setRight] = useState('kesenjangan')

  useEffect(() => {
    let on = true
    fetch('/api/puskris/ringkasan', { cache: 'no-store' })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((j) => { if (on) setRaw(j.data || j) })
      .catch((e) => { if (on) setError(e.message || 'Gagal memuat data') })
    return () => { on = false }
  }, [])

  const view = useMemo(() => (raw ? applyDerive(raw, filter) : null), [raw, filter])
  const set = (p: Partial<PuskrisFilter>) => setFilter((f) => ({ ...f, ...p }))

  const exportXlsx = () => {
    if (!view) return
    downloadXlsx('puskris-ringkasan.xlsx', [
      { name: 'Provinsi', rows: [['Kode', 'Nama', 'Kejadian 2026', 'Krisis 2026', 'Meninggal', 'Pengungsi', 'Terdampak', 'Panggilan 119', 'PSC aktif', 'Ambulans', 'TCK', 'Indeks kesenjangan'], ...view.rows.map((r) => [r.code, r.nama, r.kejadian, r.krisis, r.meninggal, r.pengungsi, r.terdampak, r.panggilan, r.pscAktif, r.ambulans, r.tck, Number(r.kesenjangan.toFixed(3))])] },
      { name: 'Kejadian krisis', rows: [['Tanggal', 'Jenis', 'Provinsi', 'Kabupaten', 'Terdampak', 'Meninggal', 'Luka berat', 'Luka ringan', 'Pengungsi'], ...view.kejadian.map((k: any) => [k.tanggal, k.jenis, k.provinsi, k.kabupaten, k.terdampak, k.meninggal, k.luka_berat, k.luka_ringan, k.pengungsi])] },
      { name: 'NCC harian', rows: [['Tanggal', 'COF', 'ACD', 'ABD', 'SCR'], ...view.ncc.days.map((d: any) => [d.date, d.cof, d.acd, d.abd, d.scr])] },
      { name: 'Logistik regional', rows: [['Regional', 'Kode', 'Obat', 'Sarpras', 'Alkes', 'BMHP', 'Total'], ...view.logistik.rows.map((r: any) => [r.nama, r.code, r.obat, r.sarpras, r.alkes, r.bmhp, r.total])] },
    ])
  }

  if (error) {
    return <div className="p-6 text-sm text-red-700">Data Ringkasan tidak dapat dimuat: {error}</div>
  }
  if (!view) {
    return <div className="p-6 text-sm text-slate-500">Memuat ringkasan Pusat Krisis Kesehatan…</div>
  }

  const asis = view.asistensi
  const capP = asis.provinsi?.status_kapasitas || {}
  const capK = asis.kabupaten_kota?.status_kapasitas || {}

  return (
    <div className="space-y-8 pb-10">
      <PageHeader
        title="Ringkasan Pusat Krisis Kesehatan"
        subtitle="Gambaran nasional yang menyatukan pantauan bencana, layanan 119, tenaga cadangan, logistik, dan asesmen risiko — agar pimpinan melihat keseluruhan situasi dalam satu layar."
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-600">
            Periode
            <select className="mt-1 block h-9 min-w-[160px] rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold" value={filter.periode} onChange={(e) => {
              const periode = e.target.value as PuskrisFilter['periode']
              set({ periode, bulan: periode === 'bulan' ? 10 : null })
            }}>
              <option value="tahun">Tahun 2026</option>
              <option value="bulan">Oktober 2026</option>
              <option value="30hari">30 hari terakhir</option>
              <option value="7hari">7 hari terakhir</option>
            </select>
          </label>
          <label className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-600">
            Provinsi
            <select className="mt-1 block h-9 min-w-[200px] rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold" value={filter.provinsi || ''} onChange={(e) => set({ provinsi: e.target.value || null, kabupaten: null })}>
              <option value="">Semua provinsi</option>
              {view.rows.slice().sort((a, b) => a.nama.localeCompare(b.nama, 'id')).map((r) => (
                <option key={r.code} value={r.code}>{r.nama}</option>
              ))}
            </select>
          </label>
          <label className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-600">
            Kab/Kota
            <select className="mt-1 block h-9 min-w-[200px] rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold" value={filter.kabupaten || ''} onChange={(e) => set({ kabupaten: e.target.value || null })} disabled={!view.kabOptions.length}>
              <option value="">Semua (hanya tabel kejadian)</option>
              {view.kabOptions.map((k: string) => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
          <button type="button" className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:border-brand-300" onClick={() => setFilter(DEFAULT_FILTER)}>
            <RefreshCw className="mr-1 inline h-3.5 w-3.5" />Reset
          </button>
        </div>
        <button type="button" onClick={exportXlsx} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-white hover:bg-primary-dark">
          <Download className="h-3.5 w-3.5" />Unduh Excel
        </button>
      </div>

      <div className="rounded-xl border border-teal-100 bg-teal-50/60 px-4 py-3">
        <div className="text-xs font-extrabold uppercase tracking-wider text-teal-800">Sorotan</div>
        <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-slate-700">
          {view.narrative.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
      </div>

      <Section title="Situasi Krisis" desc="Sumber: Dashboard EOC resmi Pusat Krisis (kejadian terpantau vs berdampak krisis).">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <KpiCard icon={AlertTriangle} label="Kejadian terpantau" value={nf(view.situasi.terpantau)} tone="teal" sub={view.selected ? <Badge tone="amber">agregat 2026 provinsi</Badge> : <Badge tone="teal">nasional resmi</Badge>} />
          <KpiCard icon={Activity} label="Berdampak krisis" value={nf(view.situasi.berdampak_krisis)} tone="amber" sub={view.selected ? <Badge tone="amber">agregat 2026</Badge> : <Badge>nasional resmi</Badge>} />
          <KpiCard icon={Skull} label="Meninggal" value={nf(view.situasi.meninggal)} tone="red" />
          <KpiCard icon={Activity} label="Luka (berat+ringan)" value={view.situasi.luka === null ? '—' : nf(view.situasi.luka)} tone="amber" sub={view.situasi.luka === null ? <Badge tone="amber">tidak terurai di provinsi</Badge> : null} />
          <KpiCard icon={AlertTriangle} label="Hilang" value="—" tone="slate" sub={<Badge tone="amber">hanya di data kumulatif Vercel</Badge>} />
          <KpiCard icon={Tent} label="Pengungsi" value={nf(view.situasi.pengungsi)} tone="blue" />
          <KpiCard icon={Users} label="Penduduk terdampak" value={nf(view.situasi.terdampak)} tone="blue" />
        </div>
        <p className="text-[11px] text-slate-500">{view.situasi.sumber}. Filter kab/kota hanya memengaruhi tabel kejadian di bawah.{view.situasi.catatanPeriode ? ` ${view.situasi.catatanPeriode}` : ''}</p>
      </Section>

      <Section title="Layanan Gawat Darurat" desc="Panggilan dan armada dari snapshot PSC 119; rasio terjawab (SCR) dari Dashboard NCC.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <KpiCard icon={PhoneCall} label="Panggilan 119" value={nf(view.layanan.panggilan)} tone="teal" sub={!view.freshness.psc.filterable.periode ? <Badge tone="amber">periode tidak terfilter</Badge> : null} />
          <KpiCard icon={Activity} label="Pangsa emergency" value={pf(view.layanan.emergencyShare)} tone="amber" sub={view.layanan.emergencyShare === null ? <Badge tone="amber">nasional saja</Badge> : `${nf(view.layanan.emergency)} panggilan`} />
          <KpiCard icon={PhoneCall} label="SCR NCC" value={pf(view.layanan.scr)} tone="blue" sub={view.selected ? <Badge tone="amber">nasional saja</Badge> : view.ncc.period?.label} />
          <KpiCard icon={Activity} label="Waktu respons" value={view.layanan.waktuRespons != null ? `${view.layanan.waktuRespons} mnt` : '—'} tone="slate" sub={<Badge tone="amber">nasional, snapshot</Badge>} />
          <KpiCard icon={Building2} label="PSC aktif" value={`${nf(view.layanan.pscAktif)}/${nf(view.layanan.pscTotal)}`} tone="teal" />
          <KpiCard icon={Ambulance} label="Armada ambulans" value={nf(view.layanan.ambulans)} tone="blue" />
          <KpiCard icon={Ambulance} label="Kondisi armada" value={view.layanan.ambulansBaik == null ? '—' : nf(view.layanan.ambulansBaik)} tone="emerald" sub={view.layanan.ambulansBaik == null ? <Badge tone="amber">nasional saja</Badge> : `Baik ${nf(view.layanan.ambulansBaik)} · RR ${nf(view.layanan.ambulansRusakRingan)} · RB ${nf(view.layanan.ambulansRusakBerat)}`} />
        </div>
      </Section>

      <Section title="Kesiapsiagaan SDM" desc="Tenaga Cadangan Kesehatan: individu, tim, dan EMT.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard icon={Users} label="Individu TCK" value={nf(view.sdm.individu)} tone="teal" sub={view.tckGrowth ? `+${nf(view.tckGrowth.delta)} bulan ini (${pf(view.tckGrowth.deltaPct)})` : <Badge>per provinsi</Badge>} />
          <KpiCard icon={Shield} label="Nakes" value={nf(view.sdm.nakes)} tone="blue" />
          <KpiCard icon={Users} label="Non-nakes" value={nf(view.sdm.nonNakes)} tone="slate" />
          <KpiCard icon={Users} label="Tim" value={view.sdm.tim == null ? '—' : nf(view.sdm.tim)} tone="teal" sub={view.sdm.tim == null ? <Badge tone="amber">nasional saja</Badge> : null} />
          <KpiCard icon={Users} label="EMT" value={view.sdm.emt == null ? '—' : nf(view.sdm.emt)} tone="blue" sub={view.sdm.emt == null ? <Badge tone="amber">nasional saja</Badge> : null} />
        </div>
      </Section>

      <Section title="Logistik" desc="Landing SIMLOGKES tahun 2026, 11 regional (bukan 38 provinsi).">
        <div className="grid gap-3 sm:grid-cols-3">
          <KpiCard icon={Box} label="Total stok 2026" value={view.logistik.totalStok == null ? '—' : nf(view.logistik.totalStok)} tone="teal" sub={view.logistik.regional ? <Badge tone="amber">{view.logistik.regional}</Badge> : <Badge tone="amber">nasional / regional</Badge>} />
          <KpiCard icon={Truck} label="Penerimaan" value={view.logistik.penerimaan == null ? '—' : nf(view.logistik.penerimaan)} tone="blue" sub={<Badge tone="amber">nasional saja</Badge>} />
          <KpiCard icon={Truck} label="Pengeluaran" value={view.logistik.pengeluaran == null ? '—' : nf(view.logistik.pengeluaran)} tone="amber" sub={<Badge tone="amber">nasional saja</Badge>} />
        </div>
      </Section>

      <Section title="Asistensi Risiko" desc="Snapshot manual 16 November 2026 dari dasbor resmi (sumber butuh login). Peta per provinsi tidak ditampilkan karena nilai per wilayah tidak tersedia secara lengkap.">
        <div className="grid gap-3 lg:grid-cols-3">
          <KpiCard icon={Shield} label="Cakupan provinsi" value={pf(asis.cakupan?.provinsi_pct)} tone="amber" sub={`${asis.cakupan?.provinsi_mengisi_kapasitas} dari ${asis.cakupan?.provinsi_total} mengisi status kapasitas`} />
          <KpiCard icon={Shield} label="Cakupan kab/kota" value={pf(asis.cakupan?.kabkot_pct)} tone="amber" sub={`${asis.cakupan?.kabkot_mengisi_kapasitas} dari ${asis.cakupan?.kabkot_total} mengisi status kapasitas`} />
          <div className="skdr-card p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Cakupan pengisian kapasitas</div>
            <div className="mt-3 space-y-3">
              <RatioBar label="Provinsi" good={asis.cakupan?.provinsi_mengisi_kapasitas || 0} total={asis.cakupan?.provinsi_total || 38} barCls="bg-teal-600" />
              <RatioBar label="Kabupaten/Kota" good={asis.cakupan?.kabkot_mengisi_kapasitas || 0} total={asis.cakupan?.kabkot_total || 514} barCls="bg-amber-500" />
            </div>
            <p className="mt-3 text-[11px] text-slate-500">Label: {asis.label}. Status kapasitas provinsi — Tinggi {capP.Tinggi || 0}, Sedang {capP.Sedang || 0}, Rendah {capP.Rendah || 0}, Belum mengisi {capP['Belum Mengisi'] || 0}. Kab/kota — Tinggi {capK.Tinggi || 0}, Sedang {capK.Sedang || 0}, Rendah {capK.Rendah || 0}, Belum mengisi {capK['Belum Mengisi'] || 0}.</p>
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
              <tr>{(asis.kolom_tabel || []).map((c: string) => <th key={c} className="px-3 py-2">{c}</th>)}</tr>
            </thead>
            <tbody>
              {(asis.contoh_wilayah || []).map((r: any) => (
                <tr key={r.kode_wilayah} className="border-t border-line">
                  <td className="px-3 py-2 font-mono">{r.kode_wilayah}</td>
                  <td className="px-3 py-2 font-semibold">{r.nama}</td>
                  <td className="px-3 py-2 tabular-nums">{r.poin_kapasitas_pct}%</td>
                  <td className="px-3 py-2">{r.status_kapasitas}</td>
                  <td className="px-3 py-2">{r.status_risiko_irbi_2024}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-slate-500">{asis.catatan} Contoh di atas (Banten dan Jawa Barat) adalah satu-satunya nilai per wilayah yang tercatat.</p>
      </Section>

      <Section title="Peta sebaran" desc="Klik provinsi pada peta untuk memfilter seluruh halaman. Indeks kesenjangan membandingkan beban krisis dengan kapasitas respons.">
        <div className="grid gap-4 lg:grid-cols-2">
          <PuskrisDualMap title="Beban Krisis" rows={view.rows} layer={left} layers={[...LEFT_LAYERS]} selected={filter.provinsi} onSelect={(code) => set({ provinsi: code, kabupaten: null })} onLayer={setLeft} mode="risk" tooltip="Agregat marker 2026" />
          <PuskrisDualMap title="Kapasitas Respons" rows={view.rows} layer={right} layers={[...RIGHT_LAYERS]} selected={filter.provinsi} onSelect={(code) => set({ provinsi: code, kabupaten: null })} onLayer={setRight} mode="teal" tooltip={right === 'kesenjangan' ? 'Beban − kapasitas, dinormalisasi' : undefined} />
        </div>
        <p className="text-[11px] text-slate-500">{view.rumusKesenjangan}</p>
      </Section>

      <Section title="Tren dan kejadian krisis terbaru">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="skdr-card p-4">
            <div className="mb-2 text-sm font-extrabold">Tren bulanan kejadian vs krisis, 2026</div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={view.chartBulanan}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E4E5E7" />
                  <XAxis dataKey="bulan" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="kejadian" name="Terpantau" stroke="#16B3AC" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="krisis" name="Berdampak krisis" stroke="#F02D2D" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="skdr-card p-4">
            <div className="mb-2 text-sm font-extrabold">Tren panggilan NCC {view.ncc.period?.label || ''}{view.selected ? <Badge tone="amber">nasional saja</Badge> : null}</div>
            <div className="h-56">
              {view.ncc.days.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={view.ncc.days}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E4E5E7" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="cof" name="Masuk (COF)" stroke="#0D6B67" fill="#B8EDEA" />
                    <Area type="monotone" dataKey="acd" name="Terjawab (ACD)" stroke="#3899FE" fill="#CEE6FE" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <div className="flex h-full items-center justify-center text-xs text-slate-500">Tidak ada data NCC pada periode ini (NCC saat ini hanya mencakup November 2026).</div>}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2">Tanggal</th>
                <th className="px-3 py-2">Jenis</th>
                <th className="px-3 py-2">Lokasi</th>
                <th className="px-3 py-2">Terdampak</th>
                <th className="px-3 py-2">Korban</th>
              </tr>
            </thead>
            <tbody>
              {view.kejadian.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">Tidak ada kejadian berdampak krisis pada filter ini.</td></tr>
              ) : view.kejadian.map((k: any, i: number) => (
                <tr key={`${k.tanggal}-${k.kabupaten}-${i}`} className="border-t border-line">
                  <td className="px-3 py-2 tabular-nums">{k.tanggal}</td>
                  <td className="px-3 py-2">{k.jenis}</td>
                  <td className="px-3 py-2">{k.kabupaten}{k.provinsi ? `, ${k.provinsi}` : ''}</td>
                  <td className="px-3 py-2 tabular-nums">{nf(k.terdampak)}</td>
                  <td className="px-3 py-2 tabular-nums">{nf(k.meninggal)} meninggal · {nf((k.luka_berat || 0) + (k.luka_ringan || 0))} luka · {nf(k.pengungsi)} pengungsi</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Kebaruan data">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Object.values(view.freshness).map((f) => (
            <a key={f.sumber} href={f.url} target="_blank" rel="noreferrer" className="skdr-card block p-3 transition hover:border-brand-300">
              <div className="text-sm font-bold text-slate-800">{f.sumber}</div>
              <div className="mt-1 text-[11px] text-slate-500">{f.at} · snapshot</div>
              <div className="mt-1 text-[11px] text-slate-500">{f.label}</div>
              <div className="mt-2 text-[11px] font-semibold text-brand-700">Buka dasbor asli ↗</div>
            </a>
          ))}
        </div>
      </Section>
    </div>
  )
}
