/** Label antarmuka berbahasa Indonesia, tanpa singkatan yang tidak dijelaskan. */
export const NCC_LABEL = {
  cof: 'Panggilan Masuk',
  acd: 'Panggilan Terjawab',
  abd: 'Panggilan Tak Terjawab (ditutup penelepon)',
  scr: 'Tingkat Keberhasilan Layanan (%)',
  scrHint: 'Dihitung dari jumlah panggilan terjawab dibagi panggilan masuk, lalu dikali 100%.',
} as const

export const EMT_LABEL = 'Tim Medis Darurat (EMT)'
export const GADAR_LABEL = 'Gawat Darurat'
export const IRBI_LABEL = 'Indeks Risiko Bencana Indonesia'
export const IRBI_HINT = 'Indeks Risiko Bencana Indonesia (IRBI) disusun BNPB. Semakin tinggi nilainya, semakin besar risiko bencana di wilayah itu. Angka per provinsi di halaman ini sebagian memakai data contoh.'

export function nccLabel(key: 'cof' | 'acd' | 'abd' | 'scr') {
  return NCC_LABEL[key]
}

/** Ganti etiket "GADAR" bila muncul di data sumber menjadi "Gawat Darurat". */
export function displayJenisArmada(nama: string) {
  return String(nama || '').replace(/\bGADAR\b/gi, GADAR_LABEL)
}

/** Istilah korban di dasbor Pantauan Bencana (pusatkrisis.kemkes.go.id/dashboard-new). */
export const KORBAN_LABEL = {
  lb: 'Luka Berat / Rawat Inap',
  lbShort: 'Luka berat (LB/RI)',
  lbHint: 'LB/RI = Luka Berat / Rawat Inap: korban luka berat yang perlu dirawat inap di fasilitas kesehatan. Di sumber tercatat sebagai kolom "lukaBerat".',
  lr: 'Luka Ringan / Rawat Jalan',
  lrShort: 'Luka ringan (LR/RJ)',
  lrHint: 'LR/RJ = Luka Ringan / Rawat Jalan: korban luka ringan yang cukup dirawat jalan. Di sumber tercatat sebagai kolom "lukaRingan".',
  pengungsiHint: 'Korban yang mengungsi dari tempat tinggalnya akibat kejadian.',
  terdampakHint: 'Penduduk di wilayah kejadian yang terkena dampak, termasuk yang tidak menjadi korban langsung.',
  totalHint: 'Jumlah korban total versi sumber = meninggal + hilang + luka berat/rawat inap + luka ringan/rawat jalan + pengungsi.',
  hilangHint: 'Korban yang belum ditemukan.',
} as const
