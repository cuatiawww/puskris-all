# Ringkasan Pusat Krisis Kesehatan

Halaman `/dashboard/ringkasan` adalah dasbor agregat statis yang menyatukan tujuh sumber kesiapsiagaan dan respons krisis. Semua angka berasal dari `data/puskris-data.json` (mode statis, snapshot 16 November 2026, 11.00 WIB). Tidak ada pemanggilan API live.

## Sumber dan variabel

| Sumber | Variabel utama di Ringkasan | Catatan filter |
| --- | --- | --- |
| EOC resmi (Pantauan Bencana) | Kejadian terpantau, berdampak krisis, meninggal, luka, pengungsi, penduduk terdampak, tren bulanan | KPI resmi nasional untuk tahun 2026 dan Oktober 2026. Jika provinsi dipilih, angka memakai agregat marker 2026 (bukan KPI resmi). Filter 7/30 hari hanya memengaruhi tabel kejadian. |
| Marker EOC (Vercel) | Peta beban per provinsi, tabel kejadian krisis terbaru, kab/kota | Dipakai untuk sebaran 38 provinsi dan daftar kejadian. |
| PSC 119 | Panggilan, pangsa emergency, waktu respons, PSC aktif, armada dan kondisi ambulans | Snapshot kumulatif; filter periode sumber belum tersedia. Peta dan KPI per provinsi tersedia. `total_panggilan` tidak boleh dicampur dengan `total_bencana` EOC. |
| NCC Panggilan | SCR (ACD/COF), tren harian November 2026 | Nasional saja. Filter 7/30 hari dan Oktober memotong hari yang tersedia. Oktober tidak punya data NCC (NCC hanya November). |
| Tenaga Cadangan Kesehatan | Individu, nakes, non-nakes, tim, EMT, pertumbuhan bulan berjalan | Tim dan EMT hanya nasional. Peta individu per provinsi tersedia. |
| Logistik (SIMLOGKES) | Stok, penerimaan, pengeluaran, rincian 11 regional | Bukan 38 provinsi. Jika provinsi yang dipilih bukan salah satu 11 regional, stok ditandai kosong. |
| Asistensi Risiko | Cakupan pengisian kapasitas provinsi (5/38 = 13,2%) dan kab/kota (77/514 = 15,0%), status Tinggi/Sedang/Rendah/Belum mengisi, dua contoh wilayah | Snapshot manual; sumber butuh login. Peta koroplek per provinsi tidak ditampilkan karena nilai per wilayah tidak tersedia secara lengkap. Tahun 2026. |

Tautan sumber: PSC `https://psc.kemkes.go.id/dashboard`, Ambulans `https://psc.kemkes.go.id/dashboard/dashboard-ambulans`, NCC `https://psc.kemkes.go.id/dashboard/dashboard-ncc`, TCK `https://tenagacadangankesehatan.kemkes.go.id/web/site/dashboard-tck`, EOC `https://pusatkrisis.kemkes.go.id/dashboard-new` dan `https://dashboard-eoc.vercel.app/dashboard-eoc/`, Logistik `https://pusatkrisis.kemkes.go.id/logistik/site/landing-page`, Asistensi provinsi dan kab/kota di Pusat Krisis (butuh login).

## Indeks kesenjangan

Indeks Kesenjangan = skor beban dinormalisasi (0–1, rata-rata min-max kejadian 2026, krisis 2026, meninggal 2026, pengungsi 2026, dan penduduk terdampak 2026) dikurangi skor kapasitas dinormalisasi (0–1, rata-rata min-max PSC aktif, armada ambulans, dan tenaga cadangan individu). Nilai mendekati +1 berarti beban tinggi dengan kapasitas relatif rendah. Perhitungan memakai angka absolut, bukan per 10.000 penduduk, karena data penduduk resmi belum masuk ke berkas statis.

## Batasan

- Data pribadi dari API sumber (nama, telepon, pelat, dan sejenisnya) tidak masuk ke berkas statis maupun tampilan.
- Angka Asistensi adalah snapshot manual bertanggal 16 November 2026, diberi label "snapshot manual, sumber butuh login".
- Filter kab/kota hanya memengaruhi tabel kejadian, bukan peta atau KPI nasional.
- Mode TV dan halaman turunan ketujuh dasbor sumber belum dirampungkan pada tahap ini; menu Dasbor Sumber membuka dasbor asli di tab baru.
