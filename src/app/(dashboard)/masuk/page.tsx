"use client";

import React, { useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";
import { SectionCard, Input, Select, Button } from "@/components/ui";
import { supabase } from "@/lib/supabase/client";
import { writeLedgerEntry } from "@/lib/ledger";
import type { Product } from "@/types";

export default function BarangMasukPage() {
  const { user } = useUser();
  const isReadOnly = user?.role === "owner";

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [batchCode, setBatchCode] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [quantity, setQuantity] = useState("");
  const [referenceId, setReferenceId] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from("products").select("*").eq("is_active", true).then(({ data }) => {
      if (data) setProducts(data);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (isReadOnly) {
      setError("Peran Anda hanya memiliki hak baca. Tidak dapat menginput barang masuk.");
      return;
    }

    if (!selectedProductId) {
      setError("Harap pilih produk.");
      return;
    }
    if (!batchCode.trim()) {
      setError("Harap isi Kode Batch.");
      return;
    }
    if (!expiryDate) {
      setError("Harap isi Tanggal Kedaluwarsa.");
      return;
    }
    
    const qtyNum = parseInt(quantity);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setError("Kuantitas harus berupa angka positif.");
      return;
    }

    setLoading(true);
    try {
      // 1. Check or Create Batch
      const { data: existingBatches } = await supabase
        .from("batches")
        .select("*")
        .eq("product_id", selectedProductId)
        .eq("batch_code", batchCode.trim().toUpperCase());

      let targetBatch = existingBatches && existingBatches[0];

      if (!targetBatch) {
        const { data: newBatch, error: batchError } = await supabase
          .from("batches")
          .insert({
            product_id: selectedProductId,
            batch_code: batchCode.trim().toUpperCase(),
            expiry_date: expiryDate,
          })
          .select()
          .single();

        if (batchError || !newBatch) {
          throw new Error("Gagal mendaftarkan batch baru di database.");
        }
        targetBatch = newBatch;
      }

      // 2. Write to stock ledger
      const ref = referenceId.trim() || `PO-MAKLON-${Date.now().toString().slice(-6)}`;
      const ledgerEntry = await writeLedgerEntry(
        selectedProductId,
        targetBatch.id,
        qtyNum,
        "masuk_maklon",
        "system",
        ref
      );

      if (!ledgerEntry) {
        throw new Error("Gagal mencatat transaksi barang masuk di Buku Besar.");
      }

      setSelectedProductId("");
      setBatchCode("");
      setExpiryDate("");
      setQuantity("");
      setReferenceId("");
      
      setSuccess(`Stok barang masuk berhasil dicatat! (+${qtyNum} pcs pada batch ${targetBatch.batch_code})`);
    } catch (err: any) {
      setError(err.message || "Gagal melakukan pencatatan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <SectionCard title="Input Penerimaan Barang Masuk (Maklon)">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-danger-bg text-danger text-xs rounded border border-danger/30 font-semibold font-mono">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 bg-success-bg text-success text-xs rounded border border-success/30 font-semibold">
              {success}
            </div>
          )}

          <Select
            label="Pilih Produk"
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            options={[
              { value: "", label: "-- Pilih Produk --" },
              ...products.map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` })),
            ]}
            required
            disabled={isReadOnly || loading}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Kode Batch"
              placeholder="Contoh: BATCH-01"
              value={batchCode}
              onChange={(e) => setBatchCode(e.target.value)}
              required
              disabled={isReadOnly || loading}
            />

            <Input
              label="Tanggal Kedaluwarsa (Expiry Date)"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              required
              disabled={isReadOnly || loading}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Jumlah Kuantitas (Pcs)"
              type="number"
              min="1"
              placeholder="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              disabled={isReadOnly || loading}
            />

            <Input
              label="Nomor Referensi PO / Maklon (Opsional)"
              placeholder="Contoh: PO-2026-009"
              value={referenceId}
              onChange={(e) => setReferenceId(e.target.value)}
              disabled={isReadOnly || loading}
            />
          </div>

          <div className="pt-4 border-t border-border flex justify-end">
            <Button
              type="submit"
              disabled={isReadOnly || loading}
              className={isReadOnly ? "bg-ink-faint hover:bg-ink-faint text-white" : ""}
            >
              {isReadOnly ? "Read-Only (Tidak Dapat Menyimpan)" : loading ? "Memproses..." : "Catat Barang Masuk"}
            </Button>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}
