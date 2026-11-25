/**
 * Agregasi data pendukung real-time per kejadian dari API resmi pemerintah & terbuka (sisi server):
 * - EOC detail_bencana/bencana_detail.php?uid= (disanitasi: tanpa PII/HP/email/HTML mentah)
 * - Open-Meteo Weather & Historical H-3..H+3 + 3x3 grid hujan
 * - Open-Meteo Air Quality (PM2.5 -> ISPU KLHK, US AQI, CO, SO2, PM10, Debu, UV)
 * - Banjir: GloFAS River Discharge, Soil Moisture (saturation%), Marine Waves, PetaBencana.id (<=100km)
 * - Gempa: BMKG (autogempa, gempaterkini, gempadirasakan + Shakemap proxy), USGS FDSN aftershocks/7d, GDACS
 * - Karhutla: NASA FIRMS VIIRS 24j & 7h (50/150km + nasional), Arah plume angin, Fire danger, opsional GAS Karhutla
 */

import Papa from 'papaparse'
import { getEocAuth } from './puskris-auth-config'
import { persist, REVALIDATE } from './persist'
import {
  calcKlhkIspuFromPm25,
  haversineKm,
  parseEocNarrativeFacts,
  resolveKejadianTemplate,
  windCardinalId,
  wmoLabel,
  type KejadianTemplate,
} from '@/lib/puskris/kejadian-template'

const EOC_BASE = (process.env.PUSKRIS_EOC_BASE || 'https://pusatkrisis.kemkes.go.id/eoc/api/detail_bencana').replace(/\/$/, '')
const UA = 'PusatKrisisKemkes-EOC/1.0'

function sanitizeText(raw: any): string {
  const s = String(raw || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/(?:\+62|62|0)8[1-9][0-9\-\s]{6,12}/g, '[kontak disensor]')
    .replace(/\b\d{16}\b/g, '[nik disensor]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email disensor]')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return s
}

function numOrNull(v: any): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function num0(v: any): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// haversineKm diimpor dari @/lib/puskris/kejadian-template
export { haversineKm }

function addDaysIso(iso: string, delta: number): string {
  const base = /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : new Date().toISOString().slice(0, 10)
  const d = new Date(`${base}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

function shortDayId(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
  return `${days[d.getUTCDay()]} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

async function fetchJson(url: string, timeoutMs = 8000, headers: Record<string, string> = {}) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': UA, ...headers },
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function fetchText(url: string, timeoutMs = 9000) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA },
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

/** Ambil detail aman dari EOC bencana_detail.php?uid=... */
export async function fetchSafeEocDetail(uid: string) {
  const cleanUid = String(uid || '').trim()
  if (!cleanUid) return null
  const auth = getEocAuth()
  if (!auth) return null
  try {
    return await persist(
      ['eoc-detail-safe-v1', cleanUid],
      async () => {
        const j = await fetchJson(`${EOC_BASE}/bencana_detail.php?uid=${encodeURIComponent(cleanUid)}`, 12_000, {
          Authorization: `Basic ${Buffer.from(auth).toString('base64')}`,
        })
        if (!j || j.sukses === 0 || !j.data) return null
        const d = j.data
        const lokasiList = (Array.isArray(d.lokasi) ? d.lokasi : [])
          .map((l: any) => {
            const lat = numOrNull(l?.latitude)
            const lon = numOrNull(l?.longitude)
            if (lat == null || lon == null || lat <= -12 || lat >= 7 || lon <= 94 || lon >= 142) return null
            const rawHtml = sanitizeText(l?.content_html || '')
            const kecM = rawHtml.match(/kecamatan(?:\s+terdampak)?\s*:\s*([^\n]+)/i)
            return {
              lat: Math.round(lat * 1e5) / 1e5,
              lon: Math.round(lon * 1e5) / 1e5,
              kecamatan: kecM ? kecM[1].replace(/tgl kejadian.*$/i, '').trim() : null,
            }
          })
          .filter(Boolean) as { lat: number; lon: number; kecamatan: string | null }[]

        const mTgl = /^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}:\d{2}))?/.exec(String(d.tgl_kejadian || '').trim())
        const tanggal = mTgl ? `${mTgl[3]}-${mTgl[2]}-${mTgl[1]}` : String(d.tgl_kejadian_notimezone || '').slice(0, 10) || null
        const jam = mTgl?.[4] || (String(d.tgl_kejadian_notimezone || '').slice(11, 16) || null)

        const kronologis = sanitizeText(d.deskripsi_bencana || '')
        const kecamatanRaw = sanitizeText(d.kecamatan || '') || lokasiList.map((x) => x.kecamatan).filter(Boolean).join(', ')
        const perkembangan = (Array.isArray(d.perkembangan) ? d.perkembangan : []).map((p: any) => ({
          tanggal: String(p?.tgl_simple || '').trim(),
          label: sanitizeText(p?.tgl_laporan || p?.tgl_simple || ''),
          terdampak: num0(p?.penduduk_terdampak),
          meninggal: num0(p?.meninggal),
          hilang: num0(p?.hilang),
          luka_berat: num0(p?.luka_berat),
          luka_ringan: num0(p?.luka_ringan),
          pengungsi: num0(p?.pengungsi),
        }))

        const posPengungsi = (Array.isArray(d.pos_pengungsi) ? d.pos_pengungsi : []).map((p: any, idx: number) => ({
          nama: sanitizeText(p?.nama_pos || p?.nama || `Pos Pengungsi ${idx + 1}`),
          lokasi: sanitizeText(p?.alamat || p?.lokasi || p?.desa || ''),
          pengungsi: numOrNull(p?.jml_pengungsi ?? p?.jumlah_pengungsi ?? p?.pengungsi),
          kk: numOrNull(p?.jml_kk ?? p?.kk),
          kapasitas: numOrNull(p?.kapasitas),
        }))

        const faskesTerdampak = (Array.isArray(d.faskes_terdampak) ? d.faskes_terdampak : []).map((f: any, idx: number) => ({
          nama: sanitizeText(f?.nama_faskes || f?.nama || `Faskes ${idx + 1}`),
          jenis: sanitizeText(f?.jenis_faskes || f?.jenis || ''),
          kondisi: sanitizeText(f?.kondisi || f?.status || f?.keterangan || ''),
        }))

        return {
          uid: String(d.uid || cleanUid),
          jenis: String(d.nama_bencana || 'Lainnya').trim(),
          kelompok: String(d.jenis_bencana || 'Lainnya').trim(),
          provinsi: String(d.provinsi || '').trim(),
          provCode: String(d.provinsi_dagri || '').trim().padStart(2, '0'),
          kabupaten: String(d.kabupaten || '').trim(),
          kabCode: String(d.kabupaten_dagri || '').trim(),
          kecamatan: kecamatanRaw || null,
          tanggal,
          tglDisplay: String(d.tgl_kejadian || '').trim() || null,
          jam,
          krisis: num0(d.status_krisis) ? 1 : 0,
          korban: num0(d.jml_korban),
          terdampak: num0(d.penduduk_terdampak),
          meninggal: num0(d.meninggal),
          hilang: num0(d.hilang),
          luka_berat: num0(d.luka_berat),
          luka_ringan: num0(d.luka_ringan),
          pengungsi: num0(d.pengungsi),
          faskes_rusak: num0(d.jml_faskes_rusak),
          lat: lokasiList[0]?.lat ?? null,
          lon: lokasiList[0]?.lon ?? null,
          lokasiList,
          kronologis: kronologis || null,
          facts: parseEocNarrativeFacts(kronologis, kecamatanRaw),
          perkembangan,
          posPengungsi,
          faskesTerdampak,
        }
      },
      REVALIDATE.singkat,
      ['eoc'],
    )
  } catch {
    return null
  }
}

