'use client'

import { useEffect, useMemo, useState } from 'react'
import { PUBLIC_BASE_PATH } from '@/lib/public-path'
import { periodeRange } from '@/lib/puskris/derive'
import { toDeriveFilter, type PuskrisUiFilter } from '@/lib/puskris/ui-filter'

/**
 * Data dasbor dari /api/puskris/ringkasan. Bila rentang periode Filter Dasbor mulai sebelum cakupan
 * kejadian tahun berjalan, data diambil ulang dengan ?tanggal1&tanggal2 sehingga API EOC & NCC
 * dipanggil untuk rentang itu (bukan disaring dari data tahun ini saja).
 * Data yang belum selesai diambil server dimuat ulang diam-diam (maks. 12 kali, tiap 20 detik).
 */
export function usePuskrisRaw(f: PuskrisUiFilter, ready: boolean) {
  const [base, setBase] = useState<any>(null)
  const [ranged, setRanged] = useState<{ key: string; data: any } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [tries, setTries] = useState(0)
  const [loadingRange, setLoadingRange] = useState(false)

  const range = useMemo(() => periodeRange(toDeriveFilter(f)), [f])
  const cover = base?.eoc?.events_dari || `${new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 4)}-01-01`
  const needKey = ready && base && range.from < cover ? `${range.from}|${range.to}` : ''

  useEffect(() => {
    let on = true
    fetch(`${PUBLIC_BASE_PATH}/api/puskris/ringkasan`, { cache: 'no-store' })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((j) => { if (on) { setBase(j.data || j); if (!needKey) setPending(Boolean(j.pending)) } })
      .catch((e) => { if (on) setError((cur) => cur || e.message || 'Gagal memuat data') })
    return () => { on = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tries])

  useEffect(() => {
    if (!needKey) { setLoadingRange(false); return }
    let on = true
    setLoadingRange(true)
    const [a, b] = needKey.split('|')
    fetch(`${PUBLIC_BASE_PATH}/api/puskris/ringkasan?tanggal1=${a}&tanggal2=${b}`, { cache: 'no-store' })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((j) => { if (on) { setRanged({ key: needKey, data: j.data || j }); setPending(Boolean(j.pending)); setLoadingRange(false) } })
      .catch(() => { if (on) setLoadingRange(false) })
    return () => { on = false }
  }, [needKey, tries])

  useEffect(() => {
    if (!pending || tries >= 12) return
    const t = setTimeout(() => setTries((n) => n + 1), 20000)
    return () => clearTimeout(t)
  }, [pending, tries])

  const raw = needKey ? (ranged?.key === needKey ? ranged.data : null) : base
  return { raw: raw || (needKey ? base : null), base, error, pending: pending && tries < 12, loadingRange: Boolean(needKey) && ranged?.key !== needKey, rangeFetching: loadingRange, range }
}
