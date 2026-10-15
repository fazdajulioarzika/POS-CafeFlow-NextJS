import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function RecipesPage() {
  const supabase = await createClient();
  const [{ data: products }, { data: lines }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
    supabase.from("product_recipes").select("product_id"),
  ]);

  const count = new Map<string, number>();
  lines?.forEach((l) =>
    count.set(l.product_id, (count.get(l.product_id) ?? 0) + 1)
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Resep</h1>
      <p className="text-sm text-muted-foreground">
        Produk tanpa resep tidak mengurangi stok bahan saat terjual.
      </p>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left">
            <tr>
              <th className="p-3">Produk</th>
              <th className="p-3">Resep</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {products?.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-3 font-medium">{p.name}</td>
                <td className="p-3">
                  {count.get(p.id)
                    ? `${count.get(p.id)} bahan`
                    : "Belum ada resep"}
                </td>
                <td className="p-3 text-right">
                  <Link
                    href={`/recipes/${p.id}`}
                    className="inline-flex h-8 items-center rounded-md border px-3 text-sm"
                  >
                    Atur resep
                  </Link>
                </td>
              </tr>
            ))}
            {!products?.length && (
              <tr>
                <td
                  colSpan={3}
                  className="p-6 text-center text-muted-foreground"
                >
                  Belum ada produk aktif
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
