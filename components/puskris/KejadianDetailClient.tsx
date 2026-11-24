'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { usePuskrisRaw } from '@/components/puskris/usePuskrisRaw'
import { applyDerive, eocKejadian } from '@/lib/puskris/derive'
import { defaultUiFilter, toDeriveFilter, type PuskrisUiFilter } from '@/lib/puskris/ui-filter'
import PuskrisPetaTerpadu from '@/components/puskris/PuskrisPetaTerpadu'
import ApiKosong from '@/components/puskris/ApiKosong'
import { PUBLIC_BASE_PATH } from '@/lib/public-path'
import { eocIconOf, eocKindOf, eocPinDataUri, fmtAngka, LOK_LABEL, resolveEventCoord, tglKejadian, type KabRow } from '@/lib/puskris/eoc-markers'
import { bencanaIconOf } from '@/lib/puskris/bencana-icons'
import { nearbyDetail, rekomendasiDariData, risikoWilayah, riwayat12Bulan, statusOperasional } from '@/lib/puskris/kejadian-detail'
import kabIndex from '@/lib/puskris/kabkota-index.json'

type Rekom = { prioritas: 'tinggi' | 'sedang' | 'info'; judul: string; dasar: string }

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
    kind: eocKindOf(ev.jenis),
    icon: { id: icon.id, label: official?.label || icon.label, color: icon.color, src: official?.src || eocPinDataUri(icon, { krisis: Boolean(ev.krisis), approx: pos?.lok !== 'kejadian' }), file: official?.file || null },
    koordinat: pos ? { lat: pos.lat, lon: pos.lon, lok: pos.lok, label: LOK_LABEL[pos.lok] } : { lat: null, lon: null, lok: 'tidak_tersedia', label: LOK_LABEL.tidak_tersedia },
  }
  return { kejadian, status, nearby, risiko, riwayat, rekomendasi }
}


function Kpi({ label, value, tone = 'slate' }: { label: string; value: string; tone?: 'slate' | 'red' | 'amber' | 'teal' }) {
  const color = { slate: 'text-slate-900', red: 'text-red-700', amber: 'text-amber-700', teal: 'text-teal-800' }[tone]
  return (
    <div className="min-w-0 px-2.5 py-1" data-testid="kejadian-kpi">
      <div className="truncate text-[9.5px] font-black uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-base font-black leading-tight tabular-nums ${color}`}>{value}</div>
    </div>
  )
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

  const firmen = konteks?.karhutla?.total
  const rekomPlus = useMemo(() => {
    const extra: Rekom[] = []
    if (typeof firmen === 'number' && firmen > 0) {
      extra.push({ prioritas: 'info', judul: 'Ada titik panas FIRMS di sekitar lokasi', dasar: `NASA FIRMS: ${Number(firmen).toLocaleString('id-ID')} titik dalam ${konteks.karhutla.radius_km} km.` })
    }
    return [...rekomendasi, ...extra]
  }, [rekomendasi, firmen, konteks])

  if (error) {
    return <div className="flex h-screen items-center justify-center p-6 text-sm text-red-700">Data Pusat Krisis Kesehatan tidak dapat dimuat: {error}</div>
  }
  if (paketSt === 'kosong' || paketSt === 'error') {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 p-6">
        <ApiKosong pesan={pesan || 'Data belum tersedia dari API'} detail={pesan} />
        <Link href={`${PUBLIC_BASE_PATH}/dashboard/spatial-mode`} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#00705a] hover:underline"><ArrowLeft className="h-3.5 w-3.5" /> Kembali ke peta</Link>
      </div>
    )
  }
  if (paketSt !== 'ok' || !k || !raw || !derived) {
    return <div className="flex h-screen items-center justify-center text-sm font-bold text-slate-500" data-testid="kejadian-detail-loading">Memuat peta kejadian…</div>
  }

  const hudTitle = (
    <div className="flex min-w-0 items-center gap-2">
      <Link href={`${PUBLIC_BASE_PATH}/dashboard/spatial-mode`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" title="Kembali ke Spatial Mode" aria-label="Kembali ke Spatial Mode">
        <ArrowLeft className="h-4 w-4" />
      </Link>
      {k.icon?.src ? <img alt="" aria-hidden src={k.icon.src} className="h-8 w-7 shrink-0 object-contain" /> : null}
      <div className="min-w-0">
        <p className="truncate text-[9.5px] font-black uppercase tracking-widest text-primary">Pusat Krisis Kesehatan · Detail kejadian</p>
        <h1 className="truncate text-sm font-black leading-tight text-slate-900">
          {k.jenis} · {[k.kabupaten, k.provinsi].filter(Boolean).join(', ')} · {tglKejadian(k.tanggal, k.jam)}
          {loadingRange ? ' · memuat rentang…' : ''}
        </h1>
      </div>
      {k.url ? (
        <a href={k.url} target="_blank" rel="noreferrer" className="ml-1 inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2.5 text-[11px] font-bold text-teal-800 hover:bg-teal-100">
          Sumber EOC <ExternalLink className="h-3.5 w-3.5" />
        </a>
      ) : null}
    </div>
  )

  const hudExtra = (
    <div className="flex flex-wrap items-stretch divide-x divide-slate-100 self-start rounded-2xl border border-slate-200 bg-white/95 py-1 shadow-lg backdrop-blur" data-testid="kejadian-kpi-strip">
      <Kpi label="Meninggal" value={fmtAngka(k.meninggal)} tone="red" />
      <Kpi label="Luka berat" value={fmtAngka(k.luka_berat)} />
      <Kpi label="Luka ringan" value={fmtAngka(k.luka_ringan)} />
      <Kpi label="Hilang" value={fmtAngka(k.hilang)} />
      <Kpi label="Pengungsi" value={fmtAngka(k.pengungsi)} tone="amber" />
      <Kpi label="Terdampak" value={fmtAngka(k.terdampak)} />
      <Kpi label="Faskes rusak" value={fmtAngka(k.faskes_rusak)} />
    </div>
  )

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-100" data-testid="kejadian-detail">
      <PuskrisPetaTerpadu
        variant="fullscreen"
        mode="kejadian"
        raw={raw}
        f={f}
        onApply={onApply}
        derived={derived}
        kejadian={kejadian}
        selectedEvent={selectedEvent}
        setSelectedEvent={setSelectedEvent}
        hudTitle={hudTitle}
        hudExtra={hudExtra}
        fokusKejadian={k}
        kejadianPaket={{ status, nearby, risiko, riwayat, rekomendasi: rekomPlus, konteks }}
      />
    </div>
  )
}

