'use client'

import { nf, pf } from '@/lib/puskris/derive'
import type { PuskrisTab } from '@/lib/puskris/ui-filter'
import { monthLabel } from '@/lib/puskris/to-spasial'
import SectionHead from '@/components/puskris/SectionHead'
import InfoHint from '@/components/puskris/InfoHint'
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
          <p className="mt-1 text-[10px] text-slate-500">2026 masih berjalan (data sampai pertengahan November).</p>
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
  const eoc = view.situasi
  const resmi = raw.eoc?.nasional || {}
  const tahun = resmi.kejadian_tahun || {}
  const okt = resmi.kejadian_oktober || {}
  const krisisY = resmi.krisis_tahun || {}
  const nccDays = view.ncc?.days || []
  const tck = view.sdm
  const tckS = raw.tck?.summary || {}
  const asis = raw.asistensi || {}
  const capP = asis.provinsi?.status_kapasitas || {}
  const capK = asis.kabupaten_kota?.status_kapasitas || {}
  const kelP = asis.provinsi?.kelengkapan || {}
  const kelK = asis.kabupaten_kota?.kelengkapan || {}

  const alam = [
    { nama: 'Alam', tahun: tahun.alam || 0, oktober: okt.alam || 0, krisis: krisisY.alam || 0 },
    { nama: 'Non alam', tahun: tahun.non_alam || 0, oktober: okt.non_alam || 0, krisis: krisisY.non_alam || 0 },
    { nama: 'Sosial', tahun: tahun.sosial || 0, oktober: okt.sosial || 0, krisis: krisisY.sosial || 0 },
  ]
  const pscSplit = [
    { nama: 'Darurat', jumlah: psc.total_emergency || 0 },
    { nama: 'Non-darurat', jumlah: psc.total_non_emergency || 0 },
    { nama: 'Non-kategori', jumlah: psc.total_non_category || 0 },
  ]
  const topPsc = [...(view.rows || [])].sort((a: any, b: any) => b.panggilan - a.panggilan).slice(0, 8)
  const topTck = [...(view.rows || [])].sort((a: any, b: any) => b.tck - a.tck).slice(0, 8)
  const topEoc = [...(view.rows || [])].sort((a: any, b: any) => b.krisis - a.krisis).slice(0, 5)
  const bulanan = (raw.eoc?.bulanan_2026 || []).map((b: any) => ({ ...b, label: monthLabel(b.bulan) }))
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
      {show.krisis && (
        <>
          <Card eyebrow="Pantauan bencana" title="Situasi krisis kesehatan" desc="Angka resmi dashboard Pantauan Bencana / EOC. Filter 7/30 hari tidak memecah KPI tahunan ini.">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-9">
              <Stat label="Terpantau" value={nf(eoc.terpantau)} />
              <Stat label="Berdampak krisis" value={nf(eoc.berdampak_krisis)} />
              <Stat label="Meninggal" value={nf(eoc.meninggal)} />
              <Stat label="Hilang" value={eoc.hilang == null ? '—' : nf(eoc.hilang)} sub={eoc.hilang == null ? NASIONAL_NOTE : undefined} hint={KORBAN_LABEL.hilangHint} />
              <Stat label="Luka berat / rawat inap" value={eoc.luka_berat == null ? '—' : nf(eoc.luka_berat)} sub={eoc.luka_berat == null ? NASIONAL_NOTE : 'LB/RI'} hint={KORBAN_LABEL.lbHint} />
              <Stat label="Luka ringan / rawat jalan" value={eoc.luka_ringan == null ? '—' : nf(eoc.luka_ringan)} sub={eoc.luka_ringan == null ? NASIONAL_NOTE : 'LR/RJ'} hint={KORBAN_LABEL.lrHint} />
              <Stat label="Pengungsi" value={nf(eoc.pengungsi)} hint={KORBAN_LABEL.pengungsiHint} />
              <Stat label="Penduduk terdampak" value={nf(eoc.terdampak)} hint={KORBAN_LABEL.terdampakHint} />
              <Stat label="Korban total" value={eoc.korban_total == null ? '—' : nf(eoc.korban_total)} sub={eoc.korban_total == null ? NASIONAL_NOTE : undefined} hint={KORBAN_LABEL.totalHint} />
            </div>
          </Card>
          {tab === 'krisis' ? <DampakPenduduk raw={raw} rows={view.rows || []} filtered={filteredWilayah} /> : null}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card eyebrow="Pantauan bencana" title="Jenis kejadian: Alam, Non alam, Sosial" desc="Pembagian resmi tahun 2026, dibanding Oktober, dan yang berdampak krisis.">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={alam}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="nama" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="tahun" name="Tahun 2026" fill={TEAL} />
                    <Bar dataKey="oktober" name="Oktober" fill={AMBER} />
                    <Bar dataKey="krisis" name="Berdampak krisis" fill={ROSE} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card eyebrow="Pantauan bencana" title="Tren bulanan 2026" desc="Kejadian terpantau, berdampak krisis, dan meninggal per bulan (sumber resmi; Sep–Okt belum muncul di snapshot).">
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
            <Card eyebrow="Pantauan bencana" title="Tren 5 tahun" desc="Kejadian terpantau, berdampak krisis, dan meninggal menurut dashboard EOC.">
              <div className="h-56">
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
                </ResponsiveContainer>
              </div>
            </Card>
            <Card eyebrow="Pantauan bencana" title="Lima provinsi teratas" desc="Berdasarkan kejadian berdampak krisis 2026. Oktober resmi: terpantau dan krisis terpisah di sumber.">
              <ol className="space-y-2 text-xs">
                {topEoc.map((r: any, i: number) => (
                  <li key={r.code} className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold"><span className="mr-2 text-slate-400">{i + 1}</span>{r.nama}</span>
                    <span className="tabular-nums text-slate-600">{nf(r.krisis)} krisis · {nf(r.kejadian)} terpantau</span>
                  </li>
                ))}
              </ol>
              {resmi.top_provinsi_oktober_krisis?.length ? (
                <p className="mt-3 text-[11px] text-slate-500">Oktober (resmi): {resmi.top_provinsi_oktober_krisis.map((x: any) => `${x.nama} (${nf(x.jumlah)})`).join(', ')}.</p>
              ) : null}
            </Card>
          </div>
        </>
      )}

      <>
          {show.psc && (
          <Card eyebrow="Layanan 119" title="PSC 119" desc="Kumulatif dari dasbor PSC. Tidak mengikuti filter periode. Waktu respons rata-rata dan jumlah PSC ikut snapshot yang sama.">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              <Stat label="Total panggilan" value={nf(psc.total_panggilan)} />
              <Stat label="Darurat" value={nf(psc.total_emergency)} />
              <Stat label="Non-darurat" value={nf(psc.total_non_emergency)} />
              <Stat label="Non-kategori" value={nf(psc.total_non_category)} />
              <Stat label="Waktu respons" value={`${psc.waktu_respons_rata_rata ?? '—'} mnt`} />
              <Stat label="PSC" value={`${nf(psc.psc_aktif)} / ${nf(psc.total_psc)}`} sub="aktif / total" />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="h-56">
                <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Panggilan per jenis</p>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={(raw.psc?.jenis_panggilan || []).slice(0, 10)} layout="vertical" margin={{ left: 90 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="nama" tick={{ fontSize: 9 }} width={90} />
                    <Tooltip />
                    <Bar dataKey="jumlah" fill={TEAL} name="Panggilan" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="h-56">
                <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Panggilan per spesifikasi</p>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={(raw.psc?.spesifikasi || []).slice(0, 10)} layout="vertical" margin={{ left: 90 }}>
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
          {show.ambulans && (
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
          {show.ncc && (
          <Card eyebrow="Layanan 119" title="Panggilan 119 (NCC)" desc={`Panggilan masuk, terjawab, dan tak terjawab (ditutup penelepon), plus tingkat keberhasilan layanan. Snapshot November 2026; filter 7/30 hari memotong rentang ini.${filteredWilayah ? " " + NASIONAL_NOTE : ""}`}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Stat label={NCC_LABEL.cof} value={nf(view.ncc?.totals?.cof)} />
              <Stat label={NCC_LABEL.acd} value={nf(view.ncc?.totals?.acd)} />
              <Stat label={NCC_LABEL.abd} value={nf(view.ncc?.totals?.abd)} />
              <Stat label={NCC_LABEL.scr} value={view.ncc?.totals?.scr != null ? pf(view.ncc.totals.scr, 1) : '0'} hint={NCC_LABEL.scrHint} />
              <Stat label="Hari terisi" value={nf(raw.ncc?.totals?.hari_tersedia)} sub={raw.ncc?.period?.label} />
            </div>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={nccDays}>
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
          </Card>
          )}
      </>

      <>
          {show.tck && (
          <Card eyebrow="Kesiapsiagaan SDM" title="Tenaga cadangan kesehatan" desc={`Kartu KPI publik TCK: individu, tim, dan ${EMT_LABEL}, plus nakes vs non-nakes dari sebaran geojson. Data pengalaman dan pelatihan tidak ada di snapshot ini.`}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              <Stat label="Individu" value={nf(tck.individu)} sub={tckS.individu_delta_bulan ? `+${nf(tckS.individu_delta_bulan)} bulan ini` : undefined} />
              <Stat label="Tim" value={tck.tim == null ? '—' : nf(tck.tim)} sub={tckS.tim_delta_bulan ? `+${nf(tckS.tim_delta_bulan)}` : undefined} />
              <Stat label={EMT_LABEL} value={tck.emt == null ? '0' : nf(tck.emt)} sub={tckS.emt_delta_bulan ? `+${nf(tckS.emt_delta_bulan)}` : undefined} />
              <Stat label="Nakes" value={nf(tck.nakes)} />
              <Stat label="Non-nakes" value={nf(tck.nonNakes)} />
              <Stat label="Individu bulan ini" value={nf(tckS.individu_bulan_ini)} />
            </div>
            <div className="mt-4 h-56">
              <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Sebaran provinsi (individu)</p>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topTck}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="nama" tick={{ fontSize: 9 }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="tckNakes" name="Nakes" stackId="a" fill={TEAL} />
                  <Bar dataKey="tckNonNakes" name="Non-nakes" stackId="a" fill={AMBER} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          )}
          {show.logistik && (
          <Card eyebrow="Logistik dan stok" title="Logistik" desc="Stok, penerimaan, dan pengeluaran dari landing SIMLOGKES, plus matriks 11 regional × Obat / Sarpras / Alkes / BMHP. Bukan 38 provinsi.">
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Total stok" value={nf(view.logistik.totalStok)} />
              <Stat label="Penerimaan" value={view.logistik.penerimaan == null ? '—' : nf(view.logistik.penerimaan)} />
              <Stat label="Pengeluaran" value={view.logistik.pengeluaran == null ? '—' : nf(view.logistik.pengeluaran)} />
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="text-left text-[10px] font-black uppercase text-slate-500">
                  <tr>{['Regional', 'Obat', 'Sarpras', 'Alkes', 'BMHP', 'Total'].map((h) => <th key={h} className="pb-2 pr-3">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {(view.logistik.rows || []).map((r: any) => (
                    <tr key={r.code} className="border-t border-slate-100">
                      <td className="py-1.5 pr-3 font-semibold">{r.nama}</td>
                      <td className="py-1.5 pr-3 tabular-nums">{nf(r.obat)}</td>
                      <td className="py-1.5 pr-3 tabular-nums">{nf(r.sarpras)}</td>
                      <td className="py-1.5 pr-3 tabular-nums">{nf(r.alkes)}</td>
                      <td className="py-1.5 pr-3 tabular-nums">{nf(r.bmhp)}</td>
                      <td className="py-1.5 pr-3 tabular-nums font-bold">{nf(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          )}
      </>

      {show.asis && (
        <Card eyebrow="Asesmen risiko" title="Asistensi risiko" desc="Snapshot manual 16 November 2026 (sumber butuh login). Yang diutamakan: cakupan pengisian status kapasitas dan kelengkapan modul, di provinsi dan kab/kota.">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Provinsi mengisi" value={`${asis.cakupan?.provinsi_mengisi_kapasitas ?? 5} / ${asis.cakupan?.provinsi_total ?? 38}`} sub={`${asis.cakupan?.provinsi_pct ?? 13.2}%`} />
            <Stat label="Kab/kota mengisi" value={`${asis.cakupan?.kabkot_mengisi_kapasitas ?? 77} / ${asis.cakupan?.kabkot_total ?? 514}`} sub={`${asis.cakupan?.kabkot_pct ?? 15}%`} />
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
            </div>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="text-left text-[10px] font-black uppercase text-slate-500">
                <tr>{['Wilayah', 'Poin kapasitas', 'Status', IRBI_LABEL + ' 2024'].map((h) => <th key={h} className="pb-2 pr-4">{h}{h.startsWith('Indeks Risiko') ? <InfoHint text={IRBI_HINT} /> : null}</th>)}</tr>
              </thead>
              <tbody>
                {(asis.contoh_wilayah || []).map((r: any) => (
                  <tr key={r.kode_wilayah} className="border-t border-slate-100">
                    <td className="py-2 pr-4 font-semibold">{r.nama}</td>
                    <td className="py-2 pr-4 tabular-nums">{r.poin_kapasitas_pct}%</td>
                    <td className="py-2 pr-4">{r.status_kapasitas}</td>
                    <td className="py-2 pr-4">{r.status_risiko_irbi_2024}</td>
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
