"use client";

import React, { useEffect, useState } from "react";
import { SectionCard, Tag, Button } from "@/components/ui";
import { supabase } from "@/lib/supabase/client";
import { getReasonLabel } from "@/lib/labels";
import type { LedgerEntry, Product, Batch } from "@/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertCircle, Calendar, ClipboardCheck, Layers, ArrowUpRight, TrendingUp } from "lucide-react";

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
    // Expiry warnings (expiry date within configured threshold)
    const thresholdDays = parseInt(localStorage.getItem("stokledger_expiry_threshold") || "30");
    const today = new Date();
    const expiryTargetDate = new Date();
    expiryTargetDate.setDate(today.getDate() + thresholdDays);

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
        if (diffDays <= thresholdDays) {
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

  const getChannelTag = (channel: string) => {
    switch (channel) {
      case "shopee": return <Tag variant="warning">SHOPEE</Tag>;
      case "tiktok": return <Tag variant="primary">TIKTOK</Tag>;
      case "manual": return <Tag variant="neutral">MANUAL</Tag>;
      default: return <Tag variant="neutral">SYSTEM</Tag>;
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } as any }
  };

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        <motion.div variants={itemVariants}>
          <SectionCard className="flex flex-col justify-between h-full hover:translate-y-[-2px] hover:shadow-md transition-all duration-300">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs text-ink-soft font-semibold uppercase tracking-wider">Total SKU Aktif</span>
                <div className="text-3xl font-extrabold font-mono text-ink mt-2">{totalProducts}</div>
              </div>
              <div className="p-2 bg-primary/10 rounded-sm text-primary">
                <Layers className="w-5 h-5" />
              </div>
            </div>
            <div className="text-[11px] text-ink-faint mt-4 border-t border-border/40 pt-2 font-mono">Katalog produk aktif</div>
          </SectionCard>
        </motion.div>

        <motion.div variants={itemVariants}>
          <SectionCard className="flex flex-col justify-between h-full hover:translate-y-[-2px] hover:shadow-md transition-all duration-300">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs text-ink-soft font-semibold uppercase tracking-wider">Batch Mendekati Exp.</span>
                <div className="text-3xl font-extrabold font-mono text-warning mt-2">{expiryWarningsCount}</div>
              </div>
              <div className="p-2 bg-warning/10 rounded-sm text-warning">
                <Calendar className="w-5 h-5" />
              </div>
            </div>
            <div className="text-[11px] text-ink-faint mt-4 border-t border-border/40 pt-2 font-mono">Expired &le; 30 hari &amp; stok &gt; 0</div>
          </SectionCard>
        </motion.div>

        <motion.div variants={itemVariants}>
          <SectionCard className="flex flex-col justify-between h-full hover:translate-y-[-2px] hover:shadow-md transition-all duration-300">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs text-ink-soft font-semibold uppercase tracking-wider">Retur Menunggu Inspeksi</span>
                <div className="text-3xl font-extrabold font-mono text-primary mt-2">
                  {returnsMenungguInspeksiCount}
                </div>
              </div>
              <div className="p-2 bg-primary/10 rounded-sm text-primary">
                <ClipboardCheck className="w-5 h-5" />
              </div>
            </div>
            <div className="text-[11px] text-ink-faint mt-4 border-t border-border/40 pt-2 font-mono">Retur yang belum diperiksa</div>
          </SectionCard>
        </motion.div>

        <motion.div variants={itemVariants}>
          <SectionCard className="flex flex-col justify-between h-full hover:translate-y-[-2px] hover:shadow-md transition-all duration-300">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs text-ink-soft font-semibold uppercase tracking-wider">Anomali Terbuka</span>
                <div className="text-3xl font-extrabold font-mono text-danger mt-2">{worklist.length}</div>
              </div>
              <div className="p-2 bg-danger/10 rounded-sm text-danger animate-pulse-slow">
                <AlertCircle className="w-5 h-5" />
              </div>
            </div>
            <div className="text-[11px] text-ink-faint mt-4 border-t border-border/40 pt-2 font-mono">Total anomali &amp; task kritis</div>
          </SectionCard>
        </motion.div>
      </motion.div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Worklist Anomali Harian */}
        <div className="lg:col-span-2 space-y-4">
          <SectionCard title="Tugas Hari Ini (Worklist Anomali Harian)">
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="divide-y divide-border/60 text-xs"
            >
              {worklist.length === 0 ? (
                <div className="p-12 text-center text-ink-faint font-mono bg-bg/25 rounded-md border border-dashed border-border/60">
                  Semua aman! Tidak ada anomali atau tugas mendesak hari ini.
                </div>
              ) : (
                worklist.map((item) => (
                  <motion.div 
                    variants={itemVariants}
                    key={item.id} 
                    className="py-4.5 flex justify-between items-center hover:bg-bg/20 transition-all duration-200 px-2 rounded-sm"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Status Dot */}
                      <span className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 shadow-sm ${
                        item.severity === "danger" ? "bg-danger animate-pulse-slow" : item.severity === "warning" ? "bg-warning" : "bg-success"
                      }`} />
                      <div className="min-w-0">
                        <div className="font-bold text-ink flex items-center gap-2 flex-wrap">
                          <span>{item.title}</span>
                          {item.severity === "danger" && (
                            <span className="px-2 py-0.5 rounded-full bg-danger-bg text-danger text-[8px] font-extrabold uppercase tracking-wider font-mono border border-danger/10">
                              kritis
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-ink-soft mt-1 font-mono leading-relaxed">{item.subtitle}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      className="px-3.5 py-1 min-h-[36px] min-w-[70px] text-[10px] shrink-0 font-bold hover:-translate-x-[2px] transition-transform"
                      onClick={() => router.push(item.link)}
                    >
                      Telusuri <ArrowUpRight className="w-3.5 h-3.5 ml-0.5 inline" />
                    </Button>
                  </motion.div>
                ))
              )}
            </motion.div>
          </SectionCard>
        </div>

        {/* Right Column: Pergerakan Terbaru & Navigasi Cepat */}
        <div className="space-y-4">
          <SectionCard title="Pergerakan Terbaru">
            <div className="divide-y divide-dashed divide-border/65 text-xs">
              {recentEntries.length === 0 ? (
                <div className="py-8 text-center text-ink-faint font-mono bg-bg/25 rounded border border-dashed border-border/50">
                  Belum ada catatan pergerakan.
                </div>
              ) : (
                recentEntries.map((e) => {
                  const prod = products.find((p) => p.id === e.product_id);
                  const batch = batches.find((b) => b.id === e.batch_id);
                  const isPositive = e.qty > 0;

                  return (
                    <div key={e.id} className="py-3.5 flex justify-between items-start gap-2 hover:bg-bg/10 px-1 transition-colors rounded-sm">
                      <div className="min-w-0">
                        <span className="font-bold text-ink block truncate">{prod?.name || "Produk dihapus"}</span>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-ink-soft mt-1">
                          <Tag variant={isPositive ? "success" : "neutral"} className="px-1.5 py-0">{getReasonLabel(e.reason)}</Tag>
                          <span className="font-mono text-ink-faint text-[9px] border-l border-border pl-2">Batch: {batch?.batch_code || e.batch_id}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`font-mono font-bold text-sm ${isPositive ? "text-success" : "text-danger"}`}>
                          {isPositive ? `+${e.qty}` : e.qty}
                        </span>
                        <span className="text-[9px] text-ink-faint block font-mono mt-0.5">
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
                className="flex items-center justify-between p-3.5 rounded border border-border/80 hover:border-primary hover:bg-primary-light/40 text-xs font-bold text-ink-soft hover:text-ink transition-all duration-200 hover:translate-x-[2px]"
              >
                <span className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Pencatatan Masuk &amp; Keluar Manual
                </span>
                <span>&rarr;</span>
              </Link>
              <Link
                href="/pesanan"
                className="flex items-center justify-between p-3.5 rounded border border-border/80 hover:border-primary hover:bg-primary-light/40 text-xs font-bold text-ink-soft hover:text-ink transition-all duration-200 hover:translate-x-[2px]"
              >
                <span className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary" />
                  Simulasi Marketplace
                </span>
                <span>&rarr;</span>
              </Link>
              <Link
                href="/retur"
                className="flex items-center justify-between p-3.5 rounded border border-border/80 hover:border-primary hover:bg-primary-light/40 text-xs font-bold text-ink-soft hover:text-ink transition-all duration-200 hover:translate-x-[2px]"
              >
                <span className="flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-primary" />
                  Inspeksi Retur Barang
                </span>
                <span>&rarr;</span>
              </Link>
              <Link
                href="/opname"
                className="flex items-center justify-between p-3.5 rounded border border-border/80 hover:border-primary hover:bg-primary-light/40 text-xs font-bold text-ink-soft hover:text-ink transition-all duration-200 hover:translate-x-[2px]"
              >
                <span className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  Stok Opname Gudang
                </span>
                <span>&rarr;</span>
              </Link>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
