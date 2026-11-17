'use client'

import { nf, pf } from '@/lib/puskris/derive'
import type { PuskrisTab } from '@/lib/puskris/ui-filter'
import { monthLabel } from '@/lib/puskris/to-spasial'
import SectionHead from '@/components/puskris/SectionHead'
import InfoHint from '@/components/puskris/InfoHint'
import ApiKosong from '@/components/puskris/ApiKosong'
import { displayJenisArmada, EMT_LABEL, IRBI_HINT, IRBI_LABEL, KORBAN_LABEL, NCC_LABEL } from '@/lib/puskris/labels'
import { useState } from 'react'
import { NASIONAL_NOTE } from '@/lib/puskris/pages'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'

const TEAL = '#0F6E64'
const AMBER = '#d97706'
const SLATE = '#64748b'
const BLUE = '#2563eb'
const ROSE = '#be123c'

function Card({ eyebrow, title, desc, children }: { eyebrow?: string; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="skdr-section">
      <SectionHead eyebrow={eyebrow || 'Dasbor sumber'} title={title} desc={desc} />
      <div className="skdr-card p-4">{children}</div>
    </section>
  )
}

function Stat({ label, value, sub, hint }: { label: string; value: string; sub?: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
        {label}
        {hint ? <InfoHint text={hint} /> : null}
      </div>
      <div className="text-lg font-black tabular-nums text-slate-900">{value}</div>
      {sub ? <div className="text-[10px] text-slate-500">{sub}</div> : null}
    </div>
  )
}

const DAMPAK_TABS = [
  { key: 'meninggal', label: 'Meninggal', color: ROSE, hint: 'Korban meninggal dunia akibat kejadian.' },
  { key: 'luka_berat', label: 'Luka berat / rawat inap', color: '#ea580c', hint: KORBAN_LABEL.lbHint },
  { key: 'luka_ringan', label: 'Luka ringan / rawat jalan', color: AMBER, hint: KORBAN_LABEL.lrHint },
  { key: 'pengungsi', label: 'Pengungsi', color: BLUE, hint: KORBAN_LABEL.pengungsiHint },
  { key: 'terdampak', label: 'Penduduk terdampak', color: TEAL, hint: KORBAN_LABEL.terdampakHint },
] as const

