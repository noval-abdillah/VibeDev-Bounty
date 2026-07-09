"use client";

import React, { useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";
import { SectionCard, Tag, Button } from "@/components/ui";
import { supabase } from "@/lib/supabase/client";
import { getStockForProductAndBatch } from "@/lib/ledger";
import type { Batch, ReturnItem, Product } from "@/types";

export default function NotifikasiPage() {
  const { user } = useUser();
  const isReadOnly = user?.role === "owner";

  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [expiryWarnings, setExpiryWarnings] = useState<{
    batch: Batch;
    productName: string;
    sku: string;
    stock: number;
    remainingDays: number;
    status: "warning" | "danger" | "expired";
  }[]>([]);
  const [tiktokClaims, setTiktokClaims] = useState<{
    retItem: ReturnItem;
    remainingDays: number;
    status: "warning" | "danger" | "expired";
  }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    const { data: prods } = await supabase.from("products").select("*");
    const { data: bts } = await supabase.from("batch_stock_summary").select("*");
    const { data: rets } = await supabase.from("returns").select("*");

    if (!prods || !bts) return;

    setProducts(prods);
    
    // Standard map formatting
    const formattedBatches = bts.map(b => ({
      id: b.batch_id,
      product_id: b.product_id,
      batch_code: b.batch_code,
      expiry_date: b.expiry_date,
      created_at: b.created_at
    }));
    setBatches(formattedBatches);

    // Calculate Expiry warnings
    const thresholdDays = parseInt(localStorage.getItem("stokledger_expiry_threshold") || "30");
    const today = new Date();
    const warningList: typeof expiryWarnings = [];

    bts.forEach((b) => {
      const stock = b.batch_stock;
      if (stock <= 0) return; // Only warn for batches with active stock

      const prod = prods.find((p) => p.id === b.product_id);
      if (!prod) return;

      const expDate = new Date(b.expiry_date);
      const diffTime = expDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let status: "warning" | "danger" | "expired" = "warning";
      if (diffDays < 0) {
        status = "expired";
      } else if (diffDays <= 7) {
        status = "danger";
      } else if (diffDays <= thresholdDays) {
        status = "warning";
      } else {
        return; // normal, no warning
      }

      warningList.push({
        batch: {
          id: b.batch_id,
          product_id: b.product_id,
          batch_code: b.batch_code,
          expiry_date: b.expiry_date,
          created_at: b.created_at
        },
        productName: prod.name,
        sku: prod.sku,
        stock,
        remainingDays: diffDays,
        status,
      });
    });

    // Sort by remaining days ascending
    warningList.sort((a, b) => a.remainingDays - b.remainingDays);
    setExpiryWarnings(warningList);

    // Calculate TikTok return claims
    const claimList: typeof tiktokClaims = [];
    if (rets) {
      rets.forEach((r) => {
        if (r.channel !== "tiktok" || r.status !== "PENDING" || !r.received_at) return;

        const recDate = new Date(r.received_at);
        const elapsedDays = Math.floor((today.getTime() - recDate.getTime()) / (1000 * 60 * 60 * 24));
        const remainingDays = 40 - elapsedDays;

        let status: "warning" | "danger" | "expired" = "warning";
        if (remainingDays < 0) {
          status = "expired";
        } else if (remainingDays <= 7) {
          status = "danger";
        }

        claimList.push({
          retItem: r as any,
          remainingDays,
          status,
        });
      });
    }

    claimList.sort((a, b) => a.remainingDays - b.remainingDays);
    setTiktokClaims(claimList);
  };

  const handleClaimTiktok = async (retId: string) => {
    if (isReadOnly) return;
    setLoading(true);
    await supabase.from("returns").update({ status: "CLAIMED" }).eq("id", retId);
    setLoading(false);
    alert("Klaim retur TikTok berhasil ditandai sebagai claimed.");
    fetchNotifications();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Expiry Warnings */}
      <SectionCard title="Peringatan Kedaluwarsa Batch Aktif">
        <div className="space-y-4">
          <p className="text-xs text-ink-soft leading-relaxed">
            Menampilkan semua batch terdaftar yang memiliki stok fisik &gt; 0 dan mendekati tanggal kedaluwarsa.
          </p>

          <div className="divide-y divide-border text-xs font-mono">
            {expiryWarnings.length === 0 ? (
              <div className="py-8 text-center text-ink-faint font-body">
                Tidak ada peringatan kedaluwarsa untuk batch aktif.
              </div>
            ) : (
              expiryWarnings.map((w) => (
                <div key={w.batch.id} className="py-3 flex justify-between items-center gap-4">
                  <div className="space-y-0.5">
                    <span className="font-body font-bold text-ink block">{w.productName}</span>
                    <div className="flex gap-2 text-[10px] text-ink-soft">
                      <span>SKU: {w.sku}</span>
                      <span>&bull;</span>
                      <span className="font-semibold text-primary">Batch: {w.batch.batch_code}</span>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1 shrink-0">
                    <span className="font-bold text-ink">{w.stock} pcs</span>
                    {w.status === "expired" && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-danger-bg text-danger">
                        Lewat Expiry
                      </span>
                    )}
                    {w.status === "danger" && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-danger-bg text-danger">
                        {w.remainingDays} Hari Lagi
                      </span>
                    )}
                    {w.status === "warning" && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-warning-bg text-warning">
                        {w.remainingDays} Hari Lagi
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </SectionCard>

      {/* TikTok Claims Countdown */}
      <SectionCard title="Reminder Batas Klaim Retur TikTok (Max 40 Hari)">
        <div className="space-y-4">
          <p className="text-xs text-ink-soft leading-relaxed">
            Menampilkan barang retur TikTok Shop yang sudah diterima di gudang tetapi belum diajukan klaim. Batas pengajuan klaim adalah 40 hari sejak retur diterima.
          </p>

          <div className="divide-y divide-border text-xs font-mono">
            {tiktokClaims.length === 0 ? (
              <div className="py-8 text-center text-ink-faint font-body">
                Tidak ada klaim retur TikTok tertunda.
              </div>
            ) : (
              tiktokClaims.map((tc) => (
                <div key={tc.retItem.id} className="py-3 flex justify-between items-center gap-4">
                  <div className="space-y-0.5">
                    <span className="font-body font-bold text-ink block">Order: {tc.retItem.order_code}</span>
                    <div className="flex gap-2 text-[10px] text-ink-soft">
                      <span>SKU: {tc.retItem.sku}</span>
                      <span>&bull;</span>
                      <span>Kuantitas: {tc.retItem.qty} pcs</span>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-3 shrink-0">
                    <div className="flex flex-col items-end">
                      {tc.status === "expired" ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-danger-bg text-danger">
                          Klaim Hangus
                        </span>
                      ) : tc.status === "danger" ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-danger-bg text-danger">
                          H-{tc.remainingDays} Hari
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-warning-bg text-warning">
                          H-{tc.remainingDays} Hari
                        </span>
                      )}
                    </div>
                    <Button
                      variant="primary"
                      className="px-2 py-1 text-[10px]"
                      disabled={isReadOnly || loading}
                      onClick={() => handleClaimTiktok(tc.retItem.id)}
                    >
                      Klaim Selesai
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
