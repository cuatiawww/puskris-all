'use client'

import { periodeRange } from '@/lib/puskris/derive'
import { toDeriveFilter } from '@/lib/puskris/ui-filter'
import { useEffect, useMemo, useState } from 'react'
import { Info, MapPin, RefreshCw } from 'lucide-react'
import { PUBLIC_BASE_PATH } from '@/lib/public-path'
import { fromEocKrisis, fromHazards, titleCase, type KejadianTerbaru } from '@/lib/puskris/kejadian-terbaru'

type Filter = { provinsi?: string | null; kabupaten?: string | null; jenis?: string | null; periode?: string; tahun?: number; bulan?: number | null; dari?: string | null; sampai?: string | null }
type Chip = 'semua' | 'krisis' | 'terpantau' | 'gempa' | 'gdacs'

const CHIPS: [Chip, string, string][] = [
  ['semua', 'Semua', 'Semua sumber'],
  ['krisis', 'Krisis', 'Kejadian berdampak krisis kesehatan (Pusat Krisis / EOC)'],
  ['terpantau', 'Terpantau', 'Kejadian yang dipantau Pusat Krisis, belum tentu berdampak krisis'],
  ['gempa', 'Gempa BMKG', 'Gempa langsung dari BMKG (Badan Meteorologi, Klimatologi, dan Geofisika)'],
  ['gdacs', 'GDACS', 'Peringatan bencana global GDACS (Global Disaster Alert and Coordination System) untuk Indonesia'],
]

const JENIS_COLOR: [RegExp, string][] = [
  [/gempa|tsunami/i, 'bg-orange-100 text-orange-800'],
  [/banjir/i, 'bg-sky-100 text-sky-800'],
  [/longsor/i, 'bg-amber-100 text-amber-900'],
  [/kebakaran|karhutla/i, 'bg-red-100 text-red-800'],
  [/gunung/i, 'bg-rose-100 text-rose-800'],
  [/angin|siklon|cuaca|gelombang/i, 'bg-cyan-100 text-cyan-800'],
  [/kekeringan/i, 'bg-yellow-100 text-yellow-900'],
  [/penyakit|keracunan|klb/i, 'bg-violet-100 text-violet-800'],
]
const jenisClass = (j: string) => JENIS_COLOR.find(([r]) => r.test(j))?.[1] || 'bg-slate-100 text-slate-700'
const SUMBER_CLASS: Record<string, string> = { 'Pusat Krisis': 'text-teal-700', EOC: 'text-teal-700', BMKG: 'text-orange-700', GDACS: 'text-indigo-700', USGS: 'text-indigo-700' }
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const fmtTgl = (t: string) => { const [y, m, d] = t.split('-'); return `${Number(d)} ${BULAN[Number(m) - 1] || ''} ${y}` }
const nf = (n: number) => n.toLocaleString('id-ID')
const normJ = (s: string) => String(s || '').toLowerCase().replace(/kejadian luar biasa \(klb\) - /, '').trim()
const jenisMatch = (filterJenis: string, k: KejadianTerbaru) => {
  const a = normJ(filterJenis), b = normJ(k.jenis)
  return a === b || (b.length > 3 && a.includes(b)) || (a.length > 3 && b.includes(a))
}

function inPeriode(k: KejadianTerbaru, f: Filter) {
  const r = periodeRange(toDeriveFilter(f as any))
  return k.tanggal >= r.from && k.tanggal <= r.to
}

