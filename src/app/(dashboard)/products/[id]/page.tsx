import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatRupiah } from "@/lib/money";
import { ProductForm } from "@/components/products/product-form";
import { VariantForm } from "@/components/products/variant-form";
import { ActionButton } from "@/components/layout/action-button";
import { toggleVariant } from "../actions";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!product) notFound();

  const [{ data: allCategories }, { data: variants }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, is_active")
      .order("sort_order"),
    supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", id)
      .order("created_at"),
  ]);
  const categories = (allCategories ?? []).filter(
    (c) => c.is_active || c.id === product.category_id
  );

  return (
    <div className="space-y-10">
      <section className="space-y-6">
        <h1 className="text-2xl font-semibold">Edit produk</h1>
        <ProductForm product={product} categories={categories} />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Varian</h2>
        <VariantForm productId={product.id} />
        <div className="max-w-xl overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left">
              <tr>
                <th className="p-3">Varian</th>
                <th className="p-3">Harga akhir</th>
                <th className="p-3">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {variants?.map((vr) => (
                <tr key={vr.id} className="border-t">
                  <td className="p-3">{vr.name}</td>
                  <td className="p-3">
                    {formatRupiah(product.price + vr.price_delta)}
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({vr.price_delta >= 0 ? "+" : ""}
                      {vr.price_delta})
                    </span>
                  </td>
                  <td className="p-3">{vr.is_active ? "Aktif" : "Nonaktif"}</td>
                  <td className="p-3 text-right">
                    <ActionButton
                      action={toggleVariant.bind(
                        null,
                        vr.id,
                        product.id,
                        !vr.is_active
                      )}
                    >
                      {vr.is_active ? "Nonaktifkan" : "Aktifkan"}
                    </ActionButton>
                  </td>
                </tr>
              ))}
              {!variants?.length && (
                <tr>
                  <td
                    colSpan={4}
                    className="p-4 text-center text-muted-foreground"
                  >
                    Belum ada varian
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
