import type { Metadata, Viewport } from "next";
import { MARQUE } from "@/lib/marque";
import { classesPolices } from "@/lib/polices";
import "./globals.css";

// Une seule mise en page racine, en clair : la cantine se vit sur un téléphone, souvent dans la file ou dehors.
export const metadata: Metadata = {
  title: { default: `${MARQUE.nom}, ${MARQUE.slogan.toLowerCase()}`, template: `%s | ${MARQUE.nom}` },
  description: "Réserve ton repas, montre ton ticket au comptoir, recharge ton compte en Mobile Money.",
  robots: { index: false, follow: false },
  // Posée sur l'écran d'accueil d'un iPhone : le nom sous l'icône, et l'ouverture sans la barre de Safari.
  appleWebApp: { capable: true, title: MARQUE.court, statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#FFFFFF" };

export default function LayoutRacine({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${classesPolices} h-full antialiased`}>
      <body className="sneat min-h-full">{children}</body>
    </html>
  );
}
