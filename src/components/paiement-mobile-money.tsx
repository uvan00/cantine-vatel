"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Loader2, Smartphone } from "@/components/icons";
import { SAlert, SBtn, SField, SInput } from "@/components/sneat";
import { ouvrirPaiement, payerParMobileMoney, verifierMonPaiement } from "@/app/(espace)/recharger/actions";
import { CODE_ORANGE_CI, telephoneIvoirien, type Operateur } from "@/lib/mobile-money";
import { fcfa } from "@/lib/format";

// LE PAIEMENT NATIF, comme dans LinkAfr (src/components/espace-pub/paiement-natif.tsx) : sans page de paiement hébergée
// ni cadre, dans notre propre formulaire. Le numéro (Côte d'Ivoire seulement), les opérateurs que le compte Cartflox
// ouvre, puis la validation sur le téléphone (ou un code à usage unique pour Orange Money ; Wave ouvre son appli).
// Le serveur ouvre le paiement pour le montant de la recharge, déclenche le débit et relit le paiement chez Cartflox
// avant de créditer : la page n'a aucune clé, et la page de la recharge se met à jour dès que c'est payé.

type Phase = "ouverture" | "choix" | "otp" | "attente";

/** Les couleurs des opérateurs, pour la pastille quand Cartflox ne donne pas de logo (comme LinkAfr). */
function couleurDe(nom: string): { bg: string; fg: string } {
  const n = nom.toLowerCase();
  if (n.includes("wave")) return { bg: "#1DC8FF", fg: "#04212B" };
  if (n.includes("orange")) return { bg: "#FF7900", fg: "#1A0B00" };
  if (n.includes("mtn")) return { bg: "#FFCC00", fg: "#1A1500" };
  if (n.includes("moov")) return { bg: "#0A57C2", fg: "#FFFFFF" };
  return { bg: "#1C1C1C", fg: "#FFFFFF" };
}

