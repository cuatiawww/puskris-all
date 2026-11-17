/**
 * API Tenaga Cadangan Kesehatan (TCK) — dikonsumsi di server dengan token PUSKRIS_TTOKEN.
 * Endpoint baca saja: dashboard-all, data-emt, data-tim, relawan-tck (per provinsi).
 * data-individu dan sisdmk (sertifikat/kegiatan per NIK) TIDAK dipanggil.
 * Keluaran hanya agregat: nama, NIK, telepon, email, alamat, foto, koordinator, koordinat individu dibuang
 * di sini dan tidak pernah disimpan / dicatat / dikirim ke browser.
 */
import { pool, postForm } from './puskris-live'
import { persist, REVALIDATE } from './persist'

const TCK_BASE = (process.env.PUSKRIS_TCK_BASE || 'https://tenagacadangankesehatan.kemkes.go.id/web/web_api').replace(/\/$/, '')
const ep = (p: string) => `${TCK_BASE}/${p}`

const pad2 = (v: any) => String(v ?? '').trim().padStart(2, '0')
const trimS = (v: any) => String(v ?? '').trim()

export async function fetchTckInti() {
  const [dash, emt, tim] = await Promise.all([
    postForm(ep('v1/dashboard-all'), { kd_prop: '', jenis_tenaga: '' }, 60_000),
    postForm(ep('v1/data-emt'), {}, 90_000),
    postForm(ep('v1/data-tim'), {}, 90_000),
  ])
  const agg = (list: any[], kind: 'emt' | 'tim') => {
    const prov: Record<string, any> = {}
    const jenis: Record<string, number> = {}
    const respon: Record<string, number> = {}
    const tahun: Record<string, number> = {}
    let standar = 0
    let sk = 0
    let individu = 0
    let nakes = 0
    let non = 0
    for (const r of list) {
      const code = pad2(r.kd_prov_dagri)
      const p = (prov[code] ||= { code, jumlah: 0, standar: 0, sk: 0, individu: 0, nakes: 0, non_nakes: 0, respon_24: 0, per_tahun: {} as Record<string, number> })
      const th = trimS(r.join_date).slice(0, 4)
      const isStd = /memenuhi tipe/i.test(trimS(r.standar_emt))
      const isSk = /memiliki sk/i.test(trimS(r.status_sk))
      const ji = Number(r.jumlah_individu || 0)
      const jn = Number(r.jumlah_nakes || 0)
      const jx = Number(r.jumlah_non_nakes || 0)
      p.jumlah++
      if (isStd) { p.standar++; standar++ }
      if (isSk) { p.sk++; sk++ }
      p.individu += ji; p.nakes += jn; p.non_nakes += jx
      individu += ji; nakes += jn; non += jx
      if (trimS(r.waktu_respon) === '<24 Jam') p.respon_24++
      if (/^\d{4}$/.test(th)) { p.per_tahun[th] = (p.per_tahun[th] || 0) + 1; tahun[th] = (tahun[th] || 0) + 1 }
      const jn0 = trimS(r.jenis) || 'Tidak diisi'
      jenis[jn0] = (jenis[jn0] || 0) + 1
      const rs = trimS(r.waktu_respon) || 'Belum Di Set'
      respon[rs] = (respon[rs] || 0) + 1
    }
    const toList = (o: Record<string, number>) => Object.entries(o).map(([nama, jumlah]) => ({ nama, jumlah })).sort((a, b) => b.jumlah - a.jumlah)
    return {
      kind, total: list.length, standar, sk, individu, nakes, non_nakes: non,
      provinsi: Object.values(prov), jenis: toList(jenis), waktu_respon: toList(respon),
      per_tahun: Object.entries(tahun).map(([t, n]) => ({ tahun: t, jumlah: n })).sort((a, b) => a.tahun.localeCompare(b.tahun)),
    }
  }
  const d = dash || {}
  return {
    dashboard: {
      individu: d.data_individu || {},
      tim: d.data_tim || {},
      emt: d.data_emt || {},
      tren: (d.tren_pendaftaran || []).map((x: any) => ({ tanggal: trimS(x.tanggal), individu: Number(x.individu || 0), tim: Number(x.tim || 0), emt: Number(x.emt || 0) })),
    },
    emt: agg(emt.data || [], 'emt'),
    tim: agg(tim.data || [], 'tim'),
  }
}

