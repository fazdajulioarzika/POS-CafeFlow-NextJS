"use server";

import { revalidatePath } from "next/cache";
import { getMenuManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { recipeLineSchema } from "@/lib/validations/inventory";
import type { ActionState } from "@/types/action";

// memilih bahan yang sudah ada di resep = mengganti jumlahnya
export async function saveRecipeLine(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  const me = await getMenuManager();
  if (!me) return { error: "Tidak diizinkan" };

  const parsed = recipeLineSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("product_recipes")
    .upsert(parsed.data, { onConflict: "product_id,ingredient_id" });

  if (error) {
    return {
      error:
        error.code === "23503"
          ? "Produk atau bahan tidak valid"
          : "Gagal menyimpan resep",
    };
  }

  revalidatePath("/recipes");
  revalidatePath(`/recipes/${parsed.data.product_id}`);
  return { success: "Resep tersimpan" };
}

export async function removeRecipeLine(lineId: string, productId: string) {
  const me = await getMenuManager();
  if (!me) throw new Error("Tidak diizinkan");

  const supabase = await createClient();
  const { error } = await supabase
    .from("product_recipes")
    .delete()
    .eq("id", lineId);
  if (error) throw new Error("Gagal menghapus baris resep");

  revalidatePath("/recipes");
  revalidatePath(`/recipes/${productId}`);
}
