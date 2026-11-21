"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EtiquetteAliment } from "@/components/allergene";
import { Fenetre } from "@/components/fenetre";
import { AlertTriangle, Plus, Printer, ShoppingBag, Trash2 } from "@/components/icons";
import { PhotoPlat } from "@/components/photo-plat";
import { SAlert, SBtn, SChiffresBande, SChip, SEmpty, SInput, SSelect, STabs } from "@/components/sneat";
import {
  LIBELLE_UNITE, UNITES, besoinsDuJour, besoinsParRayon, detailDuBesoin, phraseAllergie, planDuPlat, quantiteLisible,
  refusFiche, type Besoin, type Unite,
} from "@/lib/besoins";
import type { PlatBesoins, VueBesoins } from "@/lib/donnees-admin";
import { fcfa, liste, nombre, pluriel } from "@/lib/format";
import { jourLong } from "@/lib/jours";
import { etiquettesAllergenes } from "@/lib/listes";
import { poidsLisible } from "@/lib/restes";
import { coutPortion } from "@/lib/stock";
import { basculerSortieDuJour, enregistrerFicheRecette } from "./actions";
import { EnTeteBesoins } from "./en-tete";
import { ImageIngredient } from "./image-ingredient";

// Les besoins de la cuisine (cahier des charges, section 11, bonus 2 ; lot 1 validé par le propriétaire le 21/11/2026).
// Dans l'ordre du travail en cuisine : les chiffres du jour, l'alerte allergies, la liste de sortie par rayon (une case
// « Sorti » par ingrédient : cochée, la quantité du jour sort de la réserve, lot 2), puis le plan de production plat par
// plat, sa fiche recette multipliée par les réservations et son coût matière. Tout vient de la base ; les calculs sont
// purs (src/lib/besoins.ts, src/lib/stock.ts).

type CleJour = VueBesoins["cle"];
const ONGLETS: { id: CleJour; label: string }[] = [{ id: "aujourdhui", label: "Aujourd'hui" }, { id: "demain", label: "Demain" }];

type Ligne = { nom: string; unite: Unite; quantite: string };

/* ── La page ─────────────────────────────────────────────────────────────── */

export function BesoinsClient({ vue }: { vue: VueBesoins }) {
  const router = useRouter();
  const [enRoute, demarrer] = useTransition();
  const [fiche, setFiche] = useState<PlatBesoins | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  // La case répond tout de suite ; le serveur sort (ou rend) la quantité du jour, puis la page se relit.
  const [sortis, basculerAffiche] = useOptimistic(vue.sortis, (etat: string[], id: string) => (etat.includes(id) ? etat.filter((x) => x !== id) : [...etat, id]));
  const [, demarrerSortie] = useTransition();
  const basculer = (id: string) => demarrerSortie(async () => {
    setErreur(null);
    basculerAffiche(id);
    const r = await basculerSortieDuJour(vue.cle, id).catch(() => ({ ok: false as const, erreur: "Le serveur ne répond pas, réessaie" }));
    if (!r.ok) setErreur(r.erreur);
  });
  const { besoins, sansFiche } = besoinsDuJour(vue.plats);
  const nbSortis = besoins.filter((b) => sortis.includes(b.ingredientId)).length;
  const repas = vue.plats.reduce((s, p) => s + p.reservations, 0);
  const quand = vue.cle === "demain" ? "demain" : "aujourd'hui";
  const changer = (cle: CleJour) => demarrer(() => router.replace(cle === "aujourdhui" ? "/admin/besoins?jour=aujourdhui" : "/admin/besoins", { scroll: false }));

  return (
    <div className="w-full space-y-6">
      <EnTeteBesoins vue="jour" sousTitre={<span className="block first-letter:uppercase">{jourLong(vue.jour)} : ce qu&apos;il faut sortir et préparer pour les repas réservés</span>}
        actions={(
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <STabs value={vue.cle} onChange={changer} tabs={ONGLETS} />
            <SBtn size="sm" variant="outlined" tone="secondary" onClick={() => window.print()}><Printer className="size-4" strokeWidth={1.8} />Imprimer</SBtn>
          </div>
        )} />

      <div className={`space-y-8 transition-opacity ${enRoute ? "opacity-50" : ""}`} aria-busy={enRoute}>
        {vue.plats.length === 0 ? (
          <div className="sn-card">
            <SEmpty Icon={ShoppingBag} title={`Rien au menu ${quand}`} hint="Dès qu'un plat est au menu de ce jour, ce qu'il faut sortir et préparer arrive ici"
              action={<Link href="/admin/menus" className="hb hb--encre">Planifier les menus</Link>} />
          </div>
        ) : (
          <>
            <SChiffresBande items={[
              { titre: "Repas à préparer", valeur: nombre(repas) },
              { titre: "Plats au menu", valeur: nombre(vue.plats.length) },
              { titre: "Ingrédients à sortir", valeur: nombre(besoins.length) },
              { titre: "Déjà sortis", valeur: <span className="chiffres">{nombre(nbSortis)} sur {nombre(besoins.length)}</span> },
            ]} />

            {vue.allergies.length > 0 && (
              <SAlert tone="warning" Icon={AlertTriangle}>
                <p className="font-semibold text-encre/95">Allergies : garde ces repas à l&apos;écart</p>
                <ul className="mt-2 space-y-2">
                  {vue.allergies.map((a) => {
                    const e = etiquettesAllergenes([a.allergene])[0];
                    return (
                      <li key={a.allergene} className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                        {e && <EtiquetteAliment etiquette={{ ...e, nom: e.nom.charAt(0).toUpperCase() + e.nom.slice(1) }} taille={20} className="font-medium" />}
                        <span>: {phraseAllergie(a, quand)}</span>
                      </li>
                    );
                  })}
                </ul>
              </SAlert>
            )}

            {sansFiche.length > 0 && (
              <SAlert tone="warning" Icon={AlertTriangle}>Fiche recette à remplir pour {liste(sansFiche)} : sans elle, ses ingrédients ne sont pas comptés</SAlert>
            )}

            <div aria-live="polite" className="empty:hidden">{erreur && <SAlert tone="error">{erreur}</SAlert>}</div>
            <ListeDeSortie besoins={besoins} sortis={sortis} basculer={basculer} nbSortis={nbSortis} stocks={vue.stocks} />
            <PlanDeProduction plats={vue.plats} prix={vue.prix} onFiche={setFiche} />
          </>
        )}
      </div>

      {fiche && <FicheRecette plat={fiche} ingredients={vue.ingredients} onClose={() => setFiche(null)} onFait={() => { setFiche(null); router.refresh(); }} />}
    </div>
  );
}

