"use server";

import {
  QUESTIONS, QUESTION_MAX, contexteDeLIA, estQuestionGuidee, historiquePropre, questionProche, repondre, restantesAujourdhui,
  type DonneesAssistant, type Lien,
} from "@/lib/assistant";
import { lireReglages } from "@/lib/donnees";
import { menusDeLaSemaine, tableauDeBord } from "@/lib/donnees-admin";
import { maintenant } from "@/lib/horloge";
import { iaBranchee, repondreAssistant } from "@/lib/ia";
import { cloturePassee, clotureLisible, jourIso, jourLong, lundiDe } from "@/lib/jours";
import { autorise } from "@/lib/session";

// L'assistant du tableau de bord de la cantine, façon LinkAfr (demande du propriétaire du 21/11/2026). Les questions
// guidées se répondent ici avec les vrais chiffres, sans IA et sans rien coûter. Une question libre part vers Claude
// seulement si la clé de la cantine est posée, dans la limite de PLAFOND_JOUR questions par jour pour toute la cantine
// (choix du propriétaire). Le fil de la conversation est gardé dans le navigateur de la cantine : rien n'est écrit en
// base, et rien de ce qui part vers l'IA ne nomme un élève (src/lib/assistant.ts).

const REFUS = "Reconnecte-toi avec le compte de la cantine";

/** Le compteur des questions libres du jour. Il vit dans le serveur : un redémarrage le remet à zéro. */
const compteur = { jour: "", n: 0 };

async function donnees(instant: number): Promise<DonneesAssistant> {
  const [t, reglages] = await Promise.all([tableauDeBord(instant), lireReglages()]);
  return {
    aujourdhui: jourLong(t.aujourdhui),
    service: t.service,
    cloture: clotureLisible(reglages.heureCloture),
    closAujourdhui: cloturePassee(t.aujourdhui, instant, reglages.heureCloture),
    demain: { total: t.demain.total, plats: t.demain.plats.map((p) => ({ nom: p.nom, repas: p.repas, portions: p.portions })) },
    septJours: {
      plats: t.septJours.plats.map((p) => ({ nom: p.nom, repas: p.repas })),
      nonRetires: t.septJours.nonRetires,
      recharges: t.septJours.recharges,
      restes: { parRepas: t.septJours.restes.parRepas, plusLaisse: t.septJours.restes.plusLaisse },
    },
    rechargesEnAttente: t.rechargesEnAttente,
    notes: t.notes,
  };
}

/** De quoi ouvrir le panneau : le prénom de la gérante, le service du jour, et si l'IA répond (et combien de fois). */
export async function etatAssistant(): Promise<
  | { ok: true; prenom: string; service: DonneesAssistant["service"]; rechargesEnAttente: number; ia: { branchee: boolean; restantes: number } }
  | { ok: false; erreur: string }
> {
  const m = await autorise("admin");
  if (!m) return { ok: false, erreur: REFUS };
  const instant = maintenant();
  const d = await donnees(instant);
  return {
    ok: true,
    prenom: m.nom.trim().split(/\s+/)[0] ?? "",
    service: d.service,
    rechargesEnAttente: d.rechargesEnAttente,
    ia: { branchee: iaBranchee(), restantes: restantesAujourdhui(compteur, jourIso(instant)) },
  };
}

/** Une question guidée : la réponse vient des vrais chiffres, sans IA. */
export async function repondreQuestion(id: string): Promise<{ ok: true; question: string; reponse: string; lien: Lien | null } | { ok: false; erreur: string }> {
  if (!(await autorise("admin"))) return { ok: false, erreur: REFUS };
  if (!estQuestionGuidee(id)) return { ok: false, erreur: "Cette question n'existe pas" };
  const r = repondre(id, await donnees(maintenant()));
  return { ok: true, question: QUESTIONS.find((q) => q.id === id)?.question ?? "", ...r };
}

/** Une question libre. Sans clé d'IA, la question guidée la plus proche répond ; avec, Claude, dans le plafond du jour. */
export async function envoyerMessage(texte: string, fil: unknown): Promise<{ ok: true; reponse: string; lien: Lien | null; restantes: number } | { ok: false; erreur: string }> {
  if (!(await autorise("admin"))) return { ok: false, erreur: REFUS };
  const question = String(texte ?? "").trim().slice(0, QUESTION_MAX);
  if (question.length < 2) return { ok: false, erreur: "Écris ta question" };
  const instant = maintenant();
  const jour = jourIso(instant);
  const d = await donnees(instant);

  if (!iaBranchee()) {
    const id = questionProche(question);
    const r = id ? repondre(id, d) : null;
    return {
      ok: true,
      reponse: r?.reponse ?? "Sans clé d'IA, je réponds aux questions guidées : le service du jour, ce qu'il faut préparer demain, le plat qui marche le mieux, les repas non retirés et les recharges en attente. Choisis-en une ci-dessous.",
      lien: r?.lien ?? null,
      restantes: 0,
    };
  }
  if (restantesAujourdhui(compteur, jour) <= 0) {
    return { ok: false, erreur: "Les questions libres du jour sont toutes posées : elles reviennent demain. Les questions guidées restent là." };
  }

  const lundi = lundiDe(jour);
  const menus = await menusDeLaSemaine(lundi);
  const contexte = contexteDeLIA(d, menus.map((j) => ({
    jour: jourLong(j.jour),
    plats: j.plats.map((p) => ({ nom: p.nom, prix: p.prix, reservees: p.reservees, portions: p.portions })),
  })));
  const r = await repondreAssistant(historiquePropre(fil), question, contexte);
  if (!r.ok) return r;
  if (compteur.jour !== jour) { compteur.jour = jour; compteur.n = 0; }
  compteur.n += 1;
  return { ok: true, reponse: r.texte, lien: null, restantes: restantesAujourdhui(compteur, jour) };
}
