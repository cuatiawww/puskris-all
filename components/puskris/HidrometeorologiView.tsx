'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CloudRain,
  Hospital,
  MapPin,
  Users,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import PuskrisPetaTerpadu from '@/components/puskris/PuskrisPetaTerpadu'
import WilayahKarakteristik from '@/components/puskris/WilayahKarakteristik'
import { applyDerive, nf, rekapKejadian } from '@/lib/puskris/derive'
import { kejadianHref, wilayahHref } from '@/lib/puskris/eoc-event-layer'
import { MUSIM_CATATAN, rekapMusim, scopeRawHidromet, isHidrometJenis } from '@/lib/puskris/hidrometeorologi'
import { jenisKejadianHref, konteksJenis, breakdownProv } from '@/lib/puskris/jenis-kejadian'
import { toDeriveFilter, type PuskrisUiFilter } from '@/lib/puskris/ui-filter'
import { breakdownKab, trendBulanan } from '@/lib/puskris/wilayah-detail'
import { dmy } from '@/lib/puskris/jenis-meta'

const tipStyle = { fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }
const TEAL = '#16B3AC'

function Empty({ text = 'Data belum tersedia dari API' }: { text?: string }) {
  return <p className="px-1 py-8 text-center text-sm text-slate-500">{text}</p>
}

function Card({ title, icon: Icon, source, children, testId }: {
  title: string
  icon?: any
  source?: string
  children: ReactNode
  testId?: string
}) {
  return (
    <section className="skdr-card overflow-hidden p-4" data-testid={testId}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-black text-slate-900">
            {Icon ? <Icon className="h-4 w-4 text-primary" /> : null}
            {title}
          </h3>
          {source ? <p className="mt-0.5 text-[10px] font-medium text-slate-500">{source}</p> : null}
        </div>
      </div>
      {children}
    </section>
  )
}

function KpiCard({ label, value, sub, icon: Icon, tone = 'primary' }: {
  label: string
  value: ReactNode
  sub?: ReactNode
  icon: any
  tone?: 'primary' | 'rose' | 'amber' | 'orange' | 'slate'
}) {
  const toneClasses = {
    primary: { border: 'border-l-primary hover:border-primary/60', bg: 'bg-primary/10 text-primary' },
    rose: { border: 'border-l-rose-500 hover:border-rose-400', bg: 'bg-rose-50 text-rose-600' },
    amber: { border: 'border-l-amber-500 hover:border-amber-400', bg: 'bg-amber-50 text-amber-600' },
    orange: { border: 'border-l-orange-500 hover:border-orange-400', bg: 'bg-orange-50 text-orange-600' },
    slate: { border: 'border-l-slate-500 hover:border-slate-400', bg: 'bg-slate-100 text-slate-600' },
  }[tone]
  return (
    <div className={`skdr-card relative block overflow-hidden border-l-4 ${toneClasses.border} p-3 transition`}>
      <div className="flex items-center justify-between text-slate-500">
        <span className="text-[11px] font-black uppercase tracking-wider">{label}</span>
        <div className={`rounded-lg p-1.5 ${toneClasses.bg}`}><Icon className="h-4 w-4" /></div>
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="text-2xl font-black tracking-tight text-slate-900">{value}</span>
      </div>
      {sub ? <div className="mt-2 text-xs font-bold text-slate-600">{sub}</div> : null}
    </div>
  )
}

function shortNama(s: string, n = 18) {
  const t = String(s || '')
  return t.length > n ? `${t.slice(0, n - 1)}…` : t
}

