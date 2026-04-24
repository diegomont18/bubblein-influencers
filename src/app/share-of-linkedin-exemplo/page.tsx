import type { Metadata } from "next";
import ShareOfLinkedInExemploPageClient from "./page-client";

const TITLE = "Exemplo de Relatório de Share of LinkedIn";
const DESCRIPTION =
  "Veja na prática um relatório real de Share of LinkedIn: ranking competitivo, RER, decisores engajados e recomendações estratégicas de conteúdo geradas por IA.";
const URL = "/share-of-linkedin-exemplo";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "exemplo share of linkedin",
    "relatório linkedin b2b",
    "relatório de inteligência competitiva",
    "RER linkedin",
    "share of voice b2b",
  ],
  alternates: { canonical: URL },
  openGraph: {
    type: "article",
    locale: "pt_BR",
    url: URL,
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: "/bubblein-logo.png", alt: "Exemplo de Relatório — BubbleIn" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/bubblein-logo.png"],
  },
  robots: { index: true, follow: true },
};

export default function Page() {
  return <ShareOfLinkedInExemploPageClient />;
}
