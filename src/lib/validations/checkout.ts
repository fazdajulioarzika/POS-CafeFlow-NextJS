import { z } from "zod";

export const checkoutSchema = z
  .object({
    idempotency_key: z.string().uuid(),
    order_type: z.enum(["dine_in", "takeaway"]),
    table_id: z.string().uuid().nullable(),
    items: z
      .array(
        z.object({
          product_id: z.string().uuid(),
          variant_id: z.string().uuid().nullable(),
          quantity: z.number().int("Jumlah harus bulat").min(1).max(99),
          notes: z
            .string()
            .trim()
            .max(200, "Catatan maksimal 200 karakter")
            .nullable(),
        })
      )
      .min(1, "Keranjang kosong")
      .max(50, "Maksimal 50 baris item"),
    discount_type: z.enum(["none", "amount", "percent"]),
    discount_value: z
      .number()
      .int("Diskon harus bilangan bulat")
      .min(0)
      .max(100_000_000),
    payment_method: z.enum(["cash", "qris", "bank_transfer", "other"]),
    tendered: z
      .number()
      .int("Uang diterima harus bilangan bulat")
      .min(0)
      .max(1_000_000_000)
      .nullable(),
    reference: z
      .string()
      .trim()
      .max(100, "Referensi maksimal 100 karakter")
      .nullable(),
  })
  .refine((v) => v.order_type !== "dine_in" || !!v.table_id, {
    message: "Pilih meja untuk dine-in",
    path: ["table_id"],
  });

export type CheckoutInput = z.infer<typeof checkoutSchema>;
