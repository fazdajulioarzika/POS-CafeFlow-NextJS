"use client";

import { usePathname } from "next/navigation";

export function AutoFilterForm({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  return (
    <form
      method="get"
      action={pathname}
      className={className}
      onChange={(e) => {
        const t = e.target as unknown as HTMLInputElement;
        if (t.tagName === "SELECT" || t.type === "date")
          e.currentTarget.requestSubmit();
      }}
    >
      {children}
    </form>
  );
}
