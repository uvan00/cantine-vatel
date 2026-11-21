"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Plus, Printer, ShoppingBag } from "@/components/icons";
import { SAlert, SBtn, SChiffresBande, SEmpty, STabs } from "@/components/sneat";
import { RAYONS, quantiteLisible, rayonDe } from "@/lib/besoins";
import type { PeriodeAchat, VueAchats } from "@/lib/donnees-stock";
import { fcfa, liste, nombre } from "@/lib/format";
import { jourLong } from "@/lib/jours";
import type { LigneAchat } from "@/lib/stock";
import { EnTeteBesoins } from "./en-tete";
import { FenetreLivraison } from "./fenetres-stock";
import { ImageIngredient } from "./image-ingredient";

// Les achats (lot 2 des besoins) : le bon de commande de demain, ou des sept jours qui viennent. Pour chaque plat, ses
// portions prévues, sinon les réservations déjà faites ; la réserve est déduite ; le coût vient du prix des dernières
// livraisons payées. Il s'imprime pour le fournisseur.

const PERIODES: { id: PeriodeAchat; label: string }[] = [{ id: "demain", label: "Demain" }, { id: "semaine", label: "7 jours" }];

export function AchatsClient({ vue, aujourdhui }: { vue: VueAchats; aujourdhui: string }) {
  const router = useRouter();
  const [enRoute, demarrer] = useTransition();
  const [livraison, setLivraison] = useState(false);
  const aAcheter = vue.lignes.filter((l) => l.aAcheter > 0);
  const couverts = vue.lignes.length - aAcheter.length;
  const periode = vue.periode === "demain" ? jourLong(vue.jours[0]) : `du ${jourLong(vue.jours[0])} au ${jourLong(vue.jours[vue.jours.length - 1])}`;
  const changer = (p: PeriodeAchat) => demarrer(() => router.replace(p === "demain" ? "/admin/besoins?vue=achats" : "/admin/besoins?vue=achats&periode=semaine", { scroll: false }));

  return (
    <div className="w-full space-y-6">
      <EnTeteBesoins vue="achats" sousTitre={<span className="block first-letter:uppercase">Le bon de commande, {periode}</span>}
        actions={(
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <STabs value={vue.periode} onChange={changer} tabs={PERIODES} />
            <SBtn size="sm" variant="outlined" tone="secondary" onClick={() => window.print()}><Printer className="size-4" strokeWidth={1.8} />Imprimer</SBtn>
            <SBtn size="sm" tone="secondary" onClick={() => setLivraison(true)}><Plus className="size-4" strokeWidth={1.8} />Noter une livraison</SBtn>
          </div>
        )} />

      <div className={`space-y-6 transition-opacity ${enRoute ? "opacity-50" : ""}`} aria-busy={enRoute}>
        <p className="text-[14px] leading-5 text-texte-2">
          Pour chaque plat : ses portions prévues, sinon les réservations déjà faites. Ce qui est en réserve est déduit, et le
          coût vient du prix des dernières livraisons payées.
        </p>

        {vue.lignes.length === 0 ? (
          <div className="sn-card">
            <SEmpty Icon={ShoppingBag} title="Rien à commander pour cette période"
              hint="Il faut des plats au menu, avec leur fiche recette, et des réservations ou des portions prévues" />
          </div>
        ) : (
          <>
            <SChiffresBande items={[
              { titre: "Ingrédients à acheter", valeur: nombre(aAcheter.length) },
              { titre: "Coût estimé", valeur: <span className="chiffres">{fcfa(vue.total)}</span>, detail: vue.sansPrix.length > 0 ? `Sans ${liste(vue.sansPrix)}, au prix inconnu` : undefined },
              { titre: "Déjà couverts par la réserve", valeur: nombre(couverts) },
            ]} />

            {(vue.sansMenu.length > 0 || vue.sansFiche.length > 0) && (
              <SAlert tone="warning" Icon={AlertTriangle}>
                {vue.sansMenu.length > 0 && <span className="block">Pas encore de menu pour {liste(vue.sansMenu.map(jourLong))} : ces jours ne comptent pas.</span>}
                {vue.sansFiche.length > 0 && <span className="block">Sans fiche recette, ces plats ne comptent pas : {liste(vue.sansFiche)}.</span>}
              </SAlert>
            )}

            <section aria-labelledby="titre-commande" className="space-y-3">
              <h2 id="titre-commande" className="text-[18px] leading-6">À commander</h2>
              {RAYONS.map((rayon) => {
                const lignes = vue.lignes.filter((l) => rayonDe(l.nom) === rayon);
                if (lignes.length === 0) return null;
                return (
                  <div key={rayon} className="break-inside-avoid pt-2">
                    <h3 className="mb-2 pl-1 text-[14px] leading-5 font-semibold text-texte-2">{rayon}</h3>
                    <ul className="divide-y divide-[color:var(--h-filet)] overflow-hidden rounded-[16px] border border-[color:var(--h-filet)] bg-surface">
                      {lignes.map((l) => <LigneCommande key={l.ingredientId} l={l} />)}
                    </ul>
                  </div>
                );
              })}
            </section>
          </>
        )}
      </div>

      {livraison && <FenetreLivraison ingredients={vue.ingredients} aujourdhui={aujourdhui} onClose={() => setLivraison(false)} />}
    </div>
  );
}

function LigneCommande({ l }: { l: LigneAchat }) {
  const couvert = l.aAcheter === 0;
  return (
    <li className="flex items-center gap-4 px-4 py-3">
      <ImageIngredient nom={l.nom} taille={48} />
      <span className="min-w-0 flex-1">
        <span className={`block text-[15px] leading-5 font-semibold ${couvert ? "text-encre/60" : "text-encre/95"}`}>{l.nom}</span>
        <span className="chiffres block text-[13px] leading-5 text-texte-2">
          Besoin {quantiteLisible(l.besoin, l.unite)}, en réserve {quantiteLisible(l.stock, l.unite)}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className={`chiffres block text-[18px] leading-6 font-medium ${couvert ? "text-encre/60" : "text-encre/95"}`}>
          {couvert ? "Couvert" : quantiteLisible(l.aAcheter, l.unite)}
        </span>
        {!couvert && (
          <span className="chiffres block text-[13px] leading-5 text-texte-2">{l.coutEstime === null ? "Prix inconnu" : `Environ ${fcfa(l.coutEstime)}`}</span>
        )}
      </span>
    </li>
  );
}

