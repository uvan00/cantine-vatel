"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EtatRepas } from "@/components/etat-repas";
import { Fenetre } from "@/components/fenetre";
import { AlertTriangle, CheckCircle2, Star } from "@/components/icons";
import { PhotoPlat } from "@/components/photo-plat";
import { SAlert, SBtn, SChip } from "@/components/sneat";
import { fcfa, pluriel } from "@/lib/format";
import type { EtatAffiche, Refus } from "@/lib/reservation";
import { reserverPlat } from "./actions";
import { RATE, useAnnulation } from "./annulation";

// Le jour choisi : le repas déjà réservé s'il y en a un, puis les plats en cartes blanches. Tout ce qui se décide
// (le prix, ce qui reste, la raison d'un refus, le solde après) arrive déjà calculé par le serveur : ici on affiche.

export type CartePlat = {
  /** Le plat au menu de ce jour : c'est cet identifiant qu'on réserve. */
  id: string;
  nom: string;
  description: string;
  photo: string;
  prix: number;
  /** Ce que la cantine a déclaré, déjà mis en phrase (« poisson et œuf »). Vide : rien de déclaré. */
  contient: string;
  vegetarien: boolean;
  /** « 4,6 », ou null tant que personne n'a noté ce plat. */
  note: string | null;
  avis: number;
  /** Portions encore libres ; null : la cantine ne les compte pas. */
  restantes: number | null;
  /** Le solde du convive s'il réserve ce plat. */
  soldeApres: number;
  /** Pourquoi ce plat ne se réserve pas (peutReserver de src/lib/reservation.ts) ; null : il se réserve. */
  refus: { genre: Refus; phrase: string } | null;
};

export type MonRepas = { id: string; jeton: string; plat: string; prix: number; etat: EtatAffiche; annulable: boolean };

