"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { TEST_USERS } from "@/constants/users";
import type { UserRole } from "@/types";

export default function LoginPage() {
  const { user, login, loading } = useUser();
  const router = useRouter();
  const [error, setError] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && user) {
      router.push("/dashboard");
    }
  }, [user, router, mounted]);

  const handleTestLogin = async (email: string, role: UserRole) => {
    setError("");
    setSigningIn(true);
    const success = await login(email, role);
    setSigningIn(false);
    if (success) {
      router.push("/dashboard");
    } else {
      setError("Login gagal. Pastikan database Supabase sudah di-seed dengan benar.");
    }
  };

  if (!mounted || loading || signingIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="text-ink-soft font-mono">Memuat...</div>
      </div>
    );
  }

  return (
    <main role="main" className="min-h-screen flex flex-col items-center justify-center p-4 bg-bg">
      <div className="w-full max-w-md bg-white p-6 md:p-8 rounded-md border border-border shadow-sm">
        <div className="text-center mb-8">
          <h1 className="font-heading text-2xl font-bold text-primary-dark">StokLedger</h1>
          <p className="text-ink-soft text-sm mt-1">Sistem Rekonsiliasi & Buku Besar Stok</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-danger-bg text-danger text-sm rounded border border-danger/30">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <p className="text-ink-soft text-xs uppercase tracking-wider font-semibold text-center mb-4">
            Pilih Akun untuk Masuk
          </p>

          {TEST_USERS.map((u) => {
            let roleLabel = "";
            let roleDesc = "";
            let badgeBg = "";
            let badgeText = "";

            if (u.role === "gudang") {
              roleLabel = "Operator / Admin Gudang";
              roleDesc = "Input barang masuk/keluar, retur, opname";
              badgeBg = "bg-primary-light";
              badgeText = "text-primary";
            } else if (u.role === "owner") {
              roleLabel = "Owner / Manajer";
              roleDesc = "Read-only: Dashboard, Notifikasi, Rekonsiliasi, Anggota";
              badgeBg = "bg-warning-bg";
              badgeText = "text-warning";
            } else {
              roleLabel = "Admin / Config";
              roleDesc = "Ubah data master: Produk, resep bundle, ambang kedaluwarsa";
              badgeBg = "bg-success-bg";
              badgeText = "text-success";
            }

            return (
              <button
                key={u.role}
                disabled={signingIn}
                onClick={() => handleTestLogin(u.email, u.role)}
                className="w-full text-left p-4 min-h-[72px] rounded-md border border-border hover:border-primary hover:bg-primary-light/20 transition-colors duration-150 flex flex-col gap-1 disabled:opacity-50 active:scale-[0.99]"
              >
                <div className="flex justify-between items-center w-full">
                  <span className="font-heading font-semibold text-ink text-sm">{u.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${badgeBg} ${badgeText}`}>
                    {roleLabel}
                  </span>
                </div>
                <span className="text-xs text-ink-soft font-mono">{u.email}</span>
                <span className="text-[11px] text-ink-faint mt-1">{roleDesc}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-8 pt-4 border-t border-border text-center text-[10px] text-ink-faint">
          StokLedger &copy; {new Date().getFullYear()} &middot; v1.0
        </div>
      </div>
    </main>
  );
}
