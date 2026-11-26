/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Maximize2, Minimize2 } from 'lucide-react'
import { usePuskrisRaw } from '@/components/puskris/usePuskrisRaw'
import { applyDerive } from '@/lib/puskris/derive'
import { defaultUiFilter, toDeriveFilter, type PuskrisUiFilter } from '@/lib/puskris/ui-filter'
import PuskrisPetaTerpadu from '@/components/puskris/PuskrisPetaTerpadu'
import ApiKosong from '@/components/puskris/ApiKosong'
import { JenisKejadianSections } from '@/components/puskris/JenisKejadianSections'
import { PUBLIC_BASE_PATH } from '@/lib/public-path'
import {
  allJenisNames,
  jenisKejadianHref,
  jenisKejadianIndexHref,
  packJenisKejadian,
  resolveJenis,
  eventsNasional,
  rekapKejadian,
} from '@/lib/puskris/jenis-kejadian'

export default function JenisKejadianClient({
  slug, tahun, prov: provAwal,
}: {
  slug: string | null
  tahun?: string | null
  prov?: string | null
}) {
  const router = useRouter()
  const [f, setF] = useState<PuskrisUiFilter>(() => {
    const d = defaultUiFilter()
    const y = Number(tahun)
    const next = Number.isFinite(y) && y >= 2015 ? { ...d, tahun: y } : d
    const p = String(provAwal || '').replace(/\D/g, '').padStart(2, '0').slice(0, 2)
    return { ...next, provinsi: p.length === 2 && p !== '00' ? p : null, jenis: null }
  })
  const [ready, setReady] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null)
  const [mapFull, setMapFull] = useState(false)
  const [portalReady, setPortalReady] = useState(false)

  useEffect(() => { setReady(true); setPortalReady(true) }, [])

  const { raw, error, loadingRange, pending } = usePuskrisRaw(f, ready)
  const prevFilter = useMemo<PuskrisUiFilter>(() => ({ ...f, tahun: f.tahun - 1 }), [f])
  const prev = usePuskrisRaw(prevFilter, ready && Boolean(raw))
  const onApply = useCallback((next: PuskrisUiFilter) => { setF(next) }, [])
  const derived = useMemo(() => (raw ? applyDerive(raw, toDeriveFilter(f)) : null), [raw, f])
  const kejadianDerived = useMemo(() => derived?.kejadian || [], [derived])

  const names = useMemo(() => (raw ? allJenisNames(raw) : []), [raw])
  const jenis = useMemo(() => (slug ? resolveJenis(slug, names) : null), [slug, names])
  const listSemua = useMemo(() => (raw ? eventsNasional(raw, null, f.provinsi).list : []), [raw, f.provinsi])
  const regionsAll = useMemo(() => (
    (raw?.regions || []).map((r: any) => ({
      code: String(r.code).padStart(2, '0').slice(0, 2),
      nama: r.name,
    })).sort((a: any, b: any) => String(a.nama).localeCompare(String(b.nama), 'id'))
  ), [raw])

  useEffect(() => {
    if (!jenis) return
    setF((prevF) => (prevF.jenis === jenis ? prevF : { ...prevF, jenis }))
  }, [jenis])

  const packed = useMemo(() => {
    if (!raw || !jenis) return null
    return packJenisKejadian(raw, jenis, f.tahun, f.provinsi)
  }, [raw, jenis, f.tahun, f.provinsi])

  const prevRekap = useMemo(() => {
    if (!prev.raw || !jenis) return null
    const { list } = eventsNasional(prev.raw, jenis, f.provinsi)
    if (!list.length) return null
    return { tahun: f.tahun - 1, rekap: rekapKejadian(list), tren: packJenisKejadian(prev.raw, jenis, f.tahun - 1, f.provinsi).tren }
  }, [prev.raw, jenis, f.provinsi, f.tahun])

  useEffect(() => {
    if (!mapFull) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMapFull(false) }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [mapFull])

  const goJenis = (nama: string | null) => {
    if (!nama) {
      router.push(`/dashboard/jenis-kejadian${qsOf(f)}`)
      return
    }
    router.push(jenisKejadianHref(nama, { tahun: f.tahun, prov: f.provinsi }))
  }

  const onTahun = (y: number) => {
    setF((prevF) => ({ ...prevF, tahun: y }))
    const href = jenis ? jenisKejadianHref(jenis, { tahun: y, prov: f.provinsi }) : `/dashboard/jenis-kejadian?tahun=${y}${f.provinsi ? `&prov=${f.provinsi}` : ''}`
    router.replace(href)
  }

  const onProv = (code: string | null) => {
    setF((prevF) => ({ ...prevF, provinsi: code }))
    const href = jenis
      ? jenisKejadianHref(jenis, { tahun: f.tahun, prov: code })
      : jenisKejadianIndexHref({ tahun: f.tahun, prov: code })
    router.replace(href)
  }

  if (error) {
    return (
      <div className="space-y-3 bg-[#fbffff] px-3 py-8 sm:px-6 lg:px-8 text-sm text-red-700">
        <p>Data Pusat Krisis Kesehatan tidak dapat dimuat: {error}</p>
        <Link href="/dashboard/spatial-mode" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#047D78] hover:underline"><ArrowLeft className="h-3.5 w-3.5" /> Kembali ke peta</Link>
      </div>
    )
  }
  if (!raw || !derived) {
    return <div className="bg-[#fbffff] px-3 py-16 sm:px-6 lg:px-8 text-sm font-bold text-slate-500" data-testid="jenis-kejadian-loading">Memuat detail jenis kejadian…</div>
  }
  if (slug && names.length && !jenis) {
    return (
      <div className="flex flex-col items-start gap-3 bg-[#fbffff] px-3 py-10 sm:px-6 lg:px-8">
        <ApiKosong pesan="Jenis kejadian tidak dikenali." detail="Pilih jenis dari data API EOC pada halaman ini." />
        <JenisKejadianSections
          packed={null}
          names={names}
          jenis={null}
          tahun={f.tahun}
          prov={f.provinsi}
          onJenis={goJenis}
          onTahun={onTahun}
          onProv={onProv}
          loadingRange={loadingRange || pending}
          heroMap={null}
          prevRekap={null}
          listSemua={listSemua}
          regions={regionsAll}
        />
      </div>
    )
  }

  const mapBlock = jenis ? (
    <PuskrisPetaTerpadu
      variant="card"
      mode="dasbor"
      embed
      raw={raw}
      f={f}
      onApply={onApply}
      derived={derived}
      kejadian={kejadianDerived}
      selectedEvent={selectedEvent}
      setSelectedEvent={setSelectedEvent}
    />
  ) : null

  const mapArticle = jenis ? (
    <article
      data-testid="jenis-peta-section"
      className={mapFull ? 'fixed inset-0 z-[200] flex flex-col bg-white' : 'rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-[0_4px_12px_rgba(0,0,0,0.02)]'}
    >
      <div className={`flex shrink-0 items-start justify-between gap-3 ${mapFull ? 'border-b border-slate-200 px-4 py-3' : 'mb-3 border-b border-slate-100 pb-2'}`}>
        <div className="min-w-0">
          <h4 className="text-xl sm:text-2xl font-black uppercase text-slate-900">Pemetaan Spasial Kejadian Bencana - {jenis.toUpperCase()} · INDONESIA</h4>
          <p className="mt-1 text-sm sm:text-base font-normal text-slate-600">
            Peta hanya menampilkan kejadian {jenis} di seluruh Indonesia pada tahun {f.tahun}. Warna provinsi mengikuti jumlah kejadian; klik titik untuk membuka detail kejadian, atau buka halaman wilayah dari poligon.
          </p>
        </div>
        <button
          type="button"
          data-testid="jenis-peta-perbesar"
          onClick={() => setMapFull((v) => !v)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50"
          title={mapFull ? 'Kembalikan peta ke ukuran semula' : 'Perbesar peta ke layar penuh'}
          aria-pressed={mapFull}
        >
          {mapFull ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          {mapFull ? 'Kecilkan' : 'Perbesar'}
        </button>
      </div>
      <div className={mapFull ? 'min-h-0 flex-1 p-3' : 'mt-2 h-[540px] sm:h-[580px] lg:h-[620px] overflow-hidden rounded-xl border border-slate-200 shadow-inner'} data-testid="jenis-peta-canvas">
        {mapBlock}
      </div>
    </article>
  ) : null

  return (
    <div className="w-full max-w-full overflow-x-hidden space-y-5 bg-[#fbffff] px-3 py-4 sm:px-6 lg:px-8 animate-in fade-in duration-200" data-testid="jenis-kejadian-detail">
      {mapFull && portalReady && mapArticle ? createPortal(mapArticle, document.body) : null}
      <JenisKejadianSections
        packed={packed}
        names={names}
        jenis={jenis}
        tahun={f.tahun}
        prov={f.provinsi}
        onJenis={goJenis}
        onTahun={onTahun}
        onProv={onProv}
        loadingRange={loadingRange || pending}
        listSemua={listSemua}
        regions={regionsAll}
        heroMap={mapFull ? <div className="h-[540px] sm:h-[580px] lg:h-[620px] rounded-2xl border border-dashed border-slate-200 bg-slate-50" aria-hidden /> : mapArticle}
        prevRekap={prevRekap}
      />
    </div>
  )
}

function qsOf(f: PuskrisUiFilter) {
  const q = new URLSearchParams()
  if (f.tahun) q.set('tahun', String(f.tahun))
  if (f.provinsi) q.set('prov', f.provinsi)
  const s = q.toString()
  return s ? `?${s}` : ''
}
