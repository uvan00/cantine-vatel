"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CIBLES } from "@/lib/messages";
import { envoyerMessage, supprimerMessage } from "@/lib/operations";
import { autorise } from "@/lib/session";

// Les messages de la cantine : les écrire et les retirer. La règle (titre, longueur, à qui) est relue par
// src/lib/operations.ts avec `refusMessage` avant d'écrire.

type Reponse = { ok: true } | { ok: false; erreur: string };
const SESSION: Reponse = { ok: false, erreur: "Reconnecte-toi avec le compte de la cantine" };

const Message = z.object({ titre: z.string().max(200), texte: z.string().max(2000), cible: z.enum(CIBLES), epingle: z.boolean() });
const Id = z.string().min(1).max(40).regex(/^[a-z0-9]+$/i);

/** Ce qu'un message change : la page des messages de la cantine, l'onglet et la pastille de chacun. */
const rafraichir = () => revalidatePath("/", "layout");

export async function envoyer(saisi: z.infer<typeof Message>): Promise<Reponse> {
  const moi = await autorise("admin");
  if (!moi) return SESSION;
  const v = Message.safeParse(saisi);
  if (!v.success) return { ok: false, erreur: "Un message incomplet" };
  const r = await envoyerMessage(moi.id, v.data);
  if (r.ok) rafraichir();
  return r;
}

export async function retirer(messageId: string): Promise<Reponse> {
  if (!(await autorise("admin"))) return SESSION;
  const id = Id.safeParse(messageId);
  if (!id.success) return { ok: false, erreur: "Message introuvable" };
  const r = await supprimerMessage(id.data);
  if (r.ok) rafraichir();
  return r;
}
