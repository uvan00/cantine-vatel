// L'assistant de la cantine, façon LinkAfr (demande du propriétaire du 21/11/2026) : ce qui se décide sans réseau.
// Les questions guidées se répondent avec les vrais chiffres, sans IA et sans rien coûter ; une question écrite quand
// l'IA n'est pas branchée est rapprochée d'une question guidée par ses mots ; la réponse de l'IA est remise au propre ;
// l'historique envoyé à l'IA est borné ; les questions libres ont un plafond par jour (choix du propriétaire).
// Rien de ce qui part vers l'IA ne nomme un élève : seulement des nombres et des noms de plats.
// Pur, testé par `npm test` (assistant.test.ts).
import { fcfa, liste, nombre, pluriel } from "./format.ts";
import { poidsLisible } from "./restes.ts";
import { noteLisible, pourcent } from "./statistiques.ts";

/** Les questions libres envoyées à l'IA, au plus, par jour et pour toute la cantine. */
export const PLAFOND_JOUR = 50;
export const QUESTION_MAX = 1000;
/** Les derniers messages du fil renvoyés à l'IA avec une question, pour qu'elle suive la conversation. */
export const HISTORIQUE_MAX = 12;

export type QuestionGuidee = "service" | "demain" | "meilleur" | "non-retires" | "recharges";

export const QUESTIONS: { id: QuestionGuidee; libelle: string; question: string }[] = [
  { id: "service", libelle: "Où en est le service ?", question: "Où en est le service aujourd'hui ?" },
  { id: "demain", libelle: "Que préparer demain ?", question: "Que faut-il préparer pour demain ?" },
  { id: "meilleur", libelle: "Quel plat marche le mieux ?", question: "Quel plat marche le mieux ces sept derniers jours ?" },
  { id: "non-retires", libelle: "Qui n'a pas retiré ?", question: "Combien de repas n'ont pas été retirés ces sept derniers jours ?" },
  { id: "recharges", libelle: "Recharges en attente ?", question: "Quelles recharges attendent ma confirmation ?" },
];

export const estQuestionGuidee = (id: string): id is QuestionGuidee => QUESTIONS.some((q) => q.id === id);

export type Lien = { href: string; libelle: string };
export type Reponse = { reponse: string; lien: Lien | null };

/** Ce que lisent les réponses guidées et l'IA : des nombres et des noms de plats, rien sur les élèves. */
export type DonneesAssistant = {
  /** « samedi 21 novembre » */
  aujourdhui: string;
  service: { reserves: number; servis: number; aServir: number };
  /** L'heure de clôture des réservations, lisible (« 9 h »). */
  cloture: string;
  closAujourdhui: boolean;
  demain: { total: number; plats: { nom: string; repas: number; portions: number | null }[] };
  septJours: {
    plats: { nom: string; repas: number }[];
    nonRetires: { nombre: number; total: number };
    /** Les recharges confirmées, en F CFA. */
    recharges: number;
    restes: { parRepas: number | null; plusLaisse: { nom: string; parRepas: number } | null };
  };
  rechargesEnAttente: number;
  notes: { moyenne: number | null; avis: number };
};

/** « garba » au milieu d'une phrase, « Garba » en tête. */
const enMinuscule = (nom: string) => nom.charAt(0).toLocaleLowerCase("fr") + nom.slice(1);

