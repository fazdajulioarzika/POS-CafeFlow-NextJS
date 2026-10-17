"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavGroup, NavItem } from "@/lib/permissions";

export function Sidebar({
  groups,
  onNavigate,
}: {
  groups: NavGroup[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const uid = useId();
  // pilihan manual pengguna; bila belum ada, grup terbuka jika berisi halaman aktif
  const [override, setOverride] = useState<Record<string, boolean>>({});

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const renderLink = (item: NavItem, nested = false) => (
    <Link
      key={item.href}
      href={item.href}
      onClick={onNavigate}
      aria-current={isActive(item.href) ? "page" : undefined}
      className={cn(
        "block rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        nested && "py-1.5",
        isActive(item.href)
          ? "bg-primary text-primary-foreground"
          : "text-foreground hover:bg-secondary"
      )}
    >
      {item.label}
    </Link>
  );

  // menu pendek (cashier/kitchen): tanpa dropdown
  if (groups.length <= 1) {
    return (
      <nav aria-label="Navigasi utama" className="flex flex-col gap-1 p-3">
        {groups.flatMap((g) => g.items).map((i) => renderLink(i))}
      </nav>
    );
  }

  return (
    <nav aria-label="Navigasi utama" className="flex flex-col gap-1 p-3">
      {groups.map((g, idx) => {
        if (g.items.length === 1) return renderLink(g.items[0]);

        const groupActive = g.items.some((i) => isActive(i.href));
        const expanded = override[g.label] ?? groupActive;
        const listId = `${uid}-${idx}`;

        return (
          <div key={g.label}>
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={listId}
              onClick={() =>
                setOverride((o) => ({ ...o, [g.label]: !expanded }))
              }
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary",
                groupActive ? "text-primary" : "text-foreground"
              )}
            >
              <span className="flex items-center gap-2">
                {g.label}
                {groupActive && !expanded && (
                  <>
                    <span
                      className="h-2 w-2 rounded-full bg-primary"
                      aria-hidden
                    />
                    <span className="sr-only">(berisi halaman aktif)</span>
                  </>
                )}
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  expanded && "rotate-180"
                )}
                aria-hidden
              />
            </button>
            <ul
              id={listId}
              hidden={!expanded}
              className="ml-4 mt-1 space-y-1 border-l pl-2"
            >
              {g.items.map((i) => (
                <li key={i.href}>{renderLink(i, true)}</li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
