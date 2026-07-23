"use client";

import React, { useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";
import { SectionCard, Input, Select, Button, Tag, Alert } from "@/components/ui";
import { supabase } from "@/lib/supabase/client";
import type { Product } from "@/types";

export const dynamic = "force-dynamic";

interface PromoRule {
  id: string;
  name: string;
  buy_product_id: string;
  min_buy_qty: number;
  start_date: string;
  end_date: string;
  channels: string[];
  is_active: boolean;
}

interface PromoFreeItem {
  id: string;
  promo_rule_id: string;
  product_id: string;
  qty: number;
}

export default function PromoPage() {
  const { user } = useUser();
  const isAdmin = user?.role === "admin";
  const isReadOnly = user?.role === "owner";

  const [products, setProducts] = useState<Product[]>([]);
  const [promoRules, setPromoRules] = useState<PromoRule[]>([]);
  const [freeItems, setFreeItems] = useState<PromoFreeItem[]>([]);

  // Form states
  const [promoName, setPromoName] = useState("");
  const [buyProductId, setBuyProductId] = useState("");
  const [minBuyQty, setMinBuyQty] = useState("1");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  // Channels checkboxes
  const [channelShopee, setChannelShopee] = useState(true);
  const [channelTiktok, setChannelTiktok] = useState(true);

  // List of free items to award
  const [newFreeItems, setNewFreeItems] = useState<{ product_id: string; qty: number }[]>([
    { product_id: "", qty: 1 }
  ]);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
    // Pre-populate daily promo time range (00:00 to 23:59 today)
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    setStartDate(`${yyyy}-${mm}-${dd}T00:00`);
    setEndDate(`${yyyy}-${mm}-${dd}T23:59`);
  }, []);

  const fetchData = async () => {
    const { data: prods } = await supabase.from("products").select("*").eq("is_active", true);
    const { data: rules } = await supabase.from("promo_rules").select("*").order("created_at", { ascending: false });
    const { data: items } = await supabase.from("promo_free_items").select("*");

    if (prods) setProducts(prods);
    if (rules) setPromoRules(rules as PromoRule[]);
    if (items) setFreeItems(items as PromoFreeItem[]);
  };

  const handleAddFreeItemRow = () => {
    setNewFreeItems([...newFreeItems, { product_id: "", qty: 1 }]);
  };

  const handleRemoveFreeItemRow = (idx: number) => {
    setNewFreeItems(newFreeItems.filter((_, i) => i !== idx));
  };

  const handleFreeItemChange = (idx: number, field: "product_id" | "qty", value: any) => {
    const updated = [...newFreeItems];
    if (field === "product_id") {
      updated[idx].product_id = value;
    } else {
      updated[idx].qty = Math.max(1, parseInt(value) || 1);
    }
    setNewFreeItems(updated);
  };

  const handleSavePromoRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (isReadOnly) {
      setError("Peran Anda hanya memiliki hak baca.");
      return;
    }
    if (!isAdmin) {
      setError("Hanya peran Admin/Config yang bisa menambahkan aturan promo.");
      return;
    }

    if (!promoName.trim()) {
      setError("Nama promo wajib diisi.");
      return;
    }
    if (!buyProductId) {
      setError("Harap pilih produk pembelian.");
      return;
    }

    const minBuy = parseInt(minBuyQty);
    if (isNaN(minBuy) || minBuy <= 0) {
      setError("Minimal beli harus berupa angka positif.");
      return;
    }

    if (!startDate || !endDate) {
      setError("Tanggal berlaku mulai & selesai wajib diisi.");
      return;
    }

    const channels: string[] = [];
    if (channelShopee) channels.push("shopee");
    if (channelTiktok) channels.push("tiktok");

    if (channels.length === 0) {
      setError("Pilih minimal satu channel marketplace.");
      return;
    }

    const validFreeItems = newFreeItems.filter(item => item.product_id !== "");
    if (validFreeItems.length === 0) {
      setError("Pilih minimal satu barang gratis.");
      return;
    }

    setLoading(true);
    try {
      // 1. Insert Promo Rule
      const { data: newRule, error: ruleErr } = await supabase
        .from("promo_rules")
        .insert({
          name: promoName.trim(),
          buy_product_id: buyProductId,
          min_buy_qty: minBuy,
          start_date: new Date(startDate).toISOString(),
          end_date: new Date(endDate).toISOString(),
          channels,
          is_active: true
        })
        .select()
        .single();

      if (ruleErr || !newRule) throw new Error(ruleErr?.message || "Gagal membuat aturan promo.");

      // 2. Insert Free Items
      const { error: itemsErr } = await supabase
        .from("promo_free_items")
        .insert(
          validFreeItems.map(item => ({
            promo_rule_id: newRule.id,
            product_id: item.product_id,
            qty: item.qty
          }))
        );

      if (itemsErr) {
        // Cleanup rule if free items insert fails
        await supabase.from("promo_rules").delete().eq("id", newRule.id);
        throw itemsErr;
      }

      setPromoName("");
      setBuyProductId("");
      setMinBuyQty("1");
      setNewFreeItems([{ product_id: "", qty: 1 }]);
      
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      setStartDate(`${yyyy}-${mm}-${dd}T00:00`);
      setEndDate(`${yyyy}-${mm}-${dd}T23:59`);

      setSuccess("Aturan promo baru berhasil disimpan.");
      fetchData();
    } catch (err: any) {
      setError(err.message || "Gagal menyimpan aturan promo.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRuleActive = async (id: string, currentStatus: boolean) => {
    if (isReadOnly || !isAdmin) return;
    const { error } = await supabase
      .from("promo_rules")
      .update({ is_active: !currentStatus })
      .eq("id", id);

    if (error) {
      alert("Gagal mengubah status aturan: " + error.message);
    } else {
      fetchData();
    }
  };

  return (
    <div className="space-y-6">
      {/* Informative Alert Banner */}
      <Alert variant="warning">
        <span>📢</span>
        <span>
          <strong>Aturan Integrasi Promo:</strong> Promo dipasang di checkout marketplace, sehingga order masuk dari API hanya mencatat barang yang dibeli pelanggan secara nominal. Aturan promo ini yang memberi tahu sistem berapa unit barang bonus gratis yang harus otomatis ikut dipotong dari Buku Besar saat pesanan berstatus <strong>Dikirim</strong>.
        </span>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Form untuk Add Promo Rule */}
        <div className="lg:col-span-1">
          <SectionCard title="Buat Aturan Promo Baru">
            <form onSubmit={handleSavePromoRule} className="space-y-4">
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

              <Input
                label="Nama Aturan Promo"
                placeholder="Contoh: Promo Glowing Juli"
                value={promoName}
                onChange={(e) => setPromoName(e.target.value)}
                required
                disabled={isReadOnly || loading}
              />

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <Select
                    label="Beli Produk"
                    value={buyProductId}
                    onChange={(e) => setBuyProductId(e.target.value)}
                    options={[
                      { value: "", label: "-- Pilih Produk --" },
                      ...products.map((p) => ({ value: p.id, label: p.name })),
                    ]}
                    required
                    disabled={isReadOnly || loading}
                  />
                </div>
                <div>
                  <Input
                    label="Min. Beli"
                    type="number"
                    min="1"
                    value={minBuyQty}
                    onChange={(e) => setMinBuyQty(e.target.value)}
                    required
                    disabled={isReadOnly || loading}
                  />
                </div>
              </div>

              <div className="space-y-3 p-3 bg-bg/40 rounded border border-border">
                <span className="text-xs font-semibold text-ink-soft block">Barang Gratis (Fixed Qty)</span>
                {newFreeItems.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-end">
                    <div className="flex-grow">
                      <Select
                        label={`Item Gratis #${idx + 1}`}
                        value={item.product_id}
                        onChange={(e) => handleFreeItemChange(idx, "product_id", e.target.value)}
                        options={[
                          { value: "", label: "-- Pilih Produk --" },
                          ...products.map((p) => ({ value: p.id, label: p.name })),
                        ]}
                        required
                        disabled={isReadOnly || loading}
                      />
                    </div>
                    <div className="w-16">
                      <Input
                        label="Qty"
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={(e) => handleFreeItemChange(idx, "qty", e.target.value)}
                        required
                        disabled={isReadOnly || loading}
                      />
                    </div>
                    {newFreeItems.length > 1 && (
                      <Button
                        variant="danger"
                        className="p-2 min-h-[44px]"
                        onClick={() => handleRemoveFreeItemRow(idx)}
                        disabled={isReadOnly || loading}
                      >
                        ✕
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  variant="ghost"
                  type="button"
                  className="w-full text-[11px] min-h-[36px]"
                  onClick={handleAddFreeItemRow}
                  disabled={isReadOnly || loading}
                >
                  + Tambah Barang Gratis
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Berlaku Mulai"
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  disabled={isReadOnly || loading}
                />
                <Input
                  label="Berlaku Sampai"
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  disabled={isReadOnly || loading}
                />
              </div>

              <div className="space-y-1">
                <span className="text-xs font-semibold text-ink-soft block">Channel Marketplace</span>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-xs font-medium text-ink-soft cursor-pointer">
                    <input
                      type="checkbox"
                      checked={channelShopee}
                      onChange={(e) => setChannelShopee(e.target.checked)}
                      disabled={isReadOnly || loading}
                      className="rounded border-border text-primary focus:ring-primary"
                    />
                    Shopee
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium text-ink-soft cursor-pointer">
                    <input
                      type="checkbox"
                      checked={channelTiktok}
                      onChange={(e) => setChannelTiktok(e.target.checked)}
                      disabled={isReadOnly || loading}
                      className="rounded border-border text-primary focus:ring-primary"
                    />
                    TikTok Shop
                  </label>
                </div>
              </div>

              <div className="pt-2">
                <Button type="submit" className="w-full" disabled={isReadOnly || loading || !isAdmin}>
                  {loading ? "Menyimpan..." : "Simpan Aturan Promo"}
                </Button>
              </div>
            </form>
          </SectionCard>
        </div>

        {/* Right Column: Daftar Aturan Promo */}
        <div className="lg:col-span-2 space-y-4">
          <SectionCard title="Daftar Aturan Promo Terdaftar">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border text-ink-soft font-bold uppercase bg-bg/50">
                    <th className="py-2.5 px-3">Nama Promo / Periode</th>
                    <th className="py-2.5 px-3">Syarat Beli</th>
                    <th className="py-2.5 px-3">Hadiah Gratis</th>
                    <th className="py-2.5 px-3">Kanal</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-mono text-[11px]">
                  {promoRules.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-ink-faint font-body text-xs">
                        Belum ada aturan promo terdaftar.
                      </td>
                    </tr>
                  ) : (
                    promoRules.map((rule) => {
                      const buyProduct = products.find((p) => p.id === rule.buy_product_id)?.name || "Produk";
                      const ruleItems = freeItems.filter((item) => item.promo_rule_id === rule.id);

                      return (
                        <tr key={rule.id} className={`hover:bg-bg/10 transition-colors ${!rule.is_active ? "opacity-55" : ""}`}>
                          <td className="py-2.5 px-3 font-body">
                            <span className="font-bold text-ink block">{rule.name}</span>
                            <span className="text-[10px] text-ink-faint font-mono block mt-0.5">
                              {new Date(rule.start_date).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })} — {new Date(rule.end_date).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            Beli {rule.min_buy_qty}x <span className="font-body font-semibold text-primary">{buyProduct}</span>
                          </td>
                          <td className="py-2.5 px-3">
                            <ul className="list-disc pl-4 space-y-0.5 font-body">
                              {ruleItems.map((item) => {
                                const freeProduct = products.find((p) => p.id === item.product_id)?.name || "Produk";
                                return (
                                  <li key={item.id}>
                                    Gratis {item.qty}x <span className="font-semibold text-ink-soft">{freeProduct}</span>
                                  </li>
                                );
                              })}
                            </ul>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex gap-1 flex-wrap">
                              {rule.channels.map((ch) => (
                                <Tag key={ch} variant={ch === "shopee" ? "warning" : "primary"} className="text-[9px] uppercase">
                                  {ch}
                                </Tag>
                              ))}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <Button
                              variant={rule.is_active ? "danger" : "success"}
                              className="px-2 py-0.5 text-[10px] min-h-[30px]"
                              disabled={isReadOnly || !isAdmin}
                              onClick={() => handleToggleRuleActive(rule.id, rule.is_active)}
                            >
                              {rule.is_active ? "Nonaktifkan" : "Aktifkan"}
                            </Button>
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
    </div>
  );
}
