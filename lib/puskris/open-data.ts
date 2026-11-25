/**
 * Daftar API luar (publik, tanpa kunci) yang dipakai lapisan "API Intelijen Eksternal" di peta
 * dan halaman Open Data. Semua dipanggil lewat proxy GET di /api/v1/map-layers/* (server Next.js),
 * sehingga browser tidak terkena CORS dan tidak ada data pribadi yang disimpan.
 */
export type IntelLayerId = 'fires' | 'hazards'

export type UpstreamApi = {
  nama: string
  penyedia: string
  url: string
  format: string
  catatan?: string
}

export type OpenDataApi = {
  id: IntelLayerId | 'wind' | 'basemap' | 'bnpb'
  nama: string
  icon: string
  kategori: 'Lapisan peta intelijen' | 'Konteks peta'
  deskripsi: string
  manfaat: string
  proxy: string
  /** Kunci array pada respons proxy yang berisi item. */
  itemKey?: string
  upstream: UpstreamApi[]
  pembaruan: string
}


const BNPB = 'https://gis.bnpb.go.id/server/rest/services'
export type BnpbLayerId =
  | 'flood' | 'flashFlood' | 'earthquake' | 'tsunami' | 'landslide' | 'forestFire' | 'volcano'
  | 'drought' | 'extremeWeather' | 'wave' | 'liquefaction' | 'multi' | 'hillshade' | 'population'

/** Lapisan peta BNPB InaRISK (ArcGIS REST, publik). Enam pertama mengikuti ABVC; sisanya layanan bahaya lain di direktori inarisk. */
export const BNPB_LAYERS: { id: BnpbLayerId; nama: string; deskripsi: string; url: string; opacity: number; kelompok: 'Bahaya' | 'Konteks' }[] = [
  { id: 'flood', nama: 'Bahaya Banjir', deskripsi: 'Indeks bahaya banjir InaRISK', url: `${BNPB}/inarisk/layer_bahaya_banjir/ImageServer`, opacity: 0.58, kelompok: 'Bahaya' },
  { id: 'flashFlood', nama: 'Bahaya Banjir Bandang', deskripsi: 'Indeks bahaya banjir bandang', url: `${BNPB}/inarisk/layer_bahaya_banjir_bandang/ImageServer`, opacity: 0.58, kelompok: 'Bahaya' },
  { id: 'earthquake', nama: 'Bahaya Gempa Bumi', deskripsi: 'Indeks bahaya guncangan gempa bumi', url: `${BNPB}/inarisk/layer_bahaya_gempabumi/ImageServer`, opacity: 0.65, kelompok: 'Bahaya' },
  { id: 'tsunami', nama: 'Bahaya Tsunami', deskripsi: 'Indeks bahaya tsunami di pesisir', url: `${BNPB}/inarisk/layer_bahaya_tsunami/ImageServer`, opacity: 0.6, kelompok: 'Bahaya' },
  { id: 'landslide', nama: 'Bahaya Tanah Longsor', deskripsi: 'Indeks bahaya tanah longsor', url: `${BNPB}/inarisk/layer_bahaya_tanah_longsor/ImageServer`, opacity: 0.58, kelompok: 'Bahaya' },
  { id: 'forestFire', nama: 'Bahaya Karhutla', deskripsi: 'Kebakaran hutan dan lahan (karhutla)', url: `${BNPB}/inarisk/layer_bahaya_kebakaran_hutan_dan_lahan/ImageServer`, opacity: 0.58, kelompok: 'Bahaya' },
  { id: 'volcano', nama: 'Bahaya Letusan Gunung Api', deskripsi: 'Kawasan bahaya letusan gunung api', url: `${BNPB}/inarisk/layer_bahaya_letusan_gunungapi/ImageServer`, opacity: 0.6, kelompok: 'Bahaya' },
  { id: 'drought', nama: 'Bahaya Kekeringan', deskripsi: 'Indeks bahaya kekeringan', url: `${BNPB}/inarisk/layer_bahaya_kekeringan/ImageServer`, opacity: 0.55, kelompok: 'Bahaya' },
  { id: 'extremeWeather', nama: 'Bahaya Cuaca Ekstrem', deskripsi: 'Indeks bahaya cuaca ekstrem (angin kencang, hujan lebat)', url: `${BNPB}/inarisk/layer_bahaya_cuaca_ekstrim/ImageServer`, opacity: 0.55, kelompok: 'Bahaya' },
  { id: 'wave', nama: 'Bahaya Gelombang Ekstrem & Abrasi', deskripsi: 'Gelombang tinggi dan pengikisan pantai (abrasi)', url: `${BNPB}/inarisk/layer_bahaya_gelombang_ekstrim_dan_abrasi/ImageServer`, opacity: 0.6, kelompok: 'Bahaya' },
  { id: 'liquefaction', nama: 'Bahaya Likuefaksi', deskripsi: 'Tanah kehilangan kekuatan saat gempa (likuefaksi)', url: `${BNPB}/inarisk/layer_bahaya_likuefaksi/ImageServer`, opacity: 0.6, kelompok: 'Bahaya' },
  { id: 'multi', nama: 'Multi Bahaya', deskripsi: 'Gabungan indeks beberapa jenis bahaya', url: `${BNPB}/inarisk/layer_bahaya_multi/ImageServer`, opacity: 0.55, kelompok: 'Bahaya' },
  { id: 'hillshade', nama: 'Hillshade (Relief)', deskripsi: 'Bayangan relief permukaan bumi', url: `${BNPB}/Basemap/Indo_Hillshade/MapServer`, opacity: 0.45, kelompok: 'Konteks' },
  { id: 'population', nama: 'Kepadatan Penduduk 2020', deskripsi: 'Kepadatan penduduk per wilayah (2020)', url: `${BNPB}/Basemap/Kepadatan_penduduk_2020/MapServer`, opacity: 0.5, kelompok: 'Konteks' },
]
export type BnpbStatus = { state: 'loading' | 'ok' | 'error'; message?: string }

