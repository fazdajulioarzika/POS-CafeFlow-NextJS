import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatQty } from "@/lib/units";
import { qs } from "@/lib/range";
import { StockBadge, stockState } from "@/components/inventory/stock-badge";
import { IngredientCreateForm } from "@/components/inventory/ingredient-create-form";
import { ActionButton } from "@/components/layout/action-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toggleIngredient } from "./actions";

const PAGE_SIZE = 20;

type SP = { low?: string; q?: string; page?: string };

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const onlyLow = sp.low === "1";
  const q = (sp.q ?? "").replace(/[%,_]/g, "").trim();
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const supabase = await createClient();

  // semua bahan aktif (kolom minimal) untuk menghitung stok rendah dan filter "rendah saja"
  const { data: activeRows } = await supabase
    .from("ingredients")
    .select("id, stock_quantity, minimum_stock")
    .eq("is_active", true);

  const lowIds = (activeRows ?? [])
    .filter((i) => stockState(i.stock_quantity, i.minimum_stock).level !== "ok")
    .map((i) => i.id);
  const lowCount = lowIds.length;

  let query = supabase
    .from("ingredients")
    .select("id, name, unit, stock_quantity, minimum_stock, is_active", {
      count: "exact",
    })
    .order("name")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) query = query.ilike("name", `%${q}%`);
  if (onlyLow) {
    // daftar kosong dibuat mustahil cocok agar hasilnya memang kosong
    query = query.in(
      "id",
      lowIds.length ? lowIds : ["00000000-0000-0000-0000-000000000000"]
    );
  }
  const { data: rows, count } = await query;

  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (p: number) =>
    `/inventory?${qs({
      low: onlyLow ? "1" : undefined,
      q: q || undefined,
      page: String(p),
    })}`;

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
            href={
              onlyLow
                ? `/inventory?${qs({ q: q || undefined })}`
                : `/inventory?${qs({ low: "1", q: q || undefined })}`
            }
            className="text-sm underline"
          >
            {onlyLow ? "Tampilkan semua" : "Tampilkan yang rendah saja"}
          </Link>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Tambah bahan</h2>
        <IngredientCreateForm />
      </section>

      <section className="space-y-4">
        <form className="flex flex-wrap gap-2">
          {onlyLow && <input type="hidden" name="low" value="1" />}
          <Input
            name="q"
            defaultValue={q}
            placeholder="Cari nama bahan"
            aria-label="Cari nama bahan"
            className="max-w-xs"
          />
          <Button type="submit" variant="outline">
            Cari
          </Button>
          <Link
            href="/inventory"
            className="inline-flex h-9 items-center px-2 text-sm underline"
          >
            Reset
          </Link>
        </form>

        <div className="overflow-x-auto rounded-lg border bg-card">
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
              {rows?.map((i) => (
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
                  <td className="p-3">
                    {formatQty(i.minimum_stock, i.unit)}
                  </td>
                  <td className="p-3">
                    <StockBadge
                      stock={i.stock_quantity}
                      min={i.minimum_stock}
                    />
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
              {!rows?.length && (
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
        </div>

        <div className="flex items-center justify-between text-sm">
          <span>
            Halaman {page} dari {pages} · {total} bahan
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={pageHref(page - 1)}
                className="inline-flex h-8 items-center rounded-md border px-3"
              >
                Sebelumnya
              </Link>
            )}
            {page < pages && (
              <Link
                href={pageHref(page + 1)}
                className="inline-flex h-8 items-center rounded-md border px-3"
              >
                Berikutnya
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}