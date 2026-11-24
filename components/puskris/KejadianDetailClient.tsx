/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Maximize2, Minimize2 } from 'lucide-react'
import { usePuskrisRaw } from '@/components/puskris/usePuskrisRaw'
import { applyDerive, eocKejadian } from '@/lib/puskris/derive'
import { defaultUiFilter, toDeriveFilter, type PuskrisUiFilter } from '@/lib/puskris/ui-filter'
import PuskrisPetaTerpadu from '@/components/puskris/PuskrisPetaTerpadu'
import ApiKosong from '@/components/puskris/ApiKosong'
import { KejadianAnalisisSection, KejadianHeaderBand, KejadianResponSection, KejadianRingkasanSituasi } from '@/components/puskris/KejadianDetailSections'
import { PUBLIC_BASE_PATH } from '@/lib/public-path'
import { eocIconOf, eocKindOf, eocPinDataUri, LOK_LABEL, resolveEventCoord, type KabRow } from '@/lib/puskris/eoc-markers'
import { bencanaIconOf } from '@/lib/puskris/bencana-icons'
import { nearbyDetail, rekomendasiDariData, risikoWilayah, riwayat12Bulan, statusOperasional } from '@/lib/puskris/kejadian-detail'
import kabIndex from '@/lib/puskris/kabkota-index.json'

type Rekom = { prioritas: 'tinggi' | 'sedang' | 'info'; judul: string; dasar: string }
type RisikoCtrl = { showAsis: (mode: 'irbi' | 'kapasitas') => void; showPie: () => void }

function packFromRaw(raw: any, uid: string) {
  const regionName = Object.fromEntries((raw?.regions || []).map((r: any) => [r.code, r.name]))
  const rawEv = (raw?.eoc?.events || []).find((e: any) => String(e.u) === uid)
  if (!rawEv) return null
  const ev = eocKejadian(rawEv, regionName)
  const pos = resolveEventCoord(ev, {}, kabIndex as KabRow[])
  const icon = eocIconOf(ev.jenis)
  const official = bencanaIconOf(ev.jenis)
  const nearby = nearbyDetail(raw, ev, pos)
  const risiko = risikoWilayah(raw, ev)
  const riwayat = riwayat12Bulan(raw, ev, regionName)
  const status = statusOperasional(ev)
  const rekomendasi = rekomendasiDariData(ev, nearby, risiko, status)
  const kejadian = {
    ...ev,
    lat: pos?.lat ?? ev.lat ?? null,
    lon: pos?.lon ?? ev.lon ?? null,
    kind: eocKindOf(ev.jenis),
    icon: { id: icon.id, label: official?.label || icon.label, color: icon.color, src: official?.src || eocPinDataUri(icon, { krisis: Boolean(ev.krisis), approx: pos?.lok !== 'kejadian' }), file: official?.file || null },
    koordinat: pos ? { lat: pos.lat, lon: pos.lon, lok: pos.lok, label: LOK_LABEL[pos.lok] } : { lat: null, lon: null, lok: 'tidak_tersedia', label: LOK_LABEL.tidak_tersedia },
  }
  return { kejadian, status, nearby, risiko, riwayat, rekomendasi }
}

