# 🎨 Style Guide

> **Proyek:** StokLedger — Sistem Rekonsiliasi Stok
> **Versi:** v1.0

---

## 1. Brand Identity

### 1.1 Misi & Nilai
- **Misi:** Membuat setiap pergerakan stok terlihat dan bisa ditelusuri, tanpa membuat operator gudang berpikir seperti akuntan.
- **Nilai-nilai:** Jujur (angka apa adanya, tidak dipoles), tenang (bukan dashboard yang berisik), jelas (bahasa operasional, bukan jargon software)

### 1.2 Tone of Voice
| Kami adalah... | Kami BUKAN... |
|----------------|---------------|
| Jelas & operasional | Teknis/berjargon |
| Tenang, seperti ruang kerja klinik | Ramai, penuh warna mencolok |
| Presisi | Sok formal |

---

## 2. Palet Warna

Palet ini diambil dari referensi visual "ruang kerja gudang/lab skincare" — hijau teal klinis sebagai warna kerja utama, netral hangat sebagai latar, dan warna semantik yang tenang (tidak neon) untuk status.

### 2.1 Warna Utama (Primary — Teal Klinis)

| Nama | HEX | Penggunaan |
|------|-----|------------|
| Primary (Accent) | `#2F6F5E` | Tombol utama, ikon aktif, aksen |
| Primary Dark | `#1D3A2E` | Sidebar item aktif, hover |
| Primary Light | `#E4EEE9` | Background badge/tag netral |

### 2.2 Warna Sidebar (Ink Gelap)

| Nama | HEX | Penggunaan |
|------|-----|------------|
| Sidebar | `#11201A` | Background sidebar |
| Sidebar Soft | `#7FA997` | Label grup menu, teks non-aktif |

### 2.3 Warna Netral

| Nama | HEX | Penggunaan |
|------|-----|------------|
| Ink (teks utama) | `#16211C` | Judul, teks utama |
| Ink Soft | `#5C665F` | Teks sekunder, deskripsi |
| Ink Faint | `#8B948D` | Placeholder, metadata, timestamp |
| Border | `#E3E5E0` | Divider, garis tabel |
| Border Strong | `#CBCFC7` | Placeholder dashed box, divider tegas |
| Background | `#F6F7F4` | Background halaman |
| Surface | `#FFFFFF` | Background card |

### 2.4 Warna Status / Semantik

| Status | HEX (teks/ikon) | HEX (background lembut) | Penggunaan |
|--------|------|------|------------|
| ✅ Success | `#3C7A50` | `#E6F0E9` | Retur layak jual, stok normal |
| ⚠️ Warning | `#B9781F` | `#FBF0DC` | Mendekati kedaluwarsa, klaim mendekati batas |
| ❌ Danger | `#B5423A` | `#F7E6E4` | Selisih terbuka, barang rusak, batas klaim < 7 hari |

> Sengaja dibuat lebih muted/earthy dibanding warna semantik neon standar (`#22C55E`/`#EF4444`) — biar konsisten dengan nuansa klinis-teal, bukan dashboard SaaS generik.

---

## 3. Tipografi

### 3.1 Font Family

| Peran | Font | Alternatif |
|-------|------|------------|
| **Heading** | Space Grotesk (500/600/700) | system-ui, sans-serif |
| **Body / UI** | Inter (400/500/600) | system-ui, sans-serif |
| **Data / Kode** | IBM Plex Mono (400/500/600) | ui-monospace, monospace |

> Import: `https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap`

Alasan pemilihan: Space Grotesk untuk judul memberi karakter teknis-modern tanpa terasi generik; IBM Plex Mono khusus dipakai untuk **semua angka & kode** (SKU, batch, qty, referensi) di Buku Besar — supaya angka terasa presisi seperti keluaran alat lab/scanner gudang, bukan teks biasa.

### 3.2 Skala Tipografi

