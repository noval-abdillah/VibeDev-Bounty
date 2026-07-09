# 📋 Product Requirements Document (PRD)

> **Proyek:** StokLedger — Sistem Rekonsiliasi Stok
> **Versi:** v1.0
> **Status:** 🟡 Draft

---

## 1. Ringkasan Eksekutif

StokLedger membantu operator gudang brand skincare Indonesia mencatat setiap pergerakan barang dalam satu buku besar tunggal, sehingga selisih antara catatan dan barang fisik selalu bisa ditelusuri sampai ke penyebabnya — bukan cuma diketahui angkanya. Ditujukan untuk brand dengan ±70 produk yang berjualan di Shopee dan TikTok Shop dengan ratusan paket keluar per hari.

---

## 2. Latar Belakang & Masalah

### 2.1 Konteks
Pencatatan stok klien saat ini manual berbasis spreadsheet (lihat sample stok di lampiran foto). Setiap opname (1–3 bulan sekali) selalu menghasilkan selisih tanpa cerita di baliknya.

### 2.2 Pernyataan Masalah
Barang keluar/masuk gudang dari banyak jalur (penjualan marketplace, pembatalan, retur, bonus/promo/sampel, barang rusak/kedaluwarsa) tapi hanya sebagian yang tercatat dengan jelas. Titik-titik kebocoran yang teridentifikasi:
- Pesanan batal — stok tidak pernah dikembalikan di catatan.
- Retur dengan nasib berbeda — layak jual, rusak, atau hilang di ekspedisi.
- Bonus/promo/sampel — keluar gudang tanpa terhubung ke pesanan mana pun (sumber selisih terbesar).
- Stok awal yang masih perkiraan.

### 2.3 Peluang
Kalau setiap pergerakan tercatat dengan alasan & channel yang jelas, tim bisa drill-down selisih ke sumbernya — mengubah stok opname dari "ritual mencari angka" menjadi alat kontrol yang bisa ditindaklanjuti.

---

## 3. Tujuan & Sasaran

| Tujuan | Metrik Keberhasilan | Target |
|--------|---------------------|--------|
| Angka stok akurat & bisa ditelusuri | % selisih yang bisa dijelaskan sumbernya | 100% dari selisih yang muncul |
| Operator gudang bisa pakai tanpa training panjang | Waktu training operator baru | < 30 menit |
| Tidak ada kebocoran bonus/promo/sampel | Semua keluar manual tercatat dengan alasan | 100% tercatat |
| Klaim retur TikTok tidak lewat batas waktu | Jumlah klaim yang lewat 40 hari | 0 |

---

## 4. Target Pengguna

### 4.1 Persona Utama
- **Nama Persona:** Admin Gudang
- **Keahlian teknis:** Pemula–menengah, terbiasa Excel/Google Sheets, bukan developer
- **Pain Point:** Input manual berulang, tidak tahu kenapa stok sistem beda dengan fisik
- **Goal:** Mencatat pergerakan barang secepat mungkin, tanpa harus memilih batch sendiri

### 4.2 Persona Sekunder
- **Nama Persona:** Owner / Manajer Operasional
- **Deskripsi:** Perlu melihat ringkasan kesehatan stok dan selisih terbuka tanpa masuk ke detail input harian

---

## 5. Ruang Lingkup

### ✅ In Scope (Fase 1)
- [ ] Data produk & batch (termasuk tanggal kedaluwarsa per batch)
- [ ] Buku besar pergerakan stok (Stock Ledger) — append-only, pusat semua fitur
- [ ] Pencatatan barang masuk dari maklon
- [ ] Pencatatan keluar manual: penjualan offline, bonus, promo, sampel, barang rusak, kedaluwarsa
- [ ] Simulasi data pesanan, pembatalan, retur dari Shopee & TikTok (tombol dummy + impor file)
- [ ] Penanganan retur beserta kondisinya + reminder klaim TikTok sebelum batas 40 hari
- [ ] Notifikasi barang mendekati kedaluwarsa per batch
- [ ] Resep bundle — listing bundle dipecah ke produk satuan
- [ ] Alokasi batch otomatis FEFO
- [ ] Stok opname — input hitung fisik, banding dengan catatan, koreksi
- [ ] Rekonsiliasi — selisih harian dan selisih dari opname, bisa di-drill-down

