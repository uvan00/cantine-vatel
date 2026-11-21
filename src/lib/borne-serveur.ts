import "server-only";
import { cookies } from "next/headers";
import { COOKIE_BORNE, borneValable } from "@/lib/borne";

// Le laissez-passer de la borne, lu dans les cookies de l'appareil (règles dans src/lib/borne.ts).

export const secretBorne = () => process.env.BETTER_AUTH_SECRET ?? "";

/** Vrai si cet appareil porte un laissez-passer de borne valable. */
export async function borneLancee(): Promise<boolean> {
  return borneValable((await cookies()).get(COOKIE_BORNE)?.value, secretBorne(), Date.now());
}
