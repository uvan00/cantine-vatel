import type { Metadata } from "next";
import Link from "next/link";
import { EnTetePage } from "@/components/fenetre";
import { SChiffresBande } from "@/components/sneat";
import { encaissements, estRepasPayeALaCaisse } from "@/lib/comptabilite";
import { donneesCompta } from "@/lib/donnees-compta";
import { fcfa, pluriel } from "@/lib/format";
import { maintenant } from "@/lib/horloge";
import { jourIso, jourLong } from "@/lib/jours";
import { exiger } from "@/lib/session";
import { BarrePeriode } from "../barre-periode";
import { Aide, ListeMontants } from "../lignes";
import { lirePeriode, requetePeriode } from "../periode";

export const metadata: Metadata = { title: "Encaissements" };

export default async function PageEncaissements({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await exiger("admin");
  const aujourdhui = jourIso(maintenant());
  const p = lirePeriode(await searchParams, aujourdhui);
  const e = encaissements((await donneesCompta(p)).entrees, p);
  // Sur un mois, seulement les jours où de l'argent est entré.
  const jours = p.type === "mois" ? e.parJour.filter((j) => j.montant > 0) : e.parJour;
  return (
    <div className="w-full space-y-6">
      <EnTetePage titre="Encaissements" sousTitre="L'argent vraiment entré à la cantine : les recharges confirmées et les repas payés à la caisse, par moyen de paiement" />
      <BarrePeriode base="/admin/recharges/encaissements" periode={p} aujourdhui={aujourdhui} vue="encaissements" />
      <SChiffresBande items={[
        { titre: "Argent entré", valeur: fcfa(e.total), detail: pluriel(e.nombre, "entrée") },
        ...e.parMoyen.map((m) => ({ titre: m.libelle, valeur: fcfa(m.montant), detail: estRepasPayeALaCaisse(m.id) ? pluriel(m.nombre, "repas", "repas") : pluriel(m.nombre, "recharge") })),
      ]} />
      <ListeMontants titre="Jour par jour" vide="Aucun argent entré sur cette période"
        lignes={e.nombre === 0 ? [] : jours.map((j) => ({ cle: j.jour, libelle: jourLong(j.jour), detail: j.nombre ? pluriel(j.nombre, "entrée") : "rien", montant: j.montant }))} />
      <Aide>
        L&apos;argent des recharges n&apos;est pas encore gagné : il appartient aux élèves tant qu&apos;ils n&apos;ont pas mangé (voir{" "}
        <Link href="/admin/recharges/soldes" className="font-medium text-encre/90 underline-offset-4 hover:underline">Soldes</Link>). Un repas payé à la caisse est gagné
        tout de suite. Ce que la cantine gagne vraiment est dans <Link href={`/admin/recharges/ventes?${requetePeriode(p)}`} className="font-medium text-encre/90 underline-offset-4 hover:underline">Ventes</Link>.
      </Aide>
    </div>
  );
}
