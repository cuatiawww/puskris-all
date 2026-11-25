// Lapisan peta tambahan di halaman detail kejadian: RS jejaring, riwayat 12 bulan,
// marker cuaca, dan kisi hujan Open-Meteo. Hanya titik yang punya koordinat dari API.
import type { ExtraPoint, ExtraPointLayer } from '@/lib/puskris/internal-layers'
import { kejadianPinSrc } from '@/lib/puskris/bencana-icons'
import { tglKejadian } from '@/lib/puskris/eoc-markers'
import { PUBLIC_BASE_PATH } from '@/lib/public-path'

export type SekitarToggles = { rs: boolean; riwayat: boolean; cuaca: boolean; hujan: boolean }

export const DEFAULT_SEKITAR: SekitarToggles = { rs: true, riwayat: true, cuaca: true, hujan: true }

function nf(n: number) {
  return Number(n || 0).toLocaleString('id-ID')
}

function hujanColor(mm: number) {
  if (mm <= 0) return '#94a3b8'
  if (mm < 1) return '#7dd3fc'
  if (mm < 5) return '#0ea5e9'
  if (mm < 15) return '#0369a1'
  return '#1e3a8a'
}

export function buildKejadianMapLayers(opts: {
  raw: any
  fokus: any
  riwayat?: any
  konteks?: any
  toggles: SekitarToggles
}): ExtraPointLayer[] {
  const layers: ExtraPointLayer[] = []
  const k = opts.fokus
  if (!k) return layers
  const t = opts.toggles

  const rsAll: [number, number][] = opts.raw?.psc?.titik_rs || []
  const rsLive = opts.raw?.psc?.data_source === 'langsung'
  if (t.rs && rsLive && rsAll.length) {
    const pts: ExtraPoint[] = rsAll
      .filter((r) => r[0] != null && r[1] != null)
      .map((r) => ({
        lat: r[0], lon: r[1], color: '#0369a1', radius: 5,
        title: 'Rumah sakit jejaring',
        subtitle: 'Koordinat dari API PSC 119',
        badgeText: 'RS JEJARING', badgeColor: '#0369a1',
        source: 'API PSC 119 (Kemenkes)',
        details: [
          { label: 'Nama faskes', value: 'Tidak dikirim endpoint titik RS' },
          { label: 'Lokasi', value: `${r[0].toFixed(5)}, ${r[1].toFixed(5)}` },
        ],
      }))
    layers.push({
      id: 'kejadian-rs', visible: true, cluster: true, color: '#0369a1', unit: 'RS', zIndex: 9, icon: 'psc',
      points: pts,
      legend: [{ color: '#0369a1', label: 'RS jejaring (koordinat API PSC; nama tidak dikirim)' }],
    })
  }

  const pinList: any[] = opts.riwayat?.pin || []
  if (t.riwayat && opts.riwayat?.tersedia && pinList.length) {
    const pts: ExtraPoint[] = pinList
      .filter((x) => x.lat != null && x.lon != null)
      .map((x) => ({
        lat: x.lat, lon: x.lon, color: x.serupa ? '#0f766e' : '#64748b', radius: 6,
        title: x.jenis || 'Kejadian',
        subtitle: [x.kabupaten, tglKejadian(x.tanggal, x.jam)].filter(Boolean).join(' · '),
        badgeText: x.serupa ? 'SEJENIS, 12 BLN' : 'RIWAYAT 12 BLN',
        badgeColor: x.serupa ? '#0f766e' : '#64748b',
        source: 'API EOC Pusat Krisis Kesehatan',
        iconSrc: kejadianPinSrc(x.jenis, { krisis: Boolean(x.krisis), approx: false }),
        href: `${PUBLIC_BASE_PATH}/kejadian/${encodeURIComponent(x.uid)}${x.tanggal ? `?tahun=${String(x.tanggal).slice(0, 4)}` : ''}`,
        details: [
          { label: 'Meninggal', value: nf(x.meninggal) },
          { label: 'Pengungsi', value: nf(x.pengungsi) },
          { label: 'Terdampak', value: nf(x.terdampak) },
          { label: 'Status', value: x.krisis ? 'Krisis kesehatan' : 'Terpantau' },
        ],
      }))
    if (pts.length) {
      layers.push({
        id: 'kejadian-riwayat', visible: true, cluster: true, color: '#0f766e', unit: 'kejadian', zIndex: 10, pin: true,
        points: pts,
        legend: [
          { color: '#0f766e', label: 'Kejadian sejenis di kab/kota, 12 bulan', iconSrc: pts.find((p) => /SEJENIS/.test(p.badgeText))?.iconSrc },
          { color: '#64748b', label: 'Kejadian lain di kab/kota, 12 bulan' },
        ],
      })
    }
  }

  const cuaca = opts.konteks?.cuaca
  const pos = k.koordinat || k
  if (t.cuaca && cuaca && !cuaca.kosong && pos?.lat != null && pos?.lon != null) {
    const s = cuaca.saat_ini || {}
    layers.push({
      id: 'kejadian-cuaca', visible: true, cluster: false, color: '#0284c7', unit: 'cuaca', zIndex: 12,
      points: [{
        lat: pos.lat, lon: pos.lon, color: '#0284c7', radius: 8,
        title: s.kondisi || 'Cuaca di lokasi',
        subtitle: [s.suhu != null ? `${Number(s.suhu).toLocaleString('id-ID', { maximumFractionDigits: 1 })} °C` : null, s.hujan_mm != null ? `hujan ${Number(s.hujan_mm).toLocaleString('id-ID', { maximumFractionDigits: 1 })} mm` : null].filter(Boolean).join(' · '),
        badgeText: 'CUACA SAAT INI', badgeColor: '#0284c7',
        source: cuaca.sumber || 'Open-Meteo',
        link: cuaca.url,
        details: [
          { label: 'Suhu', value: s.suhu != null ? `${Number(s.suhu).toLocaleString('id-ID', { maximumFractionDigits: 1 })} °C` : '—' },
          { label: 'Kelembapan', value: s.kelembapan != null ? `${s.kelembapan} %` : '—' },
          { label: 'Hujan', value: s.hujan_mm != null ? `${Number(s.hujan_mm).toLocaleString('id-ID', { maximumFractionDigits: 1 })} mm` : '—' },
          { label: 'Angin', value: s.angin != null ? `${Number(s.angin).toLocaleString('id-ID', { maximumFractionDigits: 1 })} km/j` : '—' },
          { label: 'Catatan', value: 'Model global Open-Meteo, bukan prakiraan resmi BMKG' },
        ],
      }],
      legend: [{ color: '#0284c7', label: 'Cuaca di titik kejadian (Open-Meteo, saat ini)' }],
    })
  }

  const grid: any[] = opts.konteks?.hujan_grid || []
  if (t.hujan && grid.length) {
    const pts: ExtraPoint[] = grid.filter((g) => g.lat != null && g.lon != null).map((g) => ({
      lat: g.lat, lon: g.lon, color: hujanColor(Number(g.hujan_mm || 0)), radius: 7 + Math.min(8, Math.sqrt(Number(g.hujan_mm || 0))),
      title: 'Hujan model',
      subtitle: `${Number(g.hujan_mm || 0).toLocaleString('id-ID', { maximumFractionDigits: 1 })} mm`,
      badgeText: 'HUJAN OPEN-METEO', badgeColor: '#0369a1',
      source: opts.konteks?.cuaca?.sumber || 'Open-Meteo',
      details: [
        { label: 'Curah hujan', value: `${Number(g.hujan_mm || 0).toLocaleString('id-ID', { maximumFractionDigits: 1 })} mm` },
        { label: 'Suhu', value: g.suhu != null ? `${Number(g.suhu).toLocaleString('id-ID', { maximumFractionDigits: 1 })} °C` : '—' },
        { label: 'Cakupan', value: opts.konteks?.hujan_grid_catatan || 'Kisi di sekitar lokasi, model saat ini' },
      ],
    }))
    if (pts.length) {
      layers.push({
        id: 'kejadian-hujan', visible: true, cluster: false, color: '#0ea5e9', unit: 'titik hujan', zIndex: 5,
        points: pts,
        legend: [
          { color: '#94a3b8', label: 'Hujan 0 mm' },
          { color: '#7dd3fc', label: 'Hujan < 1 mm' },
          { color: '#0ea5e9', label: 'Hujan 1–5 mm' },
          { color: '#0369a1', label: 'Hujan 5–15 mm' },
          { color: '#1e3a8a', label: 'Hujan ≥ 15 mm' },
        ],
      })
    }
  }

  return layers
}
