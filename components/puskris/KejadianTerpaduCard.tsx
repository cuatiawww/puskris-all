'use client'

import { nf, pf } from '@/lib/puskris/derive'
import { CONTOH_LABEL, type RadiusCounts, type Terpadu } from '@/lib/puskris/integrasi'
import { EMT_LABEL, IRBI_HINT, IRBI_LABEL, NCC_LABEL } from '@/lib/puskris/labels'

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-slate-100 py-1">
      <dt className="text-slate-500">{k}</dt>
      <dd className="font-bold tabular-nums text-slate-800">{v}</dd>
    </div>
  )
}

export default function KejadianTerpaduCard({
  data, radius, radiusOn,
}: {
  data: Terpadu
  radius: RadiusCounts[] | null
  radiusOn: boolean
}) {
  return (
    <div className="space-y-3 text-[11px] text-slate-700" data-testid="kartu-kejadian-terpadu">
      <div>
        <p className="text-sm font-black text-slate-900">{data.judul}</p>
        <p className="text-[11px] text-slate-500">{data.sub}</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-3">
        <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">EOC · korban &amp; pengungsi</p>
        <dl>
          <Row k="Kejadian" v={nf(data.eoc.kejadian)} />
          <Row k="Berdampak krisis" v={nf(data.eoc.krisis)} />
          <Row k="Meninggal" v={nf(data.eoc.meninggal)} />
          <Row k="Luka berat / ringan" v={`${nf(data.eoc.lukaBerat)} / ${nf(data.eoc.lukaRingan)}`} />
          <Row k="Pengungsi" v={nf(data.eoc.pengungsi)} />
          <Row k="Terdampak" v={nf(data.eoc.terdampak)} />
        </dl>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3">
        <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">PSC &amp; NCC 119</p>
        <dl>
          <Row k="Panggilan (kumulatif wilayah)" v={nf(data.layanan.panggilan)} />
          <Row k="PSC aktif" v={`${nf(data.layanan.pscAktif)} / ${nf(data.layanan.pscTotal)}`} />
          <Row k={`${NCC_LABEL.scr} nasional`} v={data.layanan.scr != null ? pf(data.layanan.scr, 1) : '0'} />
          <p className="text-[10px] text-slate-400">{NCC_LABEL.scrHint}</p>
        </dl>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3">
        <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Ambulans</p>
        <dl>
          <Row k="Armada" v={nf(data.ambulans.total)} />
          <Row k="Baik / rusak ringan / berat" v={`${nf(data.ambulans.baik)} / ${nf(data.ambulans.rusakRingan)} / ${nf(data.ambulans.rusakBerat)}`} />
          <Row k="Ber-GPS" v={nf(data.ambulans.gps)} />
        </dl>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3">
        <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Tenaga cadangan</p>
        <dl>
          <Row k="Individu (wilayah)" v={`${nf(data.tck.individu)} · nakes ${nf(data.tck.nakes)}`} />
          <Row k={`Tim / ${EMT_LABEL}${data.tck.wilayah ? ' (wilayah)' : ' nasional'}`} v={`${data.tck.tim == null ? '—' : nf(data.tck.tim)} / ${data.tck.emt == null ? '—' : nf(data.tck.emt)}${data.tck.emtStandar != null ? ` · ${nf(data.tck.emtStandar)} EMT memenuhi standar` : ''}`} />
        </dl>
        {data.tck.wilayah ? null : <p className="mt-1 text-[10px] text-slate-400">Tim dan {EMT_LABEL} hanya tersedia sebagai angka nasional.</p>}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3">
        <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Logistik regional</p>
        <dl>
          <Row k="Gudang / stok" v={data.logistik.stok != null ? nf(data.logistik.stok) : '—'} />
        </dl>
        <p className="mt-1 text-[10px] text-slate-400">{data.logistik.catatan}</p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3">
        <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Asistensi kapasitas</p>
        <dl>
          <Row k="Status" v={data.asistensi.status} />
          <Row k="Poin kapasitas" v={data.asistensi.poin != null ? `${data.asistensi.poin}%` : '—'} />
          <Row k={IRBI_LABEL} v={data.asistensi.irbi} />
        </dl>
        <p className="mt-1 text-[10px] text-slate-400">{data.asistensi.catatan}</p>
      </section>

      {radiusOn && radius && (
        <section className="rounded-xl border border-teal-200 bg-teal-50/40 p-3">
          <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-teal-800">Radius dukungan 50 / 100 / 200 km</p>
          <p className="mb-2 text-[10px] text-slate-500">{radius[0]?.titikNyata ? 'PSC, ambulans, dan rumah sakit dihitung dari koordinat API PSC 119 (PSC berkoordinat bawaan/kosong memakai pusat kab/kota; RS berkoordinat bawaan dibuang). Tenaga cadangan (API Tenaga Cadangan, per provinsi) dan gudang memakai pusat provinsi.' : `Jarak dihitung dari pusat provinsi (${CONTOH_LABEL} koordinat fasilitas; lokasi persis belum tersedia).`}</p>
          <table className="w-full text-[10px]">
            <thead className="text-left text-slate-400">
              <tr>{['Radius', 'PSC aktif', 'Ambulans baik/total', ...(radius[0]?.titikNyata ? ['RS'] : []), 'Tenaga cadangan', radius[0]?.timNyata ? 'Tim + EMT' : 'Tim*', 'Gudang'].map((h) => <th key={h} className="pb-1 pr-1">{h}</th>)}</tr>
            </thead>
            <tbody>
              {radius.map((r) => (
                <tr key={r.km} className="border-t border-teal-100">
                  <td className="py-1 font-bold">{r.km} km</td>
                  <td className="tabular-nums">{nf(r.psc)}</td>
                  <td className="tabular-nums">{nf(r.ambulansBaik)}/{nf(r.ambulans)}</td>
                  {r.titikNyata ? <td className="tabular-nums">{nf(r.rs || 0)}</td> : null}
                  <td className="tabular-nums">{nf(r.tckIndividu)}</td>
                  <td className="tabular-nums">{nf(r.tckTimPerkiraan)}</td>
                  <td className="tabular-nums">{nf(r.gudang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[10px] text-slate-400">{radius[0]?.timNyata ? `Tim + EMT = jumlah tim relawan dan ${EMT_LABEL} terdaftar di provinsi dalam radius (API Tenaga Cadangan).` : `*Tim perkiraan = porsi individu wilayah terhadap total nasional × jumlah tim nasional (${CONTOH_LABEL}).`}</p>
        </section>
      )}
    </div>
  )
}
