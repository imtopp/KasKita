import type { Metadata, Viewport } from "next";
import { Baloo_2 } from "next/font/google";

import { ServiceWorkerRegister } from "@/components/service-worker-register";
import "./globals.css";

const baloo = Baloo_2({
  variable: "--font-kawaii",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "KasKita",
    template: "%s · KasKita",
  },
  description: "Kelola kas organisasi dengan mudah.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#f6a6c4",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${baloo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
