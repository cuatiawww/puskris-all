'use client'
// PR 029: header controls: area switch (Dasbor ↔ Tata Kelola) and the user menu (name, role, change password, logout),
// or a "Masuk" button for anonymous visitors.
import { useEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronDown, Database, KeyRound, LayoutDashboard, LogIn, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import Modal from '@/components/Modal'
import { Field, FormActions, inputCls } from '@/components/master/MasterUi'
import { useAuth } from '@/lib/skdr-auth'
import { routeArea } from '@/lib/access'
import { useTranslation } from '@/lib/i18n/LanguageContext'
import { PUBLIC_BASE_PATH } from '@/lib/public-path'

export function AreaSwitch({ onBrand = false }: { onBrand?: boolean }) {
  const { user } = useAuth()
  const pathname = usePathname() || '/'
  const { t } = useTranslation()
  if (!user) return null
  const area = routeArea(pathname)
  const cls = (on: boolean) =>
    `flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-wider transition ${on
      ? onBrand
        ? 'bg-white text-brand-700 shadow-sm'
        : 'bg-primary text-white shadow-sm'
      : onBrand
        ? 'text-white/90 hover:bg-white/15 hover:text-white'
        : 'text-slate-600 hover:bg-white hover:text-primary'
    }`
  return (
    <nav
      aria-label={t('skdr.auth.areaSwitch')}
      data-testid="area-switch"
      className={`hidden items-center rounded-2xl border p-1 shadow-sm backdrop-blur-sm sm:flex ${onBrand ? 'border-white/25 bg-white/15' : 'border-white/45 bg-white/90'
        }`}
    >
      <Link href="/dashboard/ringkasan" className={cls(area === 'dashboard')}><LayoutDashboard className="h-3.5 w-3.5" />{t('skdr.auth.areaDashboard')}</Link>
    </nav>
  )
}

export default function UserMenu({ onBrand = false }: { onBrand?: boolean }) {
  const { user, loading, logout } = useAuth()
  const pathname = usePathname() || '/'
  const router = useRouter()
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key) }
  }, [open])
  useEffect(() => { setOpen(false) }, [pathname])

  if (loading) return <div className="h-10 w-24" aria-hidden />
  if (!user) {
    const redirect = pathname === '/login' ? '' : `?redirect=${encodeURIComponent(pathname)}`
    return (
      <Link href={`/login${redirect}`} data-testid="login-link"
        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition ${onBrand ? 'bg-white text-brand-700 hover:bg-brand-50' : 'bg-primary text-white hover:bg-primary-dark'
          }`}>
        <LogIn className="h-4 w-4" /> {t('skdr.auth.signInShort')}
      </Link>
    )
  }
  const name = user.full_name || user.username
  const initials = name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  const doLogout = async () => {
    await logout()
    toast.success(t('skdr.auth.loggedOut'))
    router.replace('/login')
  }
  const isBypass = process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true'
  const item = 'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50'
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} data-testid="user-menu"
        className={`flex items-center gap-2.5 rounded-2xl border py-1.5 pl-1.5 pr-3 shadow-sm backdrop-blur-sm transition ${onBrand
            ? 'border-white/25 bg-white/15 hover:bg-white/25'
            : 'border-white/45 bg-white/90 hover:bg-white'
          }`}>
        <span className={`grid h-8 w-8 place-items-center rounded-xl text-xs font-bold ${onBrand ? 'bg-white text-brand-700' : 'bg-primary text-white'
          }`}>{initials}</span>
        <span className="hidden min-w-0 text-left sm:block">
          <span className={`block max-w-[160px] truncate text-sm font-bold ${onBrand ? 'text-white' : 'text-slate-800'}`}>{name}</span>
          <span className={`block max-w-[160px] truncate text-[11px] font-medium ${onBrand ? 'text-white/80' : 'text-slate-500'}`}>{user.role_name}</span>
        </span>
        <ChevronDown className={`h-4 w-4 ${onBrand ? 'text-white/80' : 'text-slate-400'}`} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-[70] mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10">
          <div className="border-b border-slate-100 px-3 pb-2 pt-1">
            <p className="truncate text-sm font-bold text-slate-900">{name}</p>
            <p className="truncate text-xs text-slate-500">@{user.username} · {user.role_name}</p>
          </div>
          <div className="pt-1">
            <Link href="/dashboard/ringkasan" role="menuitem" className={item}><LayoutDashboard className="h-4 w-4 text-slate-400" />{t('skdr.auth.areaDashboard')}</Link>
            <Link href="/dashboard/open-data" role="menuitem" className={item}><Database className="h-4 w-4 text-slate-400" />Open Data &amp; API</Link>
            {!isBypass && (
              <>
                <button type="button" role="menuitem" className={item} onClick={() => { setOpen(false); setPwOpen(true) }}><KeyRound className="h-4 w-4 text-slate-400" />{t('skdr.auth.changePassword')}</button>
                <button type="button" role="menuitem" data-testid="logout" className={`${item} text-red-600 hover:bg-red-50`} onClick={doLogout}><LogOut className="h-4 w-4" />{t('skdr.auth.logout')}</button>
              </>
            )}
          </div>
        </div>
      )}
      {!isBypass && (
        <Modal open={pwOpen} onClose={() => setPwOpen(false)} title={t('skdr.auth.changePassword')}>
          <PasswordForm onDone={() => setPwOpen(false)} />
        </Modal>
      )}
    </div>
  )
}

/** Change own password. Used by the user menu modal and by the forced first-login screen (AuthGuard). */
export function PasswordForm({ onDone, onCancel }: { onDone: () => void; onCancel?: () => void }) {
  const { t } = useTranslation()
  const { refresh } = useAuth()
  const [f, setF] = useState({ current: '', next: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (f.next !== f.confirm) return toast.error(t('skdr.auth.passwordMismatch'))
    if (f.next === f.current) return toast.error(t('skdr.auth.passwordSame'))
    setSaving(true)
    try {
      const res = await fetch(`${PUBLIC_BASE_PATH}/api/auth/password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
        body: JSON.stringify({ current_password: f.current, new_password: f.next }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.success) throw new Error(j.error || `HTTP ${res.status}`)
      toast.success(t('skdr.auth.passwordChanged'))
      await refresh() // clears must_change_password in the auth state
      onDone()
    } catch (err) { toast.error(err instanceof Error ? err.message : String(err)) } finally { setSaving(false) }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label={t('skdr.auth.currentPassword')} required>
        <input type="password" autoComplete="current-password" className={inputCls} value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} required />
      </Field>
      <Field label={t('skdr.auth.newPassword')} required hint={t('skdr.access.passwordHint')}>
        <input type="password" autoComplete="new-password" className={inputCls} value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} required />
      </Field>
      <Field label={t('skdr.auth.confirmPassword')} required>
        <input type="password" autoComplete="new-password" className={inputCls} value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} required />
      </Field>
      <FormActions saving={saving} onCancel={onCancel || onDone} />
    </form>
  )
}
