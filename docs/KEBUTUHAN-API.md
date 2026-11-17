# Kebutuhan Data & API Dasbor Pusat Krisis Kesehatan

Disusun 17 November 2026, diperbarui 17 November 2026 siang setelah API resmi Pusat Krisis Kesehatan (Asistensi dan PSC 119) dihubungkan. Dokumen ini adalah daftar kebutuhan untuk backend ke depan.
Dasar angka dasbor adalah berkas `data/puskris-data.json` (snapshot 16–17 Nov 2026), disajikan oleh `GET /api/puskris/ringkasan`. **Asistensi Risiko, PSC 119 (master PSC, ambulans, SDM, RS) dan hitungan Panggilan PSC 119 kini ditimpa data langsung** dari API resmi (lihat 3.3). Bila token belum diatur atau API gagal, dasbor otomatis memakai snapshot dan menampilkan tanda "snapshot" di strip Sumber Data.
Filter (provinsi, kab/kota, periode, jenis) dihitung **di browser**. Lapisan peta (`/api/v1/map-layers/*`, `/wind-data`) juga **langsung** (proxy GET ke API publik).

Prinsip: hanya data **agregat** (tanpa data individu), semua endpoint **GET / baca-saja**.

---

## 1. Konvensi umum endpoint usulan

| Parameter | Tipe | Arti |
|---|---|---|
| `provinsi` | string, kode BPS 2 digit (`53`) | filter provinsi |
| `kabkota` | string, kode BPS 4 digit (`5371`) | filter kab/kota |
| `from`, `to` | tanggal `YYYY-MM-DD` (WIB) | rentang waktu; pengganti `periode` |
| `periode` | `tahun` \| `bulan` \| `30hari` \| `7hari` | pintasan rentang (opsional) |
| `jenis` | string, kode jenis kejadian | filter jenis kejadian |
| `level` | `nasional` \| `provinsi` \| `kabkota` | tingkat agregasi baris |
| `interval` | `hari` \| `minggu` \| `bulan` \| `tahun` | resolusi deret waktu |

Bentuk respons standar:
```json
{ "ok": true, "sumber": "Pantauan Bencana (EOC)", "diperbarui": "2026-11-17T08:00:00+07:00",
  "filter": { "provinsi": "53", "from": "2026-01-01", "to": "2026-11-17" },
  "cakupan": "provinsi",            // tingkat terhalus yang benar-benar tersedia
  "catatan": ["Angka nasional; belum tersedia per provinsi"],
  "data": { ... } }
```
`cakupan` dan `catatan` wajib supaya dasbor bisa menampilkan catatan "hanya angka nasional" secara otomatis.

---

## 2. Kebutuhan per halaman

Keterangan sumber dasbor asal: **PSC** (psc.kemkes.go.id/dashboard), **Ambulans** (…/dashboard-ambulans), **NCC 119** (…/dashboard-ncc, Google Sheets SIAP PSC), **EOC/Pantauan Bencana** (pusatkrisis.kemkes.go.id/dashboard-new + dashboard-eoc.vercel.app), **TCK** (tenagacadangankesehatan.kemkes.go.id), **Logistik** (SIMLOGKES landing), **Asistensi Provinsi/Kabkota** (pusatkrisis.kemkes.go.id/asistensi, butuh login).

### 2.1 Ringkasan Utama (`/dashboard/ringkasan`)

