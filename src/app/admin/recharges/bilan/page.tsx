import type { Metadata } from "next";
import Link from "next/link";
import { EnTetePage } from "@/components/fenetre";
import { bilan, depensesDe, encaissements, periodeLisible, soldes, ventes } from "@/lib/comptabilite";
import { donneesCompta, soldesDesConvives } from "@/lib/donnees-compta";
import { fcfa } from "@/lib/format";
import { maintenant } from "@/lib/horloge";
import { jourIso } from "@/lib/jours";
import { exiger } from "@/lib/session";
import { BarrePeriode } from "../barre-periode";
import { Aide, ListeMontants } from "../lignes";
import { lirePeriode, requetePeriode } from "../periode";

export const metadata: Metadata = { title: "Bilan" };

export default async function PageBilan({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await exiger("admin");
  const aujourdhui = jourIso(maintenant());
  const p = lirePeriode(await searchParams, aujourdhui);
  const [donnees, comptes] = await Promise.all([donneesCompta(p), soldesDesConvives()]);
  const v = ventes(donnees.repas, p, aujourdhui);
  const d = depensesDe(donnees.depenses, p);
  const b = bilan(v.gagne, d.total);
  const entre = encaissements(donnees.recharges, p).total;
  const enDepot = soldes(comptes).total;
  const gagnePositif = b.resultat >= 0;
  return (
    <div className="w-full space-y-6">
      <EnTetePage titre="Bilan" sousTitre="Ce que la cantine a gagné, moins ce qu'elle a dépensé : ce qui lui reste" />
      <BarrePeriode base="/admin/recharges/bilan" periode={p} aujourdhui={aujourdhui} vue="bilan" />

      <section className="sn-card grid grid-cols-1 overflow-hidden sm:grid-cols-3">
        <div className="p-5 lg:p-6">
          <p className="text-[14px] leading-5 font-medium text-texte-2">Gagné</p>
          <p className="chiffres mt-1 text-[28px] leading-9 font-semibold text-encre/95">{fcfa(b.gagne)}</p>
          <p className="mt-1 text-[13px] leading-5 text-texte-2">Repas servis et non retirés</p>
        </div>
        <div className="border-t border-[color:var(--h-filet)] p-5 sm:border-t-0 sm:border-l lg:p-6">
          <p className="text-[14px] leading-5 font-medium text-texte-2">Dépensé</p>
          <p className="chiffres mt-1 text-[28px] leading-9 font-semibold text-encre/95">{fcfa(b.depense)}</p>
          <p className="mt-1 text-[13px] leading-5 text-texte-2">Les dépenses notées</p>
        </div>
        <div className="border-t border-[color:var(--h-filet)] p-5 sm:border-t-0 sm:border-l lg:p-6" style={{ background: "rgb(var(--h-marque-teinte) / var(--h-teinte))" }}>
          <p className="text-[14px] leading-5 font-medium text-texte-2">{gagnePositif ? "Il reste" : "Il manque"}</p>
          <p className={`chiffres mt-1 text-[28px] leading-9 font-semibold ${gagnePositif ? "text-marque-texte" : "text-erreur-texte"}`}>{fcfa(Math.abs(b.resultat))}</p>
          <p className="mt-1 text-[13px] leading-5 text-texte-2">{gagnePositif ? "La cantine gagne de l'argent" : "La cantine dépense plus qu'elle ne gagne"}</p>
        </div>
      </section>

      <p className="text-[15px] leading-6 text-encre/90 first-letter:uppercase">
        {periodeLisible(p)}, la cantine a gagné {fcfa(b.gagne)} et dépensé {fcfa(b.depense)} :{" "}
        {gagnePositif ? <>il lui reste {fcfa(b.resultat)}.</> : <>il lui manque {fcfa(-b.resultat)}.</>}
        {d.nombre === 0 && <> Aucune dépense n&apos;est notée sur cette période : note-les dans <Link href={`/admin/recharges/depenses?${requetePeriode(p)}`} className="font-medium underline-offset-4 hover:underline">Dépenses</Link> pour un bilan juste.</>}
      </p>

      <div className="grid grid-cols-1 gap-6 @3xl/page:grid-cols-2">
        <ListeMontants titre="Ce qui a été gagné" vide="Aucun repas servi ni passé sur cette période" lignes={v.gagne === 0 ? [] : [
          { cle: "servis", libelle: "Repas servis", detail: `${v.servis.nombre}`, montant: v.servis.montant },
          { cle: "non-retires", libelle: "Repas non retirés", detail: `${v.nonRetires.nombre}, gardés`, montant: v.nonRetires.montant },
        ]} />
        <ListeMontants titre="Ce qui a été dépensé" vide="Aucune dépense notée sur cette période"
          lignes={d.parCategorie.map((c) => ({ cle: c.id, libelle: c.libelle, detail: `${c.nombre}`, montant: c.montant }))} />
      </div>

      <Aide>
        À ne pas confondre : sur la même période, {fcfa(entre)} sont entrés par les recharges, et les élèves ont aujourd&apos;hui {fcfa(enDepot)} en
        dépôt. Cet argent n&apos;est gagné qu&apos;une fois mangé : il compte dans le bilan repas après repas.
      </Aide>
    </div>
  );
}
