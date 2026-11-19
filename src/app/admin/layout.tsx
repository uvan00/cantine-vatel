import type { Metadata } from "next";
import { CoqueAdmin } from "@/components/coque-admin";
import { MARQUE } from "@/lib/marque";
import { exiger } from "@/lib/session";

// Le tableau de bord de la cantine : réservé à l'administrateur. Chaque page et chaque action le revérifie.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: { default: "Tableau de bord", template: `%s | ${MARQUE.nom}` } };

export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  await exiger("admin");
  return <CoqueAdmin>{children}</CoqueAdmin>;
}
