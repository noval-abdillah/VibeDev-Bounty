"use client";

import React, { useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";
import { SectionCard, Button, Tag, Input, Select } from "@/components/ui";
import { supabase } from "@/lib/supabase/client";
import { getStockForProduct } from "@/lib/ledger";
import { exportToXlsx } from "@/lib/export";
import type { ExportColumn, ExportSheet } from "@/lib/export";
import type { Product, Bundle, BundleComponent } from "@/types";
import Link from "next/link";

interface ProdukClientProps {
  serverProducts: any[];
  serverBundles: any[];
  serverBundleComponents: any[];
}

export function ProdukClient({ serverProducts, serverBundles, serverBundleComponents }: ProdukClientProps) {
  const { user } = useUser();
  const isAdmin = user?.role === "admin";

  const [activeTab, setActiveTab] = useState<"produk" | "bundle" | "config">("produk");
  const [products, setProducts] = useState<any[]>(serverProducts);
  const [productStocks, setProductStocks] = useState<Record<string, number>>({});
  const [bundles, setBundles] = useState<Bundle[]>(serverBundles);
  const [bundleComponents, setBundleComponents] = useState<BundleComponent[]>(serverBundleComponents as BundleComponent[]);
  
  const [searchQuery, setSearchQuery] = useState("");

  // Product form state
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductSku, setNewProductSku] = useState("");
  const [productFormError, setProductFormError] = useState("");

  // Bundle form state
  const [showAddBundle, setShowAddBundle] = useState(false);
  const [newBundleName, setNewBundleName] = useState("");
  const [newBundleSku, setNewBundleSku] = useState("");
  const [bundleFormError, setBundleFormError] = useState("");
  const [selectedComponents, setSelectedComponents] = useState<{ product_id: string; qty: number }[]>([
    { product_id: "", qty: 1 }
  ]);

  // Config state
  const [expiryThreshold, setExpiryThreshold] = useState(30);

  useEffect(() => {
    // Server already sent product_stock_summary with total_stock field
    const stocks: Record<string, number> = {};
    serverProducts.forEach((p: any) => {
      stocks[p.product_id] = p.total_stock;
    });
    setProductStocks(stocks);
    
    // Format products from server view format
    setProducts(serverProducts.map((p: any) => ({
      id: p.product_id,
      name: p.name,
      sku: p.sku,
      is_active: p.is_active,
      created_at: p.created_at
    })));

    const storedThreshold = localStorage.getItem("stokledger_expiry_threshold");
    if (storedThreshold) setExpiryThreshold(parseInt(storedThreshold));
  }, []);

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName.trim() || !newProductSku.trim()) {
      setProductFormError("Nama dan SKU wajib diisi.");
      return;
    }
    if (products.some((p) => p.sku.toLowerCase() === newProductSku.trim().toLowerCase())) {
      setProductFormError("SKU sudah digunakan.");
      return;
    }

    const { data: newProd, error } = await supabase
      .from("products")
      .insert({ name: newProductName, sku: newProductSku.toUpperCase(), is_active: true })
      .select().single();

    if (error || !newProd) { setProductFormError("Gagal menambahkan produk."); return; }

    const { data: newBatch } = await supabase.from("batches").insert({
      product_id: newProd.id,
      batch_code: `B-${newProd.sku}-01`,
      expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    }).select().single();

    if (newBatch) {
      await supabase.from("stock_ledger").insert({
        product_id: newProd.id, batch_id: newBatch.id, qty: 0,
        reason: "saldo_awal", channel: "system", reference_id: "PO-INIT-001",
      });
    }

    setNewProductName(""); setNewProductSku(""); setProductFormError(""); setShowAddProduct(false);
    // Refresh
    const { data: prods } = await supabase.from("product_stock_summary").select("*").order("name", { ascending: true });
    if (prods) {
      setProducts(prods.map((p: any) => ({ id: p.product_id, name: p.name, sku: p.sku, is_active: p.is_active, created_at: p.created_at })));
      const stocks: Record<string, number> = {};
      prods.forEach((p: any) => { stocks[p.product_id] = p.total_stock; });
      setProductStocks(stocks);
    }
  };

  const handleToggleProductActive = async (id: string, currentStatus: boolean) => {
    await supabase.from("products").update({ is_active: !currentStatus }).eq("id", id);
    const { data: prods } = await supabase.from("product_stock_summary").select("*").order("name", { ascending: true });
    if (prods) {
      setProducts(prods.map((p: any) => ({ id: p.product_id, name: p.name, sku: p.sku, is_active: p.is_active, created_at: p.created_at })));
    }
  };

  const handleAddBundle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBundleName.trim() || !newBundleSku.trim()) { setBundleFormError("Nama dan SKU bundle wajib diisi."); return; }
    if (bundles.some((b) => b.sku.toLowerCase() === newBundleSku.trim().toLowerCase())) { setBundleFormError("SKU bundle sudah digunakan."); return; }
    const validComponents = selectedComponents.filter((c) => c.product_id !== "");
    if (validComponents.length === 0) { setBundleFormError("Harap pilih minimal 1 produk komponen."); return; }

    const { data: newBundle, error } = await supabase.from("bundles").insert({
      name: newBundleName, sku: newBundleSku.toUpperCase(),
    }).select().single();
    if (error || !newBundle) { setBundleFormError("Gagal menambahkan bundle."); return; }
    await supabase.from("bundle_components").insert(validComponents.map((c) => ({ bundle_id: newBundle.id, product_id: c.product_id, qty: c.qty })));

    setNewBundleName(""); setNewBundleSku(""); setSelectedComponents([{ product_id: "", qty: 1 }]);
    setBundleFormError(""); setShowAddBundle(false);
    const { data: bunds } = await supabase.from("bundles").select("*");
    const { data: comps } = await supabase.from("bundle_components").select("*");
    if (bunds) setBundles(bunds);
    if (comps) setBundleComponents(comps as any);
  };

  const handleSaveConfig = () => {
    localStorage.setItem("stokledger_expiry_threshold", expiryThreshold.toString());
    alert("Konfigurasi tersimpan.");
  };

  const handleExportProduk = () => {
    const now = new Date();
    const today = now.toISOString().split("T")[0];

    const columns: ExportColumn[] = [
      { header: "SKU", key: "sku", width: 16 },
      { header: "Nama Produk", key: "nama", width: 38 },
      { header: "Stok Fisik", key: "stok", width: 14 },
      { header: "Status", key: "status", width: 14 },
      { header: "Jumlah Batch", key: "batch_count", width: 16 },
    ];

    const rows = products.map((p: any) => ({
      sku: p.sku,
      nama: p.name,
      stok: (productStocks[p.id] || 0).toLocaleString("id-ID"),
      status: p.is_active ? "Aktif" : "Nonaktif",
      batch_count: bundles.filter((b: any) => b.product_id === p.id).length || "-",
    }));

    const totalStok = products.reduce((sum: number, p: any) => sum + (productStocks[p.id] || 0), 0);

    const sheet: ExportSheet = {
      name: "Katalog Produk",
      columns,
      rows,
      summaryRows: [
        { label: "Total Produk Aktif", value: `${products.filter((p: any) => p.is_active).length} SKU` },
        { label: "Total Stok Fisik", value: `${totalStok.toLocaleString("id-ID")} unit` },
        { label: "Diekspor Pada", value: now.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) },
      ],
    };

    exportToXlsx({
      title: "Katalog Produk StokLedger",
      fileName: `StokLedger_KatalogProduk_${today}`,
      sheets: [sheet],
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex border-b border-border">
        <button onClick={() => setActiveTab("produk")} className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${activeTab === "produk" ? "border-primary text-primary font-bold" : "border-transparent text-ink-soft hover:text-ink"}`}>Katalog Produk</button>
        <button onClick={() => setActiveTab("bundle")} className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${activeTab === "bundle" ? "border-primary text-primary font-bold" : "border-transparent text-ink-soft hover:text-ink"}`}>Resep Bundle</button>
        <button onClick={() => setActiveTab("config")} className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${activeTab === "config" ? "border-primary text-primary font-bold" : "border-transparent text-ink-soft hover:text-ink"}`}>Pengaturan Notifikasi</button>
      </div>

      {activeTab === "produk" && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row justify-between gap-4">
            <div className="w-full md:w-72"><Input placeholder="Cari nama atau SKU produk..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={handleExportProduk}>Ekspor Excel</Button>
              {isAdmin && <Button onClick={() => setShowAddProduct(true)}>+ Tambah Produk Baru</Button>}
            </div>
          </div>

          {showAddProduct && (
            <SectionCard title="Tambah Produk Master Baru">
              <form onSubmit={handleAddProduct} className="space-y-4">
                {productFormError && <div className="p-3 bg-danger-bg text-danger text-xs rounded border border-danger/30 font-semibold font-mono">{productFormError}</div>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Nama Produk" placeholder="Contoh: Brightening Serum Niacinamide 10%" value={newProductName} onChange={(e) => setNewProductName(e.target.value)} required />
                  <Input label="SKU Produk (Kode Unik)" placeholder="Contoh: SK-SR-005" value={newProductSku} onChange={(e) => setNewProductSku(e.target.value)} required />
                </div>
                <div className="flex gap-2 justify-end"><Button variant="ghost" type="button" onClick={() => setShowAddProduct(false)}>Batal</Button><Button type="submit">Simpan Produk</Button></div>
              </form>
            </SectionCard>
          )}

          <SectionCard>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border text-xs font-semibold text-ink-soft uppercase bg-bg/50">
                    <th className="py-3 px-4">Nama Produk</th>
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4 text-right">Stok Fisik</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-sm">
                  {filteredProducts.map((p) => {
                    const stock = productStocks[p.id] || 0;
                    return (
                      <tr key={p.id} className={`hover:bg-bg/10 transition-colors ${!p.is_active ? "opacity-55" : ""}`}>
                        <td className="py-3 px-4"><Link href={`/produk/${p.id}`} className="font-heading font-semibold text-primary hover:underline">{p.name}</Link></td>
                        <td className="py-3 px-4 font-mono">{p.sku}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold">{stock.toLocaleString("id-ID")}</td>
                        <td className="py-3 px-4">{p.is_active ? <Tag variant="success">AKTIF</Tag> : <Tag variant="neutral">NONAKTIF</Tag>}</td>
                        <td className="py-3 px-4 text-center space-x-2">
                          <Link href={`/produk/${p.id}`}><Button variant="ghost" className="px-2.5 py-1">Detail &amp; Batch</Button></Link>
                          {isAdmin && <Button variant={p.is_active ? "danger" : "success"} className="px-2.5 py-1" onClick={() => handleToggleProductActive(p.id, p.is_active)}>{p.is_active ? "Nonaktifkan" : "Aktifkan"}</Button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      )}

      {activeTab === "bundle" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-heading font-semibold text-ink">Resep Bundle Aktif</h3>
            {isAdmin && <Button onClick={() => setShowAddBundle(true)}>+ Buat Resep Bundle Baru</Button>}
          </div>

          {showAddBundle && (
            <SectionCard title="Definisikan Resep Bundle Baru">
              <form onSubmit={handleAddBundle} className="space-y-4">
                {bundleFormError && <div className="p-3 bg-danger-bg text-danger text-xs rounded border border-danger/30 font-semibold font-mono">{bundleFormError}</div>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Nama Bundle" placeholder="Contoh: Bundle Glowing Radiance" value={newBundleName} onChange={(e) => setNewBundleName(e.target.value)} required />
                  <Input label="SKU Bundle (Kode SKU Toko)" placeholder="Contoh: BNDL-GLOW-01" value={newBundleSku} onChange={(e) => setNewBundleSku(e.target.value)} required />
                </div>
                <div className="space-y-3">
                  <span className="text-xs font-semibold text-ink-soft block">Komponen Produk Satuan</span>
                  {selectedComponents.map((comp, idx) => (
                    <div key={idx} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <Select label={`Komponen #${idx + 1}`} value={comp.product_id}
                          onChange={(e) => { const updated = [...selectedComponents]; updated[idx].product_id = e.target.value; setSelectedComponents(updated); }}
                          options={[{ value: "", label: "-- Pilih Produk --" }, ...products.filter((p) => p.is_active).map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` }))]} required />
                      </div>
                      <div className="w-24">
                        <Input label="Qty" type="number" value={comp.qty}
                          onChange={(e) => { const updated = [...selectedComponents]; updated[idx].qty = Math.max(1, Number(e.target.value)); setSelectedComponents(updated); }} required />
                      </div>
                      {selectedComponents.length > 1 && <Button variant="danger" type="button" className="mb-0.5 px-3 py-2" onClick={() => setSelectedComponents(selectedComponents.filter((_, i) => i !== idx))}>Hapus</Button>}
                    </div>
                  ))}
                  <Button variant="ghost" type="button" onClick={() => setSelectedComponents([...selectedComponents, { product_id: "", qty: 1 }])}>+ Tambah Produk Komponen</Button>
                </div>
                <div className="flex gap-2 justify-end pt-4 border-t border-border"><Button variant="ghost" type="button" onClick={() => setShowAddBundle(false)}>Batal</Button><Button type="submit">Simpan Resep Bundle</Button></div>
              </form>
            </SectionCard>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {bundles.map((b) => {
              const comps = bundleComponents.filter((bc) => bc.bundle_id === b.id);
              return (
                <SectionCard key={b.id} title={b.name} action={<span className="font-mono text-xs bg-primary-light px-2 py-0.5 rounded text-primary">{b.sku}</span>}>
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-ink-soft uppercase">Resep Komponen:</span>
                    <ul className="divide-y divide-border text-xs">
                      {comps.map((c) => {
                        const prod = products.find((p) => p.id === c.product_id);
                        return <li key={c.id} className="py-2 flex justify-between font-mono"><span>{prod?.name || "Produk dihapus"} ({prod?.sku})</span><span className="font-bold">x{c.qty} pcs</span></li>;
                      })}
                    </ul>
                  </div>
                </SectionCard>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === "config" && (
        <SectionCard title="Atur Parameter Kedaluwarsa">
          <div className="space-y-4 max-w-md">
            <div>
              <p className="text-xs text-ink-soft mb-3 leading-relaxed">Tentukan batas jumlah hari sebelum kedaluwarsa di mana sistem akan menandai batch dengan status <strong>Warning</strong>.</p>
              <Input label="Ambang Batas Peringatan Expiry (Hari)" type="number" value={expiryThreshold} onChange={(e) => setExpiryThreshold(Math.max(1, parseInt(e.target.value) || 0))} disabled={!isAdmin} />
              {!isAdmin && <span className="text-[10px] text-danger font-semibold mt-1 block">* Hanya peran Admin yang dapat mengubah konfigurasi ini.</span>}
            </div>
            {isAdmin && <Button onClick={handleSaveConfig} className="w-full">Simpan Konfigurasi</Button>}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
