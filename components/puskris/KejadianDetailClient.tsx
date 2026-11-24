/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { ArrowLeft, Maximize2, Minimize2 } from 'lucide-react'
import { usePuskrisRaw } from '@/components/puskris/usePuskrisRaw'
import { applyDerive, eocKejadian } from '@/lib/puskris/derive'
import { defaultUiFilter, toDeriveFilter, type PuskrisUiFilter } from '@/lib/puskris/ui-filter'
import PuskrisPetaTerpadu from '@/components/puskris/PuskrisPetaTerpadu'
import ApiKosong from '@/components/puskris/ApiKosong'
import { KejadianHeaderBand, KejadianIndikatorSections } from '@/components/puskris/KejadianDetailSections'
import { PUBLIC_BASE_PATH } from '@/lib/public-path'
import { eocIconOf, eocKindOf, eocPinDataUri, LOK_LABEL, resolveEventCoord, type KabRow } from '@/lib/puskris/eoc-markers'
import { bencanaIconOf } from '@/lib/puskris/bencana-icons'
import { nearbyDetail, rekomendasiDariData, risikoWilayah, riwayat12Bulan, statusOperasional } from '@/lib/puskris/kejadian-detail'
import { pieNamaKey, type PiePayload } from '@/lib/puskris/risiko-pie'
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
  const [pie, setPie] = useState<PiePayload | null>(null)
  const [piePending, setPiePending] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null)
  const [mapFull, setMapFull] = useState(false)
  const [portalReady, setPortalReady] = useState(false)
  const risikoCtrl = useRef<RisikoCtrl | null>(null)

  useEffect(() => { setReady(true); setPortalReady(true) }, [])

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

  useEffect(() => {
    const y = Number(String(k?.tanggal || tahun || '').slice(0, 4))
    if (!Number.isFinite(y) || y < 2015) return
    let on = true
    setPiePending(true)
    const ambil = (coba: number) => {
      fetch(`${PUBLIC_BASE_PATH}/api/puskris/live/pie?tahun=${y}`, { cache: 'no-store' })
        .then(async (r) => ({ status: r.status, j: await r.json().catch(() => null) }))
        .then(({ status, j }) => {
          if (!on) return
          if (j?.ok && j.data?.records) { setPie(j.data); setPiePending(false); return }
          if ((status === 202 || j?.pending) && coba < 6) { setTimeout(() => ambil(coba + 1), 4000); return }
          setPie(null)
          setPiePending(false)
        })
        .catch(() => { if (on) { setPie(null); setPiePending(false) } })
    }
    ambil(0)
    return () => { on = false }
  }, [k, tahun])

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

  const pieKab = useMemo(() => {
    if (!pie?.records?.length || !k) return null
    const kabCode = k.kab_code ? String(k.kab_code).padStart(4, '0') : ''
    const kabNama = pieNamaKey(String(k.kabupaten || ''))
    return pie.records.filter((r) => {
      const kd = String(r.kode_kemendagri || r.kode_kako || '').replace(/\D/g, '').padStart(4, '0')
      if (kabCode && kd === kabCode) return true
      return Boolean(kabNama && pieNamaKey(r.nama_kako) === kabNama)
    }).map((r) => ({ disease: r.penyakit_nama, status: r.status_label }))
  }, [pie, k])

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
      kejadianPaket={{ status, nearby, risiko, riwayat, rekomendasi, konteks }}
      onRisikoControl={(ctrl) => { risikoCtrl.current = ctrl }}
    />
  )

  const mapArticle = (
    <article
      data-testid="kejadian-peta-section"
      className={mapFull ? 'fixed inset-0 z-[200] flex flex-col bg-white' : 'skdr-card flex flex-col p-4 sm:p-5'}
    >
      <div className={`flex shrink-0 items-start justify-between gap-3 ${mapFull ? 'border-b border-slate-200 px-4 py-3' : 'mb-3'}`}>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Peta kejadian</p>
          <h2 className="text-[15px] font-bold text-slate-900 sm:text-base">Lokasi dan lapisan konteks</h2>
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
  )

  return (
    <div className="space-y-5 pb-8" data-testid="kejadian-detail">
      <KejadianHeaderBand k={k} status={status} loadingRange={loadingRange || pending} />
      {mapFull && portalReady ? (
        <>
          <div className="h-[540px] sm:h-[580px] lg:h-[620px] rounded-2xl border border-dashed border-slate-200 bg-slate-50" aria-hidden />
          {createPortal(mapArticle, document.body)}
        </>
      ) : mapArticle}
      <KejadianIndikatorSections
        k={k}
        nearby={nearby}
        riwayat={riwayat}
        konteks={konteks}
        risiko={risiko}
        pieKab={pieKab}
        piePending={piePending}
        onShowAsis={(m) => risikoCtrl.current?.showAsis(m)}
        onShowPie={() => risikoCtrl.current?.showPie()}
      />
    </div>
  )
}
