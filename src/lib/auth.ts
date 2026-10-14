import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MENU_MANAGERS, type Role } from "@/lib/permissions";

export const getCurrentProfile = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.is_active) redirect("/login");
  return { ...profile, email: user.email ?? "", role: profile.role as Role };
});

// owner/manager atau null; dipakai di setiap Server Action master data
export async function getMenuManager() {
  const me = await getCurrentProfile();
  return MENU_MANAGERS.includes(me.role) ? me : null;
}
