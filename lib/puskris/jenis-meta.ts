/** Pengelompokan jenis kejadian mengikuti kategori umum BNPB / EOC. */
const RULES: { test: RegExp; category: string }[] = [
  { test: /banjir|longsor|puting beliung|kekeringan|gelombang|badai|cuaca|hujan/i, category: 'ALAM · HIDROMETEOROLOGI' },
  { test: /gempa|tsunami|gunung api|letusan/i, category: 'ALAM · GEOLOGI' },
  { test: /hutan dan lahan|karhutla/i, category: 'ALAM · KARHUTLA' },
  { test: /konflik|kerusuhan|sosial/i, category: 'SOSIAL' },
  { test: /klb|keracunan|penyakit|kecelakaan|gagal teknologi|industri|kebakaran/i, category: 'NON ALAM' },
]

export function jenisCategory(nama: string): string {
  for (const r of RULES) if (r.test.test(nama)) return r.category
  return 'LAINNYA'
}

/** Hidrometeorologi + karhutla (ditampilkan bersama karena keterkaitan musim kemarau). */
export function isHidrometJenis(nama: string | null | undefined): boolean {
  const c = jenisCategory(String(nama || ''))
  return c === 'ALAM · HIDROMETEOROLOGI' || c === 'ALAM · KARHUTLA'
}

export function deltaOf(values: number[]): { last4: number; prev4: number } | null {
  if (!values.length) return { last4: 0, prev4: 0 }
  const last4 = values.slice(-4).reduce((a, b) => a + b, 0)
  const prev4 = values.slice(-8, -4).reduce((a, b) => a + b, 0)
  return { last4, prev4 }
}

export function dmy(s?: string | null) {
  if (!s) return '—'
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  return s
}
