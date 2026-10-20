export type DiscountType = "none" | "amount" | "percent";
export type Totals = {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
};

// Estimasi untuk tampilan. Fungsi database create_order_checkout menghitung ulang dan menjadi sumber kebenaran.
export function computeTotals(input: {
  subtotal: number;
  discountType: DiscountType;
  discountValue: number;
  taxPercent: number;
}): Totals {
  const { subtotal, discountType, taxPercent } = input;
  const value = Math.max(0, Math.floor(input.discountValue || 0));

  let discount = 0;
  if (discountType === "amount") discount = Math.min(value, subtotal);
  else if (discountType === "percent")
    discount = Math.floor((subtotal * Math.min(value, 100)) / 100);

  const base = subtotal - discount;
  // aritmatika bilangan bulat (persen dalam per-seratus) agar pembulatan sama dengan SQL: round half up
  const hundredths = Math.round(taxPercent * 100);
  const tax = Math.floor((base * hundredths + 5000) / 10000);

  return { subtotal, discount, tax, total: base + tax };
}

export const cashChange = (total: number, tendered: number) => tendered - total;
