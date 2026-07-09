import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { UserProvider } from "@/context/UserContext";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "StokLedger - Sistem Rekonsiliasi & Buku Besar Stok Gudang Skincare",
  description: "Sistem pencatatan dan rekonsiliasi stok append-only untuk brand skincare Indonesia. Menelusuri kebocoran stok dari pesanan batal, retur rusak, hingga sampel promo secara presisi.",
  keywords: "stokledger, rekonsiliasi stok, buku besar stok, stock ledger, inventory management, skincare indonesia, fefo",
  robots: "index, follow",
  manifest: "/manifest.json",
  openGraph: {
    title: "StokLedger - Sistem Buku Besar Stok Gudang",
    description: "Sumber kebenaran tunggal untuk pergerakan stok skincare Anda. Transparan, akurat, dan append-only.",
    type: "website",
    locale: "id_ID",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Rich schema for SEO/AEO/GEO
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "StokLedger",
    "operatingSystem": "Web",
    "applicationCategory": "BusinessApplication",
    "description": "Sistem Buku Besar & Rekonsiliasi Stok Append-Only untuk Industri Skincare.",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "IDR"
    }
  };

  return (
    <html lang="id" className={`${inter.variable} ${spaceGrotesk.variable} ${ibmPlexMono.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(function(registrations) {
                  for (var i = 0; i < registrations.length; i++) {
                    registrations[i].unregister().then(function(success) {
                      if (success) {
                        console.log('Unregistered stale service worker');
                        window.location.reload();
                      }
                    });
                  }
                });
              }
            `
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="antialiased min-h-screen text-ink font-body bg-bg">
        <UserProvider>{children}</UserProvider>
      </body>
    </html>
  );
}
