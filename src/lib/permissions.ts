export type Role = "owner" | "manager" | "cashier" | "kitchen";
export const MENU_MANAGERS: Role[] = ["owner", "manager"];

export const routeAccess: { prefix: string; roles: Role[] }[] = [
  { prefix: "/dashboard", roles: ["owner", "manager"] },
  { prefix: "/pos", roles: ["owner", "manager", "cashier"] },
  { prefix: "/orders", roles: ["owner", "manager", "cashier"] },
  { prefix: "/kitchen", roles: ["owner", "manager", "kitchen"] },
  { prefix: "/tables", roles: ["owner", "manager", "cashier"] },
  { prefix: "/products", roles: ["owner", "manager"] },
  { prefix: "/categories", roles: ["owner", "manager"] },
  { prefix: "/inventory", roles: ["owner", "manager"] },
  { prefix: "/recipes", roles: ["owner", "manager"] },
  { prefix: "/reports", roles: ["owner", "manager"] },
  { prefix: "/shifts", roles: ["owner", "manager", "cashier"] },
  { prefix: "/users", roles: ["owner"] },
  { prefix: "/settings", roles: ["owner"] },
  { prefix: "/audit-logs", roles: ["owner"] },
  { prefix: "/profile", roles: ["owner", "manager", "cashier", "kitchen"] },
  { prefix: "/receipt", roles: ["owner", "manager", "cashier"] },
];

export const defaultRoute: Record<Role, string> = {
  owner: "/dashboard",
  manager: "/dashboard",
  cashier: "/pos",
  kitchen: "/kitchen",
};

export function canAccess(role: Role, pathname: string): boolean {
  const rule = routeAccess.find(
    (r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/")
  );
  return rule ? rule.roles.includes(role) : false;
}

export type NavItem = { href: string; label: string };
export type NavGroup = { label: string; items: NavItem[] };

export const navGroups: NavGroup[] = [
  {
    label: "Dashboard",
    items: [{ href: "/dashboard", label: "Dashboard" }],
  },
  {
    label: "Operasional",
    items: [
      { href: "/pos", label: "POS" },
      { href: "/orders", label: "Orders" },
      { href: "/kitchen", label: "Kitchen" },
      { href: "/tables", label: "Tables" },
      { href: "/shifts", label: "Shifts" },
    ],
  },
  {
    label: "Menu & Stok",
    items: [
      { href: "/products", label: "Products" },
      { href: "/categories", label: "Categories" },
      { href: "/recipes", label: "Recipes" },
      { href: "/inventory", label: "Inventory" },
    ],
  },
  {
    label: "Laporan",
    items: [
      { href: "/reports", label: "Reports" },
      { href: "/audit-logs", label: "Audit Log" },
    ],
  },
  {
    label: "Pengaturan",
    items: [
      { href: "/users", label: "Users" },
      { href: "/settings", label: "Settings" },
    ],
  },
];

// versi datar, tetap tersedia bila ada kode lain yang memakainya
export const navItems: NavItem[] = navGroups.flatMap((g) => g.items);
