import type { Metadata } from "next";
import { Inter, Poppins, Libre_Franklin, Roboto, PT_Serif, Playfair_Display, Dancing_Script } from "next/font/google";
import "./globals.css";
import { siteUrl } from "@/lib/site-url";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

// Fontes dos modelos de advertorial/notícia (para bater com os jornais reais).
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "600", "700", "800"], variable: "--font-poppins" });
const franklin = Libre_Franklin({ subsets: ["latin"], weight: ["400", "600", "700", "800", "900"], variable: "--font-franklin" });
const roboto = Roboto({ subsets: ["latin"], weight: ["400", "500", "700", "900"], variable: "--font-roboto" });
const ptSerif = PT_Serif({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-ptserif" });
// Fontes elegantes dos templates de Link na Bio.
const playfair = Playfair_Display({ subsets: ["latin"], weight: ["400", "500", "600", "700"], style: ["normal", "italic"], variable: "--font-playfair" });
const dancing = Dancing_Script({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-script" });

const fontVars = `${inter.variable} ${poppins.variable} ${franklin.variable} ${roboto.variable} ${ptSerif.variable} ${playfair.variable} ${dancing.variable}`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: "Cliva — Funis de pré-atendimento para clínicas",
  description:
    "Transforme leads frios de anúncios em contatos qualificados antes do WhatsApp.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${fontVars} font-sans`}>{children}</body>
    </html>
  );
}
