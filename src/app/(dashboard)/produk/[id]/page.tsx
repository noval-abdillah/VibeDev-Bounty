"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { SectionCard, Tag, Button } from "@/components/ui";
import { supabase } from "@/lib/supabase/client";
import { getStockForProductAndBatch, getStockForProduct } from "@/lib/ledger";
import type { Product, Batch, LedgerEntry } from "@/types";

export default function ProductDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [product, setProduct] = useState<Product | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [batchStocks, setBatchStocks] = useState<Record<string, number>>({});
  const [totalStock, setTotalStock] = useState(0);

  useEffect(() => {
    if (!id || typeof id !== "string") return;
    fetchDetails(id);
  }, [id, router]);

  const fetchDetails = async (prodId: string) => {
    const { data: prod } = await supabase.from("products").select("*").eq("id", prodId).single();
    if (!prod) {
      router.push("/produk");
      return;
    }

    setProduct(prod);

    const { data: bts } = await supabase
      .from("batch_stock_summary")
      .select("*")
      .eq("product_id", prodId);

    if (bts) {
      setBatches(bts.map(b => ({
        id: b.batch_id,
        product_id: b.product_id,
        batch_code: b.batch_code,
        expiry_date: b.expiry_date,
        created_at: b.created_at
      })));
      const bStocks: Record<string, number> = {};
      bts.forEach((b) => {
        bStocks[b.batch_id] = b.batch_stock;
      });
      setBatchStocks(bStocks);
    }

    const { data: ledger } = await supabase
      .from("stock_ledger")
      .select("*")
      .eq("product_id", prodId)
      .order("created_at", { ascending: false });
    
    if (ledger) {
      setLedgerEntries(ledger);
    }

    const total = await getStockForProduct(prodId);
    setTotalStock(total);
  };

  const getReasonLabel = (reason: string) => {
    switch (reason) {
      case "saldo_awal": return "Saldo Awal Produk";
      case "masuk_maklon": return "Barang Masuk Maklon";
      case "penjualan_offline": return "Penjualan Offline";
      case "bonus": return "Keluar Bonus";
      case "promo": return "Keluar Promo";
      case "sampel": return "Keluar Sampel";
      case "rusak": return "Barang Rusak";
      case "kedaluwarsa": return "Kedaluwarsa";
      case "pesanan_shopee": return "Pesanan Shopee";
      case "pesanan_tiktok": return "Pesanan TikTok";
      case "retur_shopee": return "Retur Shopee";
      case "retur_tiktok": return "Retur TikTok";
      case "opname_koreksi": return "Koreksi Stok Opname";
      default: return reason;
    }
  };

  const getChannelTag = (channel: string) => {
    switch (channel) {
      case "shopee": return <Tag variant="warning">SHOPEE</Tag>;
      case "tiktok": return <Tag variant="primary">TIKTOK</Tag>;
      case "manual": return <Tag variant="neutral">MANUAL</Tag>;
      default: return <Tag variant="neutral">SYSTEM</Tag>;
    }
  };

  if (!product) {
    return <div className="text-center font-mono py-8 text-xs text-ink-soft">Memuat detail produk...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <button onClick={() => router.push("/produk")} className="text-xs font-semibold text-primary hover:underline block mb-1">
            &larr; Kembali ke Katalog
          </button>
          <h2 className="font-heading text-xl font-bold text-ink">{product.name}</h2>
          <span className="font-mono text-xs text-ink-soft">SKU: {product.sku}</span>
        </div>
        <div className="text-right">
          <span className="text-xs font-semibold text-ink-soft uppercase block">Total Stok</span>
          <span className="text-2xl font-bold font-mono text-primary">{totalStock.toLocaleString("id-ID")} pcs</span>
        </div>
      </div>

      {/* Batches section */}
      <SectionCard title="Daftar Batch Terdaftar">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {batches.map((b) => {
            const stock = batchStocks[b.id] || 0;
            const isExpired = new Date(b.expiry_date) < new Date();
            
            const today = new Date();
            const thresholdDate = new Date();
            const storedThreshold = localStorage.getItem("stokledger_expiry_threshold") || "30";
            thresholdDate.setDate(today.getDate() + parseInt(storedThreshold));
            const isNearExpiry = new Date(b.expiry_date) <= thresholdDate && new Date(b.expiry_date) >= today;

            let statusTag = <Tag variant="success">NORMAL</Tag>;
            if (isExpired) {
              statusTag = <Tag variant="danger">KEDALUWARSA</Tag>;
            } else if (isNearExpiry) {
              statusTag = <Tag variant="warning">NEAR EXPIRY</Tag>;
            }

            return (
              <div key={b.id} className="p-4 border border-border rounded-md bg-bg/25 flex flex-col justify-between gap-3">
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-mono font-bold text-xs bg-white px-2 py-0.5 rounded border border-border-strong text-ink block max-w-[150px] truncate">
                      {b.batch_code}
                    </span>
                    {statusTag}
                  </div>
                  <div className="text-[11px] text-ink-soft mt-3 font-mono">
                    Expiry: {new Date(b.expiry_date).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric"
                    })}
                  </div>
                </div>
                <div className="flex justify-between items-end border-t border-border/60 pt-2 mt-1">
                  <span className="text-[10px] text-ink-faint uppercase font-semibold">Stok Batch</span>
                  <span className="text-sm font-bold font-mono text-ink">{stock} pcs</span>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* History Ledger for this product */}
      <SectionCard title="Riwayat Pergerakan Buku Besar (Produk Ini)">
        <div className="border border-border rounded-md overflow-hidden bg-[#FAFAF9]">
          <div className="px-4 py-3 bg-white border-b border-border flex justify-between text-xs font-bold text-ink-soft">
            <span>TRANSAKSI / BATCH</span>
            <span className="text-right">QTY</span>
          </div>
          <div className="divide-y divide-dashed divide-border-strong">
            {ledgerEntries.length === 0 ? (
              <div className="p-8 text-center text-xs text-ink-faint font-mono">
                Belum ada transaksi stok tercatat untuk produk ini.
              </div>
            ) : (
              ledgerEntries.map((e) => {
                const batch = batches.find((b) => b.id === e.batch_id);
                const isPositive = e.qty > 0;

                return (
                  <div key={e.id} className="p-4 hover:bg-white transition-colors duration-100 flex justify-between items-center gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold ${isPositive ? "text-success" : "text-danger"}`}>
                          {isPositive ? "▲" : "▼"}
                        </span>
                        <span className="text-xs font-bold text-ink">{getReasonLabel(e.reason)}</span>
                        {getChannelTag(e.channel)}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-soft">
                        <span className="font-mono bg-primary-light px-1.5 py-0.5 rounded text-primary-dark">
                          Batch: {batch?.batch_code || e.batch_id}
                        </span>
                        {e.reference_id && (
                          <>
                            <span>&bull;</span>
                            <span className="font-mono text-ink-faint">{e.reference_id}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <span className={`text-sm font-bold font-mono ${isPositive ? "text-success" : "text-danger"}`}>
                        {isPositive ? `+${e.qty}` : e.qty}
                      </span>
                      <span className="text-[10px] text-ink-faint font-mono mt-0.5">
                        {new Date(e.created_at).toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
