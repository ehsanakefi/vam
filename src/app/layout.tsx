// src/app/layout.tsx
import type { Metadata } from "next";
import { Toaster } from "sonner";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "راهکار وام | پرتال رفاه کارکنان",
  description: "سامانه مدیریت صف و تخصیص تسهیلات رفاهی کارکنان",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl">
      <body className="min-h-screen bg-background antialiased">
        {children}
        <Toaster position="top-center" richColors dir="rtl" />
      </body>
    </html>
  );
}
