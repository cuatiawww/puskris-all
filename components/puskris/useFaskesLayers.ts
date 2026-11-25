'use client'

import { useEffect, useMemo, useState } from 'react'
import { PUBLIC_BASE_PATH } from '@/lib/public-path'
import { buildFaskesLayers, type FaskesAgregat, type FaskesJenis, type FaskesTitik, type FaskesToggles } from '@/lib/puskris/faskes-layers'

type TitikState = {
  list: FaskesTitik[]
  ready: boolean
  loading: boolean
  error?: string
  total?: number
}

const EMPTY: TitikState = { list: [], ready: false, loading: false }

async function getJson(url: string) {
  const r = await fetch(url)
  const j = await r.json().catch(() => null)
  if (!r.ok || !j?.ok) throw new Error(j?.error || `HTTP ${r.status}`)
  return j.data
}

function useTitikJenis(jenis: FaskesJenis, enabled: boolean, prov: string | null, kab: string | null): TitikState {
  const [st, setSt] = useState<TitikState>(EMPTY)
  useEffect(() => {
    if (!enabled) {
      setSt(EMPTY)
      return
    }
    let alive = true
    const scope = new URLSearchParams({ bagian: 'titik', jenis })
    if (prov) scope.set('prov', prov)
    if (kab) scope.set('kab', kab)

    setSt({ list: [], ready: false, loading: true })

    const run = async () => {
      if (prov) {
        const data = await getJson(`${PUBLIC_BASE_PATH}/api/puskris/faskes?${scope.toString()}`)
        if (!alive) return
        const list: FaskesTitik[] = data?.titik || []
        setSt({ list, ready: true, loading: false, total: data?.pagination?.total ?? list.length })
        return
      }
      let page = 1
      let all: FaskesTitik[] = []
      let hasMore = true
      let total = 0
      while (alive && hasMore) {
        const data = await getJson(`${PUBLIC_BASE_PATH}/api/puskris/faskes?bagian=titik&jenis=${jenis}&page=${page}&per=2000`)
        const chunk: FaskesTitik[] = data?.titik || []
        all = all.concat(chunk)
        total = Number(data?.pagination?.total || all.length)
        hasMore = Boolean(data?.pagination?.hasMore)
        page += 1
        if (alive) setSt({ list: all, ready: all.length > 0, loading: hasMore, total })
        if (page > 20) break
      }
      if (alive) setSt({ list: all, ready: true, loading: false, total })
    }

    run().catch((e) => {
      if (alive) setSt({ list: [], ready: false, loading: false, error: String(e?.message || e) })
    })
    return () => { alive = false }
  }, [jenis, enabled, prov, kab])
  return st
}

export function useFaskesLayers(toggles: FaskesToggles, prov: string | null, kab: string | null) {
  const wantAny = toggles.rs || toggles.puskesmas
  const [agregat, setAgregat] = useState<FaskesAgregat[]>([])
  const [agregatError, setAgregatError] = useState<string | undefined>()
  const [agregatLoading, setAgregatLoading] = useState(false)

  useEffect(() => {
    let alive = true
    setAgregatLoading(true)
    const q = new URLSearchParams({ bagian: 'agregat' })
    if (prov) q.set('prov', prov)
    getJson(`${PUBLIC_BASE_PATH}/api/puskris/faskes?${q.toString()}`)
      .then((data) => { if (alive) { setAgregat(Array.isArray(data) ? data : []); setAgregatError(undefined) } })
      .catch((e) => { if (alive) { setAgregat([]); setAgregatError(String(e?.message || e)) } })
      .finally(() => { if (alive) setAgregatLoading(false) })
    return () => { alive = false }
  }, [prov])

  const rs = useTitikJenis('rs', toggles.rs, prov, kab)
  const pusk = useTitikJenis('puskesmas', toggles.puskesmas, prov, kab)

  const layers = useMemo(() => buildFaskesLayers({
    toggles,
    agregat,
    titikRs: rs.list,
    titikPuskesmas: pusk.list,
    titikRsReady: rs.ready,
    titikPuskesmasReady: pusk.ready,
  }), [toggles, agregat, rs.list, pusk.list, rs.ready, pusk.ready])

  return {
    layers,
    agregat,
    agregatLoading,
    agregatError,
    rs,
    pusk,
    wantAny,
  }
}
