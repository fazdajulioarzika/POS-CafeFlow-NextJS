"use client";

import { useActionState, useState } from "react";
import {
  addCashMovement,
  closeShift,
  openShift,
} from "@/app/(dashboard)/shifts/actions";
import { formatRupiah } from "@/lib/money";
import type { ActionState } from "@/types/action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function Messages({ state }: { state: ActionState }) {
  return (
    <>
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
    </>
  );
}

export function OpenShiftForm() {
  const [state, action, pending] = useActionState(openShift, {} as ActionState);
  return (
    <form action={action} className="grid max-w-sm gap-4">
      <div className="space-y-2">
        <Label htmlFor="opening_cash">Kas awal di laci (Rp)</Label>
        <Input
          id="opening_cash"
          name="opening_cash"
          type="number"
          min={0}
          step={1}
          defaultValue={0}
          required
        />
      </div>
      <Messages state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Membuka..." : "Buka shift"}
      </Button>
    </form>
  );
}

export function CashMovementForm() {
  const [state, action, pending] = useActionState(
    addCashMovement,
    {} as ActionState
  );
  return (
    <form action={action} className="grid max-w-xl gap-4 sm:grid-cols-3">
      <div className="space-y-2">
        <Label htmlFor="cm_type">Jenis</Label>
        <select
          id="cm_type"
          name="type"
          defaultValue="out"
          className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
        >
          <option value="out">Kas keluar</option>
          <option value="in">Kas masuk</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="cm_amount">Jumlah (Rp)</Label>
        <Input
          id="cm_amount"
          name="amount"
          type="number"
          min={1}
          step={1}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cm_reason">Alasan</Label>
        <Input
          id="cm_reason"
          name="reason"
          required
          maxLength={200}
          placeholder="Beli es batu"
        />
      </div>
      <div className="space-y-2 sm:col-span-3">
        <Messages state={state} />
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "..." : "Catat kas"}
        </Button>
      </div>
    </form>
  );
}

export function CloseShiftForm({ expected }: { expected: number }) {
  const [state, action, pending] = useActionState(
    closeShift,
    {} as ActionState
  );
  const [counted, setCounted] = useState("");
  const diff = counted === "" ? null : Number(counted) - expected;

  return (
    <form action={action} className="grid max-w-md gap-4">
      <div className="space-y-2">
        <Label htmlFor="closing_cash">Kas aktual hasil hitung (Rp)</Label>
        <Input
          id="closing_cash"
          name="closing_cash"
          type="number"
          min={0}
          step={1}
          required
          value={counted}
          onChange={(e) => setCounted(e.target.value)}
        />
      </div>

      {diff !== null && (
        <p
          role="status"
          className={`rounded-lg border p-3 text-sm font-medium ${
            diff === 0 ? "bg-emerald-50" : "bg-amber-50"
          }`}
        >
          {diff === 0
            ? "Kas sesuai, tidak ada selisih."
            : `Selisih ${diff > 0 ? "lebih" : "kurang"} ${formatRupiah(
                Math.abs(diff)
              )}. Catatan wajib diisi.`}
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="close_note">
          Catatan{diff ? " (wajib)" : " (opsional)"}
        </Label>
        <Input id="close_note" name="note" maxLength={300} required={!!diff} />
      </div>

      <p className="text-xs text-muted-foreground">
        Shift yang sudah ditutup tidak dapat diubah.
      </p>
      <Messages state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Menutup..." : "Tutup shift"}
      </Button>
    </form>
  );
}
