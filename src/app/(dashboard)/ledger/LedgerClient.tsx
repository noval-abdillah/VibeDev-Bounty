"use client";

import React, { useState } from "react";
import { SectionCard, Tag, Input, Select, Button } from "@/components/ui";
import { exportToXlsx, getReasonLabel, getChannelLabel, formatDate } from "@/lib/export";
import { writeLedgerEntry } from "@/lib/ledger";
import type { ExportColumn, ExportSheet } from "@/lib/export";

interface LedgerClientProps {
  serverProducts: any[];
  serverBatches: any[];
  serverLedger: any[];
}

export function LedgerClient({ serverProducts, serverBatches, serverLedger }: LedgerClientProps) {
  const [products] = useState(serverProducts);
  const [batches] = useState(serverBatches);
  const [ledgerEntries, setLedgerEntries] = useState(serverLedger);

  // Top right selected product for the main detailed view
  const [selectedProduct, setSelectedProduct] = useState(products[0]?.id || "");
  
  // Filters for the global bottom table "Seluruh Pergerakan"
  const [globalReason, setGlobalReason] = useState("");
  const [globalChannel, setGlobalChannel] = useState("");

  // Reversal confirmation modal state
  const [reversalData, setReversalData] = useState<any | null>(null);

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
      case "koreksi_salah_input": return "Koreksi Salah Input";
      default: return reason;
    }
  };

  const getReasonTag = (reason: string) => {
    switch (reason) {
      case "saldo_awal":
      case "masuk_maklon":
        return <Tag variant="success">{getReasonLabel(reason)}</Tag>;
      case "penjualan_offline":
      case "pesanan_shopee":
      case "pesanan_tiktok":
        return <Tag variant="primary">{getReasonLabel(reason)}</Tag>;
      case "bonus":
      case "promo":
      case "sampel":
        return <Tag variant="warning">{getReasonLabel(reason)}</Tag>;
      case "rusak":
      case "kedaluwarsa":
        return <Tag variant="danger">{getReasonLabel(reason)}</Tag>;
      default:
        return <Tag variant="neutral">{getReasonLabel(reason)}</Tag>;
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

  // Calculate detailed views for selected product
  const selectedProductEntries = ledgerEntries.filter(e => e.product_id === selectedProduct);
  const saldoSekarang = selectedProductEntries.reduce((sum, e) => sum + e.qty, 0);

  // Compute running balance chronologically
  const chronoEntries = [...selectedProductEntries].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  let currentBalance = 0;
  const entriesWithBalance = chronoEntries.map((e) => {
    currentBalance += e.qty;
    return { ...e, runningBalance: currentBalance };
  });
  const displaySelectedEntries = [...entriesWithBalance].reverse();

  // Filters for bottom table (All pergerakan)
  const filteredGlobalEntries = ledgerEntries.filter((e: any) => {
    if (globalReason && e.reason !== globalReason) return false;
    if (globalChannel && e.channel !== globalChannel) return false;
    return true;
  });

  const executeReversal = async () => {
    if (!reversalData) return;
    try {
      const ref = `REVERSAL-${reversalData.reference_id || Date.now().toString().slice(-6)}`;
      const result = await writeLedgerEntry(
        reversalData.product_id,
        reversalData.batch_id,
        -reversalData.qty,
        "koreksi_salah_input",
        "system",
        ref
      );
      if (result) {
        alert("Koreksi entri salah input berhasil dicatat.");
        setReversalData(null);
        // Reload data/state
        window.location.reload();
      } else {
        alert("Gagal mencatat koreksi salah input.");
      }
    } catch (err: any) {
      alert("Gagal mencatat koreksi: " + err.message);
    }
  };

  const handleExportXlsx = async () => {
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

    const rows = ledgerEntries.map((e: any) => {
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
    const sumMasuk = ledgerEntries.filter((e: any) => e.qty > 0).reduce((s: number, e: any) => s + e.qty, 0);
    const sumKeluar = Math.abs(ledgerEntries.filter((e: any) => e.qty < 0).reduce((s: number, e: any) => s + e.qty, 0));

    const ledgerSheet: ExportSheet = {
      name: "Buku Besar",
      columns,
      rows,
      summaryRows: [
        { label: "Total Transaksi", value: `${rows.length} baris` },
        { label: "Transaksi Masuk", value: `${totalMasuk} (${sumMasuk.toLocaleString("id-ID")} unit)` },
        { label: "Transaksi Keluar", value: `${totalKeluar} (${sumKeluar.toLocaleString("id-ID")} unit)` },
        { label: "Diekspor Pada", value: now.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) },
      ],
    };

    await exportToXlsx({
      title: "Buku Besar StokLedger",
      fileName: `StokLedger_BukuBesar_${today}`,
      sheets: [ledgerSheet],
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-md border border-border">
        <div>
          <span className="text-xs text-ink-faint font-semibold uppercase block">Analisis Produk Terpilih</span>
          <h2 className="font-heading text-lg font-bold text-ink mt-0.5">
            {products.find(p => p.id === selectedProduct)?.name || "Silakan pilih produk"}
          </h2>
        </div>
        <div className="w-72 shrink-0">
          <Select
            label="Pilih Produk Analisis"
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
            options={[
              { value: "", label: "-- Pilih Produk --" },
              ...products.map((p: any) => ({ value: p.id, label: `${p.name} (${p.sku})` })),
            ]}
          />
        </div>
      </div>

      {selectedProduct && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Card Saldo Sekarang */}
          <div className="lg:col-span-1">
            <SectionCard title="Saldo Sekarang">
              <div className="py-4 text-center">
                <span className="text-4xl font-bold font-mono text-primary block">
                  {saldoSekarang.toLocaleString("id-ID")}
                </span>
                <span className="text-xs text-ink-faint font-medium block mt-2">
                  Total kuantitas barang fisik terakumulasi dalam Buku Besar untuk produk ini.
                </span>
              </div>
            </SectionCard>

            <div className="mt-4 p-4 bg-bg rounded border border-border">
              <span className="text-xs text-danger font-semibold flex items-center gap-1.5 leading-relaxed">
                <span>⚠️</span>
                <span>Tidak ada baris yang bisa diedit — koreksi selalu lewat baris baru.</span>
              </span>
            </div>
          </div>

          {/* List Ringkas Pergerakan Produk Terpilih */}
          <div className="lg:col-span-3">
            <SectionCard 
              title="Pergerakan Detail & Saldo Berjalan"
              action={
                <Button variant="ghost" className="text-[10px] px-2 py-1" onClick={handleExportXlsx}>
                  Ekspor Excel
                </Button>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border text-ink-soft font-bold uppercase bg-bg/50">
                      <th className="py-2.5 px-3">Waktu</th>
                      <th className="py-2.5 px-3">Alasan</th>
                      <th className="py-2.5 px-3">Kanal</th>
                      <th className="py-2.5 px-3">Batch</th>
                      <th className="py-2.5 px-3">Referensi</th>
                      <th className="py-2.5 px-3 text-right">Qty</th>
                      <th className="py-2.5 px-3 text-right">Saldo Berjalan</th>
                      <th className="py-2.5 px-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dashed divide-border font-mono text-[11px]">
                    {displaySelectedEntries.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-ink-faint font-body text-xs">
                          Belum ada transaksi tercatat untuk produk ini.
                        </td>
                      </tr>
                    ) : (
                      displaySelectedEntries.map((e: any) => {
                        const batch = batches.find((b: any) => b.id === e.batch_id);
                        const isPositive = e.qty > 0;
                        return (
                          <tr key={e.id} className="hover:bg-bg/20 transition-colors">
                            <td className="py-2.5 px-3 whitespace-nowrap text-ink-faint">{formatDate(e.created_at)}</td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {getReasonTag(e.reason)}
                                {e.is_verified === false && (
                                  <Tag variant="warning" className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.25">
                                    Belum Terverifikasi
                                  </Tag>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">{getChannelTag(e.channel)}</td>
                            <td className="py-2.5 px-3 text-primary-dark font-semibold">{batch?.batch_code || "-"}</td>
                            <td className="py-2.5 px-3 text-ink-soft truncate max-w-[120px]">{e.reference_id}</td>
                            <td className={`py-2.5 px-3 text-right font-bold ${isPositive ? "text-success" : "text-danger"}`}>
                              {isPositive ? `+${e.qty}` : e.qty}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-ink-soft">
                              {e.runningBalance.toLocaleString("id-ID")}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {e.reason !== "koreksi_salah_input" && (
                                <button
                                  onClick={() => setReversalData(e)}
                                  className="text-[10px] text-danger hover:underline font-semibold"
                                  title="Reversal cepat untuk salah input"
                                >
                                  Koreksi
                                </button>
                              )}
                              {e.reason === "koreksi_salah_input" && (
                                <span className="text-[9px] text-ink-faint italic">Reversal</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      {/* Global Table: Seluruh Pergerakan */}
      <SectionCard title="Seluruh Pergerakan (Semua Produk)">
        <div className="flex flex-wrap items-center gap-4 mb-4 bg-bg/40 p-3 rounded border border-border">
          <div className="w-56">
            <Select
              label="Semua Alasan"
              value={globalReason}
              onChange={(e) => setGlobalReason(e.target.value)}
              options={[
                { value: "", label: "-- Semua Alasan --" },
                { value: "saldo_awal", label: "Saldo Awal Produk" },
                { value: "masuk_maklon", label: "Barang Masuk Maklon" },
                { value: "penjualan_offline", label: "Penjualan Offline" },
                { value: "bonus", label: "Keluar Bonus" },
                { value: "promo", label: "Keluar Promo" },
                { value: "sampel", label: "Keluar Sampel" },
                { value: "rusak", label: "Barang Rusak" },
                { value: "kedaluwarsa", label: "Barang Kedaluwarsa" },
                { value: "pesanan_shopee", label: "Pesanan Shopee" },
                { value: "pesanan_tiktok", label: "Pesanan TikTok" },
                { value: "retur_shopee", label: "Retur Shopee" },
                { value: "retur_tiktok", label: "Retur TikTok" },
                { value: "opname_koreksi", label: "Koreksi Stok Opname" },
                { value: "koreksi_salah_input", label: "Koreksi Salah Input" },
              ]}
            />
          </div>
          <div className="w-56">
            <Select
              label="Semua Channel"
              value={globalChannel}
              onChange={(e) => setGlobalChannel(e.target.value)}
              options={[
                { value: "", label: "-- Semua Channel --" },
                { value: "shopee", label: "Shopee" },
                { value: "tiktok", label: "TikTok Shop" },
                { value: "manual", label: "Manual" },
                { value: "system", label: "System" },
              ]}
            />
          </div>
          <div className="ml-auto mt-4 md:mt-0">
            <Button variant="ghost" onClick={() => { setGlobalReason(""); setGlobalChannel(""); }}>
              Reset Filter
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border text-ink-soft font-bold uppercase bg-bg/50">
                <th className="py-2.5 px-3">Waktu</th>
                <th className="py-2.5 px-3">Produk</th>
                <th className="py-2.5 px-3">Alasan</th>
                <th className="py-2.5 px-3">Channel</th>
                <th className="py-2.5 px-3">Referensi</th>
                <th className="py-2.5 px-3 text-right">Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-mono text-[11px]">
              {filteredGlobalEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-ink-faint font-body text-xs">
                    Tidak ada entri Buku Besar terdaftar.
                  </td>
                </tr>
              ) : (
                filteredGlobalEntries.slice(0, 100).map((e: any) => {
                  const prod = products.find((p: any) => p.id === e.product_id);
                  const isPositive = e.qty > 0;
                  return (
                    <tr key={e.id} className="hover:bg-bg/25 transition-colors">
                      <td className="py-2.5 px-3 text-ink-faint">{formatDate(e.created_at)}</td>
                      <td className="py-2.5 px-3 font-body font-semibold text-ink">{prod?.name || "-"}</td>
                      <td className="py-2.5 px-3">{getReasonTag(e.reason)}</td>
                      <td className="py-2.5 px-3">{getChannelTag(e.channel)}</td>
                      <td className="py-2.5 px-3 text-ink-soft">{e.reference_id}</td>
                      <td className={`py-2.5 px-3 text-right font-bold ${isPositive ? "text-success" : "text-danger"}`}>
                        {isPositive ? `+${e.qty}` : e.qty}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Reversal Confirmation Modal (Salah Input Admin - Intentional Friction) */}
      {reversalData && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-white border-2 border-primary max-w-md w-full rounded-md p-6 space-y-4 shadow-xl">
            <h3 className="font-heading text-lg font-bold text-ink border-b border-border pb-2">
              Konfirmasi Reversal (Koreksi Salah Input)
            </h3>
            
            <p className="text-xs text-ink-soft">
              Anda akan melakukan penyesuaian untuk entri salah input berikut:
            </p>

            <div className="space-y-2 text-xs bg-bg/40 p-3 rounded border border-border">
              <div>
                <span className="text-ink-soft block uppercase tracking-wider font-semibold">Produk:</span>
                <span className="text-sm font-bold text-ink">{products.find(p => p.id === reversalData.product_id)?.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-ink-soft block uppercase tracking-wider font-semibold">Qty Awal:</span>
                  <span className={`text-sm font-bold font-mono ${reversalData.qty > 0 ? "text-success" : "text-danger"}`}>
                    {reversalData.qty > 0 ? `+${reversalData.qty}` : reversalData.qty} unit
                  </span>
                </div>
                <div>
                  <span className="text-ink-soft block uppercase tracking-wider font-semibold">Qty Penyeimbang (Reversal):</span>
                  <span className={`text-sm font-bold font-mono ${-reversalData.qty > 0 ? "text-success" : "text-danger"}`}>
                    {-reversalData.qty > 0 ? `+${-reversalData.qty}` : -reversalData.qty} unit
                  </span>
                </div>
              </div>
              <div>
                <span className="text-ink-soft block uppercase tracking-wider font-semibold">Referensi Asal:</span>
                <span className="text-sm font-mono text-ink">{reversalData.reference_id}</span>
              </div>
            </div>

            <div className="p-3 bg-danger-bg text-danger text-[11px] font-semibold rounded border border-danger/25">
              ⚠️ Peringatan: Tindakan ini permanen. Sistem akan menulis entri ledger baru dengan alasan <strong>Koreksi Salah Input</strong> untuk menyeimbangkan stok.
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-border">
              <Button variant="ghost" onClick={() => setReversalData(null)}>
                Batal
              </Button>
              <Button variant="primary" onClick={executeReversal}>
                Konfirmasi &amp; Koreksi
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
