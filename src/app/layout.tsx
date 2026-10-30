import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chateau Katriannah Pickleball Club",
  description: "Book a pickleball court at Chateau Katriannah online. Check live availability, reserve your slot and pay in minutes.",
  metadataBase: new URL(process.env.SITE_URL || "https://ckpicklecourt.com"),
  openGraph: {
    title: "Chateau Katriannah Pickleball Club",
    description: "Book a pickleball court online. Check live availability, reserve your slot and pay in minutes.",
    images: ["/brand/og.png"],
  },
  icons: { icon: "/brand/favicon.png", apple: "/brand/apple-touch-icon.png" },
};

export const viewport: Viewport = { themeColor: "#f7f3ea", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
