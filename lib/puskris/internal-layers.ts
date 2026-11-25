// Lapisan peta "API Internal" (PSC, ambulans, panggilan) dari data resmi yang sudah diringkas server
// (lib/server/puskris-live.ts → raw.psc.peta & raw.psc.panggilan_sampel). Hanya agregat/fasilitas; tanpa data perorangan.
import type { PuskrisUiFilter } from '@/lib/puskris/ui-filter'

export type ExtraPoint = {
  lat: number
  lon: number
  color: string
  radius: number
  /** garis tepi putus-putus = lokasi perkiraan (mis. ambulans diletakkan di lokasi PSC) */
  dashed?: boolean
  title: string
  subtitle?: string
  badgeText: string
  badgeColor: string
  source: string
  details: Array<{ label: string; value: string }>
  /** bobot klaster (mis. jumlah panggilan) */
  weight?: number
  label?: string
  /** Ikon per titik (data URI SVG), menimpa ikon lapisan. */
  iconSrc?: string
  /** Tautan internal (halaman detail). */
  href?: string
  hrefLabel?: string
  /** Tautan kedua (mis. detail wilayah). */
  hrefSecondary?: string
  hrefSecondaryLabel?: string
  /** Tautan sumber data eksternal. */
  link?: string
}

export type ExtraPointLayer = {
  id: string
  visible: boolean
  cluster: boolean
  /** warna dasar klaster */
  color: string
  /** satuan yang dijumlah pada klaster, mis. "PSC", "ambulans", "panggilan" */
  unit: string
  /** jumlahkan weight (true) atau hitung titik (false) di label klaster */
  sumWeight?: boolean
  zIndex: number
  /** ikon titik: ambulans, telepon (panggilan), atau gedung PSC */
  icon?: GlyphId
  /** pin tetesan per titik (kejadian EOC); pakai iconSrc di masing-masing titik */
  pin?: boolean
  points: ExtraPoint[]
  legend: Array<{ color: string; label: string; dashed?: boolean; iconSrc?: string }>
}

export type GlyphId = 'psc' | 'ambulans' | 'panggilan'

// Glyph garis (gaya lucide, viewBox 24) — putih di atas lingkaran berwarna.
const GLYPH: Record<GlyphId, string> = {
  // gedung layanan dengan tanda palang (PSC 119 / fasilitas kesehatan)
  psc: '<path d="M12 6v4"/><path d="M10 8h4"/><path d="M14 14h-4"/><path d="M14 18h-4"/><path d="M18 12h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h2"/><path d="M18 22V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v18"/>',
  ambulans: '<path d="M10 10H6"/><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.28a1 1 0 0 0-.684-.948l-1.923-.641a1 1 0 0 1-.578-.502l-1.539-3.076A1 1 0 0 0 16.382 8H14"/><path d="M8 8v4"/><path d="M9 18h6"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  panggilan: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
}

/** SVG ikon titik (lingkaran berwarna + glyph putih). Garis tepi putus-putus = lokasi perkiraan. */
export function glyphSvg(id: GlyphId, color: string, dashed: boolean, size: number): string {
  const ring = dashed ? 'stroke="#334155" stroke-width="1.6" stroke-dasharray="3 2"' : 'stroke="#ffffff" stroke-width="2"'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14.5" fill="${color}" fill-opacity="${dashed ? 0.8 : 1}" ${ring}/><g transform="translate(7 7) scale(0.75)" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${GLYPH[id]}</g></svg>`
}

export type InternalLayerToggles = {
  psc: boolean
  pscAktifOnly: boolean
  ambulans: boolean
  ambSiapOnly: boolean
  panggilan: boolean
}
export const DEFAULT_INTERNAL: InternalLayerToggles = { psc: false, pscAktifOnly: false, ambulans: false, ambSiapOnly: false, panggilan: false }

const nf = (n: number) => Number(n || 0).toLocaleString('id-ID')
const inScope = (p: string, kk: string | undefined, f: PuskrisUiFilter) =>
  (!f.provinsi || p === String(f.provinsi).padStart(2, '0')) && (!f.kabupaten || !kk || kk === String(f.kabupaten).padStart(4, '0'))

