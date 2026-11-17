'use client'

import type { Peringatan } from '@/lib/puskris/integrasi'

export default function PeringatanList({
  items, onPick,
}: {
  items: Peringatan[]
  onPick?: (code?: string) => void
}) {
  if (!items.length) {
    return <p className="p-3 text-[11px] text-slate-500">Tidak ada peringatan pada filter ini.</p>
  }
  return (
    <ol className="space-y-2 p-3" data-testid="peringatan-otomatis">
      {items.map((p) => (
        <li key={p.id}>
          <button
            type="button"
            onClick={() => onPick?.(p.code)}
            className={`w-full rounded-xl border p-2.5 text-left ${p.tingkat === 'tinggi' ? 'border-rose-200 bg-rose-50/70' : 'border-amber-200 bg-amber-50/60'}`}
          >
            <div className="flex items-center gap-1.5">
              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase ${p.tingkat === 'tinggi' ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'}`}>
                {p.tingkat}
              </span>
            </div>
            <p className="mt-1 text-[11px] font-black text-slate-900">{p.judul}</p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-slate-600">{p.detail}</p>
          </button>
        </li>
      ))}
    </ol>
  )
}