| Blok | Yang ditampilkan | Field (tipe) | Granularitas & periode | Sumber kini | Dasbor asal | Endpoint usulan |
|---|---|---|---|---|---|---|
| KPI Kejadian Krisis | kejadian terpantau, berdampak krisis | `terpantau` int, `berdampak_krisis` int | nasional resmi; provinsi 2026; tahunan + Oktober | statis `eoc.nasional`, `eoc.provinsi` | EOC | `GET /api/v2/krisis/ringkasan` |
| KPI Panggilan 119 | panggilan, tingkat keberhasilan, porsi darurat | `panggilan` int, `scr` % float, `darurat` int, `non_darurat` int | panggilan per provinsi kumulatif; keberhasilan hanya nasional Nov 2026 | statis `psc.summary`, `ncc.totals` | PSC, NCC 119 | `GET /api/v2/psc/ringkasan`, `GET /api/v2/ncc/harian` |
| KPI Kapasitas Respons | PSC aktif/total, ambulans | `psc_total`, `psc_aktif`, `ambulans`, `ambulans_aktif` int | provinsi, kumulatif (tanpa periode) | statis `psc.summary`, `psc.provinsi` | PSC, Ambulans | `GET /api/v2/psc/provinsi` |
| KPI Kesiapsiagaan SDM | individu, tim, Tim Medis Darurat (EMT) | `individu`, `tim`, `emt` int (+ `_bulan_ini`, `_delta_pct`) | individu per provinsi; tim/EMT nasional | statis `tck.summary`, `tck.provinsi` | TCK | `GET /api/v2/tck/ringkasan` |
| Strip "Dampak terhadap penduduk" (7 kartu) | korban total, meninggal, hilang, luka berat/rawat inap (LB/RI), luka ringan/rawat jalan (LR/RJ), pengungsi, penduduk terdampak + tren 5 tahun + perubahan vs 2025 | `korban_total`, `meninggal`, `hilang`, `luka_berat`, `luka_ringan`, `pengungsi`, `terdampak` int; deret `{tahun, jumlah, krisis}` | nasional tahunan; per provinsi hanya kumulatif semua tahun untuk LB/LR/hilang | statis `eoc.nasional.tren_5_tahun_*` | EOC | `GET /api/v2/krisis/ringkasan` + `GET /api/v2/krisis/tren?interval=tahun` |
| Peta spasial (arsiran) | variabel per provinsi: kejadian, krisis, korban, pengungsi, layanan 119, kapasitas, kesenjangan, LB, LR, hilang, logistik, asistensi | per wilayah: semua field di atas | provinsi (kab/kota bila provinsi dipilih: **belum ada**) | statis, diolah `derive.ts` + `to-spasial.ts` | EOC, PSC, TCK, Logistik, Asistensi | `GET /api/v2/krisis/wilayah?level=provinsi` (+ gabungan `GET /api/v2/analisis/kesenjangan`) |
| Titik kejadian krisis | 40 kejadian krisis terbaru | `tanggal`, `jenis`, `provinsi`, `kabupaten`, `kode`, `terdampak`, `meninggal`, `luka_berat`, `luka_ringan`, `pengungsi`, `korban`, **`lat`, `lon` (belum ada)** | per kejadian, harian | statis `eoc.kejadian_krisis_terbaru` (titik di pusat provinsi) | EOC | `GET /api/v2/krisis/kejadian` |
| Dok kiri: Kejadian Terbaru | daftar kejadian terbaru (Pusat Krisis + BMKG + GDACS) | `id`, `sumber`, `kategori`, `jenis`, `lokasi`, `provinsi`, `tanggal`, `jam`, `lat`, `lon`, `terdampak`, `korban`, `magnitudo`, `kedalaman`, `url` | per kejadian, menit | **langsung**: `/api/v1/map-layers/kejadian-terbaru` (cadangan snapshot) + `/api/v1/map-layers/hazards` | EOC + BMKG/GDACS | `GET /api/v2/krisis/kejadian?sort=-tanggal&limit=50` |
| Dok kiri: Terpadu | kartu kejadian/wilayah terpilih + radius 50/100/200 km | gabungan wilayah + kejadian; jumlah PSC, ambulans, tenaga, gudang dalam radius | provinsi; koordinat fasilitas | dihitung di browser dari pusat provinsi (**data contoh koordinat**) | PSC, TCK, Logistik | `GET /api/v2/analisis/radius?lat=&lon=&km=50,100,200` |
| Jenis kejadian (batang) | jumlah per jenis | `jenis`, `jumlah` | nasional 2026 (resmi); per filter dari daftar kejadian | statis `eoc.jenis_2026` | EOC | `GET /api/v2/krisis/jenis` |
| Tren per jenis | deret bulanan per jenis | `{bulan, <jenis>: jumlah}` | nasional bulanan | **data contoh** (total bulanan × porsi tahunan) | EOC | `GET /api/v2/krisis/tren?interval=bulan&group=jenis` |
| Lini masa respons | kejadian + panggilan NCC per hari | `tanggal`, `kejadian`, `panggilan` | harian | statis `eoc.kejadian_krisis_terbaru` + `ncc.days` | EOC, NCC 119 | `GET /api/v2/krisis/tren?interval=hari` + `GET /api/v2/ncc/harian` |
| Slider waktu peta | tren bulanan nasional | `bulan`, `kejadian`, `krisis`, `meninggal` | nasional bulanan | statis `eoc.bulanan_2026` (9 bulan) | EOC | `GET /api/v2/krisis/tren?interval=bulan` |