/** La réponse d'une question guidée, calculée sur les vrais chiffres. */
export function repondre(id: QuestionGuidee, d: DonneesAssistant): Reponse {
  if (id === "service") {
    const s = d.service;
    const etat = d.closAujourdhui ? `Les réservations sont closes depuis ${d.cloture} : ces nombres ne bougent plus.` : `On réserve encore jusqu'à ${d.cloture} : ces nombres peuvent monter.`;
    return {
      reponse: s.reserves === 0
        ? `Personne n'a réservé de repas pour aujourd'hui. ${etat}`
        : `Aujourd'hui : ${pluriel(s.reserves, "repas réservé", "repas réservés")}, ${pluriel(s.servis, "servi")}, ${nombre(s.aServir)} à servir. ${etat}`,
      lien: { href: "/admin/commandes", libelle: "Voir les commandes" },
    };
  }
  if (id === "demain") {
    if (d.demain.plats.length === 0) {
      return { reponse: "Rien n'est encore au menu de demain : sans plat, personne ne peut réserver.", lien: { href: "/admin/menus", libelle: "Planifier les menus" } };
    }
    const plats = d.demain.plats.map((p) => `${enMinuscule(p.nom)} ${nombre(p.repas)}${p.portions === null ? "" : ` sur ${nombre(p.portions)}`}`);
    return {
      reponse: `Demain, ${pluriel(d.demain.total, "repas réservé", "repas réservés")} pour l'instant : ${liste(plats)}. On réserve jusqu'à ${d.cloture} le jour même : ces nombres peuvent encore monter.`,
      lien: { href: "/admin/besoins", libelle: "Voir les besoins de la cuisine" },
    };
  }
  if (id === "meilleur") {
    const [premier, second] = d.septJours.plats;
    if (!premier) return { reponse: "Aucun repas réservé ces sept derniers jours : pas encore de plat en tête.", lien: { href: "/admin/rapport", libelle: "Voir le rapport de la semaine" } };
    const note = d.notes.moyenne === null ? "" : ` Les plats ont une note moyenne de ${noteLisible(d.notes.moyenne)}, sur ${pluriel(d.notes.avis, "avis", "avis")}.`;
    return {
      reponse: `Ces sept derniers jours, ${enMinuscule(premier.nom)} arrive en tête avec ${pluriel(premier.repas, "repas", "repas")}${second ? `, devant ${enMinuscule(second.nom)} (${nombre(second.repas)})` : ""}.${note}`,
      lien: { href: "/admin/rapport", libelle: "Voir le rapport de la semaine" },
    };
  }
  if (id === "non-retires") {
    const { nombre: n, total } = d.septJours.nonRetires;
    if (total === 0) return { reponse: "Aucun repas réservé ces sept derniers jours.", lien: null };
    const part = pourcent(n, total);
    const restes = d.septJours.restes.plusLaisse
      ? ` Côté restes, ${enMinuscule(d.septJours.restes.plusLaisse.nom)} revient le plus en cuisine : ${poidsLisible(d.septJours.restes.plusLaisse.parRepas)} par repas servi.`
      : "";
    return {
      reponse: n === 0
        ? `Ces sept derniers jours, tous les repas réservés ont été retirés (${nombre(total)}).${restes}`
        : `Ces sept derniers jours, ${nombre(n)} repas sur ${nombre(total)} n'ont pas été retirés, soit ${part} %. Ceux qui étaient payés ne sont pas remboursés : la cuisine les avait préparés.${restes}`,
      lien: { href: "/admin/non-retires", libelle: "Voir qui" },
    };
  }
  const attente = d.rechargesEnAttente === 0
    ? "Aucune recharge n'attend ta confirmation."
    : `${pluriel(d.rechargesEnAttente, "recharge attend", "recharges attendent")} ta confirmation : celles payées en espèces au comptoir, ou dont le paiement Mobile Money n'a pas abouti.`;
  return {
    reponse: `${attente} Ces sept derniers jours, ${fcfa(d.septJours.recharges)} de recharges ont été confirmées.`,
    lien: { href: "/admin/recharges", libelle: "Voir les recharges" },
  };
}

