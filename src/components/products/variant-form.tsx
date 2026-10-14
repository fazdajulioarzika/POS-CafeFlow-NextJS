"use client";

import { useActionState } from "react";
import { addVariant } from "@/app/(dashboard)/products/actions";
import type { ActionState } from "@/types/action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function VariantForm({ productId }: { productId: string }) {
  const [state, action, pending] = useActionState(
    addVariant,
    {} as ActionState
  );

  return (
    <form
      action={action}
      className="grid max-w-xl gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
    >
      <input type="hidden" name="product_id" value={productId} />
      <div className="space-y-2">
        <Label htmlFor="variant_name">Nama varian</Label>
        <Input
          id="variant_name"
          name="name"
          placeholder="Large"
          required
          maxLength={60}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="price_delta">Selisih harga (Rp)</Label>
        <Input
          id="price_delta"
          name="price_delta"
          type="number"
          step={1}
          defaultValue={0}
          required
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "..." : "Tambah"}
      </Button>
      {state.error && (
        <p role="alert" className="text-sm text-destructive sm:col-span-3">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-sm text-primary sm:col-span-3">
          {state.success}
        </p>
      )}
    </form>
  );
}
