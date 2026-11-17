import {
  Hospital,
  Building2,
  Home,
  Radio,
  Database,
  Activity,
  Search,
  MapPin,
  AlertTriangle,
  Users,
  Tags,
  BookText,
  ShieldCheck,
  Languages,
  Braces,
  Cpu,
  FileText,
  FileSpreadsheet,
  Settings,
  History,
  Stethoscope,
  ClipboardCheck,
  Utensils,
  Globe2,
  Tv,
  LayoutDashboard,
  SlidersHorizontal,
  Layers,
  Folder,
  BarChart3,
  LineChart,
  PieChart,
  Shield,
  CheckCircle2,
  Bookmark,
  Compass,
  Bell,
  Flame,
  CloudSun,
  Eye,
  Circle,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Waypoints,
  Clock,
  TrendingUp,
  Bug,
  FolderTree,
  FilePlus,
  Key,
  Lock,
  Sparkles,
  Share2,
  Calendar,
  PhoneCall,
  Ambulance,
  Package,
} from 'lucide-react'

// Icon registry for serializable navigation configurations
export const MENU_ICON_MAP: Record<string, any> = {
  Hospital,
  Building2,
  Home,
  Radio,
  Database,
  Activity,
  Search,
  MapPin,
  AlertTriangle,
  Users,
  Tags,
  BookText,
  ShieldCheck,
  Languages,
  Braces,
  Cpu,
  FileText,
  FileSpreadsheet,
  Settings,
  History,
  Stethoscope,
  ClipboardCheck,
  Utensils, // PR 034
  Globe2,
  Tv,
  LayoutDashboard,
  SlidersHorizontal,
  Layers,
  Folder,
  BarChart3,
  LineChart,
  PieChart,
  Shield,
  CheckCircle2,
  Bookmark,
  Compass,
  Bell,
  Flame,
  CloudSun,
  Eye,
  ExternalLink,
  Waypoints,
  Clock,
  TrendingUp,
  Bug,
  FolderTree,
  FilePlus,
  Key,
  Lock,
  Sparkles,
  Share2,
  Calendar,
  PhoneCall,
  Ambulance,
  Package,
}

export function resolveMenuIcon(name?: string) {
  if (!name) return Circle
  return MENU_ICON_MAP[name] || Circle
}

export type SidebarSubItemConfig = {
  id: string
  label: string
  labelKey?: string
  href: string
  icon?: string
  order?: number
  enabled: boolean
  targetRoles?: string[]
  badge?: string
  description?: string
}

export type SidebarItemConfig = {
  id: string
  label: string
  labelKey?: string
  href?: string
  icon?: string
  order?: number
  enabled: boolean
  targetRoles?: string[]
  badge?: string
  description?: string
  /** PR 017: 'pe_forms' = sub-items generated from the PE form registry */
  source?: string
  subItems?: SidebarSubItemConfig[]
}

/** PR 029: which sidebar a group belongs to. 'home' groups show only on Beranda (full sidebar). */
export type NavArea = 'home' | 'dashboard' | 'tatakelola'

export type SidebarGroupConfig = {
  id: string
  title: string
  titleKey?: string
  order?: number
  enabled: boolean
  targetRoles?: string[]
  /** PR 029: sidebar area + access hints (enforced by AuthGuard/backend, these only drive display) */
  area?: NavArea
  requiresAuth?: boolean
  permission?: string
  items: SidebarItemConfig[]
}

// Legacy-compatible types
export type SidebarItem = {
  id?: string
  label: string
  labelKey?: string
  icon: any
  iconName?: string
  href?: string
  url?: string
  external?: boolean
  order?: number
  enabled?: boolean
  badge?: string
  description?: string
  source?: string
  subItems?: SidebarItem[]
}

export type SidebarGroup = {
  id?: string
  title: string
  titleKey?: string
  order?: number
  enabled?: boolean
  area?: NavArea
  requiresAuth?: boolean
  permission?: string
  items: SidebarItem[]
}

// PR 017: default (pre-settings) menu = app_settings.navigation_menu (first paint only; the DB value wins once
// settings load). PR 029: mirrors migration 051 (areas home / dashboard / tatakelola, Dasbor Limited, Manajemen Akses).
// Form PE sub-items per disease come from the PE form registry.
const it = (id: string, label: string, href: string, icon: string, order: number, extra: Partial<SidebarItemConfig> = {}): SidebarItemConfig =>
  ({ id, label, href, icon, order, enabled: true, ...extra })

