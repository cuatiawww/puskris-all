'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { AlertTriangle, Ambulance, Package, PhoneCall, Users } from 'lucide-react'
import { DEFAULT_LAYERS, type Focus, type Layers as MapLayers } from '@/components/spasial/SpasialMap'
import { type Area, type Metric } from '@/lib/spasial-api'
import { useChoroConfig } from '@/lib/choropleth-classes'
import { applyDerive, nf, pf, situasiTerfilter, logistikPerProvinsi } from '@/lib/puskris/derive'
import { PUBLIC_BASE_PATH } from '@/lib/public-path'
import {
  METRIC_PILLS, buildJenisCards, centroidsFromGeo, toSpasial,
  type Centroids, type ChoroId,
} from '@/lib/puskris/to-spasial'
import { toDeriveFilter, type PuskrisUiFilter } from '@/lib/puskris/ui-filter'
import { NASIONAL_NOTE, withQuery } from '@/lib/puskris/pages'
import { EMT_LABEL, NCC_LABEL } from '@/lib/puskris/labels'
import { asistensiWilayah, attachTimEstimate, titikFasilitas, buildPeringatan, buildTerpadu, countRadius, CONTOH_LABEL } from '@/lib/puskris/integrasi'

const SpasialMap = dynamic(() => import('@/components/spasial/SpasialMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-slate-50 text-xs font-bold text-slate-400">Memuat peta…</div>
  ),
})

const GEO_URL = `${PUBLIC_BASE_PATH}/data/indonesia-38-provinces.geojson`

