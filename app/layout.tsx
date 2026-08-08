import type { Metadata, Viewport } from "next";
import { Baloo_2 } from "next/font/google";
import Script from "next/script";

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
    <html
      lang="id"
      suppressHydrationWarning
      className={`${baloo.variable} h-full antialiased`}
    >
      <Script id="theme-init" strategy="beforeInteractive">
        {`(function(){try{var t=localStorage.getItem("kaskita-theme");var a=["klasik","kawaii","ocean","forest","sunrise"];if(a.indexOf(t)<0){t="klasik";}document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme="klasik";}})();`}
      </Script>
      <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
