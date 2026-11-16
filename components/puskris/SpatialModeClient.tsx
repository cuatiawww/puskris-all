'use client'

import Link from 'next/link'
import { Globe2, LayoutDashboard, BarChart3 } from 'lucide-react'

export default function SpatialModeClient() {
  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-slate-950 text-white" data-testid="spatial-mode-root">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(22,179,172,0.22),_transparent_55%)]" />
      <header className="relative z-10 flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/20 text-primary">
            <Globe2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-teal-300">Pusat Krisis Kesehatan</p>
            <h1 className="text-lg font-black tracking-tight">Spatial Mode</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/dashboard/ringkasan" className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-white hover:bg-white/10">
            <LayoutDashboard className="h-3.5 w-3.5" /> Kembali ke Ringkasan
          </Link>
          <Link href="/dashboard/analisis" className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-slate-950 hover:bg-teal-300">
            <BarChart3 className="h-3.5 w-3.5" /> Buka Analisis
          </Link>
        </div>
      </header>
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
        <span className="rounded-full border border-amber-300/40 bg-amber-400/15 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-200">Berikutnya</span>
        <h2 className="mt-4 max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">Tampilan peta layar penuh sedang disiapkan</h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-300">
          Spatial Mode akan menampilkan peta kejadian, radius dukungan, dan indeks kesenjangan respons dalam tampilan layar penuh.
          Sementara ini, peta interaktif ada di Ringkasan dan Analisis.
        </p>
        <ul className="mt-8 grid w-full max-w-3xl gap-3 text-left sm:grid-cols-3">
          {[
            ['Peta kejadian terpadu', 'Titik krisis, korban, dan sebaran per provinsi'],
            ['Radius dukungan', 'PSC, ambulans, tenaga cadangan, dan logistik terdekat'],
            ['Indeks kesenjangan', 'Wilayah dengan beban tinggi dan kapasitas rendah'],
          ].map(([title, desc]) => (
            <li key={title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-bold text-white">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">{desc}</p>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
