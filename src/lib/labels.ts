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
