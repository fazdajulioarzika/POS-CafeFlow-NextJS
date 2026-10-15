"use client";

import { useActionState } from "react";
import { updateIngredient } from "@/app/(dashboard)/inventory/actions";
import type { ActionState } from "@/types/action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function IngredientEditForm({
  ingredient,
}: {
  ingredient: { id: string; name: string; unit: string; minimum_stock: number };
}) {
  const [state, action, pending] = useActionState(
    updateIngredient,
    {} as ActionState
  );

  return (
    <form action={action} className="grid max-w-md gap-4">
      <input type="hidden" name="id" value={ingredient.id} />
      <div className="space-y-2">
        <Label htmlFor="e_name">Nama bahan</Label>
        <Input
          id="e_name"
          name="name"
          defaultValue={ingredient.name}
          required
          maxLength={80}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="e_min">Stok minimum ({ingredient.unit})</Label>
        <Input
          id="e_min"
          name="minimum_stock"
          type="number"
          min={0}
          step="0.001"
          defaultValue={ingredient.minimum_stock}
          required
        />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-sm text-primary">
          {state.success}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan..." : "Simpan"}
      </Button>
    </form>
  );
}
