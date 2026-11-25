'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { createPortal } from 'react-dom'
import { ArrowLeft, MapPin, Maximize2, Minimize2 } from 'lucide-react'
import { usePuskrisRaw } from '@/components/puskris/usePuskrisRaw'
import ApiKosong from '@/components/puskris/ApiKosong'
import PuskrisPetaTerpadu from '@/components/puskris/PuskrisPetaTerpadu'
import { applyDerive, eocKejadian, nf } from '@/lib/puskris/derive'
import { defaultUiFilter, toDeriveFilter, type PuskrisUiFilter } from '@/lib/puskris/ui-filter'
import { PUBLIC_BASE_PATH } from '@/lib/public-path'
import {
  eocIconOf,
  eocKindOf,
  eocPinDataUri,
  LOK_LABEL,
  resolveEventCoord,
  type KabRow,
} from '@/lib/puskris/eoc-markers'
import { bencanaIconOf } from '@/lib/puskris/bencana-icons'
import {
  nearbyDetail,
  rekomendasiDariData,
  risikoWilayah,
  riwayat12Bulan,
  statusOperasional,
} from '@/lib/puskris/kejadian-detail'
import { pieNamaKey, type PiePayload } from '@/lib/puskris/risiko-pie'
import {
  computeHealthRiskScore,
  resolveKejadianTemplate,
  type KejadianTemplate,
} from '@/lib/puskris/kejadian-template'
import kabIndex from '@/lib/puskris/kabkota-index.json'
import KejadianHeroBand from '@/components/puskris/kejadian/KejadianHeroBand'
import BanjirTemplatePanel from '@/components/puskris/kejadian/BanjirTemplatePanel'
import GempaTemplatePanel from '@/components/puskris/kejadian/GempaTemplatePanel'
import KarhutlaTemplatePanel from '@/components/puskris/kejadian/KarhutlaTemplatePanel'
import UmumTemplatePanel from '@/components/puskris/kejadian/UmumTemplatePanel'
import KejadianFaskesDirectory from '@/components/puskris/kejadian/KejadianFaskesDirectory'
import KejadianOperationalTabs from '@/components/puskris/kejadian/KejadianOperationalTabs'
import {
  HealthRiskModal,
  SeismicDetailModal,
  SumberApiModal,
} from '@/components/puskris/kejadian/KejadianModals'
import type { PendukungPayload } from '@/components/puskris/kejadian/types'

type Rekom = { prioritas: 'tinggi' | 'sedang' | 'info'; judul: string; dasar: string }
type RisikoCtrl = { showAsis: (mode: 'irbi' | 'kapasitas') => void; showPie: () => void }

function buildKejadianObject(ev: any) {
  const pos = resolveEventCoord(ev, {}, kabIndex as KabRow[])
  const icon = eocIconOf(ev.jenis)
  const official = bencanaIconOf(ev.jenis)
  return {
    ...ev,
    lat: pos?.lat ?? ev.lat ?? null,
    lon: pos?.lon ?? ev.lon ?? null,
    kind: eocKindOf(ev.jenis),
    icon: {
      id: icon.id,
      label: official?.label || icon.label,
      color: icon.color,
      src:
        official?.src ||
        eocPinDataUri(icon, { krisis: Boolean(ev.krisis), approx: pos?.lok !== 'kejadian' }),
      file: official?.file || null,
    },
    koordinat: pos
      ? { lat: pos.lat, lon: pos.lon, lok: pos.lok, label: LOK_LABEL[pos.lok] }
      : { lat: null, lon: null, lok: 'tidak_tersedia', label: LOK_LABEL.tidak_tersedia },
  }
}

function packFromRaw(raw: any, uid: string) {
  const regionName = Object.fromEntries((raw?.regions || []).map((r: any) => [r.code, r.name]))
  const rawEv = (raw?.eoc?.events || []).find((e: any) => String(e.u) === uid)
  if (!rawEv) return null
  const ev = eocKejadian(rawEv, regionName)
  const kejadian = buildKejadianObject(ev)
  const pos = kejadian.koordinat?.lat != null ? kejadian.koordinat : null
  const nearby = nearbyDetail(raw, ev, pos)
  const risiko = risikoWilayah(raw, ev)
  const riwayat = riwayat12Bulan(raw, ev, regionName)
  const status = statusOperasional(ev)
  const rekomendasi = rekomendasiDariData(ev, nearby, risiko, status)
  return { kejadian, status, nearby, risiko, riwayat, rekomendasi }
}

