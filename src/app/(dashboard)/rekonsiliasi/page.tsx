"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { SectionCard, Tag, Select, Button } from "@/components/ui";
import { supabase } from "@/lib/supabase/client";
import { getStockForProductAndBatch } from "@/lib/ledger";
import { exportToXlsx, getReasonLabel, formatDate } from "@/lib/export";
import type { ExportColumn, ExportSheet } from "@/lib/export";
import type { Product, Batch, OpnameSession, OpnameItem, LedgerEntry, Order } from "@/types";
import { IconFlask } from "@/components/icons/IconFlask";

export default function RekonsiliasiPage() {
  return (
    <Suspense fallback={<div className="text-center font-mono py-8 text-xs text-ink-soft">Memuat data...</div>}>
      <RekonsiliasiContent />
    </Suspense>
  );
}

function RekonsiliasiContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightProdId = searchParams.get("product_id");

  const [activeTab, setActiveTab] = useState<"opname" | "harian">("opname");
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [opnameSessions, setOpnameSessions] = useState<OpnameSession[]>([]);
  
  // Opname state
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [opnameDiscrepancies, setOpnameDiscrepancies] = useState<OpnameItem[]>([]);
  
  // Drill-down state
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [expandedLedger, setExpandedLedger] = useState<LedgerEntry[]>([]);

  // Daily Check state
  const [harianDiscrepancies, setHarianDiscrepancies] = useState<{
    orderCode: string;
    channel: string;
    sku: string;
    orderQty: number;
    ledgerQty: number;
    diff: number;
    productId: string;
    batchId: string;
  }[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: prods } = await supabase.from("products").select("*");
    const { data: bts } = await supabase.from("batches").select("*");
    
    if (prods) setProducts(prods);
    if (bts) setBatches(bts);
    
    const { data: sessions } = await supabase.from("opname_sessions").select("*").eq("status", "completed");
    if (sessions) {
      setOpnameSessions(sessions as OpnameSession[]);
      if (sessions.length > 0) {
        setSelectedSessionId(sessions[0].id);
      }
    }

    await calculateDailyDiscrepancies(prods || [], bts || []);
  };

  useEffect(() => {
    if (selectedSessionId) {
      supabase
        .from("opname_items")
        .select("*")
        .eq("session_id", selectedSessionId)
        .then(({ data }) => {
          if (data) {
            const diffs = data.filter((item) => item.physical_qty !== item.system_qty);
            setOpnameDiscrepancies(diffs);
          }
        });
    } else {
      setOpnameDiscrepancies([]);
    }
    setExpandedItem(null);
    setExpandedLedger([]);
  }, [selectedSessionId]);

  // Set initial highlights / tab from query params if present
  useEffect(() => {
    if (highlightProdId && products.length > 0) {
      // Find if we have it in harian or opname
      const hasHarian = harianDiscrepancies.some(d => d.productId === highlightProdId);
      if (hasHarian) {
        setActiveTab("harian");
        const found = harianDiscrepancies.find(d => d.productId === highlightProdId);
        if (found) {
          handleExpandItem(found.productId, found.batchId, found.orderCode);
        }
      } else if (opnameDiscrepancies.some(d => d.product_id === highlightProdId)) {
        setActiveTab("opname");
        const found = opnameDiscrepancies.find(d => d.product_id === highlightProdId);
        if (found) {
          handleExpandItem(found.product_id, found.batch_id, `${found.product_id}_${found.batch_id}`);
        }
      }
    }
  }, [highlightProdId, products, harianDiscrepancies, opnameDiscrepancies]);

  const calculateDailyDiscrepancies = async (allProducts: Product[], allBatches: Batch[]) => {
    const [ordersResult, ledgerResult, bundlesResult, compsResult] = await Promise.all([
      supabase.from("orders").select("*").neq("status", "PENDING").neq("status", "CANCELLED").order("created_at", { ascending: false }).limit(100),
      supabase.from("stock_ledger").select("*").lt("qty", 0).order("created_at", { ascending: false }).limit(500),
      supabase.from("bundles").select("*"),
      supabase.from("bundle_components").select("*"),
    ]);

    const allOrders = ordersResult.data || [];
    const allLedger = ledgerResult.data || [];
    const allBundles = bundlesResult.data || [];
    const allBundleComponents = compsResult.data || [];

    const diffs: typeof harianDiscrepancies = [];

    allOrders.forEach((order) => {
      let components: { product_id: string; qty: number }[] = [];
      const bundle = allBundles.find((b) => b.sku.toUpperCase() === order.sku.toUpperCase());
      
      if (bundle) {
        components = allBundleComponents
          .filter((bc) => bc.bundle_id === bundle.id)
          .map((c) => ({ product_id: c.product_id, qty: c.qty }));
      } else {
        const prod = allProducts.find((p) => p.sku.toUpperCase() === order.sku.toUpperCase());
        if (prod) {
          components = [{ product_id: prod.id, qty: 1 }];
        }
      }

      components.forEach((comp) => {
        const expectedDeduction = comp.qty * order.qty;
        
        const ledgerEntries = allLedger.filter(
          (e) => e.reference_id === order.order_code && e.product_id === comp.product_id
        );
        const actualDeduction = Math.abs(ledgerEntries.reduce((sum, e) => sum + e.qty, 0));

        if (expectedDeduction !== actualDeduction) {
          const batchId = ledgerEntries[0]?.batch_id || "";
          diffs.push({
            orderCode: order.order_code,
            channel: order.channel,
            sku: order.sku,
            orderQty: expectedDeduction,
            ledgerQty: actualDeduction,
            diff: expectedDeduction - actualDeduction,
            productId: comp.product_id,
            batchId,
          });
        }
      });
    });

    setHarianDiscrepancies(diffs);
  };

  const handleExpandItem = async (productId: string, batchId: string, itemKey: string) => {
    if (expandedItem === itemKey) {
      setExpandedItem(null);
      setExpandedLedger([]);
    } else {
      let cutoffTime = new Date().toISOString();
      if (activeTab === "opname" && selectedSessionId) {
        const activeSess = opnameSessions.find((s) => s.id === selectedSessionId);
        if (activeSess?.completed_at) {
          cutoffTime = activeSess.completed_at;
        }
      }

      // Query from Supabase Ledger up to cutoff
      const { data: history } = await supabase
        .from("stock_ledger")
        .select("*")
        .eq("product_id", productId)
        .lte("created_at", cutoffTime)
        .order("created_at", { ascending: false });

      if (history) {
        const filteredHistory = batchId ? history.filter((e) => e.batch_id === batchId) : history;
        setExpandedItem(itemKey);
        setExpandedLedger(filteredHistory);
      }
    }
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

  const handleExportOpnameSelisih = async () => {
    const now = new Date();
    const today = now.toISOString().split("T")[0];

    const columns: ExportColumn[] = [
      { header: "Produk", key: "produk", width: 35 },
      { header: "Kode Batch", key: "batch", width: 18 },
      { header: "Stok Sistem", key: "sistem", width: 14 },
      { header: "Hitung Fisik", key: "fisik", width: 14 },
      { header: "Selisih", key: "selisih", width: 12 },
    ];

    const rows = opnameDiscrepancies.map((item) => {
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

    const sheet: ExportSheet = {
      name: "Selisih Opname",
      columns,
      rows,
      summaryRows: [
        { label: "Total Selisih", value: `${opnameDiscrepancies.length} batch` },
        { label: "Diekspor Pada", value: now.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) },
      ],
    };

    await exportToXlsx({
      title: "Rekonsiliasi Opname StokLedger",
      fileName: `StokLedger_Rekonsiliasi_Opname_${today}`,
      sheets: [sheet],
    });
  };

  const handleExportHarianSelisih = async () => {
    const now = new Date();
    const today = now.toISOString().split("T")[0];

    const columns: ExportColumn[] = [
      { header: "Nomor Order", key: "order", width: 20 },
      { header: "Marketplace", key: "channel", width: 14 },
      { header: "Produk", key: "produk", width: 35 },
      { header: "Dibutuhkan", key: "orderQty", width: 14 },
      { header: "Tercatat Ledger", key: "ledgerQty", width: 16 },
      { header: "Selisih", key: "selisih", width: 12 },
    ];

    const rows = harianDiscrepancies.map((item) => {
      const prod = products.find((p) => p.id === item.productId);
      return {
        order: item.orderCode,
        channel: item.channel === "shopee" ? "Shopee" : "TikTok",
        produk: prod?.name || item.sku,
        orderQty: item.orderQty.toString(),
        ledgerQty: item.ledgerQty.toString(),
        selisih: `-${item.diff}`,
      };
    });

    const sheet: ExportSheet = {
      name: "Selisih Harian",
      columns,
      rows,
      summaryRows: [
        { label: "Total Selisih", value: `${harianDiscrepancies.length} order` },
        { label: "Diekspor Pada", value: now.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) },
      ],
    };

    await exportToXlsx({
      title: "Rekonsiliasi Harian StokLedger",
      fileName: `StokLedger_Rekonsiliasi_Harian_${today}`,
      sheets: [sheet],
    });
  };

  return (
    <div className="space-y-6">
      {/* Simulation Banner */}
      <div className="bg-warning-bg border border-warning/30 rounded p-3 text-warning font-semibold text-xs flex items-center gap-2">
        <IconFlask className="w-4 h-4 text-warning shrink-0" />
        <span>MODE SIMULASI — Fitur rekonsiliasi berjalan dalam mode simulasi, belum terintegrasi API marketplace resmi</span>
      </div>

      <div className="flex border-b border-border">
        <button
          onClick={() => {
            setActiveTab("opname");
            setExpandedItem(null);
          }}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "opname"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-ink-soft hover:text-ink"
          }`}
        >
          Selisih Hasil Opname
        </button>
        <button
          onClick={() => {
            setActiveTab("harian");
            setExpandedItem(null);
          }}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "harian"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-ink-soft hover:text-ink"
          }`}
        >
          Cek Harian (Marketplace vs Ledger)
        </button>
      </div>

      {activeTab === "opname" && (
        <div className="space-y-4">
          <div className="w-72">
            <Select
              label="Pilih Sesi Opname Selesai"
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              options={[
                { value: "", label: "-- Pilih Sesi --" },
                ...opnameSessions.map((s) => ({
                  value: s.id,
                  label: `${s.id.slice(-6)} (${new Date(s.completed_at || "").toLocaleDateString("id-ID")})`,
                })),
              ]}
            />
          </div>

          <SectionCard title="Selisih Catatan vs Fisik Gudang" action={
            opnameDiscrepancies.length > 0 ? (
              <Button variant="ghost" className="text-[10px] px-2 py-1" onClick={() => handleExportOpnameSelisih()}>
                Ekspor Excel
              </Button>
            ) : null
          }>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border text-xs font-semibold text-ink-soft uppercase bg-bg/50">
                    <th className="py-2.5 px-3">Produk</th>
                    <th className="py-2.5 px-3">Kode Batch</th>
                    <th className="py-2.5 px-3 text-right">Stok Sistem</th>
                    <th className="py-2.5 px-3 text-right">Hitung Fisik</th>
                    <th className="py-2.5 px-3 text-right">Selisih</th>
                    <th className="py-2.5 px-3 text-center">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs font-mono">
                  {opnameDiscrepancies.map((item) => {
                    const prod = products.find((p) => p.id === item.product_id);
                    const batch = batches.find((b) => b.id === item.batch_id);
                    const diff = item.physical_qty - item.system_qty;
                    const itemKey = `${item.product_id}_${item.batch_id}`;
                    const isExpanded = expandedItem === itemKey;

                    return (
                      <React.Fragment key={itemKey}>
                        <tr className={`hover:bg-bg/10 transition-colors ${isExpanded ? "bg-primary-light/10" : ""} ${highlightProdId === item.product_id ? "bg-warning-bg/25 border-l-4 border-l-warning" : ""}`}>
                          <td className="py-2.5 px-3 font-body font-semibold text-ink">{prod?.name}</td>
                          <td className="py-2.5 px-3 font-semibold text-primary">{batch?.batch_code}</td>
                          <td className="py-2.5 px-3 text-right">{item.system_qty}</td>
                          <td className="py-2.5 px-3 text-right">{item.physical_qty}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-danger">
                            {diff > 0 ? `+${diff}` : diff}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              onClick={() => handleExpandItem(item.product_id, item.batch_id, itemKey)}
                              className="text-[10px] font-semibold text-primary border border-primary px-2 py-0.5 rounded hover:bg-primary hover:text-white transition"
                            >
                              {isExpanded ? "Tutup Audit" : "Audit Alur Stok"}
                            </button>
                          </td>
                        </tr>
                        
                        {isExpanded && (
                          <tr>
                            <td colSpan={6} className="bg-[#FAF9F6] p-4 border-t border-b border-border-strong">
                              <div className="space-y-3">
                                <h4 className="font-heading text-xs font-bold text-ink-soft uppercase tracking-wider">
                                  Audit Trail Buku Besar (Hanya Transaksi Sebelum Opname Selesai) - {prod?.name} ({batch?.batch_code})
                                </h4>
                                <div className="border border-border rounded-md overflow-hidden bg-white max-h-60 overflow-y-auto">
                                  <table className="w-full text-left border-collapse text-[11px]">
                                    <thead>
                                      <tr className="bg-bg border-b border-border text-ink-soft font-bold">
                                        <th className="p-2">Waktu</th>
                                        <th className="p-2">Alasan</th>
                                        <th className="p-2">Channel</th>
                                        <th className="p-2">Referensi</th>
                                        <th className="p-2 text-right">Qty</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-dashed divide-border">
                                      {expandedLedger.map((le) => (
                                        <tr key={le.id}>
                                          <td className="p-2">
                                            {new Date(le.created_at).toLocaleDateString("id-ID", {
                                              day: "2-digit",
                                              month: "short",
                                              hour: "2-digit",
                                              minute: "2-digit"
                                            })}
                                          </td>
                                          <td className="p-2">{getReasonLabel(le.reason)}</td>
                                          <td className="p-2 capitalize">{le.channel}</td>
                                          <td className="p-2 text-ink-faint">{le.reference_id}</td>
                                          <td className={`p-2 text-right font-bold ${le.qty > 0 ? "text-success" : "text-danger"}`}>
                                            {le.qty > 0 ? `+${le.qty}` : le.qty}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {opnameDiscrepancies.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-ink-faint font-body">
                        Tidak ada selisih stok ditemukan pada sesi opname ini (Cocok 100%).
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      )}

      {activeTab === "harian" && (
        <SectionCard title="Selisih Marketplace Order vs Pengeluaran Buku Besar" action={
          harianDiscrepancies.length > 0 ? (
            <Button variant="ghost" className="text-[10px] px-2 py-1" onClick={() => handleExportHarianSelisih()}>
              Ekspor Excel
            </Button>
          ) : null
        }>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-xs font-semibold text-ink-soft uppercase bg-bg/50">
                  <th className="py-2.5 px-3">Nomor Order</th>
                  <th className="py-2.5 px-3">Marketplace</th>
                  <th className="py-2.5 px-3">Produk</th>
                  <th className="py-2.5 px-3 text-right">Dibutuhkan Order</th>
                  <th className="py-2.5 px-3 text-right">Tercatat Ledger</th>
                  <th className="py-2.5 px-3 text-right">Selisih</th>
                  <th className="py-2.5 px-3 text-center">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs font-mono">
                {harianDiscrepancies.map((item) => {
                  const prod = products.find((p) => p.id === item.productId);
                  const isExpanded = expandedItem === item.orderCode;

                  return (
                    <React.Fragment key={item.orderCode}>
                      <tr className={`hover:bg-bg/10 transition-colors ${isExpanded ? "bg-primary-light/10" : ""} ${highlightProdId === item.productId ? "bg-warning-bg/25 border-l-4 border-l-warning" : ""}`}>
                        <td className="py-2.5 px-3 font-bold text-ink">{item.orderCode}</td>
                        <td className="py-2.5 px-3 capitalize">
                          {item.channel === "shopee" ? (
                            <Tag variant="warning">SHOPEE</Tag>
                          ) : (
                            <Tag variant="primary">TIKTOK</Tag>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-body font-semibold">{prod?.name || item.sku}</td>
                        <td className="py-2.5 px-3 text-right">{item.orderQty}</td>
                        <td className="py-2.5 px-3 text-right">{item.ledgerQty}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-danger">
                          -{item.diff}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => handleExpandItem(item.productId, item.batchId, item.orderCode)}
                            className="text-[10px] font-semibold text-primary border border-primary px-2 py-0.5 rounded hover:bg-primary hover:text-white transition"
                          >
                            {isExpanded ? "Tutup Audit" : "Audit Alur Stok"}
                          </button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr>
                          <td colSpan={7} className="bg-[#FAF9F6] p-4 border-t border-b border-border-strong">
                            <div className="space-y-3">
                              <h4 className="font-heading text-xs font-bold text-ink-soft uppercase tracking-wider">
                                Audit Trail Buku Besar - {prod?.name} ({item.orderCode})
                              </h4>
                              <div className="border border-border rounded-md overflow-hidden bg-white max-h-60 overflow-y-auto">
                                <table className="w-full text-left border-collapse text-[11px]">
                                  <thead>
                                    <tr className="bg-bg border-b border-border text-ink-soft font-bold">
                                      <th className="p-2">Waktu</th>
                                      <th className="p-2">Alasan</th>
                                      <th className="p-2">Channel</th>
                                      <th className="p-2">Referensi</th>
                                      <th className="p-2 text-right">Qty</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-dashed divide-border">
                                    {expandedLedger.map((le) => (
                                      <tr key={le.id}>
                                        <td className="p-2">
                                          {new Date(le.created_at).toLocaleDateString("id-ID", {
                                            day: "2-digit",
                                            month: "short",
                                            hour: "2-digit",
                                            minute: "2-digit"
                                          })}
                                        </td>
                                        <td className="p-2">{getReasonLabel(le.reason)}</td>
                                        <td className="p-2 capitalize">{le.channel}</td>
                                        <td className="p-2 text-ink-faint">{le.reference_id}</td>
                                        <td className={`p-2 text-right font-bold ${le.qty > 0 ? "text-success" : "text-danger"}`}>
                                          {le.qty > 0 ? `+${le.qty}` : le.qty}
                                        </td>
                                      </tr>
                                    ))}
                                    {expandedLedger.length === 0 && (
                                      <tr>
                                        <td colSpan={5} className="p-4 text-center text-ink-faint">
                                          Tidak ada entri ledger terdaftar untuk referensi ini.
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {harianDiscrepancies.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-xs text-ink-faint font-body">
                      Tidak ada selisih harian (Catatan Buku Besar klop 100% dengan Marketplace Order).
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
