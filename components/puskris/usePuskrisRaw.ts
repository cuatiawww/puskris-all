'use client'

import { useEffect, useMemo, useState } from 'react'
import { PUBLIC_BASE_PATH } from '@/lib/public-path'
import { periodeRange } from '@/lib/puskris/derive'
import { toDeriveFilter, type PuskrisUiFilter } from '@/lib/puskris/ui-filter'

/**
 * Data dasbor dari /api/puskris/ringkasan. Bila rentang periode Filter Dasbor mulai sebelum cakupan
 * kejadian tahun berjalan, data diambil ulang dengan ?tanggal1&tanggal2 sehingga API EOC & NCC
 * dipanggil untuk rentang itu (bukan disaring dari data tahun ini saja).
 * Data yang belum selesai diambil server dimuat ulang diam-diam (maks. 12 kali, awalnya tiap 2–6 detik).
 *
 * Hasil disimpan di memori modul supaya pindah menu sidebar (yang me-remount halaman) tidak
 * mengosongkan data dan memaksa tunggu API ringkasan sampai 25 detik lagi.
 */
type Payload = { data: any; pending: boolean }

let baseCache: Payload | null = null
let baseInflight: Promise<Payload> | null = null
const rangeCache = new Map<string, Payload>()
const rangeInflight = new Map<string, Promise<Payload>>()

function ringkasanUrl(query = '') {
  return `${PUBLIC_BASE_PATH}/api/puskris/ringkasan${query}`
}

function parsePayload(j: any): Payload {
  return { data: j.data || j, pending: Boolean(j.pending) }
}

function loadJson(url: string, bust = false): Promise<Payload> {
  return fetch(url, bust ? { cache: 'no-store' } : { cache: 'default' })
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
    .then(parsePayload)
}

function loadBase(force = false): Promise<Payload> {
  if (!force && baseCache && !baseCache.pending) return Promise.resolve(baseCache)
  if (baseInflight) return baseInflight
  baseInflight = loadJson(ringkasanUrl(), force)
    .then((p) => { baseCache = p; return p })
    .finally(() => { baseInflight = null })
  return baseInflight
}

function loadRange(key: string, force = false): Promise<Payload> {
  const cached = rangeCache.get(key)
  if (!force && cached && !cached.pending) return Promise.resolve(cached)
  const existing = rangeInflight.get(key)
  if (existing) return existing
  const [a, b] = key.split('|')
  const p = loadJson(ringkasanUrl(`?tanggal1=${a}&tanggal2=${b}`), force)
    .then((payload) => { rangeCache.set(key, payload); return payload })
    .finally(() => { rangeInflight.delete(key) })
  rangeInflight.set(key, p)
  return p
}

export function usePuskrisRaw(f: PuskrisUiFilter, ready: boolean) {
  const [base, setBase] = useState<any>(() => baseCache?.data ?? null)
  const [ranged, setRanged] = useState<{ key: string; data: any } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(() => Boolean(baseCache?.pending))
  const [tries, setTries] = useState(0)
  const [loadingRange, setLoadingRange] = useState(false)

  const range = useMemo(() => periodeRange(toDeriveFilter(f)), [f])
  const cover = base?.eoc?.events_dari || `${new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 4)}-01-01`
  const needKey = ready && base && range.from < cover ? `${range.from}|${range.to}` : ''

  useEffect(() => {
    let on = true
    loadBase(tries > 0)
      .then((p) => { if (on) { setBase(p.data); if (!needKey) setPending(Boolean(p.pending)) } })
      .catch((e) => { if (on) setError((cur) => cur || e.message || 'Gagal memuat data') })
    return () => { on = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tries])

  useEffect(() => {
    if (!needKey) { setLoadingRange(false); return }
    const cached = rangeCache.get(needKey)
    if (cached?.data) {
      setRanged({ key: needKey, data: cached.data })
      setPending(Boolean(cached.pending))
      if (!cached.pending && tries === 0) { setLoadingRange(false); return }
    }
    let on = true
    setLoadingRange(!cached?.data)
    loadRange(needKey, tries > 0)
      .then((p) => { if (on) { setRanged({ key: needKey, data: p.data }); setPending(Boolean(p.pending)); setLoadingRange(false) } })
      .catch(() => { if (on) setLoadingRange(false) })
    return () => { on = false }
  }, [needKey, tries])

  useEffect(() => {
    if (!pending || tries >= 12) return
    const backoff = [2000, 3000, 4000, 6000, 8000, 12000, 20000]
    const t = setTimeout(() => setTries((n) => n + 1), backoff[Math.min(tries, backoff.length - 1)])
    return () => clearTimeout(t)
  }, [pending, tries])

  const raw = needKey ? (ranged?.key === needKey ? ranged.data : null) : base
  return { raw: raw || (needKey ? base : null), base, error, pending: pending && tries < 12, loadingRange: Boolean(needKey) && ranged?.key !== needKey, rangeFetching: loadingRange, range }
}