async function fetchWeatherSupport(lat: number, lon: number, tanggal?: string | null) {
  const today = new Date().toISOString().slice(0, 10)
  const evDate = tanggal && /^\d{4}-\d{2}-\d{2}/.test(tanggal) ? tanggal.slice(0, 10) : today
  const daysAgo = Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${evDate}T00:00:00Z`)) / 86_400_000)

  const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,rain,precipitation,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,rain_sum,wind_speed_10m_max,wind_direction_10m_dominant,weather_code,et0_fao_evapotranspiration&past_days=6&forecast_days=4&timezone=Asia%2FJakarta`

  // Untuk kejadian historis (> 6 hari lalu), ambil juga jendela H-3..H+3 dari arsip Open-Meteo
  const useArchive = daysAgo > 6
  const archStart = addDaysIso(evDate, -3)
  const archEndRaw = addDaysIso(evDate, 3)
  const archEnd = archEndRaw > addDaysIso(today, -1) ? addDaysIso(today, -1) : archEndRaw
  const archiveUrl = useArchive
    ? `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${archStart}&end_date=${archEnd}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,rain_sum,wind_speed_10m_max,wind_direction_10m_dominant,weather_code,et0_fao_evapotranspiration&timezone=Asia%2FJakarta`
    : null

  // 3x3 kisi curah hujan (~15 km) untuk peta lokal
  const d = 0.14
  const gridCoords: [number, number][] = []
  for (const dy of [-d, 0, d]) for (const dx of [-d, 0, d]) {
    gridCoords.push([Math.round((lat + dy) * 1e4) / 1e4, Math.round((lon + dx) * 1e4) / 1e4])
  }
  const gridUrl = `https://api.open-meteo.com/v1/forecast?latitude=${gridCoords.map((c) => c[0]).join(',')}&longitude=${gridCoords.map((c) => c[1]).join(',')}&daily=precipitation_sum,rain_sum&past_days=2&forecast_days=1&timezone=Asia%2FJakarta`

  const [fcRes, archRes, gridRes] = await Promise.allSettled([
    fetchJson(forecastUrl, 8000),
    archiveUrl ? fetchJson(archiveUrl, 8000) : Promise.resolve(null),
    fetchJson(gridUrl, 7000),
  ])

  const fc = fcRes.status === 'fulfilled' ? fcRes.value : null
  const arch = archRes.status === 'fulfilled' ? archRes.value : null
  const grid = gridRes.status === 'fulfilled' ? gridRes.value : null

  const dailySource = arch?.daily?.time?.length ? arch.daily : fc?.daily
  const daily7d: any[] = []
  if (dailySource?.time?.length) {
    for (let i = 0; i < dailySource.time.length; i++) {
      const dt = String(dailySource.time[i])
      const wc = numOrNull(dailySource.weather_code?.[i])
      const wInfo = wmoLabel(wc)
      daily7d.push({
        date: dt,
        label: shortDayId(dt),
        isEventDay: dt === evDate,
        rainSum: numOrNull(dailySource.rain_sum?.[i]) ?? 0,
        precipSum: numOrNull(dailySource.precipitation_sum?.[i]) ?? 0,
        tempMax: numOrNull(dailySource.temperature_2m_max?.[i]),
        tempMin: numOrNull(dailySource.temperature_2m_min?.[i]),
        windMax: numOrNull(dailySource.wind_speed_10m_max?.[i]),
        windDir: numOrNull(dailySource.wind_direction_10m_dominant?.[i]),
        et0: numOrNull(dailySource.et0_fao_evapotranspiration?.[i]),
        weatherCode: wc,
        weatherLabel: wInfo.label,
        severity: wInfo.severity,
      })
    }
  }

  const recent7 = daily7d.slice(0, 7)
  const rain7dSum = Math.round(recent7.reduce((s, r) => s + (r.precipSum ?? r.rainSum ?? 0), 0) * 10) / 10
  const eventRow = recent7.find((r) => r.isEventDay) || recent7[recent7.length - 1] || null
  const cur = fc?.current || null
  const curWc = numOrNull(cur?.weather_code)

  const hujanGrid = Array.isArray(grid)
    ? grid.map((cell: any, idx: number) => ({
        lat: gridCoords[idx][0],
        lon: gridCoords[idx][1],
        rainMm: Math.round(((cell?.daily?.precipitation_sum || []).reduce((a: number, b: any) => a + (Number(b) || 0), 0)) * 10) / 10,
      }))
    : []

  return {
    available: Boolean(fc || arch),
    mode: arch?.daily?.time?.length ? 'archive_event_week' : 'forecast_recent',
    current: cur
      ? {
          tempC: numOrNull(cur.temperature_2m),
          humidityPct: numOrNull(cur.relative_humidity_2m),
          rainMm: numOrNull(cur.rain) ?? numOrNull(cur.precipitation),
          pressureHpa: numOrNull(cur.surface_pressure),
          windSpeedKmh: numOrNull(cur.wind_speed_10m),
          windGustsKmh: numOrNull(cur.wind_gusts_10m),
          windDirDeg: numOrNull(cur.wind_direction_10m),
          windCompass: windCardinalId(cur.wind_direction_10m),
          weatherCode: curWc,
          weatherLabel: wmoLabel(curWc).label,
        }
      : null,
    eventDayRainMm: eventRow ? (eventRow.precipSum ?? eventRow.rainSum ?? 0) : null,
    rain7dSumMm: recent7.length ? rain7dSum : null,
    daily7d: recent7,
    hujanGrid,
  }
}

