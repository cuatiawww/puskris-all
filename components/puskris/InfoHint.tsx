'use client'

import { Info } from 'lucide-react'

export default function InfoHint({ text, label }: { text: string; label?: string }) {
  return (
    <button
      type="button"
      title={text}
      aria-label={label || text}
      className="group relative ml-1 inline-flex align-middle text-slate-400 hover:text-slate-700 focus:outline-none"
    >
      <Info className="h-3.5 w-3.5" aria-hidden />
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1 hidden w-56 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left text-[11px] font-medium normal-case tracking-normal text-slate-600 shadow-lg group-hover:block group-focus:block"
      >
        {text}
      </span>
    </button>
  )
}
