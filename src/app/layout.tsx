import type { Metadata, Viewport } from "next";
import { Outfit, Plus_Jakarta_Sans } from "next/font/google";
import { themeBootScript, ThemeProvider } from "@/components/Theme";
import { ToastProvider } from "@/components/Toasts";
import "./globals.css";

const sans = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-sans" });
const display = Outfit({ subsets: ["latin"], weight: ["500", "700", "800"], variable: "--font-display" });

export const metadata: Metadata = {
  title: "ALIXO BPO · CRM",
  description: "ALIXO BPO call center CRM — lead submission, dupe checks, campaigns, callbacks and progress.",
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%236366f1'/%3E%3Cstop offset='1' stop-color='%2322d3ee'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath d='M46,7.3a8,8 0 0 1 8,0l31,17.9a8,8 0 0 1 4,6.9v35.8a8,8 0 0 1-4,6.9l-31,17.9a8,8 0 0 1-8,0l-31-17.9a8,8 0 0 1-4-6.9V32.1a8,8 0 0 1 4-6.9z' fill='url(%23g)'/%3E%3Cg fill='none' stroke='white' stroke-width='7.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M29,70 L48,30M36.5,56 L48,56M50,29 V71M50,30 H60 a10,10 0 0 1 0,20 H50 M50,50 H63 a10,10 0 0 1 0,20 H50'/%3E%3C/g%3E%3C/svg%3E",
  },
};

export const viewport: Viewport = { themeColor: "#6366f1" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-mode="light" className={`${sans.variable} ${display.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
