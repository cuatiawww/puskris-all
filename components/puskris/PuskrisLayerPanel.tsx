'use client'

import { useId } from 'react'
import type { Layers } from '@/components/spasial/SpasialMap'
import { CHORO_OPTIONS, type ChoroId } from '@/lib/puskris/to-spasial'

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  const id = useId()
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-2">
      <span className="text-[11px] font-semibold text-slate-700">{label}</span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition ${checked ? 'bg-primary' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-xs transition ${checked ? 'left-4' : 'left-0.5'}`} />
      </button>
    </label>
  )
}

export default function PuskrisLayerPanel({
  layers, setLayers, choro, setChoro, pointOn, setPointOn,
}: {
  layers: Layers
  setLayers: (next: Layers | ((p: Layers) => Layers)) => void
  choro: ChoroId
  setChoro: (id: ChoroId) => void
  pointOn: boolean
  setPointOn: (v: boolean) => void
}) {
  const patch = (p: Partial<Layers>) => setLayers({ ...layers, ...p })
  return (
    <div className="space-y-4 text-xs">
      <div>
        <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Peta Dasar</div>
        <div className="grid grid-cols-2 gap-1">
          {([['osm', 'OSM'], ['none', 'Medan'], ['satellite', 'Satelit'], ['light', 'Terang']] as const).map(([b, label]) => (
            <button
              key={b}
              type="button"
              onClick={() => patch({ base: b })}
              className={`rounded-lg border px-2 py-1.5 text-[11px] font-bold ${layers.base === b ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Arsiran Provinsi</div>
        <Switch checked={layers.choro} onChange={(v) => patch({ choro: v })} label="Tampilkan arsiran" />
        {layers.choro && (
          <>
            <label className="mt-2 block text-[11px] font-semibold text-slate-600">Variabel arsiran</label>
            <select
              className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-bold"
              value={choro}
              onChange={(e) => setChoro(e.target.value as ChoroId)}
            >
              {CHORO_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.group} — {o.label}</option>)}
            </select>
            <label className="mt-2 block text-[11px] text-slate-500">Transparansi {Math.round(layers.opChoro * 100)}%</label>
            <input type="range" min={20} max={100} value={Math.round(layers.opChoro * 100)} onChange={(e) => patch({ opChoro: Number(e.target.value) / 100 })} className="w-full" />
          </>
        )}
      </div>

      <div>
        <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Titik Kejadian</div>
        <Switch checked={pointOn} onChange={setPointOn} label="Tampilkan titik kejadian" />
        {pointOn && (
          <div className="mt-2 grid grid-cols-2 gap-1">
            {(['kluster', 'titik'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => patch({ points: m })}
                className={`rounded-lg border px-2 py-1.5 text-[11px] font-bold capitalize ${layers.points === m ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 text-slate-600'}`}
              >
                {m === 'kluster' ? 'Klaster' : 'Titik'}
              </button>
            ))}
          </div>
        )}
        <p className="mt-2 text-[10px] leading-relaxed text-slate-500">Titik diletakkan di pusat provinsi (data sumber belum punya koordinat tepat). Ukuran mengikuti terdampak/korban.</p>
      </div>
    </div>
  )
}
