import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "react-hot-toast";
import Navbar from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "GatiCharge — India's EV Charging Intelligence Platform",
  description:
    "Find, book, and optimize EV charging across India. Physics-based range prediction, real-time station availability, and AI-powered route optimization.",
  keywords: ["EV charging", "electric vehicle", "India", "charging station", "route optimization"],
  authors: [{ name: "GatiCharge" }],
  viewport: "width=device-width, initial-scale=1",
  openGraph: {
    title: "GatiCharge — India's EV Charging Intelligence",
    description: "Smart EV charging for India. Find stations, predict range, optimize routes.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>
          <Navbar />
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "#1a1a2e",
                color: "#e2e8f0",
                border: "1px solid #16213e",
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}

