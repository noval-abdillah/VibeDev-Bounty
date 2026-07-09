"use client";

import React, { useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";
import { SectionCard, Input, Select, Button, Tag } from "@/components/ui";
import { supabase } from "@/lib/supabase/client";
import type { Order, ReturnItem, Product, Bundle, BundleComponent, OrderStatus } from "@/types";

export const dynamic = "force-dynamic";

export default function PesananReturPage() {
  const { user } = useUser();
  const isReadOnly = user?.role === "owner";

  const [products, setProducts] = useState<Product[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [bundleComponents, setBundleComponents] = useState<BundleComponent[]>([]);
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [returns, setReturns] = useState<ReturnItem[]>([]);

  const [activeTab, setActiveTab] = useState<"orders" | "import" | "returns">("orders");

  // Single Order simulation form state
  const [simChannel, setSimChannel] = useState<"shopee" | "tiktok">("shopee");
  const [simSku, setSimSku] = useState("");
  const [simQty, setSimQty] = useState("1");
  const [orderError, setOrderError] = useState("");
  const [orderSuccess, setOrderSuccess] = useState("");

  // Import form state
  const [csvContent, setCsvContent] = useState("");
  const [returnCsvContent, setReturnCsvContent] = useState("");
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProductsAndBundles();
    loadOrdersAndReturns();
  }, []);

  const fetchProductsAndBundles = async () => {
    const { data: prods } = await supabase.from("products").select("*");
    const { data: bunds } = await supabase.from("bundles").select("*");
    const { data: comps } = await supabase.from("bundle_components").select("*");
    
    if (prods) setProducts(prods);
    if (bunds) setBundles(bunds);
    if (comps) setBundleComponents(comps as any);
  };

  const loadOrdersAndReturns = async () => {
    const { data: ords } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    const { data: rets } = await supabase.from("returns").select("*").order("created_at", { ascending: false });
    
    if (ords) setOrders(ords as Order[]);
    if (rets) setReturns(rets as ReturnItem[]);
  };

  const resolveSkuComponents = (sku: string): { product_id: string; qty: number }[] => {
    const bundle = bundles.find((b) => b.sku.toUpperCase() === sku.toUpperCase());
    if (bundle) {
      const comps = bundleComponents.filter((bc) => bc.bundle_id === bundle.id);
      return comps.map((c) => ({ product_id: c.product_id, qty: c.qty }));
    }

    const prod = products.find((p) => p.sku.toUpperCase() === sku.toUpperCase());
    if (prod) {
      return [{ product_id: prod.id, qty: 1 }];
    }

    return [];
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrderError("");
    setOrderSuccess("");

    if (isReadOnly) {
      setOrderError("Peran Anda hanya memiliki hak baca. Tidak dapat mensimulasikan pesanan.");
      return;
    }

    const qtyNum = parseInt(simQty);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setOrderError("Kuantitas harus berupa angka positif.");
      return;
    }

    const resolved = resolveSkuComponents(simSku);
    if (resolved.length === 0) {
      setOrderError("SKU Produk atau Bundle tidak ditemukan.");
      return;
    }

    const code = `${simChannel === "shopee" ? "SP" : "TT"}-${Date.now().toString().slice(-5)}`;
    
    setLoading(true);
    try {
      const res = await fetch("/api/webhook/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_order",
          payload: {
            channel: simChannel,
            sku: simSku.toUpperCase(),
            qty: qtyNum,
            order_code: code,
          }
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      setSimSku("");
      setSimQty("1");
      setOrderSuccess(`Pesanan ${code} berhasil dibuat dengan status PENDING.`);
      loadOrdersAndReturns();
    } catch (err: any) {
      setOrderError(err.message || "Gagal menyimpan pesanan dummy.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateOrderStatus = async (order: Order, newStatus: OrderStatus) => {
    if (isReadOnly) return;

    const currentStatus = order.status;
    if (currentStatus === newStatus) return;

    if (currentStatus === "COMPLETED" || currentStatus === "CANCELLED") {
      alert("Pesanan yang sudah selesai atau batal tidak dapat diubah statusnya.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/webhook/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_order_status",
          payload: {
            order_id: order.id,
            new_status: newStatus,
            order: order,
          }
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      
      loadOrdersAndReturns();
    } catch (err: any) {
      alert(err.message || "Gagal mengubah status pesanan.");
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerReturn = async (order: Order) => {
    if (isReadOnly) return;
    
    const { data: returnsList } = await supabase.from("returns").select("*").eq("order_id", order.id);
    if (returnsList && returnsList.length > 0) {
      alert("Retur untuk pesanan ini sudah terdaftar.");
      return;
    }

    setLoading(true);
    await supabase.from("returns").insert({
      order_id: order.id,
      order_code: order.order_code,
      channel: order.channel,
      sku: order.sku,
      qty: order.qty,
      condition: null,
      status: "PENDING",
      received_at: null,
    });
    setLoading(false);

    alert(`Retur diajukan untuk pesanan ${order.order_code}. Selesaikan inspeksi di tab 'Inspeksi Retur'.`);
    loadOrdersAndReturns();
  };

  const handleImportCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportError("");
    setImportSuccess("");

    if (isReadOnly) {
      setImportError("Peran Anda hanya memiliki hak baca. Tidak dapat mengimpor file.");
      return;
    }

    if (!csvContent.trim()) {
      setImportError("Konten CSV kosong.");
      return;
    }

    setLoading(true);
    try {
      const lines = csvContent.trim().split("\n");
      let startIndex = 0;
      if (lines[0].toLowerCase().includes("sku") || lines[0].toLowerCase().includes("channel")) {
        startIndex = 1;
      }

      let importCount = 0;
      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const cols = line.split(",").map((c) => c.trim());
        if (cols.length < 4) {
          throw new Error(`Baris ${i + 1} tidak valid. Format: order_code,channel,sku,qty`);
        }

        const [order_code, channel, sku, qtyStr] = cols;
        const qtyVal = parseInt(qtyStr);

        if (!order_code || !sku || isNaN(qtyVal) || qtyVal <= 0) {
          throw new Error(`Data di baris ${i + 1} mengandung field tidak valid.`);
        }

        if (channel !== "shopee" && channel !== "tiktok") {
          throw new Error(`Channel di baris ${i + 1} harus 'shopee' atau 'tiktok'.`);
        }

        const resolved = resolveSkuComponents(sku);
        if (resolved.length === 0) {
          throw new Error(`SKU '${sku}' di baris ${i + 1} tidak ditemukan.`);
        }

        await supabase.from("orders").insert({
          order_code,
          channel: channel as "shopee" | "tiktok",
          status: "PENDING",
          sku: sku.toUpperCase(),
          qty: qtyVal,
        });

        importCount++;
      }

      setCsvContent("");
      setImportSuccess(`Berhasil mengimpor ${importCount} pesanan PENDING.`);
      loadOrdersAndReturns();
    } catch (err: any) {
      setImportError(err.message || "Gagal memproses file CSV.");
    } finally {
      setLoading(false);
    }
  };

  const handleImportReturnCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportError("");
    setImportSuccess("");

    if (isReadOnly) {
      setImportError("Peran Anda hanya memiliki hak baca. Tidak dapat mengimpor file.");
      return;
    }

    if (!returnCsvContent.trim()) {
      setImportError("Konten CSV kosong.");
      return;
    }

    setLoading(true);
    try {
      const lines = returnCsvContent.trim().split("\n");
      let startIndex = 0;
      if (lines[0].toLowerCase().includes("condition") || lines[0].toLowerCase().includes("order")) {
        startIndex = 1;
      }

      let importCount = 0;
      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = line.split(",").map((c) => c.trim());
        if (cols.length < 5) {
          throw new Error(`Baris ${i + 1} tidak valid. Format: order_code,channel,sku,qty,condition`);
        }

        const [order_code, channel, sku, qtyStr, condition] = cols;
        const qtyVal = parseInt(qtyStr);

        if (!order_code || !sku || isNaN(qtyVal) || qtyVal <= 0 || !condition) {
          throw new Error(`Data di baris ${i + 1} mengandung field tidak valid.`);
        }

        if (channel !== "shopee" && channel !== "tiktok") {
          throw new Error(`Channel harus 'shopee' atau 'tiktok'.`);
        }

        const condClean = condition.toLowerCase();
        if (condClean !== "layak_jual" && condClean !== "rusak" && condClean !== "hilang") {
          throw new Error(`Kondisi retur harus 'layak_jual', 'rusak', atau 'hilang'.`);
        }

        // Check if order exists, if not create a completed one for audit history
        let { data: ords } = await supabase.from("orders").select("*").eq("order_code", order_code);
        let order = ords && ords[0];
        if (!order) {
          const { data: newOrder } = await supabase.from("orders").insert({
            order_code,
            channel: channel as "shopee" | "tiktok",
            status: "COMPLETED",
            sku: sku.toUpperCase(),
            qty: qtyVal,
          }).select().single();
          order = newOrder;
        }

        if (order) {
          const { data: newReturn } = await supabase.from("returns").insert({
            order_id: order.id,
            order_code: order.order_code,
            channel: order.channel,
            sku: order.sku,
            qty: order.qty,
            condition: null,
            status: "PENDING",
            received_at: null,
          }).select().single();

          if (newReturn) {
            await handleProcessReturn(newReturn, condClean as "layak_jual" | "rusak" | "hilang");
            importCount++;
          }
        }
      }

      setReturnCsvContent("");
      setImportSuccess(`Berhasil mengimpor dan memproses ${importCount} retur massal.`);
      loadOrdersAndReturns();
    } catch (err: any) {
      setImportError(err.message || "Gagal memproses file CSV retur.");
    } finally {
      setLoading(false);
    }
  };

  const handleProcessReturn = async (ret: ReturnItem, condition: "layak_jual" | "rusak" | "hilang") => {
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
          }
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      loadOrdersAndReturns();
    } catch (err: any) {
      alert(err.message || "Gagal memproses retur.");
    } finally {
      setLoading(false);
    }
  };

  const handleClaimTiktok = async (retId: string) => {
    if (isReadOnly) return;
    setLoading(true);
    await supabase.from("returns").update({ status: "CLAIMED", received_at: new Date().toISOString() }).eq("id", retId);
    setLoading(false);
    alert("Klaim pengembalian TikTok berhasil diajukan.");
    loadOrdersAndReturns();
  };

  return (
    <div className="space-y-6">
      {/* Simulation Warn Banner */}
      <div className="bg-warning-bg border border-warning/30 rounded p-3 text-warning font-semibold text-xs flex items-center gap-2">
        <span>⚠️</span>
        <span>MODE SIMULASI — Fitur pesanan & retur berjalan dalam mode simulasi, belum terintegrasi API marketplace resmi</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab("orders")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "orders"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-ink-soft hover:text-ink"
          }`}
        >
          Simulasi Pesanan Baru &amp; Status
        </button>
        <button
          onClick={() => setActiveTab("import")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "import"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-ink-soft hover:text-ink"
          }`}
        >
          Impor Berkas CSV (Pesanan &amp; Retur)
        </button>
        <button
          onClick={() => setActiveTab("returns")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "returns"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-ink-soft hover:text-ink"
          }`}
        >
          Inspeksi Retur &amp; Klaim TikTok
        </button>
      </div>

      {/* TAB 1: ORDER SIMULATION */}
      {activeTab === "orders" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <SectionCard title="Simulasi Pesanan Baru">
              <form onSubmit={handleCreateOrder} className="space-y-4">
                {orderError && (
                  <div className="p-3 bg-danger-bg text-danger text-xs rounded border border-danger/30 font-semibold font-mono">
                    {orderError}
                  </div>
                )}
                {orderSuccess && (
                  <div className="p-3 bg-success-bg text-success text-xs rounded border border-success/30 font-semibold">
                    {orderSuccess}
                  </div>
                )}

                <Select
                  label="Channel Marketplace"
                  value={simChannel}
                  onChange={(e) => setSimChannel(e.target.value as "shopee" | "tiktok")}
                  options={[
                    { value: "shopee", label: "Shopee" },
                    { value: "tiktok", label: "TikTok Shop" },
                  ]}
                  disabled={isReadOnly || loading}
                />

                <Input
                  label="SKU Produk atau Bundle"
                  placeholder="Contoh: SK-FW-001 atau BNDL-GLOW-01"
                  value={simSku}
                  onChange={(e) => setSimSku(e.target.value)}
                  required
                  disabled={isReadOnly || loading}
                />

                <Input
                  label="Kuantitas"
                  type="number"
                  min="1"
                  value={simQty}
                  onChange={(e) => setSimQty(e.target.value)}
                  required
                  disabled={isReadOnly || loading}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isReadOnly || loading}
                >
                  {loading ? "Memproses..." : "Buat Pesanan Dummy"}
                </Button>
              </form>
            </SectionCard>
          </div>

          <div className="lg:col-span-2">
            <SectionCard title="Daftar Pesanan Marketplace">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border text-xs font-semibold text-ink-soft uppercase bg-bg/50">
                      <th className="py-2.5 px-3">Kode Order</th>
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3 text-center">Qty</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-center">Aksi Simulasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-xs font-mono">
                    {orders.map((o) => {
                      const isShipped = o.status === "SHIPPED" || o.status === "IN_TRANSIT";
                      const isCompleted = o.status === "COMPLETED";
                      const isCancelled = o.status === "CANCELLED";

                      return (
                        <tr key={o.id} className="hover:bg-bg/10 transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="font-bold flex items-center gap-1.5">
                              {o.order_code}
                              {o.channel === "shopee" ? (
                                <span className="text-[8px] bg-warning-bg text-warning px-1 rounded font-semibold">SP</span>
                              ) : (
                                <span className="text-[8px] bg-primary-light text-primary px-1 rounded font-semibold">TT</span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-primary">{o.sku}</td>
                          <td className="py-2.5 px-3 text-center font-bold">{o.qty}</td>
                          <td className="py-2.5 px-3">
                            {o.status === "PENDING" && <Tag variant="neutral">PENDING</Tag>}
                            {(o.status === "SHIPPED" || o.status === "IN_TRANSIT") && <Tag variant="primary">{o.status}</Tag>}
                            {o.status === "COMPLETED" && <Tag variant="success">COMPLETED</Tag>}
                            {o.status === "CANCELLED" && <Tag variant="danger">CANCELLED</Tag>}
                          </td>
                          <td className="py-2.5 px-3 text-center space-x-1.5 space-y-1">
                            {o.status === "PENDING" && (
                              <>
                                <Button
                                  variant="primary"
                                  className="px-2 py-0.5 text-[10px]"
                                  disabled={isReadOnly || loading}
                                  onClick={() => handleUpdateOrderStatus(o, o.channel === "shopee" ? "SHIPPED" : "IN_TRANSIT")}
                                >
                                  Kirim Fisik
                                </Button>
                                <Button
                                  variant="danger"
                                  className="px-2 py-0.5 text-[10px]"
                                  disabled={isReadOnly || loading}
                                  onClick={() => handleUpdateOrderStatus(o, "CANCELLED")}
                                >
                                  Batal
                                </Button>
                              </>
                            )}

                            {isShipped && (
                              <>
                                <Button
                                  variant="success"
                                  className="px-2 py-0.5 text-[10px]"
                                  disabled={isReadOnly || loading}
                                  onClick={() => handleUpdateOrderStatus(o, "COMPLETED")}
                                >
                                  Selesai
                                </Button>
                                <Button
                                  variant="danger"
                                  className="px-2 py-0.5 text-[10px]"
                                  disabled={isReadOnly || loading}
                                  onClick={() => handleUpdateOrderStatus(o, "CANCELLED")}
                                >
                                  Batal/Gagal Kirim
                                </Button>
                                <Button
                                  variant="ghost"
                                  className="px-2 py-0.5 text-[10px]"
                                  disabled={isReadOnly || loading}
                                  onClick={() => handleTriggerReturn(o)}
                                >
                                  Retur
                                </Button>
                              </>
                            )}

                            {(isCompleted || isCancelled) && (
                              <span className="text-[10px] text-ink-faint italic font-body">Kunci/Selesai</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      {/* TAB 2: IMPORT CSV */}
      {activeTab === "import" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SectionCard title="Impor Data Pesanan (CSV)">
            <form onSubmit={handleImportCsv} className="space-y-4">
              {importError && activeTab === "import" && (
                <div className="p-3 bg-danger-bg text-danger text-xs rounded border border-danger/30 font-semibold font-mono">
                  {importError}
                </div>
              )}
              {importSuccess && activeTab === "import" && csvContent && (
                <div className="p-3 bg-success-bg text-success text-xs rounded border border-success/30 font-semibold">
                  {importSuccess}
                </div>
              )}

              <div className="text-xs text-ink-soft space-y-2 leading-relaxed">
                <p>Format CSV Pesanan: `order_code, channel, sku, qty`</p>
                <pre className="p-2 bg-bg border border-border-strong rounded font-mono text-[10px] block overflow-x-auto">
                  order_code, channel, sku, qty{"\n"}
                  SP-CSV-001, shopee, SK-FW-001, 2
                </pre>
              </div>

              <div className="flex flex-col gap-1 w-full">
                <textarea
                  rows={4}
                  className="w-full px-3 py-2 text-xs bg-white border border-border rounded-sm focus:outline-none focus:border-primary font-mono"
                  placeholder="order_code,channel,sku,qty..."
                  value={csvContent}
                  onChange={(e) => setCsvContent(e.target.value)}
                  disabled={isReadOnly || loading}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isReadOnly || loading}
              >
                Proses Impor Pesanan
              </Button>
            </form>
          </SectionCard>

          <SectionCard title="Impor Data Retur Massal (CSV)">
            <form onSubmit={handleImportReturnCsv} className="space-y-4">
              {importError && (
                <div className="p-3 bg-danger-bg text-danger text-xs rounded border border-danger/30 font-semibold font-mono">
                  {importError}
                </div>
              )}
              {importSuccess && returnCsvContent === "" && (
                <div className="p-3 bg-success-bg text-success text-xs rounded border border-success/30 font-semibold">
                  {importSuccess}
                </div>
              )}

              <div className="text-xs text-ink-soft space-y-2 leading-relaxed">
                <p>Format CSV Retur: `order_code, channel, sku, qty, condition`</p>
                <p className="text-[10px] text-primary italic">* Kondisi: layak_jual | rusak | hilang</p>
                <pre className="p-2 bg-bg border border-border-strong rounded font-mono text-[10px] block overflow-x-auto">
                  order_code, channel, sku, qty, condition{"\n"}
                  SP-RET-999, shopee, SK-HT-002, 1, layak_jual{"\n"}
                  TT-RET-888, tiktok, SK-SR-004, 1, rusak
                </pre>
              </div>

              <div className="flex flex-col gap-1 w-full">
                <textarea
                  rows={4}
                  className="w-full px-3 py-2 text-xs bg-white border border-border rounded-sm focus:outline-none focus:border-primary font-mono"
                  placeholder="order_code,channel,sku,qty,condition..."
                  value={returnCsvContent}
                  onChange={(e) => setReturnCsvContent(e.target.value)}
                  disabled={isReadOnly || loading}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isReadOnly || loading}
              >
                Proses Impor Retur Massal
              </Button>
            </form>
          </SectionCard>
        </div>
      )}

      {/* TAB 3: RETURN CONDITIONS */}
      {activeTab === "returns" && (
        <SectionCard title="Inspeksi Kondisi Barang Retur">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-xs font-semibold text-ink-soft uppercase bg-bg/50">
                  <th className="py-2.5 px-3">Pesanan</th>
                  <th className="py-2.5 px-3">SKU</th>
                  <th className="py-2.5 px-3 text-center">Qty</th>
                  <th className="py-2.5 px-3">Sisa Waktu Klaim TikTok (40 hari)</th>
                  <th className="py-2.5 px-3">Kondisi Fisik Retur</th>
                  <th className="py-2.5 px-3 text-center">Aksi / Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs font-mono">
                {returns.map((r) => {
                  let countdownText = "-";
                  let countdownColor = "text-ink-soft";
                  
                  if (r.channel === "tiktok" && r.received_at) {
                    const receivedDate = new Date(r.received_at);
                    const elapsedDays = Math.floor((Date.now() - receivedDate.getTime()) / (1000 * 60 * 60 * 24));
                    const remainingDays = 40 - elapsedDays;
                    
                    if (r.status === "CLAIMED") {
                      countdownText = "Sudah Diklaim";
                      countdownColor = "text-success font-semibold";
                    } else if (remainingDays < 0) {
                      countdownText = "Kedaluwarsa (Lewat 40 hari)";
                      countdownColor = "text-danger font-semibold";
                    } else {
                      countdownText = `${remainingDays} hari lagi`;
                      countdownColor = remainingDays <= 7 ? "text-danger font-bold" : "text-warning font-semibold";
                    }
                  }

                  const isInspected = r.condition !== null;

                  return (
                    <tr key={r.id} className="hover:bg-bg/10 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="font-bold flex items-center gap-1">
                          {r.order_code}
                          {r.channel === "shopee" ? (
                            <span className="text-[8px] bg-warning-bg text-warning px-1 rounded">SP</span>
                          ) : (
                            <span className="text-[8px] bg-primary-light text-primary px-1 rounded">TT</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-primary">{r.sku}</td>
                      <td className="py-2.5 px-3 text-center font-bold">{r.qty}</td>
                      <td className={`py-2.5 px-3 ${countdownColor}`}>{countdownText}</td>
                      <td className="py-2.5 px-3">
                        {isInspected ? (
                          <div className="capitalize">
                            {r.condition === "layak_jual" && <Tag variant="success">Layak Jual (+Stok)</Tag>}
                            {r.condition === "rusak" && <Tag variant="danger">Rusak (Audit Lengkap)</Tag>}
                            {r.condition === "hilang" && <Tag variant="neutral">Hilang Eksp (Audit Lengkap)</Tag>}
                          </div>
                        ) : (
                          <div className="flex gap-1.5">
                            <Button
                              variant="success"
                              className="px-2 py-0.5 text-[10px]"
                              disabled={isReadOnly || loading}
                              onClick={() => handleProcessReturn(r, "layak_jual")}
                            >
                              Layak
                            </Button>
                            <Button
                              variant="danger"
                              className="px-2 py-0.5 text-[10px]"
                              disabled={isReadOnly || loading}
                              onClick={() => handleProcessReturn(r, "rusak")}
                            >
                              Rusak
                            </Button>
                            <Button
                              variant="ghost"
                              className="px-2 py-0.5 text-[10px]"
                              disabled={isReadOnly || loading}
                              onClick={() => handleProcessReturn(r, "hilang")}
                            >
                              Hilang
                            </Button>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {r.channel === "tiktok" && isInspected && r.status === "PENDING" && (
                          <Button
                            variant="primary"
                            className="px-2 py-0.5 text-[10px]"
                            disabled={isReadOnly || loading}
                            onClick={() => handleClaimTiktok(r.id)}
                          >
                            Ajukan Klaim TikTok
                          </Button>
                        )}
                        {r.channel === "tiktok" && r.status === "CLAIMED" && (
                          <span className="text-[10px] text-success italic font-body font-semibold">Tuntas</span>
                        )}
                        {(r.channel !== "tiktok" || !isInspected) && (
                          <span className="text-[10px] text-ink-faint italic font-body">Selesai</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
