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

  const { error: roleError } = await admin
    .from("profiles")
    .update({
      role: parsed.data.role,
      full_name: parsed.data.full_name,
      is_active: true,
    })
    .eq("id", data.user.id);
  if (roleError) return { error: "User dibuat, tetapi gagal mengatur role" };

  // service role tidak punya auth.uid(), jadi pelaku dicatat eksplisit
  await admin.rpc("write_audit", {
    p_actor: me.id,
    p_action: "user.created",
    p_entity_type: "user",
    p_entity_id: data.user.id,
    p_metadata: {
      email: parsed.data.email,
      role: parsed.data.role,
      name: parsed.data.full_name,
    },
  });

  revalidatePath("/users");
  return { success: `User ${parsed.data.email} berhasil dibuat` };
}

export async function setUserActive(
  userId: string,
  isActive: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await getCurrentProfile()
  if (me.role !== 'owner') return { ok: false, error: 'Tidak diizinkan' }
  if (userId === me.id) return { ok: false, error: 'Tidak bisa menonaktifkan akun sendiri' }

  const supabase = await createClient() // RLS: hanya owner yang boleh update
  const { error } = await supabase.from('profiles').update({ is_active: isActive }).eq('id', userId)
  if (error) {
    const msg = error.message.startsWith('CF:') ? error.message.slice(3) : 'Gagal mengubah status'
    return { ok: false, error: msg }
  }

  revalidatePath('/users')
  return { ok: true }
}
