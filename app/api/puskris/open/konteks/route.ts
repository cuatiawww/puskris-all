import { NextResponse } from 'next/server'
import { getUpstream, inIndonesia, wibNow, type UpstreamReport } from '@/lib/server/upstream'
import { eocKindOf } from '@/lib/puskris/eoc-markers'

export const dynamic = 'force-dynamic'

const WMO: Record<number, string> = {
  0: 'Cerah', 1: 'Cerah berawan', 2: 'Berawan sebagian', 3: 'Berawan',
  45: 'Kabut', 48: 'Kabut berembun',
  51: 'Gerimis ringan', 53: 'Gerimis', 55: 'Gerimis lebat',
  61: 'Hujan ringan', 63: 'Hujan', 65: 'Hujan lebat',
  66: 'Hujan beku ringan', 67: 'Hujan beku',
  71: 'Salju ringan', 73: 'Salju', 75: 'Salju lebat',
  80: 'Hujan rintik', 81: 'Hujan sedang', 82: 'Hujan sangat lebat',
  95: 'Badai petir', 96: 'Badai petir + hujan es ringan', 99: 'Badai petir + hujan es',
}

function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371, to = Math.PI / 180
  const dLat = (b.lat - a.lat) * to, dLon = (b.lon - a.lon) * to
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * to) * Math.cos(b.lat * to) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

const CONF: Record<string, string> = { l: 'rendah', n: 'nominal', h: 'tinggi', low: 'rendah', nominal: 'nominal', high: 'tinggi' }
function parseFirms(text: string) {
  const lines = String(text || '').trim().split(/\r?\n/)
  const head = (lines.shift() || '').split(',')
  const ix = (k: string) => head.indexOf(k)
  const iLat = ix('latitude'), iLon = ix('longitude'), iB = ix('bright_ti4') >= 0 ? ix('bright_ti4') : ix('brightness')
  const iD = ix('acq_date'), iT = ix('acq_time'), iS = ix('satellite'), iC = ix('confidence'), iF = ix('frp')
  return lines.map((l) => l.split(',')).map((c) => ({
    latitude: Number(c[iLat]), longitude: Number(c[iLon]), brightness: Number(c[iB]) || null,
    acq_date: c[iD], acq_time: c[iT],
    satellite: c[iS] === 'N20' ? 'NOAA-20' : c[iS] === 'N' ? 'Suomi NPP' : c[iS],
    confidence: CONF[String(c[iC] || '').toLowerCase()] || c[iC], frp: Number(c[iF]) || null,
  }))
}