### 2.2 Situasi Krisis (`/dashboard/situasi-krisis`)

| Blok | Field | Granularitas | Sumber kini | Endpoint usulan |
|---|---|---|---|---|
| Dampak penduduk: tren 5 tahun (tab per variabel), indikator turunan (korban per kejadian, proporsi pengungsi, dst.) | `tahun`, `jumlah`, `krisis` per variabel | nasional tahunan | statis `eoc.nasional.tren_5_tahun_*` | `GET /api/v2/krisis/tren?interval=tahun&variabel=pengungsi,terdampak,...` |
| Provinsi pengungsi / terdampak terbanyak | `kode`, `nama`, `pengungsi`, `terdampak` (2026 dan kumulatif) | provinsi | statis `eoc.provinsi` | `GET /api/v2/krisis/wilayah?level=provinsi&sort=-pengungsi&limit=5` |
| Jenis kejadian Alam / Non alam / Sosial | `kelompok`, `tahun`, `oktober`, `krisis` | nasional, tahunan + bulan | statis `eoc.nasional.kejadian_tahun/oktober`, `krisis_tahun` | `GET /api/v2/krisis/jenis?group=kelompok` |
| Tren bulanan 2026 | `bulan`, `kejadian`, `krisis`, `meninggal` | nasional bulanan | statis `eoc.bulanan_2026` | `GET /api/v2/krisis/tren?interval=bulan` |
| Tren 5 tahun | `tahun`, `terpantau`, `krisis`, `meninggal` | nasional tahunan | statis | `GET /api/v2/krisis/tren?interval=tahun` |
| Lima provinsi teratas | `nama`, `jumlah` (krisis 2026, terpantau Oktober) | provinsi | statis `top_provinsi_*` | `GET /api/v2/krisis/wilayah?sort=-krisis&limit=5` |
| Tabel kejadian krisis terbaru | `tanggal`, `jenis`, `provinsi`, `kabupaten`, `terdampak`, `meninggal`, `luka_berat`, `luka_ringan`, `pengungsi`, `korban` | per kejadian | statis 40 baris (Agu 2026) | `GET /api/v2/krisis/kejadian` |
| Jenis kejadian kumulatif & penyakit (EOC Vercel) | `nama`, `jumlah` | nasional, semua tahun | statis `eoc.vercel_kumulatif` | `GET /api/v2/krisis/jenis?from=2000-01-01` |

### 2.3 Layanan Gawat Darurat (`/dashboard/layanan-gawat-darurat`, sub: PSC, Ambulans, Panggilan 119)

| Blok | Field | Granularitas | Sumber kini | Dasbor asal | Endpoint usulan |
|---|---|---|---|---|---|
| PSC 119: KPI | `total_panggilan`, `darurat`, `non_darurat`, `tanpa_kategori`, `total_psc`, `psc_aktif`, `personil`, `rs_jejaring`, `waktu_respons_menit` float | nasional + provinsi, **kumulatif** | statis `psc.summary`, `psc.provinsi` | PSC | `GET /api/v2/psc/ringkasan`, `GET /api/v2/psc/provinsi` |
| PSC: jenis panggilan, spesifikasi kasus, sumber panggilan teratas | `{nama, jumlah}[]` | nasional | statis `psc.jenis_panggilan/spesifikasi/sumber_panggilan_top` | PSC | `GET /api/v2/psc/kategori?dimensi=jenis\|spesifikasi\|sumber` |
| Ambulans: jenis, kondisi (baik/rusak ringan/rusak berat/kosong), ber-GPS, aktif | `{nama, jumlah}[]`, `ambulans_gps`, `ambulans_aktif` | nasional + provinsi | statis `psc.jenis_ambulans/kondisi_ambulans`, `psc.provinsi` | Ambulans | `GET /api/v2/ambulans/ringkasan` (+ `level=provinsi`) |
| Panggilan 119 (NCC): Panggilan Masuk (COF), Terjawab (ACD), Tak Terjawab (ABD), Tingkat Keberhasilan Layanan (SCR, %) harian | `tanggal`, `cof`, `acd`, `abd`, `scr`, `tersedia` bool | **nasional harian**, hanya November 2026 | statis `ncc.days`, `ncc.totals` | NCC 119 | `GET /api/v2/ncc/harian?from=&to=` |
| Interval tersibuk | `tanggal`, `jam`, `cof`, `acd`, `abd`, `scr` | interval 30 menit | statis `ncc.busiest_interval` (1 baris) | NCC 119 | `GET /api/v2/ncc/interval?from=&to=` |
| Kualitas data NCC | `hari_cocok`, `hari_selisih`, `hari_kosong`, `catatan` | per bulan | statis `ncc.quality` | NCC 119 | ikut di `meta` respons `ncc/harian` |

