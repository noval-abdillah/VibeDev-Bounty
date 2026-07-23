"use client";

import React from "react";
import { useUser } from "@/context/UserContext";
import { usePathname } from "next/navigation";
import { IconFlask } from "@/components/icons/IconFlask";

interface TopbarProps {
  onMenuClick?: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { user } = useUser();
  const pathname = usePathname();

  const getPageTitle = () => {
    const parts = pathname.split("/");
    const primary = parts[1] || parts[2] || "dashboard";
    switch (primary) {
      case "dashboard":
        return { title: "Dashboard", desc: "Ringkasan kesehatan stok hari ini" };
      case "produk":
        return { title: "Katalog Produk & Batch", desc: "Master produk, batch, dan tanggal kedaluwarsa" };
      case "ledger":
        return { title: "Buku Besar Stok", desc: "Seluruh pergerakan stok — sumber kebenaran tunggal, append-only" };
      case "masuk":
        return { title: "Barang Masuk (Maklon)", desc: "Penerimaan barang dari maklon" };
      case "manual":
        return { title: "Keluar Manual", desc: "Keluar barang tanpa pesanan marketplace" };
      case "pesanan":
        return { title: "Pesanan & Retur", desc: "Simulasi pesanan Shopee & TikTok Shop" };
      case "opname":
        return { title: "Stok Opname Gudang", desc: "Hitung fisik vs catatan sistem" };
      case "rekonsiliasi":
        return { title: "Rekonsiliasi & Drill-Down", desc: "Selisih dan jejak pergerakan pembentuknya" };
      case "anggota":
        return { title: "Kelola Anggota", desc: "Manajemen anggota tim dan hak akses mereka" };
      case "notifikasi":
        return { title: "Notifikasi", desc: "Peringatan kedaluwarsa & klaim retur mendekati batas" };
      default:
        return { title: "StokLedger", desc: "Append-Only Inventory System" };
    }
  };

  if (!user) return null;
  const meta = getPageTitle();

  return (
    <header className="h-[60px] md:h-[73px] bg-white border-b border-border px-4 md:px-6 flex items-center justify-between shrink-0 gap-4">
      {/* Hamburger for mobile */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-sm hover:bg-bg text-ink transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
          aria-label="Buka menu navigasi"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="2" y1="5" x2="18" y2="5" />
            <line x1="2" y1="10" x2="18" y2="10" />
            <line x1="2" y1="15" x2="18" y2="15" />
          </svg>
        </button>

        <div className="min-w-0">
          <h1 className="font-heading text-base md:text-lg font-bold text-ink leading-tight truncate">{meta.title}</h1>
          <p className="text-xs text-ink-soft mt-0.5 truncate hidden sm:block">{meta.desc}</p>
        </div>
      </div>

      {/* Banner Mode Simulasi */}
      <div className="flex items-center gap-4">
        <span className="text-[11px] text-ink-faint italic font-mono hidden md:block">
          "setiap perubahan stok punya jejak"
        </span>
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-warning-bg border border-warning/20 shrink-0">
          <IconFlask className="w-3.5 h-3.5 text-warning" />
          <span className="font-mono text-[10px] text-warning font-bold uppercase tracking-wider">
            MODE SIMULASI
          </span>
        </div>
      </div>
    </header>
  );
}
