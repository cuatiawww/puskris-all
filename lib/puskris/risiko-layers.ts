// Registri lapisan "Risiko" di Pengaturan Peta. Data belum tersedia (sedang dicari pemilik dasbor).
// Untuk menyambungkan sumber: isi `load` dengan fungsi yang mengembalikan titik/agregat (mis. fetch ke /api/puskris/live/<id>)
// lalu ubah `status` menjadi 'siap'. Panel otomatis mengaktifkan toggle bila status 'siap'.
import type { ExtraPoint } from '@/lib/puskris/internal-layers'

export type RisikoLayerDef = {
  id: string
  nama: string
  deskripsi: string
  status: 'segera' | 'siap'
  warna: string
  load?: () => Promise<ExtraPoint[]>
}

export const RISIKO_LAYERS: RisikoLayerDef[] = [
  {
    id: 'risiko-krisis',
    nama: 'Risiko Krisis Kesehatan',
    deskripsi: 'Tingkat risiko terjadinya krisis kesehatan per wilayah (ancaman, kerentanan, dan kapasitas) berbasis Asistensi.',
    status: 'siap',
    warna: '#e11d48',
  },
  {
    id: 'risiko-infeksi',
    nama: 'Risiko Emerging (PIE)',
    deskripsi: 'Tingkat risiko penyakit infeksi emerging per kab/kota dari Peta Risiko PIE Kemenkes.',
    status: 'siap',
    warna: '#9333ea',
  },
]
