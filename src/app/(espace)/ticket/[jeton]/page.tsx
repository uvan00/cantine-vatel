import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { lireReglages } from "@/lib/donnees";
import { ticketDe } from "@/lib/donnees-convive";
import { maintenant } from "@/lib/horloge";
import { clotureLisible, jourIso, jourProche } from "@/lib/jours";
import { qrSvg } from "@/lib/qr";
import { peutAnnuler } from "@/lib/reservation";
import { exiger, origine } from "@/lib/session";
import { EcranTicket, TicketEnDirect, type TicketAffiche } from "./ecran-ticket";

// Le ticket d'un repas, à l'adresse que porte son QR. Le convive y voit son ticket ; le comptoir, qui a ouvert le QR
// avec son téléphone, part au scanner ; pour toute autre personne, ce ticket n'existe pas.
export const metadata: Metadata = { title: "Ton ticket" };

const JETON = /^[0-9a-f]{32}$/;

export default async function PageTicket({ params }: { params: Promise<{ jeton: string }> }) {
  const moi = await exiger();
  const { jeton } = await params;
  if (moi.role === "admin") redirect(`/admin/scanner?cle=${encodeURIComponent(jeton)}`);

  const repas = JETON.test(jeton) ? await ticketDe(jeton) : null;
  if (!repas || repas.conviveId !== moi.id) notFound();

  const instant = maintenant();
  const { heureCloture } = await lireReglages();
  const annulation = peutAnnuler(repas, instant, heureCloture);
  const ticket: TicketAffiche = {
    id: repas.id,
    jeton: repas.jeton,
    convive: repas.convive,
    plat: repas.plat,
    jour: repas.jour,
    prix: repas.prix,
    code: repas.code,
    reserveLe: repas.reserveLe,
    qr: await qrSvg(`${await origine()}/ticket/${repas.jeton}`),
    quand: jourProche(repas.jour, instant),
    instant,
    refusAnnulation: annulation.ok ? null : annulation.phrase,
    clotureLisible: clotureLisible(heureCloture),
    creneau: repas.creneau,
    note: repas.note,
    mot: repas.mot,
  };
  const etat = { etat: repas.etat, serviLe: repas.serviLe };

  // Seul le ticket d'aujourd'hui, pas encore servi, peut changer sous les yeux du convive : lui seul se relit en direct.
  return repas.etat === "reservee" && repas.jour === jourIso(instant)
    ? <TicketEnDirect ticket={ticket} initial={etat} />
    : <EcranTicket ticket={ticket} etat={etat} />;
}
