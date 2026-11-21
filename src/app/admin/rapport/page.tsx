import type { Metadata } from "next";
import Link from "next/link";
import { BoutonImprimer } from "@/app/feuille/[cle]/bouton-imprimer";
import { EnTetePage } from "@/components/fenetre";
import { ArrowDownToLine, ChevronLeft, ChevronRight } from "@/components/icons";
import { SChiffresBande, STable, STd, STr } from "@/components/sneat";
import { donneesDuRapport } from "@/lib/donnees-admin";
import { iaBranchee } from "@/lib/ia";
import { fcfa, nombre, pluriel } from "@/lib/format";
import { maintenant } from "@/lib/horloge";
import { ajouterJours, jourIso, jourLong, lundiDe } from "@/lib/jours";
import { MARQUE } from "@/lib/marque";
import { LIBELLE_MOYEN } from "@/lib/recharge";
import { lundiDuRapport, periodeDuRapport, rapportDeLaSemaine } from "@/lib/rapport";
import { poidsLisible } from "@/lib/restes";
import { exiger } from "@/lib/session";
import { noteLisible } from "@/lib/statistiques";
import { SuggestionDeLaSemaine } from "./suggestion";

export const metadata: Metadata = { title: "Rapport de la semaine" };

// Le rapport de la semaine (bonus 4 du cahier) : du lundi au dimanche, les repas jour par jour, les plats, les recharges,
// les notes et les restes pesés, avec les mêmes définitions que le tableau de bord (src/lib/rapport.ts), et, quand la
// cantine a posé sa clé d'IA, une suggestion pour la semaine suivante (bonus 5, src/lib/suggestion.ts). Il s'imprime :
// la coque de la cantine et les boutons ne sortent pas sur le papier. Le même rapport se télécharge en CSV
// (/api/admin/rapport).

/** Un en-tête de colonne de chiffres, aligné à droite comme ses chiffres. */
const aDroite = (texte: string) => <span className="block text-right">{texte}</span>;
const CHIFFRE = "chiffres text-right whitespace-nowrap";
/** Sur une feuille A4, les tableaux se resserrent pour que toutes leurs colonnes tiennent. */
const SERRE = "print:[&_td]:px-2 print:[&_td]:py-1.5 print:[&_th]:px-2 print:[&_th]:py-1.5 print:[&_th]:text-[12px] print:[&_table]:text-[12px]";
const CARTE = `sn-card min-w-0 overflow-hidden print:break-inside-avoid ${SERRE}`;

