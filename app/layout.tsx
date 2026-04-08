import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "KnowledgeOS",
  description: "AI-native knowledge base",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html className="dark" lang="en">
      <body
        className={`${inter.className} bg-gray-950 text-gray-100 antialiased font-sans min-h-screen`}
      >
        {children}
      </body>
    </html>
  );
}