async function fetchAirQualitySupport(lat: number, lon: number) {
  try {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm2_5,pm10,carbon_monoxide,sulphur_dioxide,nitrogen_dioxide,dust,uv_index&hourly=us_aqi,pm2_5,pm10,carbon_monoxide&past_days=5&forecast_days=2&timezone=Asia%2FJakarta`
    const j = await fetchJson(url, 8000)
    const cur = j?.current || {}
    const pm25 = numOrNull(cur.pm2_5)
    const ispuInfo = calcKlhkIspuFromPm25(pm25)

    // Kelompokkan hourly menjadi tren harian (maksimum PM2.5 & ISPU harian)
    const byDate = new Map<string, { pm25Max: number; aqiMax: number; pm10Max: number; coMax: number }>()
    const times: string[] = j?.hourly?.time || []
    for (let i = 0; i < times.length; i++) {
      const dt = String(times[i]).slice(0, 10)
      const p25 = Number(j?.hourly?.pm2_5?.[i]) || 0
      const p10 = Number(j?.hourly?.pm10?.[i]) || 0
      const aqi = Number(j?.hourly?.us_aqi?.[i]) || 0
      const co = Number(j?.hourly?.carbon_monoxide?.[i]) || 0
      const curDay = byDate.get(dt) || { pm25Max: 0, aqiMax: 0, pm10Max: 0, coMax: 0 }
      curDay.pm25Max = Math.max(curDay.pm25Max, p25)
      curDay.pm10Max = Math.max(curDay.pm10Max, p10)
      curDay.aqiMax = Math.max(curDay.aqiMax, aqi)
      curDay.coMax = Math.max(curDay.coMax, co)
      byDate.set(dt, curDay)
    }

    const daily = Array.from(byDate.entries()).map(([date, v]) => {
      const dIspu = calcKlhkIspuFromPm25(v.pm25Max)
      return {
        date,
        label: shortDayId(date),
        pm25Max: Math.round(v.pm25Max * 10) / 10,
        pm10Max: Math.round(v.pm10Max * 10) / 10,
        usAqiMax: Math.round(v.aqiMax),
        coMax: Math.round(v.coMax),
        ispu: dIspu.ispu,
        kategori: dIspu.kategori,
        barColor: dIspu.barColor,
      }
    })

    return {
      available: true,
      current: {
        usAqi: numOrNull(cur.us_aqi),
        pm25,
        pm10: numOrNull(cur.pm10),
        co: numOrNull(cur.carbon_monoxide),
        so2: numOrNull(cur.sulphur_dioxide),
        no2: numOrNull(cur.nitrogen_dioxide),
        dust: numOrNull(cur.dust),
        uvIndex: numOrNull(cur.uv_index),
        ispu: ispuInfo.ispu,
        ispuKategori: ispuInfo.kategori,
        ispuBadgeClass: ispuInfo.badgeClass,
      },
      daily,
    }
  } catch {
    return { available: false, current: null, daily: [] }
  }
}

async function fetchBanjirSupport(lat: number, lon: number, tanggal?: string | null) {
  const today = new Date().toISOString().slice(0, 10)
  const evDate = tanggal && /^\d{4}-\d{2}-\d{2}/.test(tanggal) ? tanggal.slice(0, 10) : today
  const daysAgo = Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${evDate}T00:00:00Z`)) / 86_400_000)

  const floodUrl = `https://flood-api.open-meteo.com/v1/flood?latitude=${lat}&longitude=${lon}&daily=river_discharge&past_days=7&forecast_days=5&timezone=Asia%2FJakarta`
  const smDomain = daysAgo > 6 ? 'archive-api.open-meteo.com' : 'api.open-meteo.com'
  const smPath = daysAgo > 6
    ? `v1/archive?latitude=${lat}&longitude=${lon}&start_date=${addDaysIso(evDate, -3)}&end_date=${addDaysIso(today, -1) < addDaysIso(evDate, 2) ? addDaysIso(today, -1) : addDaysIso(evDate, 2)}&hourly=soil_moisture_0_to_7cm,soil_moisture_7_to_28cm&timezone=Asia%2FJakarta`
    : `v1/forecast?latitude=${lat}&longitude=${lon}&hourly=soil_moisture_0_to_1cm,soil_moisture_1_to_3cm,soil_moisture_3_to_9cm&past_days=2&forecast_days=1&timezone=Asia%2FJakarta`
  const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&daily=wave_height_max,wave_period_max,wave_direction_dominant&past_days=2&forecast_days=3&timezone=Asia%2FJakarta`
  const petaBencanaUrl = 'https://data.petabencana.id/reports?timeperiod=604800'

  const [floodRes, smRes, marineRes, pbRes] = await Promise.allSettled([
    fetchJson(floodUrl, 8000),
    fetchJson(`https://${smDomain}/${smPath}`, 8000),
    fetchJson(marineUrl, 7000),
    fetchJson(petaBencanaUrl, 8000),
  ])

  // 1. GloFAS river discharge
  let glofas: any = null
  if (floodRes.status === 'fulfilled' && floodRes.value?.daily?.time?.length) {
    const times: string[] = floodRes.value.daily.time
    const vals: (number | null)[] = floodRes.value.daily.river_discharge || []
    const daily = times
      .map((date, i) => ({ date, label: shortDayId(date), discharge: numOrNull(vals[i]) }))
      .filter((x) => x.discharge != null) as { date: string; label: string; discharge: number }[]
    if (daily.length) {
      const nums = daily.map((x) => x.discharge)
      const sorted = [...nums].sort((a, b) => a - b)
      const peakDischarge = Math.round(Math.max(...nums) * 10) / 10
      const avgDischarge = Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10
      const medianDischarge = Math.round(sorted[Math.floor(sorted.length / 2)] * 10) / 10
      const currentIdx = Math.min(7, daily.length - 1)
      const currentDischarge = Math.round(daily[currentIdx].discharge * 10) / 10
      const status = peakDischarge >= 400 ? 'KRITIS' : peakDischarge >= 180 ? 'SIAGA' : peakDischarge >= 60 ? 'WASPADA' : 'NORMAL'
      glofas = { daily, currentDischarge, peakDischarge, avgDischarge, medianDischarge, status }
    }
  }

  // 2. Soil moisture
  let soil: any = null
  if (smRes.status === 'fulfilled' && smRes.value?.hourly) {
    const h = smRes.value.hourly
    const arr0 = h.soil_moisture_0_to_1cm || h.soil_moisture_0_to_7cm || []
    const arr1 = h.soil_moisture_1_to_3cm || h.soil_moisture_7_to_28cm || []
    const lastValid = (arr: any[]) => {
      for (let i = arr.length - 1; i >= 0; i--) {
        const n = numOrNull(arr[i])
        if (n != null) return n
      }
      return null
    }
    const top = lastValid(arr0)
    const sub = lastValid(arr1)
    if (top != null) {
      const saturationPct = Math.min(100, Math.round((top / 0.45) * 100))
      const status = saturationPct >= 85 ? 'JENUH (Larian Tinggi)' : saturationPct >= 65 ? 'LEMBAP TINGGI' : 'NORMAL'
      soil = { topLayer: Math.round(top * 1000) / 1000, subLayer: sub != null ? Math.round(sub * 1000) / 1000 : null, saturationPct, status }
    }
  }

  // 3. Marine waves (null untuk daerah pedalaman jika tidak ada data)
  let marine: any = null
  if (marineRes.status === 'fulfilled' && marineRes.value?.daily?.wave_height_max) {
    const heights = (marineRes.value.daily.wave_height_max as any[]).map(numOrNull).filter((v): v is number => v != null)
    const periods = (marineRes.value.daily.wave_period_max as any[]).map(numOrNull).filter((v): v is number => v != null)
    if (heights.length) {
      marine = {
        waveHeightMaxM: Math.round(Math.max(...heights) * 100) / 100,
        wavePeriodMaxS: periods.length ? Math.round(Math.max(...periods) * 10) / 10 : null,
      }
    }
  }

  // 4. PetaBencana reports within 100 km
  let petaBencana: any = { count: 0, maxDepthCm: null, items: [] }
  if (pbRes.status === 'fulfilled') {
    const feats: any[] = pbRes.value?.result?.objects?.output?.geometries || []
    const nearby: any[] = []
    for (const g of feats) {
      const coords = g?.coordinates
      if (!Array.isArray(coords) || coords.length < 2) continue
      const rLon = Number(coords[0])
      const rLat = Number(coords[1])
      if (!Number.isFinite(rLat) || !Number.isFinite(rLon)) continue
      const distKm = haversineKm(lat, lon, rLat, rLon)
      if (distKm > 100) continue
      const p = g.properties || {}
      const depthCm = numOrNull(p?.report_data?.flood_depth)
      nearby.push({
        id: String(p.pkey || `${rLat},${rLon}`),
        createdAt: String(p.created_at || '').slice(0, 16).replace('T', ' '),
        disasterType: String(p.disaster_type || 'flood'),
        floodDepthCm: depthCm,
        text: sanitizeText(p.text || p.title || 'Laporan genangan warga').slice(0, 180),
        distKm,
        lat: rLat,
        lon: rLon,
      })
    }
    nearby.sort((a, b) => a.distKm - b.distKm)
    const depths = nearby.map((n) => n.floodDepthCm).filter((v): v is number => v != null && v > 0)
    petaBencana = {
      count: nearby.length,
      maxDepthCm: depths.length ? Math.max(...depths) : null,
      items: nearby.slice(0, 12),
    }
  }

  return { glofas, soil, marine, petaBencana }
}

