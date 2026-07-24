"use client";

import React, { useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";
import { SectionCard, Input, Select, Button, Alert } from "@/components/ui";
import { supabase } from "@/lib/supabase/client";
import { writeLedgerEntry, getStockForProduct } from "@/lib/ledger";
import { allocateBatchFefo } from "@/lib/fefo";
import type { Product, LedgerReason } from "@/types";

export default function ManualPage() {
  const { user } = useUser();
  const isReadOnly = user?.role === "owner";

  const [products, setProducts] = useState<Product[]>([]);
  
  // 1. Barang Masuk (Maklon) State
  const [masukProductId, setMasukProductId] = useState("");
  const [masukBatchCode, setMasukBatchCode] = useState("");
  const [masukExpiryDate, setMasukExpiryDate] = useState("");
  const [masukQty, setMasukQty] = useState("");
  const [masukRef, setMasukRef] = useState("");
  const [masukError, setMasukError] = useState("");
  const [masukSuccess, setMasukSuccess] = useState("");
  const [masukLoading, setMasukLoading] = useState(false);

  // 2. Barang Keluar Manual State
  const [keluarProductId, setKeluarProductId] = useState("");
  const [keluarReason, setKeluarReason] = useState<LedgerReason>("bonus");
  const [keluarQty, setKeluarQty] = useState("");
  const [keluarRef, setKeluarRef] = useState("");
  const [keluarStock, setKeluarStock] = useState<number | null>(null);
  const [keluarError, setKeluarError] = useState("");
  const [keluarSuccess, setKeluarSuccess] = useState("");
  const [keluarLoading, setKeluarLoading] = useState(false);

  // Screen confirmation state (intentional friction before commit)
  const [confirmData, setConfirmData] = useState<{
    type: "masuk" | "keluar";
    productName: string;
    qty: number;
    reason: string;
    channel: string;
    dampak: string;
    action: () => Promise<void>;
  } | null>(null);

  useEffect(() => {
    supabase.from("products").select("*").eq("is_active", true).then(({ data }) => {
      if (data) setProducts(data);
    });
  }, []);

  // Fetch stock when selected product for manual outbound changes
  useEffect(() => {
    if (keluarProductId) {
      getStockForProduct(keluarProductId).then((stk) => {
        setKeluarStock(stk);
      });
    } else {
      setKeluarStock(null);
    }
  }, [keluarProductId]);

  // 1. Handle Barang Masuk Submit (Friction confirmation first)
  const handleMasukSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMasukError("");
    setMasukSuccess("");

    if (isReadOnly) {
      setMasukError("Peran Anda hanya memiliki hak baca.");
      return;
    }
    if (!masukProductId) {
      setMasukError("Harap pilih produk.");
      return;
    }
    if (!masukBatchCode.trim()) {
      setMasukError("Harap isi Kode Batch.");
      return;
    }
    if (!masukExpiryDate) {
      setMasukError("Harap isi Tanggal Kedaluwarsa.");
      return;
    }

    const qtyVal = parseInt(masukQty);
    if (isNaN(qtyVal) || qtyVal <= 0) {
      setMasukError("Kuantitas harus berupa angka positif.");
      return;
    }

    // Trigger confirmation screen
    setConfirmData({
      type: "masuk",
      productName: products.find(p => p.id === masukProductId)?.name || "Produk",
      qty: qtyVal,
      reason: "Barang Masuk Maklon",
      channel: "System",
      dampak: `Stok fisik & aman dijual bertambah (+${qtyVal} unit)`,
      action: async () => {
        setMasukLoading(true);
        try {
          // Check or create batch
          const { data: existingBatches } = await supabase
            .from("batches")
            .select("*")
            .eq("product_id", masukProductId)
            .eq("batch_code", masukBatchCode.trim().toUpperCase());

          let targetBatch = existingBatches && existingBatches[0];

          if (!targetBatch) {
            const { data: newBatch, error: batchError } = await supabase
              .from("batches")
              .insert({
                product_id: masukProductId,
                batch_code: masukBatchCode.trim().toUpperCase(),
                expiry_date: masukExpiryDate,
              })
              .select()
              .single();

            if (batchError || !newBatch) {
              throw new Error("Gagal mendaftarkan batch baru di database.");
            }
            targetBatch = newBatch;
          }

          // Write entry to stock ledger
          const ref = masukRef.trim() || `PO-MAKLON-${Date.now().toString().slice(-6)}`;
          const ledgerEntry = await writeLedgerEntry(
            masukProductId,
            targetBatch.id,
            qtyVal,
            "masuk_maklon",
            "system",
            ref
          );

          if (!ledgerEntry) {
            throw new Error("Gagal mencatat transaksi barang masuk di Buku Besar.");
          }

          setMasukProductId("");
          setMasukBatchCode("");
          setMasukExpiryDate("");
          setMasukQty("");
          setMasukRef("");
          setMasukSuccess(`Penerimaan barang masuk dicatat! (+${qtyVal} pcs pada batch ${targetBatch.batch_code})`);
        } catch (err: any) {
          setMasukError(err.message || "Gagal mencatat barang masuk.");
        } finally {
          setMasukLoading(false);
        }
      }
    });
  };

  // 2. Handle Barang Keluar Manual Submit (Friction confirmation first)
  const handleKeluarSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setKeluarError("");
    setKeluarSuccess("");

    if (isReadOnly) {
      setKeluarError("Peran Anda hanya memiliki hak baca.");
      return;
    }
    if (!keluarProductId) {
      setKeluarError("Harap pilih produk.");
      return;
    }

    const qtyVal = parseInt(keluarQty);
    if (isNaN(qtyVal) || qtyVal <= 0) {
      setKeluarError("Kuantitas harus berupa angka positif.");
      return;
    }

    // WAJIB referensi khusus jika alasan bonus / promo
    const isCampaignReason = keluarReason === "bonus" || keluarReason === "promo";
    if (isCampaignReason && !keluarRef.trim()) {
      setKeluarError("Nomor referensi / nama campaign wajib diisi untuk alasan Bonus atau Promo.");
      return;
    }

    try {
      const currentStock = await getStockForProduct(keluarProductId);
      if (currentStock < qtyVal) {
        setKeluarError(`Stok tidak mencukupi. Stok saat ini: ${currentStock} pcs, diminta: ${qtyVal} pcs.`);
        return;
      }

      // Trigger confirmation screen
      setConfirmData({
        type: "keluar",
        productName: products.find(p => p.id === keluarProductId)?.name || "Produk",
        qty: qtyVal,
        reason: getReasonLabel(keluarReason),
        channel: "Manual",
        dampak: `Stok fisik & aman dijual berkurang (-${qtyVal} unit)`,
        action: async () => {
          setKeluarLoading(true);
          try {
            // Run FEFO allocation
            const allocations = await allocateBatchFefo(keluarProductId, qtyVal);

            // Write ledger entries
            const ref = keluarRef.trim() || `MAN-OUT-${Date.now().toString().slice(-6)}`;
            await Promise.all(
              allocations.map(async (alloc) => {
                await writeLedgerEntry(
                  keluarProductId,
                  alloc.batchId,
                  -alloc.allocatedQty,
                  keluarReason,
                  "manual",
                  ref
                );
              })
            );

            setKeluarProductId("");
            setKeluarQty("");
            setKeluarRef("");
            setKeluarReason("bonus");
            setKeluarStock(null);

            const splitInfo = allocations.map((a) => `batch ${a.batchCode} (-${a.allocatedQty} pcs)`).join(", ");
            setKeluarSuccess(`Barang keluar berhasil dicatat! Total -${qtyVal} pcs dialokasikan ke: ${splitInfo}.`);
          } catch (err: any) {
            setKeluarError(err.message || "Gagal memotong stok.");
          } finally {
            setKeluarLoading(false);
          }
        }
      });
    } catch (err: any) {
      setKeluarError("Gagal memeriksa ketersediaan stok.");
    }
  };

  const getReasonLabel = (reason: string) => {
    switch (reason) {
      case "bonus": return "Bonus (Hadiah Pelanggan)";
      case "promo": return "Promo Kampanye";
      case "sampel": return "Sampel Review / R&D";
      case "penjualan_offline": return "Penjualan Offline";
      case "rusak": return "Barang Rusak / Cacat Fisik";
      case "kedaluwarsa": return "Barang Kedaluwarsa";
      default: return reason;
    }
  };

  return (
    <div className="space-y-6">
      {/* Informative Warning Alert */}
      <Alert variant="warning">
        <span>⚠️</span>
        <span>
          <strong>PENTING:</strong> Pengeluaran manual untuk bonus, promo, atau sampel adalah sumber selisih stok terbesar. Pastikan untuk mengisi kolom <strong>Alasan</strong> dan <strong>Referensi</strong> secara lengkap demi kebenaran audit Buku Besar.
        </span>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Panel 1: Barang Masuk (Maklon) */}
        <SectionCard title="Input Penerimaan Barang Masuk (Maklon)">
          <form onSubmit={handleMasukSubmit} className="space-y-4">
            {masukError && (
              <div className="p-3 bg-danger-bg text-danger text-xs rounded border border-danger/30 font-semibold font-mono">
                {masukError}
              </div>
            )}
            {masukSuccess && (
              <div className="p-3 bg-success-bg text-success text-xs rounded border border-success/30 font-semibold">
                {masukSuccess}
              </div>
            )}

            <Select
              label="Pilih Produk"
              value={masukProductId}
              onChange={(e) => setMasukProductId(e.target.value)}
              options={[
                { value: "", label: "-- Pilih Produk --" },
                ...products.map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` })),
              ]}
              required
              disabled={isReadOnly || masukLoading}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Kode Batch Baru"
                placeholder="Contoh: B-DNA-0512-B"
                value={masukBatchCode}
                onChange={(e) => setMasukBatchCode(e.target.value)}
                required
                disabled={isReadOnly || masukLoading}
              />
              <Input
                label="Tanggal Kedaluwarsa"
                type="date"
                value={masukExpiryDate}
                onChange={(e) => setMasukExpiryDate(e.target.value)}
                required
                disabled={isReadOnly || masukLoading}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Jumlah Diterima (Pcs)"
                type="number"
                min="1"
                placeholder="0"
                value={masukQty}
                onChange={(e) => setMasukQty(e.target.value)}
                required
                disabled={isReadOnly || masukLoading}
              />
              <Input
                label="Referensi PO / Maklon"
                placeholder="Contoh: PO-MAKLON-002"
                value={masukRef}
                onChange={(e) => setMasukRef(e.target.value)}
                disabled={isReadOnly || masukLoading}
              />
            </div>

            <div className="pt-4 border-t border-border flex justify-end">
              <Button type="submit" disabled={isReadOnly || masukLoading}>
                {masukLoading ? "Memproses..." : "Catat Barang Masuk"}
              </Button>
            </div>
          </form>
        </SectionCard>

        {/* Panel 2: Barang Keluar Manual */}
        <SectionCard title="Input Pengeluaran Stok Manual">
          <form onSubmit={handleKeluarSubmit} className="space-y-4">
            {keluarError && (
              <div className="p-3 bg-danger-bg text-danger text-xs rounded border border-danger/30 font-semibold font-mono">
                {keluarError}
              </div>
            )}
            {keluarSuccess && (
              <div className="p-3 bg-success-bg text-success text-xs rounded border border-success/30 font-semibold">
                {keluarSuccess}
              </div>
            )}

            <Select
              label="Pilih Produk"
              value={keluarProductId}
              onChange={(e) => setKeluarProductId(e.target.value)}
              options={[
                { value: "", label: "-- Pilih Produk --" },
                ...products.map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` })),
              ]}
              required
              disabled={isReadOnly || keluarLoading}
            />

            {keluarStock !== null && (
              <div className="p-3 bg-primary-light text-ink text-xs rounded font-mono">
                Stok Fisik Tersedia: <strong>{keluarStock} pcs</strong> (Alokasi otomatis via FEFO)
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Alasan Pengeluaran"
                value={keluarReason}
                onChange={(e) => setKeluarReason(e.target.value as LedgerReason)}
                options={[
                  { value: "bonus", label: "Bonus (Hadiah Pelanggan)" },
                  { value: "promo", label: "Promo Kampanye" },
                  { value: "sampel", label: "Sampel Review / R&D" },
                  { value: "penjualan_offline", label: "Penjualan Offline" },
                  { value: "rusak", label: "Barang Rusak / Cacat Fisik" },
                  { value: "kedaluwarsa", label: "Barang Kedaluwarsa" },
                ]}
                required
                disabled={isReadOnly || keluarLoading}
              />
              <Input
                label="Jumlah Kuantitas Keluar (Pcs)"
                type="number"
                min="1"
                placeholder="0"
                value={keluarQty}
                onChange={(e) => setKeluarQty(e.target.value)}
                required
                disabled={isReadOnly || keluarLoading}
              />
            </div>

            <Input
              label={`Nomor Referensi / Nama Campaign ${keluarReason === "bonus" || keluarReason === "promo" ? "(WAJIB)" : "(Opsional)"}`}
              placeholder="Contoh: KAMPANYE-IG-JULI / GIFT-ORDER-12"
              value={keluarRef}
              onChange={(e) => setKeluarRef(e.target.value)}
              required={keluarReason === "bonus" || keluarReason === "promo"}
              disabled={isReadOnly || keluarLoading}
            />

            <div className="pt-4 border-t border-border flex justify-end">
              <Button type="submit" disabled={isReadOnly || keluarLoading}>
                {keluarLoading ? "Memproses..." : "Catat Barang Keluar"}
              </Button>
            </div>
          </form>
        </SectionCard>
      </div>

      {/* Confirmation Modal Overlay (Intentional Friction) */}
      {confirmData && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-white border-2 border-primary max-w-md w-full rounded-md p-6 space-y-4 shadow-xl">
            <h3 className="font-heading text-lg font-bold text-ink border-b border-border pb-2">
              Konfirmasi Transaksi Permanen
            </h3>
            
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-ink-soft block uppercase tracking-wider font-semibold">Produk:</span>
                <span className="text-sm font-bold text-ink">{confirmData.productName}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-ink-soft block uppercase tracking-wider font-semibold">Jumlah (Qty):</span>
                  <span className="text-sm font-bold text-primary font-mono">{confirmData.qty} unit</span>
                </div>
                <div>
                  <span className="text-ink-soft block uppercase tracking-wider font-semibold">Alasan:</span>
                  <span className="text-sm font-bold text-ink">{confirmData.reason}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-ink-soft block uppercase tracking-wider font-semibold">Kanal:</span>
                  <span className="text-sm font-bold text-ink">{confirmData.channel}</span>
                </div>
                <div>
                  <span className="text-ink-soft block uppercase tracking-wider font-semibold">Dampak Stok:</span>
                  <span className="text-sm font-bold text-success font-mono">{confirmData.dampak}</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-danger-bg text-danger text-[11px] font-semibold rounded border border-danger/25">
              ⚠️ Peringatan: Tindakan ini permanen dan akan langsung dicatat ke Buku Besar append-only. Catatan transaksi tidak dapat diubah atau dihapus setelah dikomit.
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-border">
              <Button variant="ghost" disabled={keluarLoading || masukLoading} onClick={() => setConfirmData(null)}>
                Batal
              </Button>
              <Button variant="primary" disabled={keluarLoading || masukLoading} onClick={async () => {
                await confirmData.action();
                setConfirmData(null);
              }}>
                {keluarLoading || masukLoading ? "Menyimpan..." : "Konfirmasi & Komit"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
