"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useConfirmation } from "@/components/fenetre";
import { AlertTriangle, Plus } from "@/components/icons";
import { SAlert, SBtn, SChiffresBande, SChip } from "@/components/sneat";
import { RAYONS, quantiteLisible, rayonDe } from "@/lib/besoins";
import type { LigneReserve, VueReserve } from "@/lib/donnees-stock";
import { fcfa, nombre, pluriel } from "@/lib/format";
import { jourCourt, jourLong } from "@/lib/jours";
import { prixLisible } from "@/lib/stock";
import { retirerUneLivraison } from "./actions";
import { EnTeteBesoins } from "./en-tete";
import { FenetreInventaire, FenetreLivraison } from "./fenetres-stock";
import { ImageIngredient } from "./image-ingredient";

// La réserve de la cuisine (lot 2 des besoins) : le stock de chaque ingrédient, son prix d'après les livraisons
// payées, ce que demain en demande déjà ; les livraisons et les comptages se notent ici ; puis les derniers mouvements.

type Ouvert = { genre: "livraison"; choisi?: string } | { genre: "inventaire"; ingredient: LigneReserve } | null;

const GENRE: Record<string, string> = { livraison: "Livraison", sortie: "Sortie pour le service", inventaire: "Comptage" };

/** « + 25 kg », « - 2,4 kg » */
const signe = (quantite: number, unite: LigneReserve["unite"]) => `${quantite < 0 ? "-" : "+"} ${quantiteLisible(Math.abs(quantite), unite)}`;

