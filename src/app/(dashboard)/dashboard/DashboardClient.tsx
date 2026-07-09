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
  const totalStock = serverLedger.reduce((sum, e) => sum + e.qty, 0);
  const [expiryWarningsCount, setExpiryWarningsCount] = useState(0);
  const [tiktokClaimsCount, setTiktokClaimsCount] = useState(0);
  const [recentEntries] = useState(serverLedger.slice(0, 5));
  const [products] = useState<Product[]>(serverProducts);
  const [batches] = useState<Batch[]>(serverBatches);
  const [anomalies, setAnomalies] = useState<any[]>([]);

  useEffect(() => {
    // Expiry warnings (expiry date within 30 days)
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    let warningCount = 0;
    serverBatches.forEach((b: any) => {
      const expDate = new Date(b.expiry_date);
      if (expDate <= thirtyDaysFromNow && expDate >= today) {
        const batchStock = serverLedger
          .filter((e: any) => e.product_id === b.product_id && e.batch_id === b.id)
          .reduce((sum: number, e: any) => sum + e.qty, 0);
        if (batchStock > 0) warningCount++;
      }
    });
    setExpiryWarningsCount(warningCount);

    // TikTok claims
    const pendingTiktokClaims = serverReturns.filter((r: any) => {
      if (r.channel !== "tiktok" || r.status !== "PENDING" || !r.received_at) return false;
      const receivedDate = new Date(r.received_at);
      const elapsedDays = (Date.now() - receivedDate.getTime()) / (1000 * 60 * 60 * 24);
      return elapsedDays <= 40;
    });
    setTiktokClaimsCount(pendingTiktokClaims.length);

    // Calculate anomalies
    const list: any[] = [];

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
            list.push({
              productId: prod.id,
              productName: prod.name,
              diff: expectedDeduction - actualDeduction,
              type: "harian",
              desc: `Selisih harian di order ${order.order_code}`,
            });
          }
        }
      });
    });

    if (serverLastOpnameSession) {
      supabase
        .from("opname_items")
        .select("*")
        .eq("session_id", serverLastOpnameSession.id)
        .then(({ data }) => {
          if (data) {
            data.forEach((item: any) => {
              if (item.physical_qty !== item.system_qty) {
                const prod = serverProducts.find((p: any) => p.id === item.product_id);
                if (prod) {
                  list.push({
                    productId: prod.id,
                    productName: prod.name,
                    diff: item.physical_qty - item.system_qty,
                    type: "opname",
                    desc: `Ditemukan saat opname ${new Date(serverLastOpnameSession.completed_at || "").toLocaleDateString("id-ID")}`,
                  });
                }
              }
            });
          }
          setAnomalies([...list]);
        });
    } else {
      setAnomalies(list);
    }
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
            <span className="text-xs text-ink-soft font-semibold uppercase">Total Produk</span>
            <div className="text-2xl font-bold font-mono text-ink mt-1">{totalProducts}</div>
          </div>
          <div className="text-[11px] text-ink-faint mt-4">Produk aktif dalam katalog</div>
        </SectionCard>

        <SectionCard className="flex flex-col justify-between">
          <div>
            <span className="text-xs text-ink-soft font-semibold uppercase">Total Stok Fisik</span>
            <div className="text-2xl font-bold font-mono text-primary mt-1">
              {totalStock.toLocaleString("id-ID")}
            </div>
          </div>
          <div className="text-[11px] text-ink-faint mt-4">Total kuantitas barang di gudang</div>
        </SectionCard>

        <SectionCard className="flex flex-col justify-between">
          <div>
            <span className="text-xs text-ink-soft font-semibold uppercase">Near Expiry Batch</span>
            <div className="text-2xl font-bold font-mono text-warning mt-1">{expiryWarningsCount}</div>
          </div>
          <div className="text-[11px] text-ink-faint mt-4">Batch aktif kedaluwarsa &lt; 30 hari</div>
        </SectionCard>

        <SectionCard className="flex flex-col justify-between">
          <div>
            <span className="text-xs text-ink-soft font-semibold uppercase">Klaim Retur TikTok</span>
            <div className="text-2xl font-bold font-mono text-danger mt-1">{tiktokClaimsCount}</div>
          </div>
          <div className="text-[11px] text-ink-faint mt-4">Pending klaim batas &lt; 40 hari</div>
        </SectionCard>
      </div>

      {/* Anomalies Widget */}
      <SectionCard title="Anomali & Selisih Stok — Perlu Ditelusuri">
        {anomalies.length === 0 ? (
          <div className="p-4 text-center text-xs text-ink-faint font-mono">
            Tidak ada selisih stok atau anomali yang terdeteksi.
          </div>
        ) : (
          <div className="divide-y divide-border text-xs">
            {anomalies.map((a, i) => (
              <div key={i} className="py-2.5 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-danger font-bold font-mono">⚠️</span>
                  <span className="font-semibold text-ink">{a.productName}</span>
                  <span className="font-mono text-danger font-bold px-1.5 py-0.5 rounded bg-danger-bg text-[10px]">
                    {a.diff > 0 ? `+${a.diff}` : a.diff} unit
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-ink-faint font-mono text-[10px]">{a.desc}</span>
                  <Button
                    variant="ghost"
                    className="px-2 py-0.5 text-[10px]"
                    onClick={() => router.push(`/rekonsiliasi?product_id=${a.productId}`)}
                  >
                    Telusuri &rarr;
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <SectionCard title="Aktivitas Buku Besar Terbaru" action={<Link href="/ledger" className="text-xs font-semibold text-primary hover:underline">Lihat Semua &rarr;</Link>}>
            <div className="border border-border rounded-md overflow-hidden bg-[#FAFAF9]">
              <div className="px-4 py-3 bg-white border-b border-border flex justify-between text-xs font-bold text-ink-soft">
                <span>DETAIL TRANSAKSI</span>
                <span className="text-right">JUMLAH (QTY)</span>
              </div>
              <div className="divide-y divide-dashed divide-border-strong">
                {recentEntries.length === 0 ? (
                  <div className="p-8 text-center text-xs text-ink-faint font-mono">
                    Belum ada transaksi stok tercatat.
                  </div>
                ) : (
                  recentEntries.map((e) => {
                    const prod = products.find((p) => p.id === e.product_id);
                    const batch = batches.find((b) => b.id === e.batch_id);
                    const isPositive = e.qty > 0;

                    return (
                      <div key={e.id} className="p-4 hover:bg-white transition-colors duration-100 flex justify-between items-center gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-semibold ${isPositive ? "text-success" : "text-danger"}`}>
                              {isPositive ? "▲" : "▼"}
                            </span>
                            <span className="text-xs font-bold text-ink font-heading">{prod?.name || "Produk Tidak Dikenal"}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-soft">
                            <span className="font-mono bg-primary-light px-1.5 py-0.5 rounded text-primary-dark">
                              Batch: {batch?.batch_code || e.batch_id}
                            </span>
                            <span>&bull;</span>
                            <span>{getReasonLabel(e.reason)}</span>
                            <span>&bull;</span>
                            {getChannelTag(e.channel)}
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

        <div className="space-y-4">
          <SectionCard title="Navigasi Cepat">
            <div className="space-y-2">
              <Link
                href="/masuk"
                className="flex items-center justify-between p-3 rounded border border-border hover:border-primary hover:bg-primary-light/10 text-xs font-semibold text-ink-soft hover:text-ink transition"
              >
                <span>Penerimaan Barang Masuk (Maklon)</span>
                <span>&rarr;</span>
              </Link>
              <Link
                href="/manual"
                className="flex items-center justify-between p-3 rounded border border-border hover:border-primary hover:bg-primary-light/10 text-xs font-semibold text-ink-soft hover:text-ink transition"
              >
                <span>Pencatatan Keluar Manual</span>
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
                href="/opname"
                className="flex items-center justify-between p-3 rounded border border-border hover:border-primary hover:bg-primary-light/10 text-xs font-semibold text-ink-soft hover:text-ink transition"
              >
                <span>Stok Opname Gudang</span>
                <span>&rarr;</span>
              </Link>
            </div>
          </SectionCard>

          <SectionCard title="Prinsip Buku Besar">
            <div className="text-xs text-ink-soft space-y-3 leading-relaxed">
              <p>
                <strong>1. Append-Only:</strong> Riwayat transaksi tidak dapat diubah atau dihapus. Jika ada kesalahan, masukkan baris penyesuaian baru.
              </p>
              <p>
                <strong>2. FEFO Otomatis:</strong> Kuantitas barang keluar otomatis dipotong dari batch terdekat kedaluwarsa.
              </p>
              <p>
                <strong>3. Rekonsiliasi Selisih:</strong> Selisih antara saldo fisik dan sistem dikoreksi lewat opname yang menghasilkan data ledger baru.
              </p>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
