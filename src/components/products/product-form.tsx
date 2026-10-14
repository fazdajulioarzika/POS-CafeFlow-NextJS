"use client";

import { useActionState } from "react";
import Link from "next/link";
import { saveProduct } from "@/app/(dashboard)/products/actions";
import type { ActionState } from "@/types/action";
import { productImageUrl } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Product = {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  category_id: string;
  price: number;
  image_path: string | null;
  is_active: boolean;
  is_available: boolean;
};
type Category = { id: string; name: string; is_active: boolean };

const field = "w-full rounded-md border border-input bg-card px-3 py-2 text-sm";

export function ProductForm({
  product,
  categories,
}: {
  product?: Product | null;
  categories: Category[];
}) {
  const [state, action, pending] = useActionState(
    saveProduct,
    {} as ActionState
  );
  const v = state.values;
  const imageUrl = productImageUrl(product?.image_path);

  return (
    <form action={action} className="grid max-w-xl gap-4">
      {product && <input type="hidden" name="id" value={product.id} />}

      <div className="space-y-2">
        <Label htmlFor="name">Nama produk</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={120}
          defaultValue={v?.name ?? product?.name}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="sku">SKU (opsional)</Label>
          <Input
            id="sku"
            name="sku"
            maxLength={40}
            defaultValue={v?.sku ?? product?.sku ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="price">Harga (Rp)</Label>
          <Input
            id="price"
            name="price"
            type="number"
            min={0}
            step={1}
            required
            defaultValue={v?.price ?? product?.price ?? ""}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="category_id">Kategori</Label>
        <select
          id="category_id"
          name="category_id"
          required
          className={field}
          defaultValue={v?.category_id ?? product?.category_id ?? ""}
        >
          <option value="" disabled>
            Pilih kategori
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.is_active ? "" : " (nonaktif)"}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Deskripsi (opsional)</Label>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={500}
          className={field}
          defaultValue={v?.description ?? product?.description ?? ""}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="image">Foto (JPG/PNG/WebP, maks 2 MB)</Label>
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={`Foto ${product?.name}`}
            className="h-24 w-24 rounded-lg object-cover"
          />
        )}
        <input
          id="image"
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="block w-full text-sm"
        />
        {imageUrl && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="remove_image" /> Hapus foto saat ini
          </label>
        )}
      </div>

      <div className="flex flex-wrap gap-6 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={product?.is_active ?? true}
          />{" "}
          Aktif
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="is_available"
            defaultChecked={product?.is_available ?? true}
          />{" "}
          Tersedia
        </label>
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
            : product
            ? "Simpan perubahan"
            : "Buat produk"}
        </Button>
        <Link
          href="/products"
          className="inline-flex h-9 items-center rounded-md border px-4 text-sm"
        >
          Kembali
        </Link>
      </div>
    </form>
  );
}
