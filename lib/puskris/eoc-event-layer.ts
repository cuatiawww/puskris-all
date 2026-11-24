import { PUBLIC_BASE_PATH } from '@/lib/public-path'
import type { ExtraPoint, ExtraPointLayer } from '@/lib/puskris/internal-layers'
import {
  eocIconOf, fmtAngka, LOK_LABEL, resolveEventCoord, tglKejadian,
  type KabRow,
} from '@/lib/puskris/eoc-markers'
import { kejadianPinSrc } from '@/lib/puskris/bencana-icons'
import type { Centroids } from '@/lib/puskris/to-spasial'
import kabIndex from '@/lib/puskris/kabkota-index.json'

const kabList = kabIndex as KabRow[]

export function kejadianHref(uid: string, tanggal?: string | null) {
  const tahun = String(tanggal || '').slice(0, 4)
  const q = /^\d{4}$/.test(tahun) ? `?tahun=${tahun}` : ''
  return `${PUBLIC_BASE_PATH}/dashboard/kejadian/${encodeURIComponent(uid)}${q}`
}

/** Lapisan ikon kejadian EOC: koordinat asli bila ada, kalau tidak pusat kab/kota atau provinsi. */
export function buildEocEventLayer(
  list: any[] | null | undefined,
  centroids: Centroids,
  visible: boolean,
): ExtraPointLayer {
  const points: ExtraPoint[] = []
  const legendMap = new Map<string, { color: string; label: string; iconSrc?: string; dashed?: boolean }>()
  for (const k of list || []) {
    if (!k?.uid) continue
    const pos = resolveEventCoord(k, centroids, kabList)
    if (!pos) continue
    const icon = eocIconOf(k.jenis)
    const approx = pos.lok !== 'kejadian'
    points.push({
      lat: pos.lat,
      lon: pos.lon,
      color: icon.color,
      radius: 8,
      dashed: approx,
      title: k.jenis || 'Kejadian',
      subtitle: [k.kabupaten, k.provinsi].filter(Boolean).join(' · '),
      badgeText: k.krisis ? 'KRISIS KESEHATAN' : 'TERPANTAU',
      badgeColor: k.krisis ? '#be123c' : '#0f766e',
      source: 'API EOC Pusat Krisis Kesehatan',
      iconSrc: kejadianPinSrc(k.jenis, { krisis: Boolean(k.krisis), approx }),
      href: kejadianHref(String(k.uid), k.tanggal),
      link: k.url || undefined,
      details: [
        { label: 'Tanggal', value: tglKejadian(k.tanggal, k.jam) },
        { label: 'Lokasi', value: [k.kabupaten, k.provinsi].filter(Boolean).join(', ') || '—' },
        { label: 'Kelompok', value: k.kelompok || '—' },
        { label: 'Meninggal', value: fmtAngka(k.meninggal) },
        { label: 'Hilang', value: fmtAngka(k.hilang) },
        { label: 'Luka berat', value: fmtAngka(k.luka_berat) },
        { label: 'Luka ringan', value: fmtAngka(k.luka_ringan) },
        { label: 'Pengungsi', value: fmtAngka(k.pengungsi) },
        { label: 'Terdampak', value: fmtAngka(k.terdampak) },
        { label: 'Faskes rusak', value: fmtAngka(k.faskes_rusak) },
        { label: 'Letak titik', value: LOK_LABEL[pos.lok] },
      ],
    })
    if (!legendMap.has(icon.id)) {
      legendMap.set(icon.id, { color: icon.color, label: icon.label, iconSrc: kejadianPinSrc(k.jenis) })
    }
  }
  return {
    id: 'eoc-kejadian',
    visible,
    cluster: true,
    pin: true,
    color: '#00705a',
    unit: 'kejadian',
    zIndex: 24,
    points,
    legend: [...legendMap.values()],
  }
}