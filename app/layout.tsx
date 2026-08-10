import type { Metadata } from "next";
import "./globals.css";
import CookieBanner from './_components/CookieBanner';
import { ToastProvider } from './_components/Toast';
import { BrandProvider } from './_components/BrandProvider';
import { getBrand } from './_lib/brand-server';

// The tab title and description depend on which storefront was asked for, so
// this has to be computed per request rather than declared as a constant. The
// Docs2Video values are unchanged — brandFromHost falls back to Docs2Video for
// every host that is not text2art.app.
export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrand();
  return {
    title: brand.title,
    description: brand.description,
    icons: {
      icon: '/favicon.png',
      apple: '/favicon.png',
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read the host ONCE, here, and hand it to every client component below via
  // context. Client components must never sniff the host themselves.
  const brand = await getBrand();

  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full flex flex-col"><BrandProvider brand={brand}><ToastProvider>{children}<CookieBanner /></ToastProvider></BrandProvider></body>
    </html>
  );
}
