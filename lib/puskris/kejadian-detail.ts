import { eocKejadian } from '@/lib/puskris/derive'
import { haversineKm } from '@/lib/puskris/integrasi'
import { fmtAngka } from '@/lib/puskris/eoc-markers'

const todayWib = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)

function daysSince(iso: string) {
  const t = Date.parse(`${iso}T00:00:00+07:00`)
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.round((Date.now() + 7 * 3600_000 - (t + 7 * 3600_000)) / 86400000))
}

export function statusOperasional(k: { tanggal?: string | null; krisis?: boolean }) {
  if (!k.tanggal) {
    return { label: null as string | null, tone: 'slate', hari: null as number | null, catatan: 'Tanggal kejadian belum tersedia dari API, status operasional tidak disusun.' }
  }
  const hari = daysSince(k.tanggal)
  if (hari == null) {
    return { label: null, tone: 'slate', hari: null, catatan: 'Tanggal kejadian tidak dapat dibaca.' }
  }
  if (k.krisis && hari <= 7) return { label: 'Perhatian segera', tone: 'rose', hari, catatan: 'Diturunkan dari flag krisis EOC dan kejadian dalam 7 hari terakhir. Bukan fase resmi BNPB.' }
  if (k.krisis && hari <= 30) return { label: 'Pemantauan krisis', tone: 'amber', hari, catatan: 'Diturunkan dari flag krisis EOC dan kejadian 8–30 hari. Bukan fase resmi BNPB.' }
  if (k.krisis) return { label: 'Tindak lanjut krisis', tone: 'slate', hari, catatan: 'Diturunkan dari flag krisis EOC dan kejadian lebih dari 30 hari. Bukan fase resmi BNPB.' }
  if (hari <= 7) return { label: 'Terpantau (baru)', tone: 'teal', hari, catatan: 'Kejadian terpantau (bukan krisis) dalam 7 hari terakhir, menurut data EOC.' }
  return { label: 'Terpantau', tone: 'teal', hari, catatan: 'Kejadian terpantau menurut data EOC, tanpa flag krisis kesehatan.' }
}

export function nearbyDetail(data: any, k: any, pos: { lat: number; lon: number } | null) {
  const peta = data?.psc?.peta
  const pscAll: any[] = peta?.psc || []
  const ambAll: any[] = peta?.ambulans || []
  const sameKab = (p: any) => k.kab_code && p.kk && String(p.kk) === String(k.kab_code)
  const near = (lat: number, lon: number) => (pos ? haversineKm(pos, { lat, lon }) <= 50 : false)
  const pscLive = data?.psc?.data_source === 'langsung'
  const tckLive = data?.tck?.data_source === 'langsung'
  const logLive = data?.logistik?.data_source === 'langsung'

  const psc = pscAll.filter((p) => p.lat != null && p.lon != null && (sameKab(p) || near(p.lat, p.lon)))
  const pscList = psc
    .map((p) => ({
      nama: p.n,
      kab: p.kab || null,
      aktif: p.a === 1,
      ambulans: Number(p.amb || 0),
      siap: Number(p.siap || 0),
      jarak_km: pos && p.lat != null ? Math.round(haversineKm(pos, { lat: p.lat, lon: p.lon }) * 10) / 10 : null,
    }))
    .sort((a, b) => (a.jarak_km ?? 9e9) - (b.jarak_km ?? 9e9))

  const amb = ambAll.filter((a) => {
    const ps = pscAll[a[7]]
    if (!ps) return false
    return sameKab(ps) || (a[0] != null && a[1] != null && near(a[0], a[1]))
  })

  const rsAll: [number, number][] = data?.psc?.titik_rs || []
  const rsNear = pos ? rsAll.filter((r) => r[0] != null && r[1] != null && near(r[0], r[1])).length : null

  const tck = (data?.tck?.provinsi || []).find((r: any) => String(r.code).padStart(2, '0') === String(k.code || '').padStart(2, '0')) || null
  const logistikBy = data?.logistik?.provinsi_regional && data?.logistik?.regional
    ? Object.fromEntries((data.logistik.regional || []).map((r: any) => [r.id, r]))
    : null
  const regId = data?.logistik?.provinsi_regional?.[String(k.code || '').padStart(2, '0')]
  const logistik = regId != null && logistikBy ? logistikBy[regId] : (data?.logistik?.regional || []).find((r: any) => String(r.code) === String(k.code)) || null

  return {
    radius_km: 50,
    psc: pscLive ? { tersedia: true, total: psc.length, aktif: psc.filter((p) => p.a === 1).length, daftar: pscList.slice(0, 8) } : { tersedia: false },
    ambulans: pscLive ? { tersedia: true, total: amb.length, siap: amb.filter((a) => a[2] === 1).length } : { tersedia: false },
    rs: pscLive && rsNear != null ? { tersedia: true, total: rsNear, catatan: 'Jumlah titik rumah sakit jejaring berkoordinat dalam radius. Nama faskes tidak dikirim API untuk titik ini.' } : { tersedia: false },
    tck: tckLive && tck ? {
      tersedia: true, level: 'provinsi', provinsi: tck.nama || k.provinsi,
      individu: Number(tck.individu || 0), nakes: Number(tck.nakes || 0), non_nakes: Number(tck.non_nakes || 0),
    } : { tersedia: false },
    logistik: logLive && logistik ? {
      tersedia: true, level: 'regional', nama: logistik.nama || logistik.wilayah || 'Regional',
      total: Number(logistik.total || logistik.stok || 0),
      catatan: 'Stok agregat regional. Angka kesenjangan kebutuhan vs stok belum tersedia dari API.',
    } : { tersedia: false },
  }
}

