import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-4 py-8">
      <div className="fixed right-4 top-4 z-50">
        <ThemeToggle />
      </div>
      <div className="flex flex-col items-center gap-2">
        <BrandLogo size={72} />
        <p className="text-2xl font-extrabold tracking-tight">KasKita</p>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
