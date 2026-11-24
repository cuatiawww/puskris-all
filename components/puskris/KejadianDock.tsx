'use client'

import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import ApiKosong from '@/components/puskris/ApiKosong'
import { fmtAngka, tglKejadian } from '@/lib/puskris/eoc-markers'

function nf(n: number | null | undefined, satuan?: string) {
  if (n == null || Number.isNaN(Number(n))) return '—'
  const s = Number(n).toLocaleString('id-ID', { maximumFractionDigits: 1 })
  return satuan ? `${s} ${satuan}` : s
}

const TONE: Record<string, string> = {
  rose: 'bg-rose-700 text-white',
  amber: 'bg-amber-500 text-slate-900',
  teal: 'bg-teal-700 text-white',
  slate: 'bg-slate-600 text-white',
}
const PRI: Record<string, string> = {
  tinggi: 'border-rose-200 bg-rose-50',
  sedang: 'border-amber-200 bg-amber-50',
  info: 'border-slate-200 bg-slate-50',
}

function Pill({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${className}`}>{children}</span>
}

function RangeBtn({ options, value, onChange }: { options: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button key={o.id} type="button" onClick={() => onChange(o.id)}
          className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${value === o.id ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export default function KejadianSituasiDock({ k, status, rekomendasi }: { k: any; status?: any; rekomendasi?: any[] }) {
  const rekom = rekomendasi || []
  return (
    <div className="space-y-3 p-3" data-testid="kejadian-dock-situasi">
      <div>
        <div className="flex items-center gap-2">
          {k?.icon?.src ? <img alt="" aria-hidden src={k.icon.src} className="h-8 w-7 object-contain" /> : null}
          <div className="min-w-0">
            <h3 className="truncate text-sm font-black text-slate-900">{k?.jenis || 'Kejadian'}</h3>
            <p className="truncate text-[11px] text-slate-500">{[k?.kabupaten, k?.provinsi].filter(Boolean).join(', ') || 'Lokasi belum tersedia dari API'}</p>
          </div>
        </div>
        <p className="mt-1 text-[11px] font-semibold text-slate-700">{tglKejadian(k?.tanggal, k?.jam)}</p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {status?.label ? <Pill className={TONE[status.tone] || TONE.slate}>{status.label}</Pill> : null}
          <Pill className={k?.krisis ? 'bg-rose-700 text-white' : 'bg-teal-700 text-white'}>{k?.krisis ? 'Krisis kesehatan' : 'Terpantau'}</Pill>
          {status?.hari != null ? <Pill className="bg-slate-100 text-slate-700">{status.hari} hari sejak kejadian</Pill> : null}
        </div>
        {status?.catatan ? <p className="mt-1 text-[10px] leading-snug text-slate-400">{status.catatan}</p> : null}
        <p className="mt-1 text-[10px] text-slate-400">Pembaruan terakhir dari API EOC: belum tersedia dari API.</p>
      </div>

      <dl className="space-y-1 text-[11px]">
        <div className="flex justify-between gap-2 border-b border-slate-100 py-0.5"><dt className="text-slate-500">Koordinat</dt><dd className="text-right font-semibold text-slate-800">{k?.koordinat?.lat != null ? `${k.koordinat.lat.toFixed(5)}, ${k.koordinat.lon.toFixed(5)}` : 'Belum tersedia dari API'}</dd></div>
        <div className="flex justify-between gap-2 border-b border-slate-100 py-0.5"><dt className="text-slate-500">Sumber lokasi</dt><dd className="text-right font-semibold text-slate-800">{k?.koordinat?.label || '—'}</dd></div>
        <div className="flex justify-between gap-2 py-0.5"><dt className="text-slate-500">Faskes rusak</dt><dd className="font-black tabular-nums text-slate-900">{fmtAngka(k?.faskes_rusak || 0)}</dd></div>
      </dl>

      <div>
        <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Aksi / rekomendasi</p>
        {rekom.length ? (
          <ul className="space-y-1.5">
            {rekom.map((r, i) => (
              <li key={i} className={`rounded-lg border px-2 py-1.5 ${PRI[r.prioritas] || PRI.info}`}>
                <p className="text-[11px] font-bold text-slate-800">{r.judul}</p>
                <p className="text-[10px] leading-snug text-slate-500">{r.dasar}</p>
              </li>
            ))}
          </ul>
        ) : <p className="text-[11px] text-slate-500">Tidak ada rekomendasi yang merujuk ke angka di halaman ini.</p>}
        <p className="mt-1 text-[10px] text-slate-400">Disusun dari aturan data, bukan instruksi resmi.</p>
      </div>
    </div>
  )
}

export function KejadianKesiapanDock({ nearby }: { nearby?: any }) {
  if (!nearby) return <div className="p-3"><ApiKosong compact pesan="Data kesiapan menunggu API" /></div>
  const psc = nearby.psc
  const amb = nearby.ambulans
  const rs = nearby.rs
  const tck = nearby.tck
  const log = nearby.logistik
  return (
    <div className="space-y-3 p-3" data-testid="kejadian-dock-kesiapan">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Dalam radius {nearby.radius_km || 50} km · API Pusat Krisis</p>
      <div className="grid grid-cols-2 gap-1.5">
        {[
          ['PSC 119', psc?.tersedia ? `${nf(psc.aktif)}/${nf(psc.total)} aktif` : null],
          ['Ambulans', amb?.tersedia ? `${nf(amb.siap)}/${nf(amb.total)} siap` : null],
          ['RS jejaring', rs?.tersedia ? nf(rs.total) : null],
          ['TCK provinsi', tck?.tersedia ? nf(tck.individu) : null],
        ].map(([l, v]) => (
          <div key={String(l)} className="rounded-lg bg-slate-50 px-2 py-1.5">
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{l}</div>
            <div className="text-sm font-black tabular-nums text-slate-900">{v || '—'}</div>
          </div>
        ))}
      </div>
      {psc?.tersedia && psc.daftar?.length ? (
        <ul className="space-y-1">
          {psc.daftar.map((p: any, i: number) => (
            <li key={i} className="flex items-baseline justify-between gap-2 text-[11px]">
              <span className="min-w-0 truncate font-semibold text-slate-700">{p.nama}{p.aktif ? '' : ' (nonaktif)'}</span>
              <span className="shrink-0 tabular-nums text-slate-500">{p.jarak_km != null ? `${nf(p.jarak_km)} km` : '—'}</span>
            </li>
          ))}
        </ul>
      ) : psc && !psc.tersedia ? <ApiKosong compact pesan="Data PSC belum tersedia dari API" /> : <p className="text-[11px] text-slate-500">Tidak ada PSC berkoordinat dalam radius.</p>}
      {rs?.catatan ? <p className="text-[10px] text-slate-400">{rs.catatan}</p> : null}
      {tck?.tersedia ? (
        <p className="text-[11px] text-slate-600">Tenaga cadangan {tck.provinsi}: {nf(tck.individu)} orang ({nf(tck.nakes)} nakes, {nf(tck.non_nakes)} non-nakes). API TCK tidak mengirim koordinat, jadi tidak ditampilkan sebagai titik di peta.</p>
      ) : <p className="text-[11px] text-slate-500">Data TCK belum tersedia dari API.</p>}
      {log?.tersedia ? (
        <p className="text-[11px] text-slate-600">Stok logistik regional {log.nama}: {nf(log.total)}. {log.catatan} Gudang tidak punya koordinat di API, jadi tidak ditampilkan sebagai titik.</p>
      ) : <p className="text-[11px] text-slate-500">Data logistik belum tersedia dari API.</p>}
    </div>
  )
}

export function KejadianRisikoDock({ risiko, pieKab, onShowAsis, onShowPie }: { risiko?: any; pieKab?: { disease: string; status: string }[] | null; onShowAsis?: (mode: 'irbi' | 'kapasitas') => void; onShowPie?: () => void }) {
  return (
    <div className="space-y-3 p-3" data-testid="kejadian-dock-risiko">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Asistensi, IRBI, PIE</p>
      {risiko?.tersedia ? (
        <dl className="space-y-1 text-[11px]">
          <div className="flex justify-between gap-2"><dt className="text-slate-500">Wilayah</dt><dd className="font-semibold">{risiko.nama} · {risiko.level}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-slate-500">Kapasitas</dt><dd className="font-black">{risiko.kapasitas || '—'}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-slate-500">IRBI</dt><dd className="font-black">{risiko.irbi || '—'}</dd></div>
          {risiko.poin != null ? <div className="flex justify-between gap-2"><dt className="text-slate-500">Poin kapasitas</dt><dd className="tabular-nums font-semibold">{nf(risiko.poin)}%</dd></div> : null}
        </dl>
      ) : <ApiKosong compact pesan={risiko?.catatan || 'Data Asistensi/IRBI belum tersedia dari API'} />}
      <div className="flex flex-wrap gap-1">
        {onShowAsis ? (
          <>
            <button type="button" onClick={() => onShowAsis('irbi')} className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-200">Arsiran IRBI</button>
            <button type="button" onClick={() => onShowAsis('kapasitas')} className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-200">Arsiran kapasitas</button>
          </>
        ) : null}
        {onShowPie ? <button type="button" onClick={onShowPie} className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-200">Arsiran PIE</button> : null}
      </div>
      {pieKab && pieKab.length ? (
        <ul className="space-y-0.5 text-[11px]">
          {pieKab.slice(0, 8).map((p) => (
            <li key={p.disease} className="flex justify-between gap-2"><span className="truncate text-slate-600">{p.disease}</span><span className="font-bold">{p.status}</span></li>
          ))}
        </ul>
      ) : <p className="text-[11px] text-slate-500">Data PIE untuk kab/kota ini belum dimuat atau belum tersedia dari API.</p>}
    </div>
  )
}

export function KejadianAnalitikDock({ riwayat, konteks, layers, size = 'dock' }: { riwayat?: any; konteks?: any; layers?: { fires?: boolean; hujan?: boolean; riwayat?: boolean }; size?: 'dock' | 'page' }) {
  const chartH = size === 'page' ? 'h-52' : 'h-32'
  const [rentangRiwayat, setRentangRiwayat] = useState<'30h' | '12bln'>('12bln')
  const [rentangCuaca, setRentangCuaca] = useState<'7j' | '30h'>('7j')
  const showRiwayat = layers?.riwayat !== false
  const showHujan = layers?.hujan !== false
  const showFirms = layers?.fires !== false

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

  const firmsData = useMemo(() => (konteks?.karhutla?.tren || []).map((r: any) => ({ label: String(r.tanggal || '').slice(5), n: r.n })), [konteks])

  return (
    <div className="space-y-4 p-3" data-testid="kejadian-dock-analitik">
      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Riwayat kejadian</p>
          <RangeBtn value={rentangRiwayat} onChange={(id) => setRentangRiwayat(id as any)} options={[{ id: '30h', label: '30 hari' }, { id: '12bln', label: '12 bulan' }]} />
        </div>
        {showRiwayat && riwayatData.length ? (
          <div className={chartH}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riwayatData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey={rentangRiwayat === '30h' ? 'kab' : 'kab'} name="Kab/kota" fill="#00705a" radius={[2, 2, 0, 0]} />
                <Bar dataKey="serupa_kab" name="Sejenis" fill="#0ea5e9" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <ApiKosong compact pesan={showRiwayat ? 'Riwayat belum tersedia dari API untuk rentang ini' : 'Lapisan riwayat dimatikan'} />}
        {riwayat?.tersedia ? (
          <p className="mt-1 text-[10px] text-slate-500">Kab/kota {nf(riwayat.kab?.total)} ({nf(riwayat.kab?.serupa)} sejenis) · Provinsi {nf(riwayat.prov?.total)}</p>
        ) : null}
      </div>

      <div>
        <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Tren korban (wilayah yang sama)</p>
        {showRiwayat && korbanData.length ? (
          <div className={chartH}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={korbanData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="meninggal" name="Meninggal" stroke="#be123c" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="luka" name="Luka" stroke="#d97706" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="pengungsi" name="Pengungsi" stroke="#0f766e" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <ApiKosong compact pesan={showRiwayat ? 'Tren korban belum tersedia dari API' : 'Lapisan riwayat dimatikan'} />}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Hujan & suhu</p>
          <RangeBtn value={rentangCuaca} onChange={(id) => setRentangCuaca(id as any)} options={[{ id: '7j', label: '7 hari jam' }, { id: '30h', label: '30 hari' }]} />
        </div>
        {showHujan && cuacaData.length ? (
          <div className={chartH}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cuacaData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 8 }} interval="preserveStartEnd" />
                <YAxis yAxisId="h" tick={{ fontSize: 9 }} />
                <YAxis yAxisId="s" orientation="right" tick={{ fontSize: 9 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line yAxisId="h" type="monotone" dataKey="hujan" name="Hujan mm" stroke="#0369a1" dot={false} strokeWidth={2} />
                <Line yAxisId="s" type="monotone" dataKey="suhu" name="Suhu °C" stroke="#d97706" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <ApiKosong compact pesan={showHujan ? 'Deret cuaca belum tersedia dari API' : 'Lapisan hujan dimatikan'} />}
        <p className="mt-1 text-[10px] text-slate-400">Open-Meteo, model global, bukan prakiraan resmi BMKG.</p>
      </div>

      <div>
        <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Titik panas FIRMS</p>
        {showFirms && firmsData.length ? (
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={firmsData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="n" name="Titik panas" fill="#ea580c" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <ApiKosong compact pesan={showFirms ? (konteks?.karhutla?.error || 'Tren titik panas belum tersedia dari API') : 'Lapisan titik panas dimatikan'} />}
        {typeof konteks?.karhutla?.total === 'number' ? <p className="mt-1 text-[10px] text-slate-500">{nf(konteks.karhutla.total)} titik dalam {konteks.karhutla.radius_km} km (berkas FIRMS).</p> : null}
      </div>
    </div>
  )
}
