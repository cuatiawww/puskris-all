/**
 * API Logistik Kesehatan (SIMLOGKES) di sisi server. POST form, header TTOKEN (env PUSKRIS_TTOKEN).
 * Hanya baca: data-regional, data-stok-logistik (per regional), pergerakan-stok (sampel barang teratas).
 * Field pribadi dibuang di sini: nama_pj, telp_pj, email_pj, alamat_lokasi_lab, petugas_logistik, foto_barang.
 */
import { pool, postForm } from './puskris-live'

const LOG_BASE = (process.env.PUSKRIS_LOGISTIK_BASE || 'https://pusatkrisis.kemkes.go.id/logistik/web_api').replace(/\/$/, '')
const ep = (p: string) => `${LOG_BASE}/${p}`

export const LOG_KATEGORI: { key: 'obat' | 'bmhp' | 'alkes' | 'sarpras' | 'lainnya'; kode: string; nama: string }[] = [
  { key: 'obat', kode: 'OBAT', nama: 'Obat-Obatan' },
  { key: 'bmhp', kode: 'BMHP', nama: 'Bahan Medis Habis Pakai (BMHP)' },
  { key: 'alkes', kode: 'ALKES', nama: 'Alat Kesehatan (Alkes)' },
  { key: 'sarpras', kode: 'SPRA', nama: 'Sarana dan Prasarana (Sarpras)' },
  { key: 'lainnya', kode: '05', nama: 'Logistik Lainnya' },
]
const katKey = (kode: string, nama: string) =>
  LOG_KATEGORI.find((k) => k.kode === String(kode).trim().toUpperCase())?.key
  || (/obat/i.test(nama) ? 'obat' : /habis pakai|bmhp/i.test(nama) ? 'bmhp' : /alat kes/i.test(nama) ? 'alkes' : /sarana|prasarana/i.test(nama) ? 'sarpras' : 'lainnya')

const trim = (v: any) => String(v ?? '').trim()
const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0)
const todayWib = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)
const addDays = (d: string, n: number) => new Date(Date.parse(d) + n * 86400_000).toISOString().slice(0, 10)

