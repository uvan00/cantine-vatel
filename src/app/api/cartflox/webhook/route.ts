import { signatureValide } from "@/lib/cartflox";
import { cleSecreteCartflox, traiterWebhookCartflox } from "@/lib/cartflox-serveur";

// Les webhooks de Cartflox (paiement réussi, échoué, annulé). L'adresse se déclare dans l'espace Cartflox du compte
// (Développeurs, Webhooks) : https://<adresse de la cantine>/api/cartflox/webhook.
// Cartflox signe chaque envoi avec la clé secrète du compte (en-tête X-Afriflow-Signature) : sans signature valable,
// rien n'est lu. Même signé, le message ne fait pas foi : le serveur relit le paiement chez Cartflox avant de créditer.
// Sans webhook, rien ne se perd : la page de la recharge et celle de la cantine relisent les paiements en attente.
export const dynamic = "force-dynamic";

const reponse = (corps: unknown, status = 200) => Response.json(corps, { status, headers: { "cache-control": "no-store" } });

export async function POST(requete: Request) {
  const secret = cleSecreteCartflox();
  if (!secret) return reponse({ erreur: "Cartflox n'est pas branché ici" }, 503);
  const corps = await requete.text();
  if (!signatureValide(corps, requete.headers.get("x-afriflow-signature"), secret, Math.floor(Date.now() / 1000))) {
    return reponse({ erreur: "Signature refusée" }, 401);
  }
  let message: { event?: unknown; data?: { id?: unknown; metadata?: { cantine_recharge?: unknown } } };
  try {
    message = JSON.parse(corps);
  } catch {
    return reponse({ erreur: "Message illisible" }, 400);
  }
  const evenement = String(message.event ?? "");
  const sessionId = String(message.data?.id ?? "");
  const recharge = typeof message.data?.metadata?.cantine_recharge === "string" ? message.data.metadata.cantine_recharge : null;
  if (evenement.startsWith("payment.") && sessionId) await traiterWebhookCartflox(sessionId, recharge);
  return reponse({ recu: true });
}
