"use client";

import React, { useEffect, useState } from "react";
import { SectionCard, Tag, Button } from "@/components/ui";
import { supabase } from "@/lib/supabase/client";
import type { LedgerEntry, Product, Batch } from "@/types";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface DashboardClientProps {
  serverProducts: any[];
  serverBatches: any[];
  serverLedger: LedgerEntry[];
  serverReturns: any[];
  serverOrders: any[];
  serverBundles: any[];
  serverBundleComponents: any[];
  serverLastOpnameSession: any;
}

export function DashboardClient({
  serverProducts,
  serverBatches,
  serverLedger,
  serverReturns,
  serverOrders,
  serverBundles,
  serverBundleComponents,
  serverLastOpnameSession,
}: DashboardClientProps) {
  const router = useRouter();
  const [totalProducts] = useState(serverProducts.length);
  const [expiryWarningsCount, setExpiryWarningsCount] = useState(0);
  const [returnsMenungguInspeksiCount] = useState(serverReturns.filter((r: any) => r.condition === null).length);
  const [recentEntries] = useState(serverLedger.slice(0, 8));
  const [products] = useState<Product[]>(serverProducts);
  const [batches] = useState<Batch[]>(serverBatches);
  const [worklist, setWorklist] = useState<any[]>([]);

  useEffect(() => {
    // Expiry warnings (expiry date within 30 days)
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    let warningCount = 0;
    const activeExpiryList: any[] = [];
    serverBatches.forEach((b: any) => {
      const expDate = new Date(b.expiry_date);
      const diffTime = expDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      const batchStock = serverLedger
        .filter((e: any) => e.product_id === b.product_id && e.batch_id === b.id)
        .reduce((sum: number, e: any) => sum + e.qty, 0);

      if (batchStock > 0) {
        if (diffDays <= 30) {
          warningCount++;
          activeExpiryList.push({
            batchCode: b.batch_code,
            productName: serverProducts.find((p: any) => p.id === b.product_id)?.name || "Produk",
            stock: batchStock,
            remainingDays: diffDays,
          });
        }
      }
    });
    setExpiryWarningsCount(warningCount);

    // Calculate anomalies
    const discrepanciesList: any[] = [];
    serverOrders.forEach((order: any) => {
      if (order.status === "PENDING" || order.status === "CANCELLED") return;

      let components: { product_id: string; qty: number }[] = [];
      const bundle = serverBundles?.find((b: any) => b.sku.toUpperCase() === order.sku.toUpperCase());
      
      if (bundle && serverBundleComponents) {
        components = serverBundleComponents
          .filter((bc: any) => bc.bundle_id === bundle.id)
          .map((c: any) => ({ product_id: c.product_id, qty: c.qty }));
      } else {
        const prod = serverProducts.find((p: any) => p.sku.toUpperCase() === order.sku.toUpperCase());
        if (prod) components = [{ product_id: prod.id, qty: 1 }];
      }

      components.forEach((comp) => {
        const expectedDeduction = comp.qty * order.qty;
        const ledgerEntries = serverLedger.filter(
          (e: any) => e.reference_id === order.order_code && e.product_id === comp.product_id && e.qty < 0
        );
        const actualDeduction = Math.abs(ledgerEntries.reduce((sum: number, e: any) => sum + e.qty, 0));

        if (expectedDeduction !== actualDeduction) {
          const prod = serverProducts.find((p: any) => p.id === comp.product_id);
          if (prod) {
            discrepanciesList.push({
              productId: prod.id,
              productName: prod.name,
              diff: expectedDeduction - actualDeduction,
              orderCode: order.order_code,
            });
          }
        }
      });
    });

    // Build the Worklist
    const items: any[] = [];

    // 1. TikTok and Shopee Returns
    serverReturns.forEach((r: any) => {
      if (r.condition === null) {
        if (r.channel === "tiktok") {
          const createdDate = new Date(r.created_at);
          const elapsedDays = Math.floor((today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
          const remainingDays = 40 - elapsedDays;
          
          let severity: "danger" | "warning" | "success" = "success";
          if (remainingDays <= 5) severity = "danger";
          else if (remainingDays <= 15) severity = "warning";

          items.push({
            id: `ret-${r.id}`,
            title: `Klaim TikTok ${r.order_code} — ${remainingDays >= 0 ? `${remainingDays} hari lagi` : "lewat batas"}`,
            subtitle: `Retur SKU ${r.sku} (${r.qty} unit) menunggu inspeksi kondisi`,
            severity,
            link: "/retur",
          });
        } else {
          items.push({
            id: `ret-${r.id}`,
            title: `Inspeksi Retur ${r.order_code}`,
            subtitle: `Retur ${r.channel === "shopee" ? "Shopee" : "TikTok"} SKU ${r.sku} (${r.qty} unit) belum diperiksa`,
            severity: "warning",
            link: "/retur",
          });
        }
      }
    });

    // 2. Daily Discrepancies
    discrepanciesList.forEach((d) => {
      items.push({
        id: `disc-${d.orderCode}-${d.productId}`,
        title: `Selisih Harian Order ${d.orderCode}`,
        subtitle: `${d.productName} — selisih ${Math.abs(d.diff)} unit antara ledger dan order`,
        severity: "danger",
        link: `/rekonsiliasi?product_id=${d.productId}`,
      });
    });

    // 3. Expiry Alerts
    activeExpiryList.forEach((e) => {
      let severity: "danger" | "warning" | "success" = "warning";
      if (e.remainingDays <= 7) severity = "danger";

      items.push({
        id: `exp-${e.batchCode}`,
        title: `Batch ${e.batchCode} Expired — ${e.remainingDays >= 0 ? `${e.remainingDays} hari lagi` : "sudah kedaluwarsa"}`,
        subtitle: `${e.productName} — sisa stok ${e.stock} unit`,
        severity,
        link: "/notifikasi",
      });
    });

    // Sort worklist: danger (kritis) first, then warning (perlu perhatian), then success
    items.sort((a, b) => {
      const score = { danger: 3, warning: 2, success: 1 };
      return score[b.severity as keyof typeof score] - score[a.severity as keyof typeof score];
    });

    setWorklist(items);
  }, []);

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

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SectionCard className="flex flex-col justify-between">
          <div>
            <span className="text-xs text-ink-soft font-semibold uppercase">Total SKU Aktif</span>
            <div className="text-2xl font-bold font-mono text-ink mt-1">{totalProducts}</div>
          </div>
          <div className="text-[11px] text-ink-faint mt-4">Katalog produk aktif</div>
        </SectionCard>

        <SectionCard className="flex flex-col justify-between">
          <div>
            <span className="text-xs text-ink-soft font-semibold uppercase">Batch Mendekati Exp.</span>
            <div className="text-2xl font-bold font-mono text-warning mt-1">{expiryWarningsCount}</div>
          </div>
          <div className="text-[11px] text-ink-faint mt-4">Expired &le; 30 hari &amp; stok &gt; 0</div>
        </SectionCard>

        <SectionCard className="flex flex-col justify-between">
          <div>
            <span className="text-xs text-ink-soft font-semibold uppercase">Retur Menunggu Inspeksi</span>
            <div className="text-2xl font-bold font-mono text-primary mt-1">
              {returnsMenungguInspeksiCount}
            </div>
          </div>
          <div className="text-[11px] text-ink-faint mt-4">Retur yang belum diperiksa</div>
        </SectionCard>

        <SectionCard className="flex flex-col justify-between">
          <div>
            <span className="text-xs text-ink-soft font-semibold uppercase">Anomali Terbuka</span>
            <div className="text-2xl font-bold font-mono text-danger mt-1">{worklist.length}</div>
          </div>
          <div className="text-[11px] text-ink-faint mt-4">Total anomali &amp; task kritis</div>
        </SectionCard>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Worklist Anomali Harian */}
        <div className="lg:col-span-2 space-y-4">
          <SectionCard title="Tugas Hari Ini (Worklist Anomali Harian)">
            <div className="divide-y divide-border text-xs">
              {worklist.length === 0 ? (
                <div className="p-8 text-center text-ink-faint font-mono">
                  Semua aman! Tidak ada anomali atau tugas mendesak hari ini.
                </div>
              ) : (
                worklist.map((item) => (
                  <div key={item.id} className="py-3 flex justify-between items-center hover:bg-bg/10 transition-colors px-1">
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Status Dot */}
                      <span className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${
                        item.severity === "danger" ? "bg-danger" : item.severity === "warning" ? "bg-warning" : "bg-success"
                      }`} />
                      <div className="min-w-0">
                        <div className="font-semibold text-ink flex items-center gap-2 flex-wrap">
                          <span>{item.title}</span>
                          {item.severity === "danger" && (
                            <span className="px-1.5 py-0.5 rounded bg-danger-bg text-danger text-[9px] font-bold uppercase tracking-wider font-mono">
                              kritis
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-ink-soft mt-0.5 font-mono">{item.subtitle}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      className="px-3 py-1 text-[10px] shrink-0"
                      onClick={() => router.push(item.link)}
                    >
                      Telusuri &rarr;
                    </Button>
                  </div>
                ))
              )}
            </div>
          </SectionCard>
        </div>

        {/* Right Column: Pergerakan Terbaru & Navigasi Cepat */}
        <div className="space-y-4">
          <SectionCard title="Pergerakan Terbaru">
            <div className="divide-y divide-dashed divide-border-strong text-xs">
              {recentEntries.length === 0 ? (
                <div className="py-4 text-center text-ink-faint font-mono">
                  Belum ada catatan pergerakan.
                </div>
              ) : (
                recentEntries.map((e) => {
                  const prod = products.find((p) => p.id === e.product_id);
                  const batch = batches.find((b) => b.id === e.batch_id);
                  const isPositive = e.qty > 0;

                  return (
                    <div key={e.id} className="py-3 flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <span className="font-semibold text-ink block truncate">{prod?.name || "Produk dihapus"}</span>
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-ink-soft mt-1">
                          <Tag variant="neutral" className="px-1 py-0">{getReasonLabel(e.reason)}</Tag>
                          <span className="font-mono text-ink-faint">Batch: {batch?.batch_code || e.batch_id}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`font-mono font-bold ${isPositive ? "text-success" : "text-danger"}`}>
                          {isPositive ? `+${e.qty}` : e.qty}
                        </span>
                        <span className="text-[9px] text-ink-faint block font-mono">
                          {new Date(e.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </SectionCard>

          <SectionCard title="Navigasi Cepat">
            <div className="space-y-2">
              <Link
                href="/manual"
                className="flex items-center justify-between p-3 rounded border border-border hover:border-primary hover:bg-primary-light/10 text-xs font-semibold text-ink-soft hover:text-ink transition"
              >
                <span>Pencatatan Masuk &amp; Keluar Manual</span>
                <span>&rarr;</span>
              </Link>
              <Link
                href="/pesanan"
                className="flex items-center justify-between p-3 rounded border border-border hover:border-primary hover:bg-primary-light/10 text-xs font-semibold text-ink-soft hover:text-ink transition"
              >
                <span>Simulasi Marketplace</span>
                <span>&rarr;</span>
              </Link>
              <Link
                href="/retur"
                className="flex items-center justify-between p-3 rounded border border-border hover:border-primary hover:bg-primary-light/10 text-xs font-semibold text-ink-soft hover:text-ink transition"
              >
                <span>Inspeksi Retur Barang</span>
                <span>&rarr;</span>
              </Link>
              <Link
                href="/opname"
                className="flex items-center justify-between p-3 rounded border border-border hover:border-primary hover:bg-primary-light/10 text-xs font-semibold text-ink-soft hover:text-ink transition"
              >
                <span>Stok Opname Gudang</span>
                <span>&rarr;</span>
              </Link>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
