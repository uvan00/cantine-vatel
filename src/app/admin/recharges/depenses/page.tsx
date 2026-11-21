import type { Metadata } from "next";
import { EnTetePage } from "@/components/fenetre";
import { SChiffresBande } from "@/components/sneat";
import { depensesDe } from "@/lib/comptabilite";
import { donneesCompta } from "@/lib/donnees-compta";
import { fcfa, pluriel } from "@/lib/format";
import { maintenant } from "@/lib/horloge";
import { jourIso } from "@/lib/jours";
import { exiger } from "@/lib/session";
import { BarrePeriode } from "../barre-periode";
import { ListeMontants } from "../lignes";
import { lirePeriode } from "../periode";
import { DepensesClient } from "./depenses-client";

export const metadata: Metadata = { title: "Dépenses" };

export default async function PageDepenses({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await exiger("admin");
  const aujourdhui = jourIso(maintenant());
  const p = lirePeriode(await searchParams, aujourdhui);
  const { depenses } = await donneesCompta(p);
  const d = depensesDe(depenses, p);
  return (
    <div className="w-full space-y-6">
      <EnTetePage titre="Dépenses" sousTitre="Ce que la cantine paie : ingrédients, gaz, emballages, salaires. Chaque dépense notée ici entre dans le bilan" />
      <BarrePeriode base="/admin/recharges/depenses" periode={p} aujourdhui={aujourdhui} vue="depenses" />
      <SChiffresBande items={[
        { titre: "Dépensé", valeur: fcfa(d.total), detail: pluriel(d.nombre, "dépense notée", "dépenses notées") },
        ...d.parCategorie.slice(0, 3).map((c) => ({ titre: c.libelle, valeur: fcfa(c.montant), detail: pluriel(c.nombre, "dépense") })),
      ]} />
      {d.parCategorie.length > 0 && (
        <ListeMontants titre="Par catégorie" vide="" lignes={d.parCategorie.map((c) => ({ cle: c.id, libelle: c.libelle, detail: pluriel(c.nombre, "dépense"), montant: c.montant }))} />
      )}
      <DepensesClient depenses={depenses} aujourdhui={aujourdhui} />
    </div>
  );
}
