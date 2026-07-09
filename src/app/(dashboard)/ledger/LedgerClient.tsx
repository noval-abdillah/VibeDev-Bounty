"use client";

import React, { useState } from "react";
import { SectionCard, Tag, Input, Select, Button } from "@/components/ui";
import { exportToXlsx, getReasonLabel, getChannelLabel, formatDate } from "@/lib/export";
import type { ExportColumn, ExportSheet } from "@/lib/export";

interface LedgerClientProps {
  serverProducts: any[];
  serverBatches: any[];
  serverLedger: any[];
}

export function LedgerClient({ serverProducts, serverBatches, serverLedger }: LedgerClientProps) {
  const [products] = useState(serverProducts);
  const [batches] = useState(serverBatches);
  const [ledgerEntries] = useState(serverLedger);

  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedReason, setSelectedReason] = useState("");
  const [selectedChannel, setSelectedChannel] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

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

  const filteredEntries = ledgerEntries.filter((e: any) => {
    if (selectedProduct && e.product_id !== selectedProduct) return false;
    if (selectedReason && e.reason !== selectedReason) return false;
    if (selectedChannel && e.channel !== selectedChannel) return false;
    
    if (startDate) {
      const start = new Date(startDate).getTime();
      const entryTime = new Date(e.created_at).getTime();
      if (entryTime < start) return false;
    }
    
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      const entryTime = new Date(e.created_at).getTime();
      if (entryTime > end.getTime()) return false;
    }

    return true;
  });

  const handleResetFilters = () => {
    setSelectedProduct("");
    setSelectedReason("");
    setSelectedChannel("");
    setStartDate("");
    setEndDate("");
  };

  const handleExportXlsx = () => {
    const now = new Date();
    const today = now.toISOString().split("T")[0];

    const columns: ExportColumn[] = [
      { header: "Waktu Transaksi", key: "waktu", width: 20 },
      { header: "Nama Produk", key: "produk", width: 35 },
      { header: "SKU", key: "sku", width: 15 },
      { header: "Kode Batch", key: "batch", width: 18 },
      { header: "Alasan Pergerakan", key: "alasan", width: 22 },
      { header: "Channel", key: "channel", width: 14 },
      { header: "No. Referensi", key: "referensi", width: 22 },
      { header: "Qty (+/-)", key: "qty", width: 12 },
    ];

    const rows = filteredEntries.map((e: any) => {
      const prod = products.find((p: any) => p.id === e.product_id);
      const batch = batches.find((b: any) => b.id === e.batch_id);
      return {
        waktu: formatDate(e.created_at),
        produk: prod?.name || "Produk Tidak Dikenal",
        sku: prod?.sku || "-",
        batch: batch?.batch_code || e.batch_id,
        alasan: getReasonLabel(e.reason),
        channel: getChannelLabel(e.channel),
        referensi: e.reference_id,
        qty: e.qty > 0 ? `+${e.qty}` : `${e.qty}`,
      };
    });

    const totalMasuk = rows.filter((r) => parseInt(r.qty) > 0).length;
    const totalKeluar = rows.filter((r) => parseInt(r.qty) < 0).length;
    const sumMasuk = filteredEntries.filter((e: any) => e.qty > 0).reduce((s: number, e: any) => s + e.qty, 0);
    const sumKeluar = Math.abs(filteredEntries.filter((e: any) => e.qty < 0).reduce((s: number, e: any) => s + e.qty, 0));

    const ledgerSheet: ExportSheet = {
      name: "Data Transaksi",
      columns,
      rows,
      summaryRows: [
        { label: "Total Transaksi", value: `${rows.length} baris` },
        { label: "Transaksi Masuk", value: `${totalMasuk} (${sumMasuk.toLocaleString("id-ID")} unit)` },
        { label: "Transaksi Keluar", value: `${totalKeluar} (${sumKeluar.toLocaleString("id-ID")} unit)` },
        { label: "Periode Data", value: rows.length > 0 ? `${formatDate(filteredEntries[filteredEntries.length - 1]?.created_at)} — ${formatDate(filteredEntries[0]?.created_at)}` : "-" },
        { label: "Diekspor Pada", value: now.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) },
      ],
    };

    exportToXlsx({
      title: "Buku Besar StokLedger",
      fileName: `StokLedger_BukuBesar_${today}`,
      sheets: [ledgerSheet],
    });
  };

  return (
    <div className="space-y-6">
      <SectionCard title="Filter Buku Besar">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Select
            label="Produk"
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
            options={[
              { value: "", label: "-- Semua Produk --" },
              ...products.map((p: any) => ({ value: p.id, label: `${p.name} (${p.sku})` })),
            ]}
          />
          <Select
            label="Alasan Pergerakan"
            value={selectedReason}
            onChange={(e) => setSelectedReason(e.target.value)}
            options={[
              { value: "", label: "-- Semua Alasan --" },
              { value: "saldo_awal", label: "Saldo Awal Produk" },
              { value: "masuk_maklon", label: "Barang Masuk Maklon" },
              { value: "penjualan_offline", label: "Penjualan Offline" },
              { value: "bonus", label: "Keluar Bonus" },
              { value: "promo", label: "Keluar Promo" },
              { value: "sampel", label: "Keluar Sampel" },
              { value: "rusak", label: "Barang Rusak" },
              { value: "kedaluwarsa", label: "Kedaluwarsa" },
              { value: "pesanan_shopee", label: "Pesanan Shopee" },
              { value: "pesanan_tiktok", label: "Pesanan TikTok" },
              { value: "retur_shopee", label: "Retur Shopee" },
              { value: "retur_tiktok", label: "Retur TikTok" },
              { value: "opname_koreksi", label: "Koreksi Stok Opname" },
            ]}
          />
          <Select
            label="Channel"
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
            options={[
              { value: "", label: "-- Semua Channel --" },
              { value: "shopee", label: "Shopee" },
              { value: "tiktok", label: "TikTok" },
              { value: "manual", label: "Manual" },
              { value: "system", label: "System" },
            ]}
          />
          <Input
            label="Tanggal Mulai"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Input
            label="Tanggal Selesai"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div className="flex gap-2 justify-end mt-4 pt-3 border-t border-border/60">
          <Button variant="ghost" onClick={handleResetFilters}>
            Atur Ulang Filter
          </Button>
          <Button variant="primary" onClick={handleExportXlsx}>
            Ekspor Excel
          </Button>
        </div>
      </SectionCard>

      <SectionCard title={`Catatan Transaksi (${filteredEntries.length} pergerakan)`}>
        <div className="border border-border rounded-md overflow-hidden bg-[#FAFAF9]">
          <div className="px-4 py-3 bg-white border-b border-border flex justify-between text-xs font-bold text-ink-soft">
            <span>PRODUK &amp; DETAIL TRANSAKSI</span>
            <span className="text-right">JUMLAH (QTY)</span>
          </div>
          <div className="divide-y divide-dashed divide-border-strong">
            {filteredEntries.length === 0 ? (
              <div className="p-8 text-center text-xs text-ink-faint font-mono">
                Tidak ada entri Buku Besar yang cocok dengan filter.
              </div>
            ) : (
              filteredEntries.map((e: any) => {
                const prod = products.find((p: any) => p.id === e.product_id);
                const batch = batches.find((b: any) => b.id === e.batch_id);
                const isPositive = e.qty > 0;

                return (
                  <div key={e.id} className="p-4 hover:bg-white transition-colors duration-100 flex justify-between items-center gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold ${isPositive ? "text-success" : "text-danger"}`}>
                          {isPositive ? "▲" : "▼"}
                        </span>
                        <span className="text-xs font-bold text-ink font-heading">{prod?.name || "Produk dihapus"}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-soft">
                        <span className="font-mono text-ink">SKU: {prod?.sku}</span>
                        <span>&bull;</span>
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
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
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
  );
}
