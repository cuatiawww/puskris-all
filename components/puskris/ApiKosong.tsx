import { CloudOff, RefreshCw } from 'lucide-react'

/** Keadaan kosong standar: data belum tersedia dari API (tidak ada angka cadangan/contoh). */
export default function ApiKosong({ pesan, detail, pending = false, compact = false }: { pesan?: string; detail?: string | null; pending?: boolean; compact?: boolean }) {
  return (
    <div className={`flex items-start gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 text-slate-500 ${compact ? 'px-2 py-1.5 text-[10.5px]' : 'px-3 py-3 text-xs'}`} data-testid="api-kosong">
      {pending ? <RefreshCw className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" /> : <CloudOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
      <div>
        <p className="font-semibold text-slate-600">{pending ? 'Sedang mengambil data dari API…' : pesan || 'Data belum tersedia dari API'}</p>
        {detail ? <p className="mt-0.5 text-[10.5px] text-slate-400">{detail}</p> : null}
      </div>
    </div>
  )
}
