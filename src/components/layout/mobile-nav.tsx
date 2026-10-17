"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import type { NavGroup } from "@/lib/permissions";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";

export function MobileNav({ groups }: { groups: NavGroup[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? (
          <X className="mr-1 h-4 w-4" aria-hidden />
        ) : (
          <Menu className="mr-1 h-4 w-4" aria-hidden />
        )}
        Menu
      </Button>
      {open && (
        // menempel di bawah header sticky (induk posisinya adalah container sticky)
        <div className="absolute inset-x-0 top-full max-h-[70vh] overflow-y-auto border-b bg-sidebar">
          <Sidebar groups={groups} onNavigate={() => setOpen(false)} />
        </div>
      )}
    </>
  );
}
