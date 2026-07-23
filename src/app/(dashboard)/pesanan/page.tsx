"use client";

import React, { useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";
import { SectionCard, Input, Select, Button, Tag } from "@/components/ui";
import { supabase } from "@/lib/supabase/client";
import type { Order, ReturnItem, Product, Bundle, BundleComponent, OrderStatus } from "@/types";
import { IconFlask } from "@/components/icons/IconFlask";

export const dynamic = "force-dynamic";

export default function PesananReturPage() {
  const { user } = useUser();
  const isReadOnly = user?.role === "owner";

  const [products, setProducts] = useState<Product[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [bundleComponents, setBundleComponents] = useState<BundleComponent[]>([]);
  
  const [orders, setOrders] = useState<Order[]>([]);

  const [activeTab, setActiveTab] = useState<"orders" | "import">("orders");

  // Single Order simulation form state
  const [simChannel, setSimChannel] = useState<"shopee" | "tiktok">("shopee");
  const [simSku, setSimSku] = useState("");
  const [simQty, setSimQty] = useState("1");
  const [orderError, setOrderError] = useState("");
  const [orderSuccess, setOrderSuccess] = useState("");

  // Import form state
  const [csvContent, setCsvContent] = useState("");
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
    if (ords) setOrders(ords as Order[]);
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

    if (!simSku) {
      setOrderError("Harap pilih produk atau bundle.");
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
      setOrderSuccess(`Pesanan ${code} berhasil dibuat dengan status PENDING (Reservasi).`);
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

  const handleTriggerReturn = async (order: Order, qtyToReturn: number) => {
    if (isReadOnly) return;

    setLoading(true);
    const { error } = await supabase.from("returns").insert({
      order_id: order.id,
      order_code: order.order_code,
      channel: order.channel,
      sku: order.sku,
      qty: qtyToReturn,
      condition: null,
      status: "PENDING",
      received_at: null,
    });
    setLoading(false);

    if (error) {
      alert("Gagal mengajukan retur: " + error.message);
    } else {
      alert(`Retur ${qtyToReturn} unit diajukan untuk pesanan ${order.order_code}. Selesaikan inspeksi di menu 'Inspeksi Retur'.`);
    }
    loadOrdersAndReturns();
  };

  const handleReturSemua = async (order: Order) => {
    await handleTriggerReturn(order, order.qty);
  };

  const handleReturSebagian = async (order: Order) => {
    const val = prompt(`Masukkan kuantitas barang retur (Maksimal ${order.qty} unit):`);
    if (val === null) return;
    const qty = parseInt(val);
    if (isNaN(qty) || qty <= 0 || qty > order.qty) {
      alert("Kuantitas retur tidak valid.");
      return;
    }
    await handleTriggerReturn(order, qty);
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
        <IconFlask className="w-4 h-4 text-warning shrink-0" />
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
          Impor Berkas CSV (Pesanan)
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

                <Select
                  label="Pilih Produk atau Bundle"
                  value={simSku}
                  onChange={(e) => setSimSku(e.target.value)}
                  options={[
                    { value: "", label: "-- Pilih Produk atau Bundle --" },
                    ...products.filter(p => p.is_active).map((p) => ({ value: p.sku, label: `[Produk] ${p.name} (${p.sku})` })),
                    ...bundles.map((b) => ({ value: b.sku, label: `[Bundle] ${b.name} (${b.sku})` })),
                  ]}
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
                      <th className="py-2.5 px-3">Order ID</th>
                      <th className="py-2.5 px-3">Channel</th>
                      <th className="py-2.5 px-3">Produk</th>
                      <th className="py-2.5 px-3 text-center">Qty</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-xs font-mono">
                    {orders.map((o) => {
                      const isReservasi = o.status === "PENDING";
                      const isDikirim = o.status === "SHIPPED" || o.status === "IN_TRANSIT";
                      const isSelesai = o.status === "COMPLETED";
                      const isBatal = o.status === "CANCELLED";

                      const resolvedProduct = products.find(p => p.sku === o.sku)?.name || bundles.find(b => b.sku === o.sku)?.name || o.sku;

                      return (
                        <tr key={o.id} className="hover:bg-bg/10 transition-colors">
                          <td className="py-2.5 px-3 font-bold">{o.order_code}</td>
                          <td className="py-2.5 px-3">
                            {o.channel === "shopee" ? (
                              <Tag variant="warning">SHOPEE</Tag>
                            ) : (
                              <Tag variant="primary">TIKTOK</Tag>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-body font-semibold max-w-[150px] truncate">{resolvedProduct}</td>
                          <td className="py-2.5 px-3 text-center font-bold">{o.qty}</td>
                          <td className="py-2.5 px-3">
                            {isReservasi && <Tag variant="neutral">Reservasi</Tag>}
                            {isDikirim && <Tag variant="primary">Dikirim</Tag>}
                            {isSelesai && <Tag variant="success">Selesai</Tag>}
                            {isBatal && <Tag variant="danger">Batal</Tag>}
                          </td>
                          <td className="py-2.5 px-3 text-center space-x-1.5 space-y-1">
                            {isReservasi && (
                              <>
                                <Button
                                  variant="primary"
                                  className="px-2 py-0.5 text-[10px] min-h-[30px]"
                                  disabled={isReadOnly || loading}
                                  onClick={() => handleUpdateOrderStatus(o, o.channel === "shopee" ? "SHIPPED" : "IN_TRANSIT")}
                                >
                                  Set Dikirim
                                </Button>
                                <Button
                                  variant="danger"
                                  className="px-2 py-0.5 text-[10px] min-h-[30px]"
                                  disabled={isReadOnly || loading}
                                  onClick={() => handleUpdateOrderStatus(o, "CANCELLED")}
                                >
                                  Batalkan
                                </Button>
                              </>
                            )}

                            {isDikirim && (
                              <>
                                <Button
                                  variant="success"
                                  className="px-2 py-0.5 text-[10px] min-h-[30px]"
                                  disabled={isReadOnly || loading}
                                  onClick={() => handleUpdateOrderStatus(o, "COMPLETED")}
                                >
                                  Selesai
                                </Button>
                                <Button
                                  variant="danger"
                                  className="px-2 py-0.5 text-[10px] min-h-[30px]"
                                  disabled={isReadOnly || loading}
                                  onClick={() => handleUpdateOrderStatus(o, "CANCELLED")}
                                >
                                  Batalkan
                                </Button>
                                <Button
                                  variant="ghost"
                                  className="px-2 py-0.5 text-[10px] min-h-[30px]"
                                  disabled={isReadOnly || loading}
                                  onClick={() => handleReturSemua(o)}
                                >
                                  Retur Semua
                                </Button>
                                <Button
                                  variant="ghost"
                                  className="px-2 py-0.5 text-[10px] min-h-[30px]"
                                  disabled={isReadOnly || loading}
                                  onClick={() => handleReturSebagian(o)}
                                >
                                  Retur Sebagian
                                </Button>
                              </>
                            )}

                            {(isSelesai || isBatal) && (
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
        <div className="max-w-xl mx-auto">
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
        </div>
      )}
    </div>
  );
}
