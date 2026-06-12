import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kartu Satu",
  description: "A real-time multiplayer card game for private rooms."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
