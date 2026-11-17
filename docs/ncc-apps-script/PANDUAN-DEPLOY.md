# Panduan deploy API NCC 119 (Google Apps Script)

Spreadsheet: **Puskris – Data NCC 119 (API)**
https://docs.google.com/spreadsheets/d/1j6f0e9cyLPHlH2R4Me1vzGCz_OKfx9ipq4y4M3sr8eQ/edit

1. Buka spreadsheet di atas, lalu menu **Ekstensi > Apps Script**.
2. Hapus isi `Code.gs` bawaan, tempel seluruh isi file `Code.gs` ini, lalu **Simpan** (Ctrl+S). Beri nama proyek, misalnya "Puskris NCC API".
3. **Setelan proyek** (ikon roda gigi):
   - Zona waktu: **(GMT+07:00) Jakarta**.
   - **Properti skrip > Tambahkan properti**: `API_KEY` = kata sandi acak panjang (misalnya 32 karakter). Simpan.
   - (Opsional) `SUMBER_ID` dan `SUMBER_TAB` bila sumber laporan pindah. Bawaannya spreadsheet "Data Pendukung SIAP PSC", tab "Master Data Interval".
4. Kembali ke editor, pilih fungsi **sinkronkan** di bilah atas, klik **Jalankan**. Setujui izin (Google akan menanyakan akses Spreadsheet dan "terhubung ke layanan eksternal" karena sinkron memakai Sheets API untuk membaca sumber). Setelah selesai, tab **Interval** terisi (±2.000 baris) dan **Harian** diperbarui.
5. Pilih fungsi **pasangPemicuPerJam**, klik **Jalankan** sekali. Sejak itu data disalin otomatis dari sumber setiap jam.
6. **Terapkan > Deployment baru** > ikon roda gigi > **Aplikasi web**:
   - Deskripsi: `API NCC v1`
   - Jalankan sebagai: **Saya**
   - Yang memiliki akses: **Siapa saja**
   - Klik **Terapkan**, lalu salin **URL aplikasi web** (berakhiran `/exec`).
7. Uji di browser: `<URL>/exec?action=meta&key=<API_KEY>` harus mengembalikan JSON `"ok": true`. Tanpa `key` hasilnya `unauthorized`.
8. Isi di `.env.local` dasbor (dan di Vercel bila dipakai), lalu restart dev server:
   ```
   PUSKRIS_NCC_URL=https://script.google.com/macros/s/XXXX/exec
   PUSKRIS_NCC_KEY=<API_KEY yang sama>
   ```
   Bila kunci mengandung `$`, tulis sebagai `\$`.

## Endpoint
| action | Isi | Filter |
|---|---|---|
| `ringkasan` (bawaan) | total, harian, pola per 30 menit, interval tersibuk | `tanggal1`, `tanggal2` |
| `meta` | sumber, rentang tanggal, kamus kolom | – |
| `harian` | semua kolom per tanggal | `tanggal1`, `tanggal2` |
| `interval` | semua kolom per 30 menit (maks. 31 hari) | `tanggal1`, `tanggal2` |
| `per_jam` | agregat per slot 30 menit | `tanggal1`, `tanggal2` |

Data NCC 119 hanya tingkat nasional; parameter `prov` diabaikan. Respons disimpan di cache 10 menit. Tidak ada endpoint tulis.

## Bila mengubah kode
Setelah mengedit `Code.gs`: **Terapkan > Kelola deployment > edit (pensil) > Versi: Versi baru > Terapkan**. URL `/exec` tetap sama.