export function risikoWilayah(data: any, k: any) {
  const kabCode = k.kab_code ? String(k.kab_code).padStart(4, '0') : null
  const provCode = k.code ? String(k.code).padStart(2, '0') : null
  const live = data?.asistensi?.data_source === 'langsung'
  const kab = live && kabCode
    ? (data.asistensi.wilayah_kabkota || []).find((r: any) => String(r.kode_wilayah).padStart(4, '0') === kabCode)
    : null
  const prov = live && provCode
    ? (data.asistensi.wilayah || []).find((r: any) => String(r.kode_wilayah).padStart(2, '0') === provCode && r.level === 'provinsi')
    : null
  const row = kab || prov
  if (!live) return { tersedia: false, level: null, kapasitas: null, irbi: null, poin: null, sumber: 'API Asistensi Risiko' }
  if (!row) return { tersedia: false, level: null, kapasitas: null, irbi: null, poin: null, sumber: 'API Asistensi Risiko', catatan: 'Wilayah ini tidak ada di data Asistensi yang termuat.' }
  return {
    tersedia: true,
    level: kab ? 'kabupaten/kota' : 'provinsi',
    nama: row.nama || (kab ? k.kabupaten : k.provinsi),
    kapasitas: row.status_kapasitas || null,
    irbi: row.status_risiko_irbi || row.status_risiko_irbi_2024 || null,
    poin: typeof row.poin_kapasitas_pct === 'number' ? row.poin_kapasitas_pct : null,
    tahun: data.asistensi?.tahun || null,
    sumber: 'API Asistensi Risiko',
  }
}

