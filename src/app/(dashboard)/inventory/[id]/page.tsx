import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/datetime";
import { movementTypeLabel } from "@/lib/labels";
import { one } from "@/lib/relations";
import { formatQty, type Unit } from "@/lib/units";
import { StockBadge } from "@/components/inventory/stock-badge";
import { IngredientEditForm } from "@/components/inventory/ingredient-edit-form";
import { MovementForm } from "@/components/inventory/movement-form";

export default async function IngredientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: ing } = await supabase
    .from("ingredients")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!ing) notFound();

  const { data: moves } = await supabase
    .from("inventory_movements")
    .select(
      "id, movement_type, quantity_delta, stock_after, reason, created_at, order_id, creator:profiles(full_name), order:orders(order_number)"
    )
    .eq("ingredient_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{ing.name}</h1>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-lg font-semibold">
              {formatQty(ing.stock_quantity, ing.unit)}
            </span>
            <StockBadge stock={ing.stock_quantity} min={ing.minimum_stock} />
            <span className="text-muted-foreground">
              minimum {formatQty(ing.minimum_stock, ing.unit)}
            </span>
          </div>
        </div>
        <Link
          href="/inventory"
          className="inline-flex h-9 items-center rounded-md border px-4 text-sm"
        >
          Kembali
        </Link>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Catat mutasi stok</h2>
        <MovementForm ingredientId={ing.id} unit={ing.unit as Unit} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Pengaturan bahan</h2>
        <IngredientEditForm ingredient={ing} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Riwayat mutasi (50 terbaru)</h2>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left">
              <tr>
                <th className="p-3">Waktu</th>
                <th className="p-3">Jenis</th>
                <th className="p-3">Perubahan</th>
                <th className="p-3">Stok sesudah</th>
                <th className="p-3">Alasan</th>
                <th className="p-3">Oleh</th>
              </tr>
            </thead>
            <tbody>
              {moves?.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="p-3">{formatDateTime(m.created_at)}</td>
                  <td className="p-3">{movementTypeLabel[m.movement_type]}</td>
                  <td className="p-3 font-medium">
                    {m.quantity_delta > 0 ? "+" : ""}
                    {formatQty(m.quantity_delta, ing.unit)}
                  </td>
                  <td className="p-3">{formatQty(m.stock_after, ing.unit)}</td>
                  <td className="p-3">
                    {m.reason ?? "-"}
                    {m.order_id && one(m.order)?.order_number && (
                      <Link
                        href={`/orders/${m.order_id}`}
                        className="ml-2 underline"
                      >
                        {one(m.order)?.order_number}
                      </Link>
                    )}
                  </td>
                  <td className="p-3">{one(m.creator)?.full_name || "-"}</td>
                </tr>
              ))}
              {!moves?.length && (
                <tr>
                  <td
                    colSpan={6}
                    className="p-6 text-center text-muted-foreground"
                  >
                    Belum ada mutasi
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
