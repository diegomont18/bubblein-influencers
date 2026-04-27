import type { Metadata } from "next";
import ShareOfLinkedInPageClient from "./page-client";

const TITLE = "Share of LinkedIn — Inteligência Competitiva no LinkedIn B2B";
const DESCRIPTION =
  "Descubra o que seus concorrentes publicam, quais temas engajam decisores B2B e onde estão as lacunas de conteúdo do seu nicho. Diagnóstico semanal automatizado por IA.";
const URL = "/share-of-linkedin";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "share of linkedin",
    "share of voice linkedin",
    "inteligência competitiva linkedin",
    "monitorar concorrentes linkedin",
    "análise de concorrentes b2b",
    "linkedin b2b",
  ],
  alternates: { canonical: URL },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: URL,
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: "/bubblein-blackbg-logo-influencers-b2b.png", alt: "Share of LinkedIn — BubbleIn" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/bubblein-blackbg-logo-influencers-b2b.png"],
  },
  robots: { index: true, follow: true },
};

export default function Page() {
  return <ShareOfLinkedInPageClient />;
}
