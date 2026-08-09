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

export const transactionSchema = z.object({
  type: z.enum(["income", "expense"]),
  category_id: z.string().min(1, "Pilih kategori"),
  amount: z
    .string()
    .min(1, "Nominal wajib diisi")
    .regex(/^\d{1,10}(\.\d{1,2})?$/, "Nominal tidak valid"),
  transaction_date: z.string().min(1, "Tanggal wajib diisi"),
  description: z
    .string()
    .trim()
    .max(200, "Deskripsi maksimal 200 karakter"),
});

export type LoginForm = z.infer<typeof loginSchema>;
export type RegisterForm = z.infer<typeof registerSchema>;
export type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;
export type UpdatePasswordForm = z.infer<typeof updatePasswordSchema>;
export type CreateOrganizationForm = z.infer<typeof createOrganizationSchema>;
export type TransactionForm = z.infer<typeof transactionSchema>;

export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama kategori wajib diisi")
    .max(40, "Nama kategori maksimal 40 karakter"),
  type: z.enum(["income", "expense"]),
});

export type CategoryForm = z.infer<typeof categorySchema>;

export type CategoryOption = {
  id: string;
  name: string;
  type: "income" | "expense";
};

export type CategoryRow = {
  id: string;
  organization_id: string;
  name: string;
  type: "income" | "expense";
  is_deleted: boolean;
  created_at: string;
};

export type TransactionRow = {
  id: string;
  organization_id: string;
  category_id: string | null;
  type: "income" | "expense";
  amount: number;
  description: string | null;
  transaction_date: string;
  created_by: string;
  categories: { name: string } | null;
};

export type MonthTotals = {
  income: number;
  expense: number;
  net: number;
  openingBalance: number;
  closingBalance: number;
};

export type CategoryBreakdown = {
  name: string;
  type: "income" | "expense";
  total: number;
};

export const inviteMemberSchema = z.object({
  email: z.string().trim().email("Format email tidak valid"),
  role: z.enum(["treasurer", "viewer"]),
});

export const createMemberSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama wajib diisi")
    .max(60, "Nama maksimal 60 karakter"),
  email: z.string().trim().email("Format email tidak valid"),
  password: z
    .string()
    .min(8, "Password minimal 8 karakter")
    .max(72, "Password maksimal 72 karakter"),
  role: z.enum(["treasurer", "viewer"]),
});

export const addExistingMemberSchema = z.object({
  email: z.string().trim().email("Format email tidak valid"),
  role: z.enum(["treasurer", "viewer"]),
});

export type InviteMemberForm = z.infer<typeof inviteMemberSchema>;
export type CreateMemberForm = z.infer<typeof createMemberSchema>;
export type AddExistingMemberForm = z.infer<typeof addExistingMemberSchema>;

export type MemberRow = {
  id: string;
  user_id: string;
  role: "owner" | "treasurer" | "viewer";
  email: string;
  name: string | null;
  source: "email" | "manual";
};
