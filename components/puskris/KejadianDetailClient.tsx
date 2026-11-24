'use client'

import { useEffect, useState, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, MapPin, RefreshCw } from 'lucide-react'
import { PUBLIC_BASE_PATH } from '@/lib/public-path'
import { fmtAngka, tglKejadian } from '@/lib/puskris/eoc-markers'
import ApiKosong from '@/components/puskris/ApiKosong'
import SectionHead from '@/components/puskris/SectionHead'

const MiniMap = dynamic(() => import('@/components/puskris/KejadianMiniMap'), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-xs font-bold text-slate-400">Memuat peta…</div>,
})

type Nearby = {
  radius_km: number
  psc: { tersedia: boolean; total?: number; aktif?: number; nama?: string[] }
  ambulans: { tersedia: boolean; total?: number; siap?: number }
  tck: { tersedia: boolean; level?: string; provinsi?: string; individu?: number; nakes?: number; non_nakes?: number }
  logistik: { tersedia: boolean; level?: string; nama?: string; total?: number }
}

type Kejadian = {
  uid: string
  tanggal: string
  jam?: string | null
  jenis: string
  kelompok: string
  provinsi: string
  kabupaten?: string | null
  krisis: boolean
  meninggal: number
  hilang: number
  luka_berat: number
  luka_ringan: number
  pengungsi: number
  terdampak: number
  faskes_rusak: number
  url?: string
  kind: string
  icon: { id: string; label: string; color: string; src: string }
  koordinat: { lat: number | null; lon: number | null; lok: string; label: string }
}

const KPI: { key: keyof Kejadian; label: string }[] = [
  { key: 'meninggal', label: 'Meninggal' },
  { key: 'hilang', label: 'Hilang' },
  { key: 'luka_berat', label: 'Luka berat' },
  { key: 'luka_ringan', label: 'Luka ringan' },
  { key: 'pengungsi', label: 'Pengungsi' },
  { key: 'terdampak', label: 'Terdampak' },
  { key: 'faskes_rusak', label: 'Faskes rusak' },
]

function nf(n: number | null | undefined, satuan?: string) {
  if (n == null || Number.isNaN(Number(n))) return '—'
  const s = Number(n).toLocaleString('id-ID', { maximumFractionDigits: 1 })
  return satuan ? `${s} ${satuan}` : s
}
function errTeks(e?: string) {
  if (!e) return undefined
  if (/fetch failed|ECONN|ENOTFOUND|timeout|habis|AbortError/i.test(e)) return 'Sumber terbuka tidak dapat diakses saat ini.'
  return e
}

