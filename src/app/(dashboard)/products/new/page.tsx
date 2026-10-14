import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/products/product-form";

export default async function NewProductPage() {
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, is_active")
    .eq("is_active", true)
    .order("sort_order");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Produk baru</h1>
      {categories?.length ? (
        <ProductForm categories={categories} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Buat kategori aktif terlebih dahulu di menu Categories.
        </p>
      )}
    </div>
  );
}