export const DASBOR_SKDR_SUB_ITEMS: SidebarSubItemConfig[] = [
  {
    id: 'mod_skdr_ringkasan',
    label: 'Ringkasan Utama (IBS & EBS)',
    href: '/dashboard/skdr/ringkasan',
    icon: 'LayoutDashboard',
    order: 1,
    enabled: true,
    description: 'Sintesis komando surveilans nasional: beban kasus IBS, rumor & sinyal EBS, kelengkapan & ketepatan faskes (target ≥80%), serta peta spasial klaster',
  },
  {
    id: 'mod_skdr_tren',
    label: 'Tren Penyakit (IBS)',
    href: '/dashboard/skdr/tren',
    icon: 'TrendingUp',
    order: 2,
    enabled: true,
    description: 'Kurva epidemiologi mingguan (Minggu 1–52) per penyakit indikator dengan ambang batas (Mean + 2SD), komparasi multi-tahun, multi-wilayah, dan korelasi iklim ERA5',
  },
  {
    id: 'mod_skdr_distribusi',
    label: 'Distribusi & Demografi',
    href: '/dashboard/skdr/distribusi',
    icon: 'Users',
    order: 3,
    enabled: true,
    description: 'Analisa distribusi orang (piramida golongan usia dan jenis kelamin), sebaran unit pelapor (Puskesmas, RS, Klinik, Lab), serta peringkat insidensi wilayah',
  },
  {
    id: 'mod_skdr_717',
    label: 'WHO 7-1-7 & Kinerja EBS',
    href: '/dashboard/skdr/717',
    icon: 'Clock',
    order: 4,
    enabled: true,
    description: 'Pengukuran ketepatan respon standar internasional WHO: deteksi ≤7 hari, notifikasi ≤1 hari, respon ≤7 hari, kualitas sinyal, konversi KLB, dan AAR',
  },
  {
    id: 'mod_skdr_deteksi',
    label: 'Deteksi Outbreak & Iklim',
    href: '/dashboard/skdr/deteksi',
    icon: 'Activity',
    order: 5,
    enabled: true,
    description: 'Algoritma statistik deteksi dini KLB (EARS C1–C3 & Farrington), korelasi titik panas karhutla (NASA FIRMS) vs lonjakan ISPA, serta radar kapasitas IHR/JEE',
  },
  {
    id: 'mod_skdr_buletin',
    label: 'Buletin & Infografis',
    href: '/dashboard/skdr/buletin',
    icon: 'FileText',
    order: 6,
    enabled: true,
    description: 'Generator laporan buletin mingguan otomatis skala nasional/provinsi dan infografis digital responsif siap unduh (PNG) serta cetak PDF',
  },
]

export const DASBOR_SKDR_MENU_ITEM: SidebarItemConfig = {
  id: 'mod_main_dashboard',
  label: 'Dasbor SKDR',
  href: '#',
  icon: 'LayoutDashboard',
  order: 1,
  enabled: true,
  description: 'Dasbor komando surveilans terpadu SKDR: Ringkasan IBS & EBS, Tren Penyakit, Distribusi Demografi, Kinerja 7-1-7, Deteksi Outbreak, dan Buletin',
  subItems: DASBOR_SKDR_SUB_ITEMS,
}

export const DASBOR_MBG_SUB_ITEMS: SidebarSubItemConfig[] = [
  {
    id: 'mod_dasbor_mbg_ringkasan',
    label: 'Ringkasan Eksekutif',
    href: '/dashboard/mbg/ringkasan',
    icon: 'LayoutDashboard',
    order: 1,
    enabled: true,
    description: 'Kajian eksekutif pimpinan, rekomendasi pengerahan sumber daya, korelasi risiko pengawasan × kejadian, dan peta komparasi spasial',
  },
  {
    id: 'mod_dasbor_mbg_keracunan',
    label: 'Keracunan Pangan',
    href: '/dashboard/mbg/keracunan',
    icon: 'AlertTriangle',
    order: 2,
    enabled: true,
    description: 'Analisa epidemiologi KLB keracunan pangan: beban kasus/CFR, peta sebaran, kurva epidemi, ketepatan respons 24 jam, etiologi lab & lingkungan dapur',
  },
  {
    id: 'mod_dasbor_mbg_pengawasan',
    label: 'Pengawasan Gizi',
    href: '/dashboard/mbg/pengawasan',
    icon: 'ClipboardCheck',
    order: 3,
    enabled: true,
    description: 'Analisa kepatuhan standar gizi & audit SPPG (Formulir 1–13): cakupan, aspek terlemah, matriks SPPG × formulir, temuan & daftar prioritas pembinaan',
  },
]

