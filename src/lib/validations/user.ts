import { z } from "zod";

export const createUserSchema = z.object({
  full_name: z.string().trim().min(1, "Nama wajib diisi").max(100),
  email: z.string().trim().email("Email tidak valid").max(254),
  password: z.string().min(8, "Minimal 8 karakter").max(128),
  role: z.enum(["owner", "manager", "cashier", "kitchen"]),
});
