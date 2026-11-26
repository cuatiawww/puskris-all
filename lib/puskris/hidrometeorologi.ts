import { isHidrometJenis } from '@/lib/puskris/jenis-meta'

export { isHidrometJenis }

/** Salin payload API, tapi hanya kejadian hidrometeorologi (+ karhutla). PSC/TCK/logistik tetap utuh. */
export function scopeRawHidromet(raw: any, jenisNama?: string | null) {
  if (!raw) return raw
  const want = jenisNama && isHidrometJenis(jenisNama) ? jenisNama : null
  const events = (raw.eoc?.events || []).filter((e: any) => {
    const n = String(e?.n || e?.jenis || '')
    if (!isHidrometJenis(n)) return false
    if (want && n !== want) return false
    return true
  })
  const jenis_2026 = (raw.eoc?.jenis_2026 || []).filter((x: any) => {
    const n = String(x?.nama || '')
    if (!isHidrometJenis(n)) return false
    if (want && n !== want) return false
    return true
  })
  return { ...raw, eoc: { ...raw.eoc, events, jenis_2026 } }
}

export type MusimId = 'hujan' | 'kemarau' | 'pancaroba'

/** Pengelompokan kalender umum, bukan klasifikasi resmi BMKG. */
export function musimOfMonth(m: number): MusimId | null {
  if (!m || m < 1 || m > 12) return null
  if ([11, 12, 1, 2, 3].includes(m)) return 'hujan'
  if ([5, 6, 7, 8, 9].includes(m)) return 'kemarau'
  return 'pancaroba'
}

const EMPTY = { kejadian: 0, krisis: 0, meninggal: 0, luka: 0, hilang: 0, pengungsi: 0, terdampak: 0 }

export function rekapMusim(trend: {
  m: number
  kejadian?: number
  krisis?: number
  meninggal?: number
  luka?: number
  hilang?: number
  pengungsi?: number
  terdampak?: number
}[]) {
  const out = {
    hujan: { ...EMPTY, id: 'hujan' as const, label: 'Musim hujan', bulan: 'Nov–Mar' },
    kemarau: { ...EMPTY, id: 'kemarau' as const, label: 'Musim kemarau', bulan: 'Mei–Sep' },
    pancaroba: { ...EMPTY, id: 'pancaroba' as const, label: 'Pancaroba', bulan: 'Apr & Okt' },
  }
  for (const r of trend || []) {
    const id = musimOfMonth(r.m)
    if (!id) continue
    const row = out[id]
    row.kejadian += Number(r.kejadian || 0)
    row.krisis += Number(r.krisis || 0)
    row.meninggal += Number(r.meninggal || 0)
    row.luka += Number(r.luka || 0)
    row.hilang += Number(r.hilang || 0)
    row.pengungsi += Number(r.pengungsi || 0)
    row.terdampak += Number(r.terdampak || 0)
  }
  return out
}

export const MUSIM_CATATAN = 'Pengelompokan kalender umum di sebagian besar wilayah Indonesia, bukan data curah hujan atau peringatan dini BMKG.'
