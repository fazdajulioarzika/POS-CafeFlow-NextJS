import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PosClient } from "@/components/pos/pos-client";

export default async function PosPage() {
  const me = await getCurrentProfile();
  const supabase = await createClient();

  const [c, p, v, t, s] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),
    supabase
      .from("products")
      .select("id, name, price, image_path, category_id, is_available")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("product_variants")
      .select("id, product_id, name, price_delta")
      .eq("is_active", true)
      .order("price_delta"),
    supabase
      .from("dining_tables")
      .select("id, table_number, capacity, status")
      .eq("is_active", true)
      .order("table_number"),
    supabase.from("app_settings").select("tax_percent").single(),
  ]);

  const categories = c.data ?? [];
  const activeCategory = new Set(categories.map((x) => x.id));
  const products = (p.data ?? []).filter((x) =>
    activeCategory.has(x.category_id)
  );

  return (
    <PosClient
      categories={categories}
      products={products}
      variants={v.data ?? []}
      tables={t.data ?? []}
      taxPercent={Number(s.data?.tax_percent ?? 0)}
      canDiscount={me.role !== "cashier"}
    />
  );
}
