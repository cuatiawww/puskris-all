'use client'

import { useState } from 'react'
import {
  FileText,
  Search,
  Download,
  Eye,
  X,
  Layers,
} from 'lucide-react'
import { PUBLIC_BASE_PATH } from '@/lib/public-path'

export type InfographicItem = {
  id: number
  title: string
  category: string
  description: string
  date: string
  fileSize: string
  fileUrl: string
  imageCover: string
  type: 'pdf' | 'image'
}

export const INFOGRAPHICS_LIST: InfographicItem[] = [
  {
    id: 1,
    title: 'Laporan Intelijen & Kesiapsiagaan Bencana EOC Kemenkes RI',
    category: 'Laporan Resmi EOC',
    description: 'Dokumen komprehensif kajian risiko, status siaga darurat, dan kesiapan fasilitas pelayanan kesehatan.',
    date: 'Juli 2026',
    fileSize: '382 KB',
    fileUrl: `${PUBLIC_BASE_PATH}/laporan_eoc_kemenkes.pdf`,
    imageCover: `${PUBLIC_BASE_PATH}/jun.png`,
    type: 'pdf',
  },
  {
    id: 2,
    title: 'Infografis Bulanan EOC — Pemantauan Situasi Krisis Nasional',
    category: 'Infografis Bulanan EOC',
    description: 'Visualisasi sebaran bencana hidrometeorologi, gempa, dan kebakaran lahan beserta data korban terdampak.',
    date: 'Juni 2026',
    fileSize: '82 KB',
    fileUrl: `${PUBLIC_BASE_PATH}/Lap_Juni.jpeg`,
    imageCover: `${PUBLIC_BASE_PATH}/Lap_Juni.jpeg`,
    type: 'image',
  },
  {
    id: 3,
    title: 'Infografis Peringatan Dini Bencana & Cuaca Ekstrem',
    category: 'Peringatan Dini',
    description: 'Pemodelan peringatan dini potensi bencana alam dan ancaman dampak kesehatan masyarakat di 38 provinsi.',
    date: 'Mei 2026',
    fileSize: '284 KB',
    fileUrl: `${PUBLIC_BASE_PATH}/Infografis Peringatan Dini.png`,
    imageCover: `${PUBLIC_BASE_PATH}/Infografis Peringatan Dini.png`,
    type: 'image',
  },
  {
    id: 4,
    title: 'Tata Kelola Peta Respon & Renkon Bencana Krisis Kesehatan',
    category: 'Tata Kelola & Kebijakan',
    description: 'Standar operasional prosedur aktivasi klaster kesehatan, pembagian zona penanganan, dan jalur evakuasi medis.',
    date: 'April 2026',
    fileSize: '322 KB',
    fileUrl: `${PUBLIC_BASE_PATH}/Tatkelola Peta Respon & Renkon.png`,
    imageCover: `${PUBLIC_BASE_PATH}/Tatkelola Peta Respon & Renkon.png`,
    type: 'image',
  },
  {
    id: 5,
    title: 'Panduan Praktis Mitigasi Krisis Kesehatan di Fasilitas Pelayanan',
    category: 'Panduan Operasional',
    description: 'Buku panduan lapangan untuk tenaga medis, relawan, dan EMT dalam merespons krisis kesehatan sekunder.',
    date: 'Maret 2026',
    fileSize: '289 KB',
    fileUrl: `${PUBLIC_BASE_PATH}/Panduan Krisis Kesehatan.png`,
    imageCover: `${PUBLIC_BASE_PATH}/Panduan Krisis Kesehatan.png`,
    type: 'image',
  },
  {
    id: 6,
    title: 'Infografis Penilaian Risiko Krisis Kesehatan Wilayah',
    category: 'Analisis Risiko',
    description: 'Peta indeks kerentanan, kapasitas respon fasyankes daerah, dan klasifikasi wilayah berisiko tinggi.',
    date: 'Februari 2026',
    fileSize: '292 KB',
    fileUrl: `${PUBLIC_BASE_PATH}/Infografis Risiko Krisis.png`,
    imageCover: `${PUBLIC_BASE_PATH}/Infografis Risiko Krisis.png`,
    type: 'image',
  },
  {
    id: 7,
    title: 'Infografis Buffer Logistik & Obat Darurat Krisis Kesehatan',
    category: 'Logistik & SDM',
    description: 'Peta sebaran gudang regional buffer logistik, ketersediaan tenda medis darurat, obat esensial, dan kantong darah.',
    date: 'Januari 2026',
    fileSize: '258 KB',
    fileUrl: `${PUBLIC_BASE_PATH}/Infografis Logistik Krisis Kesehatan.png`,
    imageCover: `${PUBLIC_BASE_PATH}/Infografis Logistik Krisis Kesehatan.png`,
    type: 'image',
  },
  {
    id: 8,
    title: 'Infografis Upaya Krisis Kesehatan & Mobilisasi EMT Terpadu',
    category: 'Upaya & Respons',
    description: 'Laporan pergerakan Emergency Medical Team (EMT), pos komando darurat, dan mobilisasi nakes siaga bencana.',
    date: 'November 2026',
    fileSize: '304 KB',
    fileUrl: `${PUBLIC_BASE_PATH}/Infografis Upaya Krisis Kesehatan.png`,
    imageCover: `${PUBLIC_BASE_PATH}/Infografis Upaya Krisis Kesehatan.png`,
    type: 'image',
  },
]

