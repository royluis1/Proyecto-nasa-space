import type { Metadata, Viewport } from "next";
import { Manrope, Sora } from "next/font/google";
import "./globals.css";

// Tipografías del diseño. Next las descarga en el build y las sirve desde el mismo dominio.
const sans = Manrope({ subsets: ["latin"], display: "swap", variable: "--font-sans" });
const display = Sora({ subsets: ["latin"], display: "swap", weight: ["600", "700"], variable: "--font-display" });
import { AuthProvider } from "@/components/auth/auth-provider";
import { BackendBanner } from "@/components/layout/backend-banner";
import { DisclaimerBar } from "@/components/layout/disclaimer-bar";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ThemeProvider } from "@/components/layout/theme-provider";

export const metadata: Metadata = {
  title: { default: "FieldShift: qué sembrar con datos de la NASA", template: "%s · FieldShift" },
  description: "Compará rotaciones de cultivos para tu campo en San Luis con datos de la NASA, tu suelo y tus prioridades.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#fbfbf8" }, { media: "(prefers-color-scheme: dark)", color: "#0f1a14" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" suppressHydrationWarning className={`${sans.variable} ${display.variable}`}>
      <body className="min-h-screen font-sans">
        <ThemeProvider>
          <AuthProvider>
            <a href="#contenido" className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
              Saltar al contenido
            </a>
            <SiteHeader />
            <DisclaimerBar />
            <BackendBanner />
            <main id="contenido" className="container py-6">
              {children}
            </main>
            <SiteFooter />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