export const DASBOR_MBG_MENU_ITEM: SidebarItemConfig = {
  id: 'mod_dasbor_mbg',
  label: 'Dasbor MBG',
  href: '#',
  icon: 'Utensils',
  order: 1.9,
  enabled: true,
  description: 'Dasbor analitik Program Makan Bergizi Gratis (MBG): Ringkasan Eksekutif, Analisa Keracunan Pangan, dan Analisa Pengawasan Gizi',
  subItems: DASBOR_MBG_SUB_ITEMS,
}

export const DASBOR_ZOONOSIS_SUB_ITEMS: SidebarSubItemConfig[] = [
  {
    id: 'sub_zoonosis_general',
    label: 'Zoonosis General',
    href: '/dasbor/zoonosis-general',
    icon: 'LayoutDashboard',
    order: 1,
    enabled: true,
    description: 'Sintesis komprehensif penyakit zoonosis: beban kasus, CFR, kurva tren, alert SKDR, dan peta sebaran',
  },
  {
    id: 'sub_zoonosis_lite',
    label: 'Zoonosis Lite',
    labelKey: 'skdr.lite.menu',
    href: '/dasbor/zoonosis-lite',
    icon: 'Activity',
    order: 2,
    enabled: true,
    description: 'Antraks, Rabies, Leptospirosis, Flu Burung: CFR dan peta sebaran',
  },
  {
    id: 'sub_kategori_pd3i',
    label: 'PD3I',
    href: '/dasbor/kategori/pd3i',
    icon: 'Shield',
    order: 3,
    enabled: true,
    description: 'Penyakit yang Dapat Dicegah Dengan Imunisasi (PD3I)',
  },
  {
    id: 'sub_kategori_tular_vektor',
    label: 'Tular Vektor',
    href: '/dasbor/kategori/tular-vektor',
    icon: 'Bug',
    order: 4,
    enabled: true,
    description: 'Penyakit Tular Vektor dan Zoonotik',
  },
  {
    id: 'sub_kategori_menular_langsung',
    label: 'Menular Langsung',
    href: '/dasbor/kategori/menular-langsung',
    icon: 'Users',
    order: 5,
    enabled: true,
    description: 'Penyakit Menular Langsung',
  },
  {
    id: 'sub_kategori_tular_makanan_air',
    label: 'Tular Makanan & Air',
    href: '/dasbor/kategori/tular-makanan-air',
    icon: 'Layers',
    order: 6,
    enabled: true,
    description: 'Penyakit Tular Makanan dan Air Terkontaminasi',
  },
  {
    id: 'sub_kategori_pie',
    label: 'PIE',
    href: '/dasbor/kategori/pie',
    icon: 'AlertTriangle',
    order: 7,
    enabled: true,
    description: 'Penyakit Infeksi Emerging (PIE)',
  },
]

export const DASBOR_ZOONOSIS_MENU_ITEM: SidebarItemConfig = {
  id: 'mod_dasbor_kategori',
  label: 'Dasbor Zoonosis',
  href: '#',
  icon: 'Bug',
  order: 1.7,
  enabled: true,
  description: 'Dasbor analitik penyakit zoonosis dan per kategori',
  subItems: DASBOR_ZOONOSIS_SUB_ITEMS,
}

export const FORM_PE_SUB_ITEMS: SidebarSubItemConfig[] = [
  { id: 'sub_pe_daftar', label: 'Daftar PE', href: '/pe', icon: 'FileSpreadsheet', order: 1, enabled: true, description: 'Daftar dan ringkasan penyelidikan epidemiologi semua penyakit' },
  { id: 'sub_pe_lepto', label: 'Leptospirosis', href: '/pe/lepto', icon: 'FileText', order: 2, enabled: true, description: 'Formulir PE Leptospirosis' },
  { id: 'sub_pe_rabies', label: 'Rabies', href: '/pe/rabies', icon: 'FileText', order: 3, enabled: true, description: 'Formulir PE Rabies / GHPR' },
  { id: 'sub_pe_antraks', label: 'Antraks', href: '/pe/antraks', icon: 'FileText', order: 4, enabled: true, description: 'Formulir PE Antraks' },
  { id: 'sub_pe_ai', label: 'Flu Burung', href: '/pe/ai', icon: 'FileText', order: 5, enabled: true, description: 'Formulir PE Flu Burung / Avian Influenza' },
]