function MiniSpark({ values, color = '#16B3AC' }: { values: number[]; color?: string }) {
  if (!values.length) return <div className="h-7 w-16" />
  const w = 72
  const h = 28
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const span = max - min || 1
  const pts = values.map((v, i) => {
    const x = values.length === 1 ? w / 2 : (i / (values.length - 1)) * w
    const y = h - 2 - ((v - min) / span) * (h - 4)
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={w} height={h} className="shrink-0 overflow-visible" aria-hidden>
      <polyline fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" points={pts} />
    </svg>
  )
}

function gapTone(v: number) {
  if (v >= 70) return 'text-red-700'
  if (v >= 55) return 'text-amber-700'
  return 'text-emerald-700'
}

function shortName(nama: string) {
  return nama
    .replace('Kepulauan ', 'Kep. ')
    .replace('Sumatera ', 'Sum. ')
    .replace('Sulawesi ', 'Sul. ')
    .replace('Kalimantan ', 'Kal. ')
    .replace('Nusa Tenggara ', 'NT ')
    .replace('Daerah Istimewa ', 'DI ')
}

export default function PuskrisExecutiveView({
  raw, f, onApply,
}: {
  raw: any
  f: PuskrisUiFilter
  onApply: (next: PuskrisUiFilter) => void
}) {
  const derived = useMemo(() => applyDerive(raw, toDeriveFilter(f)), [raw, f])
  const kejadian = useMemo(() => {
    const list = derived.kejadian || []
    return f.jenis ? list.filter((k: any) => k.jenis === f.jenis) : list
  }, [derived.kejadian, f.jenis])

  const useOfficialJenis = !f.provinsi && !f.kabupaten && f.periode === 'tahun' && !f.jenis
  const jenisCards = useMemo(
    () => buildJenisCards(useOfficialJenis ? raw : { ...raw, eoc: { ...raw.eoc, jenis_2026: [] } }, derived.kejadianSemua || derived.kejadian || []),
    [raw, derived.kejadian, derived.kejadianSemua, useOfficialJenis],
  )

  const situasi = useMemo(() => {
    if (!f.jenis) return derived.situasi
    if (derived.kejadianSemua) return situasiTerfilter(derived.situasi, derived.kejadianSemua.filter((k: any) => k.jenis === f.jenis), true)
    const sum = (key: string) => kejadian.reduce((a: number, k: any) => a + Number(k[key] || 0), 0)
    return {
      terpantau: kejadian.length,
      berdampak_krisis: kejadian.length,
      meninggal: sum('meninggal'),
      pengungsi: sum('pengungsi'),
      terdampak: sum('terdampak'),
    }
  }, [derived.situasi, derived.kejadianSemua, f.jenis, kejadian])

  const [centroids, setCentroids] = useState<Centroids>({})
  useEffect(() => {
    let on = true
    fetch(GEO_URL).then((r) => r.json()).then((fc) => { if (on) setCentroids(centroidsFromGeo(fc)) }).catch(() => {})
    return () => { on = false }
  }, [])

  const [metric, setMetric] = useState<Metric>('kasus')
  const [choro, setChoro] = useState<ChoroId>('kejadian')
  const [layers, setLayers] = useState<MapLayers>({ ...DEFAULT_LAYERS, base: 'osm' })
  const [sel, setSel] = useState<Area | null>(null)
  const [focus, setFocus] = useState<Focus | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [rightTab, setRightTab] = useState<'peringatan' | 'top5'>('peringatan')
  const [shortH, setShortH] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-height: 899px)')
    const apply = () => setShortH(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])
  const baseChoro = useChoroConfig()
  const RED_CHORO = { mode: 'quantile' as const, zeroColor: '#FDE8E8', colors: ['#FECACA', '#F87171', '#DC2626', '#7F1D1D'], quantiles: [0.25, 0.5, 0.75] }
  const choroCfg = choro === 'kesenjangan' ? RED_CHORO : baseChoro

  const logistikByCode = useMemo(() => logistikPerProvinsi(raw), [raw])
  const asistensiByCode = useMemo(
    () => Object.fromEntries(asistensiWilayah(raw).map((r: any) => [String(r.kode_wilayah).padStart(2, '0'), r.poin_kapasitas_pct])),
    [raw],
  )

  const mapPack = useMemo(() => toSpasial({
    rows: derived.rows,
    kejadian,
    choro,
    centroids,
    filter: f,
    logistikByCode,
    asistensiByCode,
    ringkasanLabel: f.jenis ? `Jenis: ${f.jenis}` : 'Semua jenis kejadian',
    periodeLabel: f.periode === 'bulan' ? 'Oktober 2026' : f.periode === '7hari' ? '7 hari terakhir' : f.periode === '30hari' ? '30 hari terakhir' : 'Tahun 2026',
    interpretasi: [],
    raw,
  }), [derived.rows, kejadian, choro, centroids, f, logistikByCode, asistensiByCode, raw])

  const layanan = derived.layanan
  const sdm = derived.sdm
  const logistik = derived.logistik
  const peringatan = useMemo(
    () => buildPeringatan({ raw, rows: derived.rows, nccDays: derived.ncc?.days || [], kejadian }),
    [raw, derived.rows, derived.ncc, kejadian],
  )
  const selectedRow = sel ? derived.rows.find((r) => r.code === sel.code) || null : (f.provinsi ? derived.selected : null)
  const terpadu = useMemo(() => buildTerpadu({
    row: selectedRow || null,
    kejadian,
    raw,
    layananNasional: derived.layanan,
    sdmNasional: derived.sdm,
    selectedEvent,
  }), [selectedRow, kejadian, raw, derived.layanan, derived.sdm, selectedEvent])

  const radiusCenter = selectedRow && centroids[selectedRow.code]
    ? centroids[selectedRow.code]
    : (mapPack.titik[0] ? { lat: mapPack.titik[0].lat, lon: mapPack.titik[0].lon } : null)
  const radiusCounts = useMemo(() => {
    if (!radiusCenter) return null
    const rawCounts = countRadius(radiusCenter, derived.rows, centroids, titikFasilitas(raw))
    return attachTimEstimate(rawCounts, derived.sdm?.tim ?? null, derived.sdm?.individu || 1)
  }, [radiusCenter, derived.rows, derived.sdm, centroids, raw])

  const topGap = useMemo(
    () => [...derived.rows].sort((a, b) => b.indeksRespons - a.indeksRespons).slice(0, 5),
    [derived.rows],
  )

  const kejadianSpark = (derived.chartBulanan || []).map((b: any) => Number(b.kejadian || 0))
  const krisisSpark = (derived.chartBulanan || []).map((b: any) => Number(b.krisis || 0))
  const nccSpark = (derived.ncc?.days || []).map((d: any) => Number(d.cof || 0))
  const nccAnswerSpark = (derived.ncc?.days || []).map((d: any) => Number(d.acd || 0))

  const jenisMax = Math.max(1, ...jenisCards.map((c) => c.kejadian))

  const pickArea = (a: Area | null) => {
    setSel(a)
    setSelectedEvent(a ? (kejadian || []).find((k: any) => k.code === a.code) || null : null)
    if (a && a.lat != null && a.lon != null) {
      setFocus({ lat: a.lat, lon: a.lon, area: a, zoom: 6.2, nonce: Date.now() })
    }
  }

  const onUp = f.provinsi ? () => { onApply({ ...f, provinsi: null, kabupaten: null }); pickArea(null) } : null
  const onDrill = (a: Area) => onApply({ ...f, provinsi: a.code, kabupaten: null })

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2" data-testid="puskris-executive-view">
      <section className="grid shrink-0 grid-cols-2 gap-2 xl:grid-cols-5" aria-label="Indikator utama">
        <Link href={withQuery('/dashboard/situasi-krisis', f)} className="skdr-card flex items-center gap-2 border-l-4 border-l-primary p-2.5 no-underline hover:border-primary/60">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Kejadian Krisis</p>
            <p className="text-2xl font-black leading-none tracking-tight text-slate-900">{nf(situasi.terpantau)}</p>
            <p className="mt-1 truncate text-[10px] font-semibold text-slate-600">{nf(situasi.berdampak_krisis)} berdampak krisis</p>
          </div>
          <MiniSpark values={kejadianSpark} color="#16B3AC" />
        </Link>
        <Link href={withQuery('/dashboard/situasi-krisis', f)} className="skdr-card flex items-center gap-2 border-l-4 border-l-rose-500 p-2.5 no-underline hover:border-rose-400">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Pengungsi</p>
            <p className="text-2xl font-black leading-none tracking-tight text-slate-900">{nf(situasi.pengungsi)}</p>
            <p className="mt-1 truncate text-[10px] font-semibold text-slate-600">{nf(situasi.meninggal)} meninggal</p>
          </div>
          <MiniSpark values={krisisSpark} color="#E11D48" />
        </Link>
        <Link href={withQuery('/dashboard/layanan-gawat-darurat/panggilan-119', f)} className="skdr-card flex items-center gap-2 border-l-4 border-l-amber-500 p-2.5 no-underline hover:border-amber-400">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Panggilan 119</p>
            <p className="text-2xl font-black leading-none tracking-tight text-slate-900">{nf(layanan.panggilan)}</p>
            <p className="mt-1 truncate text-[10px] font-semibold text-amber-700">
              {layanan.scr != null ? `Keberhasilan ${pf(layanan.scr, 1)}` : 'Tingkat keberhasilan n/a'}
              {(f.provinsi || f.kabupaten) ? ' · nasional' : ''}
            </p>
          </div>
          <MiniSpark values={nccSpark} color="#D97706" />
        </Link>
        <Link href={withQuery('/dashboard/layanan-gawat-darurat', f)} className="skdr-card flex items-center gap-2 border-l-4 border-l-emerald-500 p-2.5 no-underline hover:border-emerald-400">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">PSC & Ambulans</p>
            <p className="text-2xl font-black leading-none tracking-tight text-slate-900">{nf(layanan.pscAktif)}</p>
            <p className="mt-1 truncate text-[10px] font-semibold text-slate-600">{nf(layanan.ambulans)} ambulans · {nf(layanan.pscAktif)}/{nf(layanan.pscTotal)} PSC</p>
          </div>
          <Ambulance className="h-7 w-7 shrink-0 text-emerald-600/80" />
        </Link>
        <Link href={withQuery('/dashboard/kesiapsiagaan', f)} className="skdr-card col-span-2 flex items-center gap-2 border-l-4 border-l-sky-500 p-2.5 no-underline hover:border-sky-400 xl:col-span-1">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Kesiapsiagaan SDM</p>
            <p className="text-2xl font-black leading-none tracking-tight text-slate-900">{nf(sdm.individu)}</p>
            <p className="mt-1 truncate text-[10px] font-semibold text-slate-600">
              {sdm.tim == null ? 'Tim n/a' : `${nf(sdm.tim)} tim`}
              {sdm.emt != null ? ` · ${nf(sdm.emt)} ${EMT_LABEL}` : ''}
            </p>
          </div>
          <Users className="h-7 w-7 shrink-0 text-sky-600/80" />
        </Link>
      </section>

      <div className="flex min-h-0 flex-1 gap-2">
        <div className="relative min-h-[260px] min-w-0 flex-[65] overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="absolute left-2 top-2 z-10 flex flex-wrap gap-1">
            {METRIC_PILLS.filter((m, i, arr) => arr.findIndex((x) => x.choro === m.choro) === i).map((m) => (
              <button
                key={m.choro}
                type="button"
                onClick={() => { setMetric(m.key); setChoro(m.choro) }}
                className={`rounded-lg px-2 py-1 text-[10px] font-bold shadow-sm ${choro === m.choro ? 'bg-primary text-white' : 'bg-white/90 text-slate-600 hover:bg-white'}`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <SpasialMap
            data={mapPack.data}
            titik={mapPack.titik}
            metric={metric}
            setMetric={(m) => {
              setMetric(m)
              const hit = METRIC_PILLS.find((p) => p.key === m && p.choro === choro) || METRIC_PILLS.find((p) => p.key === m)
              if (hit) setChoro(hit.choro)
            }}
            layers={layers}
            setLayers={setLayers}
            choroCfg={choroCfg}
            sumber="ebs"
            selectedId={sel?.id ?? null}
            onSelectArea={pickArea}
            onDrill={onDrill}
            onUp={onUp}
            focus={focus}
            rightPanel={null}
            panelOpen={panelOpen}
            setPanelOpen={setPanelOpen}
            fullHeight
            hideDefaultToolbar
            radiusSupport={{ enabled: Boolean(radiusCenter), center: radiusCenter, ringsKm: [50, 100, 200] }}
          />
        </div>

        <aside className="flex min-h-0 w-[35%] min-w-[240px] max-w-[380px] shrink-0 flex-col gap-2">
          {shortH ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex shrink-0 gap-1 border-b border-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setRightTab('peringatan')}
                  className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wider ${rightTab === 'peringatan' ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  Peringatan
                  <span className={`rounded-full px-1.5 text-[9px] ${rightTab === 'peringatan' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>{peringatan.length}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRightTab('top5')}
                  className={`flex flex-1 items-center justify-center rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wider ${rightTab === 'top5' ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  Top 5
                </button>
              </div>
              {rightTab === 'peringatan' ? (
                <ol className="min-h-0 flex-1 space-y-1 overflow-auto p-2">
                  {peringatan.length ? peringatan.slice(0, 8).map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => { if (p.code) onApply({ ...f, provinsi: p.code, kabupaten: null }) }}
                        className="w-full rounded-lg border border-slate-100 px-2 py-1 text-left hover:bg-slate-50"
                      >
                        <p className="flex items-start gap-1.5 text-[11px] font-bold text-slate-800">
                          <AlertTriangle className={`mt-0.5 h-3 w-3 shrink-0 ${p.tingkat === 'tinggi' ? 'text-red-600' : 'text-amber-500'}`} />
                          <span className="line-clamp-2 leading-snug">{p.judul}</span>
                        </p>
                        {p.contoh ? <span className="ml-4 text-[9px] font-bold uppercase text-amber-700">{CONTOH_LABEL}</span> : null}
                      </button>
                    </li>
                  )) : (
                    <li className="px-2 py-3 text-[11px] text-slate-500">Tidak ada peringatan pada filter ini.</li>
                  )}
                </ol>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col overflow-auto">
                  <ol className="space-y-1 p-2">
                    {topGap.map((r, i) => (
                      <li key={r.code}>
                        <button
                          type="button"
                          onClick={() => onApply({ ...f, provinsi: r.code, kabupaten: null })}
                          className={`flex w-full items-center gap-2 rounded-xl px-2 py-1 text-left hover:bg-slate-50 ${f.provinsi === r.code ? 'bg-teal-50' : ''}`}
                        >
                          <span className="w-4 text-[10px] font-black text-slate-400">{i + 1}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[11px] font-bold text-slate-800">{shortName(r.nama)}</span>
                            <span className="mt-0.5 block h-1 overflow-hidden rounded-full bg-slate-100">
                              <span className="block h-full rounded-full bg-rose-500" style={{ width: `${Math.min(100, r.indeksRespons)}%` }} />
                            </span>
                          </span>
                          <span className={`text-[11px] font-black tabular-nums ${gapTone(r.indeksRespons)}`}>{r.indeksRespons.toFixed(1)}</span>
                        </button>
                      </li>
                    ))}
                  </ol>
                  {selectedRow && terpadu ? (
                    <p className="border-t border-slate-100 px-3 py-1.5 text-[10px] text-slate-500">
                      {shortName(selectedRow.nama)}: indeks {selectedRow.indeksRespons.toFixed(1)} · {nf(selectedRow.pscAktif)} PSC · {nf(selectedRow.ambulans)} ambulans
                      {radiusCounts?.find((c) => c.km === 100) ? ` · radius 100 km: ${radiusCounts.find((c) => c.km === 100)!.psc} PSC` : ''}
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                  <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-700">Peringatan prioritas</h2>
                  <span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-bold text-slate-600">{peringatan.length}</span>
                </div>
                <ol className="min-h-0 flex-1 space-y-1 overflow-auto p-2">
                  {peringatan.length ? peringatan.slice(0, 6).map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => { if (p.code) onApply({ ...f, provinsi: p.code, kabupaten: null }) }}
                        className="w-full rounded-xl border border-slate-100 px-2.5 py-1.5 text-left hover:bg-slate-50"
                      >
                        <p className="flex items-start gap-1.5 text-[11px] font-bold text-slate-800">
                          <AlertTriangle className={`mt-0.5 h-3 w-3 shrink-0 ${p.tingkat === 'tinggi' ? 'text-red-600' : 'text-amber-500'}`} />
                          <span className="leading-snug">{p.judul}</span>
                        </p>
                        <p className="mt-0.5 line-clamp-2 pl-4 text-[10px] leading-snug text-slate-500">{p.detail}</p>
                        {p.contoh ? <span className="ml-4 text-[9px] font-bold uppercase text-amber-700">{CONTOH_LABEL}</span> : null}
                      </button>
                    </li>
                  )) : (
                    <li className="px-2 py-3 text-[11px] text-slate-500">Tidak ada peringatan pada filter ini.</li>
                  )}
                </ol>
              </div>
              <div className="shrink-0 rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-100 px-3 py-2">
                  <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-700">Top 5 provinsi kesenjangan</h2>
                </div>
                <ol className="space-y-1 p-2">
                  {topGap.map((r, i) => (
                    <li key={r.code}>
                      <button
                        type="button"
                        onClick={() => onApply({ ...f, provinsi: r.code, kabupaten: null })}
                        className={`flex w-full items-center gap-2 rounded-xl px-2 py-1 text-left hover:bg-slate-50 ${f.provinsi === r.code ? 'bg-teal-50' : ''}`}
                      >
                        <span className="w-4 text-[10px] font-black text-slate-400">{i + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[11px] font-bold text-slate-800">{shortName(r.nama)}</span>
                          <span className="mt-0.5 block h-1 overflow-hidden rounded-full bg-slate-100">
                            <span className="block h-full rounded-full bg-rose-500" style={{ width: `${Math.min(100, r.indeksRespons)}%` }} />
                          </span>
                        </span>
                        <span className={`text-[11px] font-black tabular-nums ${gapTone(r.indeksRespons)}`}>{r.indeksRespons.toFixed(1)}</span>
                      </button>
                    </li>
                  ))}
                </ol>
                {selectedRow && terpadu ? (
                  <p className="border-t border-slate-100 px-3 py-1.5 text-[10px] text-slate-500">
                    {shortName(selectedRow.nama)}: indeks {selectedRow.indeksRespons.toFixed(1)} · {nf(selectedRow.pscAktif)} PSC · {nf(selectedRow.ambulans)} ambulans
                    {radiusCounts?.find((c) => c.km === 100) ? ` · radius 100 km: ${radiusCounts.find((c) => c.km === 100)!.psc} PSC` : ''}
                  </p>
                ) : null}
              </div>
            </>
          )}
        </aside>
      </div>

      <section className="grid shrink-0 grid-cols-1 gap-2 md:grid-cols-3" aria-label="Rekap pilar">
        <div className="skdr-card flex min-h-[132px] flex-col p-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-700">Jenis kejadian</h2>
            {f.jenis ? (
              <button type="button" onClick={() => onApply({ ...f, jenis: null })} className="text-[10px] font-bold text-primary hover:underline">Hapus filter</button>
            ) : null}
          </div>
          <ul className="min-h-0 flex-1 space-y-1 overflow-auto">
            {jenisCards.slice(0, 6).map((c) => {
              const on = f.jenis === c.nama
              return (
                <li key={c.nama}>
                  <button
                    type="button"
                    onClick={() => onApply({ ...f, jenis: on ? null : c.nama })}
                    className={`flex w-full items-center gap-2 rounded-lg px-1 py-0.5 text-left ${on ? 'bg-primary/10' : 'hover:bg-slate-50'}`}
                  >
                    <span className="w-[42%] truncate text-[11px] font-semibold text-slate-700">{c.nama}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <span className="block h-full rounded-full bg-primary" style={{ width: `${(c.kejadian / jenisMax) * 100}%` }} />
                    </span>
                    <span className="w-8 text-right text-[11px] font-bold tabular-nums text-slate-800">{nf(c.kejadian)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="skdr-card flex min-h-[132px] flex-col p-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <h2 className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-slate-700">
              <PhoneCall className="h-3.5 w-3.5 text-amber-600" /> Layanan 119 & PSC
            </h2>
            <Link href={withQuery('/dashboard/layanan-gawat-darurat', f)} className="text-[10px] font-bold text-primary hover:underline">Detail</Link>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="text-[9px] font-bold uppercase text-slate-400">Masuk</p>
              <p className="text-lg font-black leading-tight text-slate-900">{derived.ncc?.live ? nf(derived.ncc.totals?.cof) : '—'}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase text-slate-400">Terjawab</p>
              <p className="text-lg font-black leading-tight text-slate-900">{derived.ncc?.live ? nf(derived.ncc.totals?.acd) : '—'}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase text-slate-400">PSC aktif</p>
              <p className="text-lg font-black leading-tight text-slate-900">{nf(layanan.pscAktif)}</p>
            </div>
          </div>
          <div className="mt-auto flex items-center justify-between pt-1">
            <MiniSpark values={nccAnswerSpark.length ? nccAnswerSpark : nccSpark} color="#16B3AC" />
            {(f.provinsi || f.kabupaten) ? <span className="text-[9px] font-semibold text-amber-800">{NASIONAL_NOTE}</span> : <span className="text-[10px] text-slate-500">{NCC_LABEL.scr.replace(' (%)', '')} {layanan.scr != null ? pf(layanan.scr, 1) : '—'}</span>}
          </div>
        </div>

        <div className="skdr-card flex min-h-[132px] flex-col p-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <h2 className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-slate-700">
              <Package className="h-3.5 w-3.5 text-sky-600" /> Kesiapsiagaan SDM & Logistik
            </h2>
            <Link href={withQuery('/dashboard/kesiapsiagaan', f)} className="text-[10px] font-bold text-primary hover:underline">Detail</Link>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="text-[9px] font-bold uppercase text-slate-400">Individu</p>
              <p className="text-lg font-black leading-tight text-slate-900">{nf(sdm.individu)}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase text-slate-400">Tim</p>
              <p className="text-lg font-black leading-tight text-slate-900">{sdm.tim == null ? '—' : nf(sdm.tim)}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase text-slate-400">Stok</p>
              <p className="text-lg font-black leading-tight text-slate-900">{logistik.totalStok == null ? '—' : nf(logistik.totalStok)}</p>
            </div>
          </div>
          <p className="mt-auto pt-1 text-[10px] leading-snug text-slate-500">
            {sdm.emt != null ? `${nf(sdm.emt)} ${EMT_LABEL}. ` : ''}
            {logistik.penerimaan != null ? `Penerimaan ${nf(logistik.penerimaan)} · pengeluaran ${nf(logistik.pengeluaran)}.` : (logistik.regional || 'Stok mengikuti regional logistik.')}
          </p>
        </div>
      </section>
    </div>
  )
}
