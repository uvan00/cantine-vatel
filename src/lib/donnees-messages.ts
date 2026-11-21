import { prisma } from "@/lib/db";
import { dateLongue } from "@/lib/format";
import { ajouterJours, jourIso, lundiDe } from "@/lib/jours";
import { pourQui, type Cible } from "@/lib/messages";
import { heureH } from "@/lib/reservation";
import { estCantine } from "@/lib/roles";
import type { Role } from "@/lib/session";

// Les messages de la cantine (bonus du lot 2) : ce que chacun reçoit, et ce que la cantine a envoyé, avec ses lectures.
// Qui reçoit quoi se décide par la règle pure `pourQui` (src/lib/messages.ts).

/** Combien de messages une personne voit au plus, les épinglés d'abord. */
const MESSAGES_MAX = 30;

const quand = (d: Date) => `${dateLongue(d)} à ${heureH(d)}`;
const lundiDuMessage = (d: Date) => lundiDe(jourIso(d.getTime()));

/** Un message tel que le convive ou le parent le lit ; `quand` est déjà écrit en mots. */
export type MessageRecu = { id: string; titre: string; texte: string; epingle: boolean; quand: string; lu: boolean };

/** Les messages pour cette personne, les épinglés d'abord, puis du plus récent au plus ancien. */
export async function mesMessages(moi: { id: string; role: Role }): Promise<MessageRecu[]> {
  if (estCantine(moi.role)) return [];
  const messages = await prisma.message.findMany({
    orderBy: [{ epingle: "desc" }, { creeLe: "desc" }],
    take: 100,
    include: { lectures: { where: { userId: moi.id }, select: { userId: true } } },
  });
  // « Ceux qui ont réservé cette semaine » : la semaine où le message est parti, pour le convive ou l'un de ses enfants.
  const lundis = [...new Set(messages.filter((m) => m.cible === "semaine").map((m) => lundiDuMessage(m.creeLe)))].sort();
  const semainesReservees = new Set<string>();
  if (lundis.length > 0) {
    const convives = moi.role === "parent"
      ? (await prisma.lienParent.findMany({ where: { parentId: moi.id }, select: { enfantId: true } })).map((l) => l.enfantId)
      : [moi.id];
    const reservees = await prisma.reservation.findMany({
      where: { conviveId: { in: convives }, jour: { gte: lundis[0], lte: ajouterJours(lundis[lundis.length - 1], 6) }, etat: { not: "annulee" } },
      select: { jour: true },
      distinct: ["jour"],
    });
    for (const r of reservees) semainesReservees.add(lundiDe(r.jour));
  }
  return messages
    .filter((m) => pourQui(m.cible, { role: moi.role, reserveCetteSemaine: semainesReservees.has(lundiDuMessage(m.creeLe)) }))
    .slice(0, MESSAGES_MAX)
    .map((m) => ({ id: m.id, titre: m.titre, texte: m.texte, epingle: m.epingle, quand: quand(m.creeLe), lu: m.lectures.length > 0 }));
}

/** La pastille de l'onglet « Messages » : combien cette personne n'en a pas encore lu. */
export async function nombreNonLus(moi: { id: string; role: Role }): Promise<number> {
  return (await mesMessages(moi)).filter((m) => !m.lu).length;
}

/** Un message envoyé, tel que la cantine le revoit : à qui il est allé, et combien de personnes l'ont lu. */
export type MessageEnvoye = { id: string; titre: string; texte: string; cible: Cible; epingle: boolean; quand: string; lus: number };

export async function messagesEnvoyes(): Promise<MessageEnvoye[]> {
  const messages = await prisma.message.findMany({
    orderBy: [{ epingle: "desc" }, { creeLe: "desc" }],
    take: 50,
    include: { _count: { select: { lectures: true } } },
  });
  return messages.map((m) => ({ id: m.id, titre: m.titre, texte: m.texte, cible: m.cible as Cible, epingle: m.epingle, quand: quand(m.creeLe), lus: m._count.lectures }));
}