function parseBmkgCoord(s?: string | null): { lat: number; lon: number } | null {
  const m = /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/.exec(String(s || '').trim())
  if (!m) return null
  return { lat: Number(m[1]), lon: Number(m[2]) }
}

function bmkgWibDate(dt?: string | null): string | null {
  if (!dt) return null
  const ms = Date.parse(String(dt))
  if (Number.isFinite(ms)) return new Date(ms + 7 * 3600_000).toISOString().slice(0, 10)
  return String(dt).slice(0, 10)
}

function parseBmkgRow(row: any, refLat: number, refLon: number, evDate?: string | null) {
  const c = parseBmkgCoord(row?.Coordinates)
  const distKm = c ? haversineKm(refLat, refLon, c.lat, c.lon) : null
  const mag = numOrNull(row?.Magnitude)
  const depth = numOrNull(String(row?.Kedalaman || '').replace(/[^\d.]/g, ''))
  const dateStr = bmkgWibDate(row?.DateTime)
  const dayDiff = evDate && dateStr
    ? Math.abs(Math.round((Date.parse(`${dateStr}T00:00:00Z`) - Date.parse(`${evDate}T00:00:00Z`)) / 86_400_000))
    : 999
  return {
    id: `bmkg-${row?.DateTime || row?.Tanggal || ''}-${row?.Magnitude || ''}`,
    source: 'BMKG' as const,
    timeWib: [row?.Tanggal, row?.Jam].filter(Boolean).join(' '),
    dateStr,
    dayDiff,
    mag: mag ?? 0,
    depthKm: depth ?? 0,
    place: String(row?.Wilayah || '').trim() || 'Indonesia',
    mmi: row?.Dirasakan ? String(row.Dirasakan).trim() : null,
    potensi: row?.Potensi ? String(row.Potensi).trim() : null,
    shakemapFile: row?.Shakemap ? String(row.Shakemap).trim() : null,
    shakemapProxyUrl: row?.Shakemap ? `/api/puskris/open/shakemap?file=${encodeURIComponent(String(row.Shakemap).trim())}` : null,
    lat: c?.lat ?? null,
    lon: c?.lon ?? null,
    distKm,
  }
}

