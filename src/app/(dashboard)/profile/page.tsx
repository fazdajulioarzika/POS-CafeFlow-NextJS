import { getCurrentProfile } from "@/lib/auth";
import { ChangePasswordForm } from "@/components/profile/change-password-form";

const roleLabel = {
  owner: "Owner",
  manager: "Manager",
  cashier: "Cashier",
  kitchen: "Kitchen",
} as const;

export default async function ProfilePage() {
  const me = await getCurrentProfile();
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Profil</h1>
      <dl className="grid max-w-md gap-2 rounded-xl border bg-card p-4 text-sm">
        <div className="flex justify-between">
          <dt>Nama</dt>
          <dd className="font-medium">{me.full_name || "-"}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Email</dt>
          <dd className="font-medium">{me.email}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Role</dt>
          <dd className="font-medium">{roleLabel[me.role]}</dd>
        </div>
      </dl>
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Ganti kata sandi</h2>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
