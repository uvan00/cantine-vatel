import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { CONSIGNE_ASSISTANT, nettoyerReponse, type MessageFil } from "@/lib/assistant";
import { periodeDuRapport, type Rapport } from "@/lib/rapport";
import { CONSIGNE, FORMAT_SUGGESTIONS, donneesPourLIA, lireSuggestions, type Suggestion } from "@/lib/suggestion";

// L'appel à l'IA (Claude, d'Anthropic) pour la suggestion de la semaine (bonus 5 du cahier). Il ne part que si le
// propriétaire a posé lui-même la clé de la cantine (ANTHROPIC_API_KEY dans .env.local, par ./scripts/cle-ia.sh) :
// sans elle, rien ne part. La clé ne quitte jamais le serveur et ne s'affiche nulle part.

const MODELE = "claude-opus-5-5";

/** La cantine a-t-elle sa clé d'IA ? Seule une clé posée dans la configuration du serveur compte. */
export const iaBranchee = () => Boolean(process.env.ANTHROPIC_API_KEY?.trim());

const RAISONS = {
  illisible: "La réponse de l'IA n'avait pas la bonne forme, réessaie",
  forme: "La réponse de l'IA n'avait pas la bonne forme, réessaie",
  chiffre: "La suggestion citait des chiffres : elle n'est pas montrée, réessaie",
} as const;

export async function redigerSuggestion(r: Rapport): Promise<{ ok: true; suggestions: Suggestion[] } | { ok: false; erreur: string }> {
  const cle = process.env.ANTHROPIC_API_KEY?.trim();
  if (!cle) return { ok: false, erreur: "La cantine n'a pas encore de clé d'IA" };
  // Une suggestion se rédige en quelques secondes : au-delà d'une minute et demie, on rend la main.
  const client = new Anthropic({ apiKey: cle, timeout: 90_000, maxRetries: 1 });
  try {
    const reponse = await client.beta.messages.create({
      model: MODELE,
      max_tokens: 16000,
      // Si le modèle décline, l'API reprend la même demande sur un autre modèle, dans le même appel.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: FORMAT_SUGGESTIONS } },
      system: CONSIGNE,
      messages: [{ role: "user", content: `Les chiffres de la semaine ${periodeDuRapport(r)} :\n${JSON.stringify(donneesPourLIA(r))}` }],
    });
    if (reponse.stop_reason === "refusal") return { ok: false, erreur: "L'IA n'a pas rédigé de suggestion pour cette semaine" };
    if (reponse.stop_reason === "max_tokens") return { ok: false, erreur: "La réponse de l'IA a été coupée, réessaie" };
    const texte = reponse.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    const lue = lireSuggestions(texte);
    return lue.ok ? lue : { ok: false, erreur: RAISONS[lue.raison] };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { ok: false, erreur: "La clé d'IA n'est pas acceptée : il faut la reposer" };
    if (e instanceof Anthropic.RateLimitError) return { ok: false, erreur: "L'IA reçoit trop de demandes, réessaie dans une minute" };
    if (e instanceof Anthropic.APIConnectionError) return { ok: false, erreur: "L'IA ne répond pas, vérifie le réseau et réessaie" };
    if (e instanceof Anthropic.APIError) {
      console.error("Suggestion de l'IA impossible :", e.status, e.message);
      return { ok: false, erreur: "L'IA n'a pas pu répondre, réessaie" };
    }
    throw e;
  }
}

/**
 * Une question libre à l'assistant de la cantine (src/lib/assistant.ts) : la consigne et les chiffres du moment, sans
 * aucun nom d'élève, puis le fil de la conversation et la question. Effort bas : une réponse courte, vite.
 */
export async function repondreAssistant(historique: MessageFil[], question: string, contexte: string): Promise<{ ok: true; texte: string } | { ok: false; erreur: string }> {
  const cle = process.env.ANTHROPIC_API_KEY?.trim();
  if (!cle) return { ok: false, erreur: "La cantine n'a pas encore de clé d'IA" };
  const client = new Anthropic({ apiKey: cle, timeout: 60_000, maxRetries: 1 });
  try {
    const reponse = await client.beta.messages.create({
      model: MODELE,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      // La consigne ne change pas d'une question à l'autre : elle se garde en cache ; les chiffres, eux, changent.
      system: [
        { type: "text", text: CONSIGNE_ASSISTANT, cache_control: { type: "ephemeral" } },
        { type: "text", text: `Les chiffres de la cantine à cet instant :\n${contexte}` },
      ],
      messages: [...historique, { role: "user", content: question }],
    });
    if (reponse.stop_reason === "refusal") return { ok: true, texte: "Je ne peux pas répondre à cette question. Essaie de la formuler autrement, ou choisis une question guidée." };
    const texte = nettoyerReponse(reponse.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n"));
    return { ok: true, texte: texte || "Je n'ai pas de réponse utile à te donner. Reformule ta question." };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { ok: false, erreur: "La clé d'IA n'est pas acceptée : il faut la reposer" };
    if (e instanceof Anthropic.RateLimitError) return { ok: false, erreur: "L'assistant est très demandé, réessaie dans une minute" };
    if (e instanceof Anthropic.APIConnectionError) return { ok: false, erreur: "L'assistant ne répond pas, vérifie le réseau et réessaie" };
    if (e instanceof Anthropic.APIError) {
      console.error("Assistant de la cantine :", e.status, e.message);
      return { ok: false, erreur: "L'assistant n'a pas pu répondre, réessaie" };
    }
    throw e;
  }
}
