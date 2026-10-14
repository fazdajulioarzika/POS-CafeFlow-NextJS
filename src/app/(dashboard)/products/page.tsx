import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatRupiah } from "@/lib/money";
import { productImageUrl } from "@/lib/storage";
import { ActionButton } from "@/components/layout/action-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toggleProductFlag } from "./actions";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { q, category } = await searchParams;
  const supabase = await createClient();

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name")
    .order("sort_order");

  let query = supabase
    .from("products")
    .select(
      "id, sku, name, price, image_path, is_active, is_available, categories(name)"
    )
    .order("name");
  if (q) query = query.ilike("name", `%${q.replace(/[%,_]/g, "")}%`);
  if (category) query = query.eq("category_id", category);
  const { data: products } = await query;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Produk</h1>
        <Link
          href="/products/new"
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Tambah produk
        </Link>
      </div>

      <form className="flex flex-wrap gap-2">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Cari nama produk"
          className="max-w-xs"
        />
        <select
          name="category"
          defaultValue={category ?? ""}
          className="h-9 rounded-md border border-input bg-card px-3 text-sm"
        >
          <option value="">Semua kategori</option>
          {categories?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left">
            <tr>
              <th className="p-3">Foto</th>
              <th className="p-3">Nama</th>
              <th className="p-3">Kategori</th>
              <th className="p-3">Harga</th>
              <th className="p-3">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {products?.map((p) => {
              const img = productImageUrl(p.image_path);
              return (
                <tr key={p.id} className="border-t">
                  <td className="p-3">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img}
                        alt=""
                        className="h-10 w-10 rounded-md object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-md bg-secondary" />
                    )}
                  </td>
                  <td className="p-3">
                    <div className="font-medium">{p.name}</div>
                    {p.sku && (
                      <div className="text-xs text-muted-foreground">
                        {p.sku}
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    {(Array.isArray(p.categories)
                      ? p.categories[0]?.name
                      : (p.categories as { name: string } | null)?.name) ?? "-"}
                  </td>
                  <td className="p-3">{formatRupiah(p.price)}</td>
                  <td className="p-3">
                    {p.is_active ? "Aktif" : "Nonaktif"} ·{" "}
                    {p.is_available ? "Tersedia" : "Habis"}
                  </td>
                  <td className="flex justify-end gap-2 p-3">
                    <Link
                      href={`/products/${p.id}`}
                      className="inline-flex h-8 items-center rounded-md border px-3 text-sm"
                    >
                      Edit
                    </Link>
                    <ActionButton
                      action={toggleProductFlag.bind(
                        null,
                        p.id,
                        "is_available",
                        !p.is_available
                      )}
                    >
                      {p.is_available ? "Tandai habis" : "Tandai tersedia"}
                    </ActionButton>
                    <ActionButton
                      action={toggleProductFlag.bind(
                        null,
                        p.id,
                        "is_active",
                        !p.is_active
                      )}
                    >
                      {p.is_active ? "Nonaktifkan" : "Aktifkan"}
                    </ActionButton>
                  </td>
                </tr>
              );
            })}
            {!products?.length && (
              <tr>
                <td
                  colSpan={6}
                  className="p-6 text-center text-muted-foreground"
                >
                  Tidak ada produk
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
