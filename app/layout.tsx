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
    // Absolute base for every relative metadata URL (OG images, canonicals).
    // Without it, link previews had relative image paths that crawlers drop.
    metadataBase: new URL(`https://${brand.domain}`),
    // No title template on purpose: existing pages already carry
    // "… | Docs2Video" in their own titles, and a template would double it.
    title: brand.title,
    description: brand.description,
    openGraph: {
      type: 'website',
      siteName: brand.name,
      title: brand.title,
      description: brand.description,
      images: [{ url: brand.ogImage, width: 1200, height: 630, alt: brand.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: brand.title,
      description: brand.description,
      images: [brand.ogImage],
    },
    icons: {
      icon: brand.iconSrc,
      apple: brand.iconSrc,
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
    // WHICH STOREFRONT, stamped on the root so CSS can recolour the whole site
    // per brand. The two share one stylesheet, so without this a change to
    // Text2Art's palette would silently repaint Docs2Video as well.
    <html lang="en" className="h-full antialiased" data-brand={brand.id}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full flex flex-col"><BrandProvider brand={brand}><ToastProvider>{children}<CookieBanner /></ToastProvider></BrandProvider></body>
    </html>
  );
}