export default function HidrometeorologiView({
  raw, f, onApply,
}: {
  raw: any
  f: PuskrisUiFilter
  onApply: (next: PuskrisUiFilter) => void
}) {
  const jenisAktif = f.jenis && isHidrometJenis(f.jenis) ? f.jenis : null

  useEffect(() => {
    if (f.jenis && !isHidrometJenis(f.jenis)) onApply({ ...f, jenis: null })
  }, [f, onApply])

  const rawHidromet = useMemo(() => scopeRawHidromet(raw, jenisAktif), [raw, jenisAktif])
  const derived = useMemo(() => applyDerive(rawHidromet, toDeriveFilter(f)), [rawHidromet, f])
  const kejadian = useMemo(() => derived.kejadianSemua || [], [derived.kejadianSemua])
  const situasi = useMemo(() => (kejadian.length ? { ...rekapKejadian(kejadian), sumber: derived.situasi?.sumber } : derived.situasi), [kejadian, derived.situasi])
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null)

  const tahun = Number(f.tahun) || new Date().getFullYear()
  const listUntukKartu = useMemo(() => {
    // Kartu jenis tetap menampilkan seluruh hidromet (bukan yang sudah disaring satu jenis), supaya bisa berpindah jenis.
    const semua = scopeRawHidromet(raw, null)
    const d = applyDerive(semua, toDeriveFilter({ ...f, jenis: null }))
    return d.kejadianSemua || []
  }, [raw, f])

  const trend = useMemo(() => trendBulanan(kejadian), [kejadian])
  const musim = useMemo(() => rekapMusim(trend), [trend])
  const provRows = useMemo(() => breakdownProv(kejadian), [kejadian])
  const kabRows = useMemo(() => breakdownKab(kejadian), [kejadian])
  const ctx = useMemo(() => konteksJenis(raw, provRows), [raw, provRows])
  const recent = useMemo(
    () => [...kejadian].sort((a: any, b: any) => String(b.tanggal || '').localeCompare(String(a.tanggal || '')) || String(b.uid || '').localeCompare(String(a.uid || ''))).slice(0, 25),
    [kejadian],
  )

  const sumberEoc = situasi?.sumber || 'API EOC Pusat Krisis'
  const adaKejadian = (situasi?.terpantau || 0) > 0

  return (
    <div className="space-y-4" data-testid="hidromet-page">
      <p className="text-[11px] leading-relaxed text-slate-500" data-testid="hidromet-scope-note">
        Halaman ini memuat kejadian hidrometeorologi dari API EOC — banjir, banjir bandang, tanah longsor, cuaca ekstrem/angin puting beliung, gelombang pasang/abrasi, dan kekeringan — serta karhutla, karena keterkaitan musim kemarau. Karhutla di API EOC termasuk kategori tersendiri (ALAM · KARHUTLA), bukan hidrometeorologi murni. Curah hujan dan peringatan dini BMKG belum tersedia di dasbor ini.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="hidromet-kpi">
        <KpiCard label="Kejadian terpantau" value={nf(situasi?.terpantau)} sub={situasi?.berdampak_krisis != null ? `${nf(situasi.berdampak_krisis)} berdampak krisis` : undefined} icon={CloudRain} />
        <KpiCard label="Meninggal & hilang" value={nf((situasi?.meninggal || 0) + (situasi?.hilang || 0))} sub={`Meninggal ${nf(situasi?.meninggal)} · Hilang ${nf(situasi?.hilang)}`} icon={AlertTriangle} tone="rose" />
        <KpiCard label="Luka" value={nf(situasi?.luka)} sub={`Berat ${nf(situasi?.luka_berat)} · Ringan ${nf(situasi?.luka_ringan)}`} icon={Activity} tone="amber" />
        <KpiCard label="Pengungsi" value={nf(situasi?.pengungsi)} sub={`Terdampak ${nf(situasi?.terdampak)} · Faskes rusak ${nf(situasi?.faskes_rusak)}`} icon={Users} tone="orange" />
      </div>
      <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400">{sumberEoc}. Titik kejadian memakai koordinat dari API EOC; kejadian tanpa koordinat diletakkan di pusat kab/kota atau provinsi. Layer Fasyankes (RS dan Puskesmas) dapat diaktifkan di panel dalam peta.</p>

      <PuskrisPetaTerpadu raw={raw} f={f} onApply={onApply} derived={derived} kejadian={kejadian} selectedEvent={selectedEvent} setSelectedEvent={setSelectedEvent} />

      <Card title="Rincian per jenis" icon={CloudRain} source="Klik kartu untuk menyaring halaman ini. Tautan «Lihat nasional» membuka dasbor jenis kejadian." testId="hidromet-jenis">
        {listUntukKartu.length ? (
          <WilayahKarakteristik
            list={listUntukKartu}
            selected={jenisAktif}
            onSelect={(id) => onApply({ ...f, jenis: id && isHidrometJenis(id) ? id : null })}
            tahun={tahun}
            showNasionalLink
          />
        ) : <Empty />}
      </Card>

      <div className="grid gap-3 lg:grid-cols-2" data-testid="hidromet-tren">
        <Card title="Tren bulanan kejadian" icon={BarChart3} source={`${sumberEoc}. Satu rangkaian skala, terpisah dari korban.`}>
          {adaKejadian ? (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="bulan" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={36} />
                  <Tooltip contentStyle={tipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="kejadian" name="Kejadian" fill={TEAL} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="krisis" name="Berdampak krisis" fill="#0f766e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <Empty />}
        </Card>

        <Card title="Tren bulanan korban (meninggal, hilang, luka)" icon={Activity} source="Dipisah dari grafik kejadian supaya skalanya terbaca.">
          {adaKejadian ? (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="bulan" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={36} />
                  <Tooltip contentStyle={tipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="meninggal" name="Meninggal" fill="#e11d48" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="hilang" name="Hilang" fill="#9f1239" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="luka" name="Luka" fill="#d97706" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <Empty />}
        </Card>

        <Card title="Tren bulanan pengungsi dan penduduk terdampak" icon={Users} source="Grafik terpisah karena angkanya jauh lebih besar daripada korban jiwa.">
          {adaKejadian ? (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="bulan" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={48} />
                  <Tooltip contentStyle={tipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="pengungsi" name="Pengungsi" fill="#ea580c" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="terdampak" name="Terdampak" fill="#64748b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <Empty />}
        </Card>

        <Card title="Pola musim (pengelompokan kalender)" icon={CloudRain} source={MUSIM_CATATAN} testId="hidromet-musim">
          <div className="grid gap-2 sm:grid-cols-3">
            {([musim.hujan, musim.kemarau, musim.pancaroba] as const).map((row) => (
              <div key={row.id} className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{row.label}</p>
                <p className="text-[11px] font-medium text-slate-500">{row.bulan}</p>
                <p className="mt-1 text-xl font-black text-slate-900">{nf(row.kejadian)}</p>
                <p className="text-[11px] font-semibold text-slate-600">kejadian · krisis {nf(row.krisis)}</p>
                <p className="mt-1 text-[11px] text-slate-500">Meninggal {nf(row.meninggal)} · Pengungsi {nf(row.pengungsi)}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-2" data-testid="hidromet-peringkat">
        <Card title="Provinsi terdampak" icon={MapPin} source="Diurutkan menurut jumlah kejadian. Tautan membuka halaman wilayah.">
          {provRows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <th className="px-1 py-1.5">Provinsi</th>
                    <th className="px-1 py-1.5 text-right">Kejadian</th>
                    <th className="px-1 py-1.5 text-right">Krisis</th>
                    <th className="px-1 py-1.5 text-right">Meninggal</th>
                    <th className="px-1 py-1.5 text-right">Pengungsi</th>
                  </tr>
                </thead>
                <tbody>
                  {provRows.slice(0, 10).map((r: any) => (
                    <tr key={r.code} className="border-t border-slate-100">
                      <td className="px-1 py-1.5 font-semibold">
                        <Link href={wilayahHref(r.code, { tahun, jenis: jenisAktif })} className="text-[#047D78] hover:underline">{r.nama}</Link>
                      </td>
                      <td className="px-1 py-1.5 text-right font-bold">{nf(r.kejadian)}</td>
                      <td className="px-1 py-1.5 text-right">{nf(r.krisis)}</td>
                      <td className="px-1 py-1.5 text-right">{nf(r.meninggal)}</td>
                      <td className="px-1 py-1.5 text-right">{nf(r.pengungsi)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty />}
        </Card>

        <Card title="Kab/Kota terdampak" icon={MapPin} source="Sepuluh kab/kota dengan kejadian terbanyak.">
          {kabRows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <th className="px-1 py-1.5">Kab/Kota</th>
                    <th className="px-1 py-1.5 text-right">Kejadian</th>
                    <th className="px-1 py-1.5 text-right">Meninggal</th>
                    <th className="px-1 py-1.5 text-right">Pengungsi</th>
                  </tr>
                </thead>
                <tbody>
                  {kabRows.slice(0, 10).map((r: any, i: number) => {
                    const kab = String(r.code || '')
                    const bisaTaut = /^\d{4}$/.test(kab)
                    return (
                    <tr key={`${r.code || r.nama}-${i}`} className="border-t border-slate-100">
                      <td className="px-1 py-1.5 font-semibold">
                        {bisaTaut ? (
                          <Link href={wilayahHref(kab.slice(0, 2), { tahun, kab, jenis: jenisAktif })} className="text-[#047D78] hover:underline">{r.nama}</Link>
                        ) : r.nama}
                      </td>
                      <td className="px-1 py-1.5 text-right font-bold">{nf(r.kejadian)}</td>
                      <td className="px-1 py-1.5 text-right">{nf(r.meninggal)}</td>
                      <td className="px-1 py-1.5 text-right">{nf(r.pengungsi)}</td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : <Empty />}
        </Card>
      </div>

      <Card title="Kesiapan & respons di provinsi terdampak" icon={Hospital} source="Kapasitas berdiri (PSC, ambulans, TCK, logistik) di provinsi yang memiliki kejadian hidrometeorologi pada periode ini. API tidak menautkan penugasan ke jenis kejadian." testId="hidromet-kesiapan">
        <p className="mb-3 text-sm text-slate-600">Kapasitas di {nf(ctx.provCount || provRows.length)} provinsi terdampak{jenisAktif ? ` · filter ${jenisAktif}` : ''}{f.provinsi ? ' · sesuai filter wilayah' : ''}.</p>
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="PSC aktif" value={ctx.psc.tersedia ? `${nf(ctx.psc.psc_aktif)}/${nf(ctx.psc.psc_total)}` : '—'} sub={ctx.psc.tersedia ? `${nf(ctx.psc.provinsi)} provinsi` : 'Data belum tersedia dari API'} icon={Hospital} />
          <KpiCard label="Ambulans" value={ctx.psc.tersedia ? nf(ctx.psc.ambulans) : '—'} sub={ctx.psc.tersedia ? `Baik ${nf(ctx.psc.ambulans_baik)}` : undefined} icon={Activity} />
          <KpiCard label="Relawan TCK" value={ctx.tck.tersedia ? nf(ctx.tck.individu) : '—'} sub={ctx.tck.tersedia ? `${nf(ctx.tck.tim)} tim` : 'Data belum tersedia dari API'} icon={Users} />
          <KpiCard label="Stok logistik regional" value={ctx.logistik.tersedia ? nf(ctx.logistik.total) : '—'} sub={ctx.logistik.tersedia ? `${nf(ctx.logistik.gudang)} gudang (unik, tanpa dihitung ganda)` : 'Data belum tersedia dari API'} icon={BarChart3} tone="slate" />
        </div>
        {ctx.rows?.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="h-[280px]">
              <p className="mb-1 text-[11px] font-bold text-slate-600">TCK individu per provinsi</p>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ctx.rows.filter((r: any) => r.tck_individu != null).slice(0, 12).map((r: any) => ({ ...r, singkat: shortNama(r.nama, 16) }))} layout="vertical" margin={{ top: 0, right: 16, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="singkat" width={100} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={tipStyle} formatter={(v: any) => [nf(Number(v)), 'TCK']} />
                  <Bar dataKey="tck_individu" name="TCK" fill={TEAL} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="h-[280px]">
              <p className="mb-1 text-[11px] font-bold text-slate-600">PSC aktif per provinsi</p>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ctx.rows.filter((r: any) => r.psc_aktif != null).slice(0, 12).map((r: any) => ({ ...r, singkat: shortNama(r.nama, 16) }))} layout="vertical" margin={{ top: 0, right: 16, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="singkat" width={100} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={tipStyle} formatter={(v: any) => [nf(Number(v)), 'PSC aktif']} />
                  <Bar dataKey="psc_aktif" name="PSC aktif" fill="#0f766e" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : <Empty />}
      </Card>

      <Card title="Kejadian terbaru" icon={AlertTriangle} source={`${sumberEoc}. Maksimal 25 kejadian terbaru pada periode terpilih.`} testId="hidromet-terbaru">
        {recent.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[12px]">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="px-1 py-1.5">Tanggal</th>
                  <th className="px-1 py-1.5">Jenis</th>
                  <th className="px-1 py-1.5">Wilayah</th>
                  <th className="px-1 py-1.5 text-right">Meninggal</th>
                  <th className="px-1 py-1.5 text-right">Luka</th>
                  <th className="px-1 py-1.5 text-right">Pengungsi</th>
                  <th className="px-1 py-1.5">Krisis</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((k: any) => (
                  <tr key={k.uid || `${k.tanggal}-${k.jenis}-${k.kabupaten}`} className="border-t border-slate-100">
                    <td className="px-1 py-1.5 whitespace-nowrap text-slate-600">{dmy(k.tanggal)}</td>
                    <td className="px-1 py-1.5 font-semibold">
                      <Link href={jenisKejadianHref(k.jenis, { tahun, prov: f.provinsi })} className="text-[#047D78] hover:underline">{k.jenis}</Link>
                    </td>
                    <td className="px-1 py-1.5">
                      {k.uid ? <Link href={kejadianHref(k.uid, k.tanggal)} className="font-semibold text-[#047D78] hover:underline">{k.kabupaten || k.provinsi}</Link> : (k.kabupaten || k.provinsi)}
                      {k.kabupaten && k.provinsi ? <span className="block text-[10px] text-slate-500">{k.provinsi}</span> : null}
                    </td>
                    <td className="px-1 py-1.5 text-right">{nf(k.meninggal)}</td>
                    <td className="px-1 py-1.5 text-right">{nf((k.luka_berat || 0) + (k.luka_ringan || 0))}</td>
                    <td className="px-1 py-1.5 text-right">{nf(k.pengungsi)}</td>
                    <td className="px-1 py-1.5">{k.krisis ? 'Ya' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty />}
      </Card>
    </div>
  )
}
