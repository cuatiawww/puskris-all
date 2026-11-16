'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, X } from 'lucide-react'
import { nf } from '@/lib/puskris/derive'
import type { Area, Titik } from '@/lib/spasial-api'
import { areaVal, type Metric, type SpasialResp } from '@/lib/spasial-api'
import type { ProvinceRow } from '@/lib/puskris/types'
import { CHORO_OPTIONS, type ChoroId } from '@/lib/puskris/to-spasial'

type Tab = 'ringkasan' | 'hotspot' | 'detail'

export default function PuskrisInfoPanel({
  data, titik, metric, selected, rows, choro, onPickArea, onPickTitik, onClose, onClear,
}: {
  data: SpasialResp | null
  titik: Titik[]
  metric: Metric
  selected: Area | null
  rows: ProvinceRow[]
  choro: ChoroId
  onPickArea: (a: Area) => void
  onPickTitik: (t: Titik) => void
  onClose: () => void
  onClear: () => void
}) {
  const [tab, setTab] = useState<Tab>('ringkasan')
  useEffect(() => { if (selected) setTab('detail') }, [selected])
  const ranked = useMemo(() => {
    const as = (data?.wilayah || []).map((a) => ({ a, v: areaVal(a, metric, -1) }))
    return as.filter((x) => x.v !== null).sort((x, y) => (y.v || 0) - (x.v || 0)).slice(0, 15)
  }, [data, metric])
  const units = useMemo(() => [...titik].sort((a, b) => b.k - a.k).slice(0, 15), [titik])
  const maxV = Math.max(1, ...ranked.map((x) => Math.abs(x.v || 0)))
  const r = data?.ringkasan
  const choroLabel = CHORO_OPTIONS.find((c) => c.id === choro)?.label || 'Nilai'
  const selRow = selected ? rows.find((x) => x.code === selected.code) : null

  return (
    <aside className="flex h-full flex-col overflow-hidden border-none bg-slate-50/70">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-slate-800">{selected ? selected.nama : (data?.meta?.breadcrumb || []).map((c: any) => c.label).slice(-1)[0] || 'Indonesia'}</p>
          <p className="text-[11px] text-slate-500">{data?.meta?.periode_label} · {data?.meta?.sumber_label}</p>
        </div>
        <div className="flex items-center gap-1">
          {selected && <button type="button" onClick={onClear} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" title="Hapus pilihan"><ChevronLeft className="h-4 w-4" /></button>}
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Tutup panel"><X className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="flex gap-1 border-b border-slate-200 bg-white px-2 py-1.5">
        {(['ringkasan', 'hotspot', 'detail'] as Tab[]).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-lg px-2.5 py-1 text-[11px] font-bold capitalize ${tab === t ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
            {t === 'ringkasan' ? 'Ringkasan' : t === 'hotspot' ? 'Hotspot' : 'Detail wilayah'}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-3 text-xs">
        {tab === 'ringkasan' && (
          <div className="space-y-2">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Ringkasan peta</div>
            <dl className="grid grid-cols-2 gap-2">
              <Stat label="Nilai arsiran" value={choroLabel} />
              <Stat label="Wilayah" value={nf(data?.wilayah?.length)} />
              <Stat label="Titik kejadian" value={nf(titik.length)} />
              <Stat label="KLB / korban jiwa" value={nf(r?.klb)} />
            </dl>
            <p className="text-[11px] leading-relaxed text-slate-600">Panel ini mengikuti lapisan yang sedang aktif. Ubah arsiran atau titik di Pengaturan Peta &amp; Lapisan.</p>
          </div>
        )}
        {tab === 'hotspot' && (
          <div className="space-y-3">
            <div>
              <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Provinsi — {choroLabel}</div>
              <ol className="space-y-1">
                {ranked.map(({ a, v }, i) => (
                  <li key={a.code}>
                    <button type="button" onClick={() => onPickArea(a)} className="flex w-full items-center gap-2 rounded-lg px-1 py-0.5 hover:bg-white">
                      <span className="w-4 text-[10px] font-bold text-slate-400">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-left font-semibold text-slate-800">{a.nama}</span>
                      <span className="tabular-nums font-bold">{metric === 'chg_minggu' ? Number(v).toFixed(1) : nf(v)}</span>
                    </button>
                    <div className="ml-6 h-1 rounded-full bg-slate-100"><div className="h-1 rounded-full bg-primary" style={{ width: `${(Math.abs(v || 0) / maxV) * 100}%` }} /></div>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Titik kejadian</div>
              <ol className="space-y-1">
                {units.map((t) => (
                  <li key={t.idx}>
                    <button type="button" onClick={() => onPickTitik(t)} className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-0.5 text-left hover:bg-white">
                      <span className="truncate font-semibold text-slate-800">{t.unit}{t.kab ? ` · ${t.kab}` : ''}</span>
                      <span className="tabular-nums font-bold">{nf(t.k)}</span>
                    </button>
                  </li>
                ))}
                {!units.length && <p className="text-slate-500">Tidak ada titik pada filter ini.</p>}
              </ol>
            </div>
          </div>
        )}
        {tab === 'detail' && (
          selected && selRow ? (
            <dl className="space-y-1.5">
              <div className="text-sm font-black text-slate-900">{selRow.nama}</div>
              <Row k="Kejadian terpantau" v={nf(selRow.kejadian)} />
              <Row k="Berdampak krisis" v={nf(selRow.krisis)} />
              <Row k="Meninggal" v={nf(selRow.meninggal)} />
              <Row k="Pengungsi" v={nf(selRow.pengungsi)} />
              <Row k="Terdampak" v={nf(selRow.terdampak)} />
              <Row k="PSC aktif" v={`${nf(selRow.pscAktif)} / ${nf(selRow.pscTotal)}`} />
              <Row k="Ambulans" v={nf(selRow.ambulans)} />
              <Row k="Panggilan 119" v={nf(selRow.panggilan)} />
              <Row k="Tenaga cadangan" v={nf(selRow.tck)} />
              <Row k="Indeks kesenjangan" v={selRow.kesenjangan.toFixed(2)} />
            </dl>
          ) : <p className="text-slate-500">Klik provinsi pada peta untuk melihat rincian.</p>
        )}
      </div>
    </aside>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white p-2">
      <dt className="text-[10px] font-bold uppercase text-slate-400">{label}</dt>
      <dd className="font-black text-slate-900">{value}</dd>
    </div>
  )
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-slate-100 py-1">
      <dt className="text-slate-500">{k}</dt>
      <dd className="font-bold tabular-nums text-slate-800">{v}</dd>
    </div>
  )
}