export type InternalLayerInfo = {
  live: boolean
  at?: string
  psc: { total: number; dgnKoordinat: number; koordinatAsli: number; pusatKab: number; bawaan: number; aktif: number; tampil: number }
  ambulans: { total: number; koordinatSendiri: number; diLokasiPsc: number; diPusatKab: number; tanpaLokasi: number; siap: number; tampil: number }
  panggilan: { sampel: number; dari?: string; sampai?: string; kab: number; kabKoordinatPanggilan: number; kabPusat: number; kabTanpaLokasi: number; tampil: number; tahun?: number; totalTahun?: number }
}

export function buildInternalLayers(raw: any, f: PuskrisUiFilter, t: InternalLayerToggles): { layers: ExtraPointLayer[]; info: InternalLayerInfo | null } {
  const peta = raw?.psc?.peta
  const samp = raw?.psc?.panggilan_sampel
  if (!peta && !samp) return { layers: [], info: null }
  const pscAll: any[] = peta?.psc || []
  const ambAll: any[] = peta?.ambulans || []
  const kondisi: string[] = peta?.kondisi || ['Baik', 'Rusak Ringan', 'Rusak Berat', 'Belum diisi']
  const jenis: string[] = peta?.jenis || ['Gawat Darurat', 'Transportasi', 'Lainnya']
  const src = 'API PSC 119 (Kemenkes)'

  // ── PSC ──
  const pscPts: ExtraPoint[] = pscAll
    .filter((p) => p.lat != null && p.lon != null && inScope(p.p, p.kk, f) && (!t.pscAktifOnly || p.a === 1))
    .map((p) => ({
      lat: p.lat, lon: p.lon, color: p.a ? '#0d9488' : '#94a3b8', radius: 7, dashed: p.lok === 'kabkota',
      title: p.n, subtitle: [p.kab, p.prov].filter(Boolean).join(' · '),
      badgeText: p.a ? 'PSC AKTIF' : 'PSC TIDAK AKTIF', badgeColor: p.a ? '#0d9488' : '#64748b', source: src,
      details: [
        { label: 'Status', value: p.a ? 'Aktif' : 'Tidak aktif' },
        { label: 'Ambulans', value: `${nf(p.amb)} unit (${nf(p.siap)} siap: aktif & kondisi baik)` },
        { label: 'Personel', value: `${nf(p.prs)} orang` },
        { label: 'RS jejaring', value: `${nf(p.rs)} rumah sakit` },
        { label: 'Lokasi titik', value: p.lok === 'kabkota' ? 'Perkiraan: pusat kab/kota (koordinat PSC di API kosong atau nilai bawaan)' : 'Koordinat PSC dari API' },
      ],
    }))

  // ── Ambulans ──
  const ambPts: ExtraPoint[] = ambAll
    .filter((a) => {
      const ps = pscAll[a[7]]
      return ps && inScope(ps.p, ps.kk, f) && (!t.ambSiapOnly || a[2] === 1)
    })
    .map((a) => {
      const ps = pscAll[a[7]]
      const siap = a[2] === 1
      const color = siap ? '#16a34a' : a[3] === 1 ? '#f59e0b' : '#dc2626'
      return {
        lat: a[0], lon: a[1], color, radius: 6, dashed: a[6] !== 0,
        title: `Ambulans ${jenis[a[5]] || ''}`.trim(), subtitle: [ps.n, ps.kab].filter(Boolean).join(' · '),
        badgeText: siap ? 'SIAP' : a[3] === 1 ? 'AKTIF, KONDISI KURANG' : 'TIDAK AKTIF / BELUM DIISI', badgeColor: color, source: src,
        details: [
          { label: 'Status', value: a[3] === 1 ? 'Aktif' : a[3] === 0 ? 'Tidak aktif' : 'Belum diisi' },
          { label: 'Kondisi', value: kondisi[a[4]] || '–' },
          { label: 'PSC', value: ps.n },
          { label: 'Lokasi titik', value: a[6] === 0 ? 'Koordinat ambulans dari API (posisi tercatat)' : a[6] === 1 ? 'Perkiraan: koordinat PSC induk (ambulans tanpa koordinat)' : 'Perkiraan: pusat kab/kota PSC induk (ambulans & PSC tanpa koordinat valid)' },
        ],
      }
    })

  // ── Panggilan (agregat kab/kota) ──
  const kab: any[] = samp?.kabkota || []
  const callPts: ExtraPoint[] = kab
    .filter((k) => k.lat != null && k.lon != null && inScope(k.p, k.code, f))
    .map((k) => ({
      lat: k.lat, lon: k.lon, color: '#7c3aed', radius: Math.min(16, 6 + Math.sqrt(k.n) * 0.8), dashed: k.lokasi !== 'panggilan', weight: k.n,
      label: k.n >= 20 ? nf(k.n) : undefined,
      title: k.nama || `Kab/Kota ${k.code}`, subtitle: `${nf(k.n)} panggilan dalam sampel ${samp?.dari || ''}–${samp?.sampai || ''}`,
      badgeText: 'PANGGILAN 119 (AGREGAT)', badgeColor: '#7c3aed', source: src,
      details: [
        { label: 'Gawat darurat', value: nf(k.gd) },
        { label: 'Bukan gawat darurat', value: nf(k.bgd) },
        { label: 'Tanpa kategori', value: nf(k.tk) },
        { label: 'Selesai ditangani', value: `${nf(k.selesai)} (${k.n ? Math.round((k.selesai / k.n) * 1000) / 10 : 0}%)` },
        { label: 'Butuh ambulans', value: nf(k.ambulans) },
        { label: 'Letak lingkaran', value: k.lokasi === 'panggilan' ? 'Rata-rata koordinat panggilan di kab/kota ini (≥ 5 panggilan berkoordinat)' : 'Pusat kab/kota (panggilan berkoordinat kurang dari 5 atau tidak wajar)' },
      ],
    }))

  const info: InternalLayerInfo = {
    live: raw?.psc?.data_source === 'langsung',
    at: raw?.psc?.fetched_at_wib,
    psc: { total: pscAll.length, dgnKoordinat: pscAll.filter((p) => p.lat != null).length, koordinatAsli: pscAll.filter((p) => p.lok === 'psc').length, pusatKab: pscAll.filter((p) => p.lok === 'kabkota').length, bawaan: peta?.psc_koordinat_bawaan || 0, aktif: pscAll.filter((p) => p.lat != null && p.a === 1).length, tampil: pscPts.length },
    ambulans: {
      total: ambAll.length + (peta?.ambulans_tanpa_lokasi || 0), koordinatSendiri: ambAll.filter((a) => a[6] === 0).length, diLokasiPsc: ambAll.filter((a) => a[6] === 1).length, diPusatKab: ambAll.filter((a) => a[6] === 2).length,
      tanpaLokasi: peta?.ambulans_tanpa_lokasi || 0, siap: ambAll.filter((a) => a[2] === 1).length, tampil: ambPts.length,
    },
    panggilan: {
      sampel: samp?.jumlah || 0, dari: samp?.dari, sampai: samp?.sampai, kab: kab.length,
      kabKoordinatPanggilan: kab.filter((k) => k.lokasi === 'panggilan').length, kabPusat: kab.filter((k) => k.lokasi === 'kabkota').length,
      kabTanpaLokasi: kab.filter((k) => k.lat == null).length, tampil: callPts.length,
      tahun: raw?.psc?.summary?.tahun_panggilan, totalTahun: raw?.psc?.summary?.total_panggilan,
    },
  }

  const layers: ExtraPointLayer[] = [
    { id: 'panggilan', visible: t.panggilan, cluster: false, color: '#7c3aed', unit: 'panggilan', sumWeight: true, zIndex: 6, icon: 'panggilan', points: callPts,
      legend: [{ color: '#7c3aed', label: 'Panggilan 119 per kab/kota (ukuran ∝ jumlah)' }, { color: '#7c3aed', label: 'Garis putus: di pusat kab/kota (perkiraan)', dashed: true }] },
    { id: 'psc', visible: t.psc, cluster: true, color: '#0d9488', unit: 'PSC', zIndex: 7, icon: 'psc', points: pscPts,
      legend: [{ color: '#0d9488', label: 'PSC aktif' }, { color: '#94a3b8', label: 'PSC tidak aktif' }, { color: '#0d9488', label: 'Garis putus: pusat kab/kota (koordinat PSC tidak valid)', dashed: true }] },
    { id: 'ambulans', visible: t.ambulans, cluster: true, color: '#16a34a', unit: 'ambulans', zIndex: 8, icon: 'ambulans', points: ambPts,
      legend: [{ color: '#16a34a', label: 'Ambulans siap (aktif & baik)' }, { color: '#f59e0b', label: 'Aktif, kondisi rusak/belum diisi' }, { color: '#dc2626', label: 'Tidak aktif / status belum diisi' }, { color: '#64748b', label: 'Garis putus: lokasi perkiraan (PSC induk / pusat kab/kota)', dashed: true }] },
  ]
  return { layers, info }
}
