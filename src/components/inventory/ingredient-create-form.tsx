"use client";

import { useActionState } from "react";
import { createIngredient } from "@/app/(dashboard)/inventory/actions";
import { UNITS, unitLabel } from "@/lib/units";
import type { ActionState } from "@/types/action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function IngredientCreateForm() {
  const [state, action, pending] = useActionState(
    createIngredient,
    {} as ActionState
  );

  return (
    <form action={action} className="grid max-w-xl gap-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="name">Nama bahan</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={80}
          placeholder="Susu"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="unit">Satuan dasar</Label>
        <select
          id="unit"
          name="unit"
          defaultValue="g"
          className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
        >
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {unitLabel[u]}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="minimum_stock">Stok minimum</Label>
        <Input
          id="minimum_stock"
          name="minimum_stock"
          type="number"
          min={0}
          step="0.001"
          defaultValue={0}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="initial_stock">Stok awal</Label>
        <Input
          id="initial_stock"
          name="initial_stock"
          type="number"
          min={0}
          step="0.001"
          defaultValue={0}
          required
        />
      </div>
      <p className="self-end text-xs text-muted-foreground">
        Stok minimum dan awal memakai satuan dasar. Untuk kg atau liter, pakai
        form Stok masuk.
      </p>
      {state.error && (
        <p role="alert" className="text-sm text-destructive sm:col-span-2">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-sm text-primary sm:col-span-2">
          {state.success}
        </p>
      )}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan..." : "Tambah bahan"}
        </Button>
      </div>
    </form>
  );
}
