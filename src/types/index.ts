export type UserRole = "gudang" | "owner" | "admin";

export interface UserProfile {
  email: string;
  role: UserRole;
  name: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  is_active: boolean;
  created_at: string;
}

export interface Batch {
  id: string;
  product_id: string;
  batch_code: string;
  expiry_date: string;
  created_at: string;
}

export type LedgerReason =
  | "saldo_awal"
  | "masuk_maklon"
  | "penjualan_offline"
  | "bonus"
  | "promo"
  | "sampel"
  | "rusak"
  | "kedaluwarsa"
  | "pesanan_shopee"
  | "pesanan_tiktok"
  | "retur_shopee"
  | "retur_tiktok"
  | "opname_koreksi"
  | "koreksi_salah_input";

export type LedgerChannel = "system" | "shopee" | "tiktok" | "manual";

export interface LedgerEntry {
  id: string;
  product_id: string;
  batch_id: string;
  qty: number; // positive for incoming, negative for outgoing
  reason: LedgerReason;
  channel: LedgerChannel;
  reference_id: string; // Order Code, Opname ID, etc.
  created_at: string;
  is_verified?: boolean;
}

export interface Bundle {
  id: string;
  name: string;
  sku: string;
  created_at: string;
}

export interface BundleComponent {
  id: string;
  bundle_id: string;
  product_id: string;
  qty: number;
}

export type OrderStatus = "PENDING" | "SHIPPED" | "IN_TRANSIT" | "COMPLETED" | "CANCELLED";

export interface Order {
  id: string;
  order_code: string;
  channel: "shopee" | "tiktok";
  status: OrderStatus;
  sku: string; // Can be a bundle SKU or single product SKU
  qty: number;
  created_at: string;
}

export type ReturnCondition = "layak_jual" | "rusak" | "hilang";
export type ReturnStatus = "PENDING" | "CLAIMED" | "EXPIRED";

export interface ReturnItem {
  id: string;
  order_id: string;
  order_code: string;
  channel: "shopee" | "tiktok";
  sku: string;
  qty: number;
  condition: ReturnCondition | null; // Null if not inspected yet
  status: ReturnStatus;
  received_at: string | null; // Null if not inspected yet
  created_at: string;
}

export interface OpnameSession {
  id: string;
  status: "draft" | "completed";
  created_at: string;
  completed_at: string | null;
}

export interface OpnameItem {
  id: string;
  session_id: string;
  product_id: string;
  batch_id: string;
  physical_qty: number;
  system_qty: number;
}
