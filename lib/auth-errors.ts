import { type AuthError } from "@supabase/supabase-js";

export function getAuthErrorMessage(error: AuthError | null): string {
  if (!error) return "";
  switch (error.message) {
    case "Invalid login credentials":
      return "Email atau password salah.";
    case "Email not confirmed":
      return "Email belum dikonfirmasi. Cek inbox kamu.";
    case "User already registered":
      return "Email sudah terdaftar. Silakan masuk.";
    case "Password should be at least 8 characters.":
      return "Password minimal 8 karakter.";
    case "For security purposes, you can only request this once every 60 seconds.":
      return "Terlalu cepat. Coba lagi dalam 60 detik.";
    case "Signup requires a valid password":
      return "Password wajib diisi.";
    default:
      return error.message;
  }
}
