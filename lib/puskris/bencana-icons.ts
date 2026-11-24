import { PUBLIC_BASE_PATH } from '@/lib/public-path'
import { eocIconOf, eocPinDataUri } from '@/lib/puskris/eoc-markers'

/** Pemetaan resmi SIPKK (master_dt_bencana.icon). Urutan lebih khusus dulu. */
export const BENCANA_ICON_FILES: { test: RegExp; file: string; label: string }[] = [
  { test: /banjir\s*bandang/i, file: 'banjirbandang.png', label: 'Banjir Bandang' },
  { test: /banjir\s*dan\s*tanah\s*longsor/i, file: 'banjirdantanahlongsor.png', label: 'Banjir dan Tanah Longsor' },
  { test: /banjir/i, file: 'banjir.png', label: 'Banjir' },
  { test: /gempa.*tsunami|tsunami.*gempa/i, file: 'gempabumitsunami.png', label: 'Gempa Bumi dan Tsunami' },
  { test: /tsunami/i, file: '6119tsunami.png', label: 'Tsunami' },
  { test: /gelombang|pasang|badai/i, file: 'gelombangpasangbadai.png', label: 'Gelombang Pasang/Badai' },
  { test: /hutan dan lahan|karhutla/i, file: 'karhutla.png', label: 'Kebakaran Hutan dan Lahan' },
  { test: /kebakaran/i, file: 'kebakaran.png', label: 'Kebakaran' },
  { test: /longsor/i, file: 'tanahlongsor.png', label: 'Tanah Longsor' },
  { test: /gunung\s*api|letusan/i, file: 'letusangnapi.png', label: 'Letusan Gunung Api' },
  { test: /gempa/i, file: 'gempabumi.png', label: 'Gempa Bumi' },
  { test: /kekeringan/i, file: 'kekeringan.png', label: 'Kekeringan' },
  { test: /angin|puting\s*beliung|cuaca\s*ekstrem/i, file: 'anginputingbeliung.png', label: 'Angin Puting Beliung' },
  { test: /konflik|kerusuhan/i, file: 'konfliksosial.png', label: 'Konflik Sosial' },
  { test: /teror|sabotase/i, file: '6737sabotase.png', label: 'Aksi Teror dan Sabotase' },
  { test: /industri/i, file: 'kecelakaanindustrial.png', label: 'Kecelakaan Industri' },
  { test: /laut|udara/i, file: '6353ktl.png', label: 'Kecelakaan Transportasi Laut-Udara' },
  { test: /kecelakaan|transportasi/i, file: 'kecelakaantrans.png', label: 'Kecelakaan Transportasi' },
  { test: /keracunan/i, file: 'klbkeracunan.png', label: 'KLB Keracunan' },
  { test: /wabah|epidemi|pandemi/i, file: 'wabahpenyakit.png', label: 'Wabah Penyakit' },
  { test: /klb|penyakit/i, file: 'klbpenyakit.png', label: 'KLB Penyakit' },
  { test: /gagal\s*teknologi/i, file: 'gagalteknologi.png', label: 'Gagal Teknologi' },
]

export const BENCANA_ICON_SIZE = { w: 32, h: 38 }

export function bencanaIconOf(jenis?: string | null): { file: string; src: string; label: string } | null {
  const s = String(jenis || '').trim()
  if (!s) return null
  for (const r of BENCANA_ICON_FILES) {
    if (r.test.test(s)) return { file: r.file, src: `${PUBLIC_BASE_PATH}/icons/bencana/${encodeURI(r.file)}`, label: r.label }
  }
  return null
}

/** Pin peta: ikon resmi SIPKK bila jenisnya dikenal, kalau tidak pin SVG Puskris. */
export function kejadianPinSrc(jenis?: string | null, opts?: { krisis?: boolean; approx?: boolean }): string {
  const official = bencanaIconOf(jenis)
  if (official) return official.src
  return eocPinDataUri(eocIconOf(jenis), opts)
}