export const DEFAULT_NAVIGATION_CONFIG: SidebarGroupConfig[] = [
  { id: 'grp_dasbor', title: 'Dasbor', order: 1, enabled: true, area: 'dashboard', items: [
    it('mod_ringkasan', 'Ringkasan', '/dashboard/ringkasan', 'LayoutDashboard', 1, {
      description: 'Dasbor agregat Pusat Krisis Kesehatan',
    }),
    it('mod_situasi_krisis', 'Situasi Krisis', '/dashboard/situasi-krisis', 'AlertTriangle', 2, {
      description: 'Kejadian bencana, korban, pengungsi, dan tren dari Pantauan Bencana / EOC',
    }),
    it('mod_layanan', 'Layanan Gawat Darurat', '/dashboard/layanan-gawat-darurat', 'PhoneCall', 3, {
      description: 'PSC, ambulans, dan panggilan 119',
      subItems: [
        { id: 'lay_psc', label: 'PSC', href: '/dashboard/layanan-gawat-darurat/psc', icon: 'PhoneCall', order: 1, enabled: true },
        { id: 'lay_amb', label: 'Ambulans', href: '/dashboard/layanan-gawat-darurat/ambulans', icon: 'Ambulance', order: 2, enabled: true },
        { id: 'lay_ncc', label: 'Panggilan 119', href: '/dashboard/layanan-gawat-darurat/panggilan-119', icon: 'Radio', order: 3, enabled: true },
      ],
    }),
    it('mod_kesiap', 'Kesiapsiagaan', '/dashboard/kesiapsiagaan', 'Users', 4, {
      description: 'Tenaga cadangan kesehatan dan logistik',
      subItems: [
        { id: 'kes_tck', label: 'Tenaga Cadangan', href: '/dashboard/kesiapsiagaan/tenaga-cadangan', icon: 'Users', order: 1, enabled: true },
        { id: 'kes_log', label: 'Logistik', href: '/dashboard/kesiapsiagaan/logistik', icon: 'Package', order: 2, enabled: true },
      ],
    }),
    it('mod_asistensi', 'Asistensi Risiko', '/dashboard/asistensi-risiko', 'Shield', 5, {
      description: 'Status kapasitas dan kelengkapan asesmen risiko',
      subItems: [
        { id: 'asis_prov', label: 'Provinsi', href: '/dashboard/asistensi-risiko/provinsi', icon: 'Shield', order: 1, enabled: true },
        { id: 'asis_kab', label: 'Kab/Kota', href: '/dashboard/asistensi-risiko/kabupaten-kota', icon: 'MapPin', order: 2, enabled: true },
      ],
    }),
    it('mod_dasbor_sumber', 'Dasbor Sumber', '#', 'ExternalLink', 6, {
      description: 'Tautan ke dasbor sumber asli, terbuka di tab baru',
      subItems: [
        { id: 'src_psc', label: 'PSC', href: 'https://psc.kemkes.go.id/dashboard', icon: 'PhoneCall', order: 1, enabled: true, description: 'Dasbor PSC 119' },
        { id: 'src_ambulans', label: 'Ambulans', href: 'https://psc.kemkes.go.id/dashboard/dashboard-ambulans', icon: 'Ambulance', order: 2, enabled: true, description: 'Dasbor armada ambulans' },
        { id: 'src_ncc', label: 'NCC Panggilan', href: 'https://psc.kemkes.go.id/dashboard/dashboard-ncc', icon: 'Radio', order: 3, enabled: true, description: 'Dasbor panggilan 119' },
        { id: 'src_eoc', label: 'Pantauan Bencana', href: 'https://pusatkrisis.kemkes.go.id/dashboard-new', icon: 'AlertTriangle', order: 4, enabled: true, description: 'Pantauan bencana Pusat Krisis' },
        { id: 'src_eoc_vercel', label: 'EOC', href: 'https://dashboard-eoc.vercel.app/dashboard-eoc/', icon: 'Activity', order: 5, enabled: true, description: 'Dasbor EOC' },
        { id: 'src_tck', label: 'Tenaga Cadangan', href: 'https://tenagacadangankesehatan.kemkes.go.id/web/site/dashboard-tck', icon: 'Users', order: 6, enabled: true, description: 'Dasbor Tenaga Cadangan Kesehatan' },
        { id: 'src_logistik', label: 'Logistik', href: 'https://pusatkrisis.kemkes.go.id/logistik/site/landing-page', icon: 'Package', order: 7, enabled: true, description: 'Landing SIMLOGKES' },
        { id: 'src_asistensi_prov', label: 'Asistensi Provinsi', href: 'https://pusatkrisis.kemkes.go.id/asistensi/dashboard-provinsi/index?modul=58MFls8WhAeVFGXqpKj9KQ%3D%3D', icon: 'Shield', order: 8, enabled: true, description: 'Asistensi Risiko tingkat provinsi' },
        { id: 'src_asistensi_kab', label: 'Asistensi Kab/Kota', href: 'https://pusatkrisis.kemkes.go.id/asistensi/dashboard-kabkot/index?modul=%2FArN8EAs7d%2BDUOevVYliBA%3D%3D', icon: 'MapPin', order: 9, enabled: true, description: 'Asistensi Risiko tingkat kabupaten/kota' },
      ],
    }),
    it('mod_analisis', 'Analisis', '/dashboard/analisis', 'BarChart3', 7, {
      description: 'Indeks kesenjangan, tren jenis kejadian, posisi beban vs kapasitas, dan jam sibuk 119',
    }),
    it('mod_open_data', 'Open Data', '/dashboard/open-data', 'Database', 7.5, {
      description: 'Daftar API luar (API Intelijen) yang dipakai peta, lengkap dengan status langsung',
    }),
    it('mod_spatial', 'Spatial Mode', '/dashboard/spatial-mode', 'Globe2', 8, { description: 'Tampilan peta layar penuh dengan variabel Pusat Krisis Kesehatan' }),
  ] },
]