export function riwayat12Bulan(data: any, k: any, regionName: Record<string, string>) {
  const uid = String(k.uid)
  const events: any[] = data?.eoc?.events || []
  if (data?.eoc?.data_source !== 'langsung' || !events.length) {
    return { tersedia: false, dari: null, sampai: null, kab: [], prov: [], tren: [], tren30: [], korbanTren: [], korban30: [], pin: [] }
  }
  const sampai = todayWib()
  const d = new Date(`${sampai}T00:00:00+07:00`)
  d.setMonth(d.getMonth() - 12)
  const dari = d.toISOString().slice(0, 10)
  const mapped = events
    .filter((e: any) => e.t >= dari && e.t <= sampai && String(e.u) !== uid)
    .map((e: any) => eocKejadian(e, regionName))
  const kab = k.kab_code
    ? mapped.filter((x: any) => x.kab_code && String(x.kab_code) === String(k.kab_code))
    : mapped.filter((x: any) => x.kabupaten && k.kabupaten && String(x.kabupaten).toLowerCase() === String(k.kabupaten).toLowerCase() && x.code === k.code)
  const prov = mapped.filter((x: any) => x.code === k.code)
  const trenMap = new Map<string, { bulan: string; kab: number; prov: number; serupa_kab: number }>()
  const fillMonths = () => {
    const cur = new Date(`${dari}T00:00:00+07:00`)
    const end = new Date(`${sampai}T00:00:00+07:00`)
    while (cur <= end) {
      const key = cur.toISOString().slice(0, 7)
      trenMap.set(key, { bulan: key, kab: 0, prov: 0, serupa_kab: 0 })
      cur.setMonth(cur.getMonth() + 1)
    }
  }
  fillMonths()
  for (const x of prov) {
    const key = String(x.tanggal || '').slice(0, 7)
    const row = trenMap.get(key)
    if (row) row.prov += 1
  }
  for (const x of kab) {
    const key = String(x.tanggal || '').slice(0, 7)
    const row = trenMap.get(key)
    if (row) {
      row.kab += 1
      if (x.jenis && k.jenis && x.jenis === k.jenis) row.serupa_kab += 1
    }
  }
  const pin = kab
    .filter((x: any) => x.lat != null && x.lon != null)
    .map((x: any) => ({
      uid: x.uid, jenis: x.jenis, tanggal: x.tanggal, jam: x.jam, krisis: Boolean(x.krisis),
      lat: x.lat, lon: x.lon, meninggal: x.meninggal, pengungsi: x.pengungsi, terdampak: x.terdampak,
      kabupaten: x.kabupaten, serupa: Boolean(x.jenis && k.jenis && x.jenis === k.jenis),
    }))

  const d30 = new Date(`${sampai}T00:00:00+07:00`)
  d30.setDate(d30.getDate() - 30)
  const dari30 = d30.toISOString().slice(0, 10)
  const tren30Map = new Map<string, { tanggal: string; kab: number; serupa_kab: number }>()
  const korban30Map = new Map<string, { tanggal: string; meninggal: number; luka: number; pengungsi: number }>()
  const korbanMap = new Map<string, { bulan: string; meninggal: number; luka: number; pengungsi: number }>()
  {
    const cur = new Date(`${dari30}T00:00:00+07:00`)
    const end = new Date(`${sampai}T00:00:00+07:00`)
    while (cur <= end) {
      const key = cur.toISOString().slice(0, 10)
      tren30Map.set(key, { tanggal: key, kab: 0, serupa_kab: 0 })
      korban30Map.set(key, { tanggal: key, meninggal: 0, luka: 0, pengungsi: 0 })
      cur.setDate(cur.getDate() + 1)
    }
  }
  for (const row of trenMap.values()) korbanMap.set(row.bulan, { bulan: row.bulan, meninggal: 0, luka: 0, pengungsi: 0 })
  for (const x of kab) {
    const day = String(x.tanggal || '').slice(0, 10)
    const month = day.slice(0, 7)
    const t30 = tren30Map.get(day)
    if (t30) {
      t30.kab += 1
      if (x.jenis && k.jenis && x.jenis === k.jenis) t30.serupa_kab += 1
    }
    const c30 = korban30Map.get(day)
    if (c30) {
      c30.meninggal += Number(x.meninggal || 0)
      c30.luka += Number(x.luka_berat || 0) + Number(x.luka_ringan || 0)
      c30.pengungsi += Number(x.pengungsi || 0)
    }
    const cm = korbanMap.get(month)
    if (cm) {
      cm.meninggal += Number(x.meninggal || 0)
      cm.luka += Number(x.luka_berat || 0) + Number(x.luka_ringan || 0)
      cm.pengungsi += Number(x.pengungsi || 0)
    }
  }

  return {
    tersedia: true,
    dari, sampai,
    kab: { total: kab.length, serupa: kab.filter((x: any) => x.jenis === k.jenis).length, krisis: kab.filter((x: any) => x.krisis).length },
    prov: { total: prov.length, serupa: prov.filter((x: any) => x.jenis === k.jenis).length, krisis: prov.filter((x: any) => x.krisis).length },
    tren: [...trenMap.values()],
    tren30: [...tren30Map.values()],
    korbanTren: [...korbanMap.values()],
    korban30: [...korban30Map.values()],
    pin,
  }
}

