"use client";

import React, { useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";
import { SectionCard, Input, Select, Button, Tag } from "@/components/ui";
import { useRouter } from "next/navigation";

interface Profile {
  id: string;
  email: string;
  name: string;
  role: "gudang" | "owner" | "admin";
  created_at: string;
}

export const dynamic = "force-dynamic";

export default function AnggotaPage() {
  const { user } = useUser();
  const router = useRouter();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"gudang" | "owner" | "admin">("gudang");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user && user.role !== "owner") {
      router.push("/dashboard");
    } else {
      fetchProfiles();
    }
  }, [user]);

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/users");
      const data = await res.json();
      if (data.profiles) {
        setProfiles(data.profiles);
      }
    } catch {
      setError("Gagal memuat daftar anggota.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!email || !name || !password || !role) {
      setError("Semua field wajib diisi.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, role, password }),
      });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        setSuccess("Anggota baru berhasil didaftarkan!");
        setEmail("");
        setName("");
        setPassword("");
        setRole("gudang");
        fetchProfiles();
      }
    } catch {
      setError("Terjadi kesalahan sistem saat membuat user.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && profiles.length === 0) {
    return (
      <div className="text-center font-mono py-8 text-xs text-ink-soft">
        Memuat data...
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1">
        <SectionCard title="Tambah Anggota Baru">
          <form onSubmit={handleCreateUser} className="space-y-4">
            {error && (
              <div className="p-3 bg-danger-bg text-danger text-xs rounded border border-danger/30 font-semibold font-mono">
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 bg-success-bg text-success text-xs rounded border border-success/30 font-semibold">
                {success}
              </div>
            )}

            <Input
              label="Nama Lengkap"
              placeholder="Contoh: Pak Eko"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={submitting}
            />

            <Input
              label="Alamat Email"
              type="email"
              placeholder="nama@stokledger.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={submitting}
            />

            <Select
              label="Peran / Hak Akses"
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              options={[
                { value: "gudang", label: "Gudang (Operator Gudang)" },
                { value: "admin", label: "Admin (Pengelola Master)" },
                { value: "owner", label: "Owner (Akses Manajer/Read-only)" },
              ]}
              required
              disabled={submitting}
            />

            <Input
              label="Password Akun"
              type="password"
              placeholder="Minimal 6 karakter"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={submitting}
            />

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Mendaftarkan..." : "Daftarkan Anggota Baru"}
            </Button>
          </form>
        </SectionCard>
      </div>

      <div className="lg:col-span-2">
        <SectionCard title="Daftar Anggota Sistem">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-xs font-semibold text-ink-soft uppercase bg-bg/50">
                  <th className="py-2.5 px-3">Nama</th>
                  <th className="py-2.5 px-3">Email</th>
                  <th className="py-2.5 px-3">Peran</th>
                  <th className="py-2.5 px-3 font-mono">Dibuat Pada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {profiles.map((p) => (
                  <tr key={p.id} className="hover:bg-bg/10 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-ink">{p.name}</td>
                    <td className="py-2.5 px-3 font-mono text-ink-soft">{p.email}</td>
                    <td className="py-2.5 px-3">
                      {p.role === "owner" && <Tag variant="warning">OWNER</Tag>}
                      {p.role === "admin" && <Tag variant="success">ADMIN</Tag>}
                      {p.role === "gudang" && <Tag variant="primary">GUDANG</Tag>}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-ink-faint">
                      {new Date(p.created_at).toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
