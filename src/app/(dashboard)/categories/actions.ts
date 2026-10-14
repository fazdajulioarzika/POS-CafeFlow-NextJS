"use server";

import { revalidatePath } from "next/cache";
import { getMenuManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { categorySchema } from "@/lib/validations/menu";
import type { ActionState } from "@/types/action";

export async function saveCategory(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  const me = await getMenuManager();
  if (!me) return { error: "Tidak diizinkan" };

  const parsed = categorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();

  const { error } = id
    ? await supabase.from("categories").update(parsed.data).eq("id", id)
    : await supabase.from("categories").insert(parsed.data);

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Nama kategori sudah dipakai"
          : "Gagal menyimpan kategori",
    };
  }

  revalidatePath("/categories");
  return { success: "Kategori tersimpan" };
}

export async function toggleCategory(id: string, active: boolean) {
  const me = await getMenuManager();
  if (!me) throw new Error("Tidak diizinkan");

  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({ is_active: active })
    .eq("id", id);
  if (error) throw new Error("Gagal mengubah status");
  revalidatePath("/categories");
}
