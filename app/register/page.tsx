'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  UserPlus,
  ArrowLeft,
  ArrowRight,
  Building2,
  Briefcase,
  MapPin,
  Phone,
  Mail,
  UserRound,
  LockKeyhole,
  KeyRound,
  Check,
  X,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { PUBLIC_BASE_PATH } from '@/lib/public-path'

type Region = {
  id: string
  name: string
}

// 38 Provinsi di Indonesia (Lengkap & Statis)
const STATIC_PROVINCES: Region[] = [
  { id: '11', name: 'Aceh' },
  { id: '12', name: 'Sumatera Utara' },
  { id: '13', name: 'Sumatera Barat' },
  { id: '14', name: 'Riau' },
  { id: '15', name: 'Jambi' },
  { id: '16', name: 'Sumatera Selatan' },
  { id: '17', name: 'Bengkulu' },
  { id: '18', name: 'Lampung' },
  { id: '19', name: 'Kepulauan Bangka Belitung' },
  { id: '21', name: 'Kepulauan Riau' },
  { id: '31', name: 'DKI Jakarta' },
  { id: '32', name: 'Jawa Barat' },
  { id: '33', name: 'Jawa Tengah' },
  { id: '34', name: 'DI Yogyakarta' },
  { id: '35', name: 'Jawa Timur' },
  { id: '36', name: 'Banten' },
  { id: '51', name: 'Bali' },
  { id: '52', name: 'Nusa Tenggara Barat' },
  { id: '53', name: 'Nusa Tenggara Timur' },
  { id: '61', name: 'Kalimantan Barat' },
  { id: '62', name: 'Kalimantan Tengah' },
  { id: '63', name: 'Kalimantan Selatan' },
  { id: '64', name: 'Kalimantan Timur' },
  { id: '65', name: 'Kalimantan Utara' },
  { id: '71', name: 'Sulawesi Utara' },
  { id: '72', name: 'Sulawesi Tengah' },
  { id: '73', name: 'Sulawesi Selatan' },
  { id: '74', name: 'Sulawesi Tenggara' },
  { id: '75', name: 'Gorontalo' },
  { id: '76', name: 'Sulawesi Barat' },
  { id: '81', name: 'Maluku' },
  { id: '82', name: 'Maluku Utara' },
  { id: '91', name: 'Papua Barat' },
  { id: '92', name: 'Papua' },
  { id: '93', name: 'Papua Selatan' },
  { id: '94', name: 'Papua Tengah' },
  { id: '95', name: 'Papua Pegunungan' },
  { id: '96', name: 'Papua Barat Daya' },
]

// Sample regencies per selected province
const SAMPLE_REGENCIES: Record<string, Region[]> = {
  '31': [
    { id: '3171', name: 'Kota Jakarta Selatan' },
    { id: '3172', name: 'Kota Jakarta Timur' },
    { id: '3173', name: 'Kota Jakarta Pusat' },
    { id: '3174', name: 'Kota Jakarta Barat' },
    { id: '3175', name: 'Kota Jakarta Utara' },
    { id: '3101', name: 'Kabupaten Kepulauan Seribu' },
  ],
  '32': [
    { id: '3273', name: 'Kota Bandung' },
    { id: '3204', name: 'Kabupaten Bandung' },
    { id: '3217', name: 'Kabupaten Bandung Barat' },
    { id: '3271', name: 'Kota Bogor' },
    { id: '3201', name: 'Kabupaten Bogor' },
    { id: '3275', name: 'Kota Bekasi' },
    { id: '3216', name: 'Kabupaten Bekasi' },
    { id: '3276', name: 'Kota Depok' },
    { id: '3277', name: 'Kota Cimahi' },
  ],
  '35': [
    { id: '3578', name: 'Kota Surabaya' },
    { id: '3573', name: 'Kota Malang' },
    { id: '3507', name: 'Kabupaten Malang' },
    { id: '3515', name: 'Kabupaten Sidoarjo' },
    { id: '3525', name: 'Kabupaten Gresik' },
    { id: '3509', name: 'Kabupaten Jember' },
    { id: '3510', name: 'Kabupaten Banyuwangi' },
  ],
  '53': [
    { id: '5371', name: 'Kota Kupang' },
    { id: '5301', name: 'Kabupaten Kupang' },
    { id: '5302', name: 'Kabupaten Timor Tengah Selatan' },
    { id: '5303', name: 'Kabupaten Timor Tengah Utara' },
    { id: '5304', name: 'Kabupaten Belu' },
    { id: '5305', name: 'Kabupaten Alor' },
    { id: '5306', name: 'Kabupaten Flores Timur' },
    { id: '5307', name: 'Kabupaten Sikka' },
    { id: '5308', name: 'Kabupaten Ende' },
    { id: '5315', name: 'Kabupaten Manggarai Barat' },
  ],
}