export const OPEN_DATA_APIS: OpenDataApi[] = [
  {
    id: 'hazards',
    nama: 'Gempa & Bencana Terkini',
    icon: '🌧️',
    kategori: 'Lapisan peta intelijen',
    deskripsi: 'Gempa bumi terbaru di Indonesia (BMKG, cadangan USGS) dan peringatan bencana global untuk Indonesia: banjir, gunung api, siklon, kekeringan, kebakaran (GDACS).',
    manfaat: 'Membaca ancaman yang sedang berlangsung di sekitar wilayah kejadian krisis kesehatan.',
    proxy: '/api/v1/map-layers/hazards',
    itemKey: 'events',
    upstream: [
      { nama: 'Gempa terkini M5+ & gempa dirasakan', penyedia: 'BMKG', url: 'https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json', format: 'JSON', catatan: 'Kadang menolak akses dari luar Indonesia (403)' },
      { nama: 'Peringatan bencana GDACS (Indonesia)', penyedia: 'GDACS · Uni Eropa & PBB', url: 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=EQ;FL;VO;TC;DR;WF&country=Indonesia', format: 'GeoJSON' },
      { nama: 'Katalog gempa USGS (wilayah Indonesia)', penyedia: 'USGS', url: 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minlatitude=-11&maxlatitude=6&minlongitude=94&maxlongitude=141&minmagnitude=4.5', format: 'GeoJSON', catatan: 'Cadangan bila BMKG tidak bisa diakses' },
    ],
    pembaruan: 'Tiap 10 menit (cache proxy)',
  },
  {
    id: 'fires',
    nama: 'Titik Panas Kebakaran (NASA FIRMS)',
    icon: '🔥',
    kategori: 'Lapisan peta intelijen',
    deskripsi: 'Titik panas (anomali suhu) dari satelit VIIRS 24 jam terakhir di wilayah Indonesia.',
    manfaat: 'Menandai potensi kebakaran hutan dan lahan yang dapat memicu gangguan pernapasan (ISPA).',
    proxy: '/api/v1/map-layers/fires',
    itemKey: 'hotspots',
    upstream: [
      { nama: 'VIIRS NOAA-20 Asia Tenggara 24 jam', penyedia: 'NASA FIRMS', url: 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_SouthEast_Asia_24h.csv', format: 'CSV' },
      { nama: 'VIIRS Suomi NPP Asia Tenggara 24 jam', penyedia: 'NASA FIRMS', url: 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_SouthEast_Asia_24h.csv', format: 'CSV' },
    ],
    pembaruan: 'Tiap 30 menit (cache proxy)',
  },
  {
    id: 'wind',
    nama: 'Aliran Angin (GFS)',
    icon: '🌬️',
    kategori: 'Konteks peta',
    deskripsi: 'Komponen angin u/v model cuaca global GFS (NOAA), ditampilkan sebagai partikel angin bergerak (animasi, seperti ABVC).',
    manfaat: 'Membaca arah sebaran asap kebakaran atau abu vulkanik.',
    proxy: '/wind-data',
    upstream: [
      { nama: 'GFS wind u/v (via Opsroom)', penyedia: 'NOAA NCEP · Opsroom SIPONGI', url: 'https://opsroom.sipongidata.my.id/api/gfs', format: 'JSON (GRIB2)' },
    ],
    pembaruan: 'Tiap 5 menit (cache proxy)',
  },
  {
    id: 'bnpb',
    nama: 'BNPB InaRISK (peta bahaya)',
    icon: '🛰️',
    kategori: 'Konteks peta',
    deskripsi: 'Peta indeks bahaya InaRISK dari BNPB (Badan Nasional Penanggulangan Bencana): banjir, banjir bandang, gempa, tsunami, longsor, karhutla, gunung api, kekeringan, cuaca ekstrem, gelombang/abrasi, likuefaksi, multi bahaya, serta hillshade dan kepadatan penduduk. Tiap lapisan punya tombol aktif/nonaktif di Pengaturan Lapisan.',
    manfaat: 'Membandingkan lokasi kejadian krisis kesehatan dengan zona bahaya resmi.',
    proxy: '/api/v1/map-layers/bnpb',
    itemKey: 'layers',
    upstream: BNPB_LAYERS.map((l) => ({ nama: l.nama, penyedia: 'BNPB InaRISK', url: l.url, format: l.url.endsWith('ImageServer') ? 'ArcGIS ImageServer (PNG)' : 'ArcGIS MapServer (PNG)' })),
    pembaruan: 'Mengikuti BNPB (data statis, dicek tiap 1 jam)',
  },
  {
    id: 'basemap',
    nama: 'Peta Dasar',
    icon: '🗺️',
    kategori: 'Konteks peta',
    deskripsi: 'Ubin peta OpenStreetMap (lewat proxy aplikasi), citra satelit Esri, dan peta topografi OpenTopoMap.',
    manfaat: 'Latar peta untuk semua lapisan.',
    proxy: '/osm-tiles/5/25/16.png',
    upstream: [
      { nama: 'OpenStreetMap tiles', penyedia: 'OpenStreetMap', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', format: 'PNG' },
      { nama: 'World Imagery', penyedia: 'Esri', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', format: 'JPEG' },
      { nama: 'OpenTopoMap', penyedia: 'OpenTopoMap', url: 'https://tile.opentopomap.org/{z}/{x}/{y}.png', format: 'PNG' },
    ],
    pembaruan: 'Mengikuti penyedia',
  },
]

export const INTEL_LAYER_APIS = OPEN_DATA_APIS.filter((a) => a.kategori === 'Lapisan peta intelijen') as (OpenDataApi & { id: IntelLayerId })[]

export type IntelStatus = { state: 'loading' | 'ok' | 'empty' | 'error'; count?: number; message?: string; sumber?: string; at?: string }

/** API resmi Pusat Krisis Kesehatan yang dipakai langsung (token hanya di server, keluaran agregat). */
export type OfficialApi = {
  id: 'asistensi' | 'psc' | 'panggilan' | 'tck' | 'eoc' | 'logistik' | 'ncc'
  nama: string
  icon: string
  deskripsi: string
  dipakai: string
  proxy: string
  upstream: { nama: string; metode: string; url: string; parameter: string }[]
  belum?: string
}
export const OFFICIAL_APIS: OfficialApi[] = [
  {
    id: 'ncc',
    nama: 'NCC 119 — Pusat Panggilan Nasional (Apps Script)',
    icon: '☎️',
    deskripsi: 'Rekap panggilan 119 nasional per hari dan per 30 menit: panggilan masuk, terjawab, tak terjawab, tingkat layanan, rata-rata penanganan (AHT) dan kecepatan menjawab (ASA).',
    dipakai: 'Halaman Panggilan 119, KPI Ringkasan (tingkat keberhasilan layanan), tren NCC di Kartu Eksekutif, Matriks Panggilan Darurat 119 Harian, linimasa.',
    proxy: '/api/puskris/live/ncc',
    upstream: [
      { nama: 'Web App Apps Script (spreadsheet "Puskris – Data NCC 119 (API)")', metode: 'GET (kunci server PUSKRIS_NCC_KEY)', url: 'PUSKRIS_NCC_URL …/exec?action=ringkasan|meta|harian|interval|per_jam', parameter: 'tanggal1, tanggal2 (YYYY-MM-DD); data hanya nasional' },
    ],
    belum: 'Sumber laporan interval pusat panggilan tidak memuat provinsi, kategori panggilan, atau data penelepon; jadi filter provinsi tidak berlaku. Bila PUSKRIS_NCC_URL belum diatur, bagian NCC menampilkan "belum terhubung" (tanpa angka cadangan).',
  },
  {
    id: 'logistik',
    nama: 'Logistik Kesehatan (SIMLOGKES)',
    icon: '📦',
    deskripsi: 'Stok akhir per gudang regional dan kategori (obat, bahan medis habis pakai, alat kesehatan, sarana prasarana, lainnya), unit masuk/keluar, barang kedaluwarsa, dan pergerakan stok bulanan (sampel).',
    dipakai: 'Halaman Logistik, KPI Ringkasan (buffer logistik per regional penanggung provinsi), variabel peta Stok logistik regional, Kartu Kejadian Terpadu, radius dukungan.',
    proxy: '/api/puskris/live/logistik',
    upstream: [
      { nama: 'Data regional (11 gudang + provinsi yang dilayani)', metode: 'POST (kueri baca)', url: 'https://pusatkrisis.kemkes.go.id/logistik/web_api/v1/data-regional', parameter: 'id_regional (kosong = semua)' },
      { nama: 'Data stok logistik', metode: 'POST (kueri baca)', url: 'https://pusatkrisis.kemkes.go.id/logistik/web_api/v1/data-stok-logistik', parameter: 'id_regional (kosong = hanya Pusat, jadi dipanggil 11×)' },
      { nama: 'Pergerakan stok', metode: 'POST (kueri baca)', url: 'https://pusatkrisis.kemkes.go.id/logistik/web_api/v1/pergerakan-stok', parameter: 'id_barang (= kode_barang.id), id_regional, id_asal_pengirim — ketiganya wajib; dipanggil untuk 10 barang teratas per regional (≈)' },
    ],
    belum: 'Nama/telepon/email penanggung jawab, alamat gudang, foto barang, dan petugas logistik dibuang di server. Gudang tidak punya koordinat, jadi peta memakai arsiran provinsi menurut regional penanggung. Satuan barang campuran (tablet, box, unit) dijumlahkan apa adanya.',
  },
  {
    id: 'eoc',
    nama: 'EOC Pusat Krisis — data kejadian bencana',
    icon: '🌋',
    deskripsi: 'Seluruh kejadian bencana/krisis tahun berjalan per kejadian: jenis, tanggal, provinsi, kab/kota, status krisis, korban (meninggal, hilang, LB/RI, LR/RJ, pengungsi), penduduk terdampak, faskes rusak, dan koordinat.',
    dipakai: 'Situasi Krisis, KPI Ringkasan & Dampak Penduduk (mengikuti filter periode, provinsi, kab/kota, jenis), tren bulanan, peta arsiran & titik Kejadian Terbaru, Spatial Mode, Matriks Kejadian Bencana & Daftar Laporan Kejadian.',
    proxy: '/api/puskris/live/eoc',
    upstream: [
      { nama: 'Data kejadian (data_krisis)', metode: 'GET (Basic Auth server)', url: 'https://pusatkrisis.kemkes.go.id/eoc/api/detail_bencana/data_krisis.php', parameter: 'tanggal1, tanggal2 (YYYY-MM-DD), prov (kode 2 digit), kab (kode 4 digit); diambil per bulan' },
      { nama: 'Master jenis bencana', metode: 'GET (Basic Auth server)', url: 'https://pusatkrisis.kemkes.go.id/eoc/api/detail_bencana/jenis_bencana.php', parameter: '–' },
    ],
    belum: 'bencana_detail.php (deskripsi teks bebas, pos pengungsi, faskes terdampak) tidak dipakai. Tren 5 tahun dihitung dari data_krisis per tahun (cache 6 jam). Array "perkembangan" dibuang karena membengkak dan tidak konsisten.',
  },
  {
    id: 'asistensi',
    nama: 'Asistensi Risiko — rekapitulasi',
    icon: '🛡️',
    deskripsi: 'Poin dan status kapasitas serta status Indeks Risiko Bencana Indonesia (IRBI) untuk 38 provinsi dan 514 kabupaten/kota.',
    dipakai: 'Halaman Asistensi Risiko, variabel peta Poin Kapasitas Asistensi, Indeks Kesenjangan, Kartu Kejadian Terpadu, peringatan otomatis, Matriks Asistensi.',
    proxy: '/api/puskris/live/asistensi',
    upstream: [
      { nama: 'Rekapitulasi provinsi', metode: 'POST (kueri baca)', url: 'https://pusatkrisis.kemkes.go.id/asistensi/web_api/v1/rekapitulasi-asistensi-provinsi', parameter: 'tahun, kd_prop (kosong = semua), id_user_level' },
      { nama: 'Rekapitulasi kabupaten/kota', metode: 'POST (kueri baca)', url: 'https://pusatkrisis.kemkes.go.id/asistensi/web_api/v1/rekapitulasi-asistensi-kabupaten', parameter: 'tahun, kd_kab (kosong = semua), id_user_level' },
    ],
    belum: 'Kelengkapan per modul (Profil Umum, Kerentanan, Ancaman, Kapasitas) belum ada di API, jadi ditampilkan "Data belum tersedia dari API". Endpoint SSO (auth-prov, auth-kab) sengaja tidak dipanggil.',
  },
  {
    id: 'psc',
    nama: 'PSC 119 — master data',
    icon: '🚑',
    deskripsi: 'Daftar PSC 119 beserta armada ambulans, personel, rumah sakit jejaring, dan anggaran; diringkas per provinsi di server.',
    dipakai: 'Layanan Gawat Darurat (PSC, Ambulans), KPI Ringkasan, peta (PSC aktif, ambulans), Radius Dukungan dari koordinat PSC & rumah sakit asli, Matriks PSC.',
    proxy: '/api/puskris/live/psc',
    upstream: [
      { nama: 'Data PSC (berisi ambulans, personel, RS, anggaran)', metode: 'POST (kueri baca)', url: 'https://psc.kemkes.go.id/web_api/v1/data-psc', parameter: 'kode_psc, kd_prop, kd_kab, kepemilikan, status, page, per_page' },
      { nama: 'Data ambulans (total terdaftar)', metode: 'POST (kueri baca)', url: 'https://psc.kemkes.go.id/web_api/v1/data-ambulan-psc', parameter: 'kode_psc, page, per_page' },
      { nama: 'Data rumah sakit/sarana (total terdaftar)', metode: 'POST (kueri baca)', url: 'https://psc.kemkes.go.id/web_api/v1/data-rumahsakit-sarana', parameter: 'kode_psc, page, per_page' },
    ],
    belum: 'Nama, telepon, alamat, plat nomor, dan data personel perorangan dibuang di server; yang dikirim ke browser hanya hitungan dan koordinat fasilitas.',
  },
  {
    id: 'panggilan',
    nama: 'PSC 119 — pelaporan panggilan',
    icon: '📞',
    deskripsi: 'Jumlah panggilan tahun berjalan per provinsi dan yang selesai ditangani, ditambah sampel ±3.500 laporan terbaru untuk rekap harian, jenis, sumber, dan jam.',
    dipakai: 'KPI Panggilan PSC 119, peta panggilan per provinsi, Matriks Panggilan (PSC harian, provinsi × jenis).',
    proxy: '/api/puskris/live/panggilan',
    upstream: [
      { nama: 'Data pelaporan panggilan', metode: 'POST (kueri baca)', url: 'https://psc.kemkes.go.id/web_api/v1/data-pelaporan-panggilan', parameter: 'kode_psc, kd_prop, kd_kab, status_penanganan, tahun, page, per_page' },
    ],
    belum: 'API tidak punya filter tanggal/kategori, jadi rekap harian dan per jenis hanya dari sampel laporan terbaru. Data pelapor/korban tidak pernah dikirim ke browser.',
  },
  {
    id: 'tck',
    nama: 'Tenaga Cadangan Kesehatan (TCK)',
    icon: '🧑‍⚕️',
    deskripsi: 'Total relawan, tim, dan Tim Medis Darurat (EMT) beserta tren pendaftaran; relawan per provinsi menurut profesi, jenis kelamin, usia, dan kab/kota; tim dan EMT per provinsi dengan standar, SK, dan waktu respons.',
    dipakai: 'Halaman Tenaga Cadangan, KPI Ringkasan (individu, tim, EMT per wilayah), peta (tenaga cadangan, tim, EMT), Radius Dukungan, Kartu Kejadian Terpadu, Matriks Tenaga Cadangan (komposisi, profesi, tim & EMT, kab/kota).',
    proxy: '/api/puskris/live/tck',
    upstream: [
      { nama: 'Dashboard (total & tren pendaftaran)', metode: 'POST (kueri baca)', url: 'https://tenagacadangankesehatan.kemkes.go.id/web/web_api/v1/dashboard-all', parameter: 'kd_prop, jenis_tenaga (saat ini diabaikan API, selalu nasional)' },
      { nama: 'Data Tim Medis Darurat (EMT)', metode: 'POST (kueri baca)', url: 'https://tenagacadangankesehatan.kemkes.go.id/web/web_api/v1/data-emt', parameter: 'kd_prop, kd_kab (kosong = semua)' },
      { nama: 'Data tim relawan', metode: 'POST (kueri baca)', url: 'https://tenagacadangankesehatan.kemkes.go.id/web/web_api/v1/data-tim', parameter: 'kd_prop, kd_kab (kosong = semua)' },
      { nama: 'Relawan TCK (per provinsi)', metode: 'POST (kueri baca)', url: 'https://tenagacadangankesehatan.kemkes.go.id/web/web_api/v1/relawan-tck', parameter: 'kd_prop (wajib, dipanggil 38×), kd_kab' },
    ],
    belum: 'Nama, NIK, telepon, email, alamat, foto, dan koordinat perorangan/tim dibuang di server; ke browser hanya hitungan. Endpoint sertifikat/kegiatan per NIK dan data-individu tidak dipanggil. Pengalaman & pelatihan per provinsi belum tersedia.',
  },
]

/** Lapisan peta dari API resmi (Pengaturan Peta → API Internal) dan lapisan Risiko yang menunggu data. */
export const INTERNAL_MAP_LAYERS = [
  { id: 'psc', nama: 'Titik PSC 119', sumber: 'API PSC 119 · data-psc (latitude/longitude PSC; koordinat bawaan yang dipakai banyak PSC diganti pusat kab/kota)', proxy: '/api/puskris/live/psc', isi: 'Nama PSC, kab/kota, provinsi, status aktif, jumlah ambulans (dan yang siap), personel, RS jejaring. Tanpa pimpinan, telepon, email, alamat.', status: 'langsung' },
  { id: 'ambulans', nama: 'Titik Ambulans (siap / aktif)', sumber: 'API PSC 119 · data-psc → data_ambulan_psc (latitude/longitude ambulans)', proxy: '/api/puskris/live/psc', isi: 'Jenis, kondisi, status aktif, PSC induk. Ambulans tanpa koordinat diletakkan di lokasi PSC induk (atau pusat kab/kota) dan ditandai garis putus-putus. Tanpa plat nomor dan nama petugas.', status: 'langsung' },
  { id: 'panggilan', nama: 'Titik Panggilan 119 (agregat kab/kota)', sumber: 'API PSC 119 · data-pelaporan-panggilan (sampel terbaru)', proxy: '/api/puskris/live/panggilan', isi: 'Jumlah panggilan, gawat darurat, selesai, butuh ambulans per kab/kota. Letak = rata-rata koordinat panggilan (≥ 5 berkoordinat) atau pusat kab/kota. Tidak ada titik penelepon.', status: 'langsung' },
  { id: 'risiko-krisis', nama: 'Risiko Krisis Kesehatan', sumber: 'API Asistensi Risiko (rekapitulasi provinsi & kab/kota)', proxy: '/api/puskris/live/asistensi', isi: 'Status kapasitas dan status IRBI (Indeks Risiko Bencana Indonesia) per provinsi dan kab/kota.', status: 'langsung' },
  { id: 'risiko-infeksi', nama: 'Risiko Emerging (PIE)', sumber: 'API Peta Risiko PIE Kemenkes (petarisikopie.id)', proxy: '/api/puskris/live/pie', isi: 'Tingkat risiko penyakit infeksi emerging (Polio, MERS, Meningitis, Avian Influenza, COVID-19) per kab/kota dan agregat provinsi.', status: 'langsung' },
] as const
