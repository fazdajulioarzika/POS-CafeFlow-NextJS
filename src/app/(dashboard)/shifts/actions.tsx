"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cfMessage } from "@/lib/db-error";
import {
  cashMovementSchema,
  closeShiftSchema,
  openShiftSchema,
} from "@/lib/validations/shift";
import type { ActionState } from "@/types/action";

const ALLOWED = ["owner", "manager", "cashier"];

export async function openShift(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  const me = await getCurrentProfile();
  if (!ALLOWED.includes(me.role)) return { error: "Tidak diizinkan" };

  const parsed = openShiftSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("open_shift", {
    p_opening: parsed.data.opening_cash,
  });
  if (error) return { error: cfMessage(error.message, "Gagal membuka shift") };

  revalidatePath("/shifts");
  revalidatePath("/pos");
  return { success: "Shift dibuka" };
}

export async function addCashMovement(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  const me = await getCurrentProfile();
  if (!ALLOWED.includes(me.role)) return { error: "Tidak diizinkan" };

  const parsed = cashMovementSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_cash_movement", {
    p_type: parsed.data.type,
    p_amount: parsed.data.amount,
    p_reason: parsed.data.reason,
  });
  if (error) return { error: cfMessage(error.message, "Gagal mencatat kas") };

  revalidatePath("/shifts");
  return { success: "Kas tercatat" };
}

export async function closeShift(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  const me = await getCurrentProfile();
  if (!ALLOWED.includes(me.role)) return { error: "Tidak diizinkan" };

  const parsed = closeShiftSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("close_shift", {
    p_closing: parsed.data.closing_cash,
    p_note: parsed.data.note,
  });
  if (error) return { error: cfMessage(error.message, "Gagal menutup shift") };

  revalidatePath("/shifts");
  revalidatePath("/pos");
  return { success: "Shift ditutup" };
}
