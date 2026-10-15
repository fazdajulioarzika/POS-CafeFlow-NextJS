import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatQty } from "@/lib/units";
import { StockBadge, stockState } from "@/components/inventory/stock-badge";
import { IngredientCreateForm } from "@/components/inventory/ingredient-create-form";
import { ActionButton } from "@/components/layout/action-button";
import { toggleIngredient } from "./actions";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ low?: string }>;
}) {
  const { low } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("ingredients")
    .select("id, name, unit, stock_quantity, minimum_stock, is_active")
    .order("name");

  const all = data ?? [];
  const needsAttention = (i: (typeof all)[number]) =>
    i.is_active && stockState(i.stock_quantity, i.minimum_stock).level !== "ok";
  const lowCount = all.filter(needsAttention).length;
  const rows = low === "1" ? all.filter(needsAttention) : all;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Inventory</h1>

      {lowCount > 0 && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-amber-400 bg-amber-50 p-4"
        >
          <AlertTriangle className="h-5 w-5 text-amber-700" aria-hidden />
          <span className="font-medium">
            {lowCount} bahan stoknya rendah atau habis
          </span>
          <Link
            href={low === "1" ? "/inventory" : "/inventory?low=1"}
            className="text-sm underline"
          >
            {low === "1" ? "Tampilkan semua" : "Tampilkan yang rendah saja"}
          </Link>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Tambah bahan</h2>
        <IngredientCreateForm />
      </section>

      <section className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left">
            <tr>
              <th className="p-3">Bahan</th>
              <th className="p-3">Stok</th>
              <th className="p-3">Minimum</th>
              <th className="p-3">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.id} className="border-t">
                <td className="p-3 font-medium">
                  {i.name}
                  {!i.is_active && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (nonaktif)
                    </span>
                  )}
                </td>
                <td className="p-3">{formatQty(i.stock_quantity, i.unit)}</td>
                <td className="p-3">{formatQty(i.minimum_stock, i.unit)}</td>
                <td className="p-3">
                  <StockBadge stock={i.stock_quantity} min={i.minimum_stock} />
                </td>
                <td className="flex justify-end gap-2 p-3">
                  <Link
                    href={`/inventory/${i.id}`}
                    className="inline-flex h-8 items-center rounded-md border px-3 text-sm"
                  >
                    Detail
                  </Link>
                  <ActionButton
                    action={toggleIngredient.bind(null, i.id, !i.is_active)}
                  >
                    {i.is_active ? "Nonaktifkan" : "Aktifkan"}
                  </ActionButton>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td
                  colSpan={5}
                  className="p-6 text-center text-muted-foreground"
                >
                  Tidak ada bahan
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
