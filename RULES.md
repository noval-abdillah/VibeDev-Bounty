# 📐 Rules & Conventions

> **Proyek:** StokLedger — Sistem Rekonsiliasi Stok
> **Versi:** v1.0
> **Berlaku untuk:** Semua developer & AI yang bekerja di proyek ini

---

## 1. Tech Stack

| Layer | Teknologi | Versi |
|-------|-----------|-------|
| **Framework** | Next.js (App Router) | v14+ |
| **Language** | TypeScript | v5 |
| **Styling** | Tailwind CSS | v3 |
| **Ikon** | SVG custom sendiri (bukan library pihak ketiga) — lihat `StyleGuide.md` | — |
| **State Management** | React state / Context API (Zustand jika kompleksitas naik — diskusikan dulu) | — |
| **Database** | Supabase (Postgres) | — |
| **ORM/Client** | Supabase JS client (query builder bawaan) | — |
| **Auth** | Supabase Auth | — |
| **API** | Next.js Route Handlers (REST-style) | — |
| **Deployment** | Vercel | — |

---

## 2. Struktur Folder

```
project/
├── src/
│   ├── app/
│   │   ├── (dashboard)/
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── notifikasi/page.tsx
│   │   │   ├── produk/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── ledger/page.tsx
│   │   │   ├── masuk/page.tsx
│   │   │   ├── manual/page.tsx
│   │   │   ├── pesanan/page.tsx
│   │   │   ├── opname/page.tsx
│   │   │   └── rekonsiliasi/page.tsx
│   │   └── api/
│   │       ├── ledger/route.ts
│   │       ├── produk/route.ts
│   │       ├── pesanan/simulasi/route.ts
│   │       ├── opname/route.ts
│   │       └── rekonsiliasi/route.ts
│   ├── components/
│   │   ├── ui/            # Button, Tag, SectionCard, Tabs, dll — generik
│   │   ├── layout/         # Sidebar, Topbar
│   │   ├── icons/          # SVG custom icon components (lihat StyleGuide.md)
│   │   └── features/       # Komponen spesifik per modul (ledger/, produk/, opname/, dll)
│   ├── lib/
│   │   ├── supabase/       # client.ts, server.ts
│   │   ├── fefo.ts         # logika alokasi batch FEFO
│   │   └── ledger.ts       # helper tulis/baca Stock Ledger
│   ├── hooks/
│   ├── types/              # Product, Batch, LedgerEntry, Order, Retur, OpnameSession, Bundle
│   ├── styles/
│   └── constants/
├── public/
├── supabase/                # migrations SQL
├── PRD.md
├── StyleGuide.md
├── Tasks.md
├── RULES.md
└── CONTEXT.md
```

---

## 3. Naming Conventions

### File & Folder
| Jenis | Convention | Contoh |
|-------|------------|--------|
| Komponen React | PascalCase | `LedgerRow.tsx` |
| Halaman (page) | kebab-case, sesuai App Router | `rekonsiliasi/page.tsx` |
| Hooks | camelCase + "use" prefix | `useLedgerFilter.ts` |
| Utilities | camelCase | `allocateFefo.ts` |
| Tipe/Interface | PascalCase | `LedgerEntry.ts` |
| Konstanta | UPPER_SNAKE_CASE | `TIKTOK_CLAIM_DAYS` |

### Variabel & Fungsi
```typescript
// ✅ Benar
const sisaStok = 27792
const isKedaluwarsa = true
function allocateBatchFefo(productId: string, qty: number) {}

// ❌ Salah
const sisa_stok = 27792
function AllocateBatch(id, qty) {}
```

### Komponen React
```typescript
// ✅ Benar — named export, props interface jelas
interface LedgerRowProps {
  entry: LedgerEntry
}

export function LedgerRow({ entry }: LedgerRowProps) {
  return (...)
}
```

---

## 4. Aturan Coding

### TypeScript
- [ ] Selalu gunakan TypeScript, hindari `any` — pakai `unknown` untuk data belum diketahui
- [ ] Semua tipe domain (Product, Batch, LedgerEntry, Order, Retur, OpnameSession, Bundle) didefinisikan di `src/types/`
- [ ] `strict: true` di `tsconfig.json`

