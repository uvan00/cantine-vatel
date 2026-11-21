"use client";

import { EnTeteEspace } from "@/components/coque-espace";
import { creneauLisible } from "@/lib/creneaux";
import { AlertTriangle } from "@/components/icons";
import { SAlert, SBtn, SBtnLink } from "@/components/sneat";
import { TicketRepas, type DonneesTicket } from "@/components/ticket-repas";
import { useDirect } from "@/hooks/use-direct";
import { fcfa } from "@/lib/format";
import { etatAffiche, heureH } from "@/lib/reservation";
import { useAnnulation } from "@/app/(espace)/menu/annulation";
import { NoterRepas } from "@/app/(espace)/ticket/noter";

// L'écran du ticket : le ticket sur l'ardoise, comme à l'accueil, puis le geste du moment (annuler tant que c'est
// possible, noter une fois servi). Le ticket d'aujourd'hui se relit toutes les 3 secondes : quand le comptoir le scanne,
// le tampon « SERVI » tombe sous les yeux du convive.

export type TicketAffiche = DonneesTicket & {
  id: string;
  jeton: string;
  /** Le QR du ticket, en SVG, fabriqué par le serveur. */
  qr: string;
  /** « aujourd'hui », « demain », ou le jour en toutes lettres. */
  quand: string;
  /** L'instant où le serveur a rendu la page : il sert à dire « non retiré » sans relire l'heure ici. */
  instant: number;
  /** Pourquoi ce repas ne s'annule pas (peutAnnuler de src/lib/reservation.ts) ; null : il s'annule encore. */
  refusAnnulation: string | null;
  clotureLisible: string;
  /** L'heure de passage choisie (« 12:15 ») ; null sans créneaux. */
  creneau: string | null;
  /** La note déjà donnée à ce repas, s'il a été noté. */
  note: number | null;
  mot: string;
};

export type EtatTicket = { etat: string; serviLe: string | null };

/** Sur l'ardoise, l'encre et les gris du kit passent au clair, comme à l'accueil. */
const SUR_ARDOISE = { "--sn-on": "255 255 255", "--h-texte-2": "rgb(255 255 255 / 0.7)", "--h-survol": "rgb(255 255 255 / 0.12)" } as React.CSSProperties;

/** Le ticket d'aujourd'hui, relu en direct jusqu'à ce que le comptoir le scanne. */
export function TicketEnDirect({ ticket, initial }: { ticket: TicketAffiche; initial: EtatTicket }) {
  const [etat] = useDirect<EtatTicket>(`/api/ticket/${ticket.jeton}`, initial, 3000);
  return <EcranTicket ticket={ticket} etat={etat} tombe={initial.etat !== "servie" && etat.etat === "servie"} />;
}

export function EcranTicket({ ticket, etat, tombe = false }: { ticket: TicketAffiche; etat: EtatTicket; tombe?: boolean }) {
  const annulation = useAnnulation();
  const affiche = etatAffiche({ etat: etat.etat, jour: ticket.jour }, ticket.instant);

  const sousTitre =
    affiche === "servie" ? (etat.serviLe ? `Servi à ${heureH(etat.serviLe)}, bon appétit` : "Servi, bon appétit")
    : affiche === "annulee" ? "Ce repas est annulé"
    : affiche === "non_retiree" ? "Ce repas n'a pas été retiré"
    : ticket.quand === "aujourd'hui" ? (ticket.creneau ? `Passage à ${creneauLisible(ticket.creneau)} : un scan au comptoir, et c'est servi` : "Un scan au comptoir, et c'est servi")
    : `À montrer au comptoir ${ticket.quand}${ticket.creneau ? `, passage à ${creneauLisible(ticket.creneau)}` : ""}`;

  return (
    <main>
      <div className="ardoise pb-10" style={SUR_ARDOISE}>
        <EnTeteEspace titre="Ton ticket" sousTitre={<span className="chiffres" aria-live="polite">{sousTitre}</span>} retour={{ href: "/ticket", libelle: "Tes tickets" }} />
        <div className="px-4">
          <TicketRepas ticket={ticket} qr={ticket.qr} etat={affiche} serviLe={etat.serviLe} tombe={tombe} />
        </div>
      </div>

      <div className="space-y-4 px-4 pt-6">
        <div aria-live="polite" className="empty:hidden">
          {annulation.erreur && <SAlert tone="error" Icon={AlertTriangle}>{annulation.erreur}</SAlert>}
        </div>
        {affiche === "reservee" && (ticket.refusAnnulation === null ? (
          <div>
            <SBtn variant="outlined" tone="error" block disabled={annulation.enCours} onClick={() => annulation.annuler(ticket)}>Annuler ce repas</SBtn>
            <p className="chiffres mt-3 text-center text-[14px] leading-5 text-texte-2">
              Possible jusqu&apos;à {ticket.clotureLisible} le jour du repas : {fcfa(ticket.prix)} reviennent sur ton solde tout de suite
            </p>
          </div>
        ) : (
          <p className="text-center text-[14px] leading-5 text-texte-2">{ticket.refusAnnulation}</p>
        ))}
        {affiche === "servie" && <NoterRepas reservationId={ticket.id} plat={ticket.plat} note={ticket.note} mot={ticket.mot} forme="bouton" />}
        {affiche === "annulee" && (
          <>
            <p className="chiffres text-center text-[14px] leading-5 text-texte-2">{fcfa(ticket.prix)} sont revenus sur ton solde</p>
            <SBtnLink href="/menu" tone="secondary" block>Voir le menu</SBtnLink>
          </>
        )}
        {affiche === "non_retiree" && (
          <p className="text-center text-[14px] leading-5 text-texte-2">Personne n&apos;est passé le chercher. Il n&apos;est pas remboursé : la cuisine l&apos;avait préparé pour toi.</p>
        )}
      </div>
      {annulation.fenetre}
    </main>
  );
}
