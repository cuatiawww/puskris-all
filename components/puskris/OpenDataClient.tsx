'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Copy, Database, ExternalLink, Loader2, RefreshCw, XCircle, AlertTriangle, Map as MapIcon } from 'lucide-react'
import { PUBLIC_BASE_PATH } from '@/lib/public-path'
import { OPEN_DATA_APIS, type OpenDataApi } from '@/lib/puskris/open-data'
import SectionHead from '@/components/puskris/SectionHead'
import InfoHint from '@/components/puskris/InfoHint'

type Check = {
  state: 'idle' | 'loading' | 'ok' | 'empty' | 'error'
  count?: number | null
  at?: string | null
  ms?: number
  message?: string
  upstream?: { nama: string; ok: boolean; status: number; count: number; error?: string }[]
}

function nowWib() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).slice(0, 16) + ' WIB'
}

async function checkApi(api: OpenDataApi): Promise<Check> {
  const t0 = performance.now()
  try {
    const r = await fetch(`${PUBLIC_BASE_PATH}${api.proxy}`, { cache: 'no-store' })
    const ms = Math.round(performance.now() - t0)
    const type = r.headers.get('content-type') || ''
    if (api.id === 'basemap') {
      return r.ok && type.startsWith('image') ? { state: 'ok', count: null, at: nowWib(), ms, message: 'Ubin peta termuat' } : { state: 'error', ms, message: `HTTP ${r.status}` }
    }
    const j: any = await r.json().catch(() => null)
    if (api.id === 'wind') {
      const ok = r.ok && Array.isArray(j) && j.length >= 2
      return ok
        ? { state: 'ok', count: Number(j[0]?.data?.length || 0), at: nowWib(), ms, message: `Grid ${j[0]?.header?.nx}×${j[0]?.header?.ny}, model ${String(j[0]?.header?.refTime || '').slice(0, 16).replace('T', ' ')} UTC` }
        : { state: 'error', ms, message: `Sumber angin tidak tersedia (HTTP ${r.status})` }
    }
    const items = api.itemKey ? (j?.[api.itemKey] || []) : []
    const count = Array.isArray(items) ? items.length : Number(j?.count || 0)
    if (!r.ok) return { state: 'error', ms, count: 0, at: j?.fetched_at, upstream: j?.upstream, message: `Semua sumber gagal (HTTP ${r.status})` }
    return { state: count ? 'ok' : 'empty', count, ms, at: j?.fetched_at || nowWib(), upstream: j?.upstream, message: count ? undefined : 'Sumber aktif, tetapi tidak ada data saat ini' }
  } catch (e: any) {
    return { state: 'error', ms: Math.round(performance.now() - t0), message: String(e?.message || e) }
  }
}

