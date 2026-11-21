"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ExternalLink, Lock, QrCode } from "@/components/icons";
import { SAlert, SBtn, SInput } from "@/components/sneat";
import { ouvrirPaiement, payerParMobileMoney, verifierMonPaiement } from "@/app/(espace)/recharger/actions";
import { CODE_ORANGE_CI, saisieNumero, telephoneIvoirien, type Operateur } from "@/lib/mobile-money";
import { de, fcfa, telephoneLisible } from "@/lib/format";

// LE PAIEMENT NATIF, comme dans LinkAfr (src/components/espace-pub/paiement-natif.tsx), montré comme le checkout de
// Cartflox dans son style « Cartes » (choix du propriétaire du 20/11/2026) : la liste des moyens, un rond par ligne, la
// ligne choisie s'ouvre sur son numéro (Côte d'Ivoire seulement) et sa consigne, le QR universel en dernière ligne. Puis
// la validation sur le téléphone (ou un code à usage unique pour Orange Money ; Wave ouvre son appli), le logo de
// l'opérateur dans un anneau pendant l'attente.
// Le serveur ouvre le paiement pour le montant de la recharge, déclenche le débit et relit le paiement chez Cartflox
// avant de créditer : la page n'a aucune clé, et la page de la recharge se met à jour dès que c'est payé.

type Phase = "ouverture" | "choix" | "otp" | "attente";

const INJOIGNABLE = "Le paiement en ligne ne répond pas pour l'instant, réessaie dans un instant";

/** La clé d'une ligne de la liste : un opérateur, ou le QR universel. */
const QR = "qr";
const cleDe = (o: Operateur) => `${o.gatewayId}-${o.code}`;

/** Les couleurs des opérateurs, pour la pastille quand Cartflox ne donne pas de logo (comme LinkAfr). */
function couleurDe(nom: string): { bg: string; fg: string } {
  const n = nom.toLowerCase();
  if (n.includes("wave")) return { bg: "#1DC8FF", fg: "#04212B" };
  if (n.includes("orange")) return { bg: "#FF7900", fg: "#1A0B00" };
  if (n.includes("mtn")) return { bg: "#FFCC00", fg: "#1A1500" };
  if (n.includes("moov")) return { bg: "#0A57C2", fg: "#FFFFFF" };
  return { bg: "#1C1C1C", fg: "#FFFFFF" };
}

/** Le logo de l'opérateur, ou sa pastille de couleur. */
function Logo({ o, taille = 28 }: { o: Operateur; taille?: number }) {
  const s = { width: taille, height: taille };
  if (o.logo) {
    // eslint-disable-next-line @next/next/no-img-element -- logos servis par Cartflox
    return <img src={o.logo} alt="" style={s} className="shrink-0 rounded-[8px] object-contain" />;
  }
  const c = couleurDe(o.nom);
  return <span aria-hidden="true" style={{ ...s, background: c.bg, color: c.fg }} className="grid shrink-0 place-items-center rounded-[8px] text-[13px] font-bold">{o.nom.charAt(0)}</span>;
}

/** Ce qui se passe après « Payer », dit avant, sous le numéro. */
function consigne(nom: string): string {
  const n = nom.toLowerCase();
  if (n.includes("wave")) return "Tu confirmes ensuite dans ton appli Wave";
  if (n.includes("orange")) return `Tu valideras avec un code de paiement : compose ${CODE_ORANGE_CI} pour l'obtenir`;
  return "Une demande arrive sur ce numéro : tu la valides avec ton code secret";
}

/** Le drapeau de la Côte d'Ivoire, devant l'indicatif : trois bandes, sans image à charger. */
function Drapeau() {
  return (
    <span aria-hidden="true" className="flex h-3 w-[18px] shrink-0 overflow-hidden rounded-[2px] shadow-[0_0_0_1px_var(--h-filet)]">
      <span className="flex-1 bg-[#F77F00]" />
      <span className="flex-1 bg-white" />
      <span className="flex-1 bg-[#009E60]" />
    </span>
  );
}

/**
 * Une ligne de la liste : un vrai bouton radio (masqué, les flèches du clavier passent d'une ligne à l'autre), le rond,
 * le nom et le logo ; choisie, elle s'ouvre sur son détail.
 */
