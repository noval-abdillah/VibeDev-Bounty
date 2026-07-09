# 🧠 Project Context

> File ini adalah **briefing singkat** untuk AI sebelum membaca dokumen lainnya.

---

## Apa Proyek Ini?

**Nama:** StokLedger
**Tagline:** Setiap pergerakan stok tercatat dan bisa ditelusuri — bukan sekadar angka selisih tanpa cerita.

---

## Masalah yang Diselesaikan

Brand skincare Indonesia (±70 produk, maklon, jual di Shopee & TikTok Shop) mencatat stok secara manual di spreadsheet. Angka di catatan hampir tidak pernah cocok dengan barang fisik di gudang, dan tidak ada yang bisa menjawab selisihnya bocor di mana — dari pesanan batal yang tidak dikembalikan, retur dengan nasib berbeda-beda, bonus/promo/sampel yang keluar tanpa tercatat, sampai stok awal yang cuma perkiraan.

---

## Solusi yang Dibangun

Sistem pencatatan & rekonsiliasi stok yang berdiri sendiri, dengan satu buku besar (Stock Ledger) append-only sebagai sumber kebenaran tunggal. Semua fitur lain — barang masuk, keluar manual, pesanan & retur marketplace, opname, rekonsiliasi — membaca dan menulis dari buku besar ini, sehingga setiap selisih bisa di-drill-down sampai ketemu penyebabnya. Tanpa integrasi API marketplace sungguhan di fase ini — digantikan tombol simulasi (plus jalur impor file), dirancang agar tinggal diganti API asli tanpa mengubah logika inti.

---

## Target Pengguna

- **Siapa:** Operator/admin gudang brand skincare, bukan developer
- **Keahlian teknis:** Pemula–menengah dalam hal software, tapi paham operasional gudang sehari-hari
- **Platform utama:** Web (desktop di gudang, tablet sebagai kemungkinan sekunder)
- **Konteks penggunaan:** Dipakai tiap hari untuk mencatat pergerakan barang; dipakai lebih intensif saat stok opname (1–3 bulan sekali)

---

## Tech Stack Singkat

```
Frontend  : Next.js 14 (App Router) + TypeScript
Styling   : Tailwind CSS + custom SVG icon set (lihat StyleGuide.md)
Backend   : Next.js API Routes / Supabase Edge Functions
Database  : Supabase (Postgres)
Auth      : Supabase Auth
Deploy    : Vercel
```

> Detail lengkap ada di `RULES.md`

---

## Status Proyek Saat Ini

- **Fase:** Development — struktur & desain frontend
- **Sprint aktif:** Sprint 1 — Struktur Frontend & Style Guide
- **Yang sudah ada:** Preview struktur frontend (navigasi, shell 8 halaman) sebagai artifact React; belum ada backend/Supabase
- **Target launch:** Belum ditentukan (submission bounty — harus live/ter-deploy)

---

## Hal Penting yang Harus AI Ketahui

- Bahasa antarmuka Indonesia, bukan Inggris.
- **Tidak boleh** ada pencatatan harga/nilai uang — sistem murni menghitung jumlah barang.
- Prinsip inti: tidak ada angka stok yang berubah tanpa jejak — Stock Ledger append-only, koreksi selalu berupa entri baru, bukan edit.
- Belum ada integrasi API marketplace sungguhan — semua kejadian Shopee/TikTok disimulasikan lewat tombol dummy dan/atau impor file, dirancang supaya kelak tinggal diganti webhook/API asli.
- Alokasi batch **selalu** FEFO (First Expired, First Out) — operator tidak pernah memilih batch secara manual.
- Bundle tidak punya stok sendiri — dipecah ke produk satuan lewat resep yang didefinisikan admin.
- Kondisi retur (layak jual / rusak / hilang) diputuskan manual oleh gudang setelah inspeksi, tidak otomatis dari data marketplace.
- Ikon UI memakai SVG custom buatan sendiri (bukan library ikon pihak ketiga), dengan referensi visual dari website-website skincare — lihat `StyleGuide.md` bagian Ikonografi.
- Prioritas kualitas #1 di bounty: logika stok benar & selisih bisa ditelusuri. Ini lebih penting daripada kelengkapan fitur atau polish visual.

---

## Dokumen Referensi

| Dokumen | Isi |
|---------|-----|
| `PRD.md` | Goals, fitur, user stories, timeline |
| `StyleGuide.md` | Warna, tipografi, ikon, komponen UI |
| `Tasks.md` | Task board, sprint aktif, backlog |
| `RULES.md` | Konvensi koding, struktur folder, aturan AI |

---

*Baca file ini dulu sebelum file lainnya. Update setiap kali ada perubahan besar pada arah proyek.*
