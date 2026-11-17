# Dasbor Ringkasan Pusat Krisis Kesehatan

Halaman `/dashboard/ringkasan` memakai layout Ringkasan SKDR: judul dan tombol Sembunyikan Filter, pil tab, panel filter kiri, empat kartu KPI, slider jenis kejadian, lalu satu peta SpasialMap (komponen yang sama dengan dasbor SKDR).

## Sumber data

Semua angka berasal **langsung dari API resmi** dan diringkas di server (`GET /api/puskris/ringkasan`, cache 5–15 menit; tren 5 tahun EOC 6 jam). Tidak ada snapshot, data contoh, atau angka cadangan: sumber yang gagal/ belum diatur tampil sebagai "Data belum tersedia dari API" (NCC: "belum terhubung"). Angka perkiraan yang dihitung dari sampel API asli ditandai "≈".

## Filter

Panel samping memuat Sumber/Pilar, Periode (tahun 2026, Oktober 2026, 30 hari, 7 hari), Provinsi, Kabupaten/Kota, dan Jenis Kejadian. Tombol Terapkan membarui KPI, peta, slider, grafik, dan tabel.

- Panggilan PSC bersifat kumulatif dan tidak mengikuti filter periode.
- Data NCC hanya ada untuk November 2026; filter 7/30 hari memotong rentang itu.
- KPI EOC resmi memakai angka tahun atau Oktober. Filter 7/30 hari hanya memengaruhi tabel kejadian, titik peta, dan tren NCC.
- Jika provinsi, kabupaten, atau jenis kejadian dipilih, kartu Kejadian Krisis memakai agregat kejadian terbaru yang terfilter, bukan KPI resmi nasional.

## Empat kartu KPI

1. Kejadian Krisis — jumlah kejadian terpantau, dengan sub-baris “x berdampak krisis”.
2. Panggilan 119 — total panggilan, dengan sub-baris tingkat keberhasilan layanan dan porsi darurat.
3. Kapasitas Respons — dua angka: PSC aktif dan ambulans.
4. Kesiapsiagaan SDM — dua angka: individu TCK dan tim, plus sub-baris Tim Medis Darurat (EMT).

Catatan keterbatasan data dikumpulkan dalam satu catatan kaki, bukan lencana pada kartu.

## Peta

Komponen yang sama dengan “Peta Spasial Klaster Surveilans Nasional” di dasbor SKDR (`SpasialMap` + `SpasialPanel`):

- Header: judul, pil variabel (Kejadian / Korban / Pengungsi / Layanan 119 / Kapasitas), chip periode, tombol Analisa Wilayah dan Pengaturan Lapisan.
- Panel kiri: tab Ringkasan (narasi + kurva bulanan + perbandingan bulan), Hotspot, Detail wilayah.
- Legenda yang bisa dilipat (kelas arsiran, warna status titik, catatan klaster).
- Klaster titik berwarna dan arsiran provinsi.
- Panel kanan “Pengaturan Peta & Lapisan”: toggle titik/arsiran + opasitas, API eksternal (Penerbangan, NASA FIRMS, BNPB InaRISK, GBIF, iNat), batas administrasi, aliran angin, peta dasar, dan “Atur Ulang Pengaturan Lapisan”.
- Slider waktu di bawah peta, dengan tombol putar, mengikuti tren bulanan nasional 2026. Arsiran per provinsi tetap angka tahunan karena sumber tidak merilis deret bulanan per wilayah.
- Titik diletakkan di pusat provinsi (daftar kejadian belum punya koordinat tepat).

## Agregat per dasbor sumber

Tab di bawah peta menampilkan variabel yang sama dengan dasbor aslinya:

- **Krisis Kesehatan / EOC** — terpantau vs berdampak krisis, meninggal, luka berat (LB/RI), luka ringan (LR/RJ), pengungsi, terdampak, pembagian Alam/Non alam/Sosial, 5 provinsi teratas, tren bulanan dan 5 tahun.
- **PSC** — total panggilan, darurat / non-darurat / non-kategori, per jenis dan spesifikasi, provinsi teratas, waktu respons, jumlah PSC aktif/total.
- **Ambulans** — gawat darurat vs transport, kondisi baik/rusak, unit ber-GPS.
- **NCC Panggilan** — tren panggilan masuk, terjawab, tak terjawab, dan tingkat keberhasilan layanan.
- **Tenaga Cadangan** — individu / tim / Tim Medis Darurat (EMT), nakes vs non-nakes, sebaran provinsi, delta bulan berjalan. Pengalaman dan pelatihan tidak ada di snapshot.
- **Logistik** — stok, penerimaan, pengeluaran, matriks 11 regional × Obat / Sarpras / Alkes / BMHP.
- **Asistensi Risiko** — status kapasitas dan kelengkapan modul di provinsi dan kab/kota (langsung dari API rekapitulasi Asistensi; kelengkapan per modul belum tersedia di API).

