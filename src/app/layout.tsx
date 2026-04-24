import type { Metadata } from "next";
import localFont from "next/font/local";
import { Lexend, Be_Vietnam_Pro } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});
const lexend = Lexend({
  subsets: ["latin"],
  variable: "--font-lexend",
});
const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-be-vietnam-pro",
});

const SITE_TITLE = "BubbleIn | Inteligência Competitiva e Casting de Creators no LinkedIn B2B";
const SITE_NAME_SHORT = "BubbleIn — Plataforma B2B para LinkedIn";
const SITE_DESCRIPTION =
  "Mapeie o cenário competitivo do seu nicho no LinkedIn e amplifique sua marca com os creators B2B certos. Inteligência + casting numa única plataforma.";

// TODO: substituir /bubblein-logo.png por OG image dedicada 1200×630 quando disponível
const OG_IMAGE = "/bubblein-logo.png";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://bubblein.com.br"),
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME_SHORT}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "share of voice linkedin",
    "share of linkedin",
    "inteligência competitiva linkedin",
    "casting de influenciadores b2b",
    "creators b2b linkedin",
    "marketing b2b linkedin",
    "linkedin b2b",
    "influência b2b",
    "thought leadership linkedin",
    "marketing de influência b2b",
  ],
  icons: {
    icon: "/favicon.ico",
  },
  manifest: "/manifest.json",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: SITE_NAME_SHORT,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [{ url: OG_IMAGE, alt: "BubbleIn — Plataforma B2B para LinkedIn" }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "/",
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="scroll-smooth">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${lexend.variable} ${beVietnamPro.variable} antialiased`}
      >
        {children}
        <Script id="microsoft-clarity" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window, document, "clarity", "script", "wa18uxhnpd");`}
        </Script>
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-XJ9GYD31ZF" strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">
          {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-XJ9GYD31ZF');`}
        </Script>
      </body>
    </html>
  );
}
