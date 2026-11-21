// La borne d'entrée ne tourne plus sur la session de la cantine. La cantine la lance sur l'appareil : sa session s'y
// ferme, et l'appareil garde à la place un laissez-passer signé, qui ne permet qu'une chose, valider un ticket, et qui
// s'éteint tout seul. Signature HMAC SHA-256 avec le secret du serveur, comparée en temps constant.
// Règles pures (le secret et l'instant sont donnés), testées par `npm test`.
import { createHmac, timingSafeEqual } from "node:crypto";

export const COOKIE_BORNE = "cantine.borne";

/** Une borne lancée le matin tient la journée de service : 14 heures, puis il faut la relancer. */
export const DUREE_BORNE_MS = 14 * 3_600_000;

const signature = (secret: string, expire: number) => createHmac("sha256", secret).update(`borne.${expire}`).digest("hex");

/** Le laissez-passer : « <instant de fin>.<signature> ». */
export const signerBorne = (secret: string, expire: number) => `${expire}.${signature(secret, expire)}`;

/** Vrai si ce laissez-passer est bien le nôtre et n'a pas dépassé son heure. */
export function borneValable(jeton: string | undefined | null, secret: string, maintenant: number): boolean {
  if (!jeton || !secret) return false;
  const [instant, signe, ...reste] = jeton.split(".");
  const expire = Number(instant);
  if (reste.length > 0 || !Number.isInteger(expire) || !/^[0-9a-f]{64}$/.test(signe ?? "")) return false;
  if (expire <= maintenant) return false;
  return timingSafeEqual(Buffer.from(signature(secret, expire), "hex"), Buffer.from(signe, "hex"));
}
