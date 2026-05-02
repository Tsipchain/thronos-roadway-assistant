import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Battery SOS + Thronos",
  description: "24/7 roadside battery and tire assistance dispatch platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="el">
      <body>{children}</body>
    </html>
  );
}
