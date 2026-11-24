import { eocKejadian } from '@/lib/puskris/derive'
import { haversineKm } from '@/lib/puskris/integrasi'
import { fmtAngka } from '@/lib/puskris/eoc-markers'
import { pieNamaKey } from '@/lib/puskris/risiko-pie'

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
    psc: pscLive ? { tersedia: true, total: psc.length, aktif: psc.filter((p) => p.a === 1).length, daftar: pscList.slice(0, 24) } : { tersedia: false },
    ambulans: pscLive ? { tersedia: true, total: amb.length, siap: amb.filter((a) => a[2] === 1).length } : { tersedia: false },
    rs: pscLive && rsNear != null ? { tersedia: true, total: rsNear, catatan: 'Jumlah titik rumah sakit jejaring berkoordinat dalam radius. Nama faskes tidak dikirim API untuk titik ini.' } : { tersedia: false },
    tck: tckLive && tck ? {
      tersedia: tck.individu != null || tck.tim != null,
      level: 'provinsi', provinsi: tck.nama || k.provinsi,
      individu: tck.individu != null ? Number(tck.individu) : null,
      nakes: tck.nakes != null ? Number(tck.nakes) : null,
      non_nakes: tck.non_nakes != null ? Number(tck.non_nakes) : null,
      perempuan: tck.perempuan != null ? Number(tck.perempuan) : null,
      laki: tck.laki != null ? Number(tck.laki) : null,
      terhubung_tim: tck.terhubung_tim != null ? Number(tck.terhubung_tim) : null,
      usia: Array.isArray(tck.usia) ? tck.usia.map((n: any) => Number(n) || 0) : null,
      profesi: tck.profesi && typeof tck.profesi === 'object' ? tck.profesi : null,
      kab: Array.isArray(tck.kab) ? tck.kab : [],
      tim: tck.tim != null ? Number(tck.tim) : null,
      tim_individu: tck.tim_individu != null ? Number(tck.tim_individu) : null,
      emt: tck.emt != null ? Number(tck.emt) : null,
      emt_standar: tck.emt_standar != null ? Number(tck.emt_standar) : null,
      emt_sk: tck.emt_sk != null ? Number(tck.emt_sk) : null,
      emt_individu: tck.emt_individu != null ? Number(tck.emt_individu) : null,
      emt_respon_24: tck.emt_respon_24 != null ? Number(tck.emt_respon_24) : null,
    } : { tersedia: false },
    logistik: logLive && logistik ? (() => {
      const nama = logistik.nama || logistik.wilayah || 'Regional'
      const namaKey = String(nama).toLowerCase()
      const matchReg = (r: any) => {
        const n = String(r?.regional || '').toLowerCase()
        return n === namaKey || n.startsWith(namaKey) || namaKey.startsWith(n)
      }
      const KAT = [
        { key: 'obat', nama: 'Obat-Obatan' },
        { key: 'bmhp', nama: 'Bahan Medis Habis Pakai' },
        { key: 'alkes', nama: 'Alat Kesehatan' },
        { key: 'sarpras', nama: 'Sarana dan Prasarana' },
        { key: 'lainnya', nama: 'Logistik Lainnya' },
      ]
      return {
        tersedia: true,
        level: 'regional' as const,
        id: logistik.id ?? null,
        nama,
        total: Number(logistik.total || logistik.stok || 0),
        barang: logistik.barang != null ? Number(logistik.barang) : null,
        masuk: logistik.masuk != null ? Number(logistik.masuk) : null,
        keluar: logistik.keluar != null ? Number(logistik.keluar) : null,
        awal: logistik.awal != null ? Number(logistik.awal) : null,
        kedaluwarsa: logistik.kedaluwarsa != null ? Number(logistik.kedaluwarsa) : null,
        segera_kedaluwarsa: logistik.segera_kedaluwarsa != null ? Number(logistik.segera_kedaluwarsa) : null,
        stok_kedaluwarsa: logistik.stok_kedaluwarsa != null ? Number(logistik.stok_kedaluwarsa) : null,
        stok_negatif: logistik.stok_negatif != null ? Number(logistik.stok_negatif) : null,
        kategori: KAT.map((k) => ({ ...k, stok: Number(logistik[k.key] || 0) })),
        barang_teratas: (data?.logistik?.barang_teratas || []).filter(matchReg).slice(0, 15),
        kedaluwarsa_daftar: (data?.logistik?.kedaluwarsa || []).filter(matchReg).slice(0, 15),
        tren: (data?.logistik?.pergerakan?.per_regional_bulanan?.[String(logistik.id)] || data?.logistik?.pergerakan?.per_regional_bulanan?.[logistik.id] || []),
      }
    })() : { tersedia: false },
  }
}

