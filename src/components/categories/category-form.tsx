"use client";

import { useActionState } from "react";
import Link from "next/link";
import { saveCategory } from "@/app/(dashboard)/categories/actions";
import type { ActionState } from "@/types/action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Category = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
};

export function CategoryForm({ category }: { category?: Category | null }) {
  const [state, action, pending] = useActionState(
    saveCategory,
    {} as ActionState
  );

  return (
    <form action={action} className="grid max-w-md gap-4">
      {category && <input type="hidden" name="id" value={category.id} />}
      <div className="space-y-2">
        <Label htmlFor="name">Nama</Label>
        <Input
          id="name"
          name="name"
          defaultValue={category?.name}
          required
          maxLength={80}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Deskripsi (opsional)</Label>
        <Input
          id="description"
          name="description"
          defaultValue={category?.description ?? ""}
          maxLength={300}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="sort_order">Urutan tampil</Label>
        <Input
          id="sort_order"
          name="sort_order"
          type="number"
          min={0}
          defaultValue={category?.sort_order ?? 0}
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
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending
            ? "Menyimpan..."
            : category
            ? "Simpan perubahan"
            : "Tambah kategori"}
        </Button>
        {category && (
          <Link
            href="/categories"
            className="inline-flex h-9 items-center rounded-md border px-4 text-sm"
          >
            Batal
          </Link>
        )}
      </div>
    </form>
  );
}
