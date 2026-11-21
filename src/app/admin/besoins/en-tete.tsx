"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { EnTetePage } from "@/components/fenetre";
import { STabs } from "@/components/sneat";

// L'en-tête des besoins de la cuisine, commun à ses quatre vues : le jour (sortir et préparer), la réserve (le stock),
// les achats (le bon de commande) et les coûts (le coût d'un repas).

export type VueBesoinsId = "jour" | "reserve" | "achats" | "couts";

const VUES: { id: VueBesoinsId; label: string }[] = [
  { id: "jour", label: "Le jour" },
  { id: "reserve", label: "La réserve" },
  { id: "achats", label: "Les achats" },
  { id: "couts", label: "Les coûts" },
];

export const ADRESSE_VUE: Record<VueBesoinsId, string> = {
  jour: "/admin/besoins",
  reserve: "/admin/besoins?vue=reserve",
  achats: "/admin/besoins?vue=achats",
  couts: "/admin/besoins?vue=couts",
};

export function EnTeteBesoins({ vue, sousTitre, actions }: { vue: VueBesoinsId; sousTitre: React.ReactNode; actions?: React.ReactNode }) {
  const router = useRouter();
  const [enRoute, demarrer] = useTransition();
  return (
    <>
      <EnTetePage titre="Besoins de la cuisine" sousTitre={sousTitre} actions={actions} />
      <div className={`transition-opacity print:hidden ${enRoute ? "opacity-60" : ""}`} aria-busy={enRoute}>
        <STabs variant="souligne" value={vue} onChange={(v) => demarrer(() => router.push(ADRESSE_VUE[v], { scroll: false }))} tabs={VUES} />
      </div>
    </>
  );
}