export function normalizeDasborMbgMenu(config: SidebarGroupConfig[]): SidebarGroupConfig[] {
  return config
}

export function convertConfigToSidebarGroups(config: SidebarGroupConfig[]): SidebarGroup[] {
  return config
    .filter((grp) => grp.enabled)
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((grp) => ({
      id: grp.id,
      title: grp.title,
      titleKey: grp.titleKey,
      area: grp.area,
      requiresAuth: grp.requiresAuth,
      permission: grp.permission,
      items: (grp.items || [])
        .filter((item) => item.enabled)
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((item) => ({
          id: item.id,
          label: item.label,
          labelKey: item.labelKey,
          icon: resolveMenuIcon(item.icon),
          iconName: item.icon,
          href: item.href,
          badge: item.badge,
          description: item.description,
          subItems: item.subItems
            ?.filter((sub) => sub.enabled)
            .sort((a, b) => (a.order || 0) - (b.order || 0))
            .map((sub) => ({
              id: sub.id,
              label: sub.label,
              labelKey: sub.labelKey,
              icon: resolveMenuIcon(sub.icon),
              iconName: sub.icon,
              href: sub.href,
              badge: sub.badge,
              description: sub.description,
            })),
        })),
    }))
}

export function ensureBorderCountriesMenu(menu: SidebarGroupConfig[]): SidebarGroupConfig[] {
  return menu
}

export function ensureZoonosisLiteMenu(menu: SidebarGroupConfig[]): SidebarGroupConfig[] {
  return menu
}

export const sidebarMenu: SidebarGroup[] = convertConfigToSidebarGroups(DEFAULT_NAVIGATION_CONFIG)

// Dedicated Console Menu in Full English
export const consoleMenu: SidebarGroup[] = []
// export const consoleMenu: SidebarGroup[] = [
//   {
//     title: 'SYSTEM MANAGEMENT',
//     items: [
//       { label: 'Configuration & Branding', icon: Settings, href: '/console/settings' },
//       { label: 'Configuration Modul', icon: SlidersHorizontal, href: '/console/configuration-modul' },
//       { label: 'Publication CMS & Reports', icon: FileText, href: '/reports/cms' },
//       { label: 'User Management', icon: Users, href: '/console/users' },
//       { label: 'Activity Audit Logs', icon: FileText, href: '/console/settings?tab=audit' },
//     ],
//   },
//   {
//     title: 'NAVIGATION',
//     items: [
//       { label: 'Home Portal', icon: Home, href: '/' },
//       { label: 'Main Dashboard', icon: LayoutDashboard, href: '/main-dashboard' },
//       { label: 'TV Command Center', icon: Activity, href: '/tv' },
//       { label: 'Reports', icon: FileText, href: '/reports' },
//       { label: 'Matrix & ledger', icon: FileSpreadsheet, href: '/reports/matrix' },
//     ],
//   },
// ]
