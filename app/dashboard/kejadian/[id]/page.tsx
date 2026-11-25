import KejadianDetailClient from '@/components/puskris/KejadianDetailClient'

export default async function KejadianDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tahun?: string; template?: string }>
}) {
  const { id } = await params
  const q = await searchParams
  return (
    <KejadianDetailClient
      id={decodeURIComponent(id)}
      tahun={q.tahun || null}
      initialTemplate={q.template || null}
    />
  )
}