### 2.4 Kesiapsiagaan (`/dashboard/kesiapsiagaan`, sub: Tenaga Cadangan, Logistik)

| Blok | Field | Granularitas | Sumber kini | Dasbor asal | Endpoint usulan |
|---|---|---|---|---|---|
| Tenaga cadangan: KPI | `individu`, `tim`, `emt` + `_bulan_ini`, `_delta_bulan`, `_delta_pct`, `_hari_ini` | nasional, bulanan | statis `tck.summary` | TCK | `GET /api/v2/tck/ringkasan` |
| Sebaran per provinsi | `kode`, `nama`, `nakes`, `non_nakes`, `individu` (**tim, EMT belum ada**) | provinsi | statis `tck.provinsi` (dari GeoJSON individu, diagregasi) | TCK | `GET /api/v2/tck/wilayah?level=provinsi` |
| Logistik: KPI | `total_stok`, `transaksi_pengeluaran`, `transaksi_penerimaan`; stok per kategori (Obat, Sarpras, Alkes, BMHP) | nasional, tahunan | statis `logistik.summary`, `kategori` | Logistik | `GET /api/v2/logistik/ringkasan?tahun=` |
| Matriks regional | `regional`, `kode`, `obat`, `sarpras`, `alkes`, `bmhp`, `total` | **11 regional**, bukan 38 provinsi | statis `logistik.regional` | Logistik | `GET /api/v2/logistik/wilayah?level=regional\|provinsi` |

### 2.5 Asistensi Risiko (`/dashboard/asistensi-risiko`, sub: Provinsi, Kab/Kota)

| Blok | Field | Granularitas | Sumber kini | Dasbor asal | Endpoint usulan |
|---|---|---|---|---|---|
| Status kapasitas | jumlah wilayah `Tinggi`, `Sedang`, `Rendah`, `Belum Mengisi` | provinsi (38) & kab/kota (514), tahunan | statis manual (sumber butuh login) | Asistensi Prov/Kabkota | `GET /api/v2/asistensi/ringkasan?level=provinsi\|kabkota&tahun=` |
| Kelengkapan modul | per modul (Profil Umum, Kerentanan, Ancaman, Kapasitas): `lengkap`, `belum_lengkap`, `belum_mengisi` | idem | statis | Asistensi | idem |
| Cakupan pengisian | `mengisi`, `total`, `pct` | idem | statis `asistensi.cakupan` | Asistensi | idem |
| Tabel wilayah | `kode_wilayah`, `nama`, `poin_kapasitas_pct` float, `status_kapasitas`, `status_risiko_irbi_2024` (Indeks Risiko Bencana Indonesia) | per wilayah | statis, **hanya 2 contoh wilayah** | Asistensi | `GET /api/v2/asistensi/wilayah?level=&provinsi=` |

### 2.6 Analisis (`/dashboard/analisis`)

| Blok | Field | Sumber kini | Endpoint usulan |
|---|---|---|---|
| Indeks Kesenjangan Respons | per provinsi: beban (kejadian, korban, pengungsi) vs kapasitas (PSC aktif, ambulans, tenaga per 100 rb penduduk?) → skor 0–100 | dihitung di browser (`derive.ts`) | `GET /api/v2/analisis/kesenjangan?level=provinsi` (server menghitung, rumus terdokumentasi) |
| Tren kejadian per jenis | `{bulan, jenis, jumlah}` | **data contoh** | `GET /api/v2/krisis/tren?interval=bulan&group=jenis` |
| Peringkat kesenjangan provinsi | `kode`, `nama`, `skor`, komponen | browser | idem kesenjangan |
| Beban vs Kapasitas (sebar) | `beban`, `kapasitas` per provinsi | browser | idem kesenjangan |
| Jam sibuk panggilan 119 | `jam`, `cof`, `acd` rata-rata | **data contoh** (dibagi dari total harian + jam tersibuk) | `GET /api/v2/ncc/interval?from=&to=&group=jam` |