async function fetchGempaSupport(lat: number, lon: number, tanggal?: string | null) {
  const today = new Date().toISOString().slice(0, 10)
  const evDate = tanggal && /^\d{4}-\d{2}-\d{2}/.test(tanggal) ? tanggal.slice(0, 10) : today
  const startIso = addDaysIso(evDate, -2)
  const endPlus = addDaysIso(evDate, 6)
  const endIso = endPlus > today ? today : endPlus

  const usgsUrl = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${startIso}T00:00:00&endtime=${endIso}T23:59:59&latitude=${lat}&longitude=${lon}&maxradiuskm=350&minmagnitude=2.5&limit=200`

  const [autoRes, kiniRes, rasaRes, usgsRes, gdacsRes, marineRes] = await Promise.allSettled([
    fetchJson('https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json', 6000),
    fetchJson('https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json', 6000),
    fetchJson('https://data.bmkg.go.id/DataMKG/TEWS/gempadirasakan.json', 6000),
    fetchJson(usgsUrl, 9000),
    fetchJson('https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=EQ;TS&country=Indonesia', 7000),
    fetchJson(`https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&daily=wave_height_max&past_days=1&forecast_days=2&timezone=Asia%2FJakarta`, 6000),
  ])

  const bmkgAuto = autoRes.status === 'fulfilled' && autoRes.value?.Infogempa?.gempa
    ? parseBmkgRow(autoRes.value.Infogempa.gempa, lat, lon, evDate)
    : null
  const bmkgKini: any[] = kiniRes.status === 'fulfilled'
    ? (kiniRes.value?.Infogempa?.gempa || []).map((g: any) => parseBmkgRow(g, lat, lon, evDate))
    : []
  const bmkgRasa: any[] = rasaRes.status === 'fulfilled'
    ? (rasaRes.value?.Infogempa?.gempa || []).map((g: any) => parseBmkgRow(g, lat, lon, evDate))
    : []

  const bmkgNearby = [...(bmkgAuto ? [bmkgAuto] : []), ...bmkgRasa, ...bmkgKini]
    .filter((g) => g.distKm != null && g.distKm <= 380)
    .sort((a, b) => a.dayDiff - b.dayDiff || (a.distKm ?? 9999) - (b.distKm ?? 9999))

  const usgsEvents = usgsRes.status === 'fulfilled'
    ? ((usgsRes.value?.features || []) as any[]).map((f) => {
        const coords = f?.geometry?.coordinates || []
        const eLon = Number(coords[0])
        const eLat = Number(coords[1])
        const depthKm = Math.round(Number(coords[2] || 0) * 10) / 10
        const p = f?.properties || {}
        const wibMs = Number(p.time || 0) + 7 * 3600_000
        const wibIso = Number.isFinite(wibMs) && wibMs > 0 ? new Date(wibMs).toISOString() : ''
        return {
          id: String(f.id || `usgs-${p.time}`),
          source: 'USGS' as const,
          timeWib: wibIso ? `${wibIso.slice(8, 10)}/${wibIso.slice(5, 7)}/${wibIso.slice(0, 4)} ${wibIso.slice(11, 16)} WIB` : '-',
          dateStr: wibIso ? wibIso.slice(0, 10) : '',
          mag: Math.round(Number(p.mag || 0) * 10) / 10,
          depthKm,
          place: String(p.place || 'Sekitar episentrum').trim(),
          mmi: p.mmi ? `${Number(p.mmi).toFixed(1)} MMI` : null,
          potensi: Number(p.tsunami) ? 'Peringatan Tsunami USGS' : null,
          shakemapProxyUrl: null,
          lat: Number.isFinite(eLat) ? eLat : null,
          lon: Number.isFinite(eLon) ? eLon : null,
          distKm: Number.isFinite(eLat) && Number.isFinite(eLon) ? haversineKm(lat, lon, eLat, eLon) : null,
        }
      })
    : []

  // Bangun seri 7 hari aktivitas seismik di sekitar tanggal kejadian
  const daysRange: string[] = []
  for (let offset = -1; offset <= 5; offset++) daysRange.push(addDaysIso(evDate, offset))
  const byDay = new Map<string, { mags: number[]; depths: number[] }>()
  for (const d of daysRange) byDay.set(d, { mags: [], depths: [] })
  for (const e of usgsEvents) {
    if (!e.dateStr) continue
    const bucket = byDay.get(e.dateStr)
    if (bucket) {
      bucket.mags.push(e.mag)
      bucket.depths.push(e.depthKm)
    }
  }
  const timeline7d = daysRange.map((d) => {
    const b = byDay.get(d)!
    return {
      date: d,
      label: shortDayId(d),
      isEventDay: d === evDate,
      count: b.mags.length,
      maxMag: b.mags.length ? Math.round(Math.max(...b.mags) * 10) / 10 : null,
      avgDepthKm: b.depths.length ? Math.round(b.depths.reduce((a, c) => a + c, 0) / b.depths.length) : null,
    }
  })

  const gdacsAlerts = gdacsRes.status === 'fulfilled'
    ? ((gdacsRes.value?.features || []) as any[])
        .map((f) => {
          const c = f?.geometry?.coordinates
          const p = f?.properties || {}
          const distKm = Array.isArray(c) ? haversineKm(lat, lon, Number(c[1]), Number(c[0])) : null
          return {
            title: String(p.name || p.eventname || 'Peringatan GDACS'),
            alertLevel: String(p.alertlevel || 'Green'),
            severity: String(p.severitydata?.severitytext || ''),
            distKm,
          }
        })
        .filter((x) => x.distKm != null && x.distKm <= 500)
        .slice(0, 5)
    : []

  const marineWaveMaxM = marineRes.status === 'fulfilled' && marineRes.value?.daily?.wave_height_max
    ? Math.max(...(marineRes.value.daily.wave_height_max as any[]).map(Number).filter(Number.isFinite))
    : null

  const combinedCatalog = [...bmkgNearby, ...usgsEvents].sort((a, b) => b.mag - a.mag).slice(0, 40)
  const mainBmkg = bmkgNearby.find((b) => b.dayDiff <= 2) || null

  return {
    bmkgAvailable: Boolean(bmkgAuto || bmkgKini.length || bmkgRasa.length),
    usgsAvailable: usgsRes.status === 'fulfilled',
    autogempaNasional: bmkgAuto,
    mainBmkg,
    usgsCount: usgsEvents.length,
    maxMag: combinedCatalog.length ? Math.max(...combinedCatalog.map((e) => e.mag)) : null,
    timeline7d,
    catalog: combinedCatalog,
    gdacsAlerts,
    marineWaveMaxM: Number.isFinite(marineWaveMaxM) ? Math.round((marineWaveMaxM as number) * 100) / 100 : null,
  }
}

async function fetchFirmsIndo24hAnd7d() {
  return persist(
    ['firms-indo-bundle-v2'],
    async () => {
      const urls24 = [
        { sat: 'NOAA-20 VIIRS', url: 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_SouthEast_Asia_24h.csv' },
        { sat: 'Suomi-NPP VIIRS', url: 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_SouthEast_Asia_24h.csv' },
      ]
      const res24 = await Promise.allSettled(urls24.map((u) => fetchText(u.url, 9000)))
      const seen = new Set<string>()
      const rows24: any[] = []

      res24.forEach((r, idx) => {
        if (r.status !== 'fulfilled') return
        const parsed = Papa.parse<any>(r.value, { header: true, skipEmptyLines: true })
        for (const x of parsed.data || []) {
          const lat = Number(x.latitude)
          const lon = Number(x.longitude)
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
          if (lat < -11 || lat > 6.5 || lon < 94.5 || lon > 141.5) continue
          const key = `${lat.toFixed(3)},${lon.toFixed(3)},${x.acq_date}`
          if (seen.has(key)) continue
          seen.add(key)
          rows24.push({
            lat: Math.round(lat * 1e4) / 1e4,
            lon: Math.round(lon * 1e4) / 1e4,
            bright: numOrNull(x.bright_ti4) ?? 0,
            frp: numOrNull(x.frp) ?? 0,
            confidence: String(x.confidence || 'nominal').toLowerCase(),
            acqDate: String(x.acq_date || ''),
            acqTime: String(x.acq_time || ''),
            satellite: urls24[idx].sat,
          })
        }
      })

      // 7-day trend CSV: coba NOAA-20 7d & Suomi-NPP 7d, bila kosong agregasikan rows24
      const dailyNat: Record<string, number> = {}
      const rows7dLocalSource: any[] = []
      const seen7 = new Set<string>()
      const urls7 = [
        'https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_SouthEast_Asia_7d.csv',
        'https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_SouthEast_Asia_7d.csv',
      ]
      const res7 = await Promise.allSettled(urls7.map((u) => fetchText(u, 8000)))
      for (const r of res7) {
        if (r.status !== 'fulfilled') continue
        const p7 = Papa.parse<any>(r.value, { header: true, skipEmptyLines: true })
        for (const x of p7.data || []) {
          const lat = Number(x.latitude)
          const lon = Number(x.longitude)
          if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -11 || lat > 6.5 || lon < 94.5 || lon > 141.5) continue
          const d = String(x.acq_date || '').slice(0, 10)
          if (!d) continue
          const k7 = `${lat.toFixed(3)},${lon.toFixed(3)},${d}`
          if (seen7.has(k7)) continue
          seen7.add(k7)
          dailyNat[d] = (dailyNat[d] || 0) + 1
          rows7dLocalSource.push({ lat, lon, acqDate: d })
        }
      }
      if (Object.keys(dailyNat).length === 0) {
        for (const x of rows24) {
          if (!x.acqDate) continue
          dailyNat[x.acqDate] = (dailyNat[x.acqDate] || 0) + 1
          rows7dLocalSource.push({ lat: x.lat, lon: x.lon, acqDate: x.acqDate })
        }
      }

      return { rows24, dailyNat, rows7dCoords: rows7dLocalSource }
    },
    REVALIDATE.singkat,
    ['firms'],
  )
}

async function fetchKarhutlaSupport(lat: number, lon: number, weatherCurrent: any) {
  let firmsData: { rows24: any[]; dailyNat: Record<string, number>; rows7dCoords: any[] } = {
    rows24: [],
    dailyNat: {},
    rows7dCoords: [],
  }
  let firmsOk = false
  try {
    firmsData = await fetchFirmsIndo24hAnd7d()
    firmsOk = true
  } catch {
    firmsOk = false
  }

  const withDist = firmsData.rows24
    .map((p) => ({ ...p, distKm: haversineKm(lat, lon, p.lat, p.lon) }))
    .sort((a, b) => a.distKm - b.distKm)

  const within50 = withDist.filter((p) => p.distKm <= 50)
  const within150 = withDist.filter((p) => p.distKm <= 150)

  const local7dMap: Record<string, number> = {}
  for (const r of firmsData.rows7dCoords) {
    if (haversineKm(lat, lon, r.lat, r.lon) <= 150) {
      local7dMap[r.acqDate] = (local7dMap[r.acqDate] || 0) + 1
    }
  }
  const allDates = Array.from(new Set([...Object.keys(firmsData.dailyNat), ...Object.keys(local7dMap)])).sort()
  const daily7d = allDates.slice(-7).map((date) => ({
    date,
    label: shortDayId(date),
    nasional: firmsData.dailyNat[date] || 0,
    sekitar150km: local7dMap[date] || 0,
  }))

  // Hitung indeks risiko kebakaran meteorologi sederhana (Chandler/Angstrom)
  let fireDanger: { level: string; score: number; badgeClass: string; basis: string } | null = null
  if (weatherCurrent?.tempC != null && weatherCurrent?.humidityPct != null) {
    const T = Number(weatherCurrent.tempC)
    const RH = Number(weatherCurrent.humidityPct)
    const W = Number(weatherCurrent.windSpeedKmh || 0)
    // Chandler Burning Index terstandarisasi
    const cbi = (((110 - 1.373 * RH) - 0.54 * (10.2 - T)) * (124 * 10 ** (-0.0142 * RH))) / 60
    const score = Math.max(0, Math.round((cbi + W * 0.4) * 10) / 10)
    const level = score >= 75 ? 'EKSTREM' : score >= 50 ? 'TINGGI' : score >= 25 ? 'SEDANG' : 'RENDAH'
    const badgeClass =
      level === 'EKSTREM'
        ? 'border-rose-300 bg-rose-50 text-rose-800'
        : level === 'TINGGI'
        ? 'border-amber-300 bg-amber-50 text-amber-900'
        : level === 'SEDANG'
        ? 'border-yellow-200 bg-yellow-50 text-yellow-800'
        : 'border-emerald-200 bg-emerald-50 text-emerald-800'
    fireDanger = {
      level,
      score,
      badgeClass,
      basis: `Suhu ${T}°C · Kelembapan ${RH}% · Angin ${W} km/jam`,
    }
  }

  return {
    firmsAvailable: firmsOk,
    nasional24h: firmsData.rows24.length,
    count24h50km: within50.length,
    count24h150km: within150.length,
    highConf50km: within50.filter((p) => p.confidence === 'h' || p.confidence === 'high').length,
    maxFrp150km: within150.length ? Math.round(Math.max(...within150.map((p) => p.frp)) * 10) / 10 : null,
    points150km: within150.slice(0, 200),
    daily7d,
    fireDanger,
  }
}

export async function getKejadianPendukung(params: {
  uid: string
  lat?: number | null
  lon?: number | null
  jenis?: string | null
  tanggal?: string | null
  templateOverride?: string | null
}) {
  const eocDetail = await fetchSafeEocDetail(params.uid)
  const lat = params.lat ?? eocDetail?.lat ?? null
  const lon = params.lon ?? eocDetail?.lon ?? null
  const jenis = params.jenis || eocDetail?.jenis || null
  const tanggal = params.tanggal || eocDetail?.tanggal || null
  const template: KejadianTemplate = resolveKejadianTemplate(jenis, params.templateOverride)

  if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return {
      uid: params.uid,
      template,
      eocDetail,
      weather: null,
      airQuality: null,
      banjir: null,
      gempa: null,
      karhutla: null,
      fetchedAt: new Date().toISOString(),
    }
  }

  const [weather, airQuality] = await Promise.all([
    fetchWeatherSupport(lat, lon, tanggal),
    fetchAirQualitySupport(lat, lon),
  ])

  const [banjir, gempa, karhutla] = await Promise.all([
    template === 'banjir' || template === 'umum' ? fetchBanjirSupport(lat, lon, tanggal) : Promise.resolve(null),
    template === 'gempa' || template === 'umum' ? fetchGempaSupport(lat, lon, tanggal) : Promise.resolve(null),
    template === 'karhutla' ? fetchKarhutlaSupport(lat, lon, weather.current) : Promise.resolve(null),
  ])

  return {
    uid: params.uid,
    template,
    eocDetail,
    weather,
    airQuality,
    banjir,
    gempa,
    karhutla,
    fetchedAt: new Date().toISOString(),
  }
}