function bmkgList(data: any, label: string) {
  const raw: any[] = data?.Infogempa?.gempa ? (Array.isArray(data.Infogempa.gempa) ? data.Infogempa.gempa : [data.Infogempa.gempa]) : []
  return raw.map((g: any, i: number) => {
    const [lat, lon] = String(g.Coordinates || '').split(',').map(Number)
    return {
      sumber: 'BMKG',
      label,
      title: `Gempa M${g.Magnitude} · ${label}`,
      place: g.Wilayah || 'Indonesia',
      magnitude: Number(g.Magnitude) || null,
      time: g.DateTime || `${g.Tanggal || ''} ${g.Jam || ''}`.trim(),
      depth: g.Kedalaman || null,
      potensi: g.Potensi || g.Dirasakan || null,
      lat, lon, jarak_km: 0 as number,
      url: 'https://www.bmkg.go.id/gempabumi/gempabumi-terkini',
    }
  }).filter((e) => inIndonesia(e.lat, e.lon))
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const lat = Number(sp.get('lat'))
  const lon = Number(sp.get('lon'))
  const jenis = sp.get('jenis') || ''
  const kind = eocKindOf(jenis)
  const posOk = Number.isFinite(lat) && Number.isFinite(lon) && inIndonesia(lat, lon)
  const upstream: UpstreamReport[] = []
  const out: any = { ok: true, fetched_at: wibNow(), kind, jenis, koordinat: posOk ? { lat, lon } : null, catatan: [] as string[] }

  if (!posOk) {
    return NextResponse.json({
      ok: true, fetched_at: wibNow(), kind, jenis, koordinat: null,
      pesan: 'Koordinat kejadian belum tersedia, konteks cuaca dan bahaya terbuka tidak bisa dihitung.',
      sections: {},
      upstream,
    })
  }

  const cuacaP = getUpstream(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max&timezone=Asia%2FJakarta&forecast_days=3`,
    { revalidate: 1800, timeoutMs: 10000 },
  )

  const floodP = (kind === 'banjir')
    ? getUpstream(
        `https://flood-api.open-meteo.com/v1/flood?latitude=${lat}&longitude=${lon}&daily=river_discharge,river_discharge_mean,river_discharge_median,river_discharge_max&forecast_days=5&past_days=2`,
        { revalidate: 3600, timeoutMs: 12000 },
      )
    : Promise.resolve(null)

  const gempaP = (kind === 'gempa' || kind === 'erupsi')
    ? Promise.all([
        getUpstream('https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json', { revalidate: 600 }),
        getUpstream('https://data.bmkg.go.id/DataMKG/TEWS/gempadirasakan.json', { revalidate: 600 }),
        getUpstream('https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=EQ;FL;VO;TC;DR;WF&country=Indonesia', { revalidate: 900, timeoutMs: 12000 }),
      ])
    : Promise.resolve(null)

  const fireP = (kind === 'karhutla')
    ? Promise.all([
        getUpstream('https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_SouthEast_Asia_24h.csv', { as: 'text', revalidate: 1800, timeoutMs: 20000 }),
        getUpstream('https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_SouthEast_Asia_24h.csv', { as: 'text', revalidate: 1800, timeoutMs: 20000 }),
      ])
    : Promise.resolve(null)

  const [cuacaRes, floodRes, gempaRes, fireRes] = await Promise.all([cuacaP, floodP, gempaP, fireP])

  if (cuacaRes) {
    upstream.push({ nama: 'Open-Meteo cuaca', ok: cuacaRes.ok, status: cuacaRes.status, count: cuacaRes.ok ? 1 : 0, error: cuacaRes.ok ? undefined : cuacaRes.error })
    if (cuacaRes.ok) {
      const d: any = cuacaRes.data
      const cur = d.current || {}
      const daily = d.daily || {}
      const days = (daily.time || []).map((t: string, i: number) => ({
        tanggal: t,
        suhu_min: daily.temperature_2m_min?.[i] ?? null,
        suhu_max: daily.temperature_2m_max?.[i] ?? null,
        hujan_mm: daily.precipitation_sum?.[i] ?? null,
        peluang_hujan: daily.precipitation_probability_max?.[i] ?? null,
        angin_max: daily.wind_speed_10m_max?.[i] ?? null,
      }))
      out.cuaca = {
        sumber: 'Open-Meteo (model cuaca global, bukan prakiraan resmi BMKG)',
        url: 'https://open-meteo.com/',
        saat_ini: {
          suhu: cur.temperature_2m ?? null,
          kelembapan: cur.relative_humidity_2m ?? null,
          hujan_mm: cur.precipitation ?? null,
          angin: cur.wind_speed_10m ?? null,
          hembusan: cur.wind_gusts_10m ?? null,
          kode: cur.weather_code ?? null,
          kondisi: WMO[Number(cur.weather_code)] || (cur.weather_code != null ? `Kode cuaca ${cur.weather_code}` : null),
          waktu: cur.time || null,
        },
        harian: days,
      }
    } else {
      out.cuaca = { kosong: true, sumber: 'Open-Meteo', error: cuacaRes.error }
    }
  }

  if (kind === 'banjir') {
    out.catatan.push('Debit sungai berikut berasal dari model GloFAS melalui Open-Meteo, bukan peringatan resmi BNPB atau BMKG.')
    if (!floodRes) {
      out.banjir = { kosong: true, sumber: 'GloFAS / Open-Meteo' }
    } else {
      upstream.push({ nama: 'GloFAS (Open-Meteo Flood)', ok: floodRes.ok, status: floodRes.status, count: floodRes.ok ? (floodRes.data as any)?.daily?.time?.length || 0 : 0, error: floodRes.ok ? undefined : floodRes.error })
      if (floodRes.ok) {
        const d: any = floodRes.data
        const daily = d.daily || {}
        out.banjir = {
          sumber: 'GloFAS / Open-Meteo Flood (model debit sungai global, bukan peringatan resmi BNPB/BMKG)',
          url: 'https://open-meteo.com/en/docs/flood-api',
          satuan: d.daily_units?.river_discharge || 'm³/s',
          harian: (daily.time || []).map((t: string, i: number) => ({
            tanggal: t,
            debit: daily.river_discharge?.[i] ?? null,
            debit_rerata: daily.river_discharge_mean?.[i] ?? null,
            debit_median: daily.river_discharge_median?.[i] ?? null,
            debit_maks: daily.river_discharge_max?.[i] ?? null,
          })),
        }
      } else {
        out.banjir = { kosong: true, sumber: 'GloFAS / Open-Meteo Flood', error: floodRes.error }
      }
    }
  }

  if (kind === 'gempa' || kind === 'erupsi') {
    const radius = kind === 'gempa' ? 300 : 200
    const list: any[] = []
    if (gempaRes) {
      const [terkini, dirasakan, gdacs] = gempaRes
      const a = terkini.ok ? bmkgList(terkini.data, 'M5+ terkini') : []
      const b = dirasakan.ok ? bmkgList(dirasakan.data, 'dirasakan') : []
      upstream.push({ nama: 'BMKG gempa terkini', ok: terkini.ok, status: terkini.status, count: a.length, error: terkini.ok ? undefined : terkini.error })
      upstream.push({ nama: 'BMKG gempa dirasakan', ok: dirasakan.ok, status: dirasakan.status, count: b.length, error: dirasakan.ok ? undefined : dirasakan.error })
      for (const ev of [...a, ...b]) {
        ev.jarak_km = Math.round(km({ lat, lon }, { lat: ev.lat, lon: ev.lon }) * 10) / 10
        if (ev.jarak_km <= radius) list.push(ev)
      }
      const gfs: any[] = gdacs.ok ? gdacs.data?.features || [] : []
      let gCount = 0
      for (const f of gfs) {
        const p = f.properties || {}
        const [glon, glat] = f.geometry?.coordinates || []
        if (!inIndonesia(glat, glon)) continue
        const jenisG = p.eventtype
        if (kind === 'gempa' && jenisG !== 'EQ' && jenisG !== 'FL' && jenisG !== 'TC') continue
        if (kind === 'erupsi' && jenisG !== 'VO') continue
        const jarak = Math.round(km({ lat, lon }, { lat: glat, lon: glon }) * 10) / 10
        if (jarak > radius) continue
        gCount += 1
        list.push({
          sumber: 'GDACS',
          label: p.eventtype,
          title: p.name || 'Peringatan bencana',
          place: p.country || 'Indonesia',
          magnitude: p.severitydata?.severity ?? null,
          time: p.fromdate || null,
          potensi: p.severitydata?.severitytext || p.alertlevel || null,
          lat: glat, lon: glon, jarak_km: jarak,
          url: p.url?.report,
        })
      }
      upstream.push({ nama: 'GDACS peringatan', ok: gdacs.ok, status: gdacs.status, count: gCount, error: gdacs.ok ? undefined : gdacs.error })
    }
    list.sort((x, y) => (x.jarak_km ?? 9e9) - (y.jarak_km ?? 9e9))
    out.bahaya = {
      sumber: kind === 'gempa' ? 'BMKG (gempa) dan GDACS' : 'GDACS (gunung api) dan BMKG (gempa di sekitar)',
      radius_km: radius,
      items: list.slice(0, 12),
      kosong: list.length === 0,
    }
    if (kind === 'erupsi') {
      out.magma = {
        kosong: true,
        sumber: 'MAGMA / PVMBG',
        catatan: 'Endpoint publik MAGMA/PVMBG tanpa kunci API tidak dipakai. Data tingkat aktivitas gunung api resmi tidak ditampilkan.',
      }
    }
  }

  if (kind === 'karhutla') {
    const radius = 50
    const spots: any[] = []
    if (fireRes) {
      const names = ['NASA FIRMS VIIRS NOAA-20', 'NASA FIRMS VIIRS Suomi NPP']
      fireRes.forEach((r, i) => {
        const rows = r.ok ? parseFirms(r.data as string).filter((h) => inIndonesia(h.latitude, h.longitude)) : []
        const near = rows.map((h) => ({ ...h, jarak_km: Math.round(km({ lat, lon }, { lat: h.latitude, lon: h.longitude }) * 10) / 10 })).filter((h) => h.jarak_km <= radius)
        spots.push(...near)
        upstream.push({ nama: names[i], ok: r.ok, status: r.status, count: near.length, error: r.ok ? undefined : r.error })
      })
    }
    spots.sort((a, b) => (b.frp || 0) - (a.frp || 0))
    const uniq = [] as any[]
    const seen = new Set<string>()
    for (const s of spots) {
      const key = `${s.latitude.toFixed(3)}|${s.longitude.toFixed(3)}|${s.acq_date}|${s.acq_time}`
      if (seen.has(key)) continue
      seen.add(key)
      uniq.push(s)
    }
    out.karhutla = {
      sumber: 'NASA FIRMS (berkas publik 24 jam, tanpa kunci)',
      url: 'https://firms.modaps.eosdis.nasa.gov/',
      radius_km: radius,
      total: uniq.length,
      items: uniq.slice(0, 25),
      kosong: uniq.length === 0,
    }
  }

  if (kind === 'longsor' || kind === 'cuaca') {
    out.catatan.push('Konteks cuaca diambil dari Open-Meteo sebagai data pendukung, bukan peringatan resmi BMKG.')
  }

  return NextResponse.json({ ok: true, fetched_at: wibNow(), kind, jenis, koordinat: { lat, lon }, ...out, upstream })
}