export type RecipeLine = {
  product_id: string;
  ingredient_id: string;
  quantity_required: number;
};
export type OrderLine = { product_id: string; quantity: number };

const round3 = (n: number) => Math.round(n * 1000) / 1000;

// Cerminan deduct_stock_for_order(): total bahan yang dibutuhkan satu pesanan
export function ingredientNeeds(
  lines: OrderLine[],
  recipes: RecipeLine[]
): Map<string, number> {
  const needs = new Map<string, number>();
  for (const line of lines) {
    for (const r of recipes) {
      if (r.product_id !== line.product_id) continue;
      needs.set(
        r.ingredient_id,
        round3(
          (needs.get(r.ingredient_id) ?? 0) +
            r.quantity_required * line.quantity
        )
      );
    }
  }
  return needs;
}

export const portionsFromStock = (stock: number, perPortion: number) =>
  perPortion > 0 ? Math.floor(stock / perPortion) : 0;
