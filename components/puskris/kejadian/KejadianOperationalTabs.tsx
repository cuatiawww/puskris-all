'use client'

import { useMemo, useState } from 'react'
import { Building2, ClipboardList, History, Hospital, Shield, Tent, Users } from 'lucide-react'
import { analisaDariData } from '@/lib/puskris/kejadian-detail'
import {
  SecAnalisa,
  SecDampak,
  SecFaskes,
  SecLogistik,
  SecRisiko,
  SecRiwayat,
  SecTck,
} from '@/components/puskris/KejadianDetailSections'
import type { PendukungPayload } from './types'
import { nf } from '@/lib/puskris/derive'

type TabKey = 'analisa' | 'faskes' | 'kapasitas' | 'dampak'

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'analisa', label: 'Analisa, Asistensi IRBI & PIE', icon: Shield },
  { key: 'faskes', label: 'Faskes, PSC 119 & Rute OSRM', icon: Hospital },
  { key: 'kapasitas', label: 'TCK & Logistik Regional', icon: Users },
  { key: 'dampak', label: 'Dampak, Pos Pengungsi & Riwayat 12 Bln', icon: History },
]

export default function KejadianOperationalTabs({
  k,
  nearby,
  raw,
  riwayat,
  konteks,
  risiko,
  pieKab,
  piePending,
  status,
  pendukung,
  onShowAsis,
  onShowPie,
}: {
  k: any
  nearby?: any
  raw?: any
  riwayat?: any
  konteks?: any
  risiko?: any
  pieKab?: { disease: string; status: string }[] | null
  piePending?: boolean
  status?: any
  pendukung: PendukungPayload | null
  onShowAsis?: (mode: 'irbi' | 'kapasitas') => void
  onShowPie?: () => void
}) {
  const [tab, setTab] = useState<TabKey>('analisa')

  const temuan = useMemo(
    () => analisaDariData(k, nearby, risiko, status || null, konteks, pieKab),
    [k, nearby, risiko, status, konteks, pieKab],
  )

  const posPengungsi = pendukung?.eocDetail?.posPengungsi || []
  const faskesTerdampak = pendukung?.eocDetail?.faskesTerdampak || []

  return (
    <section className="space-y-4" data-testid="kejadian-operational-tabs">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xs">
        <div className="flex flex-wrap gap-1">
          {TABS.map((t) => {
            const Icon = t.icon
            const active = tab === t.key
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                  active ? 'bg-[#00705a] text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{t.label}</span>
              </button>
            )
          })}
        </div>
        <span className="px-2 text-[11px] text-slate-400">Data terintegrasi Kemkes EOC · PSC 119 · TCK · SIMLOGKES · Asistensi · PIE</span>
      </div>

      {tab === 'analisa' ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <SecAnalisa items={temuan} />
          <SecRisiko
            risiko={risiko}
            pieKab={pieKab}
            piePending={piePending}
            onShowAsis={onShowAsis}
            onShowPie={onShowPie}
          />
        </div>
      ) : null}

      {tab === 'faskes' ? (
        <SecFaskes nearby={nearby} />
      ) : null}

      {tab === 'kapasitas' ? (
        <div className="space-y-5">
          <SecTck tck={nearby?.tck} kabNama={k?.kabupaten} />
          <SecLogistik log={nearby?.logistik} />
        </div>
      ) : null}

      {tab === 'dampak' ? (
        <div className="space-y-5">
          {/* Posko Pengungsi & Faskes Terdampak dari API EOC bencana_detail */}
          {(posPengungsi.length > 0 || faskesTerdampak.length > 0) ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {posPengungsi.length > 0 ? (
                <div className="skdr-card p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Tent className="h-4 w-4 text-sky-700" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                      Posko Pengungsian Tercatat ({posPengungsi.length})
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500">
                        <tr>
                          <th className="px-2.5 py-1.5">Nama Pos</th>
                          <th className="px-2.5 py-1.5">Lokasi</th>
                          <th className="px-2.5 py-1.5 text-right">Pengungsi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {posPengungsi.map((p, i) => (
                          <tr key={i}>
                            <td className="px-2.5 py-1.5 font-semibold text-slate-800">{p.nama}</td>
                            <td className="px-2.5 py-1.5 text-slate-600">{p.lokasi || '—'}</td>
                            <td className="px-2.5 py-1.5 text-right font-mono">{p.pengungsi != null ? nf(p.pengungsi) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {faskesTerdampak.length > 0 ? (
                <div className="skdr-card p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-rose-700" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                      Faskes Terdampak Tercatat ({faskesTerdampak.length})
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500">
                        <tr>
                          <th className="px-2.5 py-1.5">Faskes</th>
                          <th className="px-2.5 py-1.5">Jenis</th>
                          <th className="px-2.5 py-1.5">Kondisi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {faskesTerdampak.map((f, i) => (
                          <tr key={i}>
                            <td className="px-2.5 py-1.5 font-semibold text-slate-800">{f.nama}</td>
                            <td className="px-2.5 py-1.5 text-slate-600">{f.jenis || '—'}</td>
                            <td className="px-2.5 py-1.5 font-semibold text-rose-700">{f.kondisi || 'Terdampak'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-3 text-xs text-slate-500">
              <ClipboardList className="h-4 w-4 shrink-0 text-slate-400" />
              <span>Rincian pos pengungsian dan daftar nama faskes rusak tidak memiliki entri terpisah pada API detail_bencana untuk kejadian ini.</span>
            </div>
          )}

          <SecDampak k={k} riwayat={riwayat} />
          <SecRiwayat riwayat={riwayat} />
        </div>
      ) : null}
    </section>
  )
}