### 2.7 Spatial Mode (`/dashboard/spatial-mode`)

Memakai komponen peta yang sama dengan Ringkasan, jadi kebutuhannya sama dengan 2.1 (peta, titik, Kejadian Terbaru, Terpadu, lapisan) ditambah strip KPI (kejadian, meninggal, LB/RI, pengungsi, terdampak, panggilan 119, PSC aktif · ambulans). Tambahan yang diperlukan untuk peta yang lebih tajam:
- koordinat fasilitas: `GET /api/v2/spasial/fasilitas?jenis=psc|rs|gudang_logistik&provinsi=` → `{id, nama, jenis, lat, lon, kab_kota, status}` (agregat lokasi fasilitas, bukan data orang);
- agregat per kab/kota untuk drill-down: `GET /api/v2/krisis/wilayah?level=kabkota&provinsi=`.

### 2.8 Open Data (`/dashboard/open-data`)

Daftar API luar + cek status langsung. Butuh endpoint status ringkas: `GET /api/v2/meta/sumber` → `{id, nama, jenis: statis|langsung, diperbarui, status: ok|kosong|gagal, jumlah, pesan}` untuk semua sumber internal dan eksternal (dipakai juga untuk label "diperbarui" di setiap kartu).

---

## 3. Endpoint yang sudah ada

### 3.1 Internal (Next.js, semua GET)

| Route | Isi | Sifat |
|---|---|---|
| `GET /api/puskris/ringkasan` | snapshot `data/puskris-data.json` + timpaan langsung Asistensi/PSC/Panggilan, plus `live_status` per sumber dan `pending` | campuran: langsung (cache 15 menit) + snapshot |
| `GET /api/puskris/live/{asistensi\|psc\|panggilan}` | ringkasan agregat satu sumber resmi (`ok, status, fetched_at, count, ringkas, data`) | langsung, cache 15 menit; 502 bila jatuh ke snapshot |
| `GET /api/v1/map-layers/kejadian-terbaru` | kejadian terbaru Pusat Krisis (crisisIncidents + incidents) | langsung dari HTML dashboard-new, cache 30 menit, cadangan snapshot |
| `GET /api/v1/map-layers/hazards` | gempa BMKG (terkini + dirasakan), GDACS Indonesia, cadangan USGS | langsung, cache 10–15 menit |
| `GET /api/v1/map-layers/fires` | titik panas NASA FIRMS VIIRS (NOAA-20 + Suomi NPP, 24 jam, Asia Tenggara → Indonesia) | langsung, cache 30 menit |
| `GET /api/v1/map-layers/flights` | pesawat di atas Indonesia (adsb.lol, cadangan adsb.fi) | langsung |
| `GET /api/v1/map-layers/flight-airports` | daftar bandara (statis `lib/server/airports.ts`) | statis |
| `GET /api/v1/map-layers/wildlife` | pengamatan burung liar GBIF Indonesia | langsung, cache |
| `GET /api/v1/map-layers/vectors` | pengamatan nyamuk (Culicidae) iNaturalist Indonesia | langsung, cache 6 jam |
| `GET /api/v1/map-layers/bnpb` | cek ketersediaan 14 lapisan BNPB InaRISK | langsung, cache 1 jam |
| `GET /wind-data` | angin u/v GFS (via Opsroom SIPONGI) | langsung |
| `GET /osm-tiles/{z}/{x}/{y}.png`, `/boundaries`, `/wilayah-data`, `public/data/*.geojson` | ubin peta dan batas wilayah (38 provinsi, 514 kab/kota) | proxy / statis |

### 3.2 API eksternal (publik, tanpa kunci) — status per 17 Nov 2026 pagi

