import { z } from "zod";
import { UNITS } from "@/lib/units";

const decimal = (label: string, allowZero: boolean) =>
  z
    .string()
    .trim()
    .min(1, `${label} wajib diisi`)
    .transform((v) => Number(v.replace(",", ".")))
    .pipe(
      z
        .number({ message: `${label} tidak valid` })
        .max(10_000_000, `${label} terlalu besar`)
        .transform((n) => Math.round(n * 1000) / 1000)
        .refine(
          (n) => (allowZero ? n >= 0 : n > 0),
          allowZero
            ? `${label} tidak boleh negatif`
            : `${label} harus lebih dari 0`
        )
    );

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Maksimal ${max} karakter`)
    .optional()
    .transform((v) => (v ? v : null));

export const ingredientCreateSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi").max(80),
  unit: z.enum(UNITS),
  minimum_stock: decimal("Stok minimum", true),
  initial_stock: decimal("Stok awal", true),
});

export const ingredientEditSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Nama wajib diisi").max(80),
  minimum_stock: decimal("Stok minimum", true),
});

export const movementSchema = z.object({
  ingredient_id: z.string().uuid(),
  type: z.enum(["purchase", "waste", "adjustment"]),
  quantity: decimal("Jumlah", true),
  input_unit: z.string().trim().min(1).max(5),
  reason: optionalText(200),
});

export const recipeLineSchema = z.object({
  product_id: z.string().uuid(),
  ingredient_id: z.string().uuid("Pilih bahan"),
  quantity_required: decimal("Kebutuhan per porsi", false),
});
