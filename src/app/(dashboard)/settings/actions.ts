"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { settingsSchema } from "@/lib/validations/menu";
import type { ActionState } from "@/types/action";

export async function saveSettings(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  const me = await getCurrentProfile();
  if (me.role !== "owner") return { error: "Tidak diizinkan" };

  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_settings")
    .update(parsed.data)
    .eq("id", true)
    .select("id");

  if (error || !data?.length) return { error: "Gagal menyimpan pengaturan" };

  revalidatePath("/settings");
  return { success: "Pengaturan tersimpan" };
}