| API | Dipakai untuk | Status |
|---|---|---|
| BMKG `data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json`, `gempadirasakan.json` | gempa terbaru | Aktif (lewat server; curl langsung dari luar Indonesia kadang 403) |
| GDACS `gdacs.org/gdacsapi/.../geteventlist` | banjir, gunung api, siklon, kekeringan, kebakaran (Indonesia) | Aktif (35 kejadian gabungan BMKG+GDACS) |
| USGS FDSN | cadangan gempa | Aktif (cadangan) |
| NASA FIRMS VIIRS CSV 24 jam | titik panas kebakaran | Aktif (±1.106 titik) |
| adsb.lol / adsb.fi | penerbangan | Aktif (48–67 pesawat); OpenSky tidak dipakai (429) |
| GBIF occurrence | burung liar | Aktif (300 titik) |
| iNaturalist observations | nyamuk | Aktif (200 titik) |
| BNPB InaRISK `gis.bnpb.go.id/server/rest/services/...` (14 lapisan ImageServer/MapServer) | peta bahaya | **Tidak stabil**: banjir, banjir bandang, karhutla, multi bahaya sempat jalan; lainnya timeout; sejak ±08.30 WIB server BNPB mati (Cloudflare 521). Menolak peramban headless |
| Opsroom SIPONGI GFS `opsroom.sipongidata.my.id/api/gfs` | angin bergerak | Aktif, tetapi **data basi** (model Juli 2026) |
| Pusat Krisis dashboard-new (HTML) | kejadian terbaru | Aktif (409 kejadian), dibaca dari HTML, rawan berubah format |
| OpenStreetMap, Esri World Imagery, OpenTopoMap | peta dasar | Aktif |

### 3.3 API resmi Pusat Krisis Kesehatan (dengan token) — terhubung 17 Nov 2026

Token disimpan **hanya** di variabel lingkungan server `PUSKRIS_TTOKEN` (`.env.local` lokal, dan **wajib diisi di Vercel → Settings → Environment Variables** untuk produksi). Tidak pernah memakai awalan `NEXT_PUBLIC_`, tidak masuk ke browser, tidak di-commit. Semua panggilan: `POST` form-urlencoded dengan header `TTOKEN`, dari server (`lib/server/puskris-live.ts`), hasil diringkas jadi agregat lalu di-cache 15 menit (stale-while-revalidate). Data pribadi (nama, telepon, alamat, plat nomor, nama pasien/pelapor) dibuang di server dan tidak pernah dikirim ke browser.

| Endpoint | Status uji 17 Nov 2026 | Isi (bentuk) | Dipakai di |
|---|---|---|---|
| Asistensi `web_api/v1/rekapitulasi-asistensi-provinsi` | 200, 38 baris | kode wilayah, nama, poin kapasitas, status kapasitas, status IRBI | Asistensi Risiko, peta Poin Kapasitas, Kesenjangan, peringatan IRBI, Matriks Asistensi |
| Asistensi `web_api/v1/rekapitulasi-asistensi-kabupaten` | 200, 514 baris | idem per kab/kota | sub-halaman Kab/Kota, Matriks Asistensi (Kab/Kota) |
| PSC `web_api/v1/data-psc` (100 baris/halaman, 5 halaman) | 200, 450 PSC (392 aktif) | PSC + ambulans, personil, RS jejaring, anggaran, koordinat | KPI PSC/ambulans/SDM/RS per provinsi, peta, radius 50/100/200 km |
| PSC `data-ambulan-psc`, `data-rumahsakit-sarana` (hanya `total_data`) | 200: 1.759 ambulans, 3.389 RS | jumlah terdaftar | catatan selisih |
| PSC `data-pelaporan-panggilan` (hitungan + sampel ±3.500 baris terbaru) | 200: 117.149 panggilan 2026 (±112 ribu selesai); 59.345 (2025) | per baris laporan (berisi data pribadi → langsung diagregasi) | KPI Panggilan PSC 119, per provinsi, Matriks PSC 119 Harian / Provinsi × Jenis |
| PSC master `data-jenis-layanan`, `data-kategori-layanan`, `data-spesifikasi-layanan`, `data-jenis-ambulan`, `data-kategori-ambulan`, dll. | 200 | referensi | belum dipakai langsung |
| SSO `auth-prov`, `auth-kab` | **tidak dipanggil** (endpoint autentikasi) | – | – |
| TCK `tenagacadangan…/web_api`, Logistik `…/web_api` | hanya alamat dasar (302 / halaman sambutan), **tanpa daftar endpoint** | – | tetap snapshot |

