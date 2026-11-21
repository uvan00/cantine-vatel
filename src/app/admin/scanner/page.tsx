import type { Metadata } from "next";
import { z } from "zod";
import { serviceDuJour, ticketPourScan } from "@/lib/donnees-admin";
import { maintenant } from "@/lib/horloge";
import { jourIso, jourProche } from "@/lib/jours";
import { CANTINE, exiger } from "@/lib/session";
import { lireCle } from "@/lib/ticket";
import { ScannerClient, type TicketOuvert } from "./scanner-client";

export const metadata: Metadata = { title: "Scanner" };

const Cle = z.string().trim().min(1).max(300);

/**
 * Le scanner du comptoir. Avec `?cle=<jeton>` (quelqu'un a lu le QR d'un ticket avec l'appareil photo de son téléphone),
 * la page montre le ticket trouvé et attend « Servir ce ticket » : une adresse ouverte ne change jamais rien dans la base.
 */
export default async function PageScanner({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await exiger(...CANTINE);
  const instant = maintenant();
  const cle = Cle.safeParse((await searchParams).cle);
  const [service, ticket] = await Promise.all([
    serviceDuJour(jourIso(instant)),
    cle.success ? ticketPourScan(cle.data, instant) : null,
  ]);
  const ouvert: TicketOuvert | null = !cle.success ? null : ticket ? { ...ticket, quand: jourProche(ticket.jour, instant) } : "inconnu";
  // Un badge lu par l'appareil photo, sans repas réservé aujourd'hui : la caisse s'ouvre sur les plats du jour (file
  // classique). Rien ne change dans la base tant que la caisse n'a pas encaissé.
  const lue = cle.success && !ticket ? lireCle(cle.data) : null;
  const badge = cle.success && lue && "carte" in lue ? cle.data : null;
  return <ScannerClient service={service} ticket={badge ? null : ouvert} badge={badge} />;
}
