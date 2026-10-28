import { createClient } from "@/lib/supabase/server";
import { CreateUserForm } from "@/components/users/create-user-form";
import { ToggleActiveButton } from "@/components/users/toggle-active-button";
import { getCurrentProfile } from "@/lib/auth";

export default async function UsersPage() {
  const me = await getCurrentProfile();
  const supabase = await createClient();
  const { data: users } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active")
    .order("created_at");

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Users</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Tambah user</h2>
        <CreateUserForm />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Daftar user</h2>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left">
              <tr>
                <th className="p-3">Nama</th>
                <th className="p-3">Role</th>
                <th className="p-3">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {users?.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="p-3">{u.full_name || "-"}</td>
                  <td className="p-3 capitalize">{u.role}</td>
                  <td className="p-3">{u.is_active ? "Aktif" : "Nonaktif"}</td>
                  <td className="p-3 text-right">
                    <ToggleActiveButton
                      userId={u.id}
                      isActive={u.is_active}
                      isSelf={u.id === me.id}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
