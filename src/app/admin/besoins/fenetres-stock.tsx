"use client";

import { useState, useTransition } from "react";
import { Fenetre } from "@/components/fenetre";
import { SAlert, SBtn, SField, SInput, SSelect } from "@/components/sneat";
import { quantiteLisible, type Unite } from "@/lib/besoins";
import { MOYENS_DEPENSE } from "@/lib/comptabilite";
import { UNITE_DE_SAISIE, lireQuantite, refusInventaire, refusLivraison } from "@/lib/stock";
import { noterInventaire, noterLivraison } from "./actions";

// Les deux gestes de la réserve : noter une livraison (le stock monte ; payée, la dépense se note aussi dans la
// comptabilité), et compter ce qui est là (l'inventaire). Le serveur revalide tout (src/lib/stock.ts).

type Ingredient = { id: string; nom: string; unite: Unite };

const HORS_LIGNE = "Le serveur ne répond pas, réessaie";

export function FenetreLivraison({ ingredients, choisi, aujourdhui, onClose }: {
  ingredients: Ingredient[]; choisi?: string; aujourdhui: string; onClose: () => void;
}) {
  const [ingredientId, setIngredientId] = useState(choisi ?? ingredients[0]?.id ?? "");
  const [quantite, setQuantite] = useState("");
  const [prix, setPrix] = useState("");
  const [fournisseur, setFournisseur] = useState("");
  const [moyen, setMoyen] = useState<string>(MOYENS_DEPENSE[0].id);
  const [jour, setJour] = useState(aujourdhui);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const ingredient = ingredients.find((i) => i.id === ingredientId);
  const unite = ingredient?.unite ?? "g";
  const q = lireQuantite(quantite, unite);
  const p = prix.trim() === "" ? null : Number(prix);
  const refus = q === null ? (quantite.trim() ? `La quantité, en ${UNITE_DE_SAISIE[unite].libelle}` : null) : refusLivraison({ quantite: q, prix: p, jour }, aujourdhui);

  const noter = () => demarrer(async () => {
    if (q === null) return;
    const r = await noterLivraison({ ingredientId, quantite: q, prix: p, jour, fournisseur, moyen }).catch(() => ({ ok: false as const, erreur: HORS_LIGNE }));
    if (r.ok) onClose(); else setErreur(r.erreur);
  });

  return (
    <Fenetre titre="Noter une livraison" sousTitre="Ce qui arrive dans la réserve : le stock monte tout de suite" onClose={onClose}>
      <div className="space-y-4">
        <SField label="Ingrédient">
          <SSelect value={ingredientId} onChange={(e) => { setErreur(null); setIngredientId(e.target.value); }}>
            {ingredients.map((i) => <option key={i.id} value={i.id}>{i.nom}</option>)}
          </SSelect>
        </SField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SField label={`Quantité, en ${UNITE_DE_SAISIE[unite].libelle}`} hint={q !== null ? quantiteLisible(q, unite) : "Avec une virgule si besoin"}>
            <SInput inputMode="decimal" className="chiffres" placeholder="25" value={quantite} onChange={(e) => { setErreur(null); setQuantite(e.target.value.slice(0, 12)); }} />
          </SField>
          <SField label="Prix payé, en F CFA" hint="Avec un prix, la dépense se note dans la comptabilité">
            <SInput inputMode="numeric" className="chiffres" placeholder="15000" value={prix} onChange={(e) => { setErreur(null); setPrix(e.target.value.replace(/\D/g, "").slice(0, 8)); }} />
          </SField>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SField label="Fournisseur" hint="Tu peux laisser vide">
            <SInput value={fournisseur} maxLength={80} onChange={(e) => setFournisseur(e.target.value)} />
          </SField>
          <SField label="Payé en">
            <SSelect value={moyen} onChange={(e) => setMoyen(e.target.value)}>
              {MOYENS_DEPENSE.map((m) => <option key={m.id} value={m.id}>{m.libelle}</option>)}
            </SSelect>
          </SField>
        </div>
        <SField label="Jour de la livraison">
          <SInput type="date" value={jour} max={aujourdhui} onChange={(e) => setJour(e.target.value)} />
        </SField>
      </div>
      <div aria-live="polite" className="mt-4 empty:hidden">{(erreur || refus) && <SAlert tone="error">{erreur ?? refus}</SAlert>}</div>
      <SBtn tone="secondary" block className="mt-4" disabled={enCours || q === null || refus !== null || !ingredient} onClick={noter}>
        {enCours ? "Un instant" : "Noter la livraison"}
      </SBtn>
    </Fenetre>
  );
}

export function FenetreInventaire({ ingredient, stock, onClose }: { ingredient: Ingredient; stock: number; onClose: () => void }) {
  const [compte, setCompte] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const unite = ingredient.unite;
  // Zéro se compte aussi : la réserve peut être vide.
  const c = compte.trim() === "0" ? 0 : lireQuantite(compte, unite);
  const refus = c === null ? (compte.trim() ? `La quantité comptée, en ${UNITE_DE_SAISIE[unite].libelle}` : null) : refusInventaire(c);

  const noter = () => demarrer(async () => {
    if (c === null) return;
    const r = await noterInventaire(ingredient.id, c).catch(() => ({ ok: false as const, erreur: HORS_LIGNE }));
    if (r.ok) onClose(); else setErreur(r.erreur);
  });

  return (
    <Fenetre titre={`Compter : ${ingredient.nom}`} sousTitre={`D'après les livraisons et les sorties, la réserve devrait en avoir ${quantiteLisible(Math.max(0, stock), unite)}`} onClose={onClose}>
      <SField label={`Ce que tu comptes dans la réserve, en ${UNITE_DE_SAISIE[unite].libelle}`} hint={c !== null ? quantiteLisible(c, unite) : "Le stock prendra ce chiffre, et l'écart sera noté"}>
        <SInput inputMode="decimal" className="chiffres" placeholder="12,5" value={compte} onChange={(e) => { setErreur(null); setCompte(e.target.value.slice(0, 12)); }} />
      </SField>
      <div aria-live="polite" className="mt-4 empty:hidden">{(erreur || refus) && <SAlert tone="error">{erreur ?? refus}</SAlert>}</div>
      <SBtn tone="secondary" block className="mt-4" disabled={enCours || c === null || refus !== null} onClick={noter}>
        {enCours ? "Un instant" : "Noter le comptage"}
      </SBtn>
    </Fenetre>
  );
}
