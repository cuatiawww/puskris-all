import KejadianDetailClient from '@/components/puskris/KejadianDetailClient'

export default async function KejadianKodePage({
  params,
  searchParams,
}: {
  params: Promise<{ kode: string }>
  searchParams: Promise<{ tahun?: string; template?: string }>
}) {
  const { kode } = await params
  const q = await searchParams
  return (
    <KejadianDetailClient
      id={decodeURIComponent(kode)}
      tahun={q.tahun || null}
      initialTemplate={q.template || null}
    />
  )
}