function packFromEocDetail(eoc: NonNullable<PendukungPayload['eocDetail']>) {
  const ev = {
    uid: eoc.uid,
    tanggal: eoc.tanggal,
    jam: eoc.jam,
    jenis: eoc.jenis,
    kelompok: eoc.kelompok,
    provinsi: eoc.provinsi,
    code: eoc.provCode,
    kabupaten: eoc.kabupaten,
    kab_code: eoc.kabCode,
    kecamatan: eoc.kecamatan,
    krisis: eoc.krisis,
    korban: eoc.korban,
    terdampak: eoc.terdampak,
    meninggal: eoc.meninggal,
    hilang: eoc.hilang,
    luka_berat: eoc.luka_berat,
    luka_ringan: eoc.luka_ringan,
    pengungsi: eoc.pengungsi,
    faskes_rusak: eoc.faskes_rusak,
    lat: eoc.lat,
    lon: eoc.lon,
    url: `https://pusatkrisis.kemkes.go.id/eoc/api/detail_bencana/bencana_detail.php?uid=${encodeURIComponent(eoc.uid)}`,
  }
  const kejadian = buildKejadianObject(ev)
  const status = statusOperasional({ tanggal: ev.tanggal, krisis: Boolean(ev.krisis) })
  return { kejadian, status }
}

