import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "@/contexts/SessionContext";

export const metadata: Metadata = {
  title: "Clinical Action Layer",
  description: "AI sidecar for Medplum EMR - Draft clinical orders powered by AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-[#F7F1EC] min-h-screen flex">
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
