import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Maksimal ${max} karakter`)
    .optional()
    .transform((v) => (v ? v : null));

const intField = (label: string, min: number, max: number) =>
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
        .max(max, `${label} maksimal ${max}`)
    );

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi").max(80),
  description: optionalText(300),
  sort_order: intField("Urutan", 0, 9999),
});

export const productSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi").max(120),
  sku: optionalText(40),
  description: optionalText(500),
  category_id: z.string().uuid("Pilih kategori"),
  price: intField("Harga", 0, 100_000_000),
});

export const variantSchema = z.object({
  product_id: z.string().uuid(),
  name: z.string().trim().min(1, "Nama varian wajib diisi").max(60),
  price_delta: intField("Selisih harga", -100_000_000, 100_000_000),
});

export const tableSchema = z.object({
  table_number: z.string().trim().min(1, "Nomor meja wajib diisi").max(20),
  capacity: intField("Kapasitas", 1, 50),
  status: z.enum(["available", "occupied", "reserved", "maintenance"]),
});

export const settingsSchema = z.object({
  cafe_name: z.string().trim().min(1, "Nama kafe wajib diisi").max(80),
  address: optionalText(200),
  phone: optionalText(30),
  receipt_footer: optionalText(200),
  tax_percent: z
    .string()
    .trim()
    .min(1, "Pajak wajib diisi")
    .transform(Number)
    .pipe(z.number({ message: "Pajak tidak valid" }).min(0).max(100)),
});
