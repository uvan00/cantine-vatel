// La suggestion de la semaine (bonus 5 du cahier) : l'IA lit les chiffres du rapport (src/lib/rapport.ts) et propose à
// l'équipe de la cantine quelques gestes pour la semaine qui vient. Ici, les règles pures, testées par `npm test` : ce
// qui part vers l'IA (des chiffres et des noms de plats, jamais un nom d'élève), sa consigne, et la lecture de sa
// réponse. La règle « aucun chiffre inventé » tient par construction : la suggestion ne contient AUCUN chiffre (ils
// sont dans le rapport, juste au-dessus), et une réponse qui en contient un est refusée.
import { z } from "zod";
import { nomDuJour } from "./jours.ts";
import type { Rapport } from "./rapport.ts";

/** Au plus quatre suggestions : de quoi agir, pas un second rapport. */
export const SUGGESTIONS_MAX = 4;

export type Suggestion = { titre: string; texte: string };

export const CONSIGNE = `Tu aides l'équipe de la cantine de Vatel, l'école hôtelière d'Abidjan, à préparer la semaine qui vient.
Tu reçois, en JSON, les chiffres d'une semaine : les repas réservés, servis, non retirés (réservés mais jamais venus chercher) et annulés, jour par jour et plat par plat, les notes des élèves sur cinq, les restes pesés après le service, les recharges des comptes.
Les repas d'aujourd'hui et des jours suivants ne sont pas encore servis : ne les compte jamais comme non retirés, appuie-toi sur « nonRetires ».
Écris de deux à quatre suggestions pour la cantine : chacune est un geste concret à faire la semaine prochaine, appuyé sur ce que montrent ces chiffres (un plat à refaire ou à revoir, un jour où beaucoup de repas ne sont pas retirés, des restes à réduire, et ainsi de suite).
Règles d'écriture :
- en français, en tutoyant l'équipe, sur un ton chaleureux et direct ;
- un titre de quelques mots, puis un texte de deux phrases au plus ;
- aucun nombre, ni en chiffres ni en lettres : le rapport affiche déjà les chiffres à côté de ta suggestion ; nomme les jours par leur nom (« vendredi ») et les plats par leur nom ;
- n'invente rien : parle seulement de ce que les données montrent ; si elles sont trop maigres pour conclure, dis-le dans une seule suggestion ;
- pas de tiret long ni de tiret moyen, pas de point médian, pas d'emoji ; les guillemets sont « ».`;

/** Le format de la réponse, imposé à l'IA (sorties structurées) : une liste de suggestions, chacune un titre et un texte. */
export const FORMAT_SUGGESTIONS = {
  type: "object",
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        properties: { titre: { type: "string" }, texte: { type: "string" } },
        required: ["titre", "texte"],
        additionalProperties: false,
      },
    },
  },
  required: ["suggestions"],
  additionalProperties: false,
};

/** Ce qui part vers l'IA : les chiffres du rapport, les jours par leur nom, les plats par leur nom. Aucun nom de convive. */
export function donneesPourLIA(r: Rapport) {
  return {
    jours: r.jours.map((j) => ({ jour: nomDuJour(j.jour), reserves: j.reserves, servis: j.servis, nonRetires: j.nonRetires, annules: j.annules, restesPesesEnGrammes: j.restes })),
    total: { reserves: r.total.reserves, servis: r.total.servis, nonRetires: r.total.nonRetires, annules: r.total.annules, payeEnFrancsCfa: r.total.paye },
    partDesNonRetiresSurLesJoursFinis: r.partNonRetires === null ? null : `${r.partNonRetires} %`,
    plats: r.plats.map((p) => ({ nom: p.nom, repas: p.repas, servis: p.servis, nonRetires: p.nonRetires, noteSurCinq: p.note, avis: p.avis })),
    noteMoyenneDeLaSemaine: r.notes.moyenne,
    restes: { grammes: r.restes.grammes, repasServisPeses: r.restes.servis, grammesParRepas: r.restes.parRepas, platLePlusLaisse: r.restes.plusLaisse?.nom ?? null },
    recharges: { nombre: r.recharges.nombre, montantEnFrancsCfa: r.recharges.montant },
  };
}

const Reponse = z.object({
  suggestions: z.array(z.object({ titre: z.string().trim().min(1).max(120), texte: z.string().trim().min(1).max(600) })).min(1),
});

/** Les tirets et le point médian que les règles du projet bannissent de l'écran, remplacés par une virgule. */
const nettoyer = (t: string) => t.replace(/\s*[\u2014\u2013\u00b7]\s*/g, ", ").trim();

/**
 * Une quantité écrite en mots (« deux fois plus », « la moitié », « presque tous », « la plupart ») : c'est un chiffre
 * que rien n'a calculé, il ne passe pas plus qu'un chiffre écrit en chiffres.
 */
const QUANTITE_EN_MOTS = /(?<![\p{L}])(deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|treize|quatorze|quinze|seize|vingt|trente|quarante|cinquante|soixante|cents?|mille|millions?|milliers?|dizaines?|douzaines?|centaines?|moitié|tiers|quarts?|double|triple|pour ?cent|presque tou(?:s|t|te|tes)|quasi|la plupart|majorité|minorité)(?![\p{L}])/iu;

/**
 * La réponse de l'IA, lue et vérifiée : du JSON de la bonne forme, au plus quatre suggestions, aucun chiffre et aucune
 * quantité écrite en mots. Une réponse qui ne passe pas n'est pas montrée ; la raison dit pourquoi.
 */
export function lireSuggestions(brut: string): { ok: true; suggestions: Suggestion[] } | { ok: false; raison: "illisible" | "forme" | "chiffre" } {
  let json: unknown;
  try {
    json = JSON.parse(brut);
  } catch {
    return { ok: false, raison: "illisible" };
  }
  const v = Reponse.safeParse(json);
  if (!v.success) return { ok: false, raison: "forme" };
  const suggestions = v.data.suggestions.slice(0, SUGGESTIONS_MAX);
  if (suggestions.some((s) => /\d/.test(`${s.titre} ${s.texte}`) || QUANTITE_EN_MOTS.test(`${s.titre} ${s.texte}`))) return { ok: false, raison: "chiffre" };
  return { ok: true, suggestions: suggestions.map((s) => ({ titre: nettoyer(s.titre), texte: nettoyer(s.texte) })) };
}
