import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/features/auth/context/auth-context";
import { AuthGuard } from "@/features/auth/components/AuthGuard";
import { WorkOrderProvider } from "@/lib/work-order-context";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Indus Plus Ltd Dashboard",
  description: "Indus Plus Ltd apparel industrial engineering system.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#f8fafc]">
        <AuthProvider>
          <WorkOrderProvider>
            <AuthGuard>{children}</AuthGuard>
          </WorkOrderProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
