import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Email tidak valid").max(254),
  password: z.string().min(6, "Minimal 6 karakter").max(128),
});

export const forgotSchema = z.object({
  email: z.string().trim().email("Email tidak valid").max(254),
});

export const resetSchema = z
  .object({
    password: z.string().min(8, "Minimal 8 karakter").max(128),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Konfirmasi tidak sama",
    path: ["confirm"],
  });
