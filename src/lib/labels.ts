export const orderStatusLabel: Record<string, string> = {
  draft: "Draft",
  placed: "Baru",
  preparing: "Disiapkan",
  ready: "Siap",
  served: "Diantar",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};
export const paymentStatusLabel: Record<string, string> = {
  unpaid: "Belum dibayar",
  paid: "Lunas",
  refunded: "Refund",
};
export const paymentMethodLabel: Record<string, string> = {
  cash: "Tunai",
  qris: "QRIS",
  bank_transfer: "Transfer bank",
  other: "Lainnya",
};
export const orderTypeLabel: Record<string, string> = {
  dine_in: "Dine-in",
  takeaway: "Takeaway",
};
export const tableStatusLabel: Record<string, string> = {
  available: "Kosong",
  occupied: "Terisi",
  reserved: "Dipesan",
  maintenance: "Perbaikan",
};
export const movementTypeLabel: Record<string, string> = {
  initial: "Stok awal",
  purchase: "Stok masuk",
  sale: "Penjualan",
  waste: "Rusak/terbuang",
  adjustment: "Penyesuaian",
};
export const auditActionLabel: Record<string, string> = {
  "product.price_changed": "Harga produk diubah",
  "product.active_changed": "Status produk diubah",
  "variant.price_changed": "Harga varian diubah",
  "recipe.added": "Bahan resep ditambah",
  "recipe.updated": "Resep diubah",
  "recipe.removed": "Bahan resep dihapus",
  "stock.adjustment": "Penyesuaian stok",
  "stock.waste": "Bahan rusak/terbuang",
  "user.role_changed": "Role pengguna diubah",
  "user.active_changed": "Status pengguna diubah",
  "settings.changed": "Pengaturan diubah",
  "order.refunded": "Pesanan dibatalkan (refund)",
  "shift.opened": "Shift dibuka",
  "shift.closed": "Shift ditutup",
  "shift.cash_in": "Kas masuk",
  "shift.cash_out": "Kas keluar",
};

export const auditGroups = [
  { key: "product", label: "Produk" },
  { key: "variant", label: "Varian" },
  { key: "recipe", label: "Resep" },
  { key: "stock", label: "Stok" },
  { key: "user", label: "Pengguna" },
  { key: "settings", label: "Pengaturan" },
  { key: "order", label: "Pesanan" },
  { key: "shift", label: "Shift" },
] as const;