export default function KejadianDetailClient({ id, tahun }: { id: string; tahun?: string | null }) {
  const [f, setF] = useState<PuskrisUiFilter>(() => {
    const d = defaultUiFilter()
    const y = Number(tahun)
    return Number.isFinite(y) && y >= 2015 ? { ...d, tahun: y } : d
  })
  const [ready, setReady] = useState(false)
  const [paketSt, setPaketSt] = useState<'muat' | 'ok' | 'kosong' | 'error'>('muat')
  const [pesan, setPesan] = useState<string | null>(null)
  const [k, setK] = useState<any | null>(null)
  const [status, setStatus] = useState<any>(null)
  const [nearby, setNearby] = useState<any>(null)
  const [risiko, setRisiko] = useState<any>(null)
  const [riwayat, setRiwayat] = useState<any>(null)
  const [rekomendasi, setRekomendasi] = useState<Rekom[]>([])
  const [konteks, setKonteks] = useState<any>(null)
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null)
  const [mapFull, setMapFull] = useState(false)
  const risikoCtrl = useRef<RisikoCtrl | null>(null)

  useEffect(() => { setReady(true) }, [])

  useEffect(() => {
    if (!k?.koordinat?.lat || !k?.koordinat?.lon) return
    let on = true
    const q = new URLSearchParams({
      lat: String(k.koordinat.lat),
      lon: String(k.koordinat.lon),
      jenis: k.jenis || '',
    })
    if (k.tanggal) q.set('tanggal', k.tanggal)
    fetch(`${PUBLIC_BASE_PATH}/api/puskris/open/konteks?${q.toString()}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => { if (on) setKonteks(j) })
      .catch(() => { if (on) setKonteks(null) })
    return () => { on = false }
  }, [k])

  const { raw, error, loadingRange, pending } = usePuskrisRaw(f, ready)
  const onApply = useCallback((next: PuskrisUiFilter) => { setF(next) }, [])
  const derived = useMemo(() => (raw ? applyDerive(raw, toDeriveFilter(f)) : null), [raw, f])
  const kejadian = useMemo(() => derived?.kejadian || [], [derived])

  useEffect(() => {
    if (!raw) return
    const packed = packFromRaw(raw, id)
    if (packed) {
      setK(packed.kejadian)
      setStatus(packed.status)
      setNearby(packed.nearby)
      setRisiko(packed.risiko)
      setRiwayat(packed.riwayat)
      setRekomendasi(packed.rekomendasi || [])
      setSelectedEvent(packed.kejadian)
      setPaketSt('ok')
      const y = Number(String(packed.kejadian.tanggal || tahun || '').slice(0, 4))
      if (Number.isFinite(y) && y >= 2015) setF((prev) => (prev.tahun === y ? prev : { ...prev, tahun: y }))
      return
    }
    if (pending) {
      setPaketSt('muat')
      setPesan('Sedang mengambil data dari API…')
    } else {
      setPaketSt('kosong')
      setPesan('Data belum tersedia dari API')
    }
  }, [raw, id, tahun, pending])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMapFull(false) }
    if (!mapFull) return
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [mapFull])

  const firmen7 = konteks?.karhutla?.total_7hari ?? konteks?.karhutla?.total
  const firmen24 = konteks?.karhutla?.total_24jam
  const rekomPlus = useMemo(() => {
    const extra: Rekom[] = []
    if (typeof firmen7 === 'number' && firmen7 > 0) {
      extra.push({
        prioritas: 'info',
        judul: 'Ada titik panas FIRMS di sekitar lokasi',
        dasar: `NASA FIRMS: ${Number(firmen24 || 0).toLocaleString('id-ID')} titik dalam 24 jam dan ${Number(firmen7).toLocaleString('id-ID')} dalam 7 hari, radius ${konteks.karhutla.radius_km} km.`,
      })
    }
    return [...rekomendasi, ...extra]
  }, [rekomendasi, firmen7, firmen24, konteks])

  if (error) {
    return (
      <div className="space-y-3 py-8 text-sm text-red-700">
        <p>Data Pusat Krisis Kesehatan tidak dapat dimuat: {error}</p>
        <Link href={`${PUBLIC_BASE_PATH}/dashboard/spatial-mode`} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#00705a] hover:underline"><ArrowLeft className="h-3.5 w-3.5" /> Kembali ke peta</Link>
      </div>
    )
  }
  if (paketSt === 'kosong' || paketSt === 'error') {
    return (
      <div className="flex flex-col items-start gap-3 py-10">
        <ApiKosong pesan={pesan || 'Data belum tersedia dari API'} detail={pesan} />
        <Link href={`${PUBLIC_BASE_PATH}/dashboard/spatial-mode`} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#00705a] hover:underline"><ArrowLeft className="h-3.5 w-3.5" /> Kembali ke peta</Link>
      </div>
    )
  }
  if (paketSt !== 'ok' || !k || !raw || !derived) {
    return <div className="py-16 text-sm font-bold text-slate-500" data-testid="kejadian-detail-loading">Memuat detail kejadian…</div>
  }

  const mapBlock = (
    <PuskrisPetaTerpadu
      variant="card"
      mode="kejadian"
      embed
      raw={raw}
      f={f}
      onApply={onApply}
      derived={derived}
      kejadian={kejadian}
      selectedEvent={selectedEvent}
      setSelectedEvent={setSelectedEvent}
      fokusKejadian={k}
      kejadianPaket={{ status, nearby, risiko, riwayat, rekomendasi: rekomPlus, konteks }}
      onRisikoControl={(ctrl) => { risikoCtrl.current = ctrl }}
    />
  )

  return (
    <div className="space-y-8 pb-8" data-testid="kejadian-detail">
      <KejadianHeaderBand k={k} status={status} loadingRange={loadingRange || pending} />

      <KejadianRingkasanSituasi k={k} status={status} nearby={nearby} riwayat={riwayat} konteks={konteks} />

      <article
        data-testid="kejadian-peta-section"
        className={mapFull ? 'fixed inset-0 z-[100] flex flex-col bg-white' : 'skdr-card flex flex-col p-4 sm:p-5'}
      >
        <div className={`flex shrink-0 items-start justify-between gap-3 ${mapFull ? 'border-b border-slate-200 px-4 py-3' : 'mb-3'}`}>
          <div className="min-w-0">
            <p className="skdr-eyebrow">Peta kejadian</p>
            <h2 className="text-base font-bold text-slate-900 sm:text-lg">Lokasi, radius dukungan, dan lapisan konteks</h2>
          </div>
          <button
            type="button"
            data-testid="kejadian-peta-perbesar"
            onClick={() => setMapFull((v) => !v)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50"
            title={mapFull ? 'Kembalikan peta ke ukuran semula' : 'Perbesar peta ke layar penuh'}
            aria-pressed={mapFull}
          >
            {mapFull ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            {mapFull ? 'Kecilkan' : 'Perbesar'}
          </button>
        </div>
        <div className={mapFull ? 'min-h-0 flex-1 p-3' : 'h-[540px] sm:h-[580px] lg:h-[620px]'} data-testid="kejadian-peta-canvas">
          {mapBlock}
        </div>
      </article>

      <KejadianAnalisisSection k={k} riwayat={riwayat} konteks={konteks} nearby={nearby} />

      <KejadianResponSection
        nearby={nearby}
        rekomendasi={rekomPlus}
        risiko={risiko}
        onShowAsis={(m) => risikoCtrl.current?.showAsis(m)}
        onShowPie={() => risikoCtrl.current?.showPie()}
      />
    </div>
  )
}
