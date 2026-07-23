"use client";

import React, { useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";
import { SectionCard, Button, Tag, Input } from "@/components/ui";
import { supabase } from "@/lib/supabase/client";
import type { Product, ReturnItem } from "@/types";

export const dynamic = "force-dynamic";

export default function ReturPage() {
  const { user } = useUser();
  const isReadOnly = user?.role === "owner";

  const [products, setProducts] = useState<Product[]>([]);
  const [returns, setReturns] = useState<ReturnItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Layak jual batch inputs map: returnId -> { batchCode, expiryDate, error }
  const [layakInputs, setLayakInputs] = useState<Record<string, { batchCode: string; expiryDate: string; error?: string }>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: prods } = await supabase.from("products").select("*");
    const { data: rets } = await supabase.from("returns").select("*").order("created_at", { ascending: false });
    
    if (prods) setProducts(prods);
    if (rets) setReturns(rets as ReturnItem[]);
  };

  const getTiktokClaimDays = (r: ReturnItem) => {
    if (r.channel !== "tiktok" || !r.received_at) return null;
    const receivedDate = new Date(r.received_at);
    const elapsedDays = Math.floor((Date.now() - receivedDate.getTime()) / (1000 * 60 * 60 * 24));
    return 40 - elapsedDays;
  };

  const handleAction = async (ret: ReturnItem, condition: "layak_jual" | "rusak" | "hilang") => {
    if (isReadOnly) return;

    // Validation for layak_jual
    let payloadBatchCode = undefined;
    let payloadExpiryDate = undefined;

    if (condition === "layak_jual") {
      const input = layakInputs[ret.id];
      if (!input || !input.batchCode.trim() || !input.expiryDate) {
        setLayakInputs({
          ...layakInputs,
          [ret.id]: {
            batchCode: input?.batchCode || "",
            expiryDate: input?.expiryDate || "",
            error: "Kode batch dan tanggal kedaluwarsa wajib diisi.",
          }
        });
        return;
      }
      payloadBatchCode = input.batchCode.trim();
      payloadExpiryDate = input.expiryDate;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/webhook/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "process_return",
          payload: {
            return_id: ret.id,
            order_code: ret.order_code,
            channel: ret.channel,
            sku: ret.sku,
            qty: ret.qty,
            condition,
            new_batch_code: payloadBatchCode,
            new_expiry_date: payloadExpiryDate,
          }
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      // Clean input state
      const updatedInputs = { ...layakInputs };
      delete updatedInputs[ret.id];
      setLayakInputs(updatedInputs);

      alert(`Sukses memproses inspeksi retur order ${ret.order_code} sebagai ${condition.toUpperCase().replace("_", " ")}.`);
      fetchData();
    } catch (err: any) {
      alert(err.message || "Gagal memproses retur.");
    } finally {
      setLoading(false);
    }
  };

  const toggleLayakForm = (retId: string) => {
    if (layakInputs[retId]) {
      const updated = { ...layakInputs };
      delete updated[retId];
      setLayakInputs(updated);
    } else {
      setLayakInputs({
        ...layakInputs,
        [retId]: { batchCode: "", expiryDate: "" }
      });
    }
  };

  const handleInputChange = (retId: string, field: "batchCode" | "expiryDate", value: string) => {
    setLayakInputs({
      ...layakInputs,
      [retId]: {
        ...layakInputs[retId],
        [field]: value,
        error: undefined, // Clear error
      }
    });
  };

  const pendingReturns = returns.filter((r) => r.condition === null);
  const completedReturns = returns.filter((r) => r.condition !== null);

  return (
    <div className="space-y-6">
      {/* Pending Inspections Section */}
      <SectionCard title={`Menunggu Inspeksi (${pendingReturns.length})`}>
        {pendingReturns.length === 0 ? (
          <div className="py-12 text-center text-ink-faint font-mono text-sm border border-dashed border-border rounded-md bg-white">
            Tidak ada retur baru yang menunggu inspeksi.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingReturns.map((r) => {
              const productName = products.find((p) => p.sku === r.sku)?.name || r.sku;
              const tiktokDays = getTiktokClaimDays(r);
              const showLayakForm = !!layakInputs[r.id];

              return (
                <div key={r.id} className="p-4 bg-white border border-border rounded-md flex flex-col justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-heading font-semibold text-ink text-sm">
                        {productName} &times; {r.qty}
                      </span>
                      {r.channel === "shopee" ? (
                        <Tag variant="warning">SHOPEE</Tag>
                      ) : (
                        <Tag variant="primary">TIKTOK</Tag>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-ink-soft font-mono">
                      <span>Order ID: <strong>{r.order_code}</strong></span>
                      <span>&bull;</span>
                      <span>Diajukan: {new Date(r.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</span>
                    </div>

                    {tiktokDays !== null && (
                      <div className="mt-1">
                        <Tag variant={tiktokDays <= 5 ? "danger" : "warning"} className="font-bold text-[10px]">
                          Klaim TikTok {tiktokDays} hari lagi
                        </Tag>
                      </div>
                    )}
                  </div>

                  {/* Inline Layak Jual Form */}
                  {showLayakForm && (
                    <div className="p-3 bg-primary-light/35 rounded border border-primary/20 space-y-3">
                      <div className="text-[11px] text-primary-dark font-bold">Input Batch Baru untuk Restok</div>
                      {layakInputs[r.id]?.error && (
                        <div className="text-[10px] text-danger font-bold font-mono">{layakInputs[r.id]?.error}</div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <Input
                          label="Kode Batch Baru"
                          placeholder="B-RET-..."
                          value={layakInputs[r.id]?.batchCode || ""}
                          onChange={(e) => handleInputChange(r.id, "batchCode", e.target.value)}
                          className="bg-white min-h-[36px]"
                        />
                        <Input
                          label="Tanggal Expiry"
                          type="date"
                          value={layakInputs[r.id]?.expiryDate || ""}
                          onChange={(e) => handleInputChange(r.id, "expiryDate", e.target.value)}
                          className="bg-white min-h-[36px]"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" className="px-2 py-0.5 text-[10px] min-h-[32px]" onClick={() => toggleLayakForm(r.id)}>
                          Batal
                        </Button>
                        <Button variant="success" className="px-2 py-0.5 text-[10px] min-h-[32px]" onClick={() => handleAction(r, "layak_jual")}>
                          Restok Fisik
                        </Button>
                      </div>
                    </div>
                  )}

                  {!showLayakForm && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-border/40">
                      <Button
                        variant="success"
                        className="px-2.5 py-1 text-[11px] min-h-[32px] flex-1"
                        disabled={isReadOnly || loading}
                        onClick={() => toggleLayakForm(r.id)}
                      >
                        Layak Jual
                      </Button>
                      <Button
                        variant="danger"
                        className="px-2.5 py-1 text-[11px] min-h-[32px] flex-1"
                        disabled={isReadOnly || loading}
                        onClick={() => handleAction(r, "rusak")}
                      >
                        Rusak
                      </Button>
                      <Button
                        variant="ghost"
                        className="px-2.5 py-1 text-[11px] min-h-[32px] flex-1"
                        disabled={isReadOnly || loading}
                        onClick={() => handleAction(r, "hilang")}
                      >
                        Hilang
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* Info Panel explaining effects to Ledger */}
      <SectionCard title="Efek Aksi Terhadap Buku Besar (Ledger)">
        <div className="text-xs text-ink-soft space-y-3 leading-relaxed">
          <p>
            Setiap tindakan inspeksi retur menghasilkan entri ledger dengan detail spesifik untuk mencegah kebocoran:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
            <div className="p-3 bg-success-bg/30 border border-success/20 rounded">
              <span className="font-semibold text-success block mb-1">1. Layak Jual (+Stok)</span>
              Membuat batch baru di database dan menambahkan balik stok fisik ke ledger (<code>+qty</code>). Urutan FEFO batch baru ini akan mengikuti tanggal kedaluwarsa baru yang dimasukkan.
            </div>
            <div className="p-3 bg-danger-bg/30 border border-danger/20 rounded">
              <span className="font-semibold text-danger block mb-1">2. Rusak (Write-off)</span>
              Mencatat pengembalian retur lalu otomatis membuang barang tersebut sebagai barang rusak (scrap). Efek stok bersih = 0 (TIDAK menambah stok salable), dicatat sebagai <code>rusak</code> di ledger.
            </div>
            <div className="p-3 bg-bg border border-border-strong rounded">
              <span className="font-semibold text-ink-soft block mb-1">3. Hilang di Ekspedisi</span>
              Sama seperti rusak, tidak menambah stok salable, namun dicatat sebagai <code>hilang</code> di ledger untuk memisahkan alasan klaim kerugian logistik ke ekspedisi.
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Completed Inspections Section */}
      <SectionCard title="Riwayat Retur Selesai Diinspeksi">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border text-ink-soft font-bold uppercase bg-bg/50">
                <th className="py-2.5 px-3">Order ID</th>
                <th className="py-2.5 px-3">Channel</th>
                <th className="py-2.5 px-3">Produk</th>
                <th className="py-2.5 px-3 text-center">Qty</th>
                <th className="py-2.5 px-3">Kondisi Hasil Inspeksi</th>
                <th className="py-2.5 px-3">Waktu Inspeksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-mono text-[11px]">
              {completedReturns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-ink-faint font-body text-xs">
                    Belum ada retur yang selesai diinspeksi.
                  </td>
                </tr>
              ) : (
                completedReturns.map((r) => {
                  const productName = products.find((p) => p.sku === r.sku)?.name || r.sku;
                  return (
                    <tr key={r.id} className="hover:bg-bg/10 transition-colors">
                      <td className="py-2.5 px-3 font-bold">{r.order_code}</td>
                      <td className="py-2.5 px-3">
                        {r.channel === "shopee" ? (
                          <Tag variant="warning">SHOPEE</Tag>
                        ) : (
                          <Tag variant="primary">TIKTOK</Tag>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-body font-semibold">{productName}</td>
                      <td className="py-2.5 px-3 text-center font-bold">{r.qty}</td>
                      <td className="py-2.5 px-3">
                        {r.condition === "layak_jual" && <Tag variant="success">LAYAK JUAL</Tag>}
                        {r.condition === "rusak" && <Tag variant="danger">RUSAK / DISCARD</Tag>}
                        {r.condition === "hilang" && <Tag variant="neutral">HILANG EKSPEDISI</Tag>}
                      </td>
                      <td className="py-2.5 px-3 text-ink-faint">
                        {r.received_at ? new Date(r.received_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
