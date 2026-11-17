/**
 * API NCC 119 (Google Apps Script Web App di atas spreadsheet "Puskris – Data NCC 119 (API)").
 * - URL dari env server PUSKRIS_NCC_URL (berakhiran /exec), kunci opsional PUSKRIS_NCC_KEY.
 *   Kunci tidak pernah dikirim ke klien / dicatat.
 * - Hanya GET baca (action=ringkasan). Isinya agregat pusat panggilan per hari dan per 30 menit,
 *   tingkat nasional; tidak ada data perorangan.
 */

import { getNccUrl, getNccKey } from './puskris-auth-config'

export function nccEnabled() {
  return Boolean(getNccUrl())
}

export type NccHari = {
  tanggal: string; cof: number; acd: number; abd: number; pct_acd: number | null; pct_abd: number | null; pct_sl: number | null
  aht_detik: number | null; asa_detik: number | null; avg_aban_detik: number | null; max_delay_detik: number | null
  avg_pos_staff: number | null; max_staffed: number | null; pct_occ_acw: number | null
}
export type NccJam = { interval_mulai: string; interval_selesai: string; hari: number; cof: number; acd: number; abd: number; rata_cof_per_hari: number | null; pct_acd: number | null; aht_detik: number | null; asa_detik: number | null }
export type NccRingkasan = {
  meta: { sumber: string; terakhir_sinkron: string | null; tanggal_awal: string | null; tanggal_akhir: string | null; hari: number }
  totals: { cof: number; acd: number; abd: number; hari: number; pct_acd: number | null; pct_abd: number | null; pct_sl: number | null; aht_detik: number | null; asa_detik: number | null }
  days: NccHari[]
  per_jam: NccJam[]
  busiest_interval: { tanggal: string; interval_mulai: string; interval_selesai: string; cof: number; acd: number; abd: number; pct_acd: number | null } | null
}

const num = (v: any) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v))

export async function fetchNcc(q: { tanggal1?: string | null; tanggal2?: string | null } = {}, timeoutMs = 30_000): Promise<NccRingkasan> {
  const base = getNccUrl()
  if (!base) throw new Error('URL API NCC belum diatur')
  const u = new URL(base)
  u.searchParams.set('action', 'ringkasan')
  if (q.tanggal1) u.searchParams.set('tanggal1', q.tanggal1)
  if (q.tanggal2) u.searchParams.set('tanggal2', q.tanggal2)
  const key = getNccKey()
  if (key) u.searchParams.set('key', key)
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const r = await fetch(u, { signal: ctl.signal, redirect: 'follow', cache: 'no-store', headers: { Accept: 'application/json' } })
    if (!r.ok) throw new Error(`API NCC HTTP ${r.status}`)
    const j = await r.json().catch(() => { throw new Error('API NCC tidak mengembalikan JSON (cek akses web app: "Siapa saja")') })
    if (!j?.ok) throw new Error(`API NCC: ${j?.error || 'gagal'}`)
    // hanya ambil kolom agregat yang dikenal (tanpa meneruskan isi lain dari web app)
    const days: NccHari[] = (j.days || []).filter((d: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(d.tanggal))).map((d: any) => ({
      tanggal: String(d.tanggal), cof: num(d.cof) || 0, acd: num(d.acd) || 0, abd: num(d.abd) || 0,
      pct_acd: num(d.pct_acd), pct_abd: num(d.pct_abd), pct_sl: num(d.pct_sl), aht_detik: num(d.aht_detik), asa_detik: num(d.asa_detik),
      avg_aban_detik: num(d.avg_aban_detik), max_delay_detik: num(d.max_delay_detik), avg_pos_staff: num(d.avg_pos_staff),
      max_staffed: num(d.max_staffed), pct_occ_acw: num(d.pct_occ_acw),
    })).sort((a: NccHari, b: NccHari) => a.tanggal.localeCompare(b.tanggal))
    const per_jam: NccJam[] = (j.per_jam || []).map((x: any) => ({
      interval_mulai: String(x.interval_mulai), interval_selesai: String(x.interval_selesai), hari: num(x.hari) || 0,
      cof: num(x.cof) || 0, acd: num(x.acd) || 0, abd: num(x.abd) || 0, rata_cof_per_hari: num(x.rata_cof_per_hari),
      pct_acd: num(x.pct_acd), aht_detik: num(x.aht_detik), asa_detik: num(x.asa_detik),
    }))
    const t0 = j.totals || {}
    const b = j.busiest_interval
    return {
      meta: { sumber: String(j.meta?.sumber || 'NCC 119'), terakhir_sinkron: j.meta?.terakhir_sinkron ? String(j.meta.terakhir_sinkron) : null, tanggal_awal: j.meta?.tanggal_awal || days[0]?.tanggal || null, tanggal_akhir: j.meta?.tanggal_akhir || days[days.length - 1]?.tanggal || null, hari: num(j.meta?.hari) || days.length },
      totals: { cof: num(t0.cof) || 0, acd: num(t0.acd) || 0, abd: num(t0.abd) || 0, hari: num(t0.hari) || days.length, pct_acd: num(t0.pct_acd), pct_abd: num(t0.pct_abd), pct_sl: num(t0.pct_sl), aht_detik: num(t0.aht_detik), asa_detik: num(t0.asa_detik) },
      days, per_jam,
      busiest_interval: b ? { tanggal: String(b.tanggal), interval_mulai: String(b.interval_mulai), interval_selesai: String(b.interval_selesai), cof: num(b.cof) || 0, acd: num(b.acd) || 0, abd: num(b.abd) || 0, pct_acd: num(b.pct_acd) } : null,
    }
  } finally {
    clearTimeout(t)
  }
}