export async function fetchLogistik(opts: { sampelPerRegional?: number } = {}) {
  const nSampel = opts.sampelPerRegional ?? 10
  const reg = await postForm(ep('v1/data-regional'), { id_regional: '' }, 30_000)
  const regionals = (reg?.data || []).map((r: any) => ({
    id: num(r.id_regional), nama: trim(r.nama_regional),
    wilayah: (r.wilayah_regional || []).map((c: any) => trim(c).padStart(2, '0')),
  }))
  const today = todayWib()
  const in90 = addDays(today, 90)
  const gagal: string[] = []
  const stokLists = await pool(regionals, 4, async (r: any) => {
    try {
      const j = await postForm(ep('v1/data-stok-logistik'), { id_regional: r.id }, 90_000)
      return (j?.data || []).map((x: any) => ({
        reg: r.id,
        idBarang: num(x.kode_barang?.id), kode: trim(x.kode_barang?.kode), nama: trim(x.nama_barang),
        kat: katKey(x.jenis_barang?.kode, x.jenis_barang?.nama), satuan: trim(x.satuan?.nama),
        asalId: num(x.asal_pengirim?.id), asal: trim(x.asal_pengirim?.nama),
        awal: num(x.jurnal_stok?.saldo_awal), masuk: num(x.jurnal_stok?.transaksi_masuk), keluar: num(x.jurnal_stok?.transaksi_keluar),
        stok: num(x.jurnal_stok?.stok_akhir), exp: /^\d{4}-\d{2}-\d{2}/.test(trim(x.expired_date)) ? trim(x.expired_date).slice(0, 10) : null,
      }))
    } catch (e: any) {
      gagal.push(`${r.nama}: ${String(e?.message || e)}`)
      return null
    }
  })
  if (stokLists.every((l) => l == null)) throw new Error(gagal[0] || 'Gagal mengambil stok')
  const items = stokLists.flatMap((l) => l || [])

  // Pergerakan stok: API butuh id_barang + id_regional + id_asal_pengirim (ketiganya wajib),
  // jadi hanya sampel N barang dengan transaksi terbesar per regional (≈).
  const sampel: any[] = []
  for (const r of regionals) {
    sampel.push(...items.filter((x) => x.reg === r.id && x.masuk + x.keluar > 0).sort((a, b) => b.masuk + b.keluar - (a.masuk + a.keluar)).slice(0, nSampel))
  }
  const bulanan: Record<string, { penerimaan: number; pengeluaran: number; transaksi: number }> = {}
  const perReg: Record<number, Record<string, { penerimaan: number; pengeluaran: number }>> = {}
  const jenisKeluar: Record<string, number> = {}
  const jenisMasuk: Record<string, number> = {}
  let sampelOk = 0
  await pool(sampel, 6, async (x) => {
    try {
      const j = await postForm(ep('v1/pergerakan-stok'), { id_barang: x.idBarang, id_regional: x.reg, id_asal_pengirim: x.asalId }, 30_000)
      sampelOk++
      for (const t of j?.data || []) {
        const b = trim(t.tanggal).slice(0, 7)
        if (!/^\d{4}-\d{2}$/.test(b)) continue
        const m = (bulanan[b] ||= { penerimaan: 0, pengeluaran: 0, transaksi: 0 })
        const pr = ((perReg[x.reg] ||= {})[b] ||= { penerimaan: 0, pengeluaran: 0 })
        const jt = trim(t.jenis_transaksi)
        if (jt === 'Stok Awal') continue
        m.penerimaan += num(t.penerimaan); m.pengeluaran += num(t.pengeluaran); m.transaksi++
        pr.penerimaan += num(t.penerimaan); pr.pengeluaran += num(t.pengeluaran)
        if (num(t.pengeluaran) > 0) {
          const k = /^pindah depo/i.test(trim(t.jenis_pengeluaran)) ? 'Pindah depo antarregional' : trim(t.jenis_pengeluaran).replace(/\s*\(.*$/, '').replace(/^-$/, '') || 'Tidak disebut'
          jenisKeluar[k] = (jenisKeluar[k] || 0) + num(t.pengeluaran)
        }
        if (num(t.penerimaan) > 0) {
          // "Pindah Depo Regional (Dikirim dari <nama petugas>)" memuat nama orang → buang isi kurung.
          const k = /^pindah depo/i.test(trim(t.jenis_penerimaan)) ? 'Pindah depo antarregional' : trim(t.jenis_penerimaan).replace(/\s*\(.*$/, '').replace(/^-$/, '') || 'Tidak disebut'
          jenisMasuk[k] = (jenisMasuk[k] || 0) + num(t.penerimaan)
        }
        // petugas_logistik, id_transaksi, sumber_penerimaan tidak disimpan
      }
    } catch { /* lewati barang ini */ }
  })
  const vol = (l: any[]) => l.reduce((a, x) => a + x.masuk + x.keluar, 0)
  const cakupan = vol(items) ? Math.round((vol(sampel) / vol(items)) * 1000) / 10 : 0

  const sumBy = (l: any[]) => {
    const o: any = { barang: l.length, stok: 0, masuk: 0, keluar: 0, awal: 0, kedaluwarsa: 0, segera_kedaluwarsa: 0, stok_kedaluwarsa: 0, stok_negatif: 0 }
    for (const k of LOG_KATEGORI) o[k.key] = 0
    for (const x of l) {
      const s = Math.max(0, x.stok)
      o.stok += s; o.masuk += x.masuk; o.keluar += x.keluar; o.awal += x.awal; o[x.kat] += s
      if (x.stok < 0) o.stok_negatif++
      if (x.exp && x.stok > 0) {
        if (x.exp < today) { o.kedaluwarsa++; o.stok_kedaluwarsa += x.stok } else if (x.exp <= in90) o.segera_kedaluwarsa++
      }
    }
    return o
  }
  return {
    regional: regionals.map((r: any) => ({ ...r, ...sumBy(items.filter((x) => x.reg === r.id)), gagal: stokLists[regionals.indexOf(r)] == null })),
    nasional: { ...sumBy(items), barang_unik: new Set(items.map((x) => x.idBarang)).size, dengan_kedaluwarsa: items.filter((x) => x.exp).length },
    kategori: LOG_KATEGORI.map((k) => ({ key: k.key, nama: k.nama, ...(() => { const l = items.filter((x) => x.kat === k.key); return { barang: l.length, stok: l.reduce((a, x) => a + Math.max(0, x.stok), 0), masuk: l.reduce((a, x) => a + x.masuk, 0), keluar: l.reduce((a, x) => a + x.keluar, 0) } })() })),
    barang_teratas: [...items].sort((a, b) => b.stok - a.stok).slice(0, 20).map((x) => ({ nama: x.nama, kategori: x.kat, satuan: x.satuan, stok: x.stok, regional: regionals.find((r: any) => r.id === x.reg)?.nama || '' })),
    kedaluwarsa: items.filter((x) => x.exp && x.stok > 0 && x.exp <= in90).sort((a, b) => a.exp!.localeCompare(b.exp!)).slice(0, 30)
      .map((x) => ({ nama: x.nama, kategori: x.kat, satuan: x.satuan, stok: x.stok, regional: regionals.find((r: any) => r.id === x.reg)?.nama || '', expired: x.exp, lewat: x.exp! < today })),
    asal_teratas: Object.entries(items.reduce((a: Record<string, number>, x) => { const k = x.asal || 'Tidak diketahui'; a[k] = (a[k] || 0) + 1; return a }, {}))
      .sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 8).map(([nama, barang]) => ({ nama, barang: Number(barang) })),
    pergerakan: {
      sampel_barang: sampel.length, sampel_berhasil: sampelOk, per_regional: nSampel, cakupan_volume_pct: cakupan,
      bulanan: Object.entries(bulanan).map(([bulan, v]) => ({ bulan, ...v })).sort((a, b) => a.bulan.localeCompare(b.bulan)),
      per_regional_bulanan: Object.fromEntries(Object.entries(perReg).map(([id, m]) => [id, Object.entries(m).map(([bulan, v]) => ({ bulan, ...v })).sort((a, b) => a.bulan.localeCompare(b.bulan))])),
      jenis_pengeluaran: Object.entries(jenisKeluar).map(([nama, jumlah]) => ({ nama, jumlah })).sort((a, b) => b.jumlah - a.jumlah),
      jenis_penerimaan: Object.entries(jenisMasuk).map(([nama, jumlah]) => ({ nama, jumlah })).sort((a, b) => b.jumlah - a.jumlah),
    },
    gagal,
  }
}
