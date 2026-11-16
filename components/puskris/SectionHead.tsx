'use client'

export default function SectionHead({
  eyebrow, title, desc, actions,
}: {
  eyebrow: string
  title: string
  desc?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="skdr-section-head flex items-end justify-between gap-2">
      <div className="min-w-0">
        <div className="skdr-eyebrow">{eyebrow}</div>
        <h2 className="skdr-section-title">{title}</h2>
        {desc ? <p className="skdr-section-desc">{desc}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
    </div>
  )
}
