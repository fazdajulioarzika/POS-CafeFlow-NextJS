import { z } from "zod";

const rupiah = (label: string, min: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} wajib diisi`)
    .transform(Number)
    .pipe(
      z
        .number({ message: `${label} tidak valid` })
        .int(`${label} harus bilangan bulat`)
        .min(min, `${label} minimal ${min}`)
        .max(1_000_000_000, `${label} terlalu besar`)
    );

export const openShiftSchema = z.object({
  opening_cash: rupiah("Kas awal", 0),
});

export const cashMovementSchema = z.object({
  type: z.enum(["in", "out"]),
  amount: rupiah("Jumlah", 1),
  reason: z
    .string()
    .trim()
    .min(1, "Alasan wajib diisi")
    .max(200, "Alasan maksimal 200 karakter"),
});

export const closeShiftSchema = z.object({
  closing_cash: rupiah("Kas aktual", 0),
  note: z
    .string()
    .trim()
    .max(300, "Catatan maksimal 300 karakter")
    .optional()
    .transform((v) => v ?? ""),
});

export const refundSchema = z.object({
  order_id: z.string().uuid(),
  reason: z
    .string()
    .trim()
    .min(3, "Alasan minimal 3 karakter")
    .max(200, "Alasan maksimal 200 karakter"),
});
