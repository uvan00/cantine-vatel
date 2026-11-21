"use client";

import { useEffect, useState, useTransition } from "react";
import { EtiquettesAliments } from "@/components/allergene";
import { Avatar } from "@/components/avatar";
import { Fenetre } from "@/components/fenetre";
import { CheckCircle2 } from "@/components/icons";
import { SBtn, SChip, SField, SInput, SRecherche } from "@/components/sneat";
import type { VueCompteTrouve, VuePlatCommande } from "@/lib/donnees-admin";
import { fcfa } from "@/lib/format";
import type { Etiquette } from "@/lib/listes";
import { enKilos, lireKilos, parRepas, poidsLisible } from "@/lib/restes";
import { servirTicket } from "../actions";
import { chercherConvives } from "../recharges/actions";
import { peserLesRestes, reserverPourConvive } from "./actions";

// Les deux fenêtres de la page des commandes : peser les restes d'un plat, et réserver pour un convive au comptoir.
// L'écran vérifie la saisie pour dire tout de suite ce qui cloche ; le serveur revérifie tout (./actions.ts).

function Erreur({ children }: { children: React.ReactNode }) {
  return <p role="alert" className="text-[14px] leading-5 text-erreur-texte">{children}</p>;
}

/* ── Peser les restes ──────────────────────────────────────────────────────── */

export function FenetreRestes({ plat, onClose, onFait }: { plat: VuePlatCommande; onClose: () => void; onFait: () => Promise<void> }) {
  const [saisie, setSaisie] = useState(plat.restes === null ? "" : enKilos(plat.restes));
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const grammes = saisie.trim() === "" ? null : lireKilos(saisie);
  const lisible = saisie.trim() === "" || grammes !== null;
  const apercu = grammes === null ? null : parRepas(grammes, plat.servis);

  const envoyer = (kilos: string) => {
    setErreur(null);
    demarrer(async () => {
      const r = await peserLesRestes({ menuJourId: plat.id, kilos });
      if (!r.ok) { setErreur(r.erreur); return; }
      await onFait();
      onClose();
    });
  };

  return (
    <Fenetre titre={`Restes : ${plat.nom}`} sousTitre="Pèse ce qui revient en cuisine après le service : c'est le gaspillage qui se mesure" onClose={onClose}>
      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); if (lisible && saisie.trim() !== "") envoyer(saisie); }}>
        <SField label="Poids des restes" hint="En kilos, comme sur la balance : 1,3 ou 0,45">
          <SInput inputMode="decimal" autoComplete="off" autoFocus value={saisie} onChange={(e) => setSaisie(e.target.value)} aria-invalid={!lisible} placeholder="1,3" />
        </SField>
        {!lisible ? (
          <Erreur>Un poids en kilos, avec une virgule si besoin : 1,3 ou 0,45</Erreur>
        ) : grammes !== null ? (
          <p className="chiffres text-[14px] leading-5 text-texte-2">
            {poidsLisible(grammes)}{apercu === null ? ", aucun repas servi pour l'instant" : `, soit ${poidsLisible(apercu)} par repas servi`}
          </p>
        ) : null}
        {erreur && <Erreur>{erreur}</Erreur>}
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <SBtn type="submit" tone="secondary" className="sm:flex-1" disabled={enCours || !lisible || saisie.trim() === ""}>{enCours ? "Un instant" : "Enregistrer la pesée"}</SBtn>
          {plat.restes !== null && <SBtn type="button" variant="outlined" tone="secondary" disabled={enCours} onClick={() => envoyer("")}>Effacer la pesée</SBtn>}
        </div>
      </form>
    </Fenetre>
  );
}

/* ── Réserver pour un convive ──────────────────────────────────────────────── */

type Reserve = { nom: string; plat: string; code: string };