Catatan selisih data resmi:
- Ambulans yang terkait PSC 1.629 vs 1.759 terdaftar; RS jejaring unik 2.956 vs 3.389 terdaftar.
- Ambulans ber-GPS menurut API 73 (kolom IMEI/vendor/alat terisi) vs 395 di snapshot dasbor PSC.
- `data-pelaporan-panggilan` tidak punya filter tanggal/jenis dan maksimal 100 baris per halaman, jadi rincian harian, jam, jenis dan kategori hanya dari **sampel hari-hari terbaru**; jumlah gawat darurat nasional = proporsi sampel × total (ditandai "≈").

---

## 4. Daftar endpoint usulan (24)

**Referensi**
1. `GET /api/v2/ref/wilayah?level=provinsi|kabkota&provinsi=` — kode BPS, nama, pusat koordinat.
2. `GET /api/v2/ref/jenis-kejadian` — kode, nama, kelompok (alam / non alam / sosial).

**Situasi Krisis (EOC / Pantauan Bencana)**
3. `GET /api/v2/krisis/ringkasan?provinsi=&kabkota=&from=&to=&jenis=` — KPI kejadian, krisis, korban, LB/RI, LR/RJ, hilang, pengungsi, terdampak, + pembanding periode sebelumnya.
4. `GET /api/v2/krisis/wilayah?level=&provinsi=&from=&to=&jenis=&sort=&limit=` — agregat per provinsi/kab-kota untuk peta & peringkat.
5. `GET /api/v2/krisis/tren?interval=hari|bulan|tahun&group=jenis&variabel=&...` — deret waktu (termasuk per jenis per bulan).
6. `GET /api/v2/krisis/jenis?group=jenis|kelompok&...` — rincian per jenis/kelompok.
7. `GET /api/v2/krisis/kejadian?sort=-tanggal&limit=&kategori=krisis|terpantau&...` — daftar kejadian dengan koordinat & dampak.
8. `GET /api/v2/krisis/kejadian/{id}` — rincian agregat satu kejadian (kartu Terpadu).

**Layanan Gawat Darurat**
9. `GET /api/v2/psc/ringkasan?provinsi=&from=&to=` — KPI panggilan, PSC, personil, RS jejaring, waktu respons.
10. `GET /api/v2/psc/provinsi?from=&to=` — per provinsi: panggilan, PSC total/aktif, ambulans, RS jejaring.
11. `GET /api/v2/psc/kategori?dimensi=jenis|spesifikasi|sumber&...` — rincian panggilan.
12. `GET /api/v2/ambulans/ringkasan?level=&provinsi=` — jenis, kondisi, aktif, ber-GPS.
13. `GET /api/v2/ncc/harian?from=&to=&provinsi=` — COF/ACD/ABD/SCR per hari + kualitas data.
14. `GET /api/v2/ncc/interval?from=&to=&group=jam` — per 30 menit / per jam (jam sibuk).

**Kesiapsiagaan**
15. `GET /api/v2/tck/ringkasan` — individu, tim, EMT, perubahan bulanan.
16. `GET /api/v2/tck/wilayah?level=provinsi|kabkota` — nakes, non nakes, individu, tim, EMT per wilayah.
17. `GET /api/v2/logistik/ringkasan?tahun=` — stok per kategori, transaksi.
18. `GET /api/v2/logistik/wilayah?level=regional|provinsi` — stok per regional/provinsi.

**Asistensi Risiko**
19. `GET /api/v2/asistensi/ringkasan?level=provinsi|kabkota&tahun=` — status kapasitas, kelengkapan modul, cakupan.
20. `GET /api/v2/asistensi/wilayah?level=&provinsi=&tahun=` — poin kapasitas, status kapasitas, status risiko IRBI per wilayah.

**Analisis & Spasial**
21. `GET /api/v2/analisis/kesenjangan?level=provinsi&...` — Indeks Kesenjangan Respons (beban vs kapasitas) + komponennya.
22. `GET /api/v2/analisis/radius?lat=&lon=&km=50,100,200` — jumlah PSC, ambulans, tenaga, gudang dalam radius.
23. `GET /api/v2/spasial/fasilitas?jenis=psc|rs|gudang_logistik&provinsi=` — titik fasilitas (koordinat).

**Meta**
24. `GET /api/v2/meta/sumber` — status & waktu pembaruan semua sumber (untuk Open Data dan label "diperbarui").