function StatusBadge({ c }: { c: Check | undefined }) {
  const st = c?.state || 'idle'
  const map = {
    idle: { cls: 'bg-slate-100 text-slate-600', icon: null, text: 'Belum dicek' },
    loading: { cls: 'bg-slate-100 text-slate-600', icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, text: 'Mengecek…' },
    ok: { cls: 'bg-emerald-50 text-emerald-700', icon: <CheckCircle2 className="h-3.5 w-3.5" />, text: 'Aktif' },
    empty: { cls: 'bg-amber-50 text-amber-800', icon: <AlertTriangle className="h-3.5 w-3.5" />, text: 'Aktif, data kosong' },
    error: { cls: 'bg-red-50 text-red-700', icon: <XCircle className="h-3.5 w-3.5" />, text: 'Gagal' },
  }[st]
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${map.cls}`} data-testid="open-data-status">{map.icon}{map.text}</span>
}

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <button type="button" title="Salin alamat" aria-label="Salin alamat"
      onClick={() => { navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1200) }).catch(() => {}) }}
      className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
      {done ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

export default function OpenDataClient() {
  const [checks, setChecks] = useState<Record<string, Check>>({})
  const [raw, setRaw] = useState<any>(null)

  const runOne = useCallback(async (api: OpenDataApi) => {
    setChecks((p) => ({ ...p, [api.id]: { ...(p[api.id] || {}), state: 'loading' } }))
    const res = await checkApi(api)
    setChecks((p) => ({ ...p, [api.id]: res }))
  }, [])
  const runAll = useCallback(() => { OPEN_DATA_APIS.forEach((a) => { void runOne(a) }) }, [runOne])

  useEffect(() => { runAll() }, [runAll])
  useEffect(() => {
    fetch(`${PUBLIC_BASE_PATH}/api/puskris/ringkasan`, { cache: 'no-store' }).then((r) => r.json()).then((j) => setRaw(j.data || j)).catch(() => {})
  }, [])

  const vals = Object.values(checks)
  const aktif = vals.filter((c) => c.state === 'ok' || c.state === 'empty').length
  const gagal = vals.filter((c) => c.state === 'error').length
  const loading = vals.some((c) => c.state === 'loading')

  const snapshots = raw ? [
    { nama: 'Pantauan Bencana / EOC', url: raw.eoc?.sumber_resmi, at: raw.eoc?.nasional?.fetched_at_wib || raw.eoc?.fetched_at_wib, label: raw.eoc?.label, isi: 'Kejadian terpantau & berdampak krisis, meninggal, hilang, luka berat/rawat inap, luka ringan/rawat jalan, pengungsi, penduduk terdampak, tren 5 tahun' },
    { nama: 'Dasbor EOC (sebaran provinsi)', url: raw.eoc?.sumber_vercel, at: raw.eoc?.fetched_at_wib, label: raw.eoc?.vercel_kumulatif?.catatan, isi: 'Agregat kejadian & korban per provinsi, jenis kejadian, daftar kejadian krisis terbaru' },
    { nama: 'PSC 119', url: raw.psc?.sumber, at: raw.psc?.fetched_at_wib, label: raw.psc?.label, isi: 'Panggilan, PSC aktif, armada ambulans, waktu respons' },
    { nama: 'Panggilan 119 (NCC)', url: raw.ncc?.sumber, at: raw.ncc?.source?.updatedAt ? new Date(raw.ncc.source.updatedAt).toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).slice(0, 16) + ' WIB' : null, label: raw.ncc?.period?.label, isi: 'Panggilan masuk, terjawab, tak terjawab, tingkat keberhasilan layanan per hari' },
    { nama: 'Tenaga Cadangan Kesehatan', url: raw.tck?.sumber, at: raw.tck?.fetched_at_wib, label: raw.tck?.label, isi: 'Individu, tim, Tim Medis Darurat (EMT) per provinsi' },
    { nama: 'Logistik Kesehatan', url: raw.logistik?.sumber, at: raw.logistik?.fetched_at_wib, label: raw.logistik?.label, isi: 'Stok obat, sarana prasarana, alat kesehatan, bahan medis habis pakai per regional' },
    { nama: 'Asistensi Risiko', url: raw.asistensi?.sumber_provinsi, at: raw.asistensi?.fetched_at_wib, label: raw.asistensi?.label, isi: 'Kelengkapan asesmen & status kapasitas provinsi dan kabupaten/kota' },
  ].filter((s) => s.url) : []

  return (
    <div className="w-full space-y-6 px-4 py-6 sm:px-6 lg:px-8" data-testid="open-data-root">
      <nav aria-label="Jalur halaman" className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-500">
        <Link href="/dashboard/ringkasan" className="hover:text-primary">Dasbor</Link>
        <span aria-hidden>/</span>
        <span className="text-slate-800">Open Data</span>
      </nav>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="skdr-eyebrow">Pusat Krisis Kesehatan · API Intelijen</div>
          <h1 className="mt-0.5 text-2xl font-black tracking-tight text-slate-900">Open Data &amp; API Luar</h1>
          <p className="mt-1 max-w-4xl text-xs text-slate-500">
            Daftar API publik yang dipakai lapisan peta “API Intelijen Eksternal” di Ringkasan. Semua diakses lewat proxy baca-saja (GET) aplikasi ini,
            tanpa kunci rahasia dan tanpa data pribadi. Status diperiksa langsung saat halaman dibuka.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{aktif} aktif</span>
          {gagal ? <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">{gagal} gagal</span> : null}
          <button type="button" onClick={runAll} disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:opacity-90 disabled:opacity-60">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Cek semua status
          </button>
          <Link href="/dashboard/ringkasan" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
            <MapIcon className="h-3.5 w-3.5" /> Buka peta Ringkasan
          </Link>
        </div>
      </div>

      <section className="skdr-section">
        <SectionHead eyebrow="Lapisan peta" title="API intelijen eksternal (langsung)" desc="Nyalakan di Ringkasan → Pengaturan Lapisan → API Intelijen Eksternal." />
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {OPEN_DATA_APIS.map((api) => {
            const c = checks[api.id]
            return (
              <article key={api.id} className="skdr-card flex flex-col p-4" data-testid={`open-data-${api.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-lg" aria-hidden>{api.icon}</span>
                      <h3 className="truncate text-sm font-black text-slate-900">{api.nama}</h3>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{api.kategori}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{api.deskripsi}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500"><b className="text-slate-700">Kegunaan:</b> {api.manfaat}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <StatusBadge c={c} />
                    <button type="button" onClick={() => runOne(api)} className="text-[11px] font-bold text-primary hover:underline">Cek status</button>
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
                  <div className="rounded-lg bg-slate-50 px-2 py-1.5"><dt className="text-[10px] font-bold uppercase text-slate-400">Jumlah data</dt><dd className="font-black tabular-nums text-slate-800">{c?.count != null ? `${c.count.toLocaleString('id-ID')}${api.id === 'bnpb' ? ` / ${api.upstream.length} lapisan aktif` : ''}` : '—'}</dd></div>
                  <div className="rounded-lg bg-slate-50 px-2 py-1.5"><dt className="text-[10px] font-bold uppercase text-slate-400">Terakhir diambil</dt><dd className="font-bold text-slate-800">{c?.at || '—'}</dd></div>
                  <div className="rounded-lg bg-slate-50 px-2 py-1.5"><dt className="flex items-center text-[10px] font-bold uppercase text-slate-400">Waktu respons<InfoHint text="Lama proxy aplikasi menjawab, termasuk mengambil data dari penyedia bila cache sudah kedaluwarsa." /></dt><dd className="font-bold tabular-nums text-slate-800">{c?.ms != null ? `${c.ms.toLocaleString('id-ID')} ms` : '—'}</dd></div>
                  <div className="rounded-lg bg-slate-50 px-2 py-1.5"><dt className="text-[10px] font-bold uppercase text-slate-400">Pembaruan</dt><dd className="font-bold text-slate-800">{api.pembaruan}</dd></div>
                </dl>
                {c?.message ? <p className={`mt-2 text-[11px] font-semibold ${c.state === 'error' ? 'text-red-700' : 'text-slate-600'}`}>{c.message}</p> : null}
                <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-dashed border-slate-200 px-2 py-1.5 text-[11px]">
                  <span className="shrink-0 font-bold text-slate-500">Endpoint aplikasi (GET)</span>
                  <code className="min-w-0 flex-1 truncate font-mono text-slate-800">{api.proxy}</code>
                  <CopyBtn text={`${typeof window !== 'undefined' ? window.location.origin : ''}${PUBLIC_BASE_PATH}${api.proxy}`} />
                  <a href={`${PUBLIC_BASE_PATH}${api.proxy}`} target="_blank" rel="noreferrer" className="shrink-0 font-bold text-primary hover:underline">Buka</a>
                </div>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="text-[10px] uppercase tracking-wide text-slate-400">
                      <tr><th className="py-1 pr-2">Sumber asli</th><th className="py-1 pr-2">Penyedia</th><th className="py-1">Format</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {api.upstream.map((u) => {
                        return (
                          <tr key={u.url} className="align-top">
                            <td className="py-1 pr-2">
                              <div className="font-semibold text-slate-700">{u.nama}</div>
                              <div className="flex items-center gap-1">
                                <a href={u.url.startsWith('/') ? `${PUBLIC_BASE_PATH}${u.url}` : u.url} target="_blank" rel="noreferrer" className="max-w-[340px] truncate font-mono text-[10px] text-primary hover:underline" title={u.url}>{u.url}</a>
                                <ExternalLink className="h-3 w-3 shrink-0 text-slate-400" />
                              </div>
                              {u.catatan ? <div className="text-[10px] text-slate-400">{u.catatan}</div> : null}
                            </td>
                            <td className="py-1 pr-2 text-slate-600">{u.penyedia}</td>
                            <td className="py-1 text-slate-600">{u.format}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {c?.upstream?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1" aria-label="Hasil cek tiap sumber">
                    {c.upstream.map((u) => (
                      <span key={u.nama} title={u.error} className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${u.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                        {u.nama}: {u.ok ? (api.id === 'bnpb' ? `OK${u.error ? ` · ${u.error}` : ''}` : `OK · ${u.count.toLocaleString('id-ID')} data`) : `gagal${u.error ? ` (${u.error})` : ''}`}
                      </span>
                    ))}
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      </section>

      <section className="skdr-section">
        <SectionHead eyebrow="Sumber dasbor" title="Data agregat Pusat Krisis Kesehatan (snapshot)" desc="Angka di Ringkasan dan halaman pilar diambil dari dasbor resmi ini, disimpan sebagai agregat tanpa data individu." />
        <div className="skdr-card overflow-x-auto p-0">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
              <tr><th className="px-3 py-2">Sumber</th><th className="px-3 py-2">Isi data</th><th className="px-3 py-2">Diambil</th><th className="px-3 py-2">Alamat</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="px-3 py-2 font-bold text-slate-800"><span className="inline-flex items-center gap-1"><Database className="h-3.5 w-3.5 text-primary" /> API Ringkasan (internal)</span></td>
                <td className="px-3 py-2 text-slate-600">Seluruh agregat di bawah dalam satu JSON (GET, baca-saja)</td>
                <td className="px-3 py-2 text-slate-600">{raw?.generated_at_wib || '—'}</td>
                <td className="px-3 py-2"><a href={`${PUBLIC_BASE_PATH}/api/puskris/ringkasan`} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-primary hover:underline">/api/puskris/ringkasan</a></td>
              </tr>
              {snapshots.map((s) => (
                <tr key={s.nama}>
                  <td className="px-3 py-2 font-bold text-slate-800">{s.nama}</td>
                  <td className="px-3 py-2 text-slate-600">{s.isi}{s.label ? <div className="text-[10px] text-slate-400">{s.label}</div> : null}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-600">{s.at || '—'}</td>
                  <td className="px-3 py-2"><a href={s.url} target="_blank" rel="noreferrer" className="inline-flex max-w-[320px] items-center gap-1 truncate text-[11px] font-semibold text-primary hover:underline" title={s.url}>{s.url.replace(/^https?:\/\//, '')}<ExternalLink className="h-3 w-3 shrink-0" /></a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Aplikasi hanya membaca (GET). Tidak ada permintaan yang mengubah data di sistem sumber.</p>
      </section>
    </div>
  )
}
