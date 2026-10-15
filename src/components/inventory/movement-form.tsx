"use client";

import { useActionState, useState } from "react";
import { recordMovement } from "@/app/(dashboard)/inventory/actions";
import { INPUT_UNITS, type Unit } from "@/lib/units";
import type { ActionState } from "@/types/action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Kind = "purchase" | "waste" | "adjustment";

const qtyLabel: Record<Kind, string> = {
  purchase: "Jumlah masuk",
  waste: "Jumlah rusak/terbuang",
  adjustment: "Stok aktual hasil hitung",
};

export function MovementForm({
  ingredientId,
  unit,
}: {
  ingredientId: string;
  unit: Unit;
}) {
  const [state, action, pending] = useActionState(
    recordMovement,
    {} as ActionState
  );
  const [kind, setKind] = useState<Kind>("purchase");
  const units = INPUT_UNITS[unit];

  return (
    <form action={action} className="grid max-w-xl gap-4 sm:grid-cols-2">
      <input type="hidden" name="ingredient_id" value={ingredientId} />

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="m_type">Jenis mutasi</Label>
        <select
          id="m_type"
          name="type"
          value={kind}
          onChange={(e) => setKind(e.target.value as Kind)}
          className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
        >
          <option value="purchase">Stok masuk</option>
          <option value="waste">Bahan rusak/terbuang</option>
          <option value="adjustment">Penyesuaian (stok opname)</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="m_qty">{qtyLabel[kind]}</Label>
        <Input
          id="m_qty"
          name="quantity"
          type="number"
          min={0}
          step="0.001"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="m_unit">Satuan</Label>
        <select
          id="m_unit"
          name="input_unit"
          className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
        >
          {units.map((u) => (
            <option key={u.unit} value={u.unit}>
              {u.unit}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="m_reason">
          Alasan{kind === "purchase" ? " (opsional)" : ""}
        </Label>
        <Input
          id="m_reason"
          name="reason"
          maxLength={200}
          required={kind !== "purchase"}
          placeholder={
            kind === "adjustment"
              ? "Hasil stok opname"
              : kind === "waste"
              ? "Tumpah / kedaluwarsa"
              : "Belanja pasar"
          }
        />
      </div>

      {kind === "adjustment" && (
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Isi dengan jumlah <strong>sebenarnya</strong> di rak. Sistem
          menghitung selisihnya dan mencatatnya sebagai mutasi.
        </p>
      )}
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
          {pending ? "Menyimpan..." : "Catat mutasi"}
        </Button>
      </div>
    </form>
  );
}
