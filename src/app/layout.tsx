import type { Metadata } from "next";
import type React from "react";
import { Literata, Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-manrope",
});

const literata = Literata({
  subsets: ["latin", "cyrillic"],
  variable: "--font-literata",
});

export const metadata: Metadata = {
  title: "Smena — Discovery call",
  description:
    "Describe the task, answer two or three questions, and book a discovery call for €150.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${literata.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
