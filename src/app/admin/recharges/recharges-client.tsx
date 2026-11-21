"use client";

import { useEffect, useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import { EnTetePage, Fenetre } from "@/components/fenetre";
import { CheckCircle2, Coins, Info } from "@/components/icons";
import { SAlert, SBtn, SChip, SRecherche, STable, STd, STitreSection, STr } from "@/components/sneat";
import { useDirect } from "@/hooks/use-direct";
import type { VueCompteTrouve, VuePaiementAVerifier, VueRechargeEnAttente, VueRechargePassee, VueRecharges } from "@/lib/donnees-admin";
import { depuis, fcfa } from "@/lib/format";
import { jourIso, jourProche } from "@/lib/jours";
import { LIBELLE_ETAT_RECHARGE, LIBELLE_MOYEN, MONTANTS_RAPIDES, RECHARGE_MAX, RECHARGE_MIN, montantValable } from "@/lib/recharge";
import { heureH } from "@/lib/reservation";
import { chercherConvives, crediterPaiement, encaisserEspeces, paiementRecu, verifierChezCartflox } from "./actions";

// Les recharges, côté cantine, relues toutes les 3 secondes : les demandes en attente (celles payées par Cartflox se
// créditent toutes seules, celles du QR universel attendent « Paiement reçu »), les paiements Cartflox à regarder, les
// espèces encaissées au comptoir, et les vingt dernières recharges closes.

/** « aujourd'hui à 12 h 14 », « hier à 19 h 40 », « mardi 17 novembre à 18 h 05 » */
const quand = (iso: string, maintenant: number) => `${jourProche(jourIso(new Date(iso).getTime()), maintenant)} à ${heureH(iso)}`;

export function RechargesClient({ initial }: { initial: VueRecharges }) {
  const [donnees, recharger] = useDirect<VueRecharges>("/api/admin/recharges", initial, 3000);
  const [especes, setEspeces] = useState(false);
  const [annonce, setAnnonce] = useState("");

  return (
    <div className="w-full space-y-6">
      <EnTetePage titre="Recharges" sousTitre="Les paiements à confirmer, et les espèces du comptoir"
        actions={<SBtn tone="secondary" onClick={() => setEspeces(true)}><Coins className="size-5" strokeWidth={1.8} /><span>Recharge en espèces</span></SBtn>} />

      <SAlert Icon={Info}>
        Les paiements Mobile Money passés par Cartflox se créditent tout seuls. Pour une demande réglée en espèces au comptoir, encaisse
        d&apos;abord, vérifie la référence et le montant, puis dis « Paiement reçu ». Sans demande, passe par « Recharge en espèces ».
      </SAlert>

      {donnees.aVerifier.length > 0 && (
        <section aria-labelledby="titre-a-verifier" className="space-y-3">
          <STitreSection>
            <span id="titre-a-verifier">À regarder</span>
            <span className="chiffres ml-2 text-[14px] font-normal text-texte-2">{donnees.aVerifier.length}</span>
          </STitreSection>
          <p className="text-[14px] leading-5 text-texte-2">Des paiements Cartflox passés mais pas crédités tout seuls. Regarde-les dans ton espace Cartflox avant de créditer</p>
          <ul className="flex flex-col gap-2">
            {donnees.aVerifier.map((p) => (
              <LigneAVerifier key={p.sessionId} p={p} onFait={async (message) => { if (message) setAnnonce(message); await recharger(); }} />
            ))}
          </ul>
        </section>
      )}

      <p className="sr-only" role="status">{annonce}</p>

      <section aria-labelledby="titre-attente" className="space-y-3">
        <STitreSection>
          <span id="titre-attente">En attente</span>
          {donnees.enAttente.length > 0 && <span className="chiffres ml-2 text-[14px] font-normal text-texte-2">{donnees.enAttente.length}</span>}
        </STitreSection>
        {donnees.enAttente.length === 0 ? (
          <p className="rounded-[16px] border border-dashed border-[color:var(--h-filet)] px-4 py-8 text-center text-[14px] leading-5 text-texte-2">
            Aucune demande n&apos;attend. Les prochaines arrivent ici toutes seules
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {donnees.enAttente.map((r) => (
              <LigneEnAttente key={r.id} r={r} maintenant={donnees.maintenant}
                onFait={async (message) => { if (message) setAnnonce(message); await recharger(); }} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="titre-dernieres" className="space-y-3 pt-2">
        <STitreSection><span id="titre-dernieres">Dernières recharges</span></STitreSection>
        {donnees.dernieres.length === 0 ? (
          <p className="rounded-[16px] border border-dashed border-[color:var(--h-filet)] px-4 py-8 text-center text-[14px] leading-5 text-texte-2">
            Aucune recharge pour l&apos;instant
          </p>
        ) : (
          <>
            <div className="sn-card hidden overflow-hidden @4xl/page:block">
              <STable head={["Référence", "Pour", "Montant", "Moyen", "État", "Quand"]}>
                {donnees.dernieres.map((r) => (
                  <STr key={r.id}>
                    <STd className="font-mono whitespace-nowrap text-encre/90">{r.reference}</STd>
                    <STd className="font-medium text-encre/95"><span className="flex items-center gap-2"><Avatar id={r.beneficiaireId} nom={r.beneficiaire} photo={r.photo} taille={24} />{r.beneficiaire}</span></STd>
                    <STd className="chiffres whitespace-nowrap font-medium text-encre/95">{fcfa(r.montant)}</STd>
                    <STd className="whitespace-nowrap">{LIBELLE_MOYEN[r.moyen]}</STd>
                    <STd><EtatRecharge r={r} /></STd>
                    <STd className="chiffres whitespace-nowrap text-texte-2">{quand(r.quand, donnees.maintenant)}</STd>
                  </STr>
                ))}
              </STable>
            </div>
            <ul className="divide-y divide-[color:var(--h-filet)] rounded-[16px] border border-[color:var(--h-filet)] @4xl/page:hidden">
              {donnees.dernieres.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="flex min-w-0 items-center gap-2 text-[14px] leading-5 font-semibold text-encre/95"><Avatar id={r.beneficiaireId} nom={r.beneficiaire} photo={r.photo} taille={24} /><span className="truncate">{r.beneficiaire}</span></p>
                    <p className="truncate text-[13px] leading-5 text-texte-2"><span className="font-mono text-encre/80">{r.reference}</span>, {LIBELLE_MOYEN[r.moyen]}</p>
                    <p className="chiffres truncate text-[13px] leading-5 text-texte-2">{quand(r.quand, donnees.maintenant)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="chiffres text-[14px] leading-5 font-semibold text-encre/95">{fcfa(r.montant)}</span>
                    <EtatRecharge r={r} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {especes && <FenetreEspeces onClose={() => setEspeces(false)} onFait={recharger} />}
    </div>
  );
}

function EtatRecharge({ r }: { r: VueRechargePassee }) {
  return <SChip tone={r.etat === "confirmee" ? "success" : "secondary"} size="sm">{LIBELLE_ETAT_RECHARGE[r.etat]}</SChip>;
}

/* ── Une demande en attente : « Paiement reçu », en deux temps ─────────────── */

/** Ce que dit le dernier paiement Cartflox d'une demande, en mots. */
function etatCartflox(statut: string): { texte: string; ton: "warning" | "error" | "success" | "secondary" } {
  if (statut === "SUCCESS") return { texte: "Payé chez Cartflox", ton: "success" };
  if (["FAILED", "CANCELLED", "EXPIRED", "REFUNDED"].includes(statut)) return { texte: "Paiement Cartflox non abouti", ton: "error" };
  if (statut === "INCONNUE") return { texte: "Inconnu chez Cartflox", ton: "secondary" };
  return { texte: "Paiement Cartflox en cours", ton: "warning" };
}

function LigneEnAttente({ r, maintenant, onFait }: { r: VueRechargeEnAttente; maintenant: number; onFait: (message: string | null) => Promise<void> }) {
  const [aConfirmer, setAConfirmer] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const cartflox = r.cartflox ? etatCartflox(r.cartflox.statut) : null;

  const verifier = () => demarrer(async () => {
    const res = await verifierChezCartflox(r.id);
    setErreur(res.ok ? (res.etat === "confirmee" ? null : "Cartflox n'a pas encore vu ce paiement passer") : res.erreur);
    await onFait(res.ok && res.etat === "confirmee" ? `Recharge ${r.reference} créditée par Cartflox : ${fcfa(r.montant)} pour ${r.beneficiaire}` : null);
  });

  const confirmer = () => demarrer(async () => {
    const res = await paiementRecu(r.id);
    setErreur(res.ok ? null : res.erreur);
    setAConfirmer(false);
    await onFait(res.ok ? `Recharge ${r.reference} confirmée : ${fcfa(r.montant)} pour ${r.beneficiaire}` : null);
  });

  return (
    <li className="rounded-[16px] border border-[color:var(--h-filet)] p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <span className="grid h-12 w-[88px] shrink-0 place-items-center rounded-[12px] bg-[color:var(--h-surface)] font-mono text-[15px] font-medium text-encre/90">{r.reference}</span>
        <div className="min-w-0 flex-1 basis-[180px]">
          <p className="flex min-w-0 items-center gap-2 text-[15px] leading-5 font-semibold text-encre/95"><Avatar id={r.beneficiaireId} nom={r.beneficiaire} photo={r.photo} taille={24} /><span className="truncate">{r.beneficiaire}</span></p>
          <p className="text-[13px] leading-5 text-texte-2">{r.groupe}{r.demandeur ? `, demandée par ${r.demandeur}` : ""}</p>
          {cartflox && <p className="mt-1"><SChip tone={cartflox.ton} size="sm">{cartflox.texte}</SChip></p>}
        </div>
        <div className="shrink-0 @2xl/page:text-right">
          <p className="chiffres text-[18px] leading-6 font-semibold text-encre/95">{fcfa(r.montant)}</p>
          <p className="chiffres text-[13px] leading-5 text-texte-2">{depuis(r.creeLe, maintenant)}</p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {aConfirmer ? (
            <>
              <SBtn tone="secondary" disabled={enCours} onClick={confirmer}>{enCours ? "Un instant" : "Oui, l'argent est arrivé"}</SBtn>
              <SBtn variant="text" tone="secondary" disabled={enCours} onClick={() => setAConfirmer(false)}>Non</SBtn>
            </>
          ) : (
            <>
              {r.cartflox && <SBtn variant="text" tone="secondary" disabled={enCours} onClick={verifier}>{enCours ? "Un instant" : "Vérifier chez Cartflox"}</SBtn>}
              <SBtn variant="outlined" tone="secondary" onClick={() => { setErreur(null); setAConfirmer(true); }}>Paiement reçu</SBtn>
            </>
          )}
        </div>
      </div>
      {r.cartflox?.remarque && <p className="mt-3 text-[13px] leading-5 text-texte-2">{r.cartflox.remarque}</p>}
      {erreur && <p role="alert" className="mt-3 text-[13px] leading-5 text-erreur-texte">{erreur}</p>}
    </li>
  );
}

/* ── Un paiement Cartflox à regarder : « Créditer », en deux temps ─────────── */

function LigneAVerifier({ p, onFait }: { p: VuePaiementAVerifier; onFait: (message: string | null) => Promise<void> }) {
  const [aConfirmer, setAConfirmer] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const crediter = () => demarrer(async () => {
    const res = await crediterPaiement(p.sessionId);
    setErreur(res.ok ? null : res.erreur);
    setAConfirmer(false);
    await onFait(res.ok ? `Recharge ${p.reference} créditée : ${fcfa(p.montant)} pour ${p.beneficiaire}` : null);
  });

  return (
    <li className="rounded-[16px] border border-[color:var(--h-filet)] p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <span className="grid h-12 w-[88px] shrink-0 place-items-center rounded-[12px] bg-[color:var(--h-surface)] font-mono text-[15px] font-medium text-encre/90">{p.reference}</span>
        <div className="min-w-0 flex-1 basis-[220px]">
          <p className="flex min-w-0 items-center gap-2 text-[15px] leading-5 font-semibold text-encre/95"><Avatar id={p.beneficiaireId} nom={p.beneficiaire} photo={p.photo} taille={24} /><span className="truncate">{p.beneficiaire}</span></p>
          <p className="text-[13px] leading-5 text-texte-2">{p.remarque}</p>
          <p className="font-mono text-[12px] leading-5 text-texte-2">Paiement Cartflox {p.sessionId}</p>
        </div>
        <div className="shrink-0 @2xl/page:text-right">
          <p className="chiffres text-[18px] leading-6 font-semibold text-encre/95">{fcfa(p.montant)}</p>
          <p className="chiffres text-[13px] leading-5 text-texte-2">{p.encaisse === null ? "Encaissé : inconnu" : `Encaissé : ${fcfa(p.encaisse)}`}</p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {aConfirmer ? (
            <>
              <SBtn tone="secondary" disabled={enCours} onClick={crediter}>{enCours ? "Un instant" : `Oui, créditer ${fcfa(p.montant)}`}</SBtn>
              <SBtn variant="text" tone="secondary" disabled={enCours} onClick={() => setAConfirmer(false)}>Non</SBtn>
            </>
          ) : (
            <SBtn variant="outlined" tone="secondary" onClick={() => { setErreur(null); setAConfirmer(true); }}>Créditer</SBtn>
          )}
        </div>
      </div>
      {erreur && <p role="alert" className="mt-3 text-[13px] leading-5 text-erreur-texte">{erreur}</p>}
    </li>
  );
}

/* ── La recharge en espèces, au comptoir ───────────────────────────────────── */

type Encaisse = { nom: string; montant: number; reference: string; solde: number };

function FenetreEspeces({ onClose, onFait }: { onClose: () => void; onFait: () => Promise<void> }) {
  const [q, setQ] = useState("");
  const [trouves, setTrouves] = useState<{ q: string; liste: VueCompteTrouve[] } | null>(null);
  const [convive, setConvive] = useState<VueCompteTrouve | null>(null);
  const [saisie, setSaisie] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [fait, setFait] = useState<Encaisse | null>(null);
  const [enCours, demarrer] = useTransition();

  // La recherche part 200 ms après la dernière lettre, à partir de deux lettres.
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
  // Tant que la réponse à ce qui est tapé n'est pas arrivée, on ne montre pas celle d'avant.
  const liste = recherche.length >= 2 && trouves?.q === recherche ? trouves.liste : null;

  const montant = saisie === "" ? null : Number(saisie);
  const montantOk = montant !== null && montantValable(montant);

  const crediter = () => {
    if (!convive || montant === null || !montantOk) return;
    setErreur(null);
    demarrer(async () => {
      const res = await encaisserEspeces({ beneficiaireId: convive.id, montant });
      if (!res.ok) { setErreur(res.erreur); return; }
      setFait({ nom: convive.nom, montant, reference: res.reference, solde: res.solde });
      await onFait();
    });
  };

  const recommencer = () => { setFait(null); setConvive(null); setQ(""); setSaisie(""); setErreur(null); };

  if (fait) {
    return (
      <Fenetre titre="Recharge en espèces" onClose={onClose}>
        <div role="status" className="text-center">
          <CheckCircle2 className="mx-auto size-10" strokeWidth={1.8} style={{ color: "rgb(var(--h-succes-texte))" }} />
          <p className="chiffres mt-3 text-[20px] leading-7 font-semibold text-encre/95">{fcfa(fait.montant)} crédités à {fait.nom}</p>
        </div>
        <dl className="mt-5 divide-y divide-[color:var(--h-filet-doux)] rounded-[16px] bg-[color:var(--h-surface)] px-4 text-[14px] leading-5">
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-texte-2">Référence</dt>
            <dd className="font-mono text-[15px] text-encre/95">{fait.reference}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-texte-2">Nouveau solde</dt>
            <dd className="chiffres text-[15px] font-semibold text-encre/95">{fcfa(fait.solde)}</dd>
          </div>
        </dl>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          <SBtn tone="secondary" className="sm:flex-1" onClick={onClose}>C&apos;est noté</SBtn>
          <SBtn variant="outlined" tone="secondary" onClick={recommencer}>Une autre recharge</SBtn>
        </div>
      </Fenetre>
    );
  }

  return (
    <Fenetre titre="Recharge en espèces" sousTitre="Encaisse d'abord les espèces, puis crédite le compte : le solde monte tout de suite" onClose={onClose}>
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
              <SBtn size="sm" variant="text" tone="secondary" onClick={() => setConvive(null)}>Changer</SBtn>
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

        <div>
          <p className="mb-2 pl-0.5 text-[14px] leading-5 font-semibold text-encre/95">Le montant</p>
          <div className="grid grid-cols-3 gap-2">
            {MONTANTS_RAPIDES.map((m) => {
              const choisi = montant === m;
              return (
                <button key={m} type="button" aria-pressed={choisi} onClick={() => setSaisie(String(m))}
                  className={`chiffres h-12 rounded-[12px] text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--h-marque-texte))] ${choisi ? "bg-[rgb(var(--sn-cta))] text-white" : "bg-surface text-encre/90 shadow-[0_0_0_1px_var(--h-filet)] hover:bg-[color:var(--h-filet-doux)]"}`}>
                  {fcfa(m)}
                </button>
              );
            })}
          </div>
          <label htmlFor="especes-montant" className="mt-4 mb-2 block pl-0.5 text-[14px] leading-5 text-texte-2">Ou un autre montant, en francs CFA</label>
          <input id="especes-montant" inputMode="numeric" autoComplete="off" value={saisie} maxLength={6}
            onChange={(e) => setSaisie(e.target.value.replace(/\D/g, "").replace(/^0+/, ""))}
            aria-invalid={saisie !== "" && !montantOk} aria-describedby="especes-montant-aide" className="h-champ chiffres" />
          <p id="especes-montant-aide" className={`mt-2 pl-0.5 text-[12px] leading-4 ${saisie !== "" && !montantOk ? "text-erreur-texte" : "text-texte-2"}`}>
            Entre {fcfa(RECHARGE_MIN)} et {fcfa(RECHARGE_MAX)}
          </p>
        </div>

        {erreur && <p role="alert" className="text-[14px] leading-5 text-erreur-texte">{erreur}</p>}

        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <SBtn tone="secondary" className="sm:flex-1" disabled={enCours || !convive || !montantOk} onClick={crediter}>
            {enCours ? "Un instant" : montantOk && montant !== null ? `Créditer ${fcfa(montant)}` : "Créditer"}
          </SBtn>
          <SBtn variant="text" tone="secondary" disabled={enCours} onClick={onClose}>Fermer</SBtn>
        </div>
      </div>
    </Fenetre>
  );
}