### ❌ Out of Scope (Fase 1)
- Integrasi API sungguhan ke Shopee/TikTok Shop (digantikan simulasi + impor file)
- Pencatatan harga / nilai uang barang
- Multi-gudang / multi-lokasi
- Role & permission granular (fase 1 asumsi satu jenis pengguna: admin gudang)

---

## 6. Fitur & Persyaratan Fungsional

### 6.1 Fitur: Buku Besar (Stock Ledger)
- **Prioritas:** 🔴 Must Have
- **Deskripsi:** Log append-only dari semua pergerakan stok. Semua fitur lain menulis ke sini, tidak pernah mengedit langsung.
- **User Story:** Sebagai admin gudang, saya ingin melihat riwayat lengkap pergerakan tiap produk agar saya bisa menelusuri kenapa stok berkurang/bertambah.
- **Kriteria Penerimaan:**
  - [ ] Setiap baris ledger punya: timestamp, produk, batch, qty (+/-), alasan, channel, referensi
  - [ ] Tidak ada operasi update/delete pada baris yang sudah ada — koreksi = baris baru
  - [ ] Bisa difilter per tanggal, produk, jenis pergerakan, channel, alasan

### 6.2 Fitur: Alokasi Batch FEFO
- **Prioritas:** 🔴 Must Have
- **Deskripsi:** Setiap pergerakan keluar otomatis dialokasikan ke batch dengan tanggal kedaluwarsa terdekat.
- **User Story:** Sebagai admin gudang, saya tidak ingin memilih batch manual agar tidak salah kirim barang yang harusnya keluar duluan.
- **Kriteria Penerimaan:**
  - [ ] Sistem memilih batch otomatis berdasar expiry terdekat yang stoknya masih cukup
  - [ ] Jika satu batch tidak cukup, split ke batch berikutnya secara otomatis

### 6.3 Fitur: Pesanan & Retur Marketplace (Simulasi)
- **Prioritas:** 🔴 Must Have
- **Deskripsi:** Barang dihitung keluar saat fisik meninggalkan gudang — Shopee saat SHIPPED, TikTok saat IN_TRANSIT. Disimulasikan lewat tombol dummy dan/atau impor file, siap diganti API asli.
- **User Story:** Sebagai admin gudang, saya ingin mendemokan seluruh alur pesanan-ke-ledger tanpa API asli, agar sistem bisa diuji sebelum integrasi nyata tersedia.
- **Kriteria Penerimaan:**
  - [ ] Tombol simulasi tersedia untuk: pesanan baru, SHIPPED/IN_TRANSIT, pembatalan, retur
  - [ ] Jalur impor file tersedia sebagai alternatif tombol simulasi
  - [ ] Kondisi retur (layak jual/rusak/hilang) diinput manual oleh gudang, bukan otomatis

### 6.4 Fitur: Resep Bundle
- **Prioritas:** 🟡 Should Have
- **Deskripsi:** Admin mendefinisikan resep: 1 bundle = kombinasi produk satuan + qty. Saat listing bundle terjual, sistem memecah otomatis ke pergerakan per produk satuan.
- **Kriteria Penerimaan:**
  - [ ] Admin bisa membuat/mengedit resep bundle
  - [ ] Penjualan bundle menghasilkan entri ledger per komponen, bukan entri bundle

### 6.5 Fitur: Notifikasi Kedaluwarsa & Klaim Retur
- **Prioritas:** 🟡 Should Have
- **Deskripsi:** Peringatan per batch yang mendekati kedaluwarsa, dan reminder klaim TikTok sebelum batas 40 hari.
- **Kriteria Penerimaan:**
  - [ ] Ambang notifikasi kedaluwarsa bisa dikonfigurasi
  - [ ] Reminder klaim tampil sejak retur diterima, makin mendesak mendekati hari ke-40

