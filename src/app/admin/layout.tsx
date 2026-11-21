import type { Metadata } from "next";
import { CoqueAdmin } from "@/components/coque-admin";
import { MARQUE } from "@/lib/marque";
import { CANTINE, exiger } from "@/lib/session";

// Le tableau de bord de la cantine : à l'admin et au responsable de cantine, chacun avec ses rubriques
// (src/lib/roles.ts). Chaque page et chaque action revérifie le rôle.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: { default: "Tableau de bord", template: `%s | ${MARQUE.nom}` } };

export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  const m = await exiger(...CANTINE);
  return <CoqueAdmin role={m.role}>{children}</CoqueAdmin>;
}