/** Situasi Krisis: tren 5 tahun korban & pengungsi (semua kejadian vs berdampak krisis) + indikator turunan + provinsi teratas. */
function DampakPenduduk({ raw, rows, filtered }: { raw: any; rows: any[]; filtered: boolean }) {
  const [tabKey, setTabKey] = useState<(typeof DAMPAK_TABS)[number]['key']>('pengungsi')
  const resmi = raw?.eoc?.nasional || {}
  const tahun = resmi.kejadian_tahun || {}
  const krisis = resmi.krisis_tahun || {}
  const cur = DAMPAK_TABS.find((t) => t.key === tabKey)!
  const series: any[] = (tabKey === 'meninggal'
    ? (resmi.tren_5_tahun_meninggal || []).map((t: any, i: number) => ({ tahun: t.tahun, jumlah: t.jumlah, krisis: resmi.tren_5_tahun_meninggal_krisis?.[i]?.jumlah }))
    : resmi[`tren_5_tahun_${tabKey}`] || [])
  const ratio = (a: number, b: number, d = 1) => (b ? Math.round((a / b) * 10 ** d) / 10 ** d : null)
  const lukaTotal = Number(tahun.luka_berat || 0) + Number(tahun.luka_ringan || 0)
  const indikator = [
    { label: 'Pengungsi per kejadian krisis', value: ratio(krisis.pengungsi, krisis.kejadian, 0), hint: 'Rata-rata jumlah pengungsi untuk setiap kejadian yang berdampak krisis kesehatan tahun 2026 (pengungsi ÷ kejadian berdampak krisis).' },
    { label: 'Terdampak per kejadian', value: ratio(tahun.terdampak, tahun.terpantau, 0), hint: 'Rata-rata penduduk terdampak untuk setiap kejadian terpantau tahun 2026.' },
    { label: 'Porsi luka yang dirawat inap', value: lukaTotal ? ratio(Number(tahun.luka_berat || 0) * 100, lukaTotal, 1) : null, unit: '%', hint: 'Persentase korban luka berat/rawat inap dari seluruh korban luka. Membantu memperkirakan kebutuhan tempat tidur rumah sakit.' },
    { label: 'Meninggal per 100 rb terdampak', value: ratio(Number(tahun.meninggal || 0) * 100000, tahun.terdampak, 1), hint: 'Jumlah korban meninggal untuk setiap 100.000 penduduk terdampak tahun 2026.' },
  ]
  const topPengungsi = [...rows].sort((a, b) => b.pengungsi - a.pengungsi).slice(0, 5)
  const topTerdampak = [...rows].sort((a, b) => b.terdampak - a.terdampak).slice(0, 5)
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3" data-testid="dampak-penduduk-krisis">
      <div className="lg:col-span-2">
        <Card eyebrow="Dampak terhadap penduduk" title="Tren 5 tahun korban, pengungsi, dan penduduk terdampak" desc="Semua kejadian terpantau dibanding yang berdampak krisis kesehatan. Sumber: dasbor Pantauan Bencana. Angka nasional.">
          <div className="mb-2 flex flex-wrap items-center gap-1">
            {DAMPAK_TABS.map((t) => (
              <button key={t.key} type="button" onClick={() => setTabKey(t.key)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${tabKey === t.key ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {t.label}
              </button>
            ))}
            <InfoHint text={cur.hint} label={`Penjelasan ${cur.label}`} />
          </div>
          <div className="h-52">
            {series.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="tahun" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={56} tickFormatter={(v) => nf(Number(v))} />
                  <Tooltip formatter={(v: any) => nf(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="jumlah" name="Semua kejadian" fill={cur.color} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="krisis" name="Kejadian berdampak krisis" fill={SLATE} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="py-12 text-center text-xs text-slate-500">Deret 5 tahun belum tersedia.</p>}
          </div>
          <p className="mt-1 text-[10px] text-slate-500">{`Tahun ${String(raw?.eoc?.fetched_at_wib || '').slice(0, 4) || 'berjalan'} masih berjalan (data API EOC sampai ${String(raw?.eoc?.fetched_at_wib || '').slice(0, 10) || 'hari ini'}).`}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
            {indikator.map((x) => <Stat key={x.label} label={x.label} value={x.value == null ? '—' : `${x.value.toLocaleString('id-ID')}${x.unit || ''}`} hint={x.hint} />)}
          </div>
        </Card>
      </div>
      <Card eyebrow="Dampak terhadap penduduk" title="Provinsi dengan pengungsi terbanyak" desc={filtered ? 'Filter wilayah aktif: daftar tetap memperlihatkan semua provinsi sebagai pembanding.' : 'Agregat 2026 per provinsi.'}>
        <ol className="space-y-1.5 text-xs">
          {topPengungsi.map((r, i) => (
            <li key={r.code} className="flex items-center justify-between gap-2">
              <span className="truncate font-semibold"><span className="mr-2 text-slate-400">{i + 1}</span>{r.nama}</span>
              <span className="tabular-nums text-slate-600">{nf(r.pengungsi)} pengungsi</span>
            </li>
          ))}
        </ol>
        <div className="mt-3 border-t border-slate-100 pt-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Penduduk terdampak terbanyak</div>
        <ol className="mt-1 space-y-1.5 text-xs">
          {topTerdampak.map((r, i) => (
            <li key={r.code} className="flex items-center justify-between gap-2">
              <span className="truncate font-semibold"><span className="mr-2 text-slate-400">{i + 1}</span>{r.nama}</span>
              <span className="tabular-nums text-slate-600">{nf(r.terdampak)} jiwa</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  )
}

export default function PuskrisSumberSections({
  raw, view, tab, bagian = null, kejadian, filteredWilayah = false,
}: {
  raw: any
  view: any
  tab: PuskrisTab
  bagian?: string | null
  kejadian: any[]
  filteredWilayah?: boolean
}) {
  const psc = raw.psc?.summary || {}
  const resmi = raw.eoc?.nasional || {}
  const tahun = resmi.kejadian_tahun || {}
  const pscLive = raw.psc?.data_source === 'langsung'
  const nccDays = view.ncc?.days || []
  const tck = view.sdm
  const tckS = raw.tck?.summary || {}
  const asis = raw.asistensi || {}
  const capP = asis.provinsi?.status_kapasitas || {}
  const capK = asis.kabupaten_kota?.status_kapasitas || {}
  const kelP = asis.provinsi?.kelengkapan || {}
  const kelK = asis.kabupaten_kota?.kelengkapan || {}
  const asisLive = asis.data_source === 'langsung' && Array.isArray(asis.wilayah)
  const asisRows: any[] = asisLive
    ? [...(bagian === 'kabupaten-kota' ? asis.wilayah_kabkota || [] : asis.wilayah || [])]
        .filter((r: any) => !view.selected || String(r.kd_prop || r.kode_wilayah).slice(0, 2) === view.selected.code)
        .sort((a: any, b: any) => b.poin_kapasitas_pct - a.poin_kapasitas_pct || String(a.nama).localeCompare(String(b.nama)))
    : []

  const eocLive = raw.eoc?.data_source === 'langsung' && Array.isArray(view.kejadianSemua)
  const evSemua: any[] = eocLive ? view.kejadianSemua : []
  const byKel = (list: any[], kel: string) => list.filter((k: any) => k.kelompok === kel).length
  const alam = eocLive ? [
    { nama: 'Alam', tahun: byKel(evSemua, 'Alam'), krisis: byKel(evSemua.filter((k) => k.krisis), 'Alam') },
    { nama: 'Non alam', tahun: byKel(evSemua, 'Non Alam'), krisis: byKel(evSemua.filter((k) => k.krisis), 'Non Alam') },
    { nama: 'Sosial', tahun: byKel(evSemua, 'Sosial'), krisis: byKel(evSemua.filter((k) => k.krisis), 'Sosial') },
  ] : [] as any[]
  const pscSplit = [
    { nama: 'Darurat', jumlah: psc.total_emergency || 0 },
    { nama: 'Non-darurat', jumlah: psc.total_non_emergency || 0 },
    { nama: 'Non-kategori', jumlah: psc.total_non_category || 0 },
  ]
  const topPsc = [...(view.rows || [])].sort((a: any, b: any) => b.panggilan - a.panggilan).slice(0, 8)
  const topTck = [...(view.rows || [])].sort((a: any, b: any) => b.tck - a.tck).slice(0, 8)
  const topEoc = [...(view.rows || [])].sort((a: any, b: any) => b.krisis - a.krisis).slice(0, 5)
  const bulanan = eocLive
    ? Object.values(evSemua.reduce((a: Record<string, any>, k: any) => {
        const b = (a[k.tanggal.slice(0, 7)] ||= { bulan: k.tanggal.slice(0, 7), kejadian: 0, krisis: 0, meninggal: 0 })
        b.kejadian++; b.krisis += k.krisis ? 1 : 0; b.meninggal += k.meninggal
        return a
      }, {})).sort((x: any, y: any) => x.bulan.localeCompare(y.bulan)).map((b: any) => ({ ...b, label: monthLabel(b.bulan) }))
    : []
  const eocSumber = eocLive ? `Sumber: API EOC Pusat Krisis (langsung, ${raw.eoc?.fetched_at_wib || '-'}), ${view.situasi?.sumber?.replace(/^API EOC Pusat Krisis \(langsung\), /, '') || ''}.` : ''
  const kelengkapanRows = ['Profil Umum', 'Kerentanan', 'Ancaman', 'Kapasitas'].map((k) => ({
    nama: k,
    provinsi: kelP[k]?.lengkap || 0,
    kabkot: kelK[k]?.lengkap || 0,
  }))
  const kapasitasStatus = ['Tinggi', 'Sedang', 'Rendah', 'Belum Mengisi'].map((k) => ({
    nama: k,
    provinsi: capP[k] || 0,
    kabkot: capK[k] || 0,
  }))

  const show = {
    ringkasan: tab === 'ringkasan',
    krisis: tab === 'ringkasan' || tab === 'krisis',
    psc: (tab === 'ringkasan' || tab === 'layanan') && (!bagian || bagian === 'psc'),
    ambulans: (tab === 'ringkasan' || tab === 'layanan') && (!bagian || bagian === 'ambulans'),
    ncc: (tab === 'ringkasan' || tab === 'layanan') && (!bagian || bagian === 'panggilan-119'),
    tck: (tab === 'ringkasan' || tab === 'kesiapsiagaan') && (!bagian || bagian === 'tenaga-cadangan'),
    logistik: (tab === 'ringkasan' || tab === 'kesiapsiagaan') && (!bagian || bagian === 'logistik'),
    asis: (tab === 'ringkasan' || tab === 'asistensi') && (!bagian || bagian === 'provinsi' || bagian === 'kabupaten-kota'),
  }

  return (
    <div className="space-y-6">
      {show.krisis && !eocLive ? <Card eyebrow="Pantauan bencana" title="Situasi krisis"><ApiKosong pesan="Data kejadian belum tersedia dari API EOC" detail={raw.eoc?.error} pending={Boolean(raw.eoc?.pending)} /></Card> : null}
      {show.krisis && eocLive && (
        <>
          {tab === 'krisis' ? <DampakPenduduk raw={raw} rows={view.rows || []} filtered={filteredWilayah} /> : null}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card eyebrow="Pantauan bencana" title="Jenis kejadian: Alam, Non alam, Sosial" desc={eocLive ? `Kejadian terpantau dan yang berdampak krisis menurut kelompok, mengikuti filter. ${eocSumber}` : ''}>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={alam}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="nama" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="tahun" name={eocLive ? 'Terpantau' : 'Tahun 2026'} fill={TEAL} />
                                        <Bar dataKey="krisis" name="Berdampak krisis" fill={ROSE} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card eyebrow="Pantauan bencana" title="Tren bulanan" desc={`Kejadian terpantau, berdampak krisis, dan meninggal per bulan, mengikuti filter. ${eocSumber}`}>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={bulanan}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="kejadian" name="Terpantau" stroke={TEAL} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="krisis" name="Krisis" stroke={AMBER} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="meninggal" name="Meninggal" stroke={ROSE} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card eyebrow="Pantauan bencana" title="Tren 5 tahun" desc={`Kejadian terpantau, berdampak krisis, dan meninggal nasional per tahun, dihitung dari API EOC (data_krisis per tahun, langsung).${resmi.tren_status === 'sebagian' ? ' Sebagian tahun lalu belum termuat.' : ''}`}>
              <div className="h-56">
                {!(resmi.tren_5_tahun_terpantau || []).length ? <ApiKosong pesan="Tren tahunan belum tersedia dari API EOC" detail={resmi.tren_status === 'memuat' ? 'Sedang mengambil data_krisis per tahun (cache 6 jam).' : null} pending={resmi.tren_status === 'memuat'} /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={(resmi.tren_5_tahun_terpantau || []).map((t: any, i: number) => ({
                    tahun: t.tahun,
                    terpantau: t.jumlah,
                    krisis: resmi.tren_5_tahun_krisis?.[i]?.jumlah,
                    meninggal: resmi.tren_5_tahun_meninggal?.[i]?.jumlah,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="tahun" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="terpantau" name="Terpantau" stroke={TEAL} strokeWidth={2} />
                    <Line type="monotone" dataKey="krisis" name="Krisis" stroke={AMBER} strokeWidth={2} />
                    <Line type="monotone" dataKey="meninggal" name="Meninggal" stroke={ROSE} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>)}
              </div>
            </Card>
            <Card eyebrow="Pantauan bencana" title="Lima provinsi teratas" desc={`Berdasarkan kejadian berdampak krisis pada periode terpilih. ${eocSumber}`}>
              <ol className="space-y-2 text-xs">
                {topEoc.map((r: any, i: number) => (
                  <li key={r.code} className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold"><span className="mr-2 text-slate-400">{i + 1}</span>{r.nama}</span>
                    <span className="tabular-nums text-slate-600">{nf(r.krisis)} krisis · {nf(r.kejadian)} terpantau</span>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        </>
      )}

      <>
          {show.psc && !pscLive ? <Card eyebrow="Layanan 119" title="PSC 119"><ApiKosong pesan="Data PSC 119 belum tersedia dari API" detail={raw.psc?.error} pending={Boolean(raw.psc?.pending)} /></Card> : null}
          {show.psc && pscLive && (
          <Card eyebrow="Layanan 119" title="PSC 119" desc={`Langsung dari API PSC 119 (${raw.psc?.fetched_at_wib || '-'}): ${raw.psc?.label || ''}. Panggilan = hitungan tahun berjalan; darurat/non-darurat ≈ proporsi sampel panggilan terbaru × total.`}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              <Stat label="Total panggilan" value={nf(psc.total_panggilan)} />
              <Stat label="≈ Darurat" value={nf(psc.total_emergency)} hint="Perkiraan: proporsi panggilan gawat darurat pada sampel panggilan terbaru dari API PSC 119 dikali total panggilan tahun ini." />
              <Stat label="≈ Non-darurat" value={nf(psc.total_non_emergency)} hint="Perkiraan dari sampel panggilan terbaru (API PSC 119)." />
              <Stat label="Waktu respons" value={psc.waktu_respons_rata_rata != null ? `${psc.waktu_respons_rata_rata} mnt` : '—'} />
              <Stat label="PSC" value={`${nf(psc.psc_aktif)} / ${nf(psc.total_psc)}`} sub="aktif / total" />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="h-56">
                <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">≈ Sampel panggilan per kategori</p>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={(raw.psc?.panggilan_sampel?.kategori || []).slice(0, 10)} layout="vertical" margin={{ left: 90 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="nama" tick={{ fontSize: 9 }} width={90} />
                    <Tooltip />
                    <Bar dataKey="jumlah" fill={TEAL} name="Panggilan" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="h-56">
                <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">≈ Sampel panggilan per sumber</p>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={(raw.psc?.panggilan_sampel?.sumber || []).slice(0, 10)} layout="vertical" margin={{ left: 90 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="nama" tick={{ fontSize: 9 }} width={90} />
                    <Tooltip />
                    <Bar dataKey="jumlah" fill={AMBER} name="Panggilan" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="mt-2">
              <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Provinsi dengan panggilan terbanyak</p>
              <ol className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
                {topPsc.map((r: any, i: number) => (
                  <li key={r.code} className="flex justify-between gap-2 rounded-lg px-2 py-1 hover:bg-slate-50">
                    <span>{i + 1}. {r.nama}</span>
                    <span className="tabular-nums font-bold">{nf(r.panggilan)} · {nf(r.pscAktif)}/{nf(r.pscTotal)} PSC</span>
                  </li>
                ))}
              </ol>
            </div>
          </Card>

          )}
          {show.ambulans && !pscLive ? <Card eyebrow="Layanan 119" title="Ambulans"><ApiKosong pesan="Data ambulans belum tersedia dari API PSC 119" detail={raw.psc?.error} pending={Boolean(raw.psc?.pending)} /></Card> : null}
          {show.ambulans && pscLive && (
          <Card eyebrow="Layanan 119" title="Ambulans" desc="Armada dari dasbor Ambulans / PSC: jenis gawat darurat vs transport, kondisi, dan yang ber-GPS.">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              <Stat label="Total armada" value={nf(psc.total_ambulan)} />
              <Stat label="Aktif" value={nf(psc.ambulans_aktif)} />
              <Stat label="Baik" value={nf(psc.ambulans_baik)} />
              <Stat label="Rusak ringan" value={nf(psc.ambulans_rusak_ringan)} />
              <Stat label="Rusak berat" value={nf(psc.ambulans_rusak_berat)} />
              <Stat label="Ber-GPS" value={nf(psc.ambulans_gps)} />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="h-48">
                <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Jenis armada (gawat darurat vs transport)</p>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={(raw.psc?.jenis_ambulans || []).map((x: any) => ({ ...x, nama: displayJenisArmada(x.nama) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="nama" tick={{ fontSize: 9 }} interval={0} angle={-15} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="jumlah" fill={BLUE} name="Unit" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="h-48">
                <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Kondisi armada</p>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={raw.psc?.kondisi_ambulans || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="nama" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="jumlah" name="Unit">
                      {(raw.psc?.kondisi_ambulans || []).map((x: any, i: number) => (
                        <Cell key={i} fill={x.nama === 'Baik' ? TEAL : x.nama?.includes('Berat') ? ROSE : AMBER} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>

          )}
          {show.ncc && (() => {
          const nc = view.ncc || {}
          const mmss = (d: any) => (d == null ? '–' : `${Math.floor(Number(d) / 60)}:${String(Math.round(Number(d) % 60)).padStart(2, '0')}`)
          const jam = (nc.perJam || []).map((x: any) => ({ ...x, label: x.interval_mulai }))
          return (
          <Card eyebrow="Layanan 119" title="Panggilan 119 (NCC)" desc={nc.live ? `Panggilan masuk, terjawab, dan tak terjawab (ditutup penelepon) di Pusat Panggilan Nasional 119, langsung dari API NCC (Apps Script, ${raw.ncc?.period?.label || ''}). Filter periode memotong rentang ini.${filteredWilayah ? ' ' + NASIONAL_NOTE : ''}` : 'Rekap panggilan 119 nasional dari API NCC (Apps Script).'}>
            {!nc.live ? (
              <ApiKosong pesan="Data NCC belum tersedia dari API" detail={nc.error} pending={Boolean(raw.ncc?.pending)} />
            ) : (<>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              <Stat label={NCC_LABEL.cof} value={nf(nc.totals?.cof)} />
              <Stat label={NCC_LABEL.acd} value={nf(nc.totals?.acd)} />
              <Stat label={NCC_LABEL.abd} value={nf(nc.totals?.abd)} />
              <Stat label={NCC_LABEL.scr} value={nc.totals?.scr != null ? pf(nc.totals.scr, 1) : '–'} hint={NCC_LABEL.scrHint} />
              <Stat label="Rata-rata penanganan" value={mmss(nc.totals?.aht)} sub="menit:detik" hint="Average Handling Time (AHT): rata-rata lama bicara ditambah kerja setelah panggilan, dibobot jumlah panggilan terjawab." />
              <Stat label="Kecepatan menjawab" value={mmss(nc.totals?.asa)} sub="menit:detik" hint="Average Speed of Answer (ASA): rata-rata waktu tunggu penelepon sampai dijawab petugas." />
              <Stat label="Hari terisi" value={nf(nc.days?.length)} sub={raw.ncc?.period?.label} />
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="h-56">
                <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Tren harian</p>
                <ResponsiveContainer width="100%" height="90%">
                  <LineChart data={nc.days || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="cof" name={NCC_LABEL.cof} stroke={SLATE} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="acd" name={NCC_LABEL.acd} stroke={TEAL} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="abd" name={NCC_LABEL.abd} stroke={ROSE} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="h-56">
                <p className="mb-1 flex items-center text-[10px] font-black uppercase tracking-wider text-slate-400">Pola per 30 menit (seluruh rentang API)<InfoHint text="Jumlah panggilan per slot 30 menit, dijumlah atas semua hari yang tersedia di API NCC. Tidak ikut filter periode." label="Penjelasan pola per 30 menit" /></p>
                {jam.length ? (
                <ResponsiveContainer width="100%" height="90%">
                  <BarChart data={jam}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 8 }} interval={3} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="acd" stackId="a" name={NCC_LABEL.acd} fill={TEAL} />
                    <Bar dataKey="abd" stackId="a" name={NCC_LABEL.abd} fill={ROSE} />
                  </BarChart>
                </ResponsiveContainer>
                ) : <ApiKosong compact pesan="Pola per 30 menit belum tersedia (tab Interval kosong; jalankan sinkronkan())" />}
              </div>
            </div>
            {nc.busiest ? <p className="mt-2 text-[10.5px] text-slate-500">Slot tersibuk: {nc.busiest.date} pukul {nc.busiest.time}{nc.busiest.time_end ? `–${nc.busiest.time_end}` : ''} WIB, {nf(nc.busiest.cof)} panggilan masuk ({nf(nc.busiest.acd)} terjawab).</p> : null}
            </>)}
          </Card>
          )
          })()}
      </>

      <>
          {show.tck && (() => {
          const tLive = raw.tck?.data_source === 'langsung'
          if (!tLive) return <Card eyebrow="Kesiapsiagaan SDM" title="Tenaga cadangan kesehatan"><ApiKosong pesan="Data Tenaga Cadangan belum tersedia dari API" detail={raw.tck?.error} pending={Boolean(raw.tck?.pending)} /></Card>
          const selP: any = view.selected ? (raw.tck?.provinsi || []).find((p: any) => String(p.code) === view.selected!.code) : null
          const profesiList: { nama: string; jumlah: number }[] = selP?.profesi
            ? Object.entries(selP.profesi).map(([nama, jumlah]) => ({ nama, jumlah: Number(jumlah) }))
            : raw.tck?.profesi || []
          const perempuan = selP ? selP.perempuan : tckS.perempuan
          const laki = selP ? selP.laki : tckS.laki
          const emtStd = selP ? selP.emt_standar : tckS.emt_standar
          const emtSk = selP ? selP.emt_sk : tckS.emt_sk
          const kabTop = selP?.kab ? [...selP.kab].sort((x: any, y: any) => y.n - x.n).slice(0, 10).map((k: any) => ({ nama: String(k.nama).replace(/^KAB(UPATEN)?\.?\s*/i, '').slice(0, 18), nakes: k.nakes, non: k.n - k.nakes })) : null
          const respon: { nama: string; jumlah: number }[] = raw.tck?.emt_rekap?.waktu_respon || []
          return (
          <Card eyebrow="Kesiapsiagaan SDM" title="Tenaga cadangan kesehatan"
            desc={tLive
              ? `Data langsung API Tenaga Cadangan Kesehatan (TCK), diambil ${raw.tck?.fetched_at_wib || '-'}: relawan per provinsi, profesi, tim, dan ${EMT_LABEL}${view.selected ? ` untuk ${view.selected.nama}` : ''}. Hanya angka agregat, tanpa data pribadi.`
              : ''}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
              <Stat label="Individu" value={nf(tck.individu)} sub={!view.selected && tckS.individu_bulan_ini ? `+${nf(tckS.individu_bulan_ini)} bulan ini` : undefined} />
              <Stat label={view.selected ? 'Tim (provinsi)' : 'Tim'} value={tck.tim == null ? '—' : nf(tck.tim)} sub={!view.selected && tckS.tim_bulan_ini ? `+${nf(tckS.tim_bulan_ini)} bulan ini` : undefined} />
              <Stat label={EMT_LABEL} value={tck.emt == null ? '—' : nf(tck.emt)} sub={!view.selected && tckS.emt_bulan_ini ? `+${nf(tckS.emt_bulan_ini)} bulan ini` : undefined} />
              {tLive && emtStd != null ? <Stat label="EMT memenuhi standar" value={nf(emtStd)} sub={emtSk != null ? `${nf(emtSk)} memiliki SK` : undefined} /> : null}
              <Stat label="Tenaga kesehatan" value={nf(tck.nakes)} />
              <Stat label="Non-kesehatan" value={nf(tck.nonNakes)} />
              {perempuan != null ? <Stat label="Perempuan" value={nf(perempuan)} sub={laki != null ? `laki-laki ${nf(laki)}` : undefined} /> : null}
              {!view.selected ? <Stat label="Individu bulan ini" value={nf(tckS.individu_bulan_ini)} sub={tckS.individu_bulan_lalu != null ? `bulan lalu ${nf(tckS.individu_bulan_lalu)}` : undefined} /> : null}
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="h-56">
                <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">{kabTop ? `Kab/kota teratas · ${view.selected!.nama}` : 'Sebaran provinsi (individu)'}</p>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={kabTop || topTck}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="nama" tick={{ fontSize: 9 }} interval={0} angle={-20} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey={kabTop ? 'nakes' : 'tckNakes'} name="Tenaga kesehatan" stackId="a" fill={TEAL} />
                    <Bar dataKey={kabTop ? 'non' : 'tckNonNakes'} name="Non-kesehatan" stackId="a" fill={AMBER} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {profesiList.length ? (
                <div className="h-56">
                  <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Relawan per golongan profesi{view.selected ? ` · ${view.selected.nama}` : ' · nasional'}</p>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={profesiList.map((x) => ({ ...x, nama: x.nama.replace(/^Tenaga (Kesehatan )?/, '') }))} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="nama" tick={{ fontSize: 9 }} width={110} />
                      <Tooltip />
                      <Bar dataKey="jumlah" name="Relawan" fill={BLUE} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : null}
            </div>
            {tLive && respon.length ? (
              <p className="mt-3 text-[11px] text-slate-500">
                Kesiapan berangkat {EMT_LABEL} (nasional): {respon.map((r) => `${r.nama === 'Belum Di Set' ? 'belum diisi' : r.nama.toLowerCase()} ${nf(r.jumlah)}`).join(' · ')}.
                {view.selected && selP ? ` Di ${view.selected.nama}: ${nf(selP.emt_respon_24 || 0)} EMT sanggup < 24 jam.` : ''}
              </p>
            ) : null}
          </Card>
          )
          })()}
          {show.logistik && (() => {
          const L = raw.logistik || {}
          const lLive = L.data_source === 'langsung'
          const selReg: any = lLive && view.selected ? (L.regional || []).find((r: any) => r.id === L.provinsi_regional?.[view.selected!.code]) : null
          const regRows: any[] = lLive ? (selReg ? [selReg] : L.regional || []) : []
          const S = selReg || L.summary || {}
          const perg = L.pergerakan || {}
          const bul: any[] = (selReg ? perg.per_regional_bulanan?.[selReg.id] : perg.bulanan) || []
          const tren = bul.filter((x: any) => x.bulan >= '2025-01').map((x: any) => ({ ...x, label: monthLabel(x.bulan) }))
          const kedal: any[] = (L.kedaluwarsa || []).filter((k: any) => !selReg || k.regional === selReg.nama.replace(' (DKI Jakarta)', '') || k.regional === selReg.nama).slice(0, 8)
          const katRows: any[] = selReg
            ? [['Obat-Obatan', 'obat'], ['BMHP', 'bmhp'], ['Alkes', 'alkes'], ['Sarpras', 'sarpras'], ['Lainnya', 'lainnya']].map(([nama, k]) => ({ nama, stok: selReg[k] || 0 }))
            : (L.kategori_rekap || []).map((k: any) => ({ nama: k.nama.replace(/ \(.*\)$/, ''), stok: k.stok }))
          if (!lLive) return <Card eyebrow="Logistik dan stok" title="Logistik kesehatan"><ApiKosong pesan="Data Logistik belum tersedia dari API" detail={raw.logistik?.error} pending={Boolean(raw.logistik?.pending)} /></Card>
          return (
          <Card eyebrow="Logistik dan stok" title="Logistik kesehatan"
            desc={`Data langsung API Logistik Kesehatan (SIMLOGKES), diambil ${L.fetched_at_wib || '-'}: stok akhir per regional dan kategori, barang kedaluwarsa, dan pergerakan stok.${selReg ? ` ${view.selected!.nama} dilayani gudang regional ${selReg.nama}.` : ''} Angka dalam satuan masing-masing barang (tablet, box, unit, dan lainnya) yang dijumlahkan.`}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <Stat label={selReg ? 'Stok regional' : 'Total stok'} value={nf(selReg ? selReg.total : S.total_stok)} sub={`${nf(selReg ? selReg.barang : S.jumlah_barang)} baris barang`} />
              <Stat label="Unit masuk" value={nf(selReg ? selReg.masuk : S.unit_masuk)} sub="semua transaksi tercatat" hint="Jumlah unit barang yang diterima gudang (transaksi_masuk) sejak stok awal." />
              <Stat label="Unit keluar" value={nf(selReg ? selReg.keluar : S.unit_keluar)} sub="semua transaksi tercatat" hint="Jumlah unit barang yang dikeluarkan gudang (transaksi_keluar): pemakaian institusi/dinas kesehatan dan pindah depo antarregional." />
              <Stat label="Sudah kedaluwarsa" value={nf(selReg ? selReg.kedaluwarsa : S.kedaluwarsa)} sub="barang masih bersisa stok" hint="Barang dengan tanggal kedaluwarsa sebelum hari ini dan stok akhir masih di atas nol. Hanya barang yang tanggal kedaluwarsanya diisi." />
              <Stat label="Kedaluwarsa ≤ 90 hari" value={nf(selReg ? selReg.segera_kedaluwarsa : S.segera_kedaluwarsa)} sub="perlu didistribusikan" />
              <Stat label={selReg ? 'Provinsi dilayani' : 'Regional'} value={selReg ? nf(selReg.wilayah?.length || 0) : nf(S.regional_count)} sub={selReg ? selReg.nama : 'gudang regional'} />
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="h-56">
                <p className="mb-1 flex items-center text-[10px] font-black uppercase tracking-wider text-slate-400">≈ Pergerakan stok bulanan (unit){selReg ? ` · ${selReg.nama}` : ''}<InfoHint text={`Perkiraan dari sampel ${perg.sampel_berhasil || 0} barang dengan transaksi terbesar (${perg.per_regional || 10} per regional), mencakup ±${(perg.cakupan_volume_pct || 0).toLocaleString('id-ID')}% volume transaksi. API pergerakan stok hanya bisa dibuka per barang.`} label="Penjelasan pergerakan stok" /></p>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={tren}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="penerimaan" name="Masuk" stroke={TEAL} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="pengeluaran" name="Keluar" stroke={AMBER} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="h-56">
                <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Stok per kategori{selReg ? ` · ${selReg.nama}` : ' · nasional'}</p>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={katRows} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="nama" tick={{ fontSize: 9 }} width={150} />
                    <Tooltip />
                    <Bar dataKey="stok" name="Stok akhir" fill={BLUE} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-5">
              <div className="overflow-x-auto lg:col-span-3">
                <table className="min-w-full text-xs">
                  <thead className="text-left text-[10px] font-black uppercase text-slate-500">
                    <tr>{['Regional', 'Obat', 'BMHP', 'Alkes', 'Sarpras', 'Lainnya', 'Total', 'Kedaluwarsa'].map((h) => <th key={h} className="pb-2 pr-3">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {regRows.map((r: any) => (
                      <tr key={r.id} className="border-t border-slate-100">
                        <td className="py-1.5 pr-3 font-semibold">{r.nama}</td>
                        {['obat', 'bmhp', 'alkes', 'sarpras', 'lainnya'].map((k) => <td key={k} className="py-1.5 pr-3 tabular-nums">{nf(r[k])}</td>)}
                        <td className="py-1.5 pr-3 tabular-nums font-bold">{nf(r.total)}</td>
                        <td className={`py-1.5 pr-3 tabular-nums ${r.kedaluwarsa ? 'font-bold text-rose-700' : ''}`}>{nf(r.kedaluwarsa)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-1 text-[10px] text-slate-400">BMHP = Bahan Medis Habis Pakai; Alkes = Alat Kesehatan; Sarpras = Sarana dan Prasarana. Stok negatif di sumber ({nf(S.stok_negatif || 0)} baris) dihitung nol.</p>
              </div>
              <div className="lg:col-span-2">
                <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Kedaluwarsa terdekat (≤ 90 hari / lewat)</p>
                <ul className="space-y-1 text-[11px]">
                  {kedal.length ? kedal.map((k: any, i: number) => (
                    <li key={i} className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1">
                      <span className="min-w-0 truncate"><span className="font-semibold">{k.nama}</span> <span className="text-slate-400">· {k.regional}</span></span>
                      <span className={`shrink-0 tabular-nums ${k.lewat ? 'font-bold text-rose-700' : 'text-amber-700'}`}>{k.expired} · {nf(k.stok)} {k.satuan}</span>
                    </li>
                  )) : <li className="text-slate-400">Tidak ada.</li>}
                </ul>
                {(perg.jenis_pengeluaran || []).length ? (
                  <p className="mt-2 text-[10px] text-slate-500">≈ Tujuan pengeluaran (sampel): {(perg.jenis_pengeluaran || []).slice(0, 3).map((j: any) => `${j.nama} ${nf(j.jumlah)}`).join(' · ')}.</p>
                ) : null}
              </div>
            </div>
          </Card>
          )
          })()}
      </>

      {show.asis && !asisLive ? <Card eyebrow="Asesmen risiko" title="Asistensi risiko"><ApiKosong pesan="Data Asistensi Risiko belum tersedia dari API" detail={raw.asistensi?.error} pending={Boolean(raw.asistensi?.pending)} /></Card> : null}
      {show.asis && asisLive && (
        <Card eyebrow="Asesmen risiko" title="Asistensi risiko" desc={asisLive ? `Rekapitulasi Asistensi ${asis.tahun}, diambil langsung ${asis.fetched_at_wib || ''}. Poin dan status kapasitas serta status Indeks Risiko Bencana Indonesia per wilayah dari API resmi; kelengkapan per modul belum tersedia di API.` : ''}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Provinsi mengisi" value={`${nf(asis.cakupan?.provinsi_mengisi_kapasitas)} / ${nf(asis.cakupan?.provinsi_total)}`} sub={pf(asis.cakupan?.provinsi_pct)} />
            <Stat label="Kab/kota mengisi" value={`${nf(asis.cakupan?.kabkot_mengisi_kapasitas)} / ${nf(asis.cakupan?.kabkot_total)}`} sub={pf(asis.cakupan?.kabkot_pct)} />
            {asisLive ? <Stat label="Provinsi risiko tinggi" value={`${asis.provinsi?.irbi?.Tinggi ?? 0} / ${nf(asis.provinsi?.total)}`} sub="Indeks Risiko Bencana Indonesia" hint={IRBI_HINT} /> : null}
            {asisLive ? <Stat label="Kab/kota risiko tinggi" value={`${asis.kabupaten_kota?.irbi?.Tinggi ?? 0} / ${nf(asis.kabupaten_kota?.total)}`} sub="Indeks Risiko Bencana Indonesia" hint={IRBI_HINT} /> : null}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="h-52">
              <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Status kapasitas</p>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={kapasitasStatus}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="nama" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="provinsi" name="Provinsi" fill={TEAL} />
                  <Bar dataKey="kabkot" name="Kab/Kota" fill={AMBER} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="h-52">
              <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Kelengkapan modul (yang lengkap)</p>
              {Object.keys(kelP).length || Object.keys(kelK).length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={kelengkapanRows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="nama" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="provinsi" name="Provinsi" fill={TEAL} />
                  <Bar dataKey="kabkot" name="Kab/Kota" fill={BLUE} />
                </BarChart>
              </ResponsiveContainer>
              ) : <ApiKosong pesan="Kelengkapan per modul belum tersedia dari API Asistensi" />}
            </div>
          </div>
          <div className="mt-3 max-h-80 overflow-auto">
            {asisLive ? <p className="mb-1 text-[10px] text-slate-500">{asisRows.length} {bagian === 'kabupaten-kota' ? 'kab/kota' : 'provinsi'}{view.selected ? ` di ${view.selected.nama}` : ''}, urut poin kapasitas tertinggi. Rincian lengkap ada di Analisis &amp; Matriks.</p> : null}
            <table className="min-w-full text-xs">
              <thead className="sticky top-0 bg-white text-left text-[10px] font-black uppercase text-slate-500">
                <tr>{['Wilayah', 'Poin kapasitas', 'Status', IRBI_LABEL].map((h) => <th key={h} className="pb-2 pr-4">{h}{h.startsWith('Indeks Risiko') ? <InfoHint text={IRBI_HINT} /> : null}</th>)}</tr>
              </thead>
              <tbody>
                {asisRows.map((r: any) => (
                  <tr key={r.kode_wilayah} className="border-t border-slate-100">
                    <td className="py-2 pr-4 font-semibold">{r.nama}</td>
                    <td className="py-2 pr-4 tabular-nums">{r.poin_kapasitas_pct}%</td>
                    <td className="py-2 pr-4">{r.status_kapasitas}</td>
                    <td className="py-2 pr-4">{r.status_risiko_irbi_2024 || r.status_risiko_irbi}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <section className="skdr-section">
        <SectionHead eyebrow="Daftar kejadian" title="Kejadian krisis terbaru" desc="Mengikuti filter periode, provinsi, kabupaten, dan jenis kejadian." />
        <div className="skdr-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">
              <tr>{['Tanggal', 'Jenis', 'Provinsi', 'Kabupaten', 'Terdampak', 'Meninggal', 'Pengungsi'].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr>
            </thead>
            <tbody>
              {kejadian.slice(0, 25).map((k: any, i: number) => (
                <tr key={`${k.tanggal}-${k.jenis}-${i}`} className="border-t border-slate-100">
                  <td className="whitespace-nowrap px-3 py-2">{k.tanggal}</td>
                  <td className="px-3 py-2">{k.jenis}</td>
                  <td className="px-3 py-2">{k.provinsi}</td>
                  <td className="px-3 py-2">{k.kabupaten}</td>
                  <td className="px-3 py-2 tabular-nums">{nf(k.terdampak)}</td>
                  <td className="px-3 py-2 tabular-nums">{nf(k.meninggal)}</td>
                  <td className="px-3 py-2 tabular-nums">{nf(k.pengungsi)}</td>
                </tr>
              ))}
              {!kejadian.length && <tr><td className="px-3 py-6 text-slate-500" colSpan={7}>Tidak ada kejadian pada filter ini.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      </section>
    </div>
  )
}