Tab Ringkasan Utama menampilkan gabungan semua blok itu. Tab lain memfokuskan satu kelompok sumber.

## Slider jenis kejadian

“Ringkasan per Jenis Kejadian/Bencana” meniru carousel penyakit SKDR. Pada filter nasional tahun 2026, jumlah kejadian memakai angka resmi `jenis_2026`. Korban dan pengungsi diambil dari kejadian terbaru bila ada. Klik kartu memasang filter jenis.


## Fitur integrasi (satu kejadian, banyak sumber)

1. **Kartu Kejadian Terpadu** — klik provinsi atau titik kejadian untuk membuka panel yang menyatukan korban/pengungsi EOC, panggilan 119 PSC, armada ambulans, TCK, stok logistik regional, dan status Asistensi.
2. **Indeks Kesenjangan Respons (0–100)** — bisa dipilih sebagai arsiran peta (warna merah = kesenjangan tinggi).
   - Beban = rata-rata normalisasi min-max dari kejadian terpantau, meninggal, dan pengungsi.
   - Kapasitas = rata-rata normalisasi PSC aktif, ambulans baik, dan TCK individu. Stok regional hanya dihitung di 11 regional yang ada datanya; poin Asistensi hanya di wilayah yang ada di snapshot (saat ini dua contoh). Indikator yang kosong tidak diisi angka rekaan, melainkan dihilangkan dari rata-rata wilayah itu.
   - Indeks = ((beban − kapasitas + 1) / 2) × 100.
3. **Radius Dukungan** — toggle di Pengaturan Peta & Lapisan menampilkan lingkaran 50/100/200 km. Jumlah PSC, ambulans, TCK, dan gudang dihitung dari pusat provinsi. Koordinat fasilitas memakai **data contoh** (pusat provinsi) karena sumber belum menyediakan lokasi persis.
4. **Lini Masa Respons** — kurva 14 hari: waktu kejadian, korban/pengungsi, dan panggilan 119. Bila tanggal tidak ada di API NCC, panggilan dibiarkan kosong (tanpa data contoh).
5. **Peringatan Otomatis** — tab Peringatan di panel kiri: lonjakan panggilan masuk di atas 1,5× rata-rata, stok regional menipis plus jejak kejadian, kesenjangan ≥ 70, serta provinsi berisiko tinggi menurut Indeks Risiko Bencana Indonesia yang belum mengisi Asistensi (**data contoh** IRBI).
6. **Narasi Otomatis** — satu paragraf di atas kartu KPI, mengikuti filter aktif.

Semua blok ini dihitung ulang saat filter periode, provinsi, kab/kota, atau jenis kejadian berubah.


## Heatmap dinamik

Bagian heatmap di Ringkasan memakai grid bergaya heatmap zoonosis SKDR (sel berwarna, legenda, tooltip, judul section besar) dengan menu pilihan tampilan:

1. Provinsi × Bulan — jumlah kejadian krisis (baku). Sumber: jejak marker kejadian; angka resmi bulanan bersifat nasional dan tidak dipecah.
2. Provinsi × Jenis kejadian — jejak marker, mengikuti filter.
3. Jam sibuk panggilan 119 — kini dari API NCC (agregat per 30 menit, kartu Panggilan 119 dan grafik jam sibuk); pembagian interval "data contoh" lama sudah dihapus.
4. Provinsi × Pilar kesiapsiagaan (PSC, ambulans layak, Tenaga Cadangan, logistik, Asistensi) dinormalisasi sebagai kesenjangan. Sel kosong = data tidak tersedia. Asistensi per wilayah terbatas, bertanda **data contoh**.
5. Regional × Kategori logistik (Obat / Sarpras / Alkes / BMHP) — stok resmi 11 regional.

## Bahasa antarmuka

Singkatan NCC tidak dipakai di tampilan. Dipakai: Panggilan Masuk, Panggilan Terjawab, Panggilan Tak Terjawab (ditutup penelepon), dan Tingkat Keberhasilan Layanan (%) (terjawab ÷ masuk × 100%). "GADAR" ditulis Gawat Darurat, "EMT" ditulis Tim Medis Darurat (EMT), dan IRBI dijelaskan sebagai Indeks Risiko Bencana Indonesia dengan keterangan.

