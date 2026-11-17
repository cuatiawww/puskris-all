'use client'

import { KATEGORI_BENCANA, type JenisRow, type KategoriId } from '@/lib/puskris/kategori-bencana'
import ApiKosong from '@/components/puskris/ApiKosong'
import InfoHint from '@/components/puskris/InfoHint'

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition ${on ? 'bg-teal-700' : 'bg-slate-300'}`}>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
    </button>
  )
}

/** Filter titik kejadian di peta per kategori & jenis bencana (data EOC, mengikuti Filter Dasbor). */
export default function KategoriBencanaFilter({
  live, error, kat, jenis, katOff, jenisOff, onKategori, onJenis, onReset,
}: {
  live: boolean
  error?: string | null
  kat: Record<KategoriId, number>
  jenis: JenisRow[]
  katOff: Set<KategoriId>
  jenisOff: Set<string>
  onKategori: (id: KategoriId, on: boolean) => void
  onJenis: (row: JenisRow, on: boolean) => void
  onReset: () => void
}) {
  const tagOf = (id: KategoriId) => KATEGORI_BENCANA.find((k) => k.id === id)?.tag || id
  const diubah = katOff.size > 0 || jenisOff.size > 0
  const kats = KATEGORI_BENCANA.filter((k) => k.id !== 'Lainnya' || kat.Lainnya > 0)
  return (
    <div className="space-y-3" data-testid="kategori-bencana-filter">
      <div>
        <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
          <span className="inline-flex items-center gap-1">Kategori Bencana
            <InfoHint text="Kategori dari data kejadian API EOC (Alam, Non-Alam, Sosial). Jumlah mengikuti Filter Dasbor (periode, provinsi, kab/kota, jenis). Mematikan kategori menyembunyikan titik kejadiannya di peta." label="Penjelasan kategori bencana" />
          </span>
          {diubah ? <button type="button" onClick={onReset} className="normal-case tracking-normal font-bold text-teal-700 hover:underline" data-testid="kategori-reset">Tampilkan semua</button> : null}
        </div>
        {!live ? (
          <ApiKosong compact pesan="Data belum tersedia dari API EOC" detail={error} />
        ) : (
          <div className="space-y-1.5">
            {kats.map((k) => {
              const on = !katOff.has(k.id)
              return (
                <div key={k.id} className={`flex items-center justify-between gap-2 rounded-xl border px-2.5 py-2 ${on ? 'border-slate-100 bg-slate-50' : 'border-slate-100 bg-white opacity-70'}`} data-testid={`kategori-${k.tag}`}>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-xs font-bold text-slate-800">{k.label}</span>
                    <span className="rounded-full border border-slate-200 bg-white px-1.5 text-[10px] font-black tabular-nums text-slate-700">{kat[k.id].toLocaleString('id-ID')}</span>
                  </span>
                  <Switch on={on} onChange={(v) => onKategori(k.id, v)} label={k.label} />
                </div>
              )
            })}
          </div>
        )}
      </div>
      {live ? (
        <div>
          <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Jenis Kejadian</div>
          {jenis.length ? (
            <ul className="max-h-56 divide-y divide-slate-50 overflow-y-auto rounded-xl border border-slate-100 bg-white" data-testid="jenis-kejadian-list">
              {jenis.map((r) => {
                const on = !katOff.has(r.kategori) && !jenisOff.has(r.jenis)
                return (
                  <li key={r.jenis}>
                    <label className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 hover:bg-slate-50">
                      <input type="checkbox" checked={on} onChange={(e) => onJenis(r, e.target.checked)} className="h-3.5 w-3.5 shrink-0 cursor-pointer rounded border-slate-300 text-teal-700 focus:ring-teal-500" aria-label={r.jenis} />
                      <span className={`min-w-0 flex-1 truncate text-[11px] font-semibold ${on ? 'text-slate-800' : 'text-slate-400'}`}>{r.jenis}</span>
                      <span className="shrink-0 rounded border border-emerald-300 px-1 text-[8.5px] font-black tracking-wider text-emerald-700">{tagOf(r.kategori)}</span>
                      <span className="w-7 shrink-0 text-right text-[11px] font-black tabular-nums text-slate-700">{r.n.toLocaleString('id-ID')}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-2 text-[10.5px] text-slate-500">Tidak ada kejadian pada filter ini.</p>
          )}
        </div>
      ) : null}
    </div>
  )
}
