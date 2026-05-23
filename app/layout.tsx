import type { Metadata } from "next";
import "./globals.css";
import CookieBanner from './_components/CookieBanner';

export const metadata: Metadata = {
  title: "Docs2Video — Turn Any Document Into a Professional Explainer Video",
  description: "Upload a PDF, paste text, or describe an idea. Get a branded narrated video with a shareable client page — in minutes, not hours.",
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full flex flex-col">{children}<CookieBanner /></body>
    </html>
  );
}
