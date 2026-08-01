import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Providers from "@/components/Providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Finio",
  description: "Your money, made clear.",
  icons: {
    icon: [
      { url: "/finio-logo.svg", type: "image/svg+xml" },
      { url: "/finio-logo.png", type: "image/png" },
    ],
    apple: [{ url: "/finio-logo.png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
