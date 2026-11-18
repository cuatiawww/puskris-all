// Lapisan "Risiko Krisis Kesehatan" berbasis API Asistensi (rekapitulasi provinsi & kab/kota).
// Warna Status Kapasitas diambil apa adanya dari API (status_kapasitas.color).
// API tidak mengirim warna IRBI, jadi dipakai skala baku (pemetaan, bukan data):
// TINGGI = merah, SEDANG = jingga, RENDAH = hijau (konvensi kelas risiko BNPB/IRBI).
import type { CatChoro } from '@/components/spasial/SpasialMap'

export type RisikoAsisMode = 'kapasitas' | 'irbi'
export type RisikoAsisLevel = 'provinsi' | 'kabkota'

export const IRBI_SKALA: Record<string, string> = { Tinggi: '#dc2626', Sedang: '#f59e0b', Rendah: '#16a34a' }
const IRBI_LAIN = '#cbd5e1'
const URUT_KAP = ['Tinggi', 'Sedang', 'Rendah', 'Belum Mengisi']
const URUT_IRBI = ['Tinggi', 'Sedang', 'Rendah']

export const asistensiTersedia = (raw: any) => raw?.asistensi?.data_source === 'langsung' && Boolean(raw?.asistensi?.wilayah?.length)

const pct = (v: any) => (typeof v === 'number' && Number.isFinite(v) ? `${Math.round(v * 10) / 10}` : '–')
const lbl = (s: any) => (s ? String(s) : 'Tidak ada status')

export function rowsAsistensi(raw: any, level: RisikoAsisLevel, prov: string | null): any[] {
  if (!asistensiTersedia(raw)) return []
  if (level === 'provinsi') return (raw.asistensi.wilayah || []).filter((x: any) => x.level === 'provinsi')
  return (raw.asistensi.wilayah_kabkota || []).filter((x: any) => !prov || String(x.kd_prop).padStart(2, '0') === prov)
}

export function buildRisikoAsistensi(raw: any, mode: RisikoAsisMode, level: RisikoAsisLevel, prov: string | null): CatChoro | null {
  const rows = rowsAsistensi(raw, level, prov)
  if (!rows.length) return null
  const items: CatChoro['items'] = {}
  const hit: Record<string, { color: string; n: number }> = {}
  for (const r of rows) {
    const code = String(r.kode_wilayah).padStart(level === 'provinsi' ? 2 : 4, '0')
    const kap = lbl(r.status_kapasitas)
    const irbi = lbl(r.status_risiko_irbi)
    const color = mode === 'kapasitas' ? (r.warna || '#e5e7eb') : (IRBI_SKALA[irbi] || IRBI_LAIN)
    const key = mode === 'kapasitas' ? kap : irbi
    hit[key] ||= { color, n: 0 }
    hit[key].n++
    items[code] = {
      color,
      title: mode === 'kapasitas' ? `Status Kapasitas ${kap.toUpperCase()} (${pct(r.poin_kapasitas_pct)} poin) · IRBI ${irbi.toUpperCase()}` : `IRBI ${irbi.toUpperCase()} · Kapasitas ${kap.toUpperCase()} (${pct(r.poin_kapasitas_pct)} poin)`,
      details: [
        { label: 'Status Kapasitas', value: kap.toUpperCase() },
        { label: 'Poin Kapasitas', value: pct(r.poin_kapasitas_pct) },
        { label: 'Status IRBI', value: irbi.toUpperCase() },
      ],
    }
  }
  const order = mode === 'kapasitas' ? URUT_KAP : URUT_IRBI
  const legend = Object.entries(hit)
    .sort((a, b) => ((order.indexOf(a[0]) + 1 || 99) - (order.indexOf(b[0]) + 1 || 99)))
    .map(([label, v]) => ({ label: label.toUpperCase(), color: v.color, n: v.n }))
  return {
    id: `asistensi-${mode}`,
    level,
    prov,
    judul: mode === 'kapasitas' ? 'Status Kapasitas (Asistensi)' : 'Status IRBI',
    sumber: `API Asistensi Risiko${raw.asistensi?.tahun ? ` ${raw.asistensi.tahun}` : ''}`,
    items,
    legend,
    catatan: mode === 'irbi' ? 'Warna IRBI memakai skala baku (merah/jingga/hijau) karena API tidak mengirim warna.' : 'Warna sesuai API.',
  }
}
