"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DessinAliment, EtiquettesAliments } from "@/components/allergene";
import { EtatRepas } from "@/components/etat-repas";
import { Fenetre } from "@/components/fenetre";
import { AlertTriangle, CheckCircle2, Star } from "@/components/icons";
import { PhotoPlat } from "@/components/photo-plat";
import { SAlert, SBtn, SChip } from "@/components/sneat";
import { creneauLisible, type EtatCreneau } from "@/lib/creneaux";
import type { DemandeDuJour } from "@/lib/donnees-convive";
import { fcfa, pluriel } from "@/lib/format";
import { REGIMES, type Etiquette } from "@/lib/listes";
import { nomDeLaFile, paiementLisible, type EtatAffiche, type Refus } from "@/lib/reservation";
import { basculerMonFavori, demanderRepas, reserverPlat } from "./actions";
import { RATE, useAnnulation } from "./annulation";

// Le jour choisi : le repas déjà réservé s'il y en a un, puis les plats en cartes blanches. Tout ce qui se décide
// (le prix, ce qui reste, la raison d'un refus, le solde après) arrive déjà calculé par le serveur : ici on affiche.

export type CartePlat = {
  /** Le plat au menu de ce jour : c'est cet identifiant qu'on réserve. */
  id: string;
  /** Le plat lui-même, pour l'étoile des favoris. */
  platId: string;
  favori: boolean;
  /** Arrivé à la carte il y a moins de deux semaines (src/lib/favoris.ts). */
  nouveau: boolean;
  nom: string;
  description: string;
  photo: string;
  prix: number;
  /** Ce que la cantine a déclaré (allergènes, puis le porc), en étiquettes. Vide : rien de déclaré. */
  etiquettes: Etiquette[];
  /** Ce qui écarte ce plat pour ce convive (etiquettesEnCause). Vide : rien dans son profil ne l'écarte. */
  enCause: Etiquette[];
  vegetarien: boolean;
  /** « 4,6 », ou null tant que personne n'a noté ce plat. */
  note: string | null;
  avis: number;
  /** Portions encore libres ; null : la cantine ne les compte pas. */
  restantes: number | null;
  /** Le solde du convive s'il réserve ce plat. */
  soldeApres: number;
  /** Pourquoi ce plat ne se paie pas maintenant avec le solde (peutReserver de src/lib/reservation.ts) ; null : il se paie. */
  refus: { genre: Refus; phrase: string } | null;
  /** Pourquoi il ne se réserve pas non plus pour payer au comptoir (la même règle, sans regarder le solde) ; null : il se réserve. */
  refusAuComptoir: { genre: Refus; phrase: string } | null;
  /** Clos aujourd'hui, mais la cantine peut encore accepter une demande pour ce plat (peutDemanderHorsDelai). */
  demandable: boolean;
};

export type MonRepas = { id: string; jeton: string; plat: string; prix: number; etat: EtatAffiche; annulable: boolean; creneau: string | null; paiement: string; file: string };

