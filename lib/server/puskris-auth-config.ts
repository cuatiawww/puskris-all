/**
 * Konfigurasi Token dan Autentikasi API Resmi Pusat Krisis Kesehatan.
 * Menyediakan fallback token & kredensial langsung di kode (konstanta variabel),
 * sehingga aplikasi dapat langsung terhubung ke API tanpa bergantung pada .env.
 */

export const PUSKRIS_DEFAULT_CONFIG = {
  // Token API PSC 119, Asistensi, Logistik, dan Tenaga Cadangan Kesehatan (TCK)
  TTOKEN:
    process.env.PUSKRIS_TTOKEN ||
    'eyJpdiI6InhVTFwvTEsyXC9vZStSYXhzR2lKRmppZz09IiwidmFsdWUiOiJiN3ZlXC9VR2dsZDhWNGJWY0pnRXZ6TVFxQWRweFZMRVdGa1YrZTY5RW9ZY0dmOXBLUFFGbFNIdU5Hck51aWJ6ZW9Tb05ad3BHaFYzQ3pWY3pPYTFxOHArd1pHNWN5SHkxRHl6VEZEemRJMDZ4RFM5bDZYQ05VcGY5aW5qNmdyY0pqZGQ1OGRYajhGTlwveGZUbU5ZcVNqbkxcL05US29XOE40Z3lDOUNmOGJPRGZSSllYeUw5MHRQSTBuQnIwUjF0SzQiLCJtYWMiOiJlNjk5ZTYzOGMxM2EzZjVmYWQyNjE4Nzg3NWM2NTdlOTNiZGVkNTQwNjY2YjhlMDVhNzFmODQ3MTc0MGM2MGM1In0',

  // Autentikasi Basic API EOC (Bencana & Kejadian Krisis)
  EOC_AUTH:
    process.env.PUSKRIS_EOC_AUTH || 'puskris:t3n4g4Cadangan624:$',

  // Endpoint Web App Google Apps Script untuk data NCC 119
  NCC_URL:
    process.env.PUSKRIS_NCC_URL ||
    'https://script.google.com/macros/s/AKfycbzyVdRRu9FwYAr1wbqCrrhOfTuOYzh1WuA1gPdc7PJFKJuyV_yCinaMLhB14jCxzJJ-aw/exec',

  NCC_KEY: process.env.PUSKRIS_NCC_KEY || '',

  // Spreadsheet rujukan NCC 119
  NCC_SHEET_URL:
    process.env.PUSKRIS_NCC_SHEET_URL ||
    'https://docs.google.com/spreadsheets/d/1j6f0e9cyLPHlH2R4Me1vzGCz_OKfx9ipq4y4M3sr8eQ/edit',
}

export function getPuskrisToken(): string {
  return PUSKRIS_DEFAULT_CONFIG.TTOKEN
}

export function getEocAuth(): string {
  return PUSKRIS_DEFAULT_CONFIG.EOC_AUTH
}

export function getNccUrl(): string {
  return PUSKRIS_DEFAULT_CONFIG.NCC_URL
}

export function getNccKey(): string {
  return PUSKRIS_DEFAULT_CONFIG.NCC_KEY
}

export function getNccSheetUrl(): string {
  return PUSKRIS_DEFAULT_CONFIG.NCC_SHEET_URL
}
