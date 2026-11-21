import type { Metadata } from "next";
import { EnTetePage } from "@/components/fenetre";
import { SChiffresBande } from "@/components/sneat";
import { ventes } from "@/lib/comptabilite";
import { donneesCompta } from "@/lib/donnees-compta";
import { fcfa, nombre, pluriel } from "@/lib/format";
import { maintenant } from "@/lib/horloge";
import { jourIso, jourLong } from "@/lib/jours";
import { exiger } from "@/lib/session";
import { BarrePeriode } from "../barre-periode";
import { Aide, ListeMontants } from "../lignes";
import { lirePeriode } from "../periode";

export const metadata: Metadata = { title: "Ventes" };

export default async function PageVentes({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await exiger("admin");
  const aujourdhui = jourIso(maintenant());
  const p = lirePeriode(await searchParams, aujourdhui);
  const v = ventes((await donneesCompta(p)).repas, p, aujourdhui);
  const jours = p.type === "mois" ? v.parJour.filter((j) => j.montant > 0) : v.parJour;
  return (
    <div className="w-full space-y-6">
      <EnTetePage titre="Ventes" sousTitre="Ce que la cantine gagne : les repas servis, et ceux qu'on n'est pas venu chercher (ils ne sont pas remboursés)" />
      <BarrePeriode base="/admin/recharges/ventes" periode={p} aujourdhui={aujourdhui} vue="ventes" />
      <SChiffresBande items={[
        { titre: "Gagné", valeur: fcfa(v.gagne), detail: pluriel(v.servis.nombre + v.nonRetires.nombre, "repas", "repas") },
        { titre: "Repas servis", valeur: nombre(v.servis.nombre), detail: fcfa(v.servis.montant) },
        { titre: "Non retirés", valeur: nombre(v.nonRetires.nombre), detail: `${fcfa(v.nonRetires.montant)} gardés` },
        { titre: "Payés, pas encore mangés", valeur: nombre(v.aVenir.nombre), detail: `${fcfa(v.aVenir.montant)} pas encore gagnés` },
      ]} />
      <ListeMontants titre="Plat par plat" vide="Aucun repas servi ni passé sur cette période"
        lignes={v.parPlat.map((x) => ({ cle: x.plat, libelle: x.plat, detail: pluriel(x.nombre, "repas", "repas"), montant: x.montant }))} />
      <ListeMontants titre="Jour par jour" vide="Aucun repas servi ni passé sur cette période"
        lignes={v.gagne === 0 ? [] : jours.map((j) => ({ cle: j.jour, libelle: jourLong(j.jour), detail: j.nombre ? pluriel(j.nombre, "repas", "repas") : "rien", montant: j.montant }))} />
      <Aide>
        Un repas payé pour aujourd&apos;hui ou un jour à venir n&apos;est gagné qu&apos;une fois servi, ou une fois son jour passé.
        {v.annules.nombre > 0 && <> Sur cette période, {pluriel(v.annules.nombre, "repas annulé", "repas annulés")} : {fcfa(v.annules.montant)} rendus sur les soldes, qui ne comptent pas.</>}
      </Aide>
    </div>
  );
}