function Ligne({ actif, onChoisir, nom, aDroite, children }: {
  actif: boolean; onChoisir: () => void; nom: string; aDroite: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className={`rounded-[16px] bg-surface transition-shadow ${actif ? "shadow-[inset_0_0_0_2px_rgb(var(--h-marque))]" : "shadow-[inset_0_0_0_1px_var(--h-filet)]"}`}>
      <label className="flex h-14 cursor-pointer items-center gap-3 rounded-[16px] px-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[rgb(var(--h-marque-texte))]">
        <input type="radio" name="moyen-de-paiement" checked={actif} onChange={onChoisir} className="sr-only" />
        <span aria-hidden="true" className={`size-5 shrink-0 rounded-full transition-shadow ${actif ? "shadow-[inset_0_0_0_6px_rgb(var(--h-marque-texte))]" : "shadow-[inset_0_0_0_1.5px_var(--h-repere)]"}`} />
        <span className="min-w-0 flex-1 truncate text-[15px] leading-5 font-medium text-encre/95">{nom}</span>
        {aDroite}
      </label>
      {actif && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

/** Pendant l'attente : le logo de l'opérateur au milieu d'un anneau qui tourne, comme dans le checkout de Cartflox. */
function AnneauAttente({ o }: { o: Operateur | null }) {
  return (
    <span aria-hidden="true" className="relative grid size-20 shrink-0 place-items-center">
      <svg className="absolute inset-0 size-20 motion-safe:animate-spin" style={{ animationDuration: "1.6s" }} viewBox="0 0 80 80" fill="none">
        <circle cx="40" cy="40" r="37" stroke="var(--h-filet)" strokeWidth="3" />
        <circle cx="40" cy="40" r="37" stroke="rgb(var(--h-marque))" strokeWidth="3" strokeLinecap="round" strokeDasharray="58 175" />
      </svg>
      {o && <Logo o={o} taille={44} />}
    </span>
  );
}

export function PaiementMobileMoney({ rechargeId, montant, onVerifie, qr }: {
  rechargeId: string;
  /** Le montant de la recharge, pour le bouton et les phrases ; le serveur, lui, le relit dans la base. */
  montant: number;
  /** Après une vérification : la page relit l'état de la recharge (elle passe à « C'est payé » dès que c'est payé). */
  onVerifie: () => Promise<void>;
  /** Le QR universel, ouvert quand on choisit sa ligne (la dernière) ; null s'il n'est pas branché. */
  qr: React.ReactNode | null;
}) {
  const [phase, setPhase] = useState<Phase>("ouverture");
  /** L'ouverture du paiement a échoué : dit au-dessus de la liste (le QR universel reste là). */
  const [erreurOuverture, setErreurOuverture] = useState<string | null>(null);
  /** Un refus du paiement : dit au-dessus du bouton. */
  const [erreur, setErreur] = useState<string | null>(null);
  const [erreurNumero, setErreurNumero] = useState(false);
  const [operateurs, setOperateurs] = useState<Operateur[]>([]);
  /** La ligne choisie ; null : la première de la liste, une fois les opérateurs arrivés. */
  const [choix, setChoix] = useState<string | null>(null);
  const [telephone, setTelephone] = useState("");
  const [otp, setOtp] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [ouverture, setOuverture] = useState<{ redirection: string; qr: string | null } | null>(null);
  /** Le code est donné (ou l'opérateur dit déjà « payé ») : il ne reste qu'à attendre la confirmation, sans consigne. */
  const [verification, setVerification] = useState(false);
  const [ussd, setUssd] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const champNumero = useRef<HTMLInputElement>(null);
  const idNumero = useId(), idAide = useId(), idLegende = useId();

  // Ouverture : le serveur ouvre le paiement (ou reprend le dernier, encore en attente) et donne les opérateurs.
  useEffect(() => {
    let annule = false;
    ouvrirPaiement(rechargeId)
      .then((r) => {
        if (annule) return;
        if (!r.ok) { setErreurOuverture(r.erreur); setPhase("choix"); return; }
        setSessionId(r.sessionId);
        setOperateurs(r.operateurs);
        setPhase("choix");
      })
      .catch(() => { if (!annule) { setErreurOuverture(INJOIGNABLE); setPhase("choix"); } });
    return () => { annule = true; };
  }, [rechargeId]);

  const cle = choix ?? (phase === "ouverture" ? null : operateurs[0] ? cleDe(operateurs[0]) : qr ? QR : null);
  const operateur = operateurs.find((o) => cleDe(o) === cle) ?? null;
  const numero = telephoneIvoirien(telephone);
  const nom = operateur?.nom ?? "ton opérateur";

  const choisir = (c: string) => { setChoix(c); setErreur(null); setErreurNumero(false); };

  const payer = async (code?: string) => {
    if (!operateur || !sessionId) return;
    if (!numero) { setErreurNumero(true); champNumero.current?.focus(); return; }
    setOccupe(true);
    setErreur(null);
    const r = await payerParMobileMoney({ rechargeId, sessionId, gatewayId: operateur.gatewayId, methodCode: operateur.code, telephone: numero, otp: code }).catch(() => null);
    setOccupe(false);
    if (!r) { setErreur(INJOIGNABLE); return; }
    if (!r.ok) { setErreur(r.erreur); return; }
    setSessionId(r.sessionId);
    if (r.etat === "confirmee" || r.statut === "SUCCESS") { setVerification(true); await onVerifie(); setPhase("attente"); return; }
    // Wave (et certains opérateurs) se confirment dans leur appli : on donne le lien, puis on attend ici.
    if (r.redirection) { setOuverture({ redirection: r.redirection, qr: r.qrRedirection }); setVerification(false); setPhase("attente"); return; }
    if (r.statut === "REQUIRE_OTP" || r.statut === "OTP") { setUssd(r.ussd); setOtp(""); setPhase("otp"); return; }
    // Après un code, rien n'arrive plus sur le téléphone : on attend la confirmation de l'opérateur.
    if (r.statut === "PENDING") { setOuverture(null); setVerification(code !== undefined); setPhase("attente"); return; }
    setErreur(r.message ?? "Paiement refusé. Essaie un autre numéro ou un autre opérateur");
  };

  const verifier = async () => {
    setOccupe(true);
    const r = await verifierMonPaiement(rechargeId).catch(() => null);
    await onVerifie();
    setOccupe(false);
    if (r && "etat" in r && r.etat !== "confirmee") setErreur("Le paiement n'est pas encore arrivé. Si tu viens de valider, attends quelques secondes");
  };

  const changerDeMoyen = () => { setOuverture(null); setVerification(false); setErreur(null); setOtp(""); setPhase("choix"); };

  if (phase === "otp" && operateur) {
    return (
      <div className="rounded-[16px] bg-surface p-4 shadow-[inset_0_0_0_1px_var(--h-filet)]">
        <div className="flex items-start gap-3">
          <Logo o={operateur} taille={40} />
          <div className="min-w-0">
            <p className="text-[16px] leading-6 font-medium text-encre/95">Ton code {operateur.nom}</p>
            <p className="mt-0.5 text-[14px] leading-5 text-texte-2">Compose {ussd ?? CODE_ORANGE_CI} sur ton téléphone, puis tape ici le code reçu</p>
          </div>
        </div>
        {erreur && <div className="mt-4"><SAlert tone="warning">{erreur}</SAlert></div>}
        <label className="mt-4 block">
          <span className="sr-only">Code de paiement</span>
          <SInput inputMode="numeric" autoComplete="one-time-code" placeholder="Code" value={otp} maxLength={8}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} className="h-14 text-center font-mono text-[22px] tracking-[0.2em] placeholder:font-sans placeholder:text-[16px] placeholder:tracking-normal" />
        </label>
        <SBtn tone="secondary" block className="mt-4 min-h-14 rounded-[16px] text-[16px]" onClick={() => void payer(otp)} disabled={occupe || otp.length < 4}>
          {occupe ? "Vérification du code" : "Valider le paiement"}
        </SBtn>
        <SBtn variant="text" tone="secondary" block className="mt-2" onClick={changerDeMoyen}>Retour</SBtn>
      </div>
    );
  }

  if (phase === "attente") {
    return (
      <div className="flex flex-col items-center rounded-[16px] bg-surface px-4 py-8 text-center shadow-[inset_0_0_0_1px_var(--h-filet)]">
        <AnneauAttente o={operateur} />
        <p className="mt-5 text-[18px] leading-6 font-medium text-encre/95">
          {ouverture ? `Confirme dans ${nom}` : verification ? "Paiement en cours de vérification" : "Valide sur ton téléphone"}
        </p>
        <p className="mt-2 max-w-[320px] text-[15px] leading-6 text-balance text-texte-2">
          {ouverture
            ? `Ouvre ${nom}, vérifie ${fcfa(montant)} et confirme`
            : verification
              ? `On attend la confirmation ${de(nom)} pour ${fcfa(montant)}`
              : `Une demande de ${fcfa(montant)} arrive sur le ${numero ? telephoneLisible(numero).replace(/ /g, "\u00a0") : "numéro donné"} : valide-la avec ton code secret`}
        </p>
        {ouverture && (
          <a href={ouverture.redirection} target="_blank" rel="noopener noreferrer" className="hb hb--encre mt-6 min-h-12 w-full max-w-[320px] text-[16px]">
            <ExternalLink className="size-4" strokeWidth={1.8} aria-hidden="true" />
            Ouvrir {nom}
          </a>
        )}
        {ouverture?.qr && (
          <div className="mt-5 hidden items-center gap-3 text-left sm:flex">
            <div className="size-[96px] rounded-[8px] bg-white p-1.5 [&>svg]:size-full" role="img" aria-label={`QR pour ouvrir ${nom} sur ton téléphone`} dangerouslySetInnerHTML={{ __html: ouverture.qr }} />
            <p className="max-w-[180px] text-[13px] leading-5 text-texte-2">Sur ordinateur : scanne ce code avec ton téléphone</p>
          </div>
        )}
        {erreur && <div className="mt-5 w-full text-left"><SAlert tone="warning">{erreur}</SAlert></div>}
        <p className="mt-6 text-[13px] leading-5 text-texte-2">Cette page avance toute seule dès que c&apos;est payé</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <SBtn size="sm" variant="outlined" tone="secondary" disabled={occupe} onClick={() => void verifier()}>J&apos;ai payé, vérifier</SBtn>
          <SBtn size="sm" variant="text" tone="secondary" onClick={changerDeMoyen}>Changer de moyen</SBtn>
        </div>
      </div>
    );
  }

  const chargement = phase === "ouverture";
  return (
    <div>
      <fieldset aria-labelledby={idLegende} aria-busy={chargement || undefined}>
        <p id={idLegende} className="text-[16px] leading-6 font-medium text-encre/95">Moyen de paiement</p>
        {chargement && <p className="mt-1 text-[13px] leading-5 text-texte-2">Ouverture du paiement</p>}
        {erreurOuverture && <div className="mt-3"><SAlert tone="warning">{erreurOuverture}</SAlert></div>}
        {!chargement && operateurs.length === 0 && !qr ? (
          <p className="mt-3 text-[14px] leading-5 text-texte-2">Aucun opérateur disponible pour l&apos;instant. Paie en espèces au comptoir avec la référence</p>
        ) : (
          <div className="mt-3 space-y-2">
            {chargement && [0, 1, 2].map((i) => <div key={i} aria-hidden="true" className="h-14 rounded-[16px] bg-[color:var(--h-surface)] motion-safe:animate-pulse" />)}
            {operateurs.map((o) => (
              <Ligne key={cleDe(o)} actif={cle === cleDe(o)} onChoisir={() => choisir(cleDe(o))} nom={o.nom} aDroite={<Logo o={o} />}>
                <label htmlFor={idNumero} className="mb-2 block text-[14px] leading-5 font-semibold text-encre/95">Numéro {o.nom}</label>
                <div className={`flex h-12 items-stretch overflow-hidden rounded-[12px] bg-surface transition-shadow ${erreurNumero ? "shadow-[0_0_0_1px_rgb(var(--h-danger))]" : "shadow-[0_0_0_1px_var(--h-filet)]"} focus-within:shadow-[0_0_0_1px_rgb(var(--h-marque-texte)),0_0_0_4px_rgb(var(--h-marque-texte)/0.28)]`}>
                  <span aria-hidden="true" className="flex shrink-0 items-center gap-2 border-r border-[color:var(--h-filet)] pr-3 pl-4 text-[15px] font-medium text-encre/90">
                    <Drapeau />
                    +225
                  </span>
                  <input ref={champNumero} id={idNumero} type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="07 07 07 07 07" value={telephone}
                    aria-invalid={erreurNumero || undefined} aria-describedby={idAide}
                    onChange={(e) => { setTelephone(saisieNumero(e.target.value)); setErreurNumero(false); }}
                    onBlur={() => { if (numero) setTelephone(telephoneLisible(numero)); }}
                    className="chiffres min-w-0 flex-1 bg-transparent px-3 text-[16px] text-encre/95 outline-none placeholder:text-texte-2" />
                </div>
                <p id={idAide} aria-live="polite" className={`mt-2 text-[13px] leading-5 ${erreurNumero ? "text-[rgb(var(--h-danger-texte))]" : "text-texte-2"}`}>
                  {erreurNumero ? "Un numéro à 10 chiffres, par exemple 07 07 07 07 07" : consigne(o.nom)}
                </p>
              </Ligne>
            ))}
            {qr && (
              <Ligne actif={cle === QR} onChoisir={() => choisir(QR)} nom="QR universel" aDroite={<QrCode className="size-6 shrink-0 text-encre/75" strokeWidth={1.8} />}>
                <p className="mb-4 text-[14px] leading-5 text-texte-2">Avec le QR universel, la cantine confirme à la main, après avoir vu le paiement arriver</p>
                {qr}
              </Ligne>
            )}
          </div>
        )}
      </fieldset>
      {erreur && <div className="mt-4"><SAlert tone="warning">{erreur}</SAlert></div>}
      {chargement && cle !== QR && <div aria-hidden="true" className="mt-4 h-14 rounded-[16px] bg-[color:var(--h-surface)]" />}
      {operateur && (
        <>
          <SBtn tone="secondary" block className="mt-4 min-h-14 rounded-[16px] text-[16px]" onClick={() => void payer()} disabled={occupe || !sessionId}>
            <Lock className="size-4" strokeWidth={1.8} aria-hidden="true" />
            {occupe ? "Envoi de la demande" : `Payer ${fcfa(montant)}`}
          </SBtn>
          <p className="mt-3 text-center text-[12px] leading-4 text-texte-2">Paiement par Cartflox</p>
        </>
      )}
    </div>
  );
}