## Pembaruan 17 November 2026: dampak penduduk, API Intelijen, Open Data

- **Istilah korban (dari HTML dashboard-new):** `LB/RI` = kolom `lukaBerat` (Luka Berat / Rawat Inap), `LR/RJ` = kolom `lukaRingan` (Luka Ringan / Rawat Jalan). Korban total sumber = meninggal + hilang + LB/RI + LR/RJ + pengungsi (325.445 = 543 + 131 + 1.571 + 41.911 + 281.289).
- **Ringkasan:** pita "Dampak terhadap penduduk" (7 kartu kecil: korban total, meninggal, hilang, luka berat/rawat inap, luka ringan/rawat jalan, pengungsi, penduduk terdampak) di bawah 4 KPI, dengan sparkline 5 tahun dan perubahan vs 2025. Ikuti filter; per provinsi luka & hilang hanya nasional.
- **Peta:** dropdown variabel arsiran (semua `CHORO_OPTIONS`, termasuk luka berat, luka ringan, hilang per provinsi kumulatif semua tahun). Legenda/tooltip memakai label variabel.
- **Situasi Krisis:** kartu tren 5 tahun (semua kejadian vs berdampak krisis) per variabel, indikator turunan, provinsi dengan pengungsi/terdampak terbanyak.
- **API Intelijen Eksternal:** proxy GET `/api/v1/map-layers/{hazards,fires,flights,flight-airports,wildlife,vectors}` (BMKG + GDACS + USGS cadangan, NASA FIRMS CSV publik, adsb.lol/adsb.fi, GBIF, iNaturalist). Aliran angin memakai `/wind-data`. Batas administrasi, opasitas titik, dan peta Medan (OpenTopoMap) kini berfungsi.
- **Open Data:** `/dashboard/open-data` mendaftar semua API luar + status langsung, dan sumber agregat dasbor (langsung / belum tersedia).

## Kejadian Terbaru, angin animasi, BNPB InaRISK (Nov 2026)

- Tab dok kiri peta "Peringatan" diganti **Kejadian Terbaru**: daftar kejadian bencana terbaru (terbaru di atas) dari
  Pusat Krisis dashboard-new (`/api/v1/map-layers/kejadian-terbaru`, kini langsung dari API EOC data_krisis; tanpa cadangan snapshot),
  `eoc.kejadian_krisis_terbaru` dari API EOC (melengkapi meninggal/pengungsi), dan gempa BMKG + GDACS (`/api/v1/map-layers/hazards`).
  Mengikuti filter provinsi/kab, periode, jenis. Klik item → peta diperbesar ke lokasi.
- Aliran angin memakai `ol-wind` WindLayer (partikel bergerak) dengan opsi sama seperti ABVC.
- 14 lapisan BNPB InaRISK (`BNPB_LAYERS` di `lib/puskris/open-data.ts`) dengan tombol masing-masing di Pengaturan Lapisan, dimuat langsung
  dari gis.bnpb.go.id (TileArcGISRest). Cek ketersediaan: `/api/v1/map-layers/bnpb` (juga tampil di Open Data).
- Kartu "Situasi krisis kesehatan" (9 angka) di halaman Situasi Krisis dihapus karena duplikat dengan strip "Dampak terhadap penduduk" dan KPI.

## Spatial Mode (/dashboard/spatial-mode, /tv)

- Peta layar penuh tanpa sidebar/header aplikasi. Komponen peta dipisah ke `components/puskris/PuskrisPetaTerpadu.tsx`
  (variant `card` untuk Ringkasan, `fullscreen` untuk Spatial Mode) sehingga state lapisan, dok Analisa/Kejadian Terbaru/Terpadu,
  API Intelijen, BNPB InaRISK, angin, pill metrik dan Variabel peta tidak terduplikasi.
- Bilah atas mengambang: kembali ke Ringkasan, judul wilayah + periode, tombol Filter (laci PuskrisFilterPanel, filter tersimpan di URL),
  pill metrik, Variabel peta, tombol panel, legenda, sesuaikan ke Indonesia, layar penuh. Di bawahnya strip KPI ringkas.
- `SpasialMap` mendapat prop `fitPadding` (ruang panel mengambang saat fit) dan `legendDefaultOpen` (legenda tertutup di layar < 900px tinggi).
- Di layar < 1500px lebar, panel Pengaturan Lapisan tertutup saat awal.