export type Rekom = { prioritas: 'tinggi' | 'sedang' | 'info'; judul: string; dasar: string }

export function rekomendasiDariData(k: any, nearby: any, risiko: any, status: ReturnType<typeof statusOperasional>): Rekom[] {
  const out: Rekom[] = []
  const korban = Number(k.meninggal || 0) + Number(k.luka_berat || 0)
  const luka = korban + Number(k.luka_ringan || 0)
  if (k.krisis && korban > 0) {
    out.push({ prioritas: 'tinggi', judul: 'Ada korban jiwa atau luka berat pada kejadian krisis', dasar: `EOC: ${fmtAngka(k.meninggal)} meninggal, ${fmtAngka(k.luka_berat)} luka berat.` })
  }
  if (Number(k.faskes_rusak || 0) > 0) {
    out.push({ prioritas: 'tinggi', judul: 'Ada faskes rusak yang perlu asesmen', dasar: `EOC mencatat ${fmtAngka(k.faskes_rusak)} faskes rusak.` })
  }
  if (nearby?.ambulans?.tersedia && nearby.ambulans.siap === 0 && luka > 0) {
    out.push({ prioritas: 'tinggi', judul: 'Tidak ada ambulans siap di sekitar, sementara ada korban', dasar: `Korban tercatat ${fmtAngka(luka)} (meninggal/luka). Ambulans siap dalam ${nearby.radius_km} km: 0.` })
  }
  if (nearby?.psc?.tersedia && nearby.psc.aktif === 0) {
    out.push({ prioritas: 'sedang', judul: 'Tidak ada PSC aktif di kab/kota yang sama atau dalam radius 50 km', dasar: `API PSC 119: 0 PSC aktif dari ${fmtAngka(nearby.psc.total)} titik di sekitar lokasi.` })
  }
  if (Number(k.pengungsi || 0) > 0) {
    out.push({ prioritas: 'sedang', judul: 'Pantau layanan kesehatan di titik pengungsian', dasar: `EOC mencatat ${fmtAngka(k.pengungsi)} pengungsi.` })
  }
  if (risiko?.tersedia && /rendah|belum/i.test(String(risiko.kapasitas || '')) && k.krisis) {
    out.push({ prioritas: 'sedang', judul: 'Kapasitas asistensi wilayah rendah atau belum diisi', dasar: `API Asistensi: status kapasitas ${risiko.kapasitas}${risiko.level ? ` (${risiko.level})` : ''}.` })
  }
  if (risiko?.tersedia && /tinggi/i.test(String(risiko.irbi || ''))) {
    out.push({ prioritas: 'info', judul: 'Wilayah memiliki status IRBI tinggi', dasar: `API Asistensi: IRBI ${risiko.irbi}${risiko.level ? ` (${risiko.level})` : ''}.` })
  }
  if (status.hari != null && status.hari > 30 && k.krisis) {
    out.push({ prioritas: 'info', judul: 'Kejadian krisis berumur lebih dari 30 hari', dasar: `Hari sejak kejadian: ${status.hari}. Status operasional: ${status.label}.` })
  }
  return out
}