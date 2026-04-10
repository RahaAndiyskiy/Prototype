import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Forward Motion Hero",
  description: "Cinematic forward-motion hero scene with GSAP and canvas rain.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}