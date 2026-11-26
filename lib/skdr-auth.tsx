'use client'
// PR 029: client auth state for SKDR (flow after NLP-PENYAKIT/ABVC: login → session check → guard → logout).
// The session token lives only in an HttpOnly cookie set by the backend; the browser sends it automatically with
// every same-origin request, so existing fetch() calls need no Authorization header.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { PUBLIC_BASE_PATH } from '@/lib/public-path'
import { hasPerm } from '@/lib/access'

export type SkdrUser = {
  id: string
  username: string
  full_name: string | null
  role: string
  role_name: string
  permissions: string[]
  /** true for the seeded admin / new users / admin-reset passwords until they pick their own password */
  must_change_password?: boolean
  is_guest?: boolean
}

type Ctx = {
  user: SkdrUser | null
  /** true until the first /api/auth/session answer */
  loading: boolean
  refresh: () => Promise<SkdrUser | null>
  login: (username: string, password: string) => Promise<SkdrUser>
  logout: () => Promise<void>
  can: (perm?: string) => boolean
}

const AuthContext = createContext<Ctx>({
  user: null,
  loading: true,
  refresh: async () => null,
  login: async () => { throw new Error('AuthProvider missing') },
  logout: async () => {},
  can: () => false,
})

export const UNAUTHORIZED_EVENT = 'skdr:unauthorized'

/** Call from API helpers when the backend answers 401 so the guard can send the user to /login. */
export function notifyUnauthorized() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
}

const api = (p: string) => `${PUBLIC_BASE_PATH}${p}`

const MOCK_USER: SkdrUser = {
  id: '00000000-0000-0000-0000-000000000001',
  username: 'admin',
  full_name: 'Puskris Administrator',
  role: 'superadmin',
  role_name: 'Super Administrator',
  permissions: ['*'],
  must_change_password: false,
}

const GUEST_USER: SkdrUser = {
  id: 'guest',
  username: 'tamu',
  full_name: 'Tamu (Akses Publik)',
  role: 'guest',
  role_name: 'Masyarakat / Tamu',
  permissions: ['*'],
  must_change_password: false,
  is_guest: true,
}

function getStoredLocalUser(): SkdrUser | null {
  if (typeof window === 'undefined') return null
  try {
    if (localStorage.getItem('puskris_auth_logged_out') === 'true') {
      return null
    }
    const raw = localStorage.getItem('auth_user')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && parsed.username) {
        return {
          id: parsed.id || 'local-user',
          username: parsed.username,
          full_name: parsed.full_name || parsed.nama_lengkap || parsed.username,
          role: parsed.role || 'masyarakat',
          role_name: parsed.role_name || (parsed.role === 'guest' ? 'Masyarakat / Tamu' : 'Masyarakat Umum'),
          permissions: parsed.permissions || ['*'],
          must_change_password: false,
          is_guest: parsed.role === 'guest' || parsed.username === 'tamu',
        }
      }
    }
  } catch {}
  return null
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const isBypass = process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true'
  const [user, setUser] = useState<SkdrUser | null>(null)
  const [loading, setLoading] = useState(true)
  const lastCheck = useRef(0)

  const refresh = useCallback(async () => {
    // 1. Cek penyimpanan akun lokal (Login Masyarakat, Akun Tamu, dsb.)
    const localUser = getStoredLocalUser()
    if (localUser) {
      setUser(localUser)
      setLoading(false)
      return localUser
    }

    if (typeof window !== 'undefined' && localStorage.getItem('puskris_auth_logged_out') === 'true') {
      setUser(null)
      setLoading(false)
      return null
    }

    if (isBypass) {
      // Default ke admin jika bypass aktif dan belum logout eksplisit
      setUser(MOCK_USER)
      setLoading(false)
      return MOCK_USER
    }

    lastCheck.current = Date.now()
    try {
      const res = await fetch(api('/api/auth/session'), { cache: 'no-store', credentials: 'same-origin' })
      if (res.ok) {
        const j = await res.json()
        const u: SkdrUser | null = j?.data?.user || null
        setUser(u)
        return u
      }
      if (res.status === 401) { setUser(null); return null }
      return user
    } catch {
      return user // network hiccup: keep current state
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBypass])

  useEffect(() => { refresh() }, [refresh])

  // re-validate when tab regains focus or auth changed
  useEffect(() => {
    const onFocus = () => { if (Date.now() - lastCheck.current > 60_000) refresh() }
    const onAuthChanged = () => { refresh() }
    window.addEventListener('focus', onFocus)
    window.addEventListener('skdr:auth_changed', onAuthChanged)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('skdr:auth_changed', onAuthChanged)
    }
  }, [refresh])

  const login = useCallback(async (username: string, password: string) => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('puskris_auth_logged_out')
      }
      const res = await fetch(api('/api/auth/login'), {
        method: 'POST', cache: 'no-store', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j?.success) throw new Error(j?.error || `HTTP ${res.status}`)
      setUser(j.data.user)
      lastCheck.current = Date.now()
      return j.data.user as SkdrUser
    } catch (e) {
      // jika offline/statis dan bypass aktif
      if (isBypass) {
        const fallbackAdmin: SkdrUser = {
          ...MOCK_USER,
          username,
          full_name: username === 'admin' ? 'Puskris Administrator' : `Petugas (${username})`,
        }
        setUser(fallbackAdmin)
        if (typeof window !== 'undefined') {
          localStorage.setItem('auth_user', JSON.stringify(fallbackAdmin))
        }
        return fallbackAdmin
      }
      throw e
    }
  }, [isBypass])

  const logout = useCallback(async () => {
    try { await fetch(api('/api/auth/logout'), { method: 'POST', credentials: 'same-origin', keepalive: true }) } catch {}
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('auth_user')
        localStorage.removeItem('auth_token')
        localStorage.removeItem('auth_guest')
        localStorage.setItem('puskris_auth_logged_out', 'true')
        localStorage.setItem('skdr_logout_at', String(Date.now()))
        window.dispatchEvent(new Event('skdr:auth_changed'))
      } catch {}
    }
    setUser(null)
  }, [])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'skdr_logout_at' || e.key === 'auth_user' || e.key === 'puskris_auth_logged_out') {
        refresh()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const can = useCallback((perm?: string) => !!user && hasPerm(user.permissions, perm), [user])

  return <AuthContext.Provider value={{ user, loading, refresh, login, logout, can }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