interface PuskrisInfografisModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function PuskrisInfografisModal({ isOpen, onClose }: PuskrisInfografisModalProps) {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua')
  const [previewItem, setPreviewItem] = useState<InfographicItem | null>(null)

  if (!isOpen) return null

  const categories = ['Semua', ...Array.from(new Set(INFOGRAPHICS_LIST.map((i) => i.category)))]

  const filtered = INFOGRAPHICS_LIST.filter((item) => {
    const matchCat = selectedCategory === 'Semua' || item.category === selectedCategory
    const matchSearch =
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.description.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

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
                <FileText className="h-5 w-5 text-teal-100" />
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-base font-black uppercase tracking-wide sm:text-lg">
                  Galeri Infografis &amp; Dokumen AI
                </h3>
                <p className="truncate text-[11px] text-teal-100/90 sm:text-xs">
                  Pusat Publikasi &amp; Laporan Cerdas EOC Krisis Kesehatan Kemenkes RI
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-1.5 text-teal-100 hover:bg-white/10 hover:text-white transition"
              aria-label="Tutup galeri"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row gap-2.5 border-b border-slate-200 bg-slate-50 p-3 sm:px-5 shrink-0">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cari infografis, panduan, atau laporan EOC..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-xs placeholder:text-slate-400 focus:border-teal-600 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 sm:pb-0">
              {categories.slice(0, 5).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold whitespace-nowrap transition ${
                    selectedCategory === cat
                      ? 'bg-teal-700 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Grid Cards */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-slate-50/50 scrollbar-thin">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center text-slate-400">
                <FileText className="h-10 w-10 stroke-[1.5] mb-2 text-slate-300" />
                <p className="text-sm font-bold text-slate-600">Tidak ada infografis ditemukan</p>
                <p className="text-xs text-slate-400 mt-1">Coba gunakan kata kunci pencarian yang lain.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs hover:shadow-md hover:border-teal-200 transition group"
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100 border-b border-slate-100">
                      <img
                        src={item.imageCover}
                        alt={item.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        onError={(e) => {
                          ;(e.target as HTMLElement).style.display = 'none'
                        }}
                      />
                      <span className="absolute top-2 left-2 rounded-md bg-teal-800/85 backdrop-blur-xs px-2 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider">
                        {item.category}
                      </span>
                      <span className="absolute bottom-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                        {item.fileSize}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex flex-1 flex-col justify-between p-3.5 gap-3">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 line-clamp-2 leading-snug group-hover:text-teal-700 transition">
                          {item.title}
                        </h4>
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                          {item.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
                        <span className="text-[10px] font-semibold text-slate-400">
                          {item.date}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPreviewItem(item)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 transition"
                          >
                            <Eye className="h-3 w-3" />
                            <span>Lihat</span>
                          </button>
                          <a
                            href={item.fileUrl}
                            download
                            className="inline-flex items-center gap-1 rounded-lg bg-teal-700 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-teal-800 transition"
                          >
                            <Download className="h-3 w-3" />
                            <span>Unduh</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              PUSAT KRISIS KESEHATAN · KEMENKES RI
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-[#00705a] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-[#005a48] transition"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>

      {/* Preview Dialog */}
      {previewItem && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-3 sm:p-5 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative flex h-[92vh] max-h-[860px] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
              <div className="min-w-0 pr-4">
                <h4 className="truncate text-xs sm:text-sm font-bold text-slate-800">{previewItem.title}</h4>
                <p className="text-[10px] text-slate-400">{previewItem.category} · {previewItem.fileSize}</p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewItem.fileUrl}
                  download
                  className="inline-flex items-center gap-1 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-800 transition"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Unduh File</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                  aria-label="Tutup preview"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-slate-100 p-2 sm:p-4 flex items-center justify-center">
              {previewItem.type === 'pdf' ? (
                <iframe
                  src={previewItem.fileUrl}
                  className="h-full w-full rounded-xl border border-slate-200 bg-white shadow-sm"
                  title={previewItem.title}
                />
              ) : (
                <img
                  src={previewItem.fileUrl}
                  alt={previewItem.title}
                  className="max-h-full max-w-full rounded-xl object-contain shadow-md"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
