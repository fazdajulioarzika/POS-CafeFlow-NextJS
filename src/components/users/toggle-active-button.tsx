"use client";

import { useState, useTransition } from "react";
import { setUserActive } from "@/app/(dashboard)/users/actions";
import { Button } from "@/components/ui/button";

export function ToggleActiveButton({
  userId,
  isActive,
  isSelf,
}: {
  userId: string;
  isActive: boolean;
  isSelf: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (isSelf)
    return <span className="text-xs text-muted-foreground">Akun Anda</span>;

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await setUserActive(userId, !isActive);
            if (!res.ok) setError(res.error);
          })
        }
      >
        {isActive ? "Nonaktifkan" : "Aktifkan"}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