| Nama | Size | Weight | Penggunaan |
|------|------|--------|------------|
| H1 (judul halaman) | 20px | 600 | Judul di Topbar |
| H2 (judul section) | 14.5px | 600 | Judul `SectionCard` |
| Body | 13–13.5px | 400 | Teks tabel, label |
| Body Small | 12–12.5px | 400 | Deskripsi, sub-label |
| Caption / Mono | 11–11.5px | 400–600 | Timestamp, kode batch, referensi |

---

## 4. Spacing & Layout

### 4.1 Sistem Spacing
Skala 4px dipakai konsisten: 4 / 8 / 10 / 12 / 14 / 16 / 18 / 24px. Card padding standar `16px 18px`.

### 4.2 Layout
- Sidebar tetap 248px, tidak collapsible di fase 1 (jumlah menu masih ringkas)
- Konten utama padding 24px
- Max content mengikuti lebar viewport gudang (desktop/tablet), belum dioptimasi untuk mobile sempit

### 4.3 Border Radius

| Token | Nilai | Penggunaan |
|-------|-------|------------|
| `radius-sm` | 8px | Tombol, input, filter chip |
| `radius-md` | 12px | Card (`SectionCard`), stat card |
| `radius-full` | 20px | Tag/badge, pill status |

---

## 5. Komponen UI

### 5.1 Button
| Varian | Style |
|--------|-------|
| **Primary** | Background `#2F6F5E`, teks putih — dipakai untuk 1 aksi utama per form (mis. "Catat barang masuk") |
| **Ghost** | Border `#E3E5E0`, background putih, teks `Ink Soft` — dipakai untuk aksi sekunder (filter, telusuri, impor) |

### 5.2 Tag / Badge
Background warna semantik lembut (mis. `#FBF0DC`) + teks warna semantik pekat (mis. `#B9781F`), radius pill 20px. Dipakai untuk alasan pergerakan, channel, dan status produk.

### 5.3 Card (`SectionCard`)
```
padding: 16px 18px
border-radius: 12px
border: 1px solid #E3E5E0
background: #FFFFFF
```
Tanpa box-shadow — flat, sesuai nuansa klinis (bukan dashboard SaaS bergaya card melayang).

### 5.4 Buku Besar (komponen signature)
Ditampilkan seperti **kertas struk/scanner** — pembatas antar baris pakai dashed border (bukan solid), font angka pakai IBM Plex Mono, ikon panah naik/turun di kiri tiap baris. Elemen ini yang harus paling diingat dari seluruh UI — elemen lain di sekitarnya dibuat sengaja tenang/tidak ramai.

---

## 6. Ikonografi — SVG Custom (bukan library pihak ketiga)

**Keputusan:** Ikon di fase build final **tidak** memakai library seperti Lucide/Heroicons. Semua ikon dibuat sebagai SVG custom sendiri, disimpan sebagai komponen React di `src/components/icons/`. (Lucide masih boleh dipakai sementara di artifact preview untuk kecepatan iterasi, tapi build produksi wajib pakai set custom ini.)

### 6.1 Referensi visual
Bahasa visual ikon mengambil referensi dari website skincare klinis — bukan e-commerce yang ramai, tapi yang minimal dan presisi:
- **Somethinc / Avoskin / Skintific** (skincare Indonesia): garis tipis, sudut membulat lembut, terasa "bersih" bukan dekoratif
- **The Ordinary / Then I Met You**: linework sangat minim, hampir tanpa ornamen, fokus ke kejelasan bentuk
- **Glossier**: proporsi ikon konsisten dalam grid, tidak ada gradasi atau bayangan

Nuansa yang diambil: **klinis, tenang, presisi** — bukan botanical/organik yang biasanya identik dengan skincare marketing. Karena ini alat kerja gudang, bukan halaman produk, jadi ikonnya dipinjam gaya-nya saja (garis tipis, sudut lembut, tanpa dekorasi) bukan motifnya (bukan daun/droplet/bunga).

