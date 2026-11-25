import JenisKejadianClient from '@/components/puskris/JenisKejadianClient'

export default async function JenisKejadianPage({
  params, searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ tahun?: string; prov?: string }>
}) {
  const { slug } = await params
  const q = await searchParams
  return <JenisKejadianClient slug={slug} tahun={q.tahun || null} prov={q.prov || null} />
}
