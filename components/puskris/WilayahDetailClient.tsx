/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { ArrowLeft, Maximize2, Minimize2 } from 'lucide-react'
import { usePuskrisRaw } from '@/components/puskris/usePuskrisRaw'
import { applyDerive } from '@/lib/puskris/derive'
import { defaultUiFilter, toDeriveFilter, type PuskrisUiFilter } from '@/lib/puskris/ui-filter'
import PuskrisPetaTerpadu from '@/components/puskris/PuskrisPetaTerpadu'
import ApiKosong from '@/components/puskris/ApiKosong'
import { WilayahHeaderBand, WilayahIndikatorSections } from '@/components/puskris/WilayahDetailSections'
import { PUBLIC_BASE_PATH } from '@/lib/public-path'
import {
  analisaWilayah,
  breakdownJenis,
  breakdownKab,
  konteksWilayah,
  eventsInWilayah,
  filterWilayahList,
  heatmapJenisBulan,
  heatmapKabJenis,
  jenisOptions,
  namaWilayah,
  parseWilayahKode,
  rekapKejadian,
  trendBulanan,
} from '@/lib/puskris/wilayah-detail'

export default function WilayahDetailClient({
  kode, tahun, kab, jenis: jenisAwal,
}: {
  kode: string
  tahun?: string | null
  kab?: string | null
  jenis?: string | null
}) {
  const parsed = useMemo(() => parseWilayahKode(kab && kab.length >= 3 ? kab : kode), [kode, kab])
  const [f, setF] = useState<PuskrisUiFilter>(() => {
    const d = defaultUiFilter()
    const y = Number(tahun)
    const next = Number.isFinite(y) && y >= 2015 ? { ...d, tahun: y } : d
    return { ...next, provinsi: parsed.prov || null, kabupaten: parsed.kab, jenis: jenisAwal || null }
  })
  const [jenis, setJenis] = useState<string | null>(jenisAwal || null)
  const [ready, setReady] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null)
  const [mapFull, setMapFull] = useState(false)
  const [portalReady, setPortalReady] = useState(false)

  useEffect(() => { setReady(true); setPortalReady(true) }, [])

  const { raw, error, loadingRange, pending } = usePuskrisRaw(f, ready)
  const onApply = useCallback((next: PuskrisUiFilter) => { setF(next) }, [])
  const derived = useMemo(() => (raw ? applyDerive(raw, toDeriveFilter(f)) : null), [raw, f])
  const kejadianDerived = useMemo(() => derived?.kejadian || [], [derived])

  const packed = useMemo(() => {
    if (!raw || !parsed.valid) return null
    const regionName = Object.fromEntries((raw?.regions || []).map((r: any) => [r.code, r.name]))
    const pack = eventsInWilayah(raw, parsed.kab || parsed.prov, regionName)
    const nama = namaWilayah(raw, pack, pack.list)
    const filtered = filterWilayahList(pack.list, jenis)
    const rekap = rekapKejadian(filtered)
    const kabRows = breakdownKab(filtered)
    const jenisRows = breakdownJenis(filtered)
    const ctx = konteksWilayah(raw, pack, nama)
    return {
      ...pack,
      nama,
      filtered,
      rekap,
      kabRows,
      jenisRows,
      ctx,
      opsiJenis: jenisOptions(pack.list),
      tren: trendBulanan(filtered),
      panasJenis: heatmapJenisBulan(filtered),
      panasKab: heatmapKabJenis(filtered),
      analisa: analisaWilayah(filtered, rekap, kabRows, jenisRows, ctx),
    }
  }, [raw, parsed, jenis])

  useEffect(() => {
    if (!mapFull) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMapFull(false) }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [mapFull])

  const onJenis = (id: string | null) => {
    setJenis(id)
    setF((prev) => ({ ...prev, jenis: id }))
  }

  if (!parsed.valid) {
    return (
      <div className="flex flex-col items-start gap-3 px-6 py-10 lg:px-8">
        <ApiKosong pesan="Kode wilayah tidak dikenali." detail="Gunakan kode Kemendagri provinsi (2 digit) atau kabupaten/kota (4 digit)." />
        <Link href={`${PUBLIC_BASE_PATH}/dashboard/spatial-mode`} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#00705a] hover:underline"><ArrowLeft className="h-3.5 w-3.5" /> Kembali ke peta</Link>
      </div>
    )
  }
  if (error) {
    return (
      <div className="space-y-3 px-6 py-8 lg:px-8 text-sm text-red-700">
        <p>Data Pusat Krisis Kesehatan tidak dapat dimuat: {error}</p>
        <Link href={`${PUBLIC_BASE_PATH}/dashboard/spatial-mode`} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#00705a] hover:underline"><ArrowLeft className="h-3.5 w-3.5" /> Kembali ke peta</Link>
      </div>
    )
  }
  if (!raw || !derived || !packed) {
    return <div className="px-6 py-16 lg:px-8 text-sm font-bold text-slate-500" data-testid="wilayah-detail-loading">Memuat detail wilayah…</div>
  }

  const mapBlock = (
    <PuskrisPetaTerpadu
      variant="card"
      mode="wilayah"
      embed
      raw={raw}
      f={f}
      onApply={onApply}
      derived={derived}
      kejadian={kejadianDerived}
      selectedEvent={selectedEvent}
      setSelectedEvent={setSelectedEvent}
      fokusWilayah={{ code: packed.prov, nama: packed.nama.provinsi, kab: packed.kab }}
    />
  )

  const mapArticle = (
    <article
      data-testid="wilayah-peta-section"
      className={mapFull ? 'fixed inset-0 z-[200] flex flex-col bg-white' : 'flex h-fit flex-col rounded-2xl border border-slate-200 bg-white p-4 sm:p-5'}
    >
      <div className={`flex shrink-0 items-start justify-between gap-3 ${mapFull ? 'border-b border-slate-200 px-4 py-3' : 'mb-3'}`}>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Peta wilayah</p>
          <h2 className="text-[15px] font-bold text-slate-900 sm:text-base">Kejadian di {packed.nama.nama}</h2>
        </div>
        <button
          type="button"
          data-testid="wilayah-peta-perbesar"
          onClick={() => setMapFull((v) => !v)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50"
          title={mapFull ? 'Kembalikan peta ke ukuran semula' : 'Perbesar peta ke layar penuh'}
          aria-pressed={mapFull}
        >
          {mapFull ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          {mapFull ? 'Kecilkan' : 'Perbesar'}
        </button>
      </div>
      <div className={mapFull ? 'min-h-0 flex-1 p-3' : 'h-[280px] sm:h-[320px] lg:h-[360px]'} data-testid="wilayah-peta-canvas">
        {mapBlock}
      </div>
    </article>
  )

  return (
    <div className="flex flex-col gap-5 px-6 py-5 lg:gap-6 lg:px-8 lg:py-6" data-testid="wilayah-detail">
      <WilayahHeaderBand
        nama={packed.nama}
        level={packed.level}
        kode={packed.kab || packed.prov}
        tahun={f.tahun}
        rekap={packed.rekap}
        loadingRange={loadingRange || pending}
      />
      {mapFull && portalReady ? createPortal(mapArticle, document.body) : null}
      <WilayahIndikatorSections
        packed={packed}
        jenis={jenis}
        onJenis={onJenis}
        tahun={f.tahun}
        heroMap={mapFull ? <div className="h-[280px] sm:h-[320px] lg:h-[360px] rounded-2xl border border-dashed border-slate-200 bg-slate-50" aria-hidden /> : mapArticle}
      />
    </div>
  )
}
