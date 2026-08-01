"use client";

import React, { useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";
import { SectionCard, Button, Tag, Input, Select } from "@/components/ui";
import { supabase } from "@/lib/supabase/client";
import { exportToXlsx } from "@/lib/export";
import type { ExportColumn, ExportSheet } from "@/lib/export";
import type { Product, Bundle, BundleComponent } from "@/types";
import Link from "next/link";
import { useToast } from "@/context/ToastContext";
import { compressImage } from "@/lib/image";
import { Package, UploadCloud, X } from "lucide-react";

interface ProdukClientProps {
  serverProducts: any[];
  serverBundles: any[];
  serverBundleComponents: any[];
  serverPendingOrders: any[];
}

export function ProdukClient({ serverProducts, serverBundles, serverBundleComponents, serverPendingOrders }: ProdukClientProps) {
  const { user } = useUser();
  const { showToast } = useToast();
  const isAdmin = user?.role === "admin" || user?.role === "owner";
  const isReadOnly = user?.role === "gudang";

  // Helper helper to normalize incoming products consistently
  const normalizeProducts = (rawProducts: any[]) => {
    return rawProducts.map((p: any) => ({
      id: p.product_id || p.id,
      name: p.name,
      sku: p.sku,
      image_url: p.image_url || null,
      is_active: p.is_active,
      created_at: p.created_at
    }));
  };

  // Helper helper to compute stocks map safely
  const computeStocks = (rawProducts: any[]) => {
    const stocks: Record<string, number> = {};
    rawProducts.forEach((p: any) => {
      const id = p.product_id || p.id;
      stocks[id] = p.total_stock !== undefined ? p.total_stock : 0;
    });
    return stocks;
  };

  // Helper helper to compute reservations map safely
  const computeReservations = (rawProducts: any[], pendingOrders: any[], bundlesList: any[], bundleComps: any[]) => {
    const reservations: Record<string, number> = {};
    rawProducts.forEach((p: any) => {
      const id = p.product_id || p.id;
      let resQty = 0;
      pendingOrders.forEach((o: any) => {
        if (o.sku.toUpperCase() === p.sku.toUpperCase()) {
          resQty += o.qty;
        } else {
          const bundle = bundlesList.find((b: any) => b.sku.toUpperCase() === o.sku.toUpperCase());
          if (bundle) {
            const comps = (bundleComps as BundleComponent[]).filter((bc) => bc.bundle_id === bundle.id);
            const matchedComp = comps.find((c) => c.product_id === id);
            if (matchedComp) {
              resQty += matchedComp.qty * o.qty;
            }
          }
        }
      });
      reservations[id] = resQty;
    });
    return reservations;
  };

  const [activeTab, setActiveTab] = useState<"produk" | "bundle" | "config">("produk");
  const [products, setProducts] = useState<any[]>(() => normalizeProducts(serverProducts));
  const [productStocks, setProductStocks] = useState<Record<string, number>>(() => computeStocks(serverProducts));
  const [productReservations, setProductReservations] = useState<Record<string, number>>(() => computeReservations(serverProducts, serverPendingOrders, serverBundles, serverBundleComponents));
  const [bundles, setBundles] = useState<Bundle[]>(serverBundles);
  const [bundleComponents, setBundleComponents] = useState<BundleComponent[]>(serverBundleComponents as BundleComponent[]);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [hideZeroStock, setHideZeroStock] = useState(false);

  // Product form state
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [isSkuLocked, setIsSkuLocked] = useState(false);
  const [skuLockReason, setSkuLockReason] = useState("");
  const [newProductName, setNewProductName] = useState("");
  const [newProductSku, setNewProductSku] = useState("");
  const [newProductImage, setNewProductImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
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
    // Keep internal states synced when serverProducts or dependency props update
    setProducts(normalizeProducts(serverProducts));
    setProductStocks(computeStocks(serverProducts));
    setProductReservations(computeReservations(serverProducts, serverPendingOrders, serverBundles, serverBundleComponents));
    
    const storedThreshold = localStorage.getItem("stokledger_expiry_threshold");
    if (storedThreshold) setExpiryThreshold(parseInt(storedThreshold));
  }, [serverProducts, serverPendingOrders, serverBundles, serverBundleComponents]);

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;

    if (hideZeroStock) {
      const stock = productStocks[p.id] || 0;
      if (stock <= 0) return false;
    }

    return true;
  });

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName.trim() || !newProductSku.trim()) {
      setProductFormError("Nama dan SKU wajib diisi.");
      return;
    }

    if (editingProductId) {
      // MODE EDIT
      // Client-side SKU uniqueness validation before submitting edit
      const duplicateSku = products.some(
        (p) => p.id !== editingProductId && p.sku.toLowerCase() === newProductSku.trim().toLowerCase()
      );
      if (duplicateSku) {
        setProductFormError(`SKU ${newProductSku.toUpperCase()} sudah digunakan oleh produk lain. Gunakan SKU yang berbeda.`);
        showToast(`SKU ${newProductSku.toUpperCase()} sudah digunakan oleh produk lain.`, "danger");
        return;
      }

      setIsUploading(true);
      let finalImageUrl = existingImageUrl;

      if (newProductImage) {
        try {
          const compressedBlob = await compressImage(newProductImage);
          const fileName = `${newProductSku.toUpperCase()}-${Date.now()}.jpg`;

          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from("product-images")
            .upload(fileName, compressedBlob, {
              contentType: "image/jpeg",
              upsert: true,
            });

          if (uploadErr) {
            showToast("Upload gambar gagal, menyimpan tanpa mengubah gambar...", "warning");
          } else if (uploadData) {
            const { data: publicUrlData } = supabase.storage
              .from("product-images")
              .getPublicUrl(uploadData.path);
            finalImageUrl = publicUrlData?.publicUrl || null;
          }
        } catch (err: any) {
          showToast("Proses kompresi gambar gagal, menyimpan tanpa mengubah gambar...", "warning");
        }
      }

      // Hit API Edit
      try {
        const res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update_product",
            payload: {
              product_id: editingProductId,
              name: newProductName.trim(),
              sku: newProductSku.toUpperCase().trim(),
              image_url: finalImageUrl
            }
          })
        });

        const result = await res.json();
        if (!res.ok) {
          let msg = result.error || "Gagal mengubah data produk.";
          if (msg.toLowerCase().includes("fetch")) {
            msg = "Gagal terhubung ke server, periksa koneksi internet dan coba lagi.";
          }
          setProductFormError(msg);
          showToast(msg, "danger");
          setIsUploading(false);
          return;
        }

        showToast("Perubahan data produk berhasil disimpan.", "success");
        setNewProductName(""); 
        setNewProductSku(""); 
        setNewProductImage(null); 
        setImagePreview(null); 
        setExistingImageUrl(null);
        setEditingProductId(null);
        setIsSkuLocked(false);
        setSkuLockReason("");
        setProductFormError(""); 
        setShowAddProduct(false);

        // Refresh
        const { data: prods } = await supabase.from("product_stock_summary").select("*").order("name", { ascending: true });
        if (prods) {
          setProducts(prods.map((p: any) => ({
            id: p.product_id,
            name: p.name,
            sku: p.sku,
            image_url: p.image_url || null,
            is_active: p.is_active,
            created_at: p.created_at
          })));
          const stocks: Record<string, number> = {};
          prods.forEach((p: any) => { stocks[p.product_id] = p.total_stock; });
          setProductStocks(stocks);
        }
      } catch (err: any) {
        let msg = "Terjadi kesalahan saat menyimpan produk. Silakan coba lagi.";
        if (err.message?.toLowerCase().includes("fetch")) {
          msg = "Gagal terhubung ke server, periksa koneksi internet dan coba lagi.";
        }
        setProductFormError(msg);
        showToast(msg, "danger");
      } finally {
        setIsUploading(false);
      }
      return;
    }

    // MODE TAMBAH
    if (products.some((p) => p.sku.toLowerCase() === newProductSku.trim().toLowerCase())) {
      setProductFormError(`SKU ${newProductSku.toUpperCase()} sudah digunakan oleh produk lain. Gunakan SKU yang berbeda.`);
      showToast(`SKU ${newProductSku.toUpperCase()} sudah digunakan oleh produk lain.`, "danger");
      return;
    }

    setIsUploading(true);
    let finalImageUrl = null;

    if (newProductImage) {
      try {
        const compressedBlob = await compressImage(newProductImage);
        const fileName = `${newProductSku.toUpperCase()}-${Date.now()}.jpg`;

        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from("product-images")
          .upload(fileName, compressedBlob, {
            contentType: "image/jpeg",
            upsert: true,
          });

        if (uploadErr) {
          showToast("Upload gambar gagal, menyimpan produk tanpa gambar...", "warning");
        } else if (uploadData) {
          const { data: publicUrlData } = supabase.storage
            .from("product-images")
            .getPublicUrl(uploadData.path);
          finalImageUrl = publicUrlData?.publicUrl || null;
        }
      } catch (err: any) {
        showToast("Proses kompresi gambar gagal, menyimpan produk tanpa gambar...", "warning");
      }
    }

    try {
      const { data: newProd, error } = await supabase
        .from("products")
        .insert({ 
          name: newProductName.trim(), 
          sku: newProductSku.toUpperCase().trim(), 
          is_active: true,
          image_url: finalImageUrl
        })
        .select().single();

      if (error || !newProd) {
        let msg = "Terjadi kesalahan saat menyimpan produk. Silakan coba lagi.";
        if (error) {
          if (error.code === "23505") {
            msg = `SKU ${newProductSku.toUpperCase().trim()} sudah digunakan oleh produk lain. Gunakan SKU yang berbeda.`;
          } else if (error.code === "23502") {
            msg = "Field wajib tidak boleh kosong.";
          } else if (error.message?.toLowerCase().includes("fetch")) {
            msg = "Gagal terhubung ke server, periksa koneksi internet dan coba lagi.";
          }
        }
        setProductFormError(msg);
        showToast(msg, "danger");
        setIsUploading(false);
        return;
      }

      const { data: newBatch, error: batchErr } = await supabase.from("batches").insert({
        product_id: newProd.id,
        batch_code: `B-${newProd.sku}-01`,
        expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      }).select().single();

      if (newBatch) {
        await fetch("/api/ledger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create_ledger_entry",
            payload: {
              product_id: newProd.id,
              batch_id: newBatch.id,
              qty: 0,
              reason: "saldo_awal",
              channel: "system",
              reference_id: "PO-INIT-001",
            },
          }),
        });
      }

      showToast("Produk baru berhasil ditambahkan.", "success");
      setNewProductName(""); setNewProductSku(""); setNewProductImage(null); setImagePreview(null); setExistingImageUrl(null); setEditingProductId(null); setIsSkuLocked(false); setSkuLockReason(""); setProductFormError(""); setShowAddProduct(false);
      
      // Refresh
      const { data: prods } = await supabase.from("product_stock_summary").select("*").order("name", { ascending: true });
      if (prods) {
        setProducts(prods.map((p: any) => ({
          id: p.product_id,
          name: p.name,
          sku: p.sku,
          image_url: p.image_url || null,
          is_active: p.is_active,
          created_at: p.created_at
        })));
        const stocks: Record<string, number> = {};
        prods.forEach((p: any) => { stocks[p.product_id] = p.total_stock; });
        setProductStocks(stocks);
      }
    } catch (err: any) {
      let msg = "Terjadi kesalahan saat menyimpan produk. Silakan coba lagi.";
      if (err.message?.toLowerCase().includes("fetch")) {
        msg = "Gagal terhubung ke server, periksa koneksi internet dan coba lagi.";
      }
      setProductFormError(msg);
      showToast(msg, "danger");
    } finally {
      setIsUploading(false);
    }
  };

  const handleToggleProductActive = async (id: string, currentStatus: boolean) => {
    await supabase.from("products").update({ is_active: !currentStatus }).eq("id", id);
    const { data: prods } = await supabase.from("product_stock_summary").select("*").order("name", { ascending: true });
    if (prods) {
      setProducts(prods.map((p: any) => ({
        id: p.product_id,
        name: p.name,
        sku: p.sku,
        image_url: p.image_url || null,
        is_active: p.is_active,
        created_at: p.created_at
      })));
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
    showToast("Konfigurasi notifikasi berhasil disimpan.", "success");
  };

  const handleExportProduk = async () => {
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

    await exportToXlsx({
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
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
              <div className="w-full md:w-72">
                <Input placeholder="Cari nama atau SKU produk..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-ink-soft cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={hideZeroStock} 
                  onChange={(e) => setHideZeroStock(e.target.checked)} 
                  className="rounded border-border text-primary focus:ring-primary/20 w-4 h-4"
                />
                Sembunyikan produk stok kosong
              </label>
            </div>
            <div className="flex gap-2 w-full md:w-auto justify-end">
              <Button variant="ghost" onClick={handleExportProduk}>Ekspor Excel</Button>
              {isAdmin && <Button onClick={() => setShowAddProduct(true)}>+ Tambah Produk Baru</Button>}
            </div>
          </div>

          {showAddProduct && (
            <SectionCard title={editingProductId ? "Edit Produk" : "Tambah Produk Master Baru"}>
              <form onSubmit={handleAddProduct} className="space-y-4">
                {productFormError && <div className="p-3 bg-danger-bg text-danger text-xs rounded border border-danger/30 font-semibold font-mono">{productFormError}</div>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Nama Produk" placeholder="Contoh: Brightening Serum Niacinamide 10%" value={newProductName} onChange={(e) => setNewProductName(e.target.value)} required />
                  <div className="relative">
                    <Input 
                      label="SKU Produk (Kode Unik)" 
                      placeholder="Contoh: SK-SR-005" 
                      value={newProductSku} 
                      onChange={(e) => setNewProductSku(e.target.value)} 
                      required 
                      disabled={isSkuLocked}
                      className={isSkuLocked ? "bg-bg/80 text-ink-soft cursor-not-allowed opacity-75" : ""}
                    />
                    {isSkuLocked && (
                      <span className="text-[10px] text-warning font-semibold mt-1 block">
                        ⚠️ SKU tidak bisa diubah karena produk sudah memiliki riwayat transaksi/batch.
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Drag and Drop Image Upload */}
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-ink-soft/90">Gambar Produk (Opsional, Max 2MB)</span>
                  <div 
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files?.[0];
                      if (file && file.type.startsWith("image/")) {
                        if (file.size > 2 * 1024 * 1024) {
                          showToast("Ukuran file melebihi 2MB.", "warning");
                          return;
                        }
                        setNewProductImage(file);
                        setImagePreview(URL.createObjectURL(file));
                      } else {
                        showToast("Format berkas harus berupa gambar (jpg, png, webp).", "warning");
                      }
                    }}
                    className="border-2 border-dashed border-border/80 hover:border-primary/50 transition-all rounded-md p-6 flex flex-col items-center justify-center gap-2 cursor-pointer bg-bg/20"
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = "image/jpeg,image/png,image/webp";
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) {
                          if (file.size > 2 * 1024 * 1024) {
                            showToast("Ukuran file melebihi 2MB.", "warning");
                            return;
                          }
                          setNewProductImage(file);
                          setImagePreview(URL.createObjectURL(file));
                        }
                      };
                      input.click();
                    }}
                  >
                    {imagePreview ? (
                      <div className="relative w-24 h-24 rounded border border-border overflow-hidden group pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                        <button 
                          type="button" 
                          onClick={() => { setNewProductImage(null); setImagePreview(null); }}
                          className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white rounded-full w-8 h-8 m-auto"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <UploadCloud className="w-8 h-8 text-ink-faint animate-bounce-slow" />
                        <span className="text-xs font-semibold text-ink-soft">Tarik & Lepas atau Klik untuk unggah gambar</span>
                        <span className="text-[10px] text-ink-faint">Mendukung JPG, PNG, WEBP hingga 2MB</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <Button variant="ghost" type="button" disabled={isUploading} onClick={() => { 
                    setShowAddProduct(false); 
                    setEditingProductId(null);
                    setNewProductName("");
                    setNewProductSku("");
                    setNewProductImage(null); 
                    setImagePreview(null); 
                    setExistingImageUrl(null);
                    setIsSkuLocked(false);
                    setSkuLockReason("");
                  }}>Batal</Button>
                  <Button type="submit" disabled={isUploading}>
                    {isUploading ? "Mengunggah..." : editingProductId ? "Simpan Perubahan" : "Simpan Produk"}
                  </Button>
                </div>
              </form>
            </SectionCard>
          )}

          <SectionCard>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border text-xs font-semibold text-ink-soft uppercase bg-bg/50">
                    <th className="py-3 px-4 w-16">Foto</th>
                    <th className="py-3 px-4">Nama Produk</th>
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4 text-right">Stok Fisik</th>
                    <th className="py-3 px-4 text-right">Reservasi</th>
                    <th className="py-3 px-4 text-right">Aman Dijual</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-sm">
                  {filteredProducts.map((p) => {
                    const stock = productStocks[p.id] || 0;
                    const reservation = productReservations[p.id] || 0;
                    const safeToSell = stock - reservation;

                    return (
                      <tr key={p.id} className={`hover:bg-bg/10 transition-colors ${!p.is_active ? "opacity-55" : ""}`}>
                        <td className="py-3 px-4">
                          <div className="w-10 h-10 rounded-sm border border-border/80 bg-bg/30 flex items-center justify-center overflow-hidden">
                            {p.image_url ? (
                              <img 
                                src={p.image_url} 
                                alt={p.name} 
                                className="w-full h-full object-cover" 
                                loading="lazy"
                              />
                            ) : (
                              <Package className="w-5 h-5 text-ink-faint" />
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Link href={`/produk/${p.id}`} className="font-heading font-semibold text-primary hover:underline">
                            {p.name}
                          </Link>
                        </td>
                        <td className="py-3 px-4 font-mono">{p.sku}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold">{stock.toLocaleString("id-ID")}</td>
                        <td className="py-3 px-4 text-right font-mono text-ink-soft">{reservation.toLocaleString("id-ID")}</td>
                        <td className="py-3 px-4 text-right font-mono">
                          <Tag variant={safeToSell > 0 ? "success" : "neutral"} className="font-bold text-[12px]">
                            {safeToSell.toLocaleString("id-ID")}
                          </Tag>
                        </td>
                        <td className="py-3 px-4">
                          {p.is_active ? (
                            <Tag variant="success">AKTIF</Tag>
                          ) : (
                            <Tag variant="neutral">NONAKTIF</Tag>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center space-x-2 whitespace-nowrap">
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              className="px-2.5 py-1 hover:border-primary/50"
                              onClick={async () => {
                                setEditingProductId(p.id);
                                setNewProductName(p.name);
                                setNewProductSku(p.sku);
                                setExistingImageUrl(p.image_url);
                                setImagePreview(p.image_url);
                                setShowAddProduct(true);
                                
                                // Real-time check to API if SKU should be locked
                                try {
                                  const res = await fetch("/api/products", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      action: "check_sku_locked",
                                      payload: { product_id: p.id }
                                    })
                                  });
                                  const data = await res.json();
                                  if (data.locked) {
                                    setIsSkuLocked(true);
                                    setSkuLockReason(data.reason);
                                  } else {
                                    setIsSkuLocked(false);
                                    setSkuLockReason("");
                                  }
                                } catch (err) {
                                  setIsSkuLocked(false);
                                }
                              }}
                            >
                              Edit
                            </Button>
                          )}
                          <Link href={`/produk/${p.id}`}><Button variant="ghost" className="px-2.5 py-1">Detail &amp; Batch</Button></Link>
                          {isAdmin && (
                            <Button
                              variant={p.is_active ? "danger" : "success"}
                              className="px-2.5 py-1"
                              onClick={() => handleToggleProductActive(p.id, p.is_active)}
                            >
                              {p.is_active ? "Nonaktifkan" : "Aktifkan"}
                            </Button>
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
