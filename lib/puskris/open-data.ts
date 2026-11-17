/**
 * Daftar API luar (publik, tanpa kunci) yang dipakai lapisan "API Intelijen Eksternal" di peta
 * dan halaman Open Data. Semua dipanggil lewat proxy GET di /api/v1/map-layers/* (server Next.js),
 * sehingga browser tidak terkena CORS dan tidak ada data pribadi yang disimpan.
 */
export type IntelLayerId = 'flights' | 'fires' | 'hazards' | 'wildlife' | 'vectors'

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
    id: 'flights',
    nama: 'Penerbangan Domestik',
    icon: '✈️',
    kategori: 'Lapisan peta intelijen',
    deskripsi: 'Bandara utama Indonesia dan posisi pesawat yang sedang terbang di atas Indonesia (sinyal ADS-B terbuka).',
    manfaat: 'Konteks mobilitas antarwilayah dan akses udara untuk pengiriman tim dan logistik.',
    proxy: '/api/v1/map-layers/flights',
    itemKey: 'flights',
    upstream: [
      { nama: 'Posisi pesawat ADS-B (radius 250 mil laut per titik)', penyedia: 'adsb.lol (komunitas, ODbL)', url: 'https://api.adsb.lol/v2/lat/-6.2/lon/106.8/dist/250', format: 'JSON' },
      { nama: 'Posisi pesawat ADS-B (cadangan)', penyedia: 'adsb.fi Open Data', url: 'https://opendata.adsb.fi/api/v2/lat/-6.2/lon/106.8/dist/250', format: 'JSON' },
      { nama: 'Daftar bandara utama', penyedia: 'Pusat Krisis Kesehatan (statis)', url: '/api/v1/map-layers/flight-airports', format: 'JSON' },
    ],
    pembaruan: 'Tiap 1 menit (cache proxy)',
  },
  {
    id: 'wildlife',
    nama: 'Satwa Liar / Burung (GBIF)',
    icon: '🦅',
    kategori: 'Lapisan peta intelijen',
    deskripsi: 'Catatan pengamatan burung liar (kelas Aves) terbaru di Indonesia dari Global Biodiversity Information Facility.',
    manfaat: 'Konteks pemantauan risiko flu burung (Avian Influenza) di sekitar wilayah krisis.',
    proxy: '/api/v1/map-layers/wildlife',
    itemKey: 'results',
    upstream: [
      { nama: 'Occurrence search, Aves, Indonesia', penyedia: 'GBIF', url: 'https://api.gbif.org/v1/occurrence/search?country=ID&classKey=212&hasCoordinate=true&limit=300', format: 'JSON' },
    ],
    pembaruan: 'Tiap 6 jam (cache proxy)',
  },
  {
    id: 'vectors',
    nama: 'Vektor Nyamuk (iNaturalist)',
    icon: '🦟',
    kategori: 'Lapisan peta intelijen',
    deskripsi: 'Pengamatan nyamuk (famili Culicidae, termasuk Aedes dan Anopheles) terbaru di Indonesia dari iNaturalist.',
    manfaat: 'Konteks risiko penyakit tular vektor (demam berdarah, malaria) di lokasi pengungsian.',
    proxy: '/api/v1/map-layers/vectors',
    itemKey: 'sightings',
    upstream: [
      { nama: 'Observations, Culicidae, Indonesia', penyedia: 'iNaturalist', url: 'https://api.inaturalist.org/v1/observations?place_id=6966&taxon_id=52134&geo=true&per_page=200&order_by=observed_on', format: 'JSON' },
    ],
    pembaruan: 'Tiap 6 jam (cache proxy)',
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
  id: 'asistensi' | 'psc' | 'panggilan'
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
    belum: 'Kelengkapan per modul (Profil Umum, Kerentanan, Ancaman, Kapasitas) belum ada di API, masih snapshot. Endpoint SSO (auth-prov, auth-kab) sengaja tidak dipanggil.',
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
]