/** Sans IA : une question écrite est rapprochée d'une question guidée par ses mots ; null si rien ne colle. */
export function questionProche(texte: string): QuestionGuidee | null {
  const t = texte.toLocaleLowerCase("fr").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/retir|absent|pas venu|pas passe|gaspill|perdu/.test(t)) return "non-retires";
  if (/recharg|paiement|payer|paye|encaiss|argent|mobile money|wave|orange|mtn|especes/.test(t)) return "recharges";
  if (/demain|prepar|besoin|cuisin|ingredient|sortir/.test(t)) return "demain";
  if (/meilleur|marche|populaire|aime|prefer|note|succes|plus reserve/.test(t)) return "meilleur";
  if (/service|aujourd|servi|a servir|combien de repas|midi|maintenant/.test(t)) return "service";
  return null;
}

/** La réponse de l'IA remise au propre pour le panneau : texte simple, sans tiret long ni moyen ni point médian. */
export function nettoyerReponse(texte: string): string {
  return texte
    .replace(/\s*[\u2014\u2013]\s*/g, ", ")
    .replace(/\s*\u00b7\s*/g, ", ")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type MessageFil = { role: "user" | "assistant"; content: string };

/**
 * L'historique envoyé à l'IA, tiré du fil gardé par le navigateur (donc à ne pas croire sur parole) : seulement des
 * rôles connus et du texte, chaque message borné, les derniers seulement, en commençant par une question et en
 * alternant (deux messages de suite du même côté : on garde le dernier).
 */
export function historiquePropre(brut: unknown): MessageFil[] {
  if (!Array.isArray(brut)) return [];
  const propres: MessageFil[] = [];
  for (const m of brut) {
    if (!m || typeof m !== "object") continue;
    const { role, content } = m as { role?: unknown; content?: unknown };
    if ((role !== "user" && role !== "assistant") || typeof content !== "string" || !content.trim()) continue;
    const message = { role, content: content.trim().slice(0, role === "user" ? QUESTION_MAX : 2000) } as MessageFil;
    if (propres.length > 0 && propres[propres.length - 1].role === role) propres[propres.length - 1] = message;
    else propres.push(message);
  }
  const derniers = propres.slice(-HISTORIQUE_MAX);
  while (derniers.length > 0 && derniers[0].role !== "user") derniers.shift();
  // La question à venir est un message de l'utilisateur : l'historique doit donc finir par une réponse.
  while (derniers.length > 0 && derniers[derniers.length - 1].role !== "assistant") derniers.pop();
  return derniers;
}

/** Les questions libres qui restent aujourd'hui, d'après le compteur du serveur (remis à zéro chaque jour). */
export const restantesAujourdhui = (compteur: { jour: string; n: number }, jour: string) =>
  Math.max(0, PLAFOND_JOUR - (compteur.jour === jour ? compteur.n : 0));

/** La consigne de l'IA : qui elle est, ce qu'elle sait, et les règles d'écriture du propriétaire. */
export const CONSIGNE_ASSISTANT = `Tu es l'assistant du tableau de bord de la cantine de Vatel Abidjan, l'école hôtelière. Tu aides l'équipe de la cantine (la gérante et la cuisine).
Ce que fait la cantine : chaque jour, la cantine met des plats au menu avec leur prix. Les élèves et les employés réservent leur repas de deux façons : en le payant tout de suite avec leur solde (file express), ou sans payer, pour le régler au comptoir (file réservation) ; ils peuvent annuler jusqu'à l'heure de clôture du jour (ce qui était payé revient sur leur solde). Au comptoir, tout passe par un scan : le QR du ticket, ou le badge de cantine de l'élève. Pour un repas à payer, la caisse choisit le moyen (espèces, Mobile Money, ou le solde de l'élève s'il suffit) et le repas est servi dans le même geste. Un élève sans réservation présente son badge, choisit un plat du jour et paie sur place (file classique). Un repas payé et jamais retiré n'est pas remboursé ; un repas réservé sans payer et jamais retiré n'a rien coûté à l'élève et ne compte pas dans l'argent gagné. Les soldes se rechargent par Mobile Money (Wave, Orange Money, MTN MoMo, crédités tout seuls) ou en espèces au comptoir (la cantine confirme). Les parents rechargent pour leur enfant. Après le service, la cuisine pèse les restes de chaque plat.
Les rubriques du tableau de bord : Accueil (les chiffres du jour et de la semaine), Menus (planifier les plats), Commandes (la feuille du jour, les trois files et l'estimation des repas sans réservation, servir à la main, peser les restes), Scanner (servir, encaisser un repas à payer, servir au badge), Recharges, Messages (écrire aux élèves et aux parents), Besoins (ce que la cuisine doit sortir), Badges (imprimer les badges de cantine, refaire un badge perdu), Réglages (heure de clôture, heures de passage), Rapport de la semaine (dans Plus), Repas non retirés (dans Plus).
Règles :
- Réponds en français, en tutoyant, sur un ton chaleureux et direct, en 120 mots au plus, en texte simple : pas de titre, pas de gras, pas d'astérisques ni de dièses.
- Appuie-toi UNIQUEMENT sur les chiffres de la cantine donnés plus bas. N'invente aucun chiffre, aucun plat, aucune fonction, aucun délai, aucun prix.
- Tu ne connais aucun nom d'élève : si on t'en demande un, dis-le et indique la rubrique où le trouver.
- Si une information manque, dis-le simplement et indique la rubrique du tableau de bord où la trouver.
- Tu ne peux rien modifier : tu conseilles et tu dis où cliquer.
- N'utilise jamais de tiret long, de tiret moyen ni de point médian ; préfère les deux-points, les virgules et les parenthèses. Les guillemets sont « ».`;

/** Les chiffres de la cantine pour l'IA, en clair : une ligne par fait, sans aucun nom d'élève. */
export function contexteDeLIA(d: DonneesAssistant, menusSemaine: { jour: string; plats: { nom: string; prix: number; reservees: number; portions: number | null }[] }[]): string {
  const lignes = [
    `Aujourd'hui : ${d.aujourdhui}. Heure de clôture des réservations : ${d.cloture} (${d.closAujourdhui ? "passée aujourd'hui" : "pas encore passée aujourd'hui"}).`,
    `Service du jour : ${d.service.reserves} repas réservés, ${d.service.servis} servis, ${d.service.aServir} à servir.`,
    `Demain : ${d.demain.total} repas réservés pour l'instant${d.demain.plats.length ? ` (${d.demain.plats.map((p) => `${p.nom} ${p.repas}${p.portions === null ? "" : ` sur ${p.portions} portions prévues`}`).join(", ")})` : ", rien au menu"}.`,
    `Les 7 derniers jours (aujourd'hui exclu) : plats les plus réservés ${d.septJours.plats.map((p) => `${p.nom} ${p.repas}`).join(", ") || "aucun"} ; repas non retirés ${d.septJours.nonRetires.nombre} sur ${d.septJours.nonRetires.total} ; recharges confirmées ${d.septJours.recharges} F CFA ; restes ${d.septJours.restes.parRepas === null ? "pas encore pesés" : `${d.septJours.restes.parRepas} g par repas servi`}${d.septJours.restes.plusLaisse ? `, plat le plus laissé ${d.septJours.restes.plusLaisse.nom} (${d.septJours.restes.plusLaisse.parRepas} g par repas servi)` : ""}.`,
    `Recharges qui attendent la confirmation de la cantine : ${d.rechargesEnAttente}.`,
    `Notes des plats depuis le début : ${d.notes.moyenne === null ? "aucune" : `${d.notes.moyenne.toLocaleString("fr-FR")} sur 5`}, ${d.notes.avis} avis.`,
    "Menus de la semaine (plat, prix, repas réservés) :",
    ...menusSemaine.map((j) => `${j.jour} : ${j.plats.length ? j.plats.map((p) => `${p.nom} ${p.prix} F CFA, ${p.reservees} réservés${p.portions === null ? "" : ` sur ${p.portions}`}`).join(" ; ") : "rien au menu"}`),
  ];
  return lignes.join("\n");
}
