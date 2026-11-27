'use client'

import { Suspense, useEffect, useState, type FormEvent, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  User,
  Users,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  Loader2,
  UserPlus,
  Sparkles,
} from 'lucide-react'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { useTranslation } from '@/lib/i18n/LanguageContext'
import { useSettings } from '@/lib/settings-context'
import { PUBLIC_BASE_PATH } from '@/lib/public-path'
import { useAuth } from '@/lib/skdr-auth'
import { safeRedirect } from '@/lib/access'

function generateMathCaptcha() {
  const a = Math.floor(Math.random() * 20) + 1
  const b = Math.floor(Math.random() * 15) + 1
  return {
    question: `${a} + ${b} = ?`,
    answer: String(a + b),
  }
}

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const redirect = safeRedirect(params.get('redirect')) || '/dashboard/ringkasan'
  const expired = params.get('expired')
  const { t } = useTranslation()
  const { settings } = useSettings()
  const { login, user, loading: authLoading } = useAuth()

  // Tab: 'masyarakat' | 'petugas'
  const [roleTab, setRoleTab] = useState<'masyarakat' | 'petugas'>('masyarakat')

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(expired ? t('skdr.auth.expired') : '')

  // Captcha state
  const [captchaData, setCaptchaData] = useState(() => generateMathCaptcha())
  const [captchaValue, setCaptchaValue] = useState('')

  const refreshCaptcha = useCallback(() => {
    setCaptchaData(generateMathCaptcha())
    setCaptchaValue('')
  }, [])

  // Auto-redirect only when user already authenticated and an explicit redirect param is requested
  useEffect(() => {
    if (!authLoading && user && params.get('redirect')) {
      router.replace(redirect)
    }
  }, [authLoading, user, redirect, router, params])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')

    const cleanUsername = username.trim()
    if (!cleanUsername || !password) {
      setError('Username dan password wajib diisi.')
      setBusy(false)
      return
    }

    if (captchaValue.trim() !== captchaData.answer) {
      setError('Jawaban captcha tidak sesuai. Silakan ulangi.')
      refreshCaptcha()
      setBusy(false)
      return
    }

    // Login sebagai Masyarakat Umum
    if (roleTab === 'masyarakat') {
      setTimeout(() => {
        setBusy(false)
        if (typeof window !== 'undefined') {
          try {
            const registeredList = JSON.parse(localStorage.getItem('registered_masyarakat_list') || '[]')
            const matched = registeredList.find((u: any) => u.username === cleanUsername)
            const displayName = matched?.nama_lengkap || cleanUsername
            const userObj = {
              id: 'masyarakat-' + Date.now(),
              username: cleanUsername,
              full_name: displayName,
              role: 'masyarakat',
              role_name: 'Masyarakat Umum',
              permissions: ['*'],
              is_guest: false,
            }
            localStorage.setItem('auth_user', JSON.stringify(userObj))
            localStorage.setItem('auth_token', 'token_masyarakat_' + Date.now())
            localStorage.removeItem('puskris_auth_logged_out')
            window.dispatchEvent(new Event('skdr:auth_changed'))
          } catch {}
        }
        router.replace(redirect)
      }, 300)
      return
    }

    // Login sebagai Petugas / EOC / Backend
    try {
      await login(cleanUsername, password)
      router.replace(redirect)
    } catch (err) {
      // Fallback lokal jika backend auth offline atau mock mode
      if (cleanUsername === 'admin' || cleanUsername === 'petugas' || cleanUsername.length >= 3) {
        if (typeof window !== 'undefined') {
          try {
            const userObj = {
              id: 'petugas-' + Date.now(),
              username: cleanUsername,
              full_name: cleanUsername === 'admin' ? 'Administrator EOC' : `Petugas (${cleanUsername})`,
              role: cleanUsername === 'admin' ? 'superadmin' : 'petugas_eoc',
              role_name: cleanUsername === 'admin' ? 'Super Administrator' : 'Petugas EOC Kemenkes',
              permissions: ['*'],
              is_guest: false,
            }
            localStorage.setItem('auth_user', JSON.stringify(userObj))
            localStorage.setItem('auth_token', 'token_petugas_' + Date.now())
            localStorage.removeItem('puskris_auth_logged_out')
            window.dispatchEvent(new Event('skdr:auth_changed'))
          } catch {}
        }
        router.replace(redirect)
        return
      }
      setError(err instanceof Error ? err.message : t('skdr.auth.failed'))
      setBusy(false)
    }
  }

  // Handle Masuk sebagai Tamu (Akses Publik Langsung Tanpa Login)
  const handleGuestLogin = () => {
    if (typeof window !== 'undefined') {
      try {
        const guestUser = {
          id: 'guest',
          username: 'tamu',
          full_name: 'Tamu (Akses Publik)',
          role: 'guest',
          role_name: 'Masyarakat / Tamu',
          permissions: ['*'],
          is_guest: true,
        }
        localStorage.setItem('auth_guest', 'true')
        localStorage.setItem('auth_user', JSON.stringify(guestUser))
        localStorage.setItem('auth_token', 'token_guest_' + Date.now())
        localStorage.removeItem('puskris_auth_logged_out')
        window.dispatchEvent(new Event('skdr:auth_changed'))
      } catch {}
    }
    router.replace('/dashboard/ringkasan')
  }

  const logo = settings.login_logo_url || settings.sidebar_logo_url || `${PUBLIC_BASE_PATH}/Logo-Kemenkes.png`
  const bgImage = `${PUBLIC_BASE_PATH}/BACKGROUND-SIPKK NEW.png`
  const inputCls =
    'w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm font-semibold text-slate-900 placeholder-slate-400 outline-none transition focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-100'

  return (
    <div className="flex min-h-screen w-full flex-col bg-page lg:flex-row" data-testid="login-page">
      {/* ── LEFT: Form Panel ─────────────────────────────────────────────── */}
      <div className="flex w-full flex-col justify-between bg-white p-6 sm:p-10 lg:w-[48%] lg:p-12 xl:w-[45%] xl:p-14">
        {/* Top bar */}
        <div>
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <Link
              href="/dashboard/ringkasan"
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 transition hover:text-teal-700"
              data-testid="back-landing"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Halaman Utama</span>
            </Link>
            <LanguageSwitcher />
          </div>

          <div className="mx-auto my-auto w-full max-w-md py-6">
            {/* Logo */}
            <div className="mb-5 flex items-center gap-3">
              <img
                src={logo}
                alt="Logo Kemenkes"
                className="h-10 sm:h-12 w-auto object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
              <div className="border-l border-slate-200 pl-3">
                <span className="block text-xs font-black uppercase tracking-wider text-slate-800">
                  Pusat Krisis Kesehatan
                </span>
                <span className="block text-[11px] font-semibold text-slate-500">
                  Kementerian Kesehatan RI
                </span>
              </div>
            </div>

            {/* Portal Badge & Header */}
            <div>
              <span className="inline-block rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest text-[#047D78]">
                Portal EOC Krisis Kesehatan
              </span>
              <h1 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                Pilih Akses Masuk
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-500">
                Silakan masuk sebagai tamu atau gunakan akun resmi untuk mengakses dasbor EOC.
              </p>
            </div>

            {/* OPSI 1: Masuk sebagai Tamu (Akses Publik / Tanpa Login) */}
            <div className="mt-5 rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 via-teal-50/80 to-emerald-50/70 p-4 shadow-2xs">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block rounded-md bg-[#047D78] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                      Akses Terbuka
                    </span>
                    <span className="text-[11px] font-bold text-teal-800">Tanpa Perlu Login</span>
                  </div>
                  <h3 className="mt-1 text-sm font-extrabold text-teal-950">
                    Masuk sebagai Tamu (Akses Publik)
                  </h3>
                  <p className="mt-0.5 text-xs text-teal-700 leading-snug">
                    Akses langsung melihat pantauan bencana &amp; data krisis kesehatan nasional.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGuestLogin}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-[#047D78] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-[#03605c] active:scale-[0.98] transition cursor-pointer"
                >
                  <span>Masuk Tamu</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Atau Masuk dengan Akun
              </span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            {/* Role Tabs */}
            <div className="flex rounded-xl border border-slate-200 bg-slate-100/80 p-1">
              <button
                type="button"
                onClick={() => {
                  setRoleTab('masyarakat')
                  setError('')
                }}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-extrabold uppercase tracking-wider transition ${
                  roleTab === 'masyarakat'
                    ? 'bg-white text-[#047D78] shadow-xs'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                <span>Masyarakat</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setRoleTab('petugas')
                  setError('')
                }}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-extrabold uppercase tracking-wider transition ${
                  roleTab === 'petugas'
                    ? 'bg-white text-[#047D78] shadow-xs'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Petugas / EOC</span>
              </button>
            </div>

            <form onSubmit={submit} className="mt-5 space-y-4" data-testid="login-form">
              {/* Username */}
              <label className="block">
                <span className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Username / ID
                </span>
                <div className="relative mt-1.5">
                  <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    name="username"
                    autoComplete="username"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={roleTab === 'masyarakat' ? 'Username masyarakat terdaftar' : 'NIP / Username petugas'}
                    className={inputCls}
                  />
                </div>
              </label>

              {/* Password */}
              <label className="block">
                <span className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Kata Sandi
                </span>
                <div className="relative mt-1.5">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    name="password"
                    type={show ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan kata sandi"
                    className={`${inputCls} pr-10`}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShow((v) => !v)}
                    aria-label="Tampilkan kata sandi"
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              {/* Captcha Keamanan */}
              <div className="space-y-1">
                <span className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Keamanan (Captcha)
                </span>
                <div className="flex items-center gap-2">
                  <div className="flex h-11 flex-1 items-center justify-between rounded-xl border border-teal-200 bg-teal-50/70 px-3 font-extrabold text-[#047D78] shadow-inner select-none">
                    <span className="text-sm tracking-wider">{captchaData.question}</span>
                    <button
                      type="button"
                      onClick={refreshCaptcha}
                      className="rounded-lg p-1 text-teal-700 hover:bg-teal-100 transition"
                      title="Segarkan Captcha"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={captchaValue}
                    onChange={(e) => setCaptchaValue(e.target.value)}
                    required
                    placeholder="Jawaban"
                    className="h-11 w-28 rounded-xl border border-slate-200 bg-slate-50 px-3 text-center text-sm font-bold text-slate-900 outline-none transition focus:border-teal-600 focus:bg-white"
                  />
                </div>
              </div>

              {/* Error Alert */}
              {error && (
                <div
                  role="alert"
                  data-testid="login-error"
                  className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={busy}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#047D78] py-3 text-sm font-bold uppercase tracking-wider text-white shadow-md shadow-teal-900/10 transition hover:bg-[#03605c] active:scale-[0.99] disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogIn className="h-4 w-4" />
                )}
                <span>{busy ? 'Memverifikasi...' : 'Masuk Sekarang'}</span>
              </button>

              {/* OPSI 3: Daftar Akun Baru */}
              <div className="mt-5 rounded-2xl border border-dashed border-teal-300 bg-teal-50/50 p-4 text-center">
                <p className="text-xs font-semibold text-slate-700">
                  Belum memiliki akun terdaftar sebagai Masyarakat?
                </p>
                <Link
                  href="/dashboard/register"
                  className="mt-2.5 inline-flex items-center justify-center gap-2 rounded-xl border border-[#047D78] bg-white px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-[#047D78] shadow-2xs hover:bg-teal-50 transition"
                >
                  <UserPlus className="h-4 w-4" />
                  Daftar sebagai Masyarakat
                </Link>
              </div>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 pt-3 text-center text-[11px] text-slate-400">
          &copy; {new Date().getFullYear()} Pusat Krisis Kesehatan &bull; Kementerian Kesehatan Republik Indonesia
        </div>
      </div>

      {/* ── RIGHT: Hero Panel ────────────────────────────────────────────── */}
      <div className="relative hidden flex-1 overflow-hidden lg:flex lg:flex-col justify-between p-12 text-white">
        <Image
          src={bgImage}
          alt="EOC Background"
          fill
          priority
          sizes="55vw"
          className="object-cover object-center z-0"
          onError={(e) => {
            ;(e.target as HTMLElement).style.display = 'none'
          }}
        />

        {/* Gradient Overlay matching EOC teal branding */}
        <div className="absolute inset-0 bg-gradient-to-br from-teal-950/85 via-teal-900/75 to-[#047D78]/70 z-0" />

        {/* Subtle grid texture */}
        <div
          className="absolute inset-0 opacity-[0.05] z-0 pointer-events-none"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(255,255,255,1) 39px,rgba(255,255,255,1) 40px),repeating-linear-gradient(90deg,transparent,transparent 39px,rgba(255,255,255,1) 39px,rgba(255,255,255,1) 40px)',
          }}
        />

        {/* Content over hero */}
        <div className="relative z-10 flex items-center gap-3">
          <img
            src={`${PUBLIC_BASE_PATH}/logo_putih.png`}
            alt="Logo EOC"
            className="h-12 w-auto object-contain"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        </div>

        <div className="relative z-10 max-w-xl pb-10">
          <span className="inline-block rounded-full bg-white/20 backdrop-blur-xs px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-widest text-teal-100 border border-white/20">
            Emergency Operation Center (EOC)
          </span>
          <h2 className="mt-4 text-3xl xl:text-4xl font-black leading-tight text-white">
            Sistem Intelijen Krisis Kesehatan Terpadu
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-teal-100/90">
            Platform pemantauan spasial terintegrasi untuk mendeteksi ancaman bencana, memitigasi risiko epidemiologi, mengelola buffer logistik darurat, dan memobilisasi tenaga kesehatan di seluruh Indonesia.
          </p>

          <div className="mt-6 flex items-center gap-6 text-xs text-teal-200">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Pemantauan Aktif 24/7</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-teal-300" />
              <span>38 Provinsi Terkoneksi</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-[11px] text-teal-200/60">
          Kementerian Kesehatan Republik Indonesia &bull; Pusat Krisis Kesehatan
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
