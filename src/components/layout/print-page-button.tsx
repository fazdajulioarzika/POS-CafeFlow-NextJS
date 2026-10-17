"use client";

import { Button } from "@/components/ui/button";

export function PrintPageButton() {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => window.print()}
    >
      Cetak halaman
    </Button>
  );
}