export default function KejadianTerbaruList({ f, eocKrisis, onPick, onCount }: {
  f: Filter
  eocKrisis?: any[]
  onPick: (k: KejadianTerbaru) => void
  onCount?: (n: number) => void
}) {
  const [pk, setPk] = useState<{ events: KejadianTerbaru[]; mode?: string; at?: string; err?: string } | null>(null)
  const [hz, setHz] = useState<{ events: KejadianTerbaru[]; at?: string; err?: string; upstream?: any[] } | null>(null)
  const [chip, setChip] = useState<Chip>('semua')
  const [limit, setLimit] = useState(40)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let on = true
    setPk(null); setHz(null)
    fetch(`${PUBLIC_BASE_PATH}/api/v1/map-layers/kejadian-terbaru`).then((r) => r.json())
      .then((j) => { if (on) setPk({ events: j.events || [], mode: j.mode, at: j.fetched_at }) })
      .catch((e) => { if (on) setPk({ events: [], err: String(e?.message || e) }) })
    fetch(`${PUBLIC_BASE_PATH}/api/v1/map-layers/hazards`).then((r) => r.json())
      .then((j) => { if (on) setHz({ events: fromHazards(j.events || []), at: j.fetched_at, upstream: j.upstream }) })
      .catch((e) => { if (on) setHz({ events: [], err: String(e?.message || e) }) })
    return () => { on = false }
  }, [nonce])

  const all = useMemo(() => {
    const list: KejadianTerbaru[] = [...(pk?.events || [])]
    // Lengkapi kejadian krisis dengan rincian meninggal/pengungsi dari API EOC bila tanggal + kab/kota cocok
    const key = (k: KejadianTerbaru) => `${k.tanggal}|${String(k.lokasi || '').toUpperCase()}`
    const byKey = new Map(list.filter((k) => k.kategori === 'krisis').map((k) => [key(k), k]))
    for (const e of fromEocKrisis(eocKrisis || [])) {
      const hit = byKey.get(key(e))
      if (hit) { hit.meninggal ??= e.meninggal; hit.pengungsi ??= e.pengungsi; if (!hit.provinsi) { hit.provinsi = e.provinsi; hit.provCode = e.provCode } }
      else list.push(e)
    }
    list.push(...(hz?.events || []))
    return list.sort((a, b) => `${b.tanggal} ${b.jam || ''}`.localeCompare(`${a.tanggal} ${a.jam || ''}`))
  }, [pk, hz, eocKrisis])

  const filtered = useMemo(() => all.filter((k) => {
    if (chip === 'krisis' && k.kategori !== 'krisis') return false
    if (chip === 'terpantau' && k.kategori !== 'terpantau') return false
    if (chip === 'gempa' && k.sumber !== 'BMKG') return false
    if (chip === 'gdacs' && !(k.sumber === 'GDACS' || k.sumber === 'USGS')) return false
    if (f.provinsi && k.provCode !== f.provinsi) return false
    if (f.kabupaten && k.lokasi && !String(k.lokasi).toUpperCase().includes(String(f.kabupaten).toUpperCase().replace(/^KABUPATEN\s+/, ''))) return false
    if (f.jenis && !jenisMatch(f.jenis, k)) return false
    return inPeriode(k, f)
  }), [all, chip, f])

  useEffect(() => { onCount?.(filtered.length) }, [filtered.length, onCount])
  useEffect(() => { setLimit(40) }, [chip, f])

  const loading = !pk || !hz
  const liveFiltered = Boolean(f.provinsi || f.kabupaten)
  const hzBad = (hz?.upstream || []).filter((u: any) => !u.ok)

  return (
    <div className="flex h-full flex-col" data-testid="kejadian-terbaru">
      <div className="shrink-0 border-b border-slate-100 bg-white px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Kejadian bencana terbaru</div>
          <button type="button" onClick={() => setNonce((n) => n + 1)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Muat ulang" aria-label="Muat ulang">
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {CHIPS.map(([id, label, title]) => (
            <button key={id} type="button" title={title} onClick={() => setChip(id)} data-testid={`kt-chip-${id}`}
              className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${chip === id ? 'border-teal-700 bg-teal-50 text-teal-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
              {label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[10px] leading-snug text-slate-500">
          {loading ? 'Memuat…' : `${nf(filtered.length)} kejadian · terbaru di atas`}
          {pk?.mode ? <> · Pusat Krisis {pk.mode === 'langsung' ? 'langsung' : 'belum tersedia dari API'}{pk.at ? ` ${pk.at}` : ''}</> : null}
        </p>
        {liveFiltered ? (
          <p className="mt-1 flex items-start gap-1 text-[10px] font-medium leading-snug text-amber-800">
            <Info className="mt-px h-3 w-3 shrink-0" />Sumber langsung (BMKG/GDACS) bersifat nasional; provinsi gempa diperkirakan dari kab/kota terdekat dengan titik pusat gempa.
          </p>
        ) : null}
        {hzBad.length ? <p className="mt-1 text-[10px] text-red-700">Tidak terhubung: {hzBad.map((u: any) => u.nama).join(', ')}</p> : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!loading && !filtered.length ? <p className="p-3 text-[11px] text-slate-500">Tidak ada kejadian untuk filter ini.</p> : null}
        <ul className="divide-y divide-slate-100">
          {filtered.slice(0, limit).map((k) => {
            const impact: string[] = []
            if (k.magnitudo != null) impact.push(`M ${k.magnitudo.toFixed(1)}`)
            if (k.kedalaman) impact.push(`kedalaman ${k.kedalaman}`)
            if (k.meninggal) impact.push(`${nf(k.meninggal)} meninggal`)
            if (k.pengungsi) impact.push(`${nf(k.pengungsi)} pengungsi`)
            if (k.terdampak) impact.push(`${nf(k.terdampak)} penduduk terdampak`)
            if (k.korban && k.korban !== k.terdampak) impact.push(`${nf(k.korban)} korban`)
            if (k.tingkat) impact.push(`tingkat ${k.tingkat === 'red' ? 'merah' : k.tingkat === 'orange' ? 'oranye' : 'hijau/kuning'}`)
            const canZoom = k.lat != null && k.lon != null
            return (
              <li key={k.id}>
                <button type="button" onClick={() => onPick(k)} disabled={!canZoom && !k.provCode}
                  className="w-full px-3 py-2 text-left hover:bg-teal-50/40 disabled:cursor-default" data-testid="kt-item"
                  title={canZoom ? 'Klik untuk memperbesar peta ke lokasi ini' : undefined}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`truncate rounded px-1.5 py-0.5 text-[10px] font-bold ${jenisClass(k.jenis)}`}>{k.jenis}</span>
                    <span className="shrink-0 text-[10px] font-semibold text-slate-500">{fmtTgl(k.tanggal)}{k.jam ? ` · ${k.jam}${k.zonaWib ? ' WIB' : ''}` : ''}</span>
                  </div>
                  <div className="mt-1 flex items-start gap-1 text-[11px] font-bold leading-tight text-slate-800">
                    <MapPin className="mt-px h-3 w-3 shrink-0 text-slate-400" />
                    <span className="line-clamp-2">{k.sumber === 'BMKG' || k.sumber === 'GDACS' || k.sumber === 'USGS' ? (k.lokasi || '-') : [k.lokasi, titleCase(k.provinsi)].filter(Boolean).join(', ')}</span>
                  </div>
                  {(k.sumber === 'BMKG' || k.sumber === 'GDACS' || k.sumber === 'USGS') && k.provinsi ? <div className="ml-4 text-[10px] text-slate-500">dekat {titleCase(k.provinsi)}</div> : null}
                  <div className="mt-0.5 flex items-center justify-between gap-2 text-[10px]">
                    <span className="truncate text-slate-600">{impact.join(' · ') || (k.keterangan ? k.keterangan : 'Belum ada angka dampak')}</span>
                    <span className={`shrink-0 font-bold ${SUMBER_CLASS[k.sumber] || 'text-slate-500'}`}>{k.sumber === 'Pusat Krisis' ? (k.kategori === 'krisis' ? 'Pusat Krisis · krisis' : 'Pusat Krisis') : k.sumber}</span>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
        {filtered.length > limit ? (
          <button type="button" onClick={() => setLimit((n) => n + 40)} className="w-full py-2 text-[11px] font-bold text-primary hover:bg-slate-50">Tampilkan lebih banyak ({nf(filtered.length - limit)} lagi)</button>
        ) : null}
        <p className="px-3 pb-3 pt-1 text-[9px] leading-snug text-slate-400">
          Sumber: Pusat Krisis Kesehatan (dashboard-new), EOC, BMKG, GDACS. Jam Pusat Krisis sesuai catatan sumber; jam BMKG/GDACS dalam WIB. Hanya data agregat per kejadian.
        </p>
      </div>
    </div>
  )
}
