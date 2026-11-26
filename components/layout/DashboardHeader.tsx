'use client'

import { tr } from "@/lib/i18n/LanguageContext";
import {
  LayoutDashboard,
  Menu,
  Settings as SettingsIcon,
  Users as UsersIcon,
  FileText,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PUBLIC_BASE_PATH } from "@/lib/public-path";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useSettings } from "@/lib/settings-context";
import UserMenu, { AreaSwitch } from "@/components/layout/UserMenu";

export default function DashboardHeader({
  onToggleSidebar,
  authenticated = true,
  consoleMode = false,
  transparent = false,
  title,
  subtitle,
  compact = false,
}: {
  onToggleSidebar: () => void;
  authenticated?: boolean;
  consoleMode?: boolean;
  /** PR 018: Beranda — no own background/border; the page background shows through. */
  transparent?: boolean;
  /** PR 027: page-specific title/subtitle (Dasbor Zoonosis Lite) instead of the app name/tagline. */
  title?: string;
  subtitle?: string;
  /** PR 027: shorter banner so a one-screen page keeps its height. */
  compact?: boolean;
}) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { settings } = useSettings();

  const rawLogo = settings.sidebar_logo_url || `${PUBLIC_BASE_PATH}/Logo-Kemenkes.png`;
  const logoSrc = rawLogo.replace(/^\/nlp\//, '/');


  const appTitle = title ? title : consoleMode
    ? tr("skdr.layout.console")
    : (settings.app_name || tr("skdr.layout.appName"));

  const appSubtitle = subtitle ? subtitle : consoleMode
    ? tr("skdr.layout.consoleSub")
    : (settings.app_tagline || tr("skdr.layout.appTagline"));

  const onBrand = !transparent;

  return (
    <header
      className={`w-full ${transparent ? "bg-transparent" : "border-b border-brand-600/50 shadow-sm"}`}
      style={onBrand ? { backgroundColor: "var(--ttdk-color-brand-green-500, #16B3AC)" } : undefined}
      data-testid="app-header"
    >
      <div className={`relative flex ${compact ? "min-h-[84px]" : "min-h-[118px]"} items-stretch overflow-visible ${transparent ? "bg-transparent" : ""}`}>
        {transparent ? null : (
          <>
            {/* Banner header texture subtly blended over SATUSEHAT Brand Green 500 (#16B3AC) */}
            <div
              aria-hidden
              className="absolute inset-0 bg-cover bg-no-repeat bg-[position:right_center] opacity-[0.14] mix-blend-luminosity"
              style={{ backgroundImage: `url(${PUBLIC_BASE_PATH}/bg-header.jpg)` }}
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-r from-[#16B3AC] via-[#16B3AC]/90 to-[#128F8A]/95"
            />
          </>
        )}
        <div className={`relative grid w-full gap-5 px-4 md:px-6 ${compact ? "py-2.5" : "py-4"} lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center`}>
          <div className="flex min-w-0 items-center gap-4">
            <button
              type="button"
              data-testid="nav-toggle"
              onClick={onToggleSidebar}
              aria-label={t("header.openMenu")}
              className={`inline-flex h-11 w-11 shrink-0 lg:hidden items-center justify-center rounded-xl border shadow-sm transition ${onBrand
                  ? "border-white/30 bg-white/15 text-white hover:bg-white/25"
                  : "border-brand-200 bg-white/90 text-slate-700 hover:bg-white"
                }`}
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link
              href={consoleMode ? "/console/settings" : "/dashboard/ringkasan"}
              className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:gap-5"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoSrc}
                alt={tr("skdr.layout.logo")}
                className={`h-auto shrink-0 object-contain ${compact ? "max-h-[52px] w-[120px] md:w-[140px]" : "max-h-[62px] w-[132px] md:w-[168px]"} ${onBrand ? "brightness-0 invert" : ""}`}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div className={`min-w-0 md:border-l md:pl-5 ${onBrand ? "border-white/30" : "border-brand-200"}`}>
                <div className="flex items-center gap-2">
                  <h1 className={`whitespace-nowrap font-extrabold uppercase leading-none tracking-tight ${onBrand ? "text-white" : "text-brand-900"} ${title ? "text-lg sm:text-xl lg:text-2xl" : "text-lg sm:text-xl lg:text-[1.65rem] xl:text-2xl"}`} data-testid="app-header-title">
                    {appTitle}
                  </h1>
                  {consoleMode && (
                    <span className={`hidden items-center rounded-md border px-2 py-0.5 text-xs font-bold sm:inline-flex ${onBrand
                        ? "border-white/35 bg-white/15 text-white"
                        : "border-brand-200 bg-brand-50 text-brand-800"
                      }`}>
                      ADMIN CONSOLE
                    </span>
                  )}
                </div>
                <p className={`mt-1 hidden truncate text-xs uppercase tracking-wide leading-snug sm:block md:text-sm ${onBrand ? "text-white/85" : "text-slate-600"} ${subtitle ? "max-w-[980px]" : "max-w-[760px]"}`} data-testid="app-header-subtitle">
                  {appSubtitle}
                </p>
              </div>
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 lg:justify-end">
            <LanguageSwitcher />

            {/* In Console Mode: Show Console Tabs (Settings, Users, Configuration Modul) + Button to return to Surveillance Dashboard */}
            {consoleMode ? (
              <div className={`hidden items-center rounded-2xl border p-1.5 shadow-sm backdrop-blur-sm sm:flex ${onBrand ? "border-white/25 bg-white/15" : "border-white/45 bg-white/90"
                }`}>
                <Link
                  href="/console/settings"
                  className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${pathname?.startsWith("/console/settings")
                      ? onBrand ? "bg-white text-brand-700 shadow-sm" : "bg-primary text-white hover:bg-primary-dark"
                      : onBrand ? "text-white/90 hover:bg-white/15 hover:text-white" : "text-slate-700 hover:bg-white hover:text-primary"
                    }`}
                >
                  <SettingsIcon className="h-4 w-4" />
                  {tr("skdr.layout.settings")}
                </Link>
                <Link
                  href="/console/configuration-modul"
                  className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${pathname?.startsWith("/console/configuration-modul")
                      ? onBrand ? "bg-white text-brand-700 shadow-sm" : "bg-primary text-white hover:bg-primary-dark"
                      : onBrand ? "text-white/90 hover:bg-white/15 hover:text-white" : "text-slate-700 hover:bg-white hover:text-primary"
                    }`}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  {tr("skdr.layout.modules")}
                </Link>
                <Link
                  href="/console/users"
                  className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${pathname?.startsWith("/console/users")
                      ? onBrand ? "bg-white text-brand-700 shadow-sm" : "bg-primary text-white hover:bg-primary-dark"
                      : onBrand ? "text-white/90 hover:bg-white/15 hover:text-white" : "text-slate-700 hover:bg-white hover:text-primary"
                    }`}
                >
                  <UsersIcon className="h-4 w-4" />
                  {tr("skdr.layout.users")}
                </Link>
                <Link
                  href="/reports/drafts"
                  className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${pathname?.startsWith("/reports/drafts") || pathname?.startsWith("/reports/new") || pathname?.startsWith("/reports/edit")
                      ? onBrand ? "bg-white text-brand-700 shadow-sm" : "bg-primary text-white hover:bg-primary-dark"
                      : onBrand ? "text-white/90 hover:bg-white/15 hover:text-white" : "text-slate-700 hover:bg-white hover:text-primary"
                    }`}
                >
                  <FileText className="h-4 w-4" />
                  {tr("skdr.layout.reports")}
                </Link>
                <Link
                  href="/dashboard/ringkasan"
                  className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${onBrand ? "text-white/90 hover:bg-white/15 hover:text-white" : "text-slate-700 hover:bg-white hover:text-primary"
                    }`}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  {tr("skdr.layout.dashboardLink")}
                </Link>
              </div>
            ) : null}

            {/* PR 029: Dasbor ↔ Tata Kelola switch + user menu (or Masuk button) */}
            <AreaSwitch onBrand={onBrand} />
            <UserMenu onBrand={onBrand} />
          </div>
        </div>
      </div>
    </header>
  );
}
