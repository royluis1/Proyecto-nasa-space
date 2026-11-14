import type { Metadata, Viewport } from "next";
import "./globals.css";
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
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f8f6f1" }, { media: "(prefers-color-scheme: dark)", color: "#0e1712" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" suppressHydrationWarning>
      <body className="min-h-screen font-sans">
        <ThemeProvider>
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
        </ThemeProvider>
      </body>
    </html>
  );
}
