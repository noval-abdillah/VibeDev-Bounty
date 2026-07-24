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
  const [reservation, setReservation] = useState(0);

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

    const [btsResult, ledgerResult, ordersResult, bundlesResult, compsResult] = await Promise.all([
      supabase.from("batch_stock_summary").select("*").eq("product_id", prodId),
      supabase.from("stock_ledger").select("*").eq("product_id", prodId).order("created_at", { ascending: false }),
      supabase.from("orders").select("*").eq("status", "PENDING"),
      supabase.from("bundles").select("*"),
      supabase.from("bundle_components").select("*"),
    ]);

    const bts = btsResult.data || [];
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

    if (ledgerResult.data) {
      setLedgerEntries(ledgerResult.data);
    }

    const total = ledgerResult.data ? ledgerResult.data.reduce((sum, e) => sum + e.qty, 0) : 0;
    setTotalStock(total);

    // Compute reservations
    const pendingOrders = ordersResult.data || [];
    const bundles = bundlesResult.data || [];
    const comps = compsResult.data || [];
    
    let resQty = 0;
    pendingOrders.forEach((o: any) => {
      if (o.sku.toUpperCase() === prod.sku.toUpperCase()) {
        resQty += o.qty;
      } else {
        const bundle = bundles.find((b: any) => b.sku.toUpperCase() === o.sku.toUpperCase());
        if (bundle) {
          const bComps = comps.filter((bc) => bc.bundle_id === bundle.id);
          const matchedComp = bComps.find((c) => c.product_id === prodId);
          if (matchedComp) {
            resQty += matchedComp.qty * o.qty;
          }
        }
      }
    });
    setReservation(resQty);
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
      case "koreksi_salah_input": return "Koreksi Salah Input";
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

  const eligibleBatchesSorted = [...batches]
    .filter(b => (batchStocks[b.id] || 0) > 0)
    .sort((a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime());

  const getFefoLabel = (batchId: string) => {
    const idx = eligibleBatchesSorted.findIndex(b => b.id === batchId);
    if (idx === -1) return "-";
    if (idx === 0) return "Keluar Duluan";
    return `#${idx + 1}`;
  };

  const getExpiryBadge = (expiryDateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expDate = new Date(expiryDateStr);
    expDate.setHours(0, 0, 0, 0);
    
    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return <Tag variant="danger">Kedaluwarsa ({Math.abs(diffDays)} hari lalu)</Tag>;
    }
    if (diffDays <= 20) {
      return <Tag variant="danger">{diffDays} hari lagi</Tag>;
    }
    if (diffDays <= 30) {
      return <Tag variant="warning">{diffDays} hari lagi</Tag>;
    }
    return <Tag variant="success">Normal ({diffDays} hari)</Tag>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-md border border-border">
        <div>
          <button onClick={() => router.push("/produk")} className="text-xs font-semibold text-primary hover:underline block mb-1">
            &larr; Kembali ke Katalog
          </button>
          <h2 className="font-heading text-xl font-bold text-ink">{product.name}</h2>
          <span className="font-mono text-xs text-ink-soft">SKU: {product.sku}</span>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="bg-bg p-3 rounded border border-border text-center min-w-[100px]">
            <span className="text-[10px] text-ink-soft font-semibold uppercase block">Stok Fisik</span>
            <span className="text-lg font-bold font-mono text-ink">{totalStock.toLocaleString("id-ID")}</span>
          </div>
          <div className="bg-bg p-3 rounded border border-border text-center min-w-[100px]">
            <span className="text-[10px] text-ink-soft font-semibold uppercase block">Reservasi</span>
            <span className="text-lg font-bold font-mono text-ink-soft">{reservation.toLocaleString("id-ID")}</span>
          </div>
          <div className="bg-white p-3 rounded border-border-strong border text-center min-w-[100px]">
            <span className="text-[10px] text-primary-dark font-semibold uppercase block">Aman Dijual</span>
            <Tag variant={totalStock - reservation > 0 ? "success" : "neutral"} className="mt-1 font-bold">
              {(totalStock - reservation).toLocaleString("id-ID")}
            </Tag>
          </div>
        </div>
      </div>

      {/* Batches section */}
      <SectionCard title="Daftar Batch Terdaftar">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border text-ink-soft font-bold uppercase bg-bg/50">
                <th className="py-2.5 px-3">Kode Batch</th>
                <th className="py-2.5 px-3">Kedaluwarsa</th>
                <th className="py-2.5 px-3 text-center">Urutan FEFO</th>
                <th className="py-2.5 px-3">Jenis</th>
                <th className="py-2.5 px-3 text-right">Sisa Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-mono text-[11px]">
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-ink-faint font-body text-xs">
                    Belum ada batch terdaftar untuk produk ini.
                  </td>
                </tr>
              ) : (
                batches.map((b) => {
                  const stock = batchStocks[b.id] || 0;
                  return (
                    <tr key={b.id} className="hover:bg-bg/10 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-ink">{b.batch_code}</td>
                      <td className="py-2.5 px-3 font-body">{getExpiryBadge(b.expiry_date)}</td>
                      <td className="py-2.5 px-3 text-center">
                        <Tag variant={getFefoLabel(b.id) === "Keluar Duluan" ? "success" : "neutral"} className="font-bold">
                          {getFefoLabel(b.id)}
                        </Tag>
                      </td>
                      <td className="py-2.5 px-3">
                        <Tag variant="primary">Maklon</Tag>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-ink-soft">
                        {stock.toLocaleString("id-ID")} pcs
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
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
