'use client'

import { useState } from 'react'
import {
  Sparkles,
  FileText,
  Video,
  Info,
  X,
  AlertTriangle,
  Clock,
  Maximize2,
  Check,
} from 'lucide-react'

export type PresenterVideo = {
  id: number
  title: string
  url: string
}

export const PRESENTER_VIDEOS: PresenterVideo[] = [
  {
    id: 1,
    title: 'Video AI Presenter - Periode Juli 2026',
    url: 'https://app.heygen.com/embeds/cbfda07fa0ad4e338dbe19d7eff5be75',
  },
  {
    id: 2,
    title: 'Video AI Presenter - Periode Juni 2026',
    url: 'https://app.heygen.com/embeds/cbfda07fa0ad4e338dbe19d7eff5be75',
  },
  {
    id: 3,
    title: 'Video AI Presenter - Periode Mei 2026',
    url: 'https://app.heygen.com/embeds/07445718ccb54423a319f7df5d830a0f',
  },
]

export function getEmbedUrl(url: string) {
  if (!url) return ''
  if (url.includes('heygen.com')) {
    return url.includes('?') ? url : `${url}?autoplay=true&loop=true`
  }
  if (url.includes('youtu.be/')) {
    const id = url.split('youtu.be/')[1]?.split(/[?#]/)[0]
    return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}`
  }
  if (url.includes('v=')) {
    const id = url.split('v=')[1]?.split('&')[0]?.split(/[?#]/)[0]
    return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}`
  }
  return url
}

interface PuskrisAiModalProps {
  isOpen: boolean
  onClose: () => void
  regionLabel?: string
  aiInsightText: string
  formattedTime?: string
  summaryData?: {
    totalBencana?: number
    totalKrisis?: number
    meninggal?: number
    luka?: number
    hilang?: number
    pengungsi?: number
    terdampak?: number
    topDisaster?: string
    topRegion?: string
    cfr?: string
  }
}

export default function PuskrisAiModal({
  isOpen,
  onClose,
  regionLabel = 'NASIONAL',
  aiInsightText,
  formattedTime,
  summaryData,
}: PuskrisAiModalProps) {
  const [tab, setTab] = useState<'report' | 'video' | 'info'>('report')
  const [activeFullscreenVideo, setActiveFullscreenVideo] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<number | null>(null)

  if (!isOpen) return null

  const handleShareWa = (title: string, url: string) => {
    const text = `*${title}*\n\nTonton update laporan video AI Presenter Emergency Operation Center (EOC) Krisis Kesehatan Kemenkes RI disini:\n${url}`
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank')
  }

  const handleCopyLink = (id: number, url: string) => {
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Parse structured sections
  const extractSection = (text: string, sectionNum: number): string => {
    const escaped = text.replace(/\r\n/g, '\n')
    const start = escaped.search(new RegExp(`(^|\\n)${sectionNum}\\. `, 'm'))
    if (start === -1) return ''
    const nextNum = sectionNum + 1
    const end = escaped.search(new RegExp(`(^|\\n)${nextNum}\\. `, 'm'))
    const raw = end > start ? escaped.slice(start, end) : escaped.slice(start)
    return raw.replace(new RegExp(`^${sectionNum}\\. [^\\n]+\\n?`), '').trim()
  }

  const extractGuidelines = (text: string) => {
    const guidelineBlock = text.split(/PANDUAN KLINIS & RESPONS CEPAT:/i)[1] || ''
    const short = guidelineBlock.split(/JANGKA MENENGAH/i)[0]?.replace(/JANGKA PENDEK[^:]*:/i, '').trim() || ''
    const medium = (guidelineBlock.split(/JANGKA MENENGAH/i)[1] || '').split(/JANGKA PANJANG/i)[0]?.replace(/[^:]*:/i, '').trim() || ''
    const longTerm = (guidelineBlock.split(/JANGKA PANJANG/i)[1] || '').split(/\d+\./)[0]?.replace(/[^:]*:/i, '').trim() || ''
    return { short, medium, long: longTerm }
  }

  const guidelines = extractGuidelines(aiInsightText)
  const cleanText = aiInsightText.replace('[ANALISIS RISK ASSESSMENT]', '').replace('PANDUAN KLINIS & RESPONS CEPAT:', '')

  const sectionDefs = [
    { key: 'executive', label: 'Executive Summary & Situasi Terkini', num: '1', color: 'teal' },
    { key: 'epidemiology', label: 'Analisis Epidemiologis & Dampak Kesehatan', num: '2', color: 'amber' },
    { key: 'severity', label: 'Klasifikasi Tingkat Keparahan', num: '3', color: 'red' },
    { key: 'global', label: 'Komparasi Internasional & Benchmark', num: '4', color: 'indigo' },
    { key: 'healthsystem', label: 'Dampak Terhadap Sistem Kesehatan Nasional', num: '5', color: 'orange' },
    { key: 'gap', label: 'Gap Analysis Respons Darurat', num: '6', color: 'rose' },
    { key: 'recommendations', label: 'Rekomendasi Strategis Terstruktur', num: '7', color: 'green' },
    { key: 'conclusion', label: 'Kesimpulan Strategis EOC', num: '8', color: 'slate' },
  ]

  const colorMap: Record<string, { bg: string; border: string; badge: string; text: string; heading: string }> = {
    teal: { bg: 'bg-teal-50/50', border: 'border-teal-200', badge: 'bg-[#00705a]', text: 'text-slate-700', heading: 'text-teal-900' },
    amber: { bg: 'bg-amber-50/50', border: 'border-amber-200', badge: 'bg-amber-600', text: 'text-slate-700', heading: 'text-amber-900' },
    red: { bg: 'bg-red-50/50', border: 'border-red-200', badge: 'bg-red-700', text: 'text-slate-700', heading: 'text-red-900' },
    indigo: { bg: 'bg-indigo-50/50', border: 'border-indigo-200', badge: 'bg-indigo-700', text: 'text-slate-700', heading: 'text-indigo-900' },
    orange: { bg: 'bg-orange-50/50', border: 'border-orange-200', badge: 'bg-orange-600', text: 'text-slate-700', heading: 'text-orange-900' },
    rose: { bg: 'bg-rose-50/50', border: 'border-rose-200', badge: 'bg-rose-700', text: 'text-slate-700', heading: 'text-rose-900' },
    green: { bg: 'bg-green-50/50', border: 'border-green-200', badge: 'bg-green-700', text: 'text-slate-700', heading: 'text-green-900' },
    slate: { bg: 'bg-slate-50/70', border: 'border-slate-200', badge: 'bg-slate-700', text: 'text-slate-700', heading: 'text-slate-900' },
  }

  const sectionTexts: Record<string, string> = {
    executive: extractSection(cleanText, 1),
    epidemiology: extractSection(cleanText, 2),
    severity: extractSection(cleanText, 3),
    global: extractSection(cleanText, 4),
    healthsystem: extractSection(cleanText, 5),
    gap: extractSection(cleanText, 6),
    recommendations: '',
    conclusion: extractSection(cleanText, 8),
  }

  const defaultFormattedTime = formattedTime || new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }) + ' pukul ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'

  const cfrNum = summaryData?.cfr || '2.14'
  const terdampakNum = (summaryData?.terdampak || 42017003).toLocaleString('id-ID')
  const pengungsiNum = (summaryData?.pengungsi || 567877).toLocaleString('id-ID')

  return (
    <>
      <div className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150">
        <div
          className="relative flex h-[90vh] max-h-[820px] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-teal-200/60 bg-white shadow-2xl animate-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between bg-gradient-to-r from-[#005a48] via-[#047d78] to-[#0f766e] px-5 py-4 text-white shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-xs shadow-inner">
                <Sparkles className="h-5 w-5 text-teal-100" />
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-base font-black uppercase tracking-wide sm:text-lg">
                  Rekomendasi Insight AI
                </h3>
                <p className="truncate text-[11px] text-teal-100/90 sm:text-xs">
                  Laporan Cerdas Penilaian Risiko Bencana &amp; Krisis Kesehatan — {regionLabel}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-1.5 text-teal-100 hover:bg-white/10 hover:text-white transition"
              aria-label="Tutup modal analisis"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex shrink-0 border-b border-slate-200 bg-slate-50">
            {[
              { id: 'report', label: 'Laporan Analisis', icon: FileText },
              { id: 'video', label: 'AI Video Presenter', icon: Video },
              { id: 'info', label: 'Informasi Sumber Data & AI', icon: Info },
            ].map((t) => {
              const TabIcon = t.icon
              const isActive = tab === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id as any)}
                  className={`flex flex-1 items-center justify-center gap-2 border-b-2 px-4 py-3 text-xs font-bold uppercase tracking-wider transition ${
                    isActive
                      ? 'border-[#00705a] bg-white text-[#00705a]'
                      : 'border-transparent text-slate-500 hover:bg-slate-100/60 hover:text-slate-700'
                  }`}
                >
                  <TabIcon className="h-4 w-4" />
                  <span className="truncate">{t.label}</span>
                </button>
              )
            })}
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-white scrollbar-thin">
            {tab === 'report' && (
              <div className="space-y-4">
                {sectionDefs.map((sec) => {
                  const c = colorMap[sec.color]
                  const content = sectionTexts[sec.key] || ''

                  // Special section 7: Rekomendasi Terstruktur (3 Jangka Waktu)
                  if (sec.key === 'recommendations') {
                    return (
                      <div key={sec.key} className={`rounded-2xl border ${c.border} ${c.bg} p-4 sm:p-5 shadow-xs`}>
                        <div className="mb-3.5 flex items-center gap-2.5">
                          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white ${c.badge}`}>
                            {sec.num}
                          </span>
                          <h4 className={`text-xs sm:text-sm font-black uppercase tracking-wide ${c.heading}`}>
                            {sec.label}
                          </h4>
                        </div>
                        <div className="grid gap-3 md:grid-cols-3">
                          {[
                            { label: '⚡ Jangka Pendek (0–72 Jam)', text: guidelines.short, bg: 'bg-red-50/80 border-red-200', badge: 'text-red-700' },
                            { label: '🔧 Jangka Menengah (1–4 Minggu)', text: guidelines.medium, bg: 'bg-amber-50/80 border-amber-200', badge: 'text-amber-700' },
                            { label: '🏗 Jangka Panjang (1–6 Bulan)', text: guidelines.long, bg: 'bg-green-50/80 border-green-200', badge: 'text-green-700' },
                          ].map((g) => (
                            <div key={g.label} className={`rounded-xl border ${g.bg} p-3.5`}>
                              <p className={`mb-1.5 text-xs font-bold ${g.badge}`}>{g.label}</p>
                              <p className="text-xs leading-relaxed text-slate-700 whitespace-pre-line">{g.text || '—'}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  }

                  if (!content) return null

                  return (
                    <div key={sec.key} className={`rounded-2xl border ${c.border} ${c.bg} p-4 sm:p-5 shadow-xs`}>
                      <div className="mb-2.5 flex items-center gap-2.5">
                        <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white ${c.badge}`}>
                          {sec.num}
                        </span>
                        <h4 className={`text-xs sm:text-sm font-black uppercase tracking-wide ${c.heading}`}>
                          {sec.label}
                        </h4>
                      </div>
                      <p className="text-xs sm:text-sm leading-relaxed text-slate-700 whitespace-pre-line">{content}</p>
                    </div>
                  )
                })}
              </div>
            )}

            {tab === 'video' && (
              <div className="space-y-6">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="flex items-center gap-2 text-sm sm:text-base font-extrabold uppercase tracking-wider text-slate-800">
                    <span className="h-2 w-2 rounded-full bg-teal-600 animate-pulse" />
                    AI Video Presenter (Periode Bulanan)
                  </h3>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Laporan krisis &amp; kesiapsiagaan bencana dalam format video presenter pintar
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                  {PRESENTER_VIDEOS.map((video) => (
                    <div
                      key={video.id}
                      className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-xs hover:border-slate-300 hover:shadow-md transition"
                    >
                      <div className="relative aspect-[9/16] w-full overflow-hidden bg-black border-b border-slate-200">
                        <iframe
                          src={getEmbedUrl(video.url)}
                          className="h-full w-full border-0"
                          allow="autoplay; encrypted-media; fullscreen;"
                          allowFullScreen
                          title={video.title}
                        />
                      </div>

                      <div className="flex flex-1 flex-col justify-between p-3.5 bg-white gap-3">
                        <div>
                          <h4 className="text-xs font-bold text-slate-800 line-clamp-2">{video.title}</h4>
                          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mt-0.5">
                            EOC Presenter AI
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => setActiveFullscreenVideo(video.url)}
                            className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-slate-100 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-200 transition"
                            title="Layar Penuh"
                          >
                            <Maximize2 className="h-3 w-3" />
                            <span>Full</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleShareWa(video.title, video.url)}
                            className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 transition"
                            title="Bagikan ke WhatsApp"
                          >
                            <span>WA</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCopyLink(video.id, video.url)}
                            className={`flex flex-1 items-center justify-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-bold transition ${
                              copiedId === video.id
                                ? 'bg-teal-700 text-white'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                            title="Salin tautan video"
                          >
                            {copiedId === video.id ? <Check className="h-3 w-3" /> : null}
                            <span>{copiedId === video.id ? 'Tersalin' : 'Link'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-4">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    💡 <strong>Presenter AI</strong> memvisualisasikan data penilaian risiko bencana dalam format video interaktif yang diperbarui secara periodik oleh EOC Krisis Kesehatan Kemenkes RI.
                  </p>
                </div>
              </div>
            )}

            {tab === 'info' && (
              <div className="space-y-5">
                <div className="flex items-start gap-3.5 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5 shadow-xs">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1 flex-1">
                    <h4 className="text-xs font-black uppercase tracking-wider text-amber-900 sm:text-sm">
                      REKOMENDASI UTAMA: STATUS SIAGA / PERLU ANTISIPASI
                    </h4>
                    <p className="text-xs font-semibold leading-relaxed text-amber-850 sm:text-sm">
                      Wilayah {regionLabel} berada dalam status SIAGA (perlu perhatian sedang) karena: Tingkat fatalitas kasus (CFR) terpantau di angka {cfrNum}%, serta besarnya populasi terdampak ({terdampakNum} jiwa) dan pengungsi ({pengungsiNum} jiwa) di posko pengungsian memerlukan pemantauan sanitasi lingkungan ketat mencegah KLB penyakit menular.
                    </p>
                  </div>
                </div>

                <div className="space-y-4 rounded-2xl border border-blue-200 bg-blue-50/50 p-4 sm:p-5 shadow-xs">
                  <div className="flex items-start gap-3.5">
                    <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                    <div className="space-y-1.5 flex-1">
                      <h4 className="text-xs font-black uppercase tracking-wider text-blue-900 sm:text-sm">
                        INFORMASI GENERATE AI
                      </h4>
                      <p className="text-xs font-semibold leading-relaxed text-blue-800 sm:text-sm">
                        Analisis Detail AI ini merupakan hasil kalkulasi database intelijen krisis terpadu EOC untuk wilayah {regionLabel.toUpperCase()}. AI ini dirancang untuk mendeteksi anomali, klaster risiko, dan kesiapan penanganan darurat.
                      </p>
                      <div className="flex items-center gap-1.5 pt-1 text-xs font-semibold text-slate-500">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        <span>Data generate AI per tanggal: {defaultFormattedTime}</span>
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-blue-100" />

                  <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wide leading-relaxed text-slate-500 italic">
                    DISCLAIMER: Semua informasi, estimasi tren, dan rekomendasi taktis yang disajikan merupakan analisis dari model AI (Google Gemini). Hasil analisis ini ditujukan sebagai referensi pembantu pengambilan keputusan dinas kesehatan setempat dan tidak menggantikan keputusan medis formal maupun regulasi resmi dari kementerian terkait.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              EOC KRISIS KESEHATAN KEMENKES RI
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-[#00705a] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-[#005a48] transition"
            >
              Tutup Analisis
            </button>
          </div>
        </div>
      </div>

      {/* Fullscreen Video Overlay */}
      {activeFullscreenVideo && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative aspect-[9/16] w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-black shadow-2xl animate-in zoom-in-95 duration-150">
            <iframe
              src={getEmbedUrl(activeFullscreenVideo)}
              className="h-full w-full border-0"
              allow="autoplay; encrypted-media; fullscreen;"
              allowFullScreen
              title="Fullscreen Presenter"
            />
            <button
              type="button"
              onClick={() => setActiveFullscreenVideo(null)}
              className="absolute top-3 right-3 z-50 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition"
              aria-label="Tutup video"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
