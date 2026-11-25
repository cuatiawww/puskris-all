import JenisKejadianClient from '@/components/puskris/JenisKejadianClient'

export default async function JenisKejadianIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ tahun?: string; prov?: string }>
}) {
  const q = await searchParams
  return <JenisKejadianClient slug={null} tahun={q.tahun || null} prov={q.prov || null} />
}
