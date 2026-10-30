import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AutoEvolve Protocol",
  description: "ZK-attested self-improving agent memory",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