### React & Logika Domain
- [ ] Functional component saja
- [ ] Logika FEFO, ledger, dan rekonsiliasi **tidak boleh** ditulis langsung di komponen UI — taruh di `src/lib/`
- [ ] Komponen halaman (`page.tsx`) memanggil fungsi dari `lib/`, bukan menulis query Supabase langsung
- [ ] `key` list harus id stabil (SKU, ledger id) — bukan index array
- [ ] Satu komponen maksimal ~300 baris — pecah jika lebih

### Prinsip Ledger (wajib, ini inti sistem)
- [ ] **Tidak ada** operasi `UPDATE`/`DELETE` pada baris Stock Ledger yang sudah tersimpan
- [ ] Setiap koreksi (dari opname, retur, dll) ditulis sebagai baris ledger **baru**, dengan referensi ke sumbernya
- [ ] Setiap baris ledger wajib punya: alasan **dan** channel sebagai dua field terpisah (tidak digabung)
- [ ] Alokasi batch untuk pergerakan keluar **selalu** lewat fungsi FEFO — operator tidak pernah input batch manual

### Styling
- [ ] Ikuti warna & tipografi dari `StyleGuide.md` — gunakan CSS variable/Tailwind token, bukan hex hardcode di banyak tempat
- [ ] Ikon pakai komponen SVG custom di `src/components/icons/`, bukan `import` dari library ikon
- [ ] Mobile-first, tapi prioritas utama tetap desktop/tablet (konteks pemakaian: gudang)

### API & Data
- [ ] Semua route handler ada error handling & validasi input (Zod)
- [ ] Tidak ada field harga/nilai uang di skema mana pun
- [ ] Semua kredensial Supabase lewat `.env.local`, tidak pernah hardcode

---

## 5. Git Convention

### Branch Naming
```
feature/[nama-fitur]     → feature/ledger-append-only
fix/[nama-bug]           → fix/fefo-split-batch
chore/[nama-task]        → chore/setup-supabase
docs/[nama-doc]          → docs/update-prd
```

### Commit Message
```
feat: implement FEFO batch allocation
fix: prevent ledger row edit after opname correction
chore: setup supabase migration for products & batches
docs: update PRD with bundle recipe scope
```

### Alur Kerja
```
main (production)
  └── develop (staging)
        ├── feature/[...]
        ├── fix/[...]
        └── chore/[...]
```
- Semua PR ke `develop` dulu, merge ke `main` setelah review

---

## 6. Aturan untuk AI (Claude / Cursor / Copilot)

### ✅ AI HARUS:
- Ikuti struktur folder di atas
- Gunakan tech stack yang sudah ditentukan (Next.js + TypeScript + Supabase)
- Ikuti naming convention yang berlaku
- Tambahkan TypeScript types untuk semua kode baru
- Ikuti warna, tipografi, dan ikon custom dari `StyleGuide.md`
- Jaga prinsip ledger append-only di Bagian 4 — ini non-negotiable untuk proyek ini
- Tulis UI dalam Bahasa Indonesia
- Tambahkan komentar untuk logic FEFO/rekonsiliasi yang kompleks

### ❌ AI DILARANG:
- Mengganti tech stack tanpa persetujuan
- Menggunakan library ikon pihak ketiga (Lucide, Heroicons, dll) di kode produksi — hanya boleh dipakai sementara untuk preview cepat
- Menambahkan field harga/nilai uang di skema data
- Membuat operasi update/delete pada baris Stock Ledger
- Menggunakan `any` di TypeScript
- Membuat komponen monolitik (> 300 baris)

### ⚠️ AI harus TANYA dulu jika:
- Tidak yakin dengan keputusan arsitektur ledger/FEFO
- Ingin menambah library baru
- Ada konflik antara PRD dan aturan di sini

---

## 7. Checklist Sebelum Commit

- [ ] Kode sudah di-lint, tidak ada error
- [ ] Tidak ada `console.log` tertinggal
- [ ] Semua fungsi/komponen baru sudah bertipe TypeScript
- [ ] Tidak ada operasi update/delete pada ledger
- [ ] Tidak ada field harga yang menyelinap masuk skema
- [ ] Sudah dites manual: skenario batal pesanan, retur, bonus/promo/sampel
- [ ] Nama file & variabel mengikuti konvensi

---

*RULES.md wajib dibaca sebelum mulai coding.*