// Generate Captcha Helper
function generateMathCaptcha() {
  const a = Math.floor(Math.random() * 20) + 1
  const b = Math.floor(Math.random() * 15) + 1
  return {
    question: `${a} + ${b} = ?`,
    answer: String(a + b),
    key: `cap_${Date.now()}_${Math.random()}`,
  }
}

export default function RegisterPage() {
  const router = useRouter()

  // Flow State: 'form' | 'otp' | 'success'
  const [step, setStep] = useState<'form' | 'otp' | 'success'>('form')

  // Form states
  const [namaLengkap, setNamaLengkap] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [telp, setTelp] = useState('')
  const [kategoriAkses, setKategoriAkses] = useState('masyarakat_umum')
  const [tujuanAkses, setTujuanAkses] = useState('riset_analisa')
  const [tujuanAksesLainnya, setTujuanAksesLainnya] = useState('')
  const [namaInstitusi, setNamaInstitusi] = useState('')
  const [pekerjaanPosisi, setPekerjaanPosisi] = useState('')
  const [provinsiId, setProvinsiId] = useState('')
  const [kabupatenId, setKabupatenId] = useState('')
  const [kecamatanId, setKecamatanId] = useState('')
  const [desaId, setDesaId] = useState('')
  const [alamatUser, setAlamatUser] = useState('')
  const [password, setPassword] = useState('')
  const [rePassword, setRePassword] = useState('')

  // Captcha State
  const [captchaData, setCaptchaData] = useState(() => generateMathCaptcha())
  const [captchaValue, setCaptchaValue] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(false)

  // OTP State
  const [otpCode, setOtpCode] = useState('')
  const [expectedOtp, setExpectedOtp] = useState('1234')
  const [resendCooldown, setResendCooldown] = useState(0)

  // UI States
  const [submitting, setSubmitting] = useState(false)
  const [verifyingOtp, setVerifyingOtp] = useState(false)
  const [resendingOtp, setResendingOtp] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [successMessage, setSuccessMessage] = useState('')

  const refreshCaptcha = useCallback(() => {
    setCaptchaData(generateMathCaptcha())
    setCaptchaValue('')
  }, [])

  // Realtime password checks
  const pwdChecks = useMemo(() => {
    return {
      minLength: password.length >= 8,
      hasUpper: /[A-Z]/.test(password),
      hasLower: /[a-z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecial: /[@$!%*?&#^()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
    }
  }, [password])

  const isPasswordValid =
    pwdChecks.minLength &&
    pwdChecks.hasUpper &&
    pwdChecks.hasLower &&
    pwdChecks.hasNumber &&
    pwdChecks.hasSpecial

  // Strength score: 0 to 5 based on checklist
  const strengthScore = useMemo(() => {
    if (!password) return 0
    let score = 0
    if (pwdChecks.minLength) score++
    if (pwdChecks.hasUpper) score++
    if (pwdChecks.hasLower) score++
    if (pwdChecks.hasNumber) score++
    if (pwdChecks.hasSpecial) score++
    return score
  }, [password, pwdChecks])

  // Regencies based on selected province
  const regencies = useMemo(() => {
    if (!provinsiId) return []
    if (SAMPLE_REGENCIES[provinsiId]) return SAMPLE_REGENCIES[provinsiId]
    const pName = STATIC_PROVINCES.find((p) => p.id === provinsiId)?.name || 'Wilayah'
    return [
      { id: `${provinsiId}01`, name: `Kota ${pName} Pusat` },
      { id: `${provinsiId}02`, name: `Kabupaten ${pName} Utara` },
      { id: `${provinsiId}03`, name: `Kabupaten ${pName} Selatan` },
      { id: `${provinsiId}04`, name: `Kabupaten ${pName} Timur` },
      { id: `${provinsiId}05`, name: `Kabupaten ${pName} Barat` },
    ]
  }, [provinsiId])

  // Sample districts
  const districts = useMemo(() => {
    if (!kabupatenId) return []
    return [
      { id: `${kabupatenId}1`, name: 'Kecamatan Sentral / Kota' },
      { id: `${kabupatenId}2`, name: 'Kecamatan Wilayah 1' },
      { id: `${kabupatenId}3`, name: 'Kecamatan Wilayah 2' },
      { id: `${kabupatenId}4`, name: 'Kecamatan Wilayah 3' },
    ]
  }, [kabupatenId])

  // Sample villages
  const villages = useMemo(() => {
    if (!kecamatanId) return []
    return [
      { id: `${kecamatanId}01`, name: 'Kelurahan / Desa Utama' },
      { id: `${kecamatanId}02`, name: 'Kelurahan / Desa Asri' },
      { id: `${kecamatanId}03`, name: 'Kelurahan / Desa Makmur' },
      { id: `${kecamatanId}04`, name: 'Kelurahan / Desa Sejahtera' },
    ]
  }, [kecamatanId])

  // Countdown timer for Resend OTP
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setFieldErrors({})

    // Validasi Dasar
    const cleanUsername = username.trim()
    if (cleanUsername.length < 4) {
      setFieldErrors({ username: 'Username minimal 4 karakter.' })
      return
    }

    if (!isPasswordValid) {
      setError('Password belum memenuhi seluruh kriteria keamanan.')
      return
    }

    if (password !== rePassword) {
      setFieldErrors({ re_password: 'Konfirmasi password tidak cocok.' })
      return
    }

    if (captchaValue.trim() !== captchaData.answer) {
      setError('Jawaban keamanan (captcha) salah. Silakan coba kembali.')
      refreshCaptcha()
      return
    }

    if (!acceptTerms) {
      setError('Anda harus menyetujui Syarat & Ketentuan terlebih dahulu.')
      return
    }

    setSubmitting(true)
    // Simulasi respons registrasi masyarakat secara statis
    setTimeout(() => {
      setSubmitting(false)
      const randomOtp = String(Math.floor(1000 + Math.random() * 9000))
      setExpectedOtp(randomOtp)

      // Simpan data calon user ke localStorage
      if (typeof window !== 'undefined') {
        const userObj = {
          nama_lengkap: namaLengkap,
          username: cleanUsername,
          email,
          telp,
          kategori_akses: kategoriAkses,
          tujuan_akses: tujuanAkses === 'lainnya' ? tujuanAksesLainnya : tujuanAkses,
          nama_institusi: namaInstitusi,
          pekerjaan_posisi: pekerjaanPosisi,
          provinsi_id: provinsiId,
          kabupaten_id: kabupatenId,
          alamat_user: alamatUser,
          role: 'masyarakat',
          status: 'verified_pending_admin',
          created_at: new Date().toISOString(),
        }
        try {
          const existing = JSON.parse(localStorage.getItem('registered_masyarakat_list') || '[]')
          existing.push(userObj)
          localStorage.setItem('registered_masyarakat_list', JSON.stringify(existing))
          localStorage.setItem('last_registered_masyarakat', JSON.stringify({ username: cleanUsername, password }))
        } catch {}
      }

      setStep('otp')
      setResendCooldown(60)
    }, 600)
  }

  // Handle Verify OTP
  const handleVerifyOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    const code = otpCode.trim()
    if (code.length !== 4 || isNaN(Number(code))) {
      setError('Kode OTP harus berupa 4 digit angka.')
      return
    }

    // Mengizinkan expected OTP atau demo bypass '1234'
    if (code !== expectedOtp && code !== '1234') {
      setError(`Kode OTP salah. Silakan masukkan kode ${expectedOtp} atau 1234.`)
      return
    }

    setVerifyingOtp(true)
    setTimeout(() => {
      setVerifyingOtp(false)
      setSuccessMessage('Verifikasi email berhasil!')
      setStep('success')
    }, 500)
  }

  // Handle Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return
    setError('')
    setResendingOtp(true)

    setTimeout(() => {
      setResendingOtp(false)
      const newOtp = String(Math.floor(1000 + Math.random() * 9000))
      setExpectedOtp(newOtp)
      setResendCooldown(60)
    }, 400)
  }

  // Handle Masuk sebagai Tamu (Langsung tanpa daftar)
  const handleGuestAccess = () => {
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

  return (
    <div className="relative min-h-screen overflow-hidden py-10 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      {/* Background image */}
      <Image
        src={`${PUBLIC_BASE_PATH}/BACKGROUND-SIPKK NEW.png`}
        alt="Background"
        fill
        priority
        sizes="100vw"
        className="object-cover object-center z-0"
        onError={(e) => {
          ;(e.target as HTMLElement).style.display = 'none'
        }}
      />

      {/* Overlay gradient teal */}
      <div className="absolute inset-0 bg-gradient-to-br from-teal-950/85 via-teal-900/75 to-[#047D78]/70 z-0" />

      {/* Subtle grid texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.05] z-0 pointer-events-none"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(255,255,255,1) 39px,rgba(255,255,255,1) 40px),repeating-linear-gradient(90deg,transparent,transparent 39px,rgba(255,255,255,1) 39px,rgba(255,255,255,1) 40px)',
        }}
      />

      <div className="relative z-10 w-full max-w-[820px] bg-white rounded-3xl border border-[#c8dedd] shadow-[0_25px_70px_rgba(0,0,0,0.30)] p-6 sm:p-10 my-4">
        {/* Top Navigation Bar */}
        {step !== 'otp' && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <Link
              href="/dashboard/login"
              className="inline-flex items-center gap-2 text-teal-700 hover:text-teal-800 font-bold text-xs uppercase tracking-wider transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Halaman Masuk
            </Link>
            <button
              type="button"
              onClick={handleGuestAccess}
              className="inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-[#047D78] hover:bg-teal-100 transition shadow-2xs cursor-pointer"
            >
              <span>Masuk sebagai Tamu (Tanpa Daftar)</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* ── STEP 1: FORM PENDAFTARAN ─────────────────────────────────── */}
        {step === 'form' && (
          <div>
            {/* Header */}
            <div className="mb-8">
              <span className="inline-block rounded-full bg-teal-50 border border-teal-200 px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest text-[#047D78]">
                Portal Akses Publik
              </span>
              <h2 className="mt-2.5 text-2xl sm:text-3xl font-extrabold leading-tight tracking-tight text-slate-900">
                Daftar sebagai Masyarakat
              </h2>
              <p className="mt-1 text-slate-500 text-xs sm:text-sm">
                Lengkapi formulir di bawah ini untuk pengajuan akses data terpadu Pusat Krisis Kesehatan (EOC Kemenkes RI).
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs sm:text-sm font-semibold text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                {/* Nama Lengkap */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    Nama Lengkap <span className="text-red-500">*</span>
                  </label>
                  <div className="flex h-11 items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 transition-all focus-within:border-teal-600 focus-within:bg-white focus-within:shadow-xs">
                    <UserRound className="h-[18px] w-[18px] text-slate-400" />
                    <input
                      value={namaLengkap}
                      onChange={(e) => setNamaLengkap(e.target.value)}
                      required
                      placeholder="Nama lengkap sesuai KTP"
                      className="h-full min-w-0 flex-1 bg-transparent text-xs sm:text-sm text-slate-900 outline-none"
                    />
                  </div>
                  {fieldErrors.nama_lengkap && (
                    <p className="mt-1 text-xs text-red-600 font-medium">{fieldErrors.nama_lengkap}</p>
                  )}
                </div>

                {/* Username */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    Username <span className="text-red-500">*</span>
                  </label>
                  <div className="flex h-11 items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 transition-all focus-within:border-teal-600 focus-within:bg-white focus-within:shadow-xs">
                    <UserRound className="h-[18px] w-[18px] text-slate-400" />
                    <input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      placeholder="Username minimal 4 karakter"
                      className="h-full min-w-0 flex-1 bg-transparent text-xs sm:text-sm text-slate-900 outline-none"
                    />
                  </div>
                  {fieldErrors.username && (
                    <p className="mt-1 text-xs text-red-600 font-medium">{fieldErrors.username}</p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    Alamat Email <span className="text-red-500">*</span>
                  </label>
                  <div className="flex h-11 items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 transition-all focus-within:border-teal-600 focus-within:bg-white focus-within:shadow-xs">
                    <Mail className="h-[18px] w-[18px] text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="contoh@domain.com"
                      className="h-full min-w-0 flex-1 bg-transparent text-xs sm:text-sm text-slate-900 outline-none"
                    />
                  </div>
                  {fieldErrors.email && (
                    <p className="mt-1 text-xs text-red-600 font-medium">{fieldErrors.email}</p>
                  )}
                </div>

                {/* Telp */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    No. Telepon / WhatsApp <span className="text-red-500">*</span>
                  </label>
                  <div className="flex h-11 items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 transition-all focus-within:border-teal-600 focus-within:bg-white focus-within:shadow-xs">
                    <Phone className="h-[18px] w-[18px] text-slate-400" />
                    <input
                      value={telp}
                      onChange={(e) => setTelp(e.target.value)}
                      required
                      placeholder="Contoh: 08123456789"
                      className="h-full min-w-0 flex-1 bg-transparent text-xs sm:text-sm text-slate-900 outline-none"
                    />
                  </div>
                  {fieldErrors.telp && (
                    <p className="mt-1 text-xs text-red-600 font-medium">{fieldErrors.telp}</p>
                  )}
                </div>

                {/* Kategori Akses */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    Kategori Akses <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={kategoriAkses}
                    onChange={(e) => setKategoriAkses(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs sm:text-sm text-slate-900 outline-none transition-all focus:border-teal-600 focus:bg-white"
                  >
                    <option value="masyarakat_umum">Masyarakat Umum</option>
                    <option value="lintas_sektor">Lintas Sektor</option>
                    <option value="ngo_ormas">NGO / Organisasi Masyarakat</option>
                    <option value="akademisi">Akademisi / Mahasiswa</option>
                    <option value="lainnya">Lainnya</option>
                  </select>
                </div>

                {/* Tujuan Akses */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    Tujuan Akses Data <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={tujuanAkses}
                    onChange={(e) => setTujuanAkses(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs sm:text-sm text-slate-900 outline-none transition-all focus:border-teal-600 focus:bg-white"
                  >
                    <option value="riset_analisa">Riset / Analisa Akademik</option>
                    <option value="referensi_media">Sumber Referensi / Berita &amp; Media</option>
                    <option value="pemantauan_lapangan">Pemantauan Mandiri &amp; Komunitas</option>
                    <option value="integrasi_interoperabilitas">Integrasi / Interoperabilitas Data</option>
                    <option value="lainnya">Lainnya</option>
                  </select>
                </div>
              </div>

              {/* Conditional: Tujuan Akses Lainnya */}
              {tujuanAkses === 'lainnya' && (
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    Tulis Tujuan Akses Lainnya <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={tujuanAksesLainnya}
                    onChange={(e) => setTujuanAksesLainnya(e.target.value)}
                    required
                    placeholder="Sebutkan tujuan detail pengaksesan data krisis kesehatan"
                    rows={2}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs sm:text-sm text-slate-900 outline-none transition-all focus:border-teal-600 focus:bg-white"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                {/* Nama Institusi */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    Nama Institusi / Organisasi <span className="text-slate-400 font-normal">(Opsional)</span>
                  </label>
                  <div className="flex h-11 items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 transition-all focus-within:border-teal-600 focus-within:bg-white">
                    <Building2 className="h-[18px] w-[18px] text-slate-400" />
                    <input
                      value={namaInstitusi}
                      onChange={(e) => setNamaInstitusi(e.target.value)}
                      placeholder="Universitas / Lembaga / Instansi"
                      className="h-full min-w-0 flex-1 bg-transparent text-xs sm:text-sm text-slate-900 outline-none"
                    />
                  </div>
                </div>

                {/* Pekerjaan / Posisi */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    Pekerjaan / Jabatan <span className="text-slate-400 font-normal">(Opsional)</span>
                  </label>
                  <div className="flex h-11 items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 transition-all focus-within:border-teal-600 focus-within:bg-white">
                    <Briefcase className="h-[18px] w-[18px] text-slate-400" />
                    <input
                      value={pekerjaanPosisi}
                      onChange={(e) => setPekerjaanPosisi(e.target.value)}
                      placeholder="Peneliti / Mahasiswa / Pegawai / Relawan"
                      className="h-full min-w-0 flex-1 bg-transparent text-xs sm:text-sm text-slate-900 outline-none"
                    />
                  </div>
                </div>

                {/* Provinsi */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    Provinsi <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={provinsiId}
                    onChange={(e) => {
                      setProvinsiId(e.target.value)
                      setKabupatenId('')
                      setKecamatanId('')
                      setDesaId('')
                    }}
                    required
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs sm:text-sm text-slate-900 outline-none transition-all focus:border-teal-600 focus:bg-white"
                  >
                    <option value="">Pilih Provinsi</option>
                    {STATIC_PROVINCES.map((prov) => (
                      <option key={prov.id} value={prov.id}>
                        {prov.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Kabupaten / Kota */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    Kabupaten / Kota <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={kabupatenId}
                    onChange={(e) => {
                      setKabupatenId(e.target.value)
                      setKecamatanId('')
                      setDesaId('')
                    }}
                    required
                    disabled={!provinsiId}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs sm:text-sm text-slate-900 outline-none transition-all focus:border-teal-600 focus:bg-white disabled:opacity-50"
                  >
                    <option value="">{provinsiId ? 'Pilih Kabupaten / Kota' : 'Pilih Provinsi terlebih dahulu'}</option>
                    {regencies.map((reg) => (
                      <option key={reg.id} value={reg.id}>
                        {reg.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Kecamatan */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    Kecamatan <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={kecamatanId}
                    onChange={(e) => {
                      setKecamatanId(e.target.value)
                      setDesaId('')
                    }}
                    required
                    disabled={!kabupatenId}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs sm:text-sm text-slate-900 outline-none transition-all focus:border-teal-600 focus:bg-white disabled:opacity-50"
                  >
                    <option value="">{kabupatenId ? 'Pilih Kecamatan' : 'Pilih Kabupaten / Kota dahulu'}</option>
                    {districts.map((district) => (
                      <option key={district.id} value={district.id}>
                        {district.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Desa / Kelurahan */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    Desa / Kelurahan <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={desaId}
                    onChange={(e) => setDesaId(e.target.value)}
                    required
                    disabled={!kecamatanId}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs sm:text-sm text-slate-900 outline-none transition-all focus:border-teal-600 focus:bg-white disabled:opacity-50"
                  >
                    <option value="">{kecamatanId ? 'Pilih Desa / Kelurahan' : 'Pilih Kecamatan dahulu'}</option>
                    {villages.map((village) => (
                      <option key={village.id} value={village.id}>
                        {village.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Alamat Rumah Lengkap */}
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">
                  Alamat Rumah Lengkap <span className="text-red-500">*</span>
                </label>
                <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 transition-all focus-within:border-teal-600 focus-within:bg-white">
                  <MapPin className="h-[18px] w-[18px] text-slate-400 mt-1" />
                  <textarea
                    value={alamatUser}
                    onChange={(e) => setAlamatUser(e.target.value)}
                    required
                    placeholder="Nama jalan, nomor rumah, RT/RW, lingkungan domisili"
                    rows={2}
                    className="min-w-0 flex-1 bg-transparent text-xs sm:text-sm text-slate-900 outline-none resize-none"
                  />
                </div>
              </div>

              {/* Password & Confirm */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                {/* Password */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="flex h-11 items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 transition-all focus-within:border-teal-600 focus-within:bg-white">
                    <LockKeyhole className="h-[18px] w-[18px] text-slate-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="Minimal 8 karakter"
                      className="h-full min-w-0 flex-1 bg-transparent text-xs sm:text-sm text-slate-900 outline-none"
                    />
                  </div>

                  {/* Realtime Checklist & Strength Meter */}
                  {password.length > 0 && (
                    <div className="mt-2.5 space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                      <div>
                        <div className="flex justify-between items-center mb-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          <span>Kekuatan Sandi:</span>
                          <span
                            className={
                              strengthScore <= 1
                                ? 'text-red-600 font-extrabold'
                                : strengthScore === 2
                                ? 'text-orange-600 font-extrabold'
                                : strengthScore === 3
                                ? 'text-amber-600 font-extrabold'
                                : strengthScore === 4
                                ? 'text-blue-600 font-extrabold'
                                : 'text-emerald-600 font-extrabold'
                            }
                          >
                            {strengthScore <= 1 && 'Sangat Lemah'}
                            {strengthScore === 2 && 'Lemah'}
                            {strengthScore === 3 && 'Cukup'}
                            {strengthScore === 4 && 'Kuat'}
                            {strengthScore === 5 && 'Sangat Kuat'}
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              strengthScore <= 1
                                ? 'bg-red-500 w-1/5'
                                : strengthScore === 2
                                ? 'bg-orange-500 w-2/5'
                                : strengthScore === 3
                                ? 'bg-amber-500 w-3/5'
                                : strengthScore === 4
                                ? 'bg-blue-500 w-4/5'
                                : 'bg-emerald-500 w-full'
                            }`}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] pt-1">
                        <div className="flex items-center gap-1.5">
                          {pwdChecks.minLength ? (
                            <Check className="h-3.5 w-3.5 text-teal-600" />
                          ) : (
                            <X className="h-3.5 w-3.5 text-red-500" />
                          )}
                          <span className={pwdChecks.minLength ? 'text-teal-800 font-semibold' : 'text-slate-500'}>
                            Min. 8 karakter
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {pwdChecks.hasUpper ? (
                            <Check className="h-3.5 w-3.5 text-teal-600" />
                          ) : (
                            <X className="h-3.5 w-3.5 text-red-500" />
                          )}
                          <span className={pwdChecks.hasUpper ? 'text-teal-800 font-semibold' : 'text-slate-500'}>
                            Huruf Besar (A-Z)
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {pwdChecks.hasLower ? (
                            <Check className="h-3.5 w-3.5 text-teal-600" />
                          ) : (
                            <X className="h-3.5 w-3.5 text-red-500" />
                          )}
                          <span className={pwdChecks.hasLower ? 'text-teal-800 font-semibold' : 'text-slate-500'}>
                            Huruf Kecil (a-z)
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {pwdChecks.hasNumber ? (
                            <Check className="h-3.5 w-3.5 text-teal-600" />
                          ) : (
                            <X className="h-3.5 w-3.5 text-red-500" />
                          )}
                          <span className={pwdChecks.hasNumber ? 'text-teal-800 font-semibold' : 'text-slate-500'}>
                            Angka (0-9)
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 col-span-2">
                          {pwdChecks.hasSpecial ? (
                            <Check className="h-3.5 w-3.5 text-teal-600" />
                          ) : (
                            <X className="h-3.5 w-3.5 text-red-500" />
                          )}
                          <span className={pwdChecks.hasSpecial ? 'text-teal-800 font-semibold' : 'text-slate-500'}>
                            Karakter Khusus (@$!%*?&amp;)
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    Konfirmasi Password <span className="text-red-500">*</span>
                  </label>
                  <div className="flex h-11 items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 transition-all focus-within:border-teal-600 focus-within:bg-white">
                    <LockKeyhole className="h-[18px] w-[18px] text-slate-400" />
                    <input
                      type="password"
                      value={rePassword}
                      onChange={(e) => setRePassword(e.target.value)}
                      required
                      placeholder="Ulangi password di atas"
                      className="h-full min-w-0 flex-1 bg-transparent text-xs sm:text-sm text-slate-900 outline-none"
                    />
                  </div>

                  {rePassword.length > 0 && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs">
                      {password === rePassword ? (
                        <span className="flex items-center gap-1.5 text-emerald-700 font-bold">
                          <Check className="h-3.5 w-3.5 text-emerald-600" /> Password cocok
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-red-600 font-bold">
                          <X className="h-3.5 w-3.5 text-red-500" /> Password belum cocok
                        </span>
                      )}
                    </div>
                  )}
                  {fieldErrors.re_password && (
                    <p className="mt-1 text-xs text-red-600 font-medium">{fieldErrors.re_password}</p>
                  )}
                </div>
              </div>

              {/* Captcha Keamanan */}
              <div className="space-y-1.5 max-w-[320px]">
                <label className="block text-xs font-bold text-slate-700">
                  Keamanan (Captcha) <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex h-11 flex-1 items-center justify-between rounded-xl border border-teal-200 bg-teal-50/70 px-3 font-extrabold text-[#047D78] shadow-inner select-none">
                    <span className="text-sm tracking-wider">{captchaData.question}</span>
                    <button
                      type="button"
                      onClick={refreshCaptcha}
                      className="rounded-lg p-1 text-teal-700 hover:bg-teal-100 transition"
                      title="Ganti Pertanyaan Captcha"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={captchaValue}
                    onChange={(e) => setCaptchaValue(e.target.value)}
                    required
                    placeholder="Hasil"
                    className="h-11 w-24 rounded-xl border border-slate-200 bg-slate-50 px-3 text-center text-sm font-bold text-slate-900 outline-none transition focus:border-teal-600 focus:bg-white"
                  />
                </div>
              </div>

              {/* Syarat & Ketentuan Checkbox */}
              <div className="flex items-start gap-2.5 pt-1">
                <input
                  type="checkbox"
                  id="acceptTerms"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-500 cursor-pointer"
                />
                <label
                  htmlFor="acceptTerms"
                  className="text-xs font-medium text-slate-600 leading-relaxed cursor-pointer select-none"
                >
                  Saya menyatakan bahwa data yang saya berikan adalah benar dan menyetujui seluruh{' '}
                  <button
                    type="button"
                    onClick={() => setShowTermsModal(true)}
                    className="text-teal-700 hover:text-teal-800 font-bold underline"
                  >
                    Syarat &amp; Ketentuan
                  </button>{' '}
                  yang berlaku untuk pendaftaran akun masyarakat EOC Krisis Kesehatan.
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting || !isPasswordValid || password !== rePassword || !captchaValue || !acceptTerms}
                className="w-full inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#047D78] px-4 text-xs sm:text-sm font-bold uppercase tracking-wider text-white shadow-md hover:bg-[#03605c] transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <UserPlus className="h-5 w-5" />
                )}
                {submitting ? 'Mengajukan Pendaftaran...' : 'Kirim Pendaftaran'}
              </button>
            </form>
          </div>
        )}

        {/* ── STEP 2: VERIFIKASI OTP ──────────────────────────────────── */}
        {step === 'otp' && (
          <div className="w-full max-w-[460px] mx-auto py-4">
            <div className="mb-6 text-center">
              <span className="inline-block rounded-full bg-teal-50 border border-teal-200 px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest text-[#047D78]">
                Verifikasi Email
              </span>
              <h2 className="mt-3 text-2xl font-black leading-tight text-slate-900">
                Masukkan Kode OTP
              </h2>
              <p className="mt-2 text-slate-500 text-xs sm:text-sm leading-relaxed">
                Kode OTP 4-digit telah dikirimkan ke alamat email{' '}
                <span className="font-bold text-slate-800">{email}</span>.
              </p>
              <div className="mt-2.5 inline-block rounded-lg border border-teal-200 bg-teal-50/80 px-3 py-1 text-xs font-semibold text-teal-800">
                💡 Kode OTP demo Anda: <strong className="font-mono text-sm tracking-widest">{expectedOtp}</strong>
              </div>
            </div>

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">
                  Kode Verifikasi OTP (4 Digit)
                </label>
                <div className="flex h-12 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 transition-all focus-within:border-teal-600 focus-within:bg-white">
                  <KeyRound className="h-5 w-5 text-slate-400" />
                  <input
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    required
                    placeholder="Masukkan 4 digit OTP"
                    maxLength={4}
                    className="h-full min-w-0 flex-1 bg-transparent text-center font-mono text-lg font-black tracking-[0.4em] text-slate-900 outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={verifyingOtp}
                className="w-full inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#047D78] px-4 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#03605c] transition-all shadow-md disabled:opacity-75 disabled:cursor-wait"
              >
                {verifyingOtp ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Check className="h-5 w-5" />
                )}
                {verifyingOtp ? 'Memverifikasi...' : 'Verifikasi OTP'}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || resendingOtp}
                  className="text-xs font-bold text-[#047D78] hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resendingOtp
                    ? 'Mengirim ulang...'
                    : resendCooldown > 0
                    ? `Kirim Ulang OTP dalam (${resendCooldown}s)`
                    : 'Kirim Ulang Kode OTP'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── STEP 3: SUKSES ──────────────────────────────────────────── */}
        {step === 'success' && (
          <div className="w-full max-w-[500px] mx-auto text-center py-6 space-y-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-teal-50 border-2 border-teal-200 mx-auto text-[#047D78]">
              <CheckCircle2 className="h-10 w-10" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-black text-slate-900">Email Berhasil Terverifikasi</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
                {successMessage} Pendaftaran akun masyarakat atas nama <strong>{namaLengkap}</strong> (Username: <code>{username}</code>) telah berhasil dicatat. Status akun Anda sedang menunggu konfirmasi persetujuan oleh Administrator EOC.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/dashboard/login"
                className="inline-flex h-12 items-center justify-center rounded-xl bg-[#047D78] px-8 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#03605c] transition-colors shadow-md"
              >
                Lanjut ke Halaman Login
              </Link>
              <button
                type="button"
                onClick={handleGuestAccess}
                className="inline-flex h-12 items-center justify-center rounded-xl border border-teal-300 bg-teal-50 px-8 text-xs font-bold uppercase tracking-wider text-[#047D78] hover:bg-teal-100 transition-colors shadow-2xs cursor-pointer"
              >
                Langsung Masuk sebagai Tamu
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── SYARAT & KETENTUAN MODAL ────────────────────────────────────── */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-teal-200/80 flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-teal-50/60 rounded-t-3xl">
              <h3 className="text-base font-extrabold text-slate-900 uppercase tracking-wide">
                Syarat &amp; Ketentuan Akun Masyarakat
              </h3>
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-600 transition"
                aria-label="Tutup"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5 text-xs sm:text-sm text-slate-600 space-y-4 leading-relaxed scrollbar-thin">
              <p>
                Selamat datang di portal pendaftaran publik <strong>Emergency Operation Center (EOC) Pusat Krisis Kesehatan Kemenkes RI</strong>. Dengan mendaftar dan menggunakan portal ini, Anda setuju untuk mematuhi ketentuan di bawah ini:
              </p>

              <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                1. Hak Akses &amp; Akun
              </h4>
              <p className="pl-3 border-l-2 border-teal-600 text-slate-600">
                Penggunaan akun masyarakat ditujukan untuk tujuan pemantauan mandiri, riset kebencanaan kesehatan, rujukan media resmi, dan partisipasi publik yang bertanggung jawab. Anda bertanggung jawab penuh atas kerahasiaan kata sandi dan keamanan akun Anda.
              </p>

              <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                2. Penggunaan Data &amp; Etika
              </h4>
              <p className="pl-3 border-l-2 border-teal-600 text-slate-600">
                Data kejadian bencana, sebaran fasyankes, logistik darurat, dan ringkasan epidemiologis yang diperoleh melalui sistem ini hanya boleh digunakan sesuai tujuan akses yang diajukan. Dilarang menyebarkan hoaks, disinformasi, atau memanipulasi data krisis kesehatan masyarakat.
              </p>

              <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                3. Verifikasi &amp; Validasi Akun
              </h4>
              <p className="pl-3 border-l-2 border-teal-600 text-slate-600">
                Pendaftaran akun memerlukan verifikasi email melalui OTP dan validasi administratif oleh Tim EOC Pusat Krisis Kesehatan. Kami berhak menangguhkan atau mencabut hak akses jika ditemukan data diri yang fiktif atau penyalahgunaan akun.
              </p>

              <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                4. Keamanan Sistem &amp; Privasi
              </h4>
              <p className="pl-3 border-l-2 border-teal-600 text-slate-600">
                Seluruh aktivitas akses dicatat dalam log keamanan sistem. Sistem ini tunduk pada peraturan perundang-undangan perlindungan data pribadi dan keterbukaan informasi publik di Republik Indonesia.
              </p>

              <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                Pusat Krisis Kesehatan &bull; Kementerian Kesehatan Republik Indonesia.
              </p>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 rounded-b-3xl border-t border-slate-100 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setAcceptTerms(true)
                  setShowTermsModal(false)
                }}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-[#047D78] px-4 text-xs font-bold text-white hover:bg-[#03605c] transition"
              >
                Setuju &amp; Lanjutkan
              </button>
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
