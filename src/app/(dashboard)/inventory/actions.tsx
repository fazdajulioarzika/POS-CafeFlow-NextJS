"use server";

import { revalidatePath } from "next/cache";
import { getMenuManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cfMessage } from "@/lib/db-error";
import { toBase, type Unit } from "@/lib/units";
import {
  ingredientCreateSchema,
  ingredientEditSchema,
  movementSchema,
} from "@/lib/validations/inventory";
import type { ActionState } from "@/types/action";

export async function createIngredient(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  const me = await getMenuManager();
  if (!me) return { error: "Tidak diizinkan" };

  const parsed = ingredientCreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_ingredient", {
    p_name: parsed.data.name,
    p_unit: parsed.data.unit,
    p_minimum: parsed.data.minimum_stock,
    p_initial: parsed.data.initial_stock,
  });
  if (error) return { error: cfMessage(error.message, "Gagal menambah bahan") };

  revalidatePath("/inventory");
  return { success: "Bahan ditambahkan" };
}

export async function updateIngredient(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  const me = await getMenuManager();
  if (!me) return { error: "Tidak diizinkan" };

  const parsed = ingredientEditSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ingredients")
    .update({
      name: parsed.data.name,
      minimum_stock: parsed.data.minimum_stock,
    })
    .eq("id", parsed.data.id)
    .select("id");

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Nama bahan sudah dipakai"
          : "Gagal menyimpan bahan",
    };
  }
  if (!data?.length) return { error: "Bahan tidak ditemukan" };

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${parsed.data.id}`);
  return { success: "Bahan tersimpan" };
}

export async function toggleIngredient(id: string, active: boolean) {
  const me = await getMenuManager();
  if (!me) throw new Error("Tidak diizinkan");

  const supabase = await createClient();
  const { error } = await supabase
    .from("ingredients")
    .update({ is_active: active })
    .eq("id", id);
  if (error) throw new Error("Gagal mengubah status");
  revalidatePath("/inventory");
}

export async function recordMovement(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  const me = await getMenuManager();
  if (!me) return { error: "Tidak diizinkan" };

  const parsed = movementSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;

  if (v.type !== "purchase" && !v.reason)
    return { error: "Alasan wajib diisi" };

  const supabase = await createClient();
  const { data: ing } = await supabase
    .from("ingredients")
    .select("unit")
    .eq("id", v.ingredient_id)
    .maybeSingle();
  if (!ing) return { error: "Bahan tidak ditemukan" };

  const base = toBase(v.quantity, ing.unit as Unit, v.input_unit);
  if (base === null) return { error: "Satuan tidak valid" };
  if (v.type !== "adjustment" && base <= 0)
    return { error: "Jumlah harus lebih dari 0" };

  const { error } = await supabase.rpc("record_stock_movement", {
    p_ingredient_id: v.ingredient_id,
    p_type: v.type,
    p_quantity: base,
    p_reason: v.reason ?? "",
  });
  if (error)
    return { error: cfMessage(error.message, "Gagal mencatat mutasi") };

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${v.ingredient_id}`);
  return { success: "Mutasi stok tercatat" };
}
