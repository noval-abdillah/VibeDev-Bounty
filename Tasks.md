# ✅ Task Board

> **Proyek:** StokLedger — Sistem Rekonsiliasi Stok
> **Sprint/Fase:** Sprint 1 — Struktur & Style Frontend

---

## 📊 Ringkasan Sprint

| Total Task | 🔴 Belum Mulai | 🟡 Sedang Dikerjakan | 🟢 Selesai | 🚫 Diblokir |
|-----------|----------------|----------------------|-----------|-------------|
| 9         | 0              | 0                    | 9         | 0           |

---

## 🔴 Belum Mulai (To Do)

*Semua task untuk sprint ini telah diselesaikan.*

---

## 🟡 Sedang Dikerjakan (In Progress)

*Semua task aktif telah diselesaikan.*

---

## 🟢 Selesai (Done)

### [TASK-001] Preview struktur frontend (shell 8 halaman)
- **Selesai:** Sprint 1
- **Catatan:** Kerangka UI interaktif selesai.

### [TASK-002] Finalisasi struktur & style frontend
- **Selesai:** Sprint 1
- **Catatan:** Selesai menyusun navigasi, palet warna, tipografi, dan custom SVG icons.

### [TASK-003] Bangun set ikon SVG custom
- **Selesai:** Sprint 1
- **Catatan:** Dibuat 11 ikon custom outline di `src/components/icons/` menggantikan Lucide.

### [TASK-004] Skema database Supabase
- **Selesai:** Sprint 1
- **Catatan:** Skema database PostgreSQL di-deploy di `supabase/migrations/` lengkap dengan trigger append-only pada `stock_ledger` untuk mencegah `UPDATE` atau `DELETE`.

### [TASK-005] Logika alokasi batch FEFO
- **Selesai:** Sprint 1
- **Catatan:** Logika `allocateBatchFefo` berhasil diimplementasikan di `src/lib/fefo.ts` lengkap dengan pembagian batch otomatis.

### [TASK-006] Simulasi kejadian marketplace + jalur impor file
- **Selesai:** Sprint 1
- **Catatan:** Halaman simulasi lengkap dengan siklus hidup pesanan, retur manual dengan 3 pilihan kondisi barang, dan parser impor data format CSV.

### [TASK-007] Rekonsiliasi & drill-down
- **Selesai:** Sprint 1
- **Catatan:** Halaman rekonsiliasi yang memisahkan selisih opname dan cek harian, lengkap dengan audit trail drill-down langsung ke Buku Besar pergerakan stok.

### [TASK-008] Notifikasi kedaluwarsa & klaim retur
- **Selesai:** Sprint 1
- **Catatan:** Notifikasi batch near-expiry sesuai ambang batas dinamis dan pengingat batas waktu klaim retur TikTok 40 hari.

### [TASK-009] Panel Login & 3 Akun Tester Role-Based
- **Selesai:** Sprint 1
- **Catatan:** Login panel untuk 3 tester (Gudang, Owner, Admin) berhasil diimplementasikan dengan batasan akses read-only/write sesuai peran masing-masing.

---

## 🗑️ Backlog (Antrian Berikutnya)

| ID | Judul Task | Prioritas | Catatan |
|----|------------|-----------|---------|
| TASK-010 | Deploy ke Vercel untuk submission | 🔴 High | Wajib live, bukan mockup/video |
| TASK-011 | Uji skenario kebocoran stok end-to-end | 🔴 High | Pesanan batal, retur hilang, bonus/sampel |

---

## 🏷️ Label / Tag Reference

| Label | Deskripsi |
|-------|-----------|
| `frontend` | UI, komponen, ikon, style |
| `backend` | Skema data, logika ledger/FEFO, API |
| `design` | Keputusan visual, style guide |
| `testing` | Uji skenario stok |
