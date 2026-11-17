/**
 * Konfigurasi Token dan Autentikasi API Resmi Pusat Krisis Kesehatan.
 * Membaca variabel environment (.env) sebagai prioritas utama,
 * dan secara otomatis menggunakan nilai fallback di bawah ini jika environment kosong/tidak diatur.
 */

export const PUSKRIS_FALLBACK = {
  // Token API PSC 119, Asistensi, Logistik, dan Tenaga Cadangan Kesehatan (TCK)
  TTOKEN:
    'eyJpdiI6InhVTFwvTEsyXC9vZStSYXhzR2lKRmppZz09IiwidmFsdWUiOiJiN3ZlXC9VR2dsZDhWNGJWY0pnRXZ6TVFxQWRweFZMRVdGa1YrZTY5RW9ZY0dmOXBLUFFGbFNIdU5Hck51aWJ6ZW9Tb05ad3BHaFYzQ3pWY3pPYTFxOHArd1pHNWN5SHkxRHl6VEZEemRJMDZ4RFM5bDZYQ05VcGY5aW5qNmdyY0pqZGQ1OGRYajhGTlwveGZUbU5ZcVNqbkxcL05US29XOE40Z3lDOUNmOGJPRGZSSllYeUw5MHRQSTBuQnIwUjF0SzQiLCJtYWMiOiJlNjk5ZTYzOGMxM2EzZjVmYWQyNjE4Nzg3NWM2NTdlOTNiZGVkNTQwNjY2YjhlMDVhNzFmODQ3MTc0MGM2MGM1In0',

  // Autentikasi Basic API EOC (Bencana & Kejadian Krisis)
  EOC_AUTH: 'puskris:t3n4g4Cadangan624:$',

  // Endpoint Web App Google Apps Script untuk data NCC 119
  NCC_URL:
    'https://script.google.com/macros/s/AKfycbzyVdRRu9FwYAr1wbqCrrhOfTuOYzh1WuA1gPdc7PJFKJuyV_yCinaMLhB14jCxzJJ-aw/exec',

  NCC_KEY: '',

  // Spreadsheet rujukan NCC 119
  NCC_SHEET_URL:
    'https://docs.google.com/spreadsheets/d/1j6f0e9cyLPHlH2R4Me1vzGCz_OKfx9ipq4y4M3sr8eQ/edit',
}

/** Mengambil Token Puskris (TTOKEN): Membaca process.env dahulu, fallback ke konstanta kode */
export function getPuskrisToken(): string {
  return process.env.PUSKRIS_TTOKEN || PUSKRIS_FALLBACK.TTOKEN
}

/** Mengambil Basic Auth EOC: Membaca process.env dahulu, fallback ke konstanta kode */
export function getEocAuth(): string {
  return process.env.PUSKRIS_EOC_AUTH || PUSKRIS_FALLBACK.EOC_AUTH
}

/** Mengambil URL Web App NCC: Membaca process.env dahulu, fallback ke konstanta kode */
export function getNccUrl(): string {
  return process.env.PUSKRIS_NCC_URL || PUSKRIS_FALLBACK.NCC_URL
}

/** Mengambil Kunci NCC: Membaca process.env dahulu, fallback ke konstanta kode */
export function getNccKey(): string {
  return process.env.PUSKRIS_NCC_KEY || PUSKRIS_FALLBACK.NCC_KEY
}

/** Mengambil URL Spreadsheet NCC: Membaca process.env dahulu, fallback ke konstanta kode */
export function getNccSheetUrl(): string {
  return process.env.PUSKRIS_NCC_SHEET_URL || PUSKRIS_FALLBACK.NCC_SHEET_URL
}