/** Kode kab/kota 4 digit dari berbagai format (1301, 13.01, 01301). */
export function kodeKab4(raw: unknown): string | null {
  const d = String(raw ?? '').replace(/\D/g, '')
  if (!d) return null
  if (d.length <= 4) return d.padStart(4, '0')
  if (d.length === 5 && d.startsWith('0')) return d.slice(-4)
  return d.slice(0, 4)
}

function namaKabCocok(a?: string | null, b?: string | null) {
  if (!a || !b) return false
  return pieNamaKey(String(a)) === pieNamaKey(String(b))
}

function cariKabAsistensi(list: any[], kabCode: string | null, kabNama: string | null, provCode: string | null) {
  const want = kabCode ? kodeKab4(kabCode) : null
  const inProv = provCode
    ? list.filter((r) => {
        const prop = String(r.kd_prop || kodeKab4(r.kode_wilayah) || '').replace(/\D/g, '').padStart(2, '0').slice(0, 2)
        return prop === provCode
      })
    : list
  const byCode = want
    ? (inProv.find((r) => kodeKab4(r.kode_wilayah) === want) || list.find((r) => kodeKab4(r.kode_wilayah) === want) || null)
    : null
  const byName = kabNama ? (inProv.find((r) => namaKabCocok(r.nama, kabNama)) || list.find((r) => namaKabCocok(r.nama, kabNama)) || null) : null
  if (byCode && kabNama && !namaKabCocok(byCode.nama, kabNama)) {
    // Kode dan nama tidak selaras (mis. 1301 terpasang ke Mentawai): utamakan nama, atau buang baris kab.
    return byName || null
  }
  return byCode || byName || null
}

