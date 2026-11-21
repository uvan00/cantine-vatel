import type { Metadata } from "next";
import { lireReglages } from "@/lib/donnees";
import { equipe } from "@/lib/donnees-cantine";
import { exiger } from "@/lib/session";
import { EquipeClient } from "./equipe-client";
import { ReglagesClient } from "./reglages-client";

export const metadata: Metadata = { title: "Réglages" };

// Les réglages de la cantine, à l'admin seul : la clôture des réservations, les heures de passage, et l'équipe.
export default async function PageReglages() {
  const m = await exiger("admin");
  const [reglages, membres] = await Promise.all([lireReglages(), equipe()]);
  return (
    <div className="space-y-12">
      <ReglagesClient initial={reglages} />
      <EquipeClient membres={membres} moiId={m.id} />
    </div>
  );
}
