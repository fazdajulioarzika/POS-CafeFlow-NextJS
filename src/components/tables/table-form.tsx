"use client";

import { useActionState } from "react";
import Link from "next/link";
import { saveTable } from "@/app/(dashboard)/tables/actions";
import type { ActionState } from "@/types/action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Table = {
  id: string;
  table_number: string;
  capacity: number;
  status: string;
};

export const statusLabel: Record<string, string> = {
  available: "Tersedia",
  occupied: "Terisi",
  reserved: "Dipesan",
  maintenance: "Perbaikan",
};

export function TableForm({ table }: { table?: Table | null }) {
  const [state, action, pending] = useActionState(saveTable, {} as ActionState);

  return (
    <form action={action} className="grid max-w-md gap-4">
      {table && <input type="hidden" name="id" value={table.id} />}
      <div className="space-y-2">
        <Label htmlFor="table_number">Nomor / nama meja</Label>
        <Input
          id="table_number"
          name="table_number"
          defaultValue={table?.table_number}
          required
          maxLength={20}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="capacity">Kapasitas</Label>
        <Input
          id="capacity"
          name="capacity"
          type="number"
          min={1}
          max={50}
          defaultValue={table?.capacity ?? 2}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <select
          id="status"
          name="status"
          defaultValue={table?.status ?? "available"}
          className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
        >
          {Object.entries(statusLabel).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
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
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending
            ? "Menyimpan..."
            : table
            ? "Simpan perubahan"
            : "Tambah meja"}
        </Button>
        {table && (
          <Link
            href="/tables"
            className="inline-flex h-9 items-center rounded-md border px-4 text-sm"
          >
            Batal
          </Link>
        )}
      </div>
    </form>
  );
}