export function MenuDuJour({ jourEnLettres, clotureLisible, solde, plats, repas, creneaux, demande }: {
  /** « vendredi 20 novembre » */
  jourEnLettres: string;
  /** « 9 h » */
  clotureLisible: string;
  solde: number;
  plats: CartePlat[];
  repas: MonRepas | null;
  /** Les heures de passage et leurs places, quand la cantine a ouvert des créneaux ; null sinon. */
  creneaux: EtatCreneau[] | null;
  /** La demande hors délai de ce jour, s'il y en a une. */
  demande: DemandeDuJour | null;
}) {
  const [choix, setChoix] = useState<CartePlat | null>(null);
  // Payer au comptoir (file réservation) plutôt que maintenant avec son solde (file express).
  const [auComptoir, setAuComptoir] = useState(false);
  const [creneau, setCreneau] = useState<string | null>(null);
  const [erreurDemande, setErreurDemande] = useState<string | null>(null);
  const [refus, setRefus] = useState<string | null>(null);
  const [rembourse, setRembourse] = useState<number | null>(null);
  const [envoi, lancer] = useTransition();
  const annulation = useAnnulation();
  const router = useRouter();

  // Le solde ne suffit pas (ou le plafond bloque) : le choix part sur « au comptoir », le seul possible.
  const ouvrir = (p: CartePlat) => { setRefus(null); setRembourse(null); setCreneau(null); setAuComptoir(p.refus !== null); setChoix(p); };
  const fermer = () => { if (!envoi) setChoix(null); };
  const reserver = () => {
    if (!choix) return;
    lancer(async () => {
      // Réservé : on ouvre le ticket. Refusé : le serveur rend sa raison, en une phrase.
      if (creneaux && !creneau) { setRefus("Choisis ton heure de passage"); return; }
      try {
        const r = await reserverPlat(choix.id, creneaux ? creneau : null, auComptoir);
        if (r.ok) router.push(`/ticket/${r.jeton}`); else setRefus(r.erreur);
      } catch {
        setRefus(RATE);
      }
    });
  };

  /** Après la clôture : la demande part à la cantine, qui accepte ou refuse. */
  const demander = (p: CartePlat) => {
    setErreurDemande(null);
    lancer(async () => {
      try {
        const r = await demanderRepas(p.id);
        // La réponse s'affiche en haut de la liste : on y remonte, sinon elle reste hors de l'écran du téléphone.
        if (r.ok) { router.refresh(); window.scrollTo({ top: 0, behavior: "smooth" }); } else setErreurDemande(r.erreur);
      } catch {
        setErreurDemande(RATE);
      }
    });
  };

  return (
    <div className="space-y-4">
      <div aria-live="polite" className="space-y-4 empty:hidden">
        {demande && (demande.etat === "acceptee" || !repas) && <ReponseDemande demande={demande} />}
        {erreurDemande && <SAlert tone="error" Icon={AlertTriangle}>{erreurDemande}</SAlert>}
        {rembourse !== null && !repas && (
          <SAlert tone="success" Icon={CheckCircle2}>
            {rembourse > 0 ? <>Repas annulé, <span className="chiffres">{fcfa(rembourse)}</span> sont revenus sur ton solde</> : "Repas annulé, tu n'avais rien payé"}
          </SAlert>
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
          <p className="chiffres mt-1 text-[14px] leading-5 text-texte-2">{fcfa(repas.prix)}, {paiementLisible(repas.paiement, repas.etat).toLowerCase()}</p>
          {repas.etat === "reservee" && <p className="mt-1 text-[14px] leading-5 font-medium text-encre/90">{nomDeLaFile(repas.file)}</p>}
          {repas.creneau && <p className="chiffres mt-1 text-[14px] leading-5 text-encre/90">Passage à {creneauLisible(repas.creneau)}</p>}
          <div className="mt-4 flex gap-2">
            <Link href={`/ticket/${repas.jeton}`} className="hb hb--encre min-w-0 flex-1">Voir mon ticket</Link>
            {repas.annulable && (
              <SBtn variant="outlined" disabled={annulation.enCours}
                onClick={() => annulation.annuler(repas, () => setRembourse(repas.paiement === "a_payer" ? 0 : repas.prix))}>
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
              <div className="relative">
                {/* Grisé seulement quand le plat ne se réserve d'aucune façon : un solde trop court laisse « Au comptoir ». */}
                <PhotoPlat photo={p.photo} nom={p.nom} className={p.refusAuComptoir ? "opacity-60 grayscale" : ""} />
                <Etoile platId={p.platId} nom={p.nom} favori={p.favori} />
              </div>
              <div className="p-4">
                <div className={`flex items-start justify-between gap-3 ${p.refusAuComptoir ? "opacity-70" : ""}`}>
                  <h3 className="min-w-0 text-[18px] leading-6">{p.nom}</h3>
                  <p className="chiffres shrink-0 text-[16px] leading-6 font-medium text-encre/95">{fcfa(p.prix)}</p>
                </div>
                {p.description && <p className="mt-1 text-[14px] leading-5 text-texte-2">{p.description}</p>}
                {(p.etiquettes.length > 0 || p.vegetarien || p.nouveau) && (
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[14px] leading-5 text-encre/90">
                    {p.etiquettes.length > 0 && (
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <span className="text-texte-2">Contient</span>
                        <EtiquettesAliments etiquettes={p.etiquettes} />
                      </p>
                    )}
                    {p.nouveau && <SChip size="sm">Nouveau</SChip>}
                    {p.vegetarien && <SChip tone="secondary" size="sm"><DessinAliment image={VEGETARIEN} taille={16} />Végétarien</SChip>}
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
                  {p.demandable && !demande
                    ? <SBtn variant="outlined" tone="secondary" block disabled={envoi} onClick={() => demander(p)}>Demander ce repas</SBtn>
                    : p.refusAuComptoir ? <Raison refus={p.refusAuComptoir} enCause={p.enCause} /> : <SBtn tone="secondary" block onClick={() => ouvrir(p)}>Réserver</SBtn>}
                </div>
              </div>
            </article>
          </li>
        ))}
      </ul>

      {choix && (
        <Fenetre titre="Réserver ce plat" sousTitre="Paie maintenant avec ton solde, ou au comptoir quand on scanne ton ticket" onClose={fermer}>
          <dl className="text-[15px] leading-5">
            <Ligne nom="Plat">{choix.nom}</Ligne>
            <Ligne nom="Jour">{jourEnLettres}</Ligne>
            <Ligne nom="Prix">{fcfa(choix.prix)}</Ligne>
            <Ligne nom="Ton solde">{fcfa(solde)}</Ligne>
            {!auComptoir && <Ligne nom="Solde après" fort>{fcfa(choix.soldeApres)}</Ligne>}
          </dl>
          <fieldset className="mt-4">
            <legend className="mb-2 text-[14px] leading-5 font-semibold text-encre/95">Comment tu paies</legend>
            <div className="grid grid-cols-2 gap-2">
              {([
                { comptoir: false, titre: "Maintenant", detail: choix.refus ? choix.refus.phrase : "Avec ton solde", file: "File express", bloque: choix.refus !== null },
                { comptoir: true, titre: "Au comptoir", detail: "Espèces, Mobile Money ou ton solde", file: "File réservation", bloque: false },
              ]).map((o) => {
                const ici = auComptoir === o.comptoir;
                return (
                  <button key={o.titre} type="button" disabled={o.bloque} aria-pressed={ici} onClick={() => { setAuComptoir(o.comptoir); setRefus(null); }}
                    className={`flex min-h-[88px] flex-col items-start justify-center rounded-[12px] px-3 py-2 text-left transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--h-marque-texte))] ${ici ? "bg-[rgb(var(--sn-cta))] text-white" : "bg-surface text-encre/90 shadow-[0_0_0_1px_var(--h-filet)]"}`}>
                    <span className="text-[15px] leading-5 font-semibold">{o.titre}</span>
                    <span className={`text-[12px] leading-4 ${ici ? "text-white/75" : "text-texte-2"}`}>{o.detail}</span>
                    <span className={`mt-1 text-[12px] leading-4 font-medium ${ici ? "text-white/90" : "text-encre/80"}`}>{o.file}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
          {creneaux && (
            <fieldset className="mt-4">
              <legend className="mb-2 text-[14px] leading-5 font-semibold text-encre/95">Ton heure de passage</legend>
              <div className="grid grid-cols-3 gap-2">
                {creneaux.map((c) => {
                  const ici = creneau === c.heure;
                  return (
                    <button key={c.heure} type="button" disabled={c.complet} aria-pressed={ici} onClick={() => { setCreneau(c.heure); setRefus(null); }}
                      className={`chiffres flex h-14 flex-col items-center justify-center rounded-[12px] text-[15px] leading-5 font-medium transition-colors disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--h-marque-texte))] ${ici ? "bg-[rgb(var(--sn-cta))] text-white" : "bg-surface text-encre/90 shadow-[0_0_0_1px_var(--h-filet)]"}`}>
                      {creneauLisible(c.heure)}
                      <span className={`text-[12px] leading-4 font-normal ${ici ? "text-white/75" : "text-texte-2"}`}>{c.complet ? "complet" : c.libres < 10 ? `${c.libres} place${c.libres > 1 ? "s" : ""}` : "libre"}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
          <p className="mt-4 text-[14px] leading-5 text-texte-2">
            {auComptoir
              ? <>Tu peux annuler jusqu&apos;à {clotureLisible} ce jour-là. Après, la cuisine a compté ton repas : viens le chercher</>
              : <>Tu peux annuler jusqu&apos;à {clotureLisible} ce jour-là : le prix revient sur ton solde tout de suite</>}
          </p>
          <div aria-live="polite" className="mt-4 empty:hidden">{refus && <SAlert tone="error" Icon={AlertTriangle}>{refus}</SAlert>}</div>
          <SBtn tone="secondary" block className="mt-4 min-h-12 text-[16px]" disabled={envoi} onClick={reserver}>
            {envoi ? "Réservation en cours" : auComptoir ? "Réserver, je paie au comptoir" : <span className="chiffres">Réserver pour {fcfa(choix.prix)}</span>}
          </SBtn>
        </Fenetre>
      )}
      {annulation.fenetre}
    </div>
  );
}

/** L'étoile d'un plat : pleine quand il est en favori. Elle change tout de suite, le serveur suit. */
function Etoile({ platId, nom, favori }: { platId: string; nom: string; favori: boolean }) {
  const [affiche, afficher] = useOptimistic(favori, (_: boolean, v: boolean) => v);
  const [, lancer] = useTransition();
  const toucher = () => lancer(async () => {
    afficher(!affiche);
    await basculerMonFavori(platId).catch(() => null);
  });
  return (
    <button type="button" aria-pressed={affiche} aria-label={`${nom} en favori`} title={affiche ? "Retirer de tes favoris" : "Mettre en favori"} onClick={toucher}
      className={`absolute top-3 right-3 grid size-10 place-items-center rounded-full bg-white shadow-[0_0_0_1px_var(--h-filet)] transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--h-marque-texte))] ${affiche ? "text-marque-texte" : "text-encre/70"}`}>
      <Star className="size-5" strokeWidth={1.8} fill={affiche ? "currentColor" : "none"} aria-hidden="true" />
    </button>
  );
}

/** La réponse de la cantine à la demande hors délai : en attente, acceptée (avec le ticket), ou refusée. */
function ReponseDemande({ demande }: { demande: DemandeDuJour }) {
  if (demande.etat === "acceptee") {
    return (
      <SAlert tone="success" Icon={CheckCircle2}>
        La cantine a accepté : {demande.plat}, payé avec ton solde.{" "}
        {demande.jeton && <Link href={`/ticket/${demande.jeton}`} className="font-medium underline underline-offset-4">Voir mon ticket</Link>}
      </SAlert>
    );
  }
  if (demande.etat === "refusee") return <SAlert tone="warning">La cantine n&apos;a pas pu accepter ta demande pour {demande.plat}. Rien n&apos;a été payé</SAlert>;
  return <SAlert tone="info">Ta demande pour {demande.plat} est partie : la cantine te répond ici. Rien n&apos;est payé avant</SAlert>;
}

/** Le dessin du régime végétarien, pour la pastille du plat (le nom est écrit à côté). */
const VEGETARIEN = REGIMES.find((r) => r.id === "vegetarien")?.image ?? "";

/**
 * À la place du bouton : la raison pour laquelle ce plat ne se réserve pas, en une phrase. Écarté par le profil, la
 * phrase est suivie de ce qui l'écarte, en étiquettes.
 */
function Raison({ refus, enCause }: { refus: NonNullable<CartePlat["refus"]>; enCause: Etiquette[] }) {
  const profil = refus.genre === "profil";
  return (
    <div className="flex min-h-10 items-center gap-3 rounded-[12px] px-3 py-2 text-[14px] leading-5 text-encre/90"
      style={{ background: profil ? "rgb(var(--h-alerte-teinte) / 0.15)" : "var(--h-surface)" }}>
      {profil && <AlertTriangle className="size-5 shrink-0 self-start text-attente-texte" strokeWidth={1.8} aria-hidden="true" />}
      <div className="min-w-0 flex-1">
        <p className="chiffres">{refus.phrase}</p>
        {profil && <EtiquettesAliments etiquettes={enCause} className="mt-2" />}
      </div>
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
