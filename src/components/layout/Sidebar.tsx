"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { IconDashboard } from "../icons/IconDashboard";
import { IconLedger } from "../icons/IconLedger";
import { IconTruck } from "../icons/IconTruck";
import { IconEdit } from "../icons/IconEdit";
import { IconBag } from "../icons/IconBag";
import { IconCheckClipboard } from "../icons/IconCheckClipboard";
import { IconScale } from "../icons/IconScale";
import { IconBell } from "../icons/IconBell";
import { IconVial } from "../icons/IconVial";
import { IconBoxes } from "../icons/IconBoxes";
import { LogOut } from "lucide-react";
import { motion } from "framer-motion";

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useUser();

  const menuItems = [
    { href: "/dashboard", label: "Dashboard", icon: IconDashboard },
    { href: "/produk", label: "Produk & Batch", icon: IconVial },
    { href: "/ledger", label: "Buku Besar", icon: IconLedger },
    { href: "/manual", label: "Input Manual", icon: IconEdit },
    { href: "/pesanan", label: "Pesanan Marketplace", icon: IconBag },
    { href: "/retur", label: "Inspeksi Retur", icon: IconTruck },
    { href: "/opname", label: "Stok Opname", icon: IconCheckClipboard },
    { href: "/rekonsiliasi", label: "Rekonsiliasi", icon: IconScale },
    { href: "/promo", label: "Aturan Promo", icon: IconBoxes },
    { href: "/anggota", label: "Kelola Anggota", icon: IconEdit },
    { href: "/notifikasi", label: "Notifikasi", icon: IconBell },
  ];

  if (!user) return null;

  return (
    <aside className="w-[248px] bg-sidebar text-sidebar-soft h-full flex flex-col justify-between shrink-0 overflow-y-auto border-r border-border/10 shadow-lg">
      <div className="flex flex-col">
        {/* Brand & Close Button on Mobile */}
        <div className="p-6 border-b border-sidebar-soft/10 flex justify-between items-center">
          <div>
            <span className="font-heading text-lg font-bold text-white tracking-wide block">StokLedger</span>
            <span className="text-[10px] text-sidebar-soft/70 uppercase tracking-wider block mt-0.5 font-mono">Append-Only Inventory</span>
          </div>
          {onClose && (
            <button 
              onClick={onClose} 
              className="lg:hidden p-2 rounded-full hover:bg-white/10 text-white transition-all duration-200"
              aria-label="Tutup menu"
            >
              ✕
            </button>
          )}
        </div>

        {/* User Info */}
        <div className="px-6 py-4 border-b border-sidebar-soft/10 bg-black/20">
          <div className="font-heading text-xs font-semibold text-white truncate">{user.name}</div>
          <div className="text-[10px] text-sidebar-soft/80 capitalize font-mono mt-0.5">Admin</div>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className="block"
              >
                <motion.div
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  className={`flex items-center gap-3 px-3 py-3 lg:py-2.5 rounded-sm text-sm font-medium transition-colors duration-150 min-h-[44px] ${
                    isActive
                      ? "bg-primary text-white font-semibold shadow-inner"
                      : "hover:bg-primary-dark/40 hover:text-white"
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? "text-white" : "text-sidebar-soft"}`} />
                  <span>{item.label}</span>
                </motion.div>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Logout */}
      <div className="p-4 border-t border-sidebar-soft/10">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 text-xs font-semibold text-sidebar-soft hover:text-white bg-white/5 hover:bg-danger/80 rounded transition-all duration-200 min-h-[44px]"
        >
          <LogOut className="w-4 h-4" />
          <span>Keluar (Log Out)</span>
        </motion.button>
      </div>
    </aside>
  );
}