export default function KejadianDetailClient({ id, tahun }: { id: string; tahun?: string | null }) {
  const [st, setSt] = useState<'muat' | 'ok' | 'kosong' | 'error'>('muat')
  const [pesan, setPesan] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [k, setK] = useState<Kejadian | null>(null)
  const [nearby, setNearby] = useState<Nearby | null>(null)
  const [konteks, setKonteks] = useState<any>(null)
  const [konteksSt, setKonteksSt] = useState<'idle' | 'muat' | 'ok' | 'kosong'>('idle')

  useEffect(() => {
    let on = true
    let tries = 0
    const load = async () => {
      setSt('muat')
      const q = tahun ? `?tahun=${encodeURIComponent(tahun)}` : ''
      try {
        const r = await fetch(`${PUBLIC_BASE_PATH}/api/puskris/kejadian/${encodeURIComponent(id)}${q}`, { cache: 'no-store' })
        const j = await r.json().catch(() => null)
        if (!on) return
        if (j?.kejadian) {
          setK(j.kejadian)
          setNearby(j.nearby || null)
          setPending(Boolean(j.pending))
          setSt('ok')
          return
        }
        if (j?.pending && tries < 4) {
          setPending(true)
          setPesan(j.detail || j.pesan)
          tries += 1
          setTimeout(load, 4000)
          return
        }
        setPending(false)
        setPesan(j?.detail || j?.pesan || 'Data belum tersedia dari API')
        setSt('kosong')
      } catch (e: any) {
        if (!on) return
        setPesan(String(e?.message || e))
        setSt('error')
      }
    }
    void load()
    return () => { on = false }
  }, [id, tahun])

  useEffect(() => {
    if (!k?.koordinat?.lat || !k.koordinat.lon) { setKonteks(null); setKonteksSt('kosong'); return }
    let on = true
    setKonteksSt('muat')
    const sp = new URLSearchParams({ lat: String(k.koordinat.lat), lon: String(k.koordinat.lon), jenis: k.jenis || '' })
    fetch(`${PUBLIC_BASE_PATH}/api/puskris/open/konteks?${sp}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => { if (on) { setKonteks(j); setKonteksSt('ok') } })
      .catch(() => { if (on) { setKonteks(null); setKonteksSt('kosong') } })
    return () => { on = false }
  }, [k])

  return (
    <div className="skdr-page mx-auto max-w-6xl px-4 py-5 sm:px-6" data-testid="kejadian-detail">
      <nav className="mb-3 flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-slate-500">
        <Link href={`${PUBLIC_BASE_PATH}/dashboard/ringkasan`} className="hover:text-[#00705a]">Dasbor</Link>
        <span className="text-slate-300">/</span>
        <Link href={`${PUBLIC_BASE_PATH}/dashboard/spasial`} className="hover:text-[#00705a]">Peta</Link>
        <span className="text-slate-300">/</span>
        <span className="text-slate-700">Detail kejadian</span>
      </nav>

      {st === 'muat' ? (
        <ApiKosong pending pesan="Sedang mengambil data dari API…" detail="Memuat rincian kejadian dari API EOC." />
      ) : null}
      {st === 'kosong' || st === 'error' ? (
        <div className="space-y-3">
          <ApiKosong pesan={st === 'error' ? 'Data belum tersedia dari API' : (pesan || undefined)} detail={pesan} />
          <Link href={`${PUBLIC_BASE_PATH}/dashboard/spasial`} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#00705a] hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke peta
          </Link>
        </div>
      ) : null}

      {st === 'ok' && k ? (
        <>
          <header className="skdr-section-head flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="skdr-eyebrow">Kejadian EOC</div>
              <h1 className="skdr-section-title flex items-center gap-2">
                {k.icon?.src ? <img alt="" aria-hidden src={k.icon.src} className="h-9 w-7 object-contain" /> : null}
                <span>{k.jenis || 'Kejadian'}</span>
              </h1>
              <p className="skdr-section-desc">{[k.kabupaten, k.provinsi].filter(Boolean).join(', ') || 'Lokasi belum tersedia dari API'}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${k.krisis ? 'bg-rose-700' : 'bg-teal-700'}`}>{k.krisis ? 'Krisis kesehatan' : 'Terpantau'}</span>
                {k.kelompok ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">{k.kelompok}</span> : null}
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">{tglKejadian(k.tanggal, k.jam)}</span>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Link href={`${PUBLIC_BASE_PATH}/dashboard/spasial`} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
                <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke peta
              </Link>
              {k.url ? (
                <a href={k.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-bold text-teal-800 hover:bg-teal-100">
                  Sumber EOC <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </div>
          </header>

          <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {KPI.map((x) => (
              <div key={x.key} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{x.label}</div>
                <div className="mt-0.5 text-lg font-black tabular-nums text-slate-900">{fmtAngka(k[x.key] as number)}</div>
              </div>
            ))}
          </section>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <div className="skdr-card p-4 lg:col-span-2">
              <SectionHead eyebrow="Lokasi" title="Wilayah kejadian" />
              <dl className="mt-3 space-y-1.5 text-xs">
                <div className="flex justify-between gap-3 border-b border-slate-100 py-1"><dt className="text-slate-500">Kabupaten/kota</dt><dd className="font-bold text-slate-800">{k.kabupaten || '—'}</dd></div>
                <div className="flex justify-between gap-3 border-b border-slate-100 py-1"><dt className="text-slate-500">Provinsi</dt><dd className="font-bold text-slate-800">{k.provinsi || '—'}</dd></div>
                <div className="flex justify-between gap-3 border-b border-slate-100 py-1"><dt className="text-slate-500">Koordinat</dt><dd className="font-bold tabular-nums text-slate-800">{k.koordinat.lat != null && k.koordinat.lon != null ? `${k.koordinat.lat.toFixed(4)}, ${k.koordinat.lon.toFixed(4)}` : '—'}</dd></div>
                <div className="flex items-start justify-between gap-3 py-1"><dt className="text-slate-500">Letak titik</dt><dd className="max-w-[220px] text-right font-semibold text-slate-700">{k.koordinat.label}</dd></div>
              </dl>
              {k.koordinat.lok !== 'kejadian' ? (
                <p className="mt-3 flex items-start gap-1.5 text-[11px] text-slate-500"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />Titik di peta adalah perkiraan. Koordinat kejadian asli tidak tersedia dari API EOC.</p>
              ) : null}
            </div>
            <div className="skdr-card overflow-hidden lg:col-span-3">
              <div className="h-72 w-full bg-slate-50">
                {k.koordinat.lat != null && k.koordinat.lon != null ? (
                  <MiniMap lat={k.koordinat.lat} lon={k.koordinat.lon} iconSrc={k.icon?.src} approx={k.koordinat.lok !== 'kejadian'} />
                ) : (
                  <div className="flex h-full items-center p-4"><ApiKosong pesan="Koordinat belum tersedia dari API" compact /></div>
                )}
              </div>
            </div>
          </section>

          <section className="skdr-section">
            <SectionHead eyebrow="Dukungan terdekat" title="PSC, ambulans, dan kesiapsiagaan" desc={`Agregat di kab/kota yang sama atau dalam radius ${nearby?.radius_km || 50} km. Hanya data resmi API Pusat Krisis.`} />
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard title="PSC 119" sumber="API PSC 119">
                {nearby?.psc.tersedia ? (
                  <>
                    <p className="text-2xl font-black tabular-nums text-slate-900">{nf(nearby.psc.total)}</p>
                    <p className="text-xs text-slate-500">{nf(nearby.psc.aktif)} aktif</p>
                    {nearby.psc.nama?.length ? <p className="mt-2 text-[11px] leading-snug text-slate-600">{nearby.psc.nama.join(' · ')}</p> : null}
                  </>
                ) : <ApiKosong compact />}
              </StatCard>
              <StatCard title="Ambulans" sumber="API PSC 119">
                {nearby?.ambulans.tersedia ? (
                  <>
                    <p className="text-2xl font-black tabular-nums text-slate-900">{nf(nearby.ambulans.total)}</p>
                    <p className="text-xs text-slate-500">{nf(nearby.ambulans.siap)} siap</p>
                  </>
                ) : <ApiKosong compact />}
              </StatCard>
              <StatCard title="Tenaga cadangan" sumber="API TCK (agregat provinsi)">
                {nearby?.tck.tersedia ? (
                  <>
                    <p className="text-2xl font-black tabular-nums text-slate-900">{nf(nearby.tck.individu)}</p>
                    <p className="text-xs text-slate-500">{nearby.tck.provinsi} · {nf(nearby.tck.nakes)} nakes · {nf(nearby.tck.non_nakes)} non-nakes</p>
                  </>
                ) : <ApiKosong compact />}
              </StatCard>
              <StatCard title="Stok logistik" sumber="API Logistik (agregat regional)">
                {nearby?.logistik.tersedia ? (
                  <>
                    <p className="text-2xl font-black tabular-nums text-slate-900">{nf(nearby.logistik.total)}</p>
                    <p className="text-xs text-slate-500">{nearby.logistik.nama}</p>
                  </>
                ) : <ApiKosong compact />}
              </StatCard>
            </div>
          </section>

          <KonteksSection k={k} st={konteksSt} data={konteks} />
        </>
      ) : null}
    </div>
  )
}

function StatCard({ title, sumber, children }: { title: string; sumber: string; children: ReactNode }) {
  return (
    <article className="skdr-card flex flex-col p-4">
      <h3 className="text-sm font-black text-slate-900">{title}</h3>
      <p className="mb-2 text-[10px] font-semibold text-slate-400">{sumber}</p>
      {children}
    </article>
  )
}

function KonteksSection({ k, st, data }: { k: Kejadian; st: string; data: any }) {
  const kind = k.kind
  const judul =
    kind === 'banjir' ? 'Cuaca dan debit sungai' :
    kind === 'gempa' ? 'Gempa dan peringatan di sekitar' :
    kind === 'erupsi' ? 'Aktivitas gunung api dan cuaca' :
    kind === 'karhutla' ? 'Titik panas di sekitar' :
    kind === 'longsor' || kind === 'cuaca' ? 'Cuaca di sekitar lokasi' :
    'Konteks cuaca'
  return (
    <section className="skdr-section">
      <SectionHead eyebrow="Data terbuka pendukung" title={judul} desc="Bukan pengganti peringatan resmi BMKG atau BNPB. Setiap kotak mencantumkan sumbernya." />
      {st === 'muat' ? <div className="mt-3"><ApiKosong pending /></div> : null}
      {st !== 'muat' && !data?.ok && !data?.cuaca && !data?.banjir && !data?.bahaya && !data?.karhutla ? (
        <div className="mt-3"><ApiKosong pesan="Data pendukung belum tersedia dari API terbuka" detail={data?.pesan} /></div>
      ) : null}

      {data?.catatan?.length ? (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[11px] text-slate-500">{data.catatan.map((c: string) => <li key={c}>{c}</li>)}</ul>
      ) : null}

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {data?.cuaca ? (
          <article className="skdr-card p-4">
            <h3 className="text-sm font-black text-slate-900">Cuaca saat ini</h3>
            <p className="text-[10px] font-semibold text-slate-400">{data.cuaca.sumber}</p>
            {data.cuaca.kosong ? <div className="mt-2"><ApiKosong compact detail={errTeks(data.cuaca.error)} /></div> : (
              <>
                <p className="mt-2 text-2xl font-black tabular-nums text-slate-900">{nf(data.cuaca.saat_ini?.suhu, '°C')}</p>
                <p className="text-xs text-slate-600">{data.cuaca.saat_ini?.kondisi || '—'}</p>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-lg bg-slate-50 px-2 py-1.5"><dt className="text-[10px] font-bold uppercase text-slate-400">Kelembapan</dt><dd className="font-bold">{nf(data.cuaca.saat_ini?.kelembapan, '%')}</dd></div>
                  <div className="rounded-lg bg-slate-50 px-2 py-1.5"><dt className="text-[10px] font-bold uppercase text-slate-400">Hujan</dt><dd className="font-bold">{nf(data.cuaca.saat_ini?.hujan_mm, 'mm')}</dd></div>
                  <div className="rounded-lg bg-slate-50 px-2 py-1.5"><dt className="text-[10px] font-bold uppercase text-slate-400">Angin</dt><dd className="font-bold">{nf(data.cuaca.saat_ini?.angin, 'km/j')}</dd></div>
                  <div className="rounded-lg bg-slate-50 px-2 py-1.5"><dt className="text-[10px] font-bold uppercase text-slate-400">Hembusan</dt><dd className="font-bold">{nf(data.cuaca.saat_ini?.hembusan, 'km/j')}</dd></div>
                </dl>
                {data.cuaca.harian?.length ? (
                  <ul className="mt-3 divide-y divide-slate-100 text-[11px]">
                    {data.cuaca.harian.map((d: any) => (
                      <li key={d.tanggal} className="flex items-center justify-between gap-2 py-1">
                        <span className="font-semibold text-slate-600">{d.tanggal}</span>
                        <span className="tabular-nums text-slate-700">{nf(d.suhu_min)}–{nf(d.suhu_max, '°C')} · hujan {nf(d.hujan_mm, 'mm')}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
          </article>
        ) : null}

        {kind === 'banjir' ? (
          <article className="skdr-card p-4">
            <h3 className="text-sm font-black text-slate-900">Debit sungai (model)</h3>
            <p className="text-[10px] font-semibold text-slate-400">{data?.banjir?.sumber || 'GloFAS / Open-Meteo Flood'}</p>
            {!data?.banjir || data.banjir.kosong ? <div className="mt-2"><ApiKosong compact detail={errTeks(data?.banjir?.error)} /></div> : (
              <ul className="mt-3 divide-y divide-slate-100 text-[11px]">
                {data.banjir.harian.map((d: any) => (
                  <li key={d.tanggal} className="flex items-center justify-between gap-2 py-1.5">
                    <span className="font-semibold text-slate-600">{d.tanggal}</span>
                    <span className="tabular-nums text-slate-800">debit {nf(d.debit, data.banjir.satuan)}{d.debit_rerata != null ? ` · rerata ${nf(d.debit_rerata)}` : ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        ) : null}

        {kind === 'gempa' || kind === 'erupsi' ? (
          <article className="skdr-card p-4">
            <h3 className="text-sm font-black text-slate-900">{kind === 'erupsi' ? 'Peringatan di sekitar' : 'Gempa terdekat'}</h3>
            <p className="text-[10px] font-semibold text-slate-400">{data?.bahaya?.sumber || 'BMKG / GDACS'}{data?.bahaya?.radius_km ? ` · radius ${data.bahaya.radius_km} km` : ''}</p>
            {!data?.bahaya || data.bahaya.kosong || !data.bahaya.items?.length ? <div className="mt-2"><ApiKosong compact pesan="Tidak ada gempa atau peringatan terbuka di sekitar lokasi saat ini" /></div> : (
              <ul className="mt-3 max-h-72 space-y-2 overflow-auto text-[11px]">
                {data.bahaya.items.map((ev: any, i: number) => (
                  <li key={`${ev.sumber}-${i}`} className="rounded-lg border border-slate-100 px-2.5 py-2">
                    <p className="font-bold text-slate-800">{ev.title}</p>
                    <p className="text-slate-500">{ev.place} · {ev.jarak_km} km · {ev.sumber}{ev.time ? ` · ${ev.time}` : ''}</p>
                    {ev.potensi ? <p className="text-slate-600">{ev.potensi}</p> : null}
                  </li>
                ))}
              </ul>
            )}
            {kind === 'erupsi' && data?.magma?.kosong ? (
              <div className="mt-3"><ApiKosong compact pesan="Data MAGMA/PVMBG belum tersedia" detail={data.magma.catatan} /></div>
            ) : null}
          </article>
        ) : null}

        {kind === 'karhutla' ? (
          <article className="skdr-card p-4">
            <h3 className="text-sm font-black text-slate-900">Titik panas 24 jam</h3>
            <p className="text-[10px] font-semibold text-slate-400">{data?.karhutla?.sumber || 'NASA FIRMS'}{data?.karhutla?.radius_km ? ` · radius ${data.karhutla.radius_km} km` : ''}</p>
            {!data?.karhutla || data.karhutla.kosong ? <div className="mt-2"><ApiKosong compact pesan="Tidak ada titik panas FIRMS di sekitar lokasi dalam 24 jam terakhir" /></div> : (
              <>
                <p className="mt-2 text-2xl font-black tabular-nums">{nf(data.karhutla.total)}</p>
                <ul className="mt-2 max-h-64 space-y-1 overflow-auto text-[11px]">
                  {data.karhutla.items.map((h: any, i: number) => (
                    <li key={i} className="flex justify-between gap-2 border-b border-slate-100 py-1">
                      <span>{h.acq_date} {h.acq_time} · {h.satellite} · {h.confidence}</span>
                      <span className="tabular-nums font-semibold">{h.jarak_km} km{h.frp != null ? ` · FRP ${nf(h.frp)}` : ''}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </article>
        ) : null}
      </div>
      {data?.fetched_at ? <p className="mt-2 flex items-center gap-1 text-[10px] text-slate-400"><RefreshCw className="h-3 w-3" /> Diambil {data.fetched_at}</p> : null}
    </section>
  )
}