'use client'

import { useMemo, useState } from 'react'
import { Ambulance, Hospital, Navigation, PhoneCall, Route } from 'lucide-react'
import { nf } from '@/lib/puskris/derive'
import { haversineKm } from '@/lib/puskris/kejadian-template'
import type { OsrmRouteResult } from './types'

export default function KejadianFaskesDirectory({
  kejadian,
  nearby,
  raw,
}: {
  kejadian: any
  nearby: any
  raw: any
}) {
  const lat = Number.isFinite(Number(kejadian?.lat)) ? Number(kejadian.lat) : null
  const lon = Number.isFinite(Number(kejadian?.lon)) ? Number(kejadian.lon) : null

  const [routeResult, setRouteResult] = useState<OsrmRouteResult | null>(null)
  const [routeLoadingId, setRouteLoadingId] = useState<string | null>(null)
  const [routeError, setRouteError] = useState<string | null>(null)

  const pscList: any[] = nearby?.psc?.tersedia ? (nearby.psc.daftar || []) : []
  const rsNearbyPoints = useMemo(() => {
    if (lat == null || lon == null) return []
    const rsAll: [number, number][] = raw?.psc?.titik_rs || []
    return rsAll
      .filter((r) => Array.isArray(r) && r[0] != null && r[1] != null)
      .map((r, i) => ({
        id: `rs-${i}`,
        nama: `Rumah Sakit Jejaring #${i + 1}`,
        lat: Number(r[0]),
        lon: Number(r[1]),
        jarak_km: Math.round(haversineKm(lat, lon, Number(r[0]), Number(r[1])) * 10) / 10,
      }))
      .filter((r) => r.jarak_km <= 80)
      .sort((a, b) => a.jarak_km - b.jarak_km)
      .slice(0, 12)
  }, [raw, lat, lon])

  const computeRoute = async (targetLat: number, targetLon: number, targetName: string, targetJenis: string, keyId: string) => {
    if (lat == null || lon == null) return
    setRouteLoadingId(keyId)
    setRouteError(null)
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${lon},${lat};${targetLon},${targetLat}?overview=false`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`)
      const j = await res.json()
      const rt = j?.routes?.[0]
      if (!rt) throw new Error('Rute jalan darat tidak ditemukan (kemungkinan terpisah perairan)')
      setRouteResult({
        targetName,
        targetJenis,
        distanceKm: Math.round((Number(rt.distance || 0) / 1000) * 10) / 10,
        durationMin: Math.max(1, Math.round(Number(rt.duration || 0) / 60)),
        coordinates: [],
        from: [lon, lat],
        to: [targetLon, targetLat],
      })
    } catch (e: any) {
      setRouteError(String(e?.message || 'Gagal menghitung rute OSRM'))
    } finally {
      setRouteLoadingId(null)
    }
  }

  return (
    <section className="skdr-card space-y-4 p-4 sm:p-5" data-testid="kejadian-faskes-rute">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#00705a]">
            <Hospital className="h-3.5 w-3.5" /> Jejaring Rujukan &amp; Gawat Darurat (≤ 80 km)
          </div>
          <h3 className="mt-0.5 text-base font-black text-slate-900">PSC 119, Ambulans &amp; RS Sekitar Kota</h3>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-center text-xs">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-1.5">
            <div className="text-[9.5px] font-bold uppercase text-emerald-800">PSC Aktif</div>
            <div className="text-sm font-black tabular-nums text-emerald-950">
              {nearby?.psc?.tersedia ? `${nf(nearby.psc.aktif)}/${nf(nearby.psc.total)}` : '—'}
            </div>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-1.5">
            <div className="text-[9.5px] font-bold uppercase text-amber-800">Ambulans Siap</div>
            <div className="text-sm font-black tabular-nums text-amber-950">
              {nearby?.ambulans?.tersedia ? `${nf(nearby.ambulans.siap)}/${nf(nearby.ambulans.total)}` : '—'}
            </div>
          </div>
          <div className="rounded-xl border border-teal-200 bg-teal-50/70 px-3 py-1.5">
            <div className="text-[9.5px] font-bold uppercase text-teal-800">Titik RS (50 km)</div>
            <div className="text-sm font-black tabular-nums text-teal-950">
              {nearby?.rs?.tersedia ? nf(nearby.rs.total) : '—'}
            </div>
          </div>
        </div>
      </div>

      {routeResult ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs">
          <div className="flex items-center gap-2">
            <Route className="h-4 w-4 text-blue-700" />
            <span className="font-bold text-slate-900">Estimasi Rute Darat OSRM → {routeResult.targetName}:</span>
            <span className="font-mono font-black text-blue-800">{routeResult.distanceKm} km · ±{routeResult.durationMin} menit</span>
          </div>
          <button type="button" onClick={() => setRouteResult(null)} className="text-[11px] font-bold text-slate-500 hover:text-slate-900">
            Tutup
          </button>
        </div>
      ) : null}

      {routeError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-900">
          {routeError}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {pscList.map((p, i) => {
          const hasCoord = Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lon))
          const rowKey = `psc-${i}`
          return (
            <div key={rowKey} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <PhoneCall className="h-3 w-3 shrink-0 text-emerald-700" />
                  <span className="truncate font-bold text-slate-900">{p.nama}</span>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-black uppercase ${p.aktif ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                    {p.aktif ? 'Aktif' : 'Off'}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10.5px] text-slate-500">
                  <span className="inline-flex items-center gap-1"><Ambulance className="h-3 w-3" /> {nf(p.siap)}/{nf(p.ambulans)} siap</span>
                  <span>Jarak lurus: <b>{p.jarak_km != null ? `${p.jarak_km} km` : '—'}</b></span>
                </div>
              </div>
              {hasCoord && lat != null && lon != null ? (
                <button
                  type="button"
                  onClick={() => computeRoute(Number(p.lat), Number(p.lon), p.nama, 'PSC 119', rowKey)}
                  disabled={routeLoadingId === rowKey}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10.5px] font-bold text-blue-800 hover:bg-blue-100 disabled:opacity-50"
                >
                  <Navigation className="h-3 w-3" />
                  {routeLoadingId === rowKey ? '...' : 'Rute'}
                </button>
              ) : null}
            </div>
          )
        })}

        {rsNearbyPoints.slice(0, 6).map((rs) => (
          <div key={rs.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Hospital className="h-3 w-3 shrink-0 text-teal-700" />
                <span className="truncate font-bold text-slate-800">{rs.nama}</span>
              </div>
              <div className="mt-0.5 text-[10.5px] text-slate-500">
                Jarak lurus: <b>{rs.jarak_km} km</b> · Titik koordinat API PSC
              </div>
            </div>
            {lat != null && lon != null ? (
              <button
                type="button"
                onClick={() => computeRoute(rs.lat, rs.lon, rs.nama, 'RS Jejaring', rs.id)}
                disabled={routeLoadingId === rs.id}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10.5px] font-bold text-blue-800 hover:bg-blue-100 disabled:opacity-50"
              >
                <Navigation className="h-3 w-3" />
                {routeLoadingId === rs.id ? '...' : 'Rute'}
              </button>
            ) : null}
          </div>
        ))}
      </div>

      {!pscList.length && !rsNearbyPoints.length ? (
        <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-[11px] text-slate-500">
          Belum ada titik PSC 119 / RS jejaring dalam radius 50–80 km dari API PSC Kemkes.
        </p>
      ) : null}

      <p className="text-[10px] text-slate-400">
        Rute darat dihitung real-time via Open Source Routing Machine (OSRM). Titik RS menampilkan lokasi koordinat jejaring resmi tanpa mempublikasikan data sensitif pasien.
      </p>
    </section>
  )
}
