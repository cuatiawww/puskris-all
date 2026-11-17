/**
 * Cache persisten lintas instance (Next Data Cache via unstable_cache).
 * Di Vercel, memori server tidak bertahan antar-instance; potongan hasil API (per bulan EOC,
 * per provinsi TCK, per regional/barang Logistik) disimpan di sini supaya permintaan berikutnya
 * (di instance mana pun) tinggal melanjutkan, bukan mengulang dari nol.
 * - Hanya hasil yang SUDAH diringkas (agregat, tanpa data pribadi) yang disimpan.
 * - Fungsi yang gagal (throw) tidak disimpan, jadi dicoba lagi pada permintaan berikutnya.
 * - Simpan hasil kecil (< 2 MB per entri, batas Data Cache Vercel).
 */
import { unstable_cache } from 'next/cache'

export const REVALIDATE = { singkat: 900, menengah: 6 * 3600, panjang: 7 * 86400 } as const

export async function persist<T>(key: (string | number)[], fn: () => Promise<T>, revalidateSec: number, tags: string[] = []): Promise<T> {
  let cached: () => Promise<T>
  try {
    cached = unstable_cache(fn, ['puskris-v1', ...key.map(String)], { revalidate: revalidateSec, tags: ['puskris', ...tags] })
  } catch {
    return fn()
  }
  try {
    return await cached()
  } catch (e: any) {
    // Di luar konteks permintaan (tanpa incrementalCache) jalankan langsung.
    if (/incrementalCache|Invariant|static generation store|workStore/i.test(String(e?.message || e))) return fn()
    throw e
  }
}
