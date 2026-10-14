"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getMenuManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { productSchema, variantSchema } from "@/lib/validations/menu";
import type { ActionState } from "@/types/action";

const BUCKET = "product-images";
const MAX_IMAGE = 2 * 1024 * 1024;
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function saveProduct(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  const me = await getMenuManager();
  if (!me) return { error: "Tidak diizinkan" };

  const s = (k: string) => String(formData.get(k) ?? "");
  const values = {
    name: s("name"),
    sku: s("sku"),
    description: s("description"),
    category_id: s("category_id"),
    price: s("price"),
  };

  const parsed = productSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };

  const id = s("id");
  const supabase = await createClient();

  // --- foto ---
  let newPath: string | null = null;
  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    if (!EXT[file.type])
      return { error: "Foto harus JPG, PNG, atau WebP", values };
    if (file.size > MAX_IMAGE)
      return { error: "Ukuran foto maksimal 2 MB", values };

    newPath = `products/${crypto.randomUUID()}.${EXT[file.type]}`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(newPath, file, { contentType: file.type, upsert: false });
    if (upErr) return { error: "Gagal mengunggah foto", values };
  }

  let oldPath: string | null = null;
  if (id) {
    const { data: cur } = await supabase
      .from("products")
      .select("image_path")
      .eq("id", id)
      .maybeSingle();
    oldPath = cur?.image_path ?? null;
  }

  // undefined = foto tidak berubah
  let image_path: string | null | undefined = undefined;
  if (newPath) image_path = newPath;
  else if (formData.get("remove_image") === "on") image_path = null;

  const payload = {
    ...parsed.data,
    is_active: formData.get("is_active") === "on",
    is_available: formData.get("is_available") === "on",
    ...(image_path !== undefined && { image_path }),
  };

  let productId = id;
  let dbError: { code?: string } | null = null;

  if (id) {
    const { data, error } = await supabase
      .from("products")
      .update(payload)
      .eq("id", id)
      .select("id");
    dbError = error ?? (data?.length ? null : { code: "NOROW" });
  } else {
    const { data, error } = await supabase
      .from("products")
      .insert(payload)
      .select("id")
      .single();
    dbError = error;
    if (data) productId = data.id;
  }

  if (dbError) {
    if (newPath) await supabase.storage.from(BUCKET).remove([newPath]); // rollback foto baru
    const msg =
      dbError.code === "23505"
        ? "SKU sudah dipakai produk lain"
        : dbError.code === "23503"
        ? "Kategori tidak valid"
        : "Gagal menyimpan produk";
    return { error: msg, values };
  }

  // hapus foto lama setelah DB sukses (best effort)
  if (oldPath && image_path !== undefined) {
    await supabase.storage.from(BUCKET).remove([oldPath]);
  }

  revalidatePath("/products");
  if (!id) redirect(`/products/${productId}`);
  revalidatePath(`/products/${id}`);
  return { success: "Produk tersimpan" };
}

export async function toggleProductFlag(
  id: string,
  field: "is_active" | "is_available",
  value: boolean
) {
  const me = await getMenuManager();
  if (!me) throw new Error("Tidak diizinkan");
  if (field !== "is_active" && field !== "is_available")
    throw new Error("Field tidak valid");

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ [field]: value })
    .eq("id", id);
  if (error) throw new Error("Gagal mengubah status");
  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
}

export async function addVariant(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  const me = await getMenuManager();
  if (!me) return { error: "Tidak diizinkan" };

  const parsed = variantSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("product_variants").insert(parsed.data);
  if (error) return { error: "Gagal menambah varian" };

  revalidatePath(`/products/${parsed.data.product_id}`);
  return { success: "Varian ditambahkan" };
}

export async function toggleVariant(
  variantId: string,
  productId: string,
  active: boolean
) {
  const me = await getMenuManager();
  if (!me) throw new Error("Tidak diizinkan");

  const supabase = await createClient();
  const { error } = await supabase
    .from("product_variants")
    .update({ is_active: active })
    .eq("id", variantId);
  if (error) throw new Error("Gagal mengubah varian");
  revalidatePath(`/products/${productId}`);
}