### 6.2 Aturan teknis
- Grid dasar: 20×20px (16px untuk versi kecil, 24px maksimum dekoratif)
- Stroke width: 1.5px, `stroke-linecap: round`, `stroke-linejoin: round`
- Gaya: **outline only** — tidak ada versi filled, konsisten dengan seluruh set
- Warna: `currentColor` — ikon mewarisi warna teks/ikon di sekitarnya (aktif = `Primary`, non-aktif = `Ink Faint`)
- Tanpa efek gradasi, bayangan, atau garis ganda

### 6.3 Daftar ikon yang dibutuhkan (dipetakan ke modul)
| Ikon | Dipakai di | Bentuk dasar |
|------|-----------|--------------|
| `IconDashboard` | Dashboard | Grid 4 kotak lembut |
| `IconBell` | Notifikasi | Lonceng garis tipis, tanpa lonjong berlebihan |
| `IconVial` | Produk & Batch | Botol/vial lab sederhana — satu-satunya ikon yang boleh sedikit "mengarah" ke skincare, karena representasi produk itu sendiri |
| `IconLedger` | Buku Besar | Buku/kertas dengan garis horizontal (kesan struk) |
| `IconTruck` | Barang Masuk | Truk garis simpel |
| `IconEdit` | Pencatatan Manual | Pensil/garis edit |
| `IconBag` | Pesanan & Retur | Tas belanja garis simpel |
| `IconCheckClipboard` | Stok Opname | Papan klip + centang |
| `IconScale` | Rekonsiliasi | Timbangan dua sisi — merepresentasikan "membandingkan" |
| `IconBoxes` | Resep Bundle | Dua kotak bertumpuk |
| `IconUpload` | Impor file | Panah ke atas + garis dasar |

### 6.4 Ukuran & warna pemakaian
- 16px, warna `Ink Faint` — ikon di dalam tabel/baris
- 20px, warna sesuai state — ikon navigasi sidebar
- Ikon aktif di sidebar selalu `currentColor` mengikuti teks aktif (putih pudar `#F2F5F1`), bukan warna aksen terpisah, supaya tidak ramai

---

## 7. Animasi & Transisi

| Jenis | Durasi | Easing | Penggunaan |
|-------|--------|--------|------------|
| Micro-interaction | 120ms | ease-out | Hover tombol, toggle tab |
| Transition | 200ms | ease-in-out | Expand drill-down di Rekonsiliasi |
| Loading | Loop | linear | Skeleton saat fetch ledger |

> Animasi dijaga minim — ini alat kerja harian, bukan halaman showcase. Tidak ada page-load animation berlebihan.

---

## 8. Aksesibilitas

- Kontras warna minimum 4.5:1 untuk teks normal (semua kombinasi di Bagian 2 sudah dicek)
- Semua tombol & tab punya visible focus ring
- Ikon custom di Bagian 6 tidak boleh jadi satu-satunya penanda status — selalu didampingi teks/tag berwarna
- Ukuran tap target minimum 44×44px untuk tombol utama

---

## 9. ✅ Do's & ❌ Don'ts

### ✅ Lakukan
- Pakai IBM Plex Mono untuk semua angka & kode di Buku Besar
- Jaga Buku Besar sebagai satu-satunya elemen "berani" secara visual — sisanya tenang
- Pakai warna semantik yang muted (Bagian 2.4), bukan neon

### ❌ Jangan
- Jangan tambah gradient, shadow dekoratif, atau efek glow di mana pun
- Jangan pakai ikon library pihak ketiga di kode final
- Jangan pakai motif botanical (daun, bunga, droplet berlebihan) — ini alat kerja gudang, bukan halaman marketing skincare
- Jangan gabungkan lebih dari 3 warna semantik dalam satu tampilan sekaligus

---

*Style Guide ini dokumen hidup — perbarui begitu ada keputusan visual baru yang disepakati.*
