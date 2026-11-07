import type { Metadata } from "next";
import { Toaster } from "sonner";
import "@/app/globals.css";
import { AppShell } from "@/components/AppShell";

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
      <body>
        <AppShell>{children}</AppShell>
        <Toaster position="top-center" richColors dir="rtl" />
      </body>
    </html>
  );
}