### 6.6 Fitur: Stok Opname & Rekonsiliasi
- **Prioritas:** 🔴 Must Have
- **Deskripsi:** Dua ritme: harian (sistem cek konsistensi catatannya sendiri) dan saat opname (catatan vs hitung fisik). Selisih bisa di-drill-down ke pergerakan ledger pembentuknya.
- **Kriteria Penerimaan:**
  - [ ] Input hitung fisik per produk/batch
  - [ ] Selisih otomatis dikategorikan: dari cek harian atau dari opname
  - [ ] Klik selisih menampilkan seluruh entri ledger yang membentuk saldo tersebut
  - [ ] Koreksi dari opname menghasilkan entri ledger baru, bukan overwrite

---

## 7. Persyaratan Non-Fungsional

| Kategori | Persyaratan |
|----------|-------------|
| **Performa** | Halaman utama (dashboard, ledger dengan filter) load < 3 detik untuk ~70 produk & histori beberapa bulan |
| **Keamanan** | Auth wajib untuk akses sistem; environment variable untuk semua secrets Supabase |
| **Skalabilitas** | Mampu menangani ratusan pergerakan ledger per hari tanpa degradasi UI |
| **Kompatibilitas** | Chrome & Safari versi terbaru (desktop), fungsional di layar tablet |
| **Aksesibilitas** | Kontras warna memenuhi WCAG AA, semua elemen interaktif punya focus state |

---

## 8. Desain & UX

- **Referensi Desain:** Tidak ada Figma — desain dikembangkan langsung sebagai kode (lihat `StyleGuide.md`)
- **Prinsip UX:** Operator gudang > developer sebagai pengguna utama — hindari jargon teknis, tombol besar, alur linear, feedback jelas setiap aksi tercatat

---

## 9. Dependensi & Integrasi

| Sistem/Layanan | Tujuan | Status |
|----------------|--------|--------|
| Shopee Open API | Data pesanan/retur real | Belum — digantikan simulasi fase 1 |
| TikTok Shop API | Data pesanan/retur real | Belum — digantikan simulasi fase 1 |
| Supabase (Postgres + Auth) | Database & autentikasi | Aktif dipakai |

---

## 10. Timeline & Milestone

| Milestone | Status |
|-----------|--------|
| Struktur & style frontend | 🟡 Sedang berjalan |
| Skema database Supabase | ⬜ Belum mulai |
| Logika ledger + FEFO | ⬜ Belum mulai |
| Simulasi marketplace + impor file | ⬜ Belum mulai |
| Stok opname & rekonsiliasi | ⬜ Belum mulai |
| Deploy live untuk submission | ⬜ Belum mulai |

---

## 11. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|--------|--------|----------|
| Logika FEFO/ledger salah | Tinggi — membatalkan seluruh submission | Uji dengan skenario nyata dari brief (batal, retur, bonus) sebelum lanjut ke UI polish |
| Simulasi tombol dummy dianggap "kurang nyata" | Sedang | Rancang jelas agar tinggal diganti API asli tanpa ubah logika inti, dan jelaskan alasannya |
| Terlalu fokus ke visual, kurang ke logika | Tinggi | Prioritaskan urutan penilaian: logika benar > kelengkapan fitur > kemudahan pakai > kualitas teknis |

---

## 12. Pertanyaan Terbuka

- [ ] Apakah butuh role selain admin gudang di fase 1 (mis. read-only untuk owner)?
- [ ] Ambang default notifikasi kedaluwarsa — berapa hari sebelum expiry?

---

## 13. Riwayat Perubahan

| Versi | Perubahan | Author |
|-------|-----------|--------|
| v1.0 | Dokumen awal disusun dari brief bounty VibeDev + sample stok | Tim |
