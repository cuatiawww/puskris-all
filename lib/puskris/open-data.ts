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
  id: IntelLayerId | 'wind' | 'basemap'
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
    deskripsi: 'Komponen angin u/v model cuaca global GFS (NOAA), ditampilkan sebagai panah arah angin.',
    manfaat: 'Membaca arah sebaran asap kebakaran atau abu vulkanik.',
    proxy: '/wind-data',
    upstream: [
      { nama: 'GFS wind u/v (via Opsroom)', penyedia: 'NOAA NCEP · Opsroom SIPONGI', url: 'https://opsroom.sipongidata.my.id/api/gfs', format: 'JSON (GRIB2)' },
    ],
    pembaruan: 'Tiap 5 menit (cache proxy)',
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
