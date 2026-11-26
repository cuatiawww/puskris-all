'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Activity, ArrowRight, Flame, Layers, MapPin, Search, Waves } from 'lucide-react'
import { usePuskrisRaw } from '@/components/puskris/usePuskrisRaw'
import ApiKosong from '@/components/puskris/ApiKosong'
import { PUBLIC_BASE_PATH } from '@/lib/public-path'
import { eocKejadian, nf } from '@/lib/puskris/derive'
import { dmy } from '@/lib/puskris/jenis-meta'
import { defaultUiFilter } from '@/lib/puskris/ui-filter'
import { resolveKejadianTemplate, templateMeta, type KejadianTemplate } from '@/lib/puskris/kejadian-template'

const FILTERS: { key: 'semua' | KejadianTemplate; label: string; icon: any }[] = [
  { key: 'semua', label: 'Semua Kejadian', icon: Layers },
  { key: 'banjir', label: 'Template Banjir', icon: Waves },
  { key: 'gempa', label: 'Template Gempa', icon: Activity },
  { key: 'karhutla', label: 'Template Karhutla', icon: Flame },
  { key: 'umum', label: 'Lainnya', icon: Layers },
]

export default function KejadianIndexClient() {
  const [f] = useState(() => defaultUiFilter())
  const [ready, setReady] = useState(false)
  const [tplFilter, setTplFilter] = useState<'semua' | KejadianTemplate>('semua')
  const [q, setQ] = useState('')
  const { raw, pending, error } = usePuskrisRaw(f, ready)

  useEffect(() => {
    setReady(true)
  }, [])

  const events = useMemo(() => {
    if (!raw?.eoc?.events?.length) return []
    const regionName = Object.fromEntries((raw?.regions || []).map((r: any) => [r.code, r.name]))
    return raw.eoc.events
      .map((e: any) => {
        const ev = eocKejadian(e, regionName)
        return { ...ev, template: resolveKejadianTemplate(ev.jenis) }
      })
      .sort((a: any, b: any) => `${b.tanggal} ${b.jam || ''}`.localeCompare(`${a.tanggal} ${a.jam || ''}`))
  }, [raw])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return events
      .filter((e: any) => {
        if (tplFilter !== 'semua' && e.template !== tplFilter) return false
        if (s) {
          const hay = `${e.uid} ${e.jenis} ${e.kabupaten} ${e.provinsi} ${e.tanggal}`.toLowerCase()
          if (!hay.includes(s)) return false
        }
        return true
      })
      .slice(0, 48)
  }, [events, tplFilter, q])

  const counts = useMemo(() => {
    const c = { semua: events.length, banjir: 0, gempa: 0, karhutla: 0, umum: 0 }
    for (const e of events) c[e.template as KejadianTemplate]++
    return c
  }, [events])

  return (
    <div className="space-y-5 px-4 pb-10 pt-2 sm:px-6 lg:px-8" data-testid="kejadian-index-page">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
        <span className="text-[10px] font-black uppercase tracking-wider text-[#00705a]">
          Direktori Kejadian Krisis Kesehatan · API EOC
        </span>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-black uppercase text-slate-900">Detail Kejadian per Kota & Template Bencana</h1>
            <p className="mt-0.5 text-xs text-slate-600">
              Pilih kejadian di bawah ini untuk membuka rute detail <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px]">/kejadian/&lt;kode-api&gt;</code> dengan template khusus Banjir, Gempa, atau Karhutla.
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari kota, jenis, atau kode API (mis. fqesd)..."
              className="h-9 w-full rounded-xl border border-slate-200 pl-8 pr-3 text-xs outline-none focus:border-[#00705a]"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {FILTERS.map((fl) => {
            const Icon = fl.icon
            const active = tplFilter === fl.key
            return (
              <button
                key={fl.key}
                type="button"
                onClick={() => setTplFilter(fl.key)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                  active ? 'border-[#00705a] bg-[#00705a] text-white' : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{fl.label}</span>
                <span className={`rounded-full px-1.5 py-0.2 text-[10px] ${active ? 'bg-white/20 text-white' : 'bg-white text-slate-500'}`}>
                  {counts[fl.key]}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {error ? <ApiKosong pesan="Gagal memuat data EOC" detail={error} /> : null}
      {!events.length && pending ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((ev: any) => {
          const meta = templateMeta(ev.template)
          const yr = String(ev.tanggal || '').slice(0, 4)
          const href = `/dashboard/kejadian/${encodeURIComponent(ev.uid)}${/^\d{4}$/.test(yr) ? `?tahun=${yr}` : ''}`
          return (
            <Link
              key={ev.uid}
              href={href}
              className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs transition hover:border-[#00705a]/60 hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-[10.5px] font-bold text-white">
                    {ev.uid}
                  </span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${meta.badgeClass}`}>
                    {meta.shortLabel}
                  </span>
                </div>
                <h2 className="mt-2.5 text-sm font-black uppercase text-slate-900 group-hover:text-[#00705a]">{ev.jenis}</h2>
                <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-700">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-[#00705a]" />
                  <span className="truncate">{ev.kabupaten}{ev.provinsi ? `, ${ev.provinsi}` : ''}</span>
                </p>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] text-slate-500">
                <span>{dmy(ev.tanggal)} · {nf(ev.terdampak)} terdampak</span>
                <span className="inline-flex items-center gap-1 font-bold text-[#00705a]">
                  Detail <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