export function FenetreReserverPour({ plats, aujourdhui, onClose, onFait }: {
  plats: VuePlatCommande[]; aujourdhui: boolean; onClose: () => void; onFait: () => Promise<void>;
}) {
  const [q, setQ] = useState("");
  const [trouves, setTrouves] = useState<{ q: string; liste: VueCompteTrouve[] } | null>(null);
  const [convive, setConvive] = useState<VueCompteTrouve | null>(null);
  const [platId, setPlatId] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCause, setEnCause] = useState<Etiquette[]>([]);
  const [fait, setFait] = useState<Reserve | null>(null);
  const [servi, setServi] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  // La recherche part 200 ms après la dernière lettre, à partir de deux lettres (comme pour la recharge en espèces).
  const recherche = q.trim();
  useEffect(() => {
    if (recherche.length < 2) return;
    let depasse = false;
    const minuterie = window.setTimeout(() => {
      chercherConvives(recherche)
        .then((liste) => { if (!depasse) setTrouves({ q: recherche, liste }); })
        .catch(() => { if (!depasse) setTrouves({ q: recherche, liste: [] }); });
    }, 200);
    return () => { depasse = true; window.clearTimeout(minuterie); };
  }, [recherche]);
  const liste = recherche.length >= 2 && trouves?.q === recherche ? trouves.liste : null;

  const reserver = () => {
    if (!convive || !platId) return;
    setErreur(null);
    setEnCause([]);
    demarrer(async () => {
      const r = await reserverPourConvive({ conviveId: convive.id, menuJourId: platId });
      if (!r.ok) { setErreur(r.erreur); setEnCause(r.enCause ?? []); return; }
      setFait({ nom: convive.nom, plat: r.plat, code: r.code });
      await onFait();
    });
  };

  const servirMaintenant = () => {
    if (!fait) return;
    demarrer(async () => {
      const r = await servirTicket(fait.code);
      setServi(r.phrase);
      await onFait();
    });
  };

  if (fait) {
    return (
      <Fenetre titre="Réserver pour un convive" onClose={onClose}>
        <div role="status" className="text-center">
          <CheckCircle2 className="mx-auto size-10" strokeWidth={1.8} style={{ color: "rgb(var(--h-succes-texte))" }} />
          <p className="mt-3 text-[20px] leading-7 font-semibold text-encre/95">{fait.plat} pour {fait.nom}</p>
          <p className="mt-1 text-[14px] leading-5 text-texte-2">Payé sur son compte, comme s&apos;il avait réservé lui-même</p>
        </div>
        <dl className="mt-5 rounded-[16px] bg-[color:var(--h-surface)] px-4 text-[14px] leading-5">
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-texte-2">Code du ticket</dt>
            <dd className="font-mono text-[17px] tracking-wider text-encre/95">{fait.code}</dd>
          </div>
        </dl>
        {servi && <p role="status" className="mt-4 text-center text-[15px] leading-5 font-semibold text-encre/95">{servi}</p>}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          {aujourdhui && !servi && <SBtn tone="secondary" className="sm:flex-1" disabled={enCours} onClick={servirMaintenant}>{enCours ? "Un instant" : "Servir maintenant"}</SBtn>}
          <SBtn variant={aujourdhui && !servi ? "outlined" : "elevated"} tone="secondary" className={aujourdhui && !servi ? "" : "sm:flex-1"} onClick={onClose}>C&apos;est noté</SBtn>
        </div>
      </Fenetre>
    );
  }

  return (
    <Fenetre titre="Réserver pour un convive"
      sousTitre="Pour celui qui n'a pas son téléphone, jusqu'à la clôture comme tout le monde. Le repas est payé sur son compte, avec les mêmes règles que s'il réservait lui-même"
      onClose={onClose}>
      <div className="space-y-6">
        <div>
          <p className="mb-2 pl-0.5 text-[14px] leading-5 font-semibold text-encre/95">Le convive</p>
          {convive ? (
            <div className="flex items-center gap-3 rounded-[12px] p-3 shadow-[0_0_0_1px_var(--h-filet)]">
              <Avatar id={convive.id} nom={convive.nom} photo={convive.photo} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] leading-5 font-semibold text-encre/95">{convive.nom}</p>
                <p className="chiffres truncate text-[13px] leading-5 text-texte-2">{convive.groupe}, solde de {fcfa(convive.solde)}</p>
              </div>
              <SBtn size="sm" variant="text" tone="secondary" onClick={() => { setConvive(null); setErreur(null); }}>Changer</SBtn>
            </div>
          ) : (
            <>
              <SRecherche value={q} onChange={setQ} placeholder="Son nom ou son prénom" label="Chercher un convive par son nom" />
              {recherche.length < 2 ? (
                <p className="mt-2 pl-0.5 text-[12px] leading-4 text-texte-2">Deux lettres suffisent pour chercher</p>
              ) : liste === null ? (
                <p className="mt-3 pl-0.5 text-[14px] leading-5 text-texte-2">On cherche</p>
              ) : liste.length === 0 ? (
                <p className="mt-3 pl-0.5 text-[14px] leading-5 text-texte-2">Personne à ce nom parmi les élèves et les employés</p>
              ) : (
                <ul className="mt-2 divide-y divide-[color:var(--h-filet-doux)]">
                  {liste.map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => setConvive(c)}
                        className="-mx-2 flex w-[calc(100%+16px)] items-center justify-between gap-3 rounded-[12px] px-2 py-2 text-left transition-colors hover:bg-[color:var(--h-filet-doux)] focus-visible:outline-2 focus-visible:outline-[rgb(var(--h-marque-texte))]">
                        <span className="flex min-w-0 items-center gap-3">
                          <Avatar id={c.id} nom={c.nom} photo={c.photo} taille={32} />
                          <span className="min-w-0">
                            <span className="block truncate text-[14px] leading-5 font-semibold text-encre/95">{c.nom}</span>
                            <span className="block truncate text-[13px] leading-5 text-texte-2">{c.groupe}</span>
                          </span>
                        </span>
                        <span className="chiffres shrink-0 text-[13px] leading-5 text-texte-2">{fcfa(c.solde)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        <fieldset>
          <legend className="mb-2 pl-0.5 text-[14px] leading-5 font-semibold text-encre/95">Le plat</legend>
          <div className="flex flex-col gap-2">
            {plats.map((p) => {
              const ferme = p.epuise || p.complet;
              const choisi = platId === p.id;
              return (
                <label key={p.id}
                  className={`flex items-center gap-3 rounded-[12px] px-3 py-3 text-[15px] leading-5 ${ferme ? "opacity-60" : "cursor-pointer"}`}
                  style={{ boxShadow: choisi ? "inset 0 0 0 2px rgb(var(--h-marque-texte))" : "inset 0 0 0 1px var(--h-filet)" }}>
                  <input type="radio" name="plat" value={p.id} checked={choisi} disabled={ferme} onChange={() => { setPlatId(p.id); setErreur(null); }} className="size-4 accent-[rgb(var(--h-marque-texte))]" />
                  <span className="min-w-0 flex-1 truncate text-encre/95">{p.nom}</span>
                  {p.epuise ? <SChip tone="warning" size="sm">Épuisé</SChip> : p.complet ? <SChip tone="secondary" size="sm">Complet</SChip> : null}
                </label>
              );
            })}
          </div>
        </fieldset>

        {erreur && <Erreur>{erreur}</Erreur>}
        {/* Un plat écarté par le profil du convive : ce qui l'écarte, le dessin à côté du nom. */}
        {erreur && <EtiquettesAliments etiquettes={enCause} taille={20} className="text-[14px] leading-5 text-encre/90" />}
        <SBtn tone="secondary" block disabled={enCours || !convive || !platId} onClick={reserver}>{enCours ? "Un instant" : "Réserver et payer sur son compte"}</SBtn>
      </div>
    </Fenetre>
  );
}
