import { getCurrentProfile } from "@/lib/auth";
import { canAccess, navGroups } from "@/lib/permissions";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Button } from "@/components/ui/button";
import { logout } from "../(auth)/actions";
import Link from "next/link";

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

  // hanya menu yang boleh diakses role ini; grup kosong dibuang
  const groups = navGroups
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => canAccess(profile.role, i.href)),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="min-h-screen">
      <aside className="hidden overflow-y-auto border-r bg-sidebar md:fixed md:inset-y-0 md:left-0 md:z-30 md:block md:w-56 print:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="p-3 m-2 [text-shadow:2px_2px_0px_rgba(188,255,0,0.8)] text-3xl border-b border-b-muted-foreground">
          CafeFlow
        </div>
        <Sidebar groups={groups} />
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col md:pl-56 print:pl-0">
        <div className="sticky top-0 z-20 border-b bg-card print:hidden">
          <header className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="md:hidden">
                <MobileNav groups={groups} />
              </div>
              <div className="text-sm">
                <Link
                  href="/profile"
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {profile.full_name || profile.email}
                </Link>
                <span className="ml-2 rounded-md bg-secondary px-2 py-0.5 text-xs">
                  {roleLabel[profile.role]}
                </span>
              </div>
            </div>
            <form action={logout}>
              <Button type="submit" variant="outline" size="sm">
                Keluar
              </Button>
            </form>
          </header>
        </div>

        <main className="flex-1 p-6 print:p-0">{children}</main>
      </div>
    </div>
  );
}
