'use client'

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Sparkles,
  FileText,
  Video,
  Info,
  ShieldAlert,
  Maximize2,
  ExternalLink,
  Loader2,
} from 'lucide-react'
import { PUBLIC_BASE_PATH } from '@/lib/public-path'
import PuskrisAiModal, { PRESENTER_VIDEOS, getEmbedUrl } from './PuskrisAiModal'
import PuskrisInfografisModal from './PuskrisInfografisModal'
import { buildAiInsightReport } from '@/lib/puskris/ai-insight'

interface PuskrisAiDockProps {
  raw: any
  f: any
  derived?: any
  regionLabel?: string
}

const LOCAL_PRESENTER_MP4 = `${PUBLIC_BASE_PATH}/2026-07-17_06-45-52_Lumina_1.mp4`

const SECTION_TONE: Record<string, { wrap: string; badge: string; title: string }> = {
  teal: { wrap: 'border-teal-200 bg-teal-50/60', badge: 'bg-[#00705a]', title: 'text-teal-900' },
  amber: { wrap: 'border-amber-200 bg-amber-50/60', badge: 'bg-amber-600', title: 'text-amber-900' },
  red: { wrap: 'border-red-200 bg-red-50/60', badge: 'bg-red-700', title: 'text-red-900' },
  indigo: { wrap: 'border-indigo-200 bg-indigo-50/60', badge: 'bg-indigo-700', title: 'text-indigo-900' },
  orange: { wrap: 'border-orange-200 bg-orange-50/60', badge: 'bg-orange-600', title: 'text-orange-900' },
  rose: { wrap: 'border-rose-200 bg-rose-50/60', badge: 'bg-rose-700', title: 'text-rose-900' },
  green: { wrap: 'border-emerald-200 bg-emerald-50/60', badge: 'bg-emerald-700', title: 'text-emerald-900' },
  slate: { wrap: 'border-slate-200 bg-slate-50/80', badge: 'bg-slate-700', title: 'text-slate-900' },
}