export function risikoWilayah(data: any, k: any) {
  const kabCode = k.kab_code ? kodeKab4(k.kab_code) : null
  const provCode = k.code ? String(k.code).replace(/\D/g, '').padStart(2, '0').slice(0, 2) : null
  const live = data?.asistensi?.data_source === 'langsung'
  const kab = live ? cariKabAsistensi(data.asistensi.wilayah_kabkota || [], kabCode, k.kabupaten || null, provCode) : null
  const prov = live && provCode
    ? (data.asistensi.wilayah || []).find((r: any) => String(r.kode_wilayah).padStart(2, '0') === provCode && r.level === 'provinsi')
    : null
  const row = kab || prov
  if (!live) return { tersedia: false, level: null, kapasitas: null, irbi: null, poin: null, sumber: 'API Asistensi Risiko', kab: null, prov: null }
  if (!row) return { tersedia: false, level: null, kapasitas: null, irbi: null, poin: null, sumber: 'API Asistensi Risiko', catatan: 'Wilayah ini tidak ada di data Asistensi yang termuat.', kab: null, prov: null }
  const pack = (r: any, level: 'kabupaten/kota' | 'provinsi', fallback: string | null) => r ? {
    level,
    nama: r.nama || fallback,
    kapasitas: r.status_kapasitas || null,
    irbi: r.status_risiko_irbi || r.status_risiko_irbi_2024 || null,
    poin: typeof r.poin_kapasitas_pct === 'number' ? r.poin_kapasitas_pct : null,
  } : null
  const kabRow = pack(kab, 'kabupaten/kota', k.kabupaten || null)
  const provRow = pack(prov, 'provinsi', k.provinsi || null)
  const utama = kabRow || provRow
  return {
    tersedia: true,
    level: utama?.level || null,
    nama: utama?.nama || null,
    kapasitas: utama?.kapasitas || null,
    irbi: utama?.irbi || null,
    poin: utama?.poin ?? null,
    tahun: data.asistensi?.tahun || null,
    sumber: 'API Asistensi Risiko',
    kab: kabRow,
    prov: provRow,
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

export type AnalisaItem = { id: string; tingkat: 'tinggi' | 'sedang' | 'info'; teks: string }

function jumlahJendela(rows: any[] | undefined, field: string, jam: number) {
  if (!rows?.length) return null
  const now = Date.now()
  const from = now - jam * 3600_000
  let sum = 0
  let n = 0
  for (const r of rows) {
    const ts = Date.parse(String(r.waktu || r.tanggal || ''))
    if (!Number.isFinite(ts) || ts < from || ts > now) continue
    const v = r[field]
    if (v == null || Number.isNaN(Number(v))) continue
    sum += Number(v)
    n += 1
  }
  return n ? Math.round(sum * 10) / 10 : null
}

/** Lencana singkat dari angka API saja. Item tanpa data disembunyikan. */
export function analisaDariData(
  k: any,
  nearby: any,
  risiko: any,
  status: ReturnType<typeof statusOperasional> | null,
  konteks?: any,
  pieKab?: { disease: string; status: string }[] | null,
): AnalisaItem[] {
  const out: AnalisaItem[] = []
  const push = (id: string, tingkat: AnalisaItem['tingkat'], teks: string) => { out.push({ id, tingkat, teks }) }

  if (Number(k?.meninggal || 0) > 0 || Number(k?.luka_berat || 0) > 0) {
    push('korban', 'tinggi', `Korban EOC: ${fmtAngka(k.meninggal)} meninggal, ${fmtAngka(k.luka_berat)} luka berat.`)
  }
  if (Number(k?.faskes_rusak || 0) > 0) {
    push('faskes-rusak', 'tinggi', `Ada ${fmtAngka(k.faskes_rusak)} faskes rusak (EOC).`)
  }
  const amb = nearby?.ambulans
  if (amb?.tersedia && amb.total != null && amb.siap != null && amb.total > 0) {
    const rasio = amb.siap / amb.total
    if (amb.siap === 0) push('amb', 'tinggi', `Tidak ada ambulans siap (${fmtAngka(amb.siap)}/${fmtAngka(amb.total)}) dalam ${nearby.radius_km} km.`)
    else if (rasio <= 0.2) push('amb', 'sedang', `Ambulans siap rendah (${fmtAngka(amb.siap)}/${fmtAngka(amb.total)}) dalam ${nearby.radius_km} km.`)
  }
  const psc = nearby?.psc
  if (psc?.tersedia && psc.total != null && psc.aktif != null && psc.total > 0) {
    if (psc.aktif === 0) push('psc', 'sedang', `Tidak ada PSC aktif (${fmtAngka(psc.aktif)}/${fmtAngka(psc.total)}) dalam ${nearby.radius_km} km.`)
    else if (psc.total - psc.aktif >= psc.aktif) push('psc', 'info', `${fmtAngka(psc.total - psc.aktif)} dari ${fmtAngka(psc.total)} PSC di sekitar tidak aktif.`)
  }
  const rs = nearby?.rs
  if (rs?.tersedia && rs.total === 0) {
    push('rs', 'info', `Tidak ada RS jejaring berkoordinat dalam ${nearby.radius_km} km.`)
  }
  const log = nearby?.logistik
  if (log?.tersedia) {
    if (Number(log.kedaluwarsa || 0) > 0) {
      push('kedaluarsa', 'sedang', `Stok kedaluwarsa ${fmtAngka(log.kedaluwarsa)} item di regional ${log.nama || 'terkait'}.`)
    }
    if (Number(log.segera_kedaluwarsa || 0) > 0) {
      push('segera-kedaluarsa', 'info', `${fmtAngka(log.segera_kedaluwarsa)} item segera kedaluwarsa di regional ${log.nama || 'terkait'}.`)
    }
    if (Number(log.stok_negatif || 0) > 0) {
      push('stok-negatif', 'sedang', `Ada ${fmtAngka(log.stok_negatif)} stok negatif di regional ${log.nama || 'terkait'}.`)
    }
  }
  const irbiRow = risiko?.kab || risiko
  if (risiko?.tersedia && /tinggi/i.test(String(irbiRow?.irbi || risiko.irbi || ''))) {
    const nama = irbiRow?.nama || risiko.nama
    push('irbi', 'sedang', `IRBI ${irbiRow?.irbi || risiko.irbi}${nama ? ` di ${nama}` : ''} (API Asistensi).`)
  }
  const kapRow = risiko?.kab || risiko
  if (risiko?.tersedia && /rendah|belum/i.test(String(kapRow?.kapasitas || risiko.kapasitas || ''))) {
    const nama = kapRow?.nama || risiko.nama
    push('kapasitas', 'sedang', `Kapasitas ${kapRow?.kapasitas || risiko.kapasitas}${nama ? ` di ${nama}` : ''} (API Asistensi).`)
  }
  if (Number(k?.pengungsi || 0) > 0) {
    push('pengungsi', 'sedang', `${fmtAngka(k.pengungsi)} pengungsi tercatat di EOC.`)
  }
  const tck = nearby?.tck
  if (tck?.tersedia && tck.individu === 0) {
    push('tck', 'info', `Belum ada relawan TCK tercatat di ${tck.provinsi || 'provinsi ini'}.`)
  }
  const pieTinggi = (pieKab || []).filter((p) => /tinggi/i.test(String(p.status || '')))
  if (pieTinggi.length) {
    const nama = pieTinggi.slice(0, 3).map((p) => p.disease).filter(Boolean).join(', ')
    push('pie', 'sedang', `PIE status tinggi: ${fmtAngka(pieTinggi.length)} penyakit${nama ? ` (${nama})` : ''} di kab/kota ini.`)
  }
  if (konteks) {
    const hujan24 = jumlahJendela(konteks.cuaca?.jam, 'hujan_mm', 24)
    const hujan7 = jumlahJendela(konteks.cuaca?.jam, 'hujan_mm', 24 * 7)
    if (hujan24 != null && hujan24 >= 50) {
      push('hujan', 'sedang', `Hujan 24 jam ${hujan24.toLocaleString('id-ID')} mm (model Open-Meteo, bukan peringatan BMKG).`)
    } else if (hujan7 != null && hujan7 >= 100) {
      push('hujan', 'info', `Hujan 7 hari ${hujan7.toLocaleString('id-ID')} mm (model Open-Meteo, bukan peringatan BMKG).`)
    }
    const aqi = konteks.udara?.saat_ini?.us_aqi
    if (aqi != null && Number(aqi) >= 100) {
      push('udara', 'sedang', `US AQI ${Math.round(Number(aqi))} (model CAMS, bukan ISPU resmi).`)
    }
    const fire24 = konteks.karhutla?.total_24jam
    const fire7 = konteks.karhutla?.total_7hari ?? konteks.karhutla?.total
    if (fire24 != null && Number(fire24) > 0) {
      push('firms', 'sedang', `${fmtAngka(fire24)} titik panas FIRMS dalam 24 jam (radius 50 km).`)
    } else if (fire7 != null && Number(fire7) > 0) {
      push('firms', 'info', `${fmtAngka(fire7)} titik panas FIRMS dalam 7 hari (radius 50 km).`)
    }
    const harian = konteks.banjir?.harian || []
    const last = [...harian].reverse().find((r: any) => r?.debit != null && r?.debit_rerata != null)
    if (last && Number(last.debit_rerata) > 0 && Number(last.debit) > Number(last.debit_rerata) * 1.5) {
      push('debit', 'info', `Debit model GloFAS di atas rerata (${Number(last.debit).toLocaleString('id-ID')} vs ${Number(last.debit_rerata).toLocaleString('id-ID')}).`)
    }
    const gempa = (konteks.bahaya?.items || []).filter((it: any) => it.magnitude != null && Number(it.magnitude) >= 5)
    if (gempa.length) {
      const maxM = Math.max(...gempa.map((it: any) => Number(it.magnitude)))
      push('gempa', 'info', `${fmtAngka(gempa.length)} gempa M≥5 di sekitar titik (BMKG/GDACS), terbesar M${maxM.toLocaleString('id-ID', { maximumFractionDigits: 1 })}.`)
    }
  }
  if (status?.hari != null && status.hari > 30 && k?.krisis) {
    push('umur', 'info', `Krisis sudah ${status.hari} hari (status: ${status.label || 'terpantau'}).`)
  }
  const order = { tinggi: 0, sedang: 1, info: 2 }
  return out.sort((a, b) => order[a.tingkat] - order[b.tingkat]).slice(0, 8)
}


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