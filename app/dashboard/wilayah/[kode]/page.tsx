import WilayahDetailClient from '@/components/puskris/WilayahDetailClient'

export default async function WilayahDetailPage({
  params, searchParams,
}: {
  params: Promise<{ kode: string }>
  searchParams: Promise<{ tahun?: string; kab?: string; jenis?: string }>
}) {
  const { kode } = await params
  const q = await searchParams
  return <WilayahDetailClient kode={kode} tahun={q.tahun || null} kab={q.kab || null} jenis={q.jenis || null} />
}
