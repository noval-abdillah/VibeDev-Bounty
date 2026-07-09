"use client";

import React, { useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";
import { SectionCard, Input, Select, Button } from "@/components/ui";
import { supabase } from "@/lib/supabase/client";
import { writeLedgerEntry, getStockForProduct } from "@/lib/ledger";
import { allocateBatchFefo } from "@/lib/fefo";
import type { Product, LedgerReason } from "@/types";

export default function KeluarManualPage() {
  const { user } = useUser();
  const isReadOnly = user?.role === "owner";

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedReason, setSelectedReason] = useState<LedgerReason>("bonus");
  const [quantity, setQuantity] = useState("");
  const [referenceId, setReferenceId] = useState("");
  const [availableStock, setAvailableStock] = useState<number | null>(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from("products").select("*").eq("is_active", true).then(({ data }) => {
      if (data) setProducts(data);
    });
  }, []);

  useEffect(() => {
    if (selectedProductId) {
      getStockForProduct(selectedProductId).then((stk) => {
        setAvailableStock(stk);
      });
    } else {
      setAvailableStock(null);
    }
  }, [selectedProductId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (isReadOnly) {
      setError("Peran Anda hanya memiliki hak baca. Tidak dapat menginput keluar manual.");
      return;
    }

    if (!selectedProductId) {
      setError("Harap pilih produk.");
      return;
    }

    const qtyNum = parseInt(quantity);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setError("Kuantitas harus berupa angka positif.");
      return;
    }

    setLoading(true);
    try {
      const currentStock = await getStockForProduct(selectedProductId);
      if (currentStock < qtyNum) {
        setError(`Stok tidak mencukupi. Stok saat ini: ${currentStock} pcs, diminta: ${qtyNum} pcs.`);
        setLoading(false);
        return;
      }

      // 1. Run FEFO allocation to get which batches to deduct
      const allocations = await allocateBatchFefo(selectedProductId, qtyNum);

      // 2. Write ledger entries (negative quantity)
      const ref = referenceId.trim() || `MAN-OUT-${Date.now().toString().slice(-6)}`;
      
      await Promise.all(
        allocations.map(async (alloc) => {
          await writeLedgerEntry(
            selectedProductId,
            alloc.batchId,
            -alloc.allocatedQty,
            selectedReason,
            "manual",
            ref
          );
        })
      );

      // Reset
      setSelectedProductId("");
      setQuantity("");
      setReferenceId("");
      setSelectedReason("bonus");
      setAvailableStock(null);

      const splitInfo = allocations
        .map((a) => `batch ${a.batchCode} (-${a.allocatedQty} pcs)`)
        .join(", ");
      setSuccess(`Keluaran manual berhasil dicatat! Total -${qtyNum} pcs dialokasikan ke: ${splitInfo}.`);
    } catch (err: any) {
      setError(err.message || "Gagal melakukan alokasi FEFO.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <SectionCard title="Input Pengeluaran Stok Manual">
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

          {availableStock !== null && (
            <div className="p-3 bg-primary-light text-primary text-xs rounded font-mono">
              Stok Tersedia di Sistem: <strong>{availableStock} pcs</strong> (Alokasi otomatis dengan prinsip FEFO)
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Alasan Pengeluaran"
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value as LedgerReason)}
              options={[
                { value: "bonus", label: "Bonus (Hadiah Pelanggan)" },
                { value: "promo", label: "Promo Kampanye" },
                { value: "sampel", label: "Sampel Review / R&D" },
                { value: "penjualan_offline", label: "Penjualan Offline" },
                { value: "rusak", label: "Barang Rusak / Cacat Fisik" },
                { value: "kedaluwarsa", label: "Barang Kedaluwarsa" },
              ]}
              required
              disabled={isReadOnly || loading}
            />

            <Input
              label="Jumlah Kuantitas Keluar (Pcs)"
              type="number"
              min="1"
              placeholder="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              disabled={isReadOnly || loading}
            />
          </div>

          <Input
            label="Nomor Referensi Transaksi / Keperluan (Opsional)"
            placeholder="Contoh: KAMPANYE-IG-JULI"
            value={referenceId}
            disabled={isReadOnly || loading}
          />

          <div className="pt-4 border-t border-border flex justify-end">
            <Button
              type="submit"
              disabled={isReadOnly || loading}
              className={isReadOnly ? "bg-ink-faint hover:bg-ink-faint text-white" : ""}
            >
              {isReadOnly ? "Read-Only (Tidak Dapat Menyimpan)" : loading ? "Memproses..." : "Catat Barang Keluar"}
            </Button>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}