export default function KejadianDetailClient({
  id,
  tahun,
  initialTemplate,
}: {
  id: string
  tahun?: string | null
  initialTemplate?: string | null
}) {
  const [f, setF] = useState<PuskrisUiFilter>(() => {
    const d = defaultUiFilter()
    const y = Number(tahun)
    return { ...d, tahun: Number.isFinite(y) && y >= 2015 ? y : d.tahun }
  })
  const [ready, setReady] = useState(false)
  const templateMode: 'auto' | KejadianTemplate = (() => {
    const ov = String(initialTemplate || '').trim().toLowerCase()
    if (ov === 'banjir' || ov === 'gempa' || ov === 'karhutla' || ov === 'umum') return ov
    return 'auto'
  })()

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

  const [pendukung, setPendukung] = useState<PendukungPayload | null>(null)
  const [pendukungLoading, setPendukungLoading] = useState(true)
  const [pendukungError, setPendukungError] = useState<string | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)

  const [mapFull, setMapFull] = useState(false)
  const [portalReady, setPortalReady] = useState(false)
  const [seismicOpen, setSeismicOpen] = useState(false)
  const [riskOpen, setRiskOpen] = useState(false)
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const risikoCtrl = useRef<RisikoCtrl | null>(null)

  useEffect(() => {
    setReady(true)
    setPortalReady(true)
  }, [])

  const { raw, pending, error } = usePuskrisRaw(f, ready)
  const derived = useMemo(
    () => (raw ? applyDerive(raw, toDeriveFilter({ ...f, periode: 'tahun' })) : null),
    [raw, f],
  )

  // 1. Sinkronkan event dari raw ketika tersedia
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
      const y = Number(String(packed.kejadian.tanggal || tahun || '').slice(0, 4))
      if (Number.isFinite(y) && y >= 2015) setF((prev) => (prev.tahun === y ? prev : { ...prev, tahun: y }))
    }
  }, [raw, id, tahun])

  // 2. Ambil data pendukung real-time + EOC detail langsung (tanpa menunggu cache ringkasan tahunan selesai)
  const fetchPendukung = useCallback(async () => {
    setPendukungLoading(true)
    setPendukungError(null)
    try {
      const q = new URLSearchParams()
      if (k?.koordinat?.lat != null && k?.koordinat?.lon != null) {
        q.set('lat', String(k.koordinat.lat))
        q.set('lon', String(k.koordinat.lon))
      }
      if (k?.jenis) q.set('jenis', String(k.jenis))
      if (k?.tanggal) q.set('tanggal', String(k.tanggal))
      if (templateMode !== 'auto') q.set('template', templateMode)
      const url = `${PUBLIC_BASE_PATH}/api/puskris/kejadian/${encodeURIComponent(id)}/pendukung${q.toString() ? `?${q.toString()}` : ''}`
      const res = await fetch(url, { cache: 'no-store' })
      const j = (await res.json()) as PendukungPayload & { error?: string }
      if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`)
      setPendukung(j)

      // Jika kejadian belum dimuat dari raw (atau tahun berbeda), bangun langsung dari eocDetail
      if (j.eocDetail) {
        const direct = packFromEocDetail(j.eocDetail)
        setK((prev: any) => prev || direct.kejadian)
        setStatus((prev: any) => prev || direct.status)
        setSelectedEvent((prev: any) => prev || direct.kejadian)
        const y = Number(String(j.eocDetail.tanggal || '').slice(0, 4))
        if (Number.isFinite(y) && y >= 2015) setF((prev) => (prev.tahun === y ? prev : { ...prev, tahun: y }))
      }
    } catch (e: any) {
      setPendukungError(String(e?.message || e))
    } finally {
      setPendukungLoading(false)
    }
  }, [id, k?.koordinat?.lat, k?.koordinat?.lon, k?.jenis, k?.tanggal, templateMode])

  useEffect(() => {
    fetchPendukung()
  }, [fetchPendukung, refreshTick])

  // 3. Tetap ambil open/konteks untuk kompatibilitas analisa wilayah existing
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
      .then((j) => {
        if (on) setKonteks(j)
      })
      .catch(() => { })
    return () => {
      on = false
    }
  }, [k?.koordinat?.lat, k?.koordinat?.lon, k?.jenis, k?.tanggal])

  // 4. Ambil data PIE kabupaten untuk kewaspadaan penyakit pasca-bencana
  useEffect(() => {
    if (!k) return
    let on = true
    const y = String(k.tanggal || f.tahun || new Date().getFullYear()).slice(0, 4)
    setPiePending(true)
    const ambil = (coba = 0) => {
      fetch(`${PUBLIC_BASE_PATH}/api/puskris/live/pie?tahun=${y}`, { cache: 'no-store' })
        .then(async (r) => ({ st: r.status, j: await r.json().catch(() => null) }))
        .then(({ st, j }) => {
          if (!on) return
          if (j?.ok && j.data?.records) {
            setPie(j.data)
            setPiePending(false)
            return
          }
          if ((st === 202 || j?.pending) && coba < 5) {
            setTimeout(() => ambil(coba + 1), 3500)
            return
          }
          setPie(null)
          setPiePending(false)
        })
        .catch(() => {
          if (on) {
            setPie(null)
            setPiePending(false)
          }
        })
    }
    ambil(0)
    return () => {
      on = false
    }
  }, [k?.uid, k?.tanggal, f.tahun])

  // Escape tutup modal peta layar penuh
  useEffect(() => {
    if (!mapFull) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMapFull(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mapFull])

  const pieRecordsKab = useMemo(() => {
    if (!pie?.records?.length || !k) return []
    const kabCode = k.kab_code ? String(k.kab_code).padStart(4, '0') : ''
    const kabNama = pieNamaKey(String(k.kabupaten || ''))
    return pie.records.filter((r) => {
      const kd = String(r.kode_kemendagri || r.kode_kako || '').replace(/\D/g, '').padStart(4, '0')
      if (kabCode && kd === kabCode) return true
      return Boolean(kabNama && pieNamaKey(r.nama_kako) === kabNama)
    })
  }, [pie, k])

  const pieKab = useMemo(
    () => (pieRecordsKab.length ? pieRecordsKab.map((r) => ({ disease: r.penyakit_nama, status: r.status_label })) : null),
    [pieRecordsKab],
  )

  const pieKotaRich = useMemo(
    () =>
      pieRecordsKab.map((r: any) => ({
        penyakit: r.penyakit_nama,
        nama: r.penyakit_nama,
        status: r.status_label,
        kasus: r.kasus ?? r.jumlah ?? null,
        wilayah: r.nama_kako,
      })),
    [pieRecordsKab],
  )

  const autoTemplate = resolveKejadianTemplate(k?.jenis)
  const activeTemplate: KejadianTemplate = templateMode === 'auto' ? autoTemplate : templateMode

  const riskScore = useMemo(
    () =>
      computeHealthRiskScore({
        template: activeTemplate,
        krisis: k?.krisis,
        korban: k?.korban,
        meninggal: k?.meninggal,
        pengungsi: k?.pengungsi,
        terdampak: k?.terdampak,
        faskesRusak: k?.faskes_rusak,
        rainMm: pendukung?.weather?.eventDayRainMm ?? pendukung?.weather?.current?.rainMm ?? null,
        riverDischarge: pendukung?.banjir?.glofas?.peakDischarge ?? null,
        ispu: pendukung?.airQuality?.current?.ispu ?? null,
        magnitudo:
          pendukung?.gempa?.mainBmkg?.mag ??
          pendukung?.gempa?.maxMag ??
          pendukung?.eocDetail?.facts?.magnitudo ??
          null,
        hotspot50km: pendukung?.karhutla?.count24h50km ?? null,
        indeksRisikoIrbi: risiko?.irbi?.nilai ?? null,
      }),
    [activeTemplate, k, pendukung, risiko],
  )

  // State menunggu data saat belum ada dari ringkasan maupun EOC direct
  if (!k && (pendukungLoading || pending)) {
    return (
      <div className="space-y-4 px-4 py-8 sm:px-6 lg:px-8" data-testid="kejadian-detail-loading">
        <div className="h-56 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
          <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
        </div>
        <p className="text-xs font-semibold text-slate-500">Memuat detail kejadian kode API {id} dan data pendukung real-time…</p>
      </div>
    )
  }

  if (!k) {
    return (
      <div className="flex flex-col items-start gap-3 px-4 py-10 sm:px-6 lg:px-8">
        <ApiKosong
          pesan={`Kejadian dengan kode API "${id}" tidak ditemukan`}
          detail={pendukungError || error || 'Pastikan kode UID EOC valid atau kejadian sudah tercatat pada tahun berjalan.'}
        />
        <div className="flex flex-wrap gap-3">
          <Link
            href={`${PUBLIC_BASE_PATH}/kejadian`}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#00705a] hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Lihat daftar kode kejadian
          </Link>
          <Link
            href={`${PUBLIC_BASE_PATH}/dashboard/spatial-mode`}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:underline"
          >
            Kembali ke Peta Spasial
          </Link>
        </div>
      </div>
    )
  }

  const pscCount = nearby?.psc?.tersedia ? Number(nearby.psc.total || 0) : 0
  const nearbyCount = pscCount + (nearby?.rs?.tersedia ? Number(nearby.rs.total || 0) : 0)
  const tckTotal = nearby?.tck?.tersedia ? Number(nearby.tck.individu ?? nearby.tck.tim ?? 0) : null

  const mapArticle = (
    <article
      data-testid="kejadian-peta-section"
      className={
        mapFull
          ? 'fixed inset-0 z-[200] flex flex-col bg-white'
          : 'skdr-card w-full p-4 sm:p-5'
      }
    >
      <div
        className={`flex flex-wrap items-start justify-between gap-3 ${
          mapFull ? 'border-b border-slate-200 bg-slate-50 px-4 py-3' : 'mb-3 border-b border-slate-100 pb-3'
        }`}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#00705a]">
            <MapPin className="h-3.5 w-3.5" /> Peta Situasi Spasial &amp; Pengaturan Lapisan
          </div>
          <h2 className="mt-0.5 text-base font-black text-slate-900 sm:text-lg">
            Peta Situasi — {k.jenis} ({k.kabupaten}{k.provinsi ? `, ${k.provinsi}` : ''})
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Menampilkan posisi kejadian, radius layanan 50/100/200 km, jejaring PSC 119/ambulans/RS, lapisan BNPB InaRISK, API Intelijen Eksternal, serta pengaturan peta yang sama di seluruh halaman kejadian.
          </p>
        </div>
        {raw && derived ? (
          <button
            type="button"
            data-testid="kejadian-peta-perbesar"
            onClick={() => setMapFull((v) => !v)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50"
            aria-pressed={mapFull}
          >
            {mapFull ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5 text-[#00705a]" />}
            {mapFull ? 'Kecilkan' : 'Perbesar'}
          </button>
        ) : null}
      </div>

      <div
        className={
          mapFull
            ? 'min-h-0 flex-1 p-3'
            : 'h-[540px] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 sm:h-[580px] lg:h-[620px]'
        }
        data-testid="kejadian-peta-canvas"
      >
        {raw && derived ? (
          <PuskrisPetaTerpadu
            variant="card"
            raw={raw}
            f={f}
            onApply={setF}
            derived={derived}
            kejadian={derived.kejadian || []}
            selectedEvent={selectedEvent}
            setSelectedEvent={setSelectedEvent}
            mode="kejadian"
            embed
            rightDockDefaultOpen={true}
            fokusKejadian={k}
            kejadianPaket={{ status, nearby, risiko, riwayat, rekomendasi, konteks }}
            onRisikoControl={(ctrl) => {
              risikoCtrl.current = ctrl
            }}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-[#00705a]" />
            <p className="text-xs font-semibold text-slate-500">
              Sedang memuat Peta Situasi Spasial &amp; Pengaturan Lapisan…
            </p>
          </div>
        )}
      </div>
    </article>
  )

  return (
    <div className="space-y-5 px-4 pb-10 pt-2 sm:px-6 lg:px-8" data-testid="kejadian-detail-page">
      {/* 1. Revamped 3-Column Hero Card + 3 Stacked Right KPI Cards */}
      <KejadianHeroBand
        kejadian={k}
        template={activeTemplate}
        pendukung={pendukung}
        pendukungLoading={pendukungLoading}
        onRefreshPendukung={() => setRefreshTick((n) => n + 1)}
        riskScore={riskScore}
        ops={{ irbi: risiko?.irbi?.nilai, kelas: risiko?.irbi?.kelas, statusLayanan: status?.label }}
        nearbyCount={nearbyCount}
        pscCount={pscCount}
        tckTotal={tckTotal}
        onOpenRiskModal={() => setRiskOpen(true)}
        onOpenSeismicModal={() => setSeismicOpen(true)}
        onOpenSourcesModal={() => setSourcesOpen(true)}
      />

      {/* 2. Template Telemetry Panels (Banjir / Gempa / Karhutla / Umum) */}
      {activeTemplate === 'banjir' ? (
        <BanjirTemplatePanel kejadian={k} pendukung={pendukung} pieKota={pieKotaRich} />
      ) : activeTemplate === 'gempa' ? (
        <GempaTemplatePanel
          kejadian={k}
          pendukung={pendukung}
          onOpenSeismicModal={() => setSeismicOpen(true)}
        />
      ) : activeTemplate === 'karhutla' ? (
        <KarhutlaTemplatePanel kejadian={k} pendukung={pendukung} pieKota={pieKotaRich} />
      ) : (
        <UmumTemplatePanel pendukung={pendukung} />
      )}

      {/* 3. Peta Situasi (1 Kolom Penuh Melebar menggunakan PuskrisPetaTerpadu + Pengaturan Lapisan) */}
      {mapFull ? (
        <div className="h-[540px] w-full rounded-2xl border border-dashed border-slate-200 bg-slate-50 sm:h-[580px] lg:h-[620px]" aria-hidden />
      ) : (
        mapArticle
      )}

      {/* 4. Jejaring Rujukan & Gawat Darurat (<= 80 km) tepat di bawah peta */}
      <KejadianFaskesDirectory kejadian={k} nearby={nearby} raw={raw} />

      {/* 5. Operational Capacity Tabs (Analisa, Faskes 50 km, TCK & Logistik, Pos Pengungsi & Riwayat) */}
      <KejadianOperationalTabs
        k={k}
        nearby={nearby}
        riwayat={riwayat}
        konteks={konteks}
        risiko={risiko}
        pieKab={pieKab}
        piePending={piePending}
        status={status}
        pendukung={pendukung}
        onShowAsis={() => {
          setMapFull(true)
          setTimeout(() => risikoCtrl.current?.showAsis('irbi'), 150)
        }}
        onShowPie={() => {
          setMapFull(true)
          setTimeout(() => risikoCtrl.current?.showPie(), 150)
        }}
      />

      {mapFull && portalReady ? createPortal(mapArticle, document.body) : null}

      {/* Modals */}
      <SeismicDetailModal
        open={seismicOpen}
        onClose={() => setSeismicOpen(false)}
        gempa={pendukung?.gempa || null}
        kabupaten={k.kabupaten || 'Wilayah Kejadian'}
      />
      <HealthRiskModal open={riskOpen} onClose={() => setRiskOpen(false)} risk={riskScore} />
      <SumberApiModal
        open={sourcesOpen}
        onClose={() => setSourcesOpen(false)}
        status={raw?.sources_status}
        pendukung={pendukung}
      />
    </div>
  )
}