Contoh bentuk respons (angka hanya ilustrasi bentuk, bukan data resmi):
```json
// GET /api/v2/krisis/wilayah?level=provinsi&from=2026-01-01&to=2026-11-17
{ "ok": true, "cakupan": "provinsi", "data": [
  { "kode": "53", "nama": "Nusa Tenggara Timur", "kejadian": 270, "krisis": 140,
    "meninggal": 817, "hilang": null, "luka_berat": null, "luka_ringan": null,
    "pengungsi": 501007, "terdampak": 37287121 } ] }

// GET /api/v2/ncc/harian?from=2026-11-01&to=2026-11-30
{ "ok": true, "cakupan": "nasional", "data": [
  { "tanggal": "2026-11-04", "cof": 6200, "acd": 5800, "abd": 400, "scr": 93.5, "tersedia": true } ],
  "kualitas": { "hari_cocok": 13, "hari_selisih": 0, "hari_kosong": 14 } }

// GET /api/v2/krisis/kejadian?sort=-tanggal&limit=2
{ "ok": true, "data": [
  { "id": "pk-36216", "tanggal": "2026-10-31", "jam": "17:50", "zona": "WIB", "jenis": "Banjir",
    "kategori": "krisis", "provinsi": "11", "kabkota": "1118", "lat": 5.27, "lon": 95.87,
    "terdampak": 32272, "korban": 208, "meninggal": 0, "pengungsi": 0, "url": "https://pusatkrisis.kemkes.go.id/detail-bencana/fqdke" } ] }
```

---

## 5. Kekosongan data (gap) utama

1. **Panggilan 119 (NCC) hanya nasional** dan hanya **November 2026** (16 hari tersedia, 14 hari kosong). Belum ada per provinsi, belum ada bulan lain, dan rincian per 30 menit tidak tersimpan, sehingga grafik "Jam sibuk" memakai data contoh.
2. **Panggilan PSC 119** kini langsung per tahun dan per provinsi, tetapi API tidak punya filter tanggal/jenis: filter bulan/minggu belum bisa, rincian harian/jenis hanya sampel terbaru. Waktu respons, jenis panggilan & spesifikasi nasional masih snapshot. Perlu endpoint rekap (per tanggal × provinsi × jenis).
3. **LB/RI, LR/RJ, dan hilang per provinsi tahun 2026 belum ada.** Yang tersedia hanya kumulatif semua tahun; data 2026 per provinsi baru kejadian, krisis, meninggal, pengungsi, dan terdampak.
4. **Tren bulanan per jenis kejadian tipis**: resmi hanya total bulanan nasional (9 bulan, `bulanan_2026`). Grafik per jenis per bulan masih data contoh.
5. **Agregat kab/kota belum ada** untuk krisis, PSC, TCK, dan logistik. Drill-down peta ke kab/kota hanya bisa dari daftar kejadian.
6. **Koordinat**: kejadian krisis di tabel EOC tidak punya koordinat (diletakkan di pusat provinsi). Koordinat PSC (305 titik) dan RS jejaring (2.926 titik) kini dari API PSC, sehingga radius 50/100/200 km menghitung PSC, ambulans dan RS nyata; koordinat gudang logistik dan tim cadangan belum ada.
7. **Tenaga cadangan**: tim dan Tim Medis Darurat (EMT) hanya angka nasional; sebaran provinsi baru individu.
8. **Logistik** hanya 11 regional, bukan 38 provinsi, dan tanpa deret waktu.
9. **Asistensi Risiko** status/poin/IRBI kini langsung untuk 38 provinsi dan 514 kab/kota. Kelengkapan per modul (Profil Umum, Kerentanan, Ancaman, Kapasitas) belum ada di API rekap → masih snapshot.
10. **Zona waktu jam kejadian Pusat Krisis belum terkonfirmasi** (diasumsikan WIB); BMKG/GDACS sudah dikonversi ke WIB.
11. **Kejadian terbaru dibaca dari HTML** dashboard-new: rawan rusak bila tampilan halaman berubah. Perlu API resmi.
12. **Angin** dari GFS Opsroom basi (Juli 2026), dan **BNPB InaRISK** sering timeout/mati; perlu sumber cadangan atau cache ubin di server.
13. **Tenaga Cadangan, Logistik, EOC dan NCC** masih **snapshot statis** (16–17 Nov 2026) yang diperbarui manual; perlu daftar endpoint TCK dan Logistik (sejauh ini baru alamat dasar) serta API EOC/NCC.