export default async function PageRapport({ searchParams }: { searchParams: Promise<{ semaine?: string | string[] }> }) {
  await exiger("admin");
  const instant = maintenant();
  const cetteSemaine = lundiDe(jourIso(instant));
  const lundi = lundiDuRapport((await searchParams).semaine, jourIso(instant));
  const r = rapportDeLaSemaine(lundi, await donneesDuRapport(lundi), instant);
  const t = r.total;
  const restes = r.restes;

  return (
    <div className="w-full max-w-[1040px] space-y-6 print:max-w-none">
      <EnTetePage titre="Rapport de la semaine"
        sousTitre={<span className="block first-letter:uppercase">{periodeDuRapport(r)}, {MARQUE.cantine}</span>}
        actions={
          // La zone des actions du kit ne rétrécit pas : sur un téléphone, les boutons passent à la ligne d'eux-mêmes.
          <div className="flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-2 print:hidden">
            <Link href={`/admin/rapport?semaine=${ajouterJours(lundi, -7)}`} className="hb hb--filet hb--petit">
              <ChevronLeft className="size-4" strokeWidth={1.8} />Semaine d&apos;avant
            </Link>
            {lundi < cetteSemaine && (
              <Link href={`/admin/rapport?semaine=${ajouterJours(lundi, 7)}`} className="hb hb--filet hb--petit">
                Semaine d&apos;après<ChevronRight className="size-4" strokeWidth={1.8} />
              </Link>
            )}
            <a href={`/api/admin/rapport?semaine=${lundi}`} download className="hb hb--filet hb--petit">
              <ArrowDownToLine className="size-4" strokeWidth={1.8} />CSV
            </a>
            <BoutonImprimer />
          </div>
        } />

      {/* Sur la feuille, les quatre chiffres passent sur deux lignes : sur une seule, les montants seraient coupés. */}
      <div className="print:[&>.sn-card]:grid">
      <SChiffresBande items={[
        { titre: "Repas réservés", valeur: nombre(t.reserves), detail: `${pluriel(t.servis, "servi")}, ${pluriel(t.annules, "annulé")}` },
        { titre: "Non retirés", valeur: nombre(t.nonRetires), detail: r.partNonRetires === null ? "Aucun jour fini" : `${r.partNonRetires} % des jours finis` },
        { titre: "Payé en repas", valeur: fcfa(t.paye), detail: "Sur les soldes, annulations remboursées" },
        { titre: "Recharges confirmées", valeur: fcfa(r.recharges.montant), detail: pluriel(r.recharges.nombre, "recharge") },
      ]} />
      </div>

      <section className={CARTE} aria-labelledby="titre-jours">
        <h2 id="titre-jours" className="px-6 pt-5 text-[18px] leading-6">Jour par jour</h2>
        <STable className="mt-2" head={["Jour", aDroite("Réservés"), aDroite("Servis"), aDroite("Non retirés"), aDroite("Annulés"), aDroite("Payé"), aDroite("Restes pesés")]}>
          {r.jours.map((j) => (
            <STr key={j.jour}>
              <STd><span className="block whitespace-nowrap first-letter:uppercase">{jourLong(j.jour)}</span></STd>
              <STd className={CHIFFRE}>{nombre(j.reserves)}</STd>
              <STd className={CHIFFRE}>{nombre(j.servis)}</STd>
              <STd className={CHIFFRE}>{nombre(j.nonRetires)}</STd>
              <STd className={CHIFFRE}>{nombre(j.annules)}</STd>
              <STd className={CHIFFRE}>{fcfa(j.paye)}</STd>
              <STd className={CHIFFRE}>{j.restes === null ? "" : poidsLisible(j.restes)}</STd>
            </STr>
          ))}
          <STr>
            <STd className="font-semibold text-encre/95">Total</STd>
            <STd className={`${CHIFFRE} font-semibold text-encre/95`}>{nombre(t.reserves)}</STd>
            <STd className={`${CHIFFRE} font-semibold text-encre/95`}>{nombre(t.servis)}</STd>
            <STd className={`${CHIFFRE} font-semibold text-encre/95`}>{nombre(t.nonRetires)}</STd>
            <STd className={`${CHIFFRE} font-semibold text-encre/95`}>{nombre(t.annules)}</STd>
            <STd className={`${CHIFFRE} font-semibold text-encre/95`}>{fcfa(t.paye)}</STd>
            <STd className={`${CHIFFRE} font-semibold text-encre/95`}>{t.restes === null ? "" : poidsLisible(t.restes)}</STd>
          </STr>
        </STable>
        <div className="chiffres space-y-1 px-6 py-4 text-[14px] leading-5 text-encre/90 print:py-2 print:text-[12px]">
          <p>
            <span className="font-medium text-encre/95">Note des repas de la semaine : </span>
            {r.notes.moyenne === null ? "aucune note" : `${noteLisible(r.notes.moyenne)}, ${pluriel(r.notes.avis, "avis", "avis")}`}
          </p>
          <p>
            <span className="font-medium text-encre/95">Restes pesés : </span>
            {restes.parRepas === null
              ? "aucun plat servi n'a été pesé"
              : `${poidsLisible(restes.grammes)} pour ${pluriel(restes.servis, "repas servi", "repas servis")}, soit ${poidsLisible(restes.parRepas)} par repas`}
            {restes.plusLaisse && <>. Le plus laissé : {restes.plusLaisse.nom}, {poidsLisible(restes.plusLaisse.parRepas)} par repas</>}
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-6 @4xl/page:grid-cols-2 print:grid-cols-1">
        <section className={CARTE} aria-labelledby="titre-plats">
          <h2 id="titre-plats" className="px-6 pt-5 text-[18px] leading-6">Les plats</h2>
          {r.plats.length === 0 ? (
            <p className="px-6 pt-2 pb-5 text-[14px] leading-5 text-texte-2">Aucun repas cette semaine</p>
          ) : (
            <STable className="mt-2" head={["Plat", aDroite("Repas"), aDroite("Servis"), aDroite("Non retirés"), aDroite("Note")]}>
              {r.plats.map((p) => (
                <STr key={p.platId}>
                  <STd>{p.nom}</STd>
                  <STd className={CHIFFRE}>{nombre(p.repas)}</STd>
                  <STd className={CHIFFRE}>{nombre(p.servis)}</STd>
                  <STd className={CHIFFRE}>{nombre(p.nonRetires)}</STd>
                  <STd className={CHIFFRE}>{p.note === null ? "" : <>{noteLisible(p.note)}<span className="block text-[13px] text-texte-2">{pluriel(p.avis, "avis", "avis")}</span></>}</STd>
                </STr>
              ))}
            </STable>
          )}
        </section>

        <section className={CARTE} aria-labelledby="titre-recharges">
          <h2 id="titre-recharges" className="px-6 pt-5 text-[18px] leading-6">Les recharges confirmées</h2>
          <STable className="mt-2" head={["Moyen", aDroite("Recharges"), aDroite("Montant")]}>
            {r.recharges.lignes.map((l) => (
              <STr key={l.moyen}>
                <STd>{LIBELLE_MOYEN[l.moyen]}</STd>
                <STd className={CHIFFRE}>{nombre(l.nombre)}</STd>
                <STd className={CHIFFRE}>{fcfa(l.montant)}</STd>
              </STr>
            ))}
            <STr>
              <STd className="font-semibold text-encre/95">Total</STd>
              <STd className={`${CHIFFRE} font-semibold text-encre/95`}>{nombre(r.recharges.nombre)}</STd>
              <STd className={`${CHIFFRE} font-semibold text-encre/95`}>{fcfa(r.recharges.montant)}</STd>
            </STr>
          </STable>
        </section>
      </div>

      <SuggestionDeLaSemaine key={lundi} semaine={lundi} branchee={iaBranchee()} />

      <p className="hidden text-[12px] leading-4 text-texte-2 print:block">Imprimé le {jourLong(jourIso(instant))}, {MARQUE.cantine}</p>
    </div>
  );
}
