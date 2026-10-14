"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createUserSchema } from "@/lib/validations/user";

export type UserFormState = { error?: string; success?: string };

export async function createUser(
  _: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  // otorisasi di server: hanya owner
  const me = await getCurrentProfile();
  if (me.role !== "owner") return { error: "Tidak diizinkan" };

  const parsed = createUserSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.full_name },
  });
  if (error || !data.user)
    return { error: "Gagal membuat user (email mungkin sudah dipakai)" };

  // trigger membuat profil default cashier; set role sesuai pilihan
  const { error: roleError } = await admin
    .from("profiles")
    .update({ role: parsed.data.role, full_name: parsed.data.full_name })
    .eq("id", data.user.id);
  if (roleError) return { error: "User dibuat, tetapi gagal mengatur role" };

  revalidatePath("/users");
  return { success: `User ${parsed.data.email} berhasil dibuat` };
}

export async function setUserActive(userId: string, isActive: boolean) {
  const me = await getCurrentProfile();
  if (me.role !== "owner") throw new Error("Tidak diizinkan");
  if (userId === me.id)
    throw new Error("Tidak bisa menonaktifkan akun sendiri");

  const supabase = await createClient(); // RLS: hanya owner yang boleh update
  await supabase
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", userId);
  revalidatePath("/users");
}
