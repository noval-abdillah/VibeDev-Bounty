"use client";

import React, { useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";
import { SectionCard, Input, Button, Tag } from "@/components/ui";
import { supabase } from "@/lib/supabase/client";
import { getStockForProductAndBatch, writeLedgerEntry } from "@/lib/ledger";
import { exportToXlsx } from "@/lib/export";
import type { ExportColumn, ExportSheet } from "@/lib/export";
import type { Product, Batch, OpnameSession, OpnameItem } from "@/types";

export default function StokOpnamePage() {
  const { user } = useUser();
  const isReadOnly = user?.role === "owner";

  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [sessions, setSessions] = useState<OpnameSession[]>([]);
  
  // Active draft session
  const [activeSession, setActiveSession] = useState<OpnameSession | null>(null);
  
  // Physical count inputs map: key = `prodId_batchId`, value = physical count string
  const [physicalCounts, setPhysicalCounts] = useState<Record<string, string>>({});
  
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: prods } = await supabase.from("products").select("*").eq("is_active", true);
    const { data: bts } = await supabase.from("batches").select("*");
    
    if (prods) setProducts(prods);
    if (bts) setBatches(bts);
    
    await loadSessions();
  };

  const loadSessions = async () => {
    const { data: list } = await supabase.from("opname_sessions").select("*");
    if (list) {
      const sorted = [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setSessions(sorted as OpnameSession[]);
      
      const draft = list.find((s) => s.status === "draft");
      if (draft) {
        setActiveSession(draft as OpnameSession);
        
        // Load draft items
        const { data: draftItems } = await supabase.from("opname_items").select("*").eq("session_id", draft.id);
        const counts: Record<string, string> = {};
        if (draftItems) {
          draftItems.forEach((item) => {
            counts[`${item.product_id}_${item.batch_id}`] = item.physical_qty.toString();
          });
        }
        setPhysicalCounts(counts);
      } else {
        setActiveSession(null);
        setPhysicalCounts({});
      }
    }
  };

  const handleStartOpname = async () => {
    if (isReadOnly) return;
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      // 1. Create session
      const { data: sess, error: sessError } = await supabase
        .from("opname_sessions")
        .insert({ status: "draft" })
        .select()
        .single();

      if (sessError || !sess) {
        throw new Error("Gagal memulai sesi opname.");
      }

      // Seed initial physical counts with system values
      const initialCounts: Record<string, string> = {};
      const prods = products;
      
      await Promise.all(
        prods.map(async (p) => {
          const pBatches = batches.filter((b) => b.product_id === p.id);
          await Promise.all(
            pBatches.map(async (b) => {
              const sysVal = await getStockForProductAndBatch(p.id, b.id);
              initialCounts[`${p.id}_${b.id}`] = sysVal.toString();
              
              await supabase.from("opname_items").insert({
                session_id: sess.id,
                product_id: p.id,
                batch_id: b.id,
                physical_qty: sysVal,
                system_qty: sysVal,
              });
            })
          );
        })
      );

      setActiveSession(sess as OpnameSession);
      setPhysicalCounts(initialCounts);
      await loadSessions();
    } catch (err: any) {
      setError(err.message || "Gagal memulai opname.");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (productId: string, batchId: string, val: string) => {
    if (isReadOnly) return;
    setPhysicalCounts({
      ...physicalCounts,
      [`${productId}_${batchId}`]: val,
    });
  };

  const handleSaveDraft = async () => {
    if (isReadOnly || !activeSession) return;
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      // Clear old draft items
      await supabase.from("opname_items").delete().eq("session_id", activeSession.id);

      // Insert new draft items
      await Promise.all(
        products.map(async (p) => {
          const pBatches = batches.filter((b) => b.product_id === p.id);
          await Promise.all(
            pBatches.map(async (b) => {
              const key = `${p.id}_${b.id}`;
              const physicalVal = parseInt(physicalCounts[key]) || 0;
              const systemVal = await getStockForProductAndBatch(p.id, b.id);

              await supabase.from("opname_items").insert({
                session_id: activeSession.id,
                product_id: p.id,
                batch_id: b.id,
                physical_qty: physicalVal,
                system_qty: systemVal,
              });
            })
          );
        })
      );

      setSuccess("Draft hasil hitung fisik berhasil disimpan.");
      await loadSessions();
    } catch {
      setError("Gagal menyimpan draft.");
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteOpname = async () => {
    if (isReadOnly || !activeSession) return;
    setError("");
    setSuccess("");

    if (!confirm("Apakah Anda yakin ingin menyelesaikan opname? Aksi ini akan menulis baris koreksi baru ke Buku Besar untuk setiap selisih.")) {
      return;
    }

    setLoading(true);
    try {
      const finalItems: { product_id: string; batch_id: string; physical_qty: number; system_qty: number }[] = [];
      const adjustments: { product_id: string; batch_id: string; diff: number }[] = [];

      for (const p of products) {
        const pBatches = batches.filter((b) => b.product_id === p.id);
        for (const b of pBatches) {
          const key = `${p.id}_${b.id}`;
          const physicalVal = parseInt(physicalCounts[key]);
          const systemVal = await getStockForProductAndBatch(p.id, b.id);

          if (isNaN(physicalVal) || physicalVal < 0) {
            throw new Error(`Nilai hitung fisik untuk ${p.name} batch ${b.batch_code} tidak valid.`);
          }

          finalItems.push({
            product_id: p.id,
            batch_id: b.id,
            physical_qty: physicalVal,
            system_qty: systemVal,
          });

          const diff = physicalVal - systemVal;
          if (diff !== 0) {
            adjustments.push({
              product_id: p.id,
              batch_id: b.id,
              diff,
            });
          }
        }
      }

      // 1. Save final items
      await supabase.from("opname_items").delete().eq("session_id", activeSession.id);
      await supabase.from("opname_items").insert(
        finalItems.map((item) => ({
          session_id: activeSession.id,
          product_id: item.product_id,
          batch_id: item.batch_id,
          physical_qty: item.physical_qty,
          system_qty: item.system_qty,
        }))
      );

      // 2. FIRST: write ledger corrections
      await Promise.all(
        adjustments.map(async (adj) => {
          await writeLedgerEntry(
            adj.product_id,
            adj.batch_id,
            adj.diff,
            "opname_koreksi",
            "system",
            `OPNAME-CORR-${activeSession.id.slice(-6)}`
          );
        })
      );

      // 3. THEN: mark session completed (only after ledger entries are consistent)
      await supabase
        .from("opname_sessions")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", activeSession.id);

      setSuccess(`Opname selesai! Menulis ${adjustments.length} entri koreksi ke Buku Besar.`);
      setActiveSession(null);
      setPhysicalCounts({});
      await loadSessions();
    } catch (err: any) {
      setError(err.message || "Gagal merampungkan opname.");
    } finally {
      setLoading(false);
    }
  };

  const handleExportOpname = async (sessionId: string) => {
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    
    const { data: items } = await supabase
      .from("opname_items")
      .select("*")
      .eq("session_id", sessionId);

    if (!items) return;

    const columns: ExportColumn[] = [
      { header: "Produk", key: "produk", width: 35 },
      { header: "Kode Batch", key: "batch", width: 18 },
      { header: "Stok Sistem", key: "sistem", width: 14 },
      { header: "Hitung Fisik", key: "fisik", width: 14 },
      { header: "Selisih", key: "selisih", width: 12 },
    ];

    const rows = items.map((item) => {
      const prod = products.find((p) => p.id === item.product_id);
      const batch = batches.find((b) => b.id === item.batch_id);
      const diff = item.physical_qty - item.system_qty;
      return {
        produk: prod?.name || "Unknown",
        batch: batch?.batch_code || item.batch_id,
        sistem: item.system_qty.toLocaleString("id-ID"),
        fisik: item.physical_qty.toLocaleString("id-ID"),
        selisih: diff > 0 ? `+${diff}` : `${diff}`,
      };
    });

    const diffCount = items.filter((i) => i.physical_qty !== i.system_qty).length;

    const sheet: ExportSheet = {
      name: "Data Opname",
      columns,
      rows,
      summaryRows: [
        { label: "ID Sesi", value: sessionId.slice(-6) },
        { label: "Total Produk", value: `${items.length} batch` },
        { label: "Jumlah Selisih", value: `${diffCount} batch` },
        { label: "Diekspor Pada", value: now.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) },
      ],
    };

    await exportToXlsx({
      title: "Stok Opname StokLedger",
      fileName: `StokLedger_Opname_${today}`,
      sheets: [sheet],
    });
  };

  return (
    <div className="space-y-6">
      {/* Informative Alert Banner */}
      <div role="alert" className="bg-warning-bg border border-warning/30 rounded p-3 text-warning font-semibold text-xs flex items-center gap-2">
        <span>📋</span>
        <span>
          <strong>Instruksi Stok Opname:</strong> Masukkan hasil hitung fisik gudang per batch. Sistem akan membandingkannya dengan catatan Buku Besar (stok sistem). Setiap selisih yang ditemukan akan ditulis sebagai baris koreksi berjejak baru di ledger (append-only), tanpa menimpa atau memodifikasi catatan sejarah transaksi lama.
        </span>
      </div>

      {activeSession ? (
        <SectionCard
          title={`Sesi Opname Aktif (DRAFT)`}
          action={
            <div className="flex gap-2">
              <Button variant="ghost" disabled={isReadOnly || loading} onClick={handleSaveDraft}>
                Simpan Draft
              </Button>
              <Button variant="success" disabled={isReadOnly || loading} onClick={handleCompleteOpname}>
                Simpan &amp; Buat Koreksi
              </Button>
            </div>
          }
        >
          {error && (
            <div className="mb-4 p-3 bg-danger-bg text-danger text-xs rounded border border-danger/30 font-semibold font-mono">
              {error}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-xs font-semibold text-ink-soft uppercase bg-bg/50">
                  <th className="py-2.5 px-3">Produk</th>
                  <th className="py-2.5 px-3">Kode Batch</th>
                  <th className="py-2.5 px-3 text-right">Stok Sistem</th>
                  <th className="py-2.5 px-3 text-center w-36">Hitung Fisik</th>
                  <th className="py-2.5 px-3 text-right">Selisih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs font-mono">
                {products.flatMap((p) => {
                  const pBatches = batches.filter((b) => b.product_id === p.id);
                  return pBatches.map((b) => {
                    // System value calculation (we mock state temporarily to show sync)
                    const key = `${p.id}_${b.id}`;
                    const physicalValStr = physicalCounts[key] || "0";
                    const physicalVal = parseInt(physicalValStr) || 0;
                    
                    return (
                      <OpnameRow
                        key={key}
                        product={p}
                        batch={b}
                        physicalValStr={physicalValStr}
                        physicalVal={physicalVal}
                        isReadOnly={isReadOnly || loading}
                        onInputChange={handleInputChange}
                      />
                    );
                  });
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : (
        <SectionCard title="Sesi Opname Baru">
          <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed border-border-strong rounded-md bg-white">
            <span className="text-sm font-semibold text-ink-soft mb-2">Tidak ada sesi opname aktif.</span>
            <p className="text-xs text-ink-faint max-w-sm mb-4 leading-relaxed">
              Mulai sesi baru untuk menghitung fisik stok gudang dan merekonsiliasi selisih dengan sistem.
            </p>
            <Button disabled={isReadOnly || loading} onClick={handleStartOpname}>
              {isReadOnly ? "Read-Only (Tidak Dapat Memulai)" : loading ? "Memulai..." : "Mulai Stok Opname Baru"}
            </Button>
          </div>
        </SectionCard>
      )}

      {/* History of sessions */}
      <SectionCard title="Riwayat Stok Opname Selesai" action={
        sessions.filter(s => s.status === "completed").length > 0 && (
          <Button variant="ghost" className="text-[10px] px-2 py-1" onClick={() => {
            const lastCompleted = sessions.find(s => s.status === "completed");
            if (lastCompleted) handleExportOpname(lastCompleted.id);
          }}>
            Ekspor Excel
          </Button>
        )
      }>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border text-xs font-semibold text-ink-soft uppercase bg-bg/50">
                <th className="py-2.5 px-3">ID Sesi</th>
                <th className="py-2.5 px-3">Tanggal Mulai</th>
                <th className="py-2.5 px-3">Tanggal Selesai</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Total Selisih Produk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs font-mono">
              {sessions.filter(s => s.status === "completed").map((s) => {
                return (
                  <OpnameHistoryRow key={s.id} session={s} />
                );
              })}
              {sessions.filter(s => s.status === "completed").length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-ink-faint">
                    Belum ada riwayat opname selesai.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

function OpnameRow({ product, batch, physicalValStr, physicalVal, isReadOnly, onInputChange }: any) {
  const [sysVal, setSysVal] = useState<number | null>(null);

  useEffect(() => {
    getStockForProductAndBatch(product.id, batch.id).then((val) => {
      setSysVal(val);
    });
  }, [product.id, batch.id]);

  if (sysVal === null) return null;
  const diff = physicalVal - sysVal;

  return (
    <tr className="hover:bg-bg/10 transition-colors">
      <td className="py-2.5 px-3 font-body font-semibold text-ink">{product.name}</td>
      <td className="py-2.5 px-3 font-semibold text-primary">{batch.batch_code}</td>
      <td className="py-2.5 px-3 text-right font-bold">{sysVal}</td>
      <td className="py-2.5 px-3 text-center">
        <input
          type="number"
          min="0"
          className="w-24 px-2 py-1 text-center bg-white border border-border rounded-sm focus:outline-none focus:border-primary font-bold font-mono text-sm"
          value={physicalValStr}
          onChange={(e) => onInputChange(product.id, batch.id, e.target.value)}
          disabled={isReadOnly}
        />
      </td>
      <td className="py-2.5 px-3 text-right font-bold">
        {diff > 0 && <span className="text-success">+{diff}</span>}
        {diff < 0 && <span className="text-danger">{diff}</span>}
        {diff === 0 && <span className="text-ink-faint">0</span>}
      </td>
    </tr>
  );
}

function OpnameHistoryRow({ session }: { session: OpnameSession }) {
  const [diffCount, setDiffCount] = useState<number | null>(null);

  useEffect(() => {
    supabase
      .from("opname_items")
      .select("*")
      .eq("session_id", session.id)
      .then(({ data }) => {
        if (data) {
          const diffs = data.filter((i) => i.physical_qty !== i.system_qty).length;
          setDiffCount(diffs);
        }
      });
  }, [session.id]);

  return (
    <tr className="hover:bg-bg/10 transition-colors">
      <td className="py-2.5 px-3 font-bold text-ink">{session.id}</td>
      <td className="py-2.5 px-3">
        {new Date(session.created_at).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </td>
      <td className="py-2.5 px-3">
        {session.completed_at ? new Date(session.completed_at).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }) : "-"}
      </td>
      <td className="py-2.5 px-3">
        <Tag variant="success">COMPLETED</Tag>
      </td>
      <td className="py-2.5 px-3 text-right font-bold text-danger">
        {diffCount === null ? "..." : diffCount > 0 ? `${diffCount} batch selisih` : "Cocok 100%"}
      </td>
    </tr>
  );
}
