"use client";

import { useTransition } from "react";
import { setUserActive } from "@/app/(dashboard)/users/actions";
import { Button } from "@/components/ui/button";

export function ToggleActiveButton({
  userId,
  isActive,
}: {
  userId: string;
  isActive: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => start(() => setUserActive(userId, !isActive))}
    >
      {isActive ? "Nonaktifkan" : "Aktifkan"}
    </Button>
  );
}
