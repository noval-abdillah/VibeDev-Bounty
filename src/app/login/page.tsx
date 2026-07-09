"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { TEST_USERS } from "@/constants/users";
import type { UserRole } from "@/types";
import { Input, Button } from "@/components/ui";

export default function LoginPage() {
  const { user, login, loading } = useUser();
  const router = useRouter();

  const [error, setError] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Form state
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && user) {
      router.push("/dashboard");
    }
  }, [user, router, mounted]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formEmail.trim()) {
      setError("Email harus diisi.");
      return;
    }
    if (!formPassword || formPassword.length < 6) {
      setError("Password minimal 6 karakter.");
      return;
    }

    setSigningIn(true);
    const success = await login(formEmail.trim(), formPassword);
    setSigningIn(false);

    if (success) {
      router.push("/dashboard");
    } else {
      setError("Email atau password salah. Pastikan akun sudah didaftarkan oleh Owner.");
    }
  };

  const handleDemoLogin = async (email: string) => {
    setError("");
    setSigningIn(true);
    const success = await login(email, "password123");
    setSigningIn(false);

    if (success) {
      router.push("/dashboard");
    } else {
      setError("Login gagal. Jalankan seed akun tester di /api/seed-users terlebih dahulu.");
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
          <div className="mb-4 p-3 bg-danger-bg text-danger text-sm rounded border border-danger/30" role="alert">
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4 mb-6">
          <Input
            label="Email"
            type="email"
            placeholder="nama@stokledger.com"
            value={formEmail}
            onChange={(e) => setFormEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <Input
            label="Password"
            type="password"
            placeholder="Masukkan password"
            value={formPassword}
            onChange={(e) => setFormPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          <Button type="submit" className="w-full">
            Masuk ke Dashboard
          </Button>
        </form>

        {/* Divider */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-3 text-ink-faint font-semibold tracking-wider">atau masuk cepat</span>
          </div>
        </div>

        {/* Demo Quick Login */}
        <div className="space-y-3">
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
                onClick={() => handleDemoLogin(u.email)}
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
