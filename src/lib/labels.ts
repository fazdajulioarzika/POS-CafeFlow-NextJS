export const orderStatusLabel: Record<string, string> = {
  draft: "Draft",
  placed: "Baru",
  preparing: "Disiapkan",
  ready: "Siap",
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