export function MenuDuJour({ jourEnLettres, clotureLisible, solde, plats, repas }: {
  /** « vendredi 20 novembre » */
  jourEnLettres: string;
  /** « 9 h » */
  clotureLisible: string;
  solde: number;
  plats: CartePlat[];
  repas: MonRepas | null;
}) {
  const [choix, setChoix] = useState<CartePlat | null>(null);
  const [refus, setRefus] = useState<string | null>(null);
  const [rembourse, setRembourse] = useState<number | null>(null);
  const [envoi, lancer] = useTransition();
  const annulation = useAnnulation();
  const router = useRouter();

  const ouvrir = (p: CartePlat) => { setRefus(null); setRembourse(null); setChoix(p); };
  const fermer = () => { if (!envoi) setChoix(null); };
  const reserver = () => {
    if (!choix) return;
    lancer(async () => {
      // Réservé : on ouvre le ticket. Refusé : le serveur rend sa raison, en une phrase.
      try {
        const r = await reserverPlat(choix.id);
        if (r.ok) router.push(`/ticket/${r.jeton}`); else setRefus(r.erreur);
      } catch {
        setRefus(RATE);
      }
    });
  };

  return (
    <div className="space-y-4">
      <div aria-live="polite" className="space-y-4 empty:hidden">
        {rembourse !== null && !repas && (
          <SAlert tone="success" Icon={CheckCircle2}>Repas annulé, <span className="chiffres">{fcfa(rembourse)}</span> sont revenus sur ton solde</SAlert>
        )}
        {annulation.erreur && <SAlert tone="error" Icon={AlertTriangle}>{annulation.erreur}</SAlert>}
      </div>

      {repas && (
        <section aria-label="Ton repas" className="rounded-[16px] bg-[color:var(--h-fond-2)] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[14px] leading-5 font-medium text-texte-2">Ton repas</p>
            <EtatRepas etat={repas.etat} taille="sm" />
          </div>
          <h3 className="mt-2 text-[18px] leading-6">{repas.plat}</h3>
          <p className="chiffres mt-1 text-[14px] leading-5 text-texte-2">{fcfa(repas.prix)}, payé avec ton solde</p>
          <div className="mt-4 flex gap-2">
            <Link href={`/ticket/${repas.jeton}`} className="hb hb--encre min-w-0 flex-1">Voir mon ticket</Link>
            {repas.annulable && (
              <SBtn variant="outlined" disabled={annulation.enCours}
                onClick={() => annulation.annuler(repas, () => setRembourse(repas.prix))}>
                Annuler
              </SBtn>
            )}
          </div>
        </section>
      )}

      <ul className="space-y-4">
        {plats.map((p) => (
          <li key={p.id}>
            <article className="overflow-hidden rounded-[16px] border border-[color:var(--h-filet)] bg-surface">
              <PhotoPlat photo={p.photo} nom={p.nom} className={p.refus ? "opacity-60 grayscale" : ""} />
              <div className="p-4">
                <div className={`flex items-start justify-between gap-3 ${p.refus ? "opacity-70" : ""}`}>
                  <h3 className="min-w-0 text-[18px] leading-6">{p.nom}</h3>
                  <p className="chiffres shrink-0 text-[16px] leading-6 font-medium text-encre/95">{fcfa(p.prix)}</p>
                </div>
                {p.description && <p className="mt-1 text-[14px] leading-5 text-texte-2">{p.description}</p>}
                {(p.contient || p.vegetarien) && (
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[14px] leading-5 text-encre/90">
                    {p.contient && <p>Contient : {p.contient}</p>}
                    {p.vegetarien && <SChip tone="secondary" size="sm">Végétarien</SChip>}
                  </div>
                )}
                {(p.note !== null || (p.restantes !== null && p.restantes > 0)) && (
                  <div className="chiffres mt-3 flex items-center justify-between gap-3 text-[14px] leading-5 text-texte-2">
                    {p.note !== null ? (
                      <p className="flex items-center gap-1">
                        <Star className="size-4" strokeWidth={1.8} aria-hidden="true" />
                        <span className="sr-only">Note moyenne</span>
                        <span className="font-medium text-encre/90">{p.note}</span>
                        <span className="sr-only">sur 5,</span>
                        <span className="ml-1">{pluriel(p.avis, "avis", "avis")}</span>
                      </p>
                    ) : <span />}
                    {p.restantes !== null && p.restantes > 0 && <p>Il en reste {p.restantes.toLocaleString("fr-FR")}</p>}
                  </div>
                )}
                <div className="mt-4">
                  {p.refus ? <Raison refus={p.refus} /> : <SBtn tone="secondary" block onClick={() => ouvrir(p)}>Réserver</SBtn>}
                </div>
              </div>
            </article>
          </li>
        ))}
      </ul>

      {choix && (
        <Fenetre titre="Réserver ce plat" sousTitre="Réserver, c'est payer : le prix part de ton solde tout de suite" onClose={fermer}>
          <dl className="text-[15px] leading-5">
            <Ligne nom="Plat">{choix.nom}</Ligne>
            <Ligne nom="Jour">{jourEnLettres}</Ligne>
            <Ligne nom="Prix">{fcfa(choix.prix)}</Ligne>
            <Ligne nom="Ton solde">{fcfa(solde)}</Ligne>
            <Ligne nom="Solde après" fort>{fcfa(choix.soldeApres)}</Ligne>
          </dl>
          <p className="mt-4 text-[14px] leading-5 text-texte-2">Tu peux annuler jusqu&apos;à {clotureLisible} ce jour-là : le prix revient sur ton solde tout de suite</p>
          <div aria-live="polite" className="mt-4 empty:hidden">{refus && <SAlert tone="error" Icon={AlertTriangle}>{refus}</SAlert>}</div>
          <SBtn tone="secondary" block className="mt-4 min-h-12 text-[16px]" disabled={envoi} onClick={reserver}>
            {envoi ? "Réservation en cours" : <span className="chiffres">Réserver pour {fcfa(choix.prix)}</span>}
          </SBtn>
        </Fenetre>
      )}
      {annulation.fenetre}
    </div>
  );
}

/** À la place du bouton : la raison pour laquelle ce plat ne se réserve pas, en une phrase. */
function Raison({ refus }: { refus: NonNullable<CartePlat["refus"]> }) {
  const profil = refus.genre === "profil";
  return (
    <div className="flex min-h-10 items-center gap-3 rounded-[12px] px-3 py-2 text-[14px] leading-5 text-encre/90"
      style={{ background: profil ? "rgb(var(--h-alerte-teinte) / 0.15)" : "var(--h-surface)" }}>
      {profil && <AlertTriangle className="size-5 shrink-0 text-attente-texte" strokeWidth={1.8} aria-hidden="true" />}
      <p className="chiffres min-w-0 flex-1">{refus.phrase}</p>
      {refus.genre === "solde" && (
        <Link href="/recharger" className="shrink-0 rounded-[8px] px-1 font-medium text-marque-texte underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-[rgb(var(--h-marque-texte))]">Recharger</Link>
      )}
    </div>
  );
}

function Ligne({ nom, fort = false, children }: { nom: string; fort?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 border-b border-[color:var(--h-filet)] py-2 last:border-b-0">
      <dt className="shrink-0 text-texte-2">{nom}</dt>
      <dd className={`chiffres min-w-0 text-right text-encre/95 ${fort ? "font-semibold" : ""}`}>{children}</dd>
    </div>
  );
}