/* ── À sortir : la liste de la réserve, par rayon ────────────────────────── */

function ListeDeSortie({ besoins, sortis, basculer, nbSortis, stocks }: {
  besoins: Besoin[]; sortis: string[]; basculer: (id: string) => void; nbSortis: number;
  /** Le stock de chaque ingrédient (lot 2) : ce que la réserve en a, ou ce qu'il manque. */
  stocks: Record<string, number>;
}) {
  return (
    <section aria-labelledby="titre-sortie" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="titre-sortie" className="text-[18px] leading-6">À sortir</h2>
        {besoins.length > 0 && <p className="chiffres text-[14px] leading-5 text-texte-2 print:hidden" aria-live="polite">{nombre(nbSortis)} sur {pluriel(besoins.length, "sorti")}</p>}
      </div>
      {besoins.length === 0 ? (
        <div className="sn-card">
          <SEmpty Icon={ShoppingBag} title="Rien à sortir pour l'instant" hint="Il faut des repas réservés et la fiche recette de leurs plats" />
        </div>
      ) : (
        <div className="space-y-5">
          {besoinsParRayon(besoins).map((g) => (
            <div key={g.rayon} className="break-inside-avoid">
              <h3 className="mb-2 pl-1 text-[14px] leading-5 font-semibold text-texte-2">{g.rayon}</h3>
              <ul className="divide-y divide-[color:var(--h-filet)] overflow-hidden rounded-[16px] border border-[color:var(--h-filet)] bg-surface">
                {g.besoins.map((b) => {
                  const sorti = sortis.includes(b.ingredientId);
                  return (
                    <li key={b.ingredientId}>
                      <label className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-[color:var(--h-filet-doux)]">
                        <input type="checkbox" checked={sorti} onChange={() => basculer(b.ingredientId)} aria-label={`${b.nom} sorti`}
                          className="size-5 shrink-0 cursor-pointer accent-[rgb(var(--sn-cta))]" />
                        <ImageIngredient nom={b.nom} taille={48} />
                        <span className="min-w-0 flex-1">
                          <span className={`block text-[15px] leading-5 font-semibold ${sorti ? "text-encre/50 line-through" : "text-encre/95"}`}>{b.nom}</span>
                          <span className="chiffres block text-[13px] leading-5 text-texte-2">{detailDuBesoin(b)}</span>
                          {!sorti && <EtatReserve besoin={b} stock={stocks[b.ingredientId] ?? 0} />}
                        </span>
                        <span className={`chiffres shrink-0 text-[18px] leading-6 font-medium ${sorti ? "text-encre/50" : "text-encre/95"}`}>{quantiteLisible(b.total, b.unite)}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** Sous un ingrédient pas encore sorti : la réserve le couvre, ou il en manque (le stock de la réserve, lot 2). */
function EtatReserve({ besoin, stock }: { besoin: Besoin; stock: number }) {
  const manque = besoin.total - Math.max(0, stock);
  return manque > 0
    ? <span className="mt-1 block"><SChip tone="warning" size="sm">Il manque {quantiteLisible(manque, besoin.unite)} dans la réserve</SChip></span>
    : <span className="chiffres block text-[13px] leading-5 text-texte-2">En réserve : {quantiteLisible(stock, besoin.unite)}</span>;
}

/* ── Le plan de production, plat par plat ───────────────────────────────── */

function PlanDeProduction({ plats, prix, onFiche }: { plats: PlatBesoins[]; prix: Record<string, number | null>; onFiche: (p: PlatBesoins) => void }) {
  return (
    <section aria-labelledby="titre-plan" className="space-y-3">
      <h2 id="titre-plan" className="text-[18px] leading-6">Plan de production</h2>
      <ul className="grid grid-cols-1 items-start gap-4 @3xl/page:grid-cols-2">
        {plats.map((p) => <CartePlan key={p.menuJourId} plat={p} prix={prix} onFiche={() => onFiche(p)} />)}
      </ul>
    </section>
  );
}

function CartePlan({ plat, prix, onFiche }: { plat: PlatBesoins; prix: Record<string, number | null>; onFiche: () => void }) {
  const plan = planDuPlat(plat);
  const sansFiche = plat.lignes.length === 0;
  const cout = sansFiche ? null : coutPortion(plat.lignes, new Map(Object.entries(prix)));
  return (
    <li className="flex break-inside-avoid flex-col rounded-[20px] border border-[color:var(--h-filet)] bg-surface p-4">
      <div className="flex items-center gap-4">
        {/* La photo du plat, détourée sur blanc, fondue dans la carte. */}
        <div aria-hidden="true" className="w-28 shrink-0 mix-blend-multiply">
          <PhotoPlat photo={plat.photo} nom="" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[16px] leading-6 font-semibold text-encre/95">{plat.nom}</h3>
          <p className="chiffres mt-1 flex flex-wrap items-baseline gap-x-2 text-[14px] leading-5 text-texte-2">
            <span className="text-[24px] leading-8 font-semibold text-encre/95">{nombre(plan.portions)}</span>
            <span>{plan.portions > 1 ? "portions à préparer" : "portion à préparer"}{plat.portions !== null && `, sur ${nombre(plat.portions)} prévues`}</span>
          </p>
        </div>
      </div>

      {sansFiche ? (
        <p className="mt-4 rounded-[12px] border border-dashed border-[color:var(--h-surface-forte)] px-3 py-3 text-[14px] leading-5 text-texte-2">
          Pas encore de fiche recette : ses ingrédients ne sont pas comptés dans la liste de sortie
        </p>
      ) : plan.portions === 0 ? (
        <p className="mt-4 text-[14px] leading-5 text-texte-2">Personne ne l&apos;a encore réservé : rien à préparer pour l&apos;instant</p>
      ) : (
        <ul className="mt-4 divide-y divide-[color:var(--h-filet)] border-t border-[color:var(--h-filet)]">
          {plan.lignes.map((l) => (
            <li key={l.ingredientId} className="flex items-center gap-3 py-2">
              <ImageIngredient nom={l.nom} taille={36} />
              <span className="min-w-0 flex-1 text-[14px] leading-5">
                <span className="block text-encre/90">{l.nom}</span>
                <span className="chiffres block text-[13px] text-texte-2">{quantiteLisible(l.parPortion, l.unite)} par portion</span>
              </span>
              <span className="chiffres shrink-0 text-[15px] leading-5 font-semibold text-encre/95">{quantiteLisible(l.total, l.unite)}</span>
            </li>
          ))}
        </ul>
      )}

      {cout && (cout.complet || cout.cout > 0) && (
        <p className="chiffres mt-3 text-[13px] leading-5 text-texte-2">
          Matière : {cout.complet ? "" : "au moins "}{fcfa(cout.cout)} la portion, vendue {fcfa(plat.prixVente)}
          {!cout.complet && `. Prix encore inconnu : ${liste(cout.manquants)}`}
        </p>
      )}
      {plat.restesParRepas !== null && (
        <p className="chiffres mt-1 text-[13px] leading-5 text-texte-2">Restes des 7 derniers jours : {poidsLisible(plat.restesParRepas)} par repas servi</p>
      )}

      <div className="mt-4 print:hidden">
        <SBtn size="sm" variant="outlined" tone="secondary" onClick={onFiche} aria-label={`${sansFiche ? "Remplir la fiche recette" : "Fiche recette"} : ${plat.nom}`}>
          {sansFiche ? <><Plus className="size-4" strokeWidth={1.8} />Remplir sa fiche</> : "Fiche recette"}
        </SBtn>
      </div>
    </li>
  );
}

/** La fiche recette d'un plat : une ligne par ingrédient, avec sa quantité pour une portion. Sert aussi la vue des coûts. */
export function FicheRecette({ plat, ingredients, onClose, onFait }: {
  plat: Pick<PlatBesoins, "platId" | "nom" | "lignes">;
  ingredients: VueBesoins["ingredients"];
  onClose: () => void;
  onFait: () => void;
}) {
  const [lignes, setLignes] = useState<Ligne[]>(plat.lignes.length > 0
    ? plat.lignes.map((l) => ({ nom: l.nom, unite: l.unite, quantite: String(l.quantite) }))
    : [{ nom: "", unite: "g", quantite: "" }]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const uniteConnue = (nom: string) => ingredients.find((i) => i.nom.toLocaleLowerCase("fr") === nom.trim().toLocaleLowerCase("fr"))?.unite as Unite | undefined;

  const changer = (i: number, p: Partial<Ligne>) => {
    setErreur(null);
    setLignes((avant) => avant.map((l, j) => {
      if (j !== i) return l;
      const suivante = { ...l, ...p };
      // Un ingrédient connu garde son unité.
      const connue = p.nom !== undefined ? uniteConnue(p.nom) : undefined;
      return connue ? { ...suivante, unite: connue } : suivante;
    }));
  };
  const aEnvoyer = lignes.filter((l) => l.nom.trim() || l.quantite).map((l) => ({ nom: l.nom, unite: l.unite, quantite: Number(l.quantite) }));
  const refus = refusFiche(aEnvoyer);

  const enregistrer = () => demarrer(async () => {
    const r = await enregistrerFicheRecette(plat.platId, aEnvoyer).catch(() => ({ ok: false as const, erreur: "Le serveur ne répond pas, réessaie" }));
    if (r.ok) onFait(); else setErreur(r.erreur);
  });

  return (
    <Fenetre titre={`Fiche recette : ${plat.nom}`} sousTitre="Pour une portion : la quantité de chaque ingrédient" onClose={onClose}>
      <datalist id="ingredients-connus">{ingredients.map((i) => <option key={i.id} value={i.nom} />)}</datalist>
      <ul className="space-y-3">
        {lignes.map((l, i) => (
          <li key={i} className="grid grid-cols-[minmax(0,1fr)_88px_152px_40px] items-center gap-2">
            <SInput aria-label="Ingrédient" placeholder="Riz" list="ingredients-connus" value={l.nom} onChange={(e) => changer(i, { nom: e.target.value })} />
            <SInput aria-label="Quantité par portion" inputMode="numeric" className="chiffres" placeholder="120" value={l.quantite}
              onChange={(e) => changer(i, { quantite: e.target.value.replace(/\D/g, "").slice(0, 6) })} />
            <SSelect aria-label="Unité" value={l.unite} onChange={(e) => changer(i, { unite: e.target.value as Unite })}>
              {UNITES.map((u) => <option key={u} value={u}>{LIBELLE_UNITE[u]}</option>)}
            </SSelect>
            <SBtn variant="text" tone="secondary" aria-label="Retirer cet ingrédient" className="px-2" onClick={() => setLignes((avant) => avant.filter((_, j) => j !== i))}>
              <Trash2 className="size-4" strokeWidth={1.8} />
            </SBtn>
          </li>
        ))}
      </ul>
      <SBtn variant="text" tone="secondary" className="mt-2" onClick={() => setLignes((avant) => [...avant, { nom: "", unite: "g", quantite: "" }])}>
        <Plus className="size-4" strokeWidth={1.8} />Ajouter un ingrédient
      </SBtn>
      <div aria-live="polite" className="mt-4 empty:hidden">{(erreur || (refus && aEnvoyer.length > 0)) && <SAlert tone="error">{erreur ?? refus}</SAlert>}</div>
      <SBtn tone="secondary" block className="mt-4" disabled={enCours || refus !== null} onClick={enregistrer}>{enCours ? "Un instant" : "Enregistrer la fiche"}</SBtn>
    </Fenetre>
  );
}
