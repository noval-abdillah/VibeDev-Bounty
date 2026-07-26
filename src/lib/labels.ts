export const REASON_LABELS: Record<string, string> = {
  saldo_awal: "Saldo Awal Produk",
  masuk_maklon: "Barang Masuk Maklon",
  penjualan_offline: "Penjualan Offline",
  bonus: "Keluar Bonus",
  promo: "Keluar Promo",
  sampel: "Keluar Sampel",
  rusak: "Barang Rusak",
  kedaluwarsa: "Barang Kedaluwarsa",
  pesanan_shopee: "Pesanan Shopee",
  pesanan_tiktok: "Pesanan TikTok",
  retur_shopee: "Retur Shopee",
  retur_tiktok: "Retur TikTok",
  opname_koreksi: "Koreksi Stok Opname",
  koreksi_salah_input: "Koreksi Salah Input",
};

export const CHANNEL_LABELS: Record<string, string> = {
  shopee: "Shopee",
  tiktok: "TikTok Shop",
  manual: "Input Manual",
  system: "System",
};

export function getReasonLabel(reason: string): string {
  return REASON_LABELS[reason] || reason;
}

export function getChannelLabel(channel: string): string {
  return CHANNEL_LABELS[channel] || channel;
}
