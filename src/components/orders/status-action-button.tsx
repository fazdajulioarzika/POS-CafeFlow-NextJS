"use client";

import { useState, useTransition } from "react";
import { setOrderStatus } from "@/app/(dashboard)/orders/actions";
import { Button } from "@/components/ui/button";

export function StatusActionButton({
  orderId,
  to,
  children,
}: {
  orderId: string;
  to: "preparing" | "ready" | "served" | "completed";
  children: React.ReactNode;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      <Button
        type="button"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await setOrderStatus(orderId, to);
            if (!res.ok) setError(res.error);
          })
        }
      >
        {pending ? "..." : children}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
