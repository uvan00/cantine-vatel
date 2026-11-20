"use client";

import { useEffect, useRef, useState } from "react";
import { SAlert } from "@/components/sneat";

// Le paiement Mobile Money dans la page, par SoftPay de Cartflox : le formulaire se dessine dans un cadre servi par
// Cartflox (le payeur y choisit Wave, Orange Money, MTN MoMo ou Moov Money, tape son numéro et valide sur son
// téléphone), habillé à nos couleurs. Seule la clé PUBLIQUE arrive ici : elle permet de créer et suivre un paiement,
// rien d'autre. La page ne crédite rien : elle prévient le serveur, qui relit le paiement chez Cartflox avec la clé secrète.
// Côte d'Ivoire seulement : pays « CI » et francs CFA.

type Controle = { destroy(): void };
type SoftPay = { configure(o: Record<string, unknown>): void; mount(o: Record<string, unknown>): Controle };
declare global { interface Window { Cartflox?: { softpay?: SoftPay } } }

/** Les textes du formulaire, à notre façon : en « tu », sans point d'exclamation. */
const TEXTES = {
  titre: "Paiement",
  choisir: "Choisis ton Mobile Money",
  telephone: "Ton numéro",
  payer: "Payer",
  chargement: "Un instant",
  attente: "Valide le paiement sur ton téléphone",
  attenteDetail: "Une demande de confirmation vient d'arriver sur ton téléphone. Réponds-y pour finir.",
  otp: "Tape le code reçu",
  otpUssd: "Compose ce code sur ton téléphone pour obtenir ton code de paiement :",
  valider: "Valider le paiement",
  redirection: "Continuer vers",
  redirectionDetail: "Tu confirmes le paiement sur la page de ton opérateur, puis tu reviens ici.",
  succes: "Paiement réussi",
  succesDetail: "Ton paiement est arrivé, ton solde monte",
  echec: "Le paiement n'est pas passé",
  reessayer: "Réessayer",
  retour: "Changer de Mobile Money",
  aucun: "Aucun Mobile Money disponible pour l'instant",
  securise: "Paiement sécurisé par Cartflox",
  carte: "Payer par carte",
  carteDetail: "Tu vas passer sur la page de paiement sécurisée",
  application: "Confirme dans {app}",
  applicationDetail: "Ouvre {app} sur ton téléphone, vérifie le montant et confirme. Cette page se met à jour toute seule.",
  ouvrir: "Ouvrir",
  qr: "Sur ordinateur : scanne ce code avec ton téléphone",
};

/** Les couleurs du formulaire : celles de la cantine (bouton à l'encre, vert pour la réussite). */
const THEME = {
  accent: "#1C1C1C",
  "accent-text": "#FFFFFF",
  radius: "12px",
  text: "#1C1C1C",
  muted: "#6B6B6B",
  field: "#FFFFFF",
  border: "rgba(0, 0, 0, 0.12)",
  bg: "#FFFFFF",
  error: "#D32F2F",
  success: "#1F7A4A",
  font: "\"DM Sans\", ui-sans-serif, system-ui, sans-serif",
};

/** Charge le script de SoftPay une seule fois par page. */
function chargerSoftPay(api: string): Promise<SoftPay> {
  if (window.Cartflox?.softpay) return Promise.resolve(window.Cartflox.softpay);
  return new Promise((ok, non) => {
    const id = "cartflox-softpay";
    let script = document.getElementById(id) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = id;
      script.src = `${api}/cartflox-softpay.js`;
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", () => (window.Cartflox?.softpay ? ok(window.Cartflox.softpay) : non(new Error("SoftPay absent"))));
    script.addEventListener("error", () => non(new Error("SoftPay injoignable")));
  });
}

export function PaiementCartflox({ api, clePublique, montant, rechargeId, reference, nom, retour, onSession, onReussi }: {
  /** L'adresse de Cartflox (le script et le cadre de paiement en viennent). */
  api: string;
  clePublique: string;
  /** Le montant de la recharge, en francs CFA entiers. */
  montant: number;
  rechargeId: string;
  reference: string;
  /** Le nom de celui qui paie, montré sur les reçus de Cartflox. */
  nom: string;
  /** L'adresse de cette page : on y revient après une page d'opérateur. */
  retour: string;
  /** Un paiement vient d'être créé chez Cartflox : le serveur le relie à la recharge. */
  onSession: (sessionId: string) => void;
  /** Cartflox annonce la réussite : le serveur vérifie, puis la page se met à jour. */
  onReussi: (sessionId: string) => void;
}) {
  const cadre = useRef<HTMLDivElement>(null);
  const rappels = useRef({ onSession, onReussi });
  const [panne, setPanne] = useState(false);

  useEffect(() => { rappels.current = { onSession, onReussi }; });

  useEffect(() => {
    let fini = false;
    let controle: Controle | null = null;
    chargerSoftPay(api)
      .then((softpay) => {
        if (fini || !cadre.current) return;
        softpay.configure({ publicKey: clePublique, country: "CI", locale: "fr" });
        controle = softpay.mount({
          container: cadre.current,
          amount: montant,
          currency: "XOF",
          country: "CI",
          theme: THEME,
          labels: TEXTES,
          customer_name: nom,
          description: `Recharge ${reference}`,
          metadata: { cantine_recharge: rechargeId, reference },
          success_url: retour,
          cancel_url: retour,
          onSession: (s: { id?: string }) => { if (s?.id) rappels.current.onSession(s.id); },
          onSuccess: (r: { sessionId?: string }) => { if (r?.sessionId) rappels.current.onReussi(r.sessionId); },
        });
      })
      .catch(() => { if (!fini) setPanne(true); });
    return () => { fini = true; controle?.destroy(); };
  }, [api, clePublique, montant, rechargeId, reference, nom, retour]);

  if (panne) {
    return <SAlert tone="error">Le paiement en ligne ne répond pas. Vérifie ta connexion, puis recharge la page</SAlert>;
  }
  return <div ref={cadre} className="min-h-[200px]" />;
}
