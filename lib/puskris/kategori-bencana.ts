// Kategori bencana untuk filter lapisan peta. Kategori diambil dari field EOC sendiri
// (`k` = A/N/S → kelompok Alam / Non Alam / Sosial, lihat derive.ts); tabel di bawah hanya label tampilan.
export type KategoriId = 'Alam' | 'Non Alam' | 'Sosial' | 'Lainnya'
export const KATEGORI_BENCANA: { id: KategoriId; label: string; tag: string }[] = [
  { id: 'Alam', label: 'Bencana Alam', tag: 'ALAM' },
  { id: 'Non Alam', label: 'Bencana Non-Alam', tag: 'NON-ALAM' },
  { id: 'Sosial', label: 'Bencana Sosial', tag: 'SOSIAL' },
  { id: 'Lainnya', label: 'Tanpa kategori', tag: 'LAINNYA' },
]
export const katOf = (k: any): KategoriId => (['Alam', 'Non Alam', 'Sosial'].includes(k?.kelompok) ? k.kelompok : 'Lainnya')

export type JenisRow = { jenis: string; kategori: KategoriId; n: number }

/** Hitung per kategori & per jenis dari daftar kejadian EOC yang sudah tersaring Filter Dasbor. */
export function hitungKategori(kejadian: any[]) {
  const kat: Record<KategoriId, number> = { Alam: 0, 'Non Alam': 0, Sosial: 0, Lainnya: 0 }
  const by = new Map<string, { n: number; kat: Record<string, number> }>()
  for (const k of kejadian || []) {
    const c = katOf(k)
    kat[c]++
    const j = String(k.jenis || 'Tanpa jenis')
    const r = by.get(j) || { n: 0, kat: {} }
    r.n++
    r.kat[c] = (r.kat[c] || 0) + 1
    by.set(j, r)
  }
  const jenis: JenisRow[] = Array.from(by.entries()).map(([j, r]) => ({
    jenis: j, n: r.n, kategori: (Object.entries(r.kat).sort((a, b) => b[1] - a[1])[0][0]) as KategoriId,
  })).sort((a, b) => b.n - a.n || a.jenis.localeCompare(b.jenis, 'id'))
  return { kat, jenis }
}
