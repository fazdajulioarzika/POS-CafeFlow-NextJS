"use client";

import { useActionState, useState } from "react";
import { saveRecipeLine } from "@/app/(dashboard)/recipes/actions";
import type { ActionState } from "@/types/action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Ing = { id: string; name: string; unit: string };

export function RecipeForm({
  productId,
  ingredients,
}: {
  productId: string;
  ingredients: Ing[];
}) {
  const [state, action, pending] = useActionState(
    saveRecipeLine,
    {} as ActionState
  );
  const [selected, setSelected] = useState("");
  const unit = ingredients.find((i) => i.id === selected)?.unit;

  return (
    <form
      action={action}
      className="grid max-w-xl gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
    >
      <input type="hidden" name="product_id" value={productId} />
      <div className="space-y-2">
        <Label htmlFor="r_ing">Bahan</Label>
        <select
          id="r_ing"
          name="ingredient_id"
          required
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
        >
          <option value="" disabled>
            Pilih bahan
          </option>
          {ingredients.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name} ({i.unit})
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="r_qty">
          Kebutuhan per porsi{unit ? ` (${unit})` : ""}
        </Label>
        <Input
          id="r_qty"
          name="quantity_required"
          type="number"
          min={0}
          step="0.001"
          required
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "..." : "Simpan"}
      </Button>
      <p className="text-xs text-muted-foreground sm:col-span-3">
        Satuan resep selalu sama dengan satuan dasar bahan. Memilih bahan yang
        sudah ada akan mengganti jumlahnya.
      </p>
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
