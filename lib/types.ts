import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Format email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});

export const registerSchema = z
  .object({
    email: z.string().trim().email("Format email tidak valid"),
    password: z.string().min(8, "Password minimal 8 karakter"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Konfirmasi password tidak cocok",
    path: ["confirmPassword"],
  });

export const resetPasswordSchema = z.object({
  email: z.string().trim().email("Format email tidak valid"),
});

export const updatePasswordSchema = z
  .object({
    password: z.string().min(8, "Password minimal 8 karakter"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Konfirmasi password tidak cocok",
    path: ["confirmPassword"],
  });

export const createOrganizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama organisasi minimal 2 karakter")
    .max(60, "Nama organisasi maksimal 60 karakter"),
  slug: z
    .string()
    .trim()
    .min(2, "Slug minimal 2 karakter")
    .max(63, "Slug maksimal 63 karakter")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug hanya huruf kecil, angka, dan tanda strip",
    ),
});

export type LoginForm = z.infer<typeof loginSchema>;
export type RegisterForm = z.infer<typeof registerSchema>;
export type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;
export type UpdatePasswordForm = z.infer<typeof updatePasswordSchema>;
export type CreateOrganizationForm = z.infer<typeof createOrganizationSchema>;
