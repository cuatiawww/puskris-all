import type { KejadianTemplate } from '@/lib/puskris/kejadian-template'

export interface NearbyFacility {
  id: string
  nama: string
  jenis: 'RS' | 'PSC 119' | 'Puskesmas' | 'Faskes'
  kota?: string | null
  lat: number | null
  lon: number | null
  distKm: number | null
  ambulans?: number | null
  sdm?: number | null
  tempatTidur?: number | null
  kontakReady?: boolean
  statusOperasional?: string
}

export interface OsrmRouteResult {
  targetName: string
  targetJenis: string
  distanceKm: number
  durationMin: number
  coordinates: [number, number][] // [lon, lat]
  from: [number, number]
  to: [number, number]
}

export interface PendukungPayload {
  uid: string
  template: KejadianTemplate
  fetchedAt?: string
  eocDetail?: {
    uid: string
    jenis: string
    kelompok: string
    provinsi: string
    provCode: string
    kabupaten: string
    kabCode: string
    kecamatan: string | null
    tanggal: string | null
    tglDisplay: string | null
    jam: string | null
    krisis: number
    korban: number
    terdampak: number
    meninggal: number
    hilang: number
    luka_berat: number
    luka_ringan: number
    pengungsi: number
    faskes_rusak: number
    lat: number | null
    lon: number | null
    lokasiList?: { lat: number; lon: number; kecamatan: string | null }[]
    kronologis: string | null
    facts?: {
      magnitudo: number | null
      kedalamanKm: number | null
      tsunamiStatus: string | null
      feltNote: string | null
      tinggiAirText: string | null
      luasTerbakarText: string | null
      kecamatanText: string | null
    }
    perkembangan?: {
      tanggal: string
      label: string
      terdampak: number
      meninggal: number
      hilang: number
      luka_berat: number
      luka_ringan: number
      pengungsi: number
    }[]
    posPengungsi?: {
      nama: string
      lokasi: string
      pengungsi: number | null
      kk: number | null
      kapasitas: number | null
    }[]
    faskesTerdampak?: {
      nama: string
      jenis: string
      kondisi: string
    }[]
  } | null
  weather?: {
    available: boolean
    mode?: string
    current?: {
      tempC: number | null
      humidityPct: number | null
      rainMm: number | null
      pressureHpa: number | null
      windSpeedKmh: number | null
      windGustsKmh: number | null
      windDirDeg: number | null
      windCompass?: {
        deg: number
        fromCode: string
        fromLabel: string
        toDeg: number
        toCode: string
        toLabel: string
      } | null
      weatherCode: number | null
      weatherLabel: string
    } | null
    eventDayRainMm?: number | null
    rain7dSumMm?: number | null
    daily7d?: {
      date: string
      label: string
      isEventDay?: boolean
      rainSum: number
      precipSum: number
      tempMax: number | null
      tempMin: number | null
      windMax: number | null
      windDir: number | null
      et0: number | null
      weatherCode: number | null
      weatherLabel: string
      severity: 'normal' | 'waspada' | 'ekstrem'
    }[]
    hujanGrid?: { lat: number; lon: number; rainMm: number }[]
  } | null
  airQuality?: {
    available: boolean
    current?: {
      usAqi: number | null
      pm25: number | null
      pm10: number | null
      co: number | null
      so2: number | null
      no2: number | null
      dust: number | null
      uvIndex: number | null
      ispu: number | null
      ispuKategori: string
      ispuBadgeClass: string
    } | null
    daily?: {
      date: string
      label: string
      pm25Max: number
      pm10Max: number
      usAqiMax: number
      coMax: number
      ispu: number | null
      kategori: string
      barColor: string
    }[]
  } | null
  banjir?: {
    glofas?: {
      daily: { date: string; label: string; discharge: number }[]
      currentDischarge: number
      peakDischarge: number
      avgDischarge: number
      medianDischarge: number
      status: string
    } | null
    soil?: {
      topLayer: number
      subLayer: number | null
      saturationPct: number
      status: string
    } | null
    marine?: {
      waveHeightMaxM: number
      wavePeriodMaxS: number | null
    } | null
    petaBencana?: {
      count: number
      maxDepthCm: number | null
      items: {
        id: string
        createdAt: string
        disasterType: string
        floodDepthCm: number | null
        text: string
        distKm: number
        lat: number
        lon: number
      }[]
    } | null
  } | null
  gempa?: {
    bmkgAvailable: boolean
    usgsAvailable: boolean
    autogempaNasional?: any
    mainBmkg?: {
      id: string
      source: string
      timeWib: string
      dateStr: string | null
      dayDiff?: number
      mag: number
      depthKm: number
      place: string
      mmi: string | null
      potensi: string | null
      shakemapFile?: string | null
      shakemapProxyUrl: string | null
      lat: number | null
      lon: number | null
      distKm: number | null
    } | null
    usgsCount: number
    maxMag: number | null
    timeline7d: {
      date: string
      label: string
      isEventDay: boolean
      count: number
      maxMag: number | null
      avgDepthKm: number | null
    }[]
    catalog: {
      id: string
      source: 'BMKG' | 'USGS'
      timeWib: string
      dateStr: string | null
      dayDiff?: number
      mag: number
      depthKm: number
      place: string
      mmi: string | null
      potensi: string | null
      shakemapProxyUrl?: string | null
      lat: number | null
      lon: number | null
      distKm: number | null
    }[]
    gdacsAlerts?: { title: string; alertLevel: string; severity: string; distKm: number | null }[]
    marineWaveMaxM?: number | null
  } | null
  karhutla?: {
    firmsAvailable: boolean
    nasional24h: number
    count24h50km: number
    count24h150km: number
    highConf50km: number
    maxFrp150km: number | null
    points150km: {
      lat: number
      lon: number
      bright: number
      frp: number
      confidence: string
      acqDate: string
      acqTime: string
      satellite: string
      distKm: number
    }[]
    daily7d: {
      date: string
      label: string
      nasional: number
      sekitar150km: number
    }[]
    fireDanger?: {
      level: string
      score: number
      badgeClass: string
      basis: string
    } | null
  } | null
}