const GOL_GROUP: [RegExp, string][] = [
  [/^tenaga medis$|dokter/i, 'Tenaga Medis'],
  [/kepera?wat/i, 'Tenaga Keperawatan'],
  [/kebidanan|bidan/i, 'Tenaga Kebidanan'],
  [/kefarmasian|farmasi/i, 'Tenaga Kefarmasian'],
  [/kesehatan masyarakat|promosi/i, 'Tenaga Kesehatan Masyarakat'],
  [/lingkungan|sanitasi/i, 'Tenaga Kesehatan Lingkungan'],
  [/gizi/i, 'Tenaga Gizi'],
]
const golGroup = (g: string, kategori: string) => {
  for (const [re, name] of GOL_GROUP) if (re.test(g)) return name
  return /non/i.test(kategori) ? 'Non-Kesehatan' : 'Tenaga Kesehatan Lainnya'
}
export const TCK_PROFESI = ['Tenaga Medis', 'Tenaga Keperawatan', 'Tenaga Kebidanan', 'Tenaga Kefarmasian', 'Tenaga Kesehatan Masyarakat', 'Tenaga Kesehatan Lingkungan', 'Tenaga Gizi', 'Tenaga Kesehatan Lainnya', 'Non-Kesehatan']

/** Relawan per provinsi (38 panggilan). Baris pribadi langsung diringkas; tidak ada yang disimpan per orang. */
export async function fetchTckRelawan(provCodes: string[]) {
  const per = await pool(provCodes, 6, async (code) => {
    try {
      // Ringkasan per provinsi disimpan di cache persisten (hanya agregat) supaya 38 panggilan tidak harus selesai dalam satu permintaan.
      return await persist(['tck-relawan', code], async () => {
      const j = await postForm(ep('v1/relawan-tck'), { kd_prop: code, kd_kab: '' }, 90_000)
      const p = { code, individu: 0, nakes: 0, non_nakes: 0, perempuan: 0, laki: 0, usia: [0, 0, 0, 0, 0], terhubung_tim: 0, profesi: {} as Record<string, number>, kab: {} as Record<string, { n: number; nakes: number }> }
      for (const r of j.data || []) {
        const kat = trimS(r.kategori)
        const nk = /^nakes$/i.test(kat)
        p.individu++
        if (nk) p.nakes++
        else p.non_nakes++
        const jk = trimS(r.jenis_kelamin).toUpperCase()
        if (jk.startsWith('PEREMPUAN')) p.perempuan++
        else if (jk.startsWith('LAKI')) p.laki++
        const u = Number(r.usia)
        const ui = !Number.isFinite(u) || u <= 0 ? 4 : u < 30 ? 0 : u < 40 ? 1 : u < 50 ? 2 : 3
        p.usia[ui]++
        if (trimS(r.nama_tim_emt) && trimS(r.nama_tim_emt) !== '-') p.terhubung_tim++
        const g = golGroup(trimS(r.golongan), kat)
        p.profesi[g] = (p.profesi[g] || 0) + 1
        const kn = trimS(r.kab_kota).toUpperCase() || 'TIDAK DIISI'
        const kb = (p.kab[kn] ||= { n: 0, nakes: 0 })
        kb.n++
        if (nk) kb.nakes++
      }
      return { ok: true as const, p, total: Number(j.total ?? p.individu) }
      }, REVALIDATE.singkat, ['tck'])
    } catch (e: any) {
      return { ok: false as const, code, error: String(e?.message || e) }
    }
  })
  const ok = per.filter((x) => x.ok) as Array<{ ok: true; p: any; total: number }>
  if (!ok.length) throw new Error('Semua permintaan relawan TCK gagal')
  return {
    provinsi: ok.map((x) => ({
      ...x.p,
      kab: Object.entries(x.p.kab).map(([nama, v]: any) => ({ nama, n: v.n, nakes: v.nakes })).sort((a, b) => b.n - a.n),
    })),
    gagal: per.filter((x) => !x.ok).map((x: any) => x.code),
  }
}
