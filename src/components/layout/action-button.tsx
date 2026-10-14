"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";

export function ActionButton({
  action,
  children,
}: {
  action: () => Promise<unknown>;
  children: React.ReactNode;
}) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await action();
        })
      }
    >
      {pending ? "..." : children}
    </Button>
  );
}
