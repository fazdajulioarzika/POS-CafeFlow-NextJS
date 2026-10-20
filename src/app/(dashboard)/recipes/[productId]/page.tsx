import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import { formatQty } from "@/lib/units";
import { RecipeForm } from "@/components/recipes/recipe-form";
import { ActionButton } from "@/components/layout/action-button";
import { removeRecipeLine } from "../actions";
import { portionsFromStock } from "@/lib/recipe";

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select("id, name")
    .eq("id", productId)
    .maybeSingle();
  if (!product) notFound();

  const [{ data: lines }, { data: ingredients }] = await Promise.all([
    supabase
      .from("product_recipes")
      .select(
        "id, quantity_required, ingredient:ingredients(id, name, unit, stock_quantity)"
      )
      .eq("product_id", productId),
    supabase
      .from("ingredients")
      .select("id, name, unit")
      .eq("is_active", true)
      .order("name"),
  ]);

  const rows = (lines ?? []).flatMap((l) => {
    const ing = one(l.ingredient);
    if (!ing) return [];
    return [
      {
        id: l.id,
        name: ing.name,
        unit: ing.unit,
        qty: l.quantity_required,
        portions: portionsFromStock(ing.stock_quantity, l.quantity_required),
      },
    ];
  });
  const maxPortions = rows.length
    ? Math.min(...rows.map((r) => r.portions))
    : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Resep: {product.name}</h1>
        <Link
          href="/recipes"
          className="inline-flex h-9 items-center rounded-md border px-4 text-sm"
        >
          Kembali
        </Link>
      </div>

      {maxPortions !== null && (
        <p role="status" className="rounded-lg border bg-card p-3 text-sm">
          Stok saat ini cukup untuk sekitar <strong>{maxPortions} porsi</strong>
          .
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Tambah / ubah bahan</h2>
        <RecipeForm productId={product.id} ingredients={ingredients ?? []} />
      </section>

      <div className="max-w-2xl overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left">
            <tr>
              <th className="p-3">Bahan</th>
              <th className="p-3">Per porsi</th>
              <th className="p-3">Cukup untuk</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3 font-medium">{r.name}</td>
                <td className="p-3">{formatQty(r.qty, r.unit)}</td>
                <td className="p-3">{r.portions} porsi</td>
                <td className="p-3 text-right">
                  <ActionButton
                    action={removeRecipeLine.bind(null, r.id, product.id)}
                  >
                    Hapus baris
                  </ActionButton>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td
                  colSpan={4}
                  className="p-6 text-center text-muted-foreground"
                >
                  Belum ada bahan di resep ini
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
