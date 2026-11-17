import REGIONS from '../../data/regions.json'

/**
 * Kerangka data dasbor TANPA angka: hanya daftar provinsi (referensi wilayah Kemendagri).
 * Semua angka diisi dari API resmi di mergeLive; bagian yang API-nya gagal / belum ada
 * tetap kosong dan ditandai "tidak_tersedia" (tidak ada snapshot, contoh, atau angka cadangan).
 */
export function loadPuskrisData(): any {
  return {
    mode: 'api',
    generated_at_wib: null,
    catatan: 'Agregat dari API resmi; tanpa data individu dan tanpa snapshot.',
    regions: (REGIONS as { code: string; name: string }[]).map((r) => ({ ...r, id: r.code })),
    psc: {}, ncc: {}, eoc: {}, tck: {}, logistik: {}, asistensi: {},
  }
}
