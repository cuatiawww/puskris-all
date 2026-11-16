# Puskris All - Frontend Next.js

Proyek mandiri (*standalone*) frontend Next.js untuk Pusat Krisis Kesehatan (Puskris), disalin dan diselaraskan dari design system & struktur batang tubuh SKDR Indonesia (SATUSEHAT design tokens, Tailwind CSS, OpenLayers GIS map, Recharts, dll.).

## Prasyarat
- Node.js >= 18 (direkomendasikan Node.js 20+ atau 24)
- npm >= 9

## Cara Menjalankan

1. **Jalankan Development Server**:
   ```bash
   cd C:\laragon\www\puskris-all
   npm run dev
   ```
   Aplikasi akan berjalan di [http://localhost:3000](http://localhost:3000).

2. **Kompilasi / Build Produksi**:
   ```bash
   npm run build
   npm run start
   ```

## Konfigurasi Lingkungan (`.env.local`)

File konfigurasi `.env.local` sudah disediakan secara default:
```env
BACKEND_INTERNAL_URL=http://localhost:8091
NEXT_PUBLIC_BASE_PATH=
NEXT_PUBLIC_DEFAULT_LOCALE=id
NEXT_PUBLIC_BYPASS_AUTH=true
SESSION_COOKIE_NAME=puskris_session
```

- `NEXT_PUBLIC_BYPASS_AUTH=true`: Memungkinkan seluruh halaman dibuka secara langsung dalam mode statis/mock tanpa perlu koneksi ke backend database auth.
- `BACKEND_INTERNAL_URL`: Arahkan ke endpoint API backend (Rust, FastAPI, Express, Go, dll.) saat sudah siap diintegrasikan.
