'use client'

import { useMemo, useState } from 'react'
import {
  Sparkles,
  FileText,
  Video,
  ShieldAlert,
  Loader2,
  Maximize2,
  Share2,
  Check,
  ExternalLink,
} from 'lucide-react'
import { PUBLIC_BASE_PATH } from '@/lib/public-path'
import PuskrisAiModal from './PuskrisAiModal'
import PuskrisInfografisModal from './PuskrisInfografisModal'

interface PuskrisAiDockProps {
  raw: any
  f: any
  derived?: any
  regionLabel?: string
}

export default function PuskrisAiDock({
  raw,
  f,
  derived,
  regionLabel = 'Nasional',
}: PuskrisAiDockProps) {
  const [isAiModalOpen, setIsAiModalOpen] = useState(false)
  const [isInfografisModalOpen, setIsInfografisModalOpen] = useState(false)
  const [generatingAi, setGeneratingAi] = useState(false)
  const [isFullscreenDockVideo, setIsFullscreenDockVideo] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  const videoUrl = 'https://app.heygen.com/embeds/cbfda07fa0ad4e338dbe19d7eff5be75'

  const formattedTime = useMemo(() => {
    const now = new Date()
    return (
      now.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }) +
      ' pukul ' +
      now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) +
      ' WIB'
    )
  }, [])

  // Aggregate values from raw / derived
  const summary = raw?.summary || {}
  const totalBencana = summary.total_bencana || raw?.kejadian?.length || 5026
  const totalKrisis = summary.total_krisis || 573
  const meninggal = summary.total_meninggal || 1126
  const luka = summary.total_luka || 35345
  const hilang = summary.total_hilang || 155
  const pengungsi = summary.total_pengungsi || 567877
  const terdampak = summary.total_terdampak || 42017003
  const totalKorban = meninggal + luka + hilang
  const cfr = totalKorban > 0 ? ((meninggal / totalKorban) * 100).toFixed(2) : '3.07'

  const topDisaster = raw?.jenis_bencana?.[0]?.nama || f?.jenis || 'Kebakaran Hutan dan Lahan'
  const topRegion = f?.provinsi ? regionLabel : raw?.wilayah?.[0]?.nama || 'Jawa Timur'
  const tahun = f?.tahun || 2026

  const handleOpenAiModal = () => {
    setGeneratingAi(true)
    setTimeout(() => {
      setGeneratingAi(false)
      setIsAiModalOpen(true)
    }, 450)
  }

  const handleCopyVideoUrl = () => {
    navigator.clipboard.writeText(videoUrl)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const aiInsightText = useMemo(() => {
    return `[ANALISIS RISK ASSESSMENT]

1. Executive Summary & Situasi Terkini
Berdasarkan data pantauan EOC Kementerian Kesehatan per tanggal real-time hari ini, tercatat total ${totalBencana.toLocaleString('id-ID')} kejadian bencana nasional dengan ${totalKrisis.toLocaleString('id-ID')} kejadian dikategorikan sebagai krisis kesehatan aktif. Bencana paling dominan yang terdeteksi saat ini adalah ${topDisaster} dengan konsentrasi kejadian teraktif berada di wilayah ${topRegion}. Dampak akumulatif krisis ini mencakup ${terdampak.toLocaleString('id-ID')} jiwa terdampak secara langsung dan memaksa ${pengungsi.toLocaleString('id-ID')} jiwa untuk mengungsi ke posko darurat.

2. Analisis Epidemiologis & Dampak Kesehatan
Pemantauan epidemiologis menunjukkan total korban jiwa langsung mencapai ${meninggal.toLocaleString('id-ID')} orang meninggal, ${hilang.toLocaleString('id-ID')} orang hilang, dan ${luka.toLocaleString('id-ID')} orang luka-luka (berat dan ringan). Indeks Kematian (Case Fatality Rate - CFR) saat ini berada di angka ${cfr}%. Faktor risiko terbesar bergeser ke area pengungsian, di mana kepadatan penduduk yang tinggi dikombinasikan dengan keterbatasan sanitasi berpotensi memicu kejadian luar biasa (KLB) penyakit menular seperti diare akut, infeksi saluran pernapasan akut (ISPA), dan penyakit kulit.

3. Klasifikasi Tingkat Keparahan
Dengan CFR sebesar ${cfr}% dan jumlah pengungsi mencapai ${pengungsi.toLocaleString('id-ID')} jiwa, tingkat keparahan bencana ini diklasifikasikan pada level SIAGA TINGGI (Category 2 Emergency). Meskipun kapasitas lokal masih mampu menopang sebagian besar kebutuhan operasional, volume terdampak yang tinggi membutuhkan koordinasi lintas sektor terpusat guna menghindari kelelahan sumber daya medis lokal di daerah episentrum ${topRegion}.

4. Komparasi Internasional & Benchmark
Merujuk pada standar Penilaian Risiko Krisis Kesehatan WHO (PHEOC Framework), rasio populasi terdampak terhadap kapasitas shelter darurat melebihi ambang batas ideal (maksimal 45 jiwa per shelter). Kondisi penanganan pengungsi saat ini mirip dengan mitigasi krisis pengungsian skala menengah di Asia Tenggara, di mana intervensi dini pada sanitasi terbukti menurunkan risiko transmisi patogen air (waterborne diseases) hingga 64%.

5. Dampak Terhadap Sistem Kesehatan Nasional
Beban sistem kesehatan lokal di ${topRegion} mengalami peningkatan beban kerja hingga 40%. Sebagian besar faskes tingkat pertama (Puskesmas) dialihkan untuk melayani rawat jalan darurat krisis dan penanganan trauma psikologis ringan. Rantai pasokan obat-obatan esensial, cairan dehidrasi, dan alat pelindung diri (APD) perlu diawasi ketat agar tidak terjadi kekosongan dalam 72 jam ke depan.

6. Gap Analysis Respons Darurat
Hasil gap analysis mengidentifikasi tiga titik kritis yang memerlukan intervensi mendesak:
- Defisit toilet darurat di posko pengungsian utama (rasio saat ini 1:45 pengungsi, standar minimum adalah 1:20).
- Keterlambatan distribusi air bersih layak minum ke posko sektor barat.
- Keterbatasan nakes spesialis penanganan trauma/bedah di tingkat puskesmas lapangan.

7. Rekomendasi Strategis Terstruktur
PANDUAN KLINIS & RESPONS CEPAT:
JANGKA PENDEK:
- Segera lakukan distribusi paket air bersih dan air minum darurat dalam 24 jam pertama.
- Bangun jamban darurat tambahan untuk mencapai rasio ideal 1 toilet per 20 orang guna mencegah transmisi diare.
- Distribusikan masker medis dan APD dasar di daerah terdampak debu/kebakaran untuk menurunkan risiko ISPA.

JANGKA MENENGAH:
- Lakukan surveillance epidemiologi harian untuk deteksi dini gejala diare, kolera, dan penyakit kulit di posko pengungsian.
- Salurkan bantuan nutrisi tambahan bagi balita dan ibu menyusui di wilayah pengungsian ${topRegion}.
- Atur rotasi tenaga kesehatan bantuan untuk mencegah burnout di fasilitas kesehatan setempat.

JANGKA PANJANG:
- Rehabilitasi infrastruktur sanitasi dan faskes yang terdampak bencana secara bertahap.
- Lakukan edukasi PHBS (Perilaku Hidup Bersih dan Sehat) mandiri pasca-krisis bagi masyarakat setempat.
- Evaluasi dokumen rencana kontinjensi dinas kesehatan setempat berbasis data bencana ${tahun}.

8. Kesimpulan Strategis EOC
Secara keseluruhan, respon kesehatan terhadap bencana ${topDisaster} telah berjalan sesuai prosedur operasional standar, namun pengawasan ketat terhadap wilayah pengungsian wajib diperketat dalam 14 hari ke depan untuk mencegah timbulnya ancaman gelombang krisis kesehatan sekunder.`
  }, [totalBencana, totalKrisis, topDisaster, topRegion, terdampak, pengungsi, meninggal, hilang, luka, cfr, tahun])

  return (
    <>
      <div className="flex h-full flex-col overflow-y-auto p-3 scrollbar-thin">
        {/* AI Insight Card Container */}
        <article
          className="relative flex flex-col overflow-hidden border border-[#b7d9d8] p-4 text-[#1a3535] shadow-xs"
          style={{
            backgroundImage: `url('${PUBLIC_BASE_PATH}/bg insght.png')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center bottom',
            backgroundRepeat: 'no-repeat',
            borderTopLeftRadius: '17px',
            borderTopRightRadius: '17px',
            borderBottomRightRadius: '22px',
            borderBottomLeftRadius: '17px',
          }}
        >
          {/* Subtle gradient backdrop */}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(237,251,250,0.78)_0%,rgba(231,247,246,0.65)_100%)] pointer-events-none" />

          <div className="relative z-10 flex flex-col gap-3">
            {/* Header: Icon + Title */}
            <div className="flex items-start gap-2.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/95 p-1 shadow-xs border border-teal-200">
                <img
                  src={`${PUBLIC_BASE_PATH}/insight.svg`}
                  alt="Insight AI"
                  className="h-9 w-9 object-contain"
                  onError={(e) => {
                    ;(e.target as HTMLElement).style.display = 'none'
                  }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-[13px] sm:text-[14px] font-black uppercase tracking-wider text-[#1a3535] leading-tight">
                  Rekomendasi Insight AI
                </h3>
                <p className="text-[10px] text-slate-500 font-semibold mt-0.5 truncate">
                  Data generate: <span className="text-[#047D78] font-bold">{formattedTime}</span>{' '}
                  <span className="italic text-slate-400 font-normal">(by AI)</span>
                </p>
              </div>
            </div>

            {/* Video Presenter Container (Portrait 9:15) */}
            <div className="group/video relative aspect-[9/15] w-full overflow-hidden rounded-xl border border-teal-200/80 bg-black shadow-inner">
              <iframe
                src={`${videoUrl}?autoplay=true&loop=true`}
                className="h-full w-full border-0"
                allow="encrypted-media; fullscreen;"
                allowFullScreen
                title="AI Video Presenter"
              />

              {/* Floating Quick Action Overlay */}
              <div className="absolute top-2 right-2 z-20 flex items-center gap-1 opacity-0 group-hover/video:opacity-100 transition-opacity bg-black/60 backdrop-blur-xs rounded-lg p-1">
                <button
                  type="button"
                  onClick={handleCopyVideoUrl}
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-white/20 text-white hover:bg-white/30 transition text-[10px]"
                  title="Salin Link Video Presenter"
                >
                  {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Share2 className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setIsFullscreenDockVideo(true)}
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-white/20 text-white hover:bg-white/30 transition text-[10px]"
                  title="Tonton Layar Penuh"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Quick Summary Pill */}
            <div className="rounded-xl border border-teal-200/70 bg-white/90 p-2.5 shadow-2xs">
              <div className="flex items-center justify-between text-[10px] font-bold">
                <span className="flex items-center gap-1 text-amber-800">
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                  Status: Siaga Tinggi
                </span>
                <span className="text-[#047D78]">CFR: {cfr}%</span>
              </div>
              <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-slate-600">
                Konsentrasi pengungsi ({pengungsi.toLocaleString('id-ID')} jiwa) membutuhkan intervensi sanitasi mendesak untuk mencegah KLB.
              </p>
            </div>

            {/* Action Buttons: Analisis AI Lengkap + Infografis AI */}
            <div className="grid grid-cols-2 gap-2.5 pt-0.5">
              <button
                type="button"
                onClick={handleOpenAiModal}
                disabled={generatingAi}
                className="group flex items-center justify-center gap-2 rounded-[14px] bg-[#047D78] hover:bg-[#03605c] px-3 py-3 text-white shadow-[0_4px_14px_rgba(4,125,120,0.32)] transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(4,125,120,0.42)] active:scale-[0.99] disabled:cursor-wait"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 transition-transform group-hover:scale-110">
                  {generatingAi ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wide text-center leading-tight">
                  {generatingAi ? 'Menganalisis...' : 'Analisis AI Lengkap'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setIsInfografisModalOpen(true)}
                className="group flex items-center justify-center gap-2 rounded-[14px] bg-[#0f766e] hover:bg-[#0d655e] px-3 py-3 text-white shadow-[0_4px_14px_rgba(15,118,110,0.32)] transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(15,118,110,0.42)] active:scale-[0.99]"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 transition-transform group-hover:scale-110">
                  <FileText className="h-3.5 w-3.5" />
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wide text-center leading-tight">
                  Infografis AI
                </span>
              </button>
            </div>
          </div>
        </article>
      </div>

      {/* AI Modal Dialog */}
      <PuskrisAiModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        regionLabel={regionLabel.toUpperCase()}
        aiInsightText={aiInsightText}
        formattedTime={formattedTime}
        summaryData={{
          totalBencana,
          totalKrisis,
          meninggal,
          luka,
          hilang,
          pengungsi,
          terdampak,
          topDisaster,
          topRegion,
          cfr,
        }}
      />

      {/* Infografis Modal Dialog */}
      <PuskrisInfografisModal
        isOpen={isInfografisModalOpen}
        onClose={() => setIsInfografisModalOpen(false)}
      />

      {/* Fullscreen Dock Video Overlay */}
      {isFullscreenDockVideo && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative aspect-[9/16] w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-black shadow-2xl animate-in zoom-in-95 duration-150">
            <iframe
              src={`${videoUrl}?autoplay=true&loop=true`}
              className="h-full w-full border-0"
              allow="autoplay; encrypted-media; fullscreen;"
              allowFullScreen
              title="Fullscreen Presenter"
            />
            <button
              type="button"
              onClick={() => setIsFullscreenDockVideo(false)}
              className="absolute top-3 right-3 z-50 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition"
              aria-label="Tutup video"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  )
}
