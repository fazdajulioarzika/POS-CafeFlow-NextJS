import { getCurrentProfile } from "@/lib/auth";
import { canAccess, navItems } from "@/lib/permissions";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { logout } from "../(auth)/actions";

const roleLabel = {
  owner: "Owner",
  manager: "Manager",
  cashier: "Cashier",
  kitchen: "Kitchen",
} as const;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  const items = navItems.filter((i) => canAccess(profile.role, i.href));

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 border-r bg-sidebar md:block">
        <div className="p-3 m-2 [text-shadow:2px_2px_0px_rgba(188,255,0,0.8)] text-3xl border-b border-b-muted-foreground">
          CafeFlow
        </div>
        <Sidebar items={items} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-card px-4 py-3">
          <div className="text-sm">
            <span className="font-medium">
              {profile.full_name || profile.email}
            </span>
            <span className="ml-2 rounded-md bg-secondary px-2 py-0.5 text-xs">
              {roleLabel[profile.role]}
            </span>
          </div>
          <form action={logout}>
            <Button type="submit" variant="outline" size="sm">
              Keluar
            </Button>
          </form>
        </header>

        {/* navigasi mobile sederhana */}
        <div className="border-b bg-sidebar md:hidden">
          <Sidebar items={items} />
        </div>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