export function PaiementMobileMoney({ rechargeId, montant, onVerifie }: {
  rechargeId: string;
  /** Le montant de la recharge, pour le bouton et les phrases ; le serveur, lui, le relit dans la base. */
  montant: number;
  /** Après une vérification : la page relit l'état de la recharge (elle passe à « Reçue » dès que c'est payé). */
  onVerifie: () => Promise<void>;
}) {
  const [phase, setPhase] = useState<Phase>("ouverture");
  const [erreur, setErreur] = useState<string | null>(null);
  const [operateurs, setOperateurs] = useState<Operateur[]>([]);
  const [choisi, setChoisi] = useState<Operateur | null>(null);
  const [telephone, setTelephone] = useState("");
  const [otp, setOtp] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [ouverture, setOuverture] = useState<{ redirection: string; qr: string | null } | null>(null);
  const [ussd, setUssd] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Ouverture : le serveur ouvre le paiement (ou reprend le dernier, encore en attente) et donne les opérateurs.
  useEffect(() => {
    let annule = false;
    ouvrirPaiement(rechargeId)
      .then((r) => {
        if (annule) return;
        if (!r.ok) { setErreur(r.erreur); setPhase("choix"); return; }
        setSessionId(r.sessionId);
        setOperateurs(r.operateurs);
        setChoisi(r.operateurs[0] ?? null);
        setPhase("choix");
      })
      .catch(() => { if (!annule) { setErreur("Le paiement en ligne ne répond pas pour l'instant, réessaie dans un instant"); setPhase("choix"); } });
    return () => { annule = true; };
  }, [rechargeId]);

  const payer = async (code?: string) => {
    if (!choisi || !sessionId) return;
    setOccupe(true);
    setErreur(null);
    const r = await payerParMobileMoney({ rechargeId, sessionId, gatewayId: choisi.gatewayId, methodCode: choisi.code, telephone, otp: code }).catch(() => null);
    setOccupe(false);
    if (!r) { setErreur("Le paiement en ligne ne répond pas pour l'instant, réessaie dans un instant"); return; }
    if (!r.ok) { setErreur(r.erreur); return; }
    setSessionId(r.sessionId);
    if (r.etat === "confirmee" || r.statut === "SUCCESS") { await onVerifie(); setPhase("attente"); return; }
    // Wave (et certains opérateurs) se confirment dans leur appli : on donne le lien, puis on attend ici.
    if (r.redirection) { setOuverture({ redirection: r.redirection, qr: r.qrRedirection }); setPhase("attente"); return; }
    if (r.statut === "REQUIRE_OTP" || r.statut === "OTP") { setUssd(r.ussd); setOtp(""); setPhase("otp"); return; }
    if (r.statut === "PENDING") { setOuverture(null); setPhase("attente"); return; }
    setErreur(r.message ?? "Paiement refusé. Essaie un autre numéro ou un autre opérateur");
  };

  const verifier = async () => {
    setOccupe(true);
    const r = await verifierMonPaiement(rechargeId).catch(() => null);
    await onVerifie();
    setOccupe(false);
    if (r && "etat" in r && r.etat !== "confirmee") setErreur("Le paiement n'est pas encore arrivé. Si tu viens de valider, attends quelques secondes");
  };

  if (phase === "ouverture") {
    return <p className="flex items-center gap-2 py-6 text-[14px] text-texte-2"><Loader2 className="size-4 animate-spin" strokeWidth={1.8} /> Ouverture du paiement</p>;
  }

  const numeroOk = telephoneIvoirien(telephone) !== null;
  const nom = choisi?.nom ?? "ton opérateur";
  return (
    <div className="space-y-4">
      {erreur && <SAlert tone="warning">{erreur}</SAlert>}

      {phase === "attente" ? (
        <div className="flex items-start gap-3 rounded-[16px] bg-[color:var(--h-surface)] p-4">
          <Smartphone className="mt-0.5 size-5 shrink-0 text-encre/90" strokeWidth={1.8} />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] leading-5 font-medium text-encre/95">{ouverture ? `Confirme dans ${nom}` : "Valide le paiement sur ton téléphone"}</p>
            <p className="mt-1 text-[14px] leading-5 text-texte-2">
              {ouverture
                ? `Ouvre ${nom} sur ton téléphone, vérifie ${fcfa(montant)} et confirme.`
                : `${nom} t'envoie une demande de ${fcfa(montant)}.`} Cette page avance toute seule dès que c&apos;est payé
            </p>
            {ouverture && (
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <a href={ouverture.redirection} target="_blank" rel="noopener noreferrer" className="hb hb--encre">
                  <ExternalLink className="size-4" strokeWidth={1.8} aria-hidden="true" />
                  Ouvrir {nom}
                </a>
                {ouverture.qr && (
                  <div className="hidden items-center gap-3 sm:flex">
                    <div className="size-[96px] rounded-[8px] bg-white p-1.5 [&>svg]:size-full" role="img" aria-label={`QR pour ouvrir ${nom} sur ton téléphone`} dangerouslySetInnerHTML={{ __html: ouverture.qr }} />
                    <p className="max-w-[180px] text-[13px] leading-5 text-texte-2">Sur ordinateur : scanne ce code avec ton téléphone</p>
                  </div>
                )}
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-2 text-[13px] text-texte-2"><Loader2 className="size-4 animate-spin" strokeWidth={1.8} /> En attente</span>
              <SBtn size="sm" variant="outlined" tone="secondary" disabled={occupe} onClick={() => void verifier()}>J&apos;ai payé, vérifier</SBtn>
              <SBtn size="sm" variant="text" tone="secondary" onClick={() => { setOuverture(null); setErreur(null); setPhase("choix"); }}>Changer de moyen</SBtn>
            </div>
          </div>
        </div>
      ) : phase === "otp" ? (
        <div className="space-y-3">
          <SField label="Code de paiement" hint={`Compose ${ussd ?? CODE_ORANGE_CI} sur ton téléphone pour obtenir le code`}>
            <SInput inputMode="numeric" autoComplete="one-time-code" value={otp} maxLength={8} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} />
          </SField>
          <div className="flex flex-wrap gap-2">
            <SBtn tone="secondary" onClick={() => void payer(otp)} disabled={occupe || otp.length < 4}>
              {occupe && <Loader2 className="size-4 animate-spin" strokeWidth={1.8} />} Valider le paiement
            </SBtn>
            <SBtn variant="text" tone="secondary" onClick={() => { setOtp(""); setPhase("choix"); }}>Retour</SBtn>
          </div>
        </div>
      ) : (
        <>
          <SField label="Numéro qui paie" hint="Ton numéro Mobile Money de Côte d'Ivoire : la demande de paiement arrive dessus">
            <div className="flex items-center gap-2">
              <span className="grid h-12 w-[72px] shrink-0 place-items-center rounded-[12px] bg-[color:var(--h-surface)] text-[15px] font-medium text-encre/90">+225</span>
              <SInput type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="07 07 07 07 07" value={telephone}
                onChange={(e) => setTelephone(e.target.value.replace(/[^\d ]/g, "").slice(0, 14))} />
            </div>
          </SField>
          <div>
            <p className="mb-2 pl-0.5 text-[14px] leading-5 font-semibold text-encre/95">Opérateur</p>
            {operateurs.length === 0 ? (
              <p className="text-[14px] leading-5 text-texte-2">Aucun opérateur disponible pour l&apos;instant. Paie avec le QR universel, ou au comptoir</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {operateurs.map((o) => {
                  const actif = choisi?.gatewayId === o.gatewayId && choisi?.code === o.code;
                  const c = couleurDe(o.nom);
                  return (
                    <button key={`${o.gatewayId}-${o.code}`} type="button" onClick={() => setChoisi(o)} aria-pressed={actif}
                      className={`flex h-14 items-center gap-3 rounded-[12px] px-3 text-left text-[14px] font-medium transition-shadow ${actif ? "text-encre/95 shadow-[inset_0_0_0_2px_rgb(var(--h-marque))]" : "text-encre/90 shadow-[inset_0_0_0_1px_var(--h-filet)]"}`}>
                      {o.logo
                        // eslint-disable-next-line @next/next/no-img-element -- logos servis par Cartflox
                        ? <img src={o.logo} alt="" className="size-8 shrink-0 rounded-[8px] object-contain" />
                        : <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-[8px] text-[13px] font-bold" style={{ background: c.bg, color: c.fg }}>{o.nom.charAt(0)}</span>}
                      <span className="min-w-0 flex-1 truncate">{o.nom}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <SBtn tone="secondary" block className="min-h-12 text-[16px]" onClick={() => void payer()} disabled={occupe || !choisi || !numeroOk || !sessionId}>
            {occupe && <Loader2 className="size-4 animate-spin" strokeWidth={1.8} />} Payer {fcfa(montant)}
          </SBtn>
        </>
      )}
    </div>
  );
}