export default function PuskrisAiDock({
  raw,
  f,
  derived,
  regionLabel = 'Nasional',
}: PuskrisAiDockProps) {
  const [tab, setTab] = useState<'report' | 'video' | 'info'>('report')
  const [isAiModalOpen, setIsAiModalOpen] = useState(false)
  const [isInfografisModalOpen, setIsInfografisModalOpen] = useState(false)
  const [generatingAi, setGeneratingAi] = useState(false)
  const [isFullscreenDockVideo, setIsFullscreenDockVideo] = useState(false)
  const [heygenFailed, setHeygenFailed] = useState(false)
  const [videoIndex, setVideoIndex] = useState(0)

  const formattedTime = useMemo(() => {
    const now = new Date()
    return (
      now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) +
      ' pukul ' +
      now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) +
      ' WIB'
    )
  }, [])

  const report = useMemo(
    () => buildAiInsightReport({ raw, derived, f, regionLabel }),
    [raw, derived, f, regionLabel],
  )

  const videoUrl = PRESENTER_VIDEOS[Math.min(videoIndex, PRESENTER_VIDEOS.length - 1)]?.url || PRESENTER_VIDEOS[0].url

  const handleOpenAiModal = () => {
    setGeneratingAi(true)
    setTimeout(() => {
      setGeneratingAi(false)
      setIsAiModalOpen(true)
    }, 250)
  }

  const stats = report.stats
  const keparahan = !stats
    ? null
    : stats.krisis >= 50 || stats.meninggal >= 100
      ? 'Siaga Tinggi'
      : stats.krisis > 0 || stats.meninggal > 0
        ? 'Waspada'
        : 'Terpantau'

  return (
    <>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-teal-100 bg-[linear-gradient(180deg,rgba(237,251,250,0.95)_0%,rgba(255,255,255,0.92)_100%)] px-2.5 pb-2 pt-2.5">
          <div className="flex items-start gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-teal-200 bg-white shadow-xs">
              <Sparkles className="h-4 w-4 text-[#047D78]" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-[11px] font-black uppercase leading-tight tracking-wide text-[#1a3535]">
                Rekomendasi Insight AI
              </h3>
              <p className="mt-0.5 truncate text-[9px] font-semibold text-slate-500">
                {report.available ? (
                  <>
                    Data generate: <span className="font-bold text-[#047D78]">{formattedTime}</span>
                  </>
                ) : (
                  'Menunggu data API EOC'
                )}
              </p>
              <p className="truncate text-[9px] font-medium text-slate-400">
                {report.stats?.regionLabel || regionLabel} · {f?.tahun || ''}
              </p>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-slate-200 bg-slate-50 px-1 py-1">
          {([
            { id: 'report', label: 'Laporan', icon: FileText },
            { id: 'video', label: 'Video', icon: Video },
            { id: 'info', label: 'Sumber', icon: Info },
          ] as const).map((t) => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex min-w-0 flex-1 items-center justify-center gap-1 rounded-md px-1.5 py-1 text-[9px] font-bold uppercase tracking-wide ${
                  active ? 'bg-white text-[#047D78] shadow-xs' : 'text-slate-500 hover:bg-white/70'
                }`}
              >
                <Icon className="h-3 w-3 shrink-0" />
                <span className="truncate">{t.label}</span>
              </button>
            )
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2">
          {tab === 'report' && (
            <div className="space-y-2">
              {!report.available ? (
                <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-2.5 py-3 text-center text-[10px] font-medium text-slate-500">
                  Data belum tersedia dari API
                </p>
              ) : (
                <>
                  <div className="rounded-lg border border-teal-200/80 bg-white/90 px-2 py-1.5">
                    <div className="flex items-center justify-between gap-1 text-[9px] font-bold">
                      <span className="inline-flex items-center gap-1 text-amber-800">
                        <ShieldAlert className="h-3 w-3" />
                        Status: {keparahan}
                      </span>
                      <span className="text-[#047D78]">
                        {stats?.cfr != null ? `Rasio meninggal ${stats.cfr.toLocaleString('id-ID')}%` : 'Rasio meninggal n/a'}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] leading-snug text-slate-600">{report.preview}</p>
                  </div>
                  {report.sections.map((s) => {
                    const tone = SECTION_TONE[s.color] || SECTION_TONE.slate
                    return (
                      <section key={s.num} className={`rounded-lg border px-2 py-1.5 ${tone.wrap}`}>
                        <p className={`mb-0.5 flex items-center gap-1.5 text-[9px] font-black uppercase leading-tight tracking-wide ${tone.title}`}>
                          <span className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-black text-white ${tone.badge}`}>{s.num}</span>
                          {s.title}
                        </p>
                        <p className="text-[10px] leading-snug text-slate-700">{s.body}</p>
                      </section>
                    )
                  })}
                </>
              )}
            </div>
          )}

          {tab === 'video' && (
            <div className="space-y-2">
              <p className="text-[9px] font-semibold leading-snug text-slate-500">
                Video presenter EOC. Diperkecil agar muat di panel; buka layar penuh atau modal untuk ukuran semula.
              </p>
              <div className="flex gap-1 overflow-x-auto">
                {PRESENTER_VIDEOS.map((v, i) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => { setVideoIndex(i); setHeygenFailed(false) }}
                    className={`shrink-0 rounded-md border px-2 py-0.5 text-[9px] font-bold ${
                      videoIndex === i ? 'border-teal-600 bg-teal-50 text-teal-800' : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    {v.title.replace('Video AI Presenter - Periode ', '')}
                  </button>
                ))}
              </div>
              <div className="mx-auto w-full max-w-[168px]">
                <div className="relative aspect-[9/16] max-h-[220px] w-full overflow-hidden rounded-xl border border-teal-200 bg-slate-900 shadow-inner">
                  {heygenFailed ? (
                    <video
                      src={LOCAL_PRESENTER_MP4}
                      controls
                      playsInline
                      className="h-full w-full object-cover"
                      poster={`${PUBLIC_BASE_PATH}/insight.svg`}
                    />
                  ) : (
                    <iframe
                      src={getEmbedUrl(videoUrl)}
                      className="h-full w-full border-0"
                      allow="autoplay; encrypted-media; fullscreen;"
                      allowFullScreen
                      title="AI Video Presenter"
                      onError={() => setHeygenFailed(true)}
                    />
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsFullscreenDockVideo(true)}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] font-bold text-slate-700 hover:bg-slate-50"
                >
                  <Maximize2 className="h-3 w-3" /> Layar penuh
                </button>
                <a
                  href={videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] font-bold text-slate-700 hover:bg-slate-50"
                >
                  <ExternalLink className="h-3 w-3" /> Buka di tab baru
                </a>
              </div>
              {heygenFailed ? (
                <p className="text-center text-[9px] font-medium text-amber-700">
                  Embed HeyGen tidak tampil. Memutar salinan lokal, atau buka tautan di tab baru.
                </p>
              ) : null}
            </div>
          )}

          {tab === 'info' && (
            <div className="space-y-2 text-[10px] leading-snug text-slate-600">
              <p className="text-[9px] font-black uppercase tracking-wide text-slate-500">Informasi sumber data & AI</p>
              <ul className="list-disc space-y-1 pl-4">
                <li>Angka kejadian, korban, pengungsi, dan terdampak berasal dari API EOC Pusat Krisis Kesehatan, mengikuti filter tahun dan wilayah yang aktif.</li>
                <li>Laporan ini merangkum angka tersebut secara terstruktur. Bukan hasil model prediksi, dan tidak memakai angka cadangan jika data API belum ada.</li>
                <li>Video presenter memakai embed HeyGen EOC (periode bulanan) dan salinan berkas lokal bila embed gagal tampil.</li>
                <li>PSC, ambulans, dan tenaga cadangan dibaca dari API masing-masing di panel kesiapan, bukan dari laporan ini.</li>
              </ul>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-100 bg-white px-2.5 py-2">
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={handleOpenAiModal}
              disabled={generatingAi || !report.available}
              className="inline-flex items-center justify-center gap-1 rounded-lg bg-[#047D78] px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white hover:bg-[#03605c] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {generatingAi ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              Lengkap
            </button>
            <button
              type="button"
              onClick={() => setIsInfografisModalOpen(true)}
              className="inline-flex items-center justify-center gap-1 rounded-lg bg-[#0f766e] px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white hover:bg-[#0d655e]"
            >
              <FileText className="h-3 w-3" />
              Infografis
            </button>
          </div>
        </div>
      </div>

      <PuskrisAiModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        regionLabel={(report.stats?.regionLabel || regionLabel).toUpperCase()}
        aiInsightText={report.fullText}
        formattedTime={formattedTime}
        summaryData={
          stats
            ? {
                totalBencana: stats.terpantau,
                totalKrisis: stats.krisis,
                meninggal: stats.meninggal,
                luka: stats.luka,
                hilang: stats.hilang,
                pengungsi: stats.pengungsi,
                terdampak: stats.terdampak,
                topDisaster: stats.topJenis || undefined,
                topRegion: stats.topWilayah || undefined,
                cfr: stats.cfr != null ? String(stats.cfr) : undefined,
              }
            : undefined
        }
      />

      <PuskrisInfografisModal
        isOpen={isInfografisModalOpen}
        onClose={() => setIsInfografisModalOpen(false)}
      />

      {isFullscreenDockVideo && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm">
          <div className="relative aspect-[9/16] w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-black shadow-2xl">
            {heygenFailed ? (
              <video src={LOCAL_PRESENTER_MP4} controls autoPlay playsInline className="h-full w-full object-cover" />
            ) : (
              <iframe
                src={getEmbedUrl(videoUrl)}
                className="h-full w-full border-0"
                allow="autoplay; encrypted-media; fullscreen;"
                allowFullScreen
                title="Fullscreen Presenter"
              />
            )}
            <button
              type="button"
              onClick={() => setIsFullscreenDockVideo(false)}
              className="absolute right-3 top-3 z-50 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
              aria-label="Tutup video"
            >
              ✕
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