export function ReserveClient({ vue, aujourdhui }: { vue: VueReserve; aujourdhui: string }) {
  const [ouvert, setOuvert] = useState<Ouvert>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [, demarrer] = useTransition();
  const { confirmer, fenetre } = useConfirmation();
  // La question d'abord, hors transition : une transition n'affiche rien avant sa fin, et la fenêtre attendrait.
  const retirer = async (m: VueReserve["mouvements"][number]) => {
    const ok = await confirmer({
      titre: "Retirer cette livraison ?",
      message: `${m.ingredient}, ${signe(m.quantite, m.unite)}${m.prix !== null ? ` : sa dépense de ${fcfa(m.prix)} part aussi de la comptabilité` : ""}. Le stock baisse d'autant.`,
      libelle: "Retirer la livraison",
    });
    if (!ok) return;
    demarrer(async () => {
      setErreur(null);
      const r = await retirerUneLivraison(m.id).catch(() => ({ ok: false as const, erreur: "Le serveur ne répond pas, réessaie" }));
      if (!r.ok) setErreur(r.erreur);
    });
  };
  const manquants = vue.ingredients.filter((i) => i.besoinDemain > Math.max(0, i.stock));
  const valeur = vue.ingredients.reduce((s, i) => s + (i.prix !== null && i.stock > 0 ? i.stock * i.prix : 0), 0);
  const sansPrix = vue.ingredients.filter((i) => i.prix === null && i.stock > 0).length;

  return (
    <div className="w-full space-y-6">
      <EnTeteBesoins vue="reserve" sousTitre="Ce qui est en réserve, ingrédient par ingrédient, et ce que demain en demande déjà"
        actions={(
          <SBtn size="sm" tone="secondary" className="print:hidden" onClick={() => setOuvert({ genre: "livraison" })}>
            <Plus className="size-4" strokeWidth={1.8} />Noter une livraison
          </SBtn>
        )} />

      <SChiffresBande items={[
        { titre: "Ingrédients suivis", valeur: nombre(vue.ingredients.length) },
        { titre: "Valeur de la réserve", valeur: <span className="chiffres">{fcfa(valeur)}</span>, detail: sansPrix > 0 ? `Sans ${pluriel(sansPrix, "ingrédient")} au prix inconnu` : undefined },
        { titre: "À compléter pour demain", valeur: nombre(manquants.length) },
      ]} />

      {manquants.length > 0 && (
        <SAlert tone="warning" Icon={AlertTriangle} action={<Link href="/admin/besoins?vue=achats" className="hb hb--filet hb--petit">Voir les achats</Link>}>
          Pour {jourLong(vue.demain)}, il manque : {manquants.map((m) => `${m.nom} ${quantiteLisible(m.besoinDemain - Math.max(0, m.stock), m.unite)}`).join(", ")}
        </SAlert>
      )}

      <section aria-labelledby="titre-reserve" className="space-y-3">
        <h2 id="titre-reserve" className="text-[18px] leading-6">En réserve</h2>
        {vue.ingredients.length === 0 ? (
          <p className="rounded-[16px] border border-dashed border-[color:var(--h-surface-forte)] px-4 py-8 text-center text-[14px] leading-5 text-texte-2">
            Aucun ingrédient pour l&apos;instant : ils arrivent avec la fiche recette des plats
          </p>
        ) : RAYONS.map((rayon) => {
          const liste = vue.ingredients.filter((i) => rayonDe(i.nom) === rayon);
          if (liste.length === 0) return null;
          return (
            <div key={rayon} className="break-inside-avoid pt-2">
              <h3 className="mb-2 pl-1 text-[14px] leading-5 font-semibold text-texte-2">{rayon}</h3>
              <ul className="divide-y divide-[color:var(--h-filet)] overflow-hidden rounded-[16px] border border-[color:var(--h-filet)] bg-surface">
                {liste.map((i) => <LigneStock key={i.id} i={i} onLivraison={() => setOuvert({ genre: "livraison", choisi: i.id })} onCompter={() => setOuvert({ genre: "inventaire", ingredient: i })} />)}
              </ul>
            </div>
          );
        })}
      </section>

      <section aria-labelledby="titre-mouvements" className="space-y-3">
        <h2 id="titre-mouvements" className="text-[18px] leading-6">Derniers mouvements</h2>
        <div aria-live="polite" className="empty:hidden">{erreur && <SAlert tone="error">{erreur}</SAlert>}</div>
        {vue.mouvements.length === 0 ? (
          <p className="rounded-[16px] border border-dashed border-[color:var(--h-surface-forte)] px-4 py-8 text-center text-[14px] leading-5 text-texte-2">
            Rien n&apos;est encore entré ni sorti : note la première livraison
          </p>
        ) : (
          <ul className="divide-y divide-[color:var(--h-filet)] overflow-hidden rounded-[16px] border border-[color:var(--h-filet)] bg-surface">
            {vue.mouvements.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-[14px] leading-5">
                <span className="chiffres w-20 shrink-0 text-texte-2 first-letter:uppercase">{jourCourt(m.jour)}</span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-encre/95">{m.ingredient}</span>
                  <span className="text-texte-2">, {GENRE[m.genre] ?? m.genre}{m.genre === "sortie" ? ` du ${jourLong(m.jour)}` : ""}{m.note ? `, ${m.note}` : ""}</span>
                </span>
                {m.prix !== null && <span className="chiffres text-texte-2">{fcfa(m.prix)}</span>}
                <span className={`chiffres shrink-0 font-semibold ${m.quantite < 0 ? "text-encre/80" : "text-encre/95"}`}>{signe(m.quantite, m.unite)}</span>
                {m.genre === "livraison" && (
                  <SBtn size="sm" variant="text" tone="secondary" className="print:hidden" onClick={() => retirer(m)} aria-label={`Retirer la livraison : ${m.ingredient}`}>Retirer</SBtn>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {ouvert?.genre === "livraison" && <FenetreLivraison ingredients={vue.ingredients} choisi={ouvert.choisi} aujourdhui={aujourdhui} onClose={() => setOuvert(null)} />}
      {ouvert?.genre === "inventaire" && <FenetreInventaire ingredient={ouvert.ingredient} stock={ouvert.ingredient.stock} onClose={() => setOuvert(null)} />}
      {fenetre}
    </div>
  );
}

function LigneStock({ i, onLivraison, onCompter }: { i: LigneReserve; onLivraison: () => void; onCompter: () => void }) {
  const manque = i.besoinDemain - Math.max(0, i.stock);
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <ImageIngredient nom={i.nom} taille={48} />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] leading-5 font-semibold text-encre/95">{i.nom}</span>
        <span className="chiffres block text-[13px] leading-5 text-texte-2">
          {i.prix === null ? "Prix inconnu : note une livraison avec son prix" : prixLisible(i.prix, i.unite)}
          {i.derniereLivraison && `, livré le ${jourCourt(i.derniereLivraison)}`}
        </span>
        <span className="chiffres block text-[13px] leading-5 text-texte-2">
          {i.besoinDemain > 0 ? `Demain : ${quantiteLisible(i.besoinDemain, i.unite)} demandés` : "Rien de demandé demain"}
        </span>
      </span>
      <span className="flex flex-col items-end gap-1">
        <span className="chiffres text-[18px] leading-6 font-medium text-encre/95">{quantiteLisible(Math.max(0, i.stock), i.unite)}</span>
        {i.stock < 0 ? <SChip tone="warning" size="sm">À recompter</SChip>
          : manque > 0 ? <SChip tone="warning" size="sm">Il manque {quantiteLisible(manque, i.unite)}</SChip>
          : i.besoinDemain > 0 ? <SChip tone="success" size="sm">Couvre demain</SChip> : null}
      </span>
      <span className="flex w-full justify-end gap-1 print:hidden sm:w-auto">
        <SBtn size="sm" variant="text" tone="secondary" onClick={onLivraison} aria-label={`Noter une livraison : ${i.nom}`}>Livraison</SBtn>
        <SBtn size="sm" variant="text" tone="secondary" onClick={onCompter} aria-label={`Compter : ${i.nom}`}>Compter</SBtn>
      </span>
    </li>
  );
}
