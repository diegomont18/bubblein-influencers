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

const SITE_NAME = "BubbleIn - Creators B2B no LinkedIn";
const SITE_DESCRIPTION =
  "Conectamos sua marca a creators B2B relevantes no LinkedIn. Ganhe visibilidade, gere demanda e construa confiança.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://bubblein.com.br"),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  icons: {
    icon: "/favicon.ico",
  },
  manifest: "/manifest.json",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
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
