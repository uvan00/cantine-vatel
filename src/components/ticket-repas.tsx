import { Table } from "@/components/brand";
import { dateLongue, fcfa } from "@/lib/format";
import { jourLong } from "@/lib/jours";
import { heureH, nomDeLaFile, paiementLisible, type EtatAffiche } from "@/lib/reservation";

// LE TICKET REPAS : le moment de la cantine, dessiné d'après le modèle de tickets repas donné par le propriétaire le
// 21/11/2026 (classes .ticket-repas de globals.css). La partie bleue porte le repas et la marque Vatel, le talon blanc
// porte le QR et le code court, un pointillé et deux encoches les séparent. Le code court tient la place du code-barres
// du modèle (il sert au comptoir si la caméra ne lit pas le QR). Le comptoir scanne, et le tampon « SERVI » tombe. Un
// ticket annulé porte « ANNULÉ », un repas jamais retiré « NON RETIRÉ », et la partie bleue passe au gris. Le tampon a
// sa place réservée : rien ne bouge quand il arrive.
// Sans état propre : il sert tel quel au serveur comme à l'écran qui le relit en direct.

/**
 * La chute du tampon : transform et opacité seulement, 200 ms, en accélérant comme un tampon qu'on abat. Rien du tout
 * si on a demandé moins de mouvement. Au repos, le tampon est incliné de 8 degrés (classes du tampon, plus bas).
 */
const CSS_CHUTE = `
@keyframes tampon-chute { from { opacity: 0; transform: rotate(-8deg) scale(2.2); } to { transform: none; } }
.tampon-tombe { animation: tampon-chute 200ms cubic-bezier(0.4, 0, 1, 1) backwards; }
@media (prefers-reduced-motion: reduce) { .tampon-tombe { animation: none; } }
`;

const eteint = (etat: EtatAffiche) => etat === "annulee" || etat === "non_retiree";

function Tampon({ etat, serviLe, tombe = false, petit = false, className = "" }: {
  etat: EtatAffiche;
  serviLe: string | null;
  tombe?: boolean;
  /** Sur le ticket couché : le mot seul, en plus petit. */
  petit?: boolean;
  className?: string;
}) {
  if (etat === "reservee") return null;
  const servi = etat === "servie";
  const heure = servi && serviLe ? `à ${heureH(serviLe)}` : null;
  return (
    <div role="img" aria-label={servi ? `Servi ${heure ?? ""}`.trim() : etat === "annulee" ? "Annulé" : "Non retiré"}
      className={`pointer-events-none absolute -rotate-8 text-center opacity-85 mix-blend-multiply ${petit ? "rounded-[8px] border-2 px-2 py-0.5" : "rounded-[10px] border-[3px] px-3 py-1"} ${servi ? "border-[#072A5D] text-[#072A5D]" : "border-[#072A5D]/55 text-[#072A5D]/55"} ${tombe ? "tampon-tombe" : ""} ${className}`}>
      {etat === "non_retiree" ? (
        // Deux mots : sur deux lignes, un peu plus petits, pour tenir dans la place du tampon.
        <p aria-hidden="true" className={`font-semibold tracking-[0.08em] ${petit ? "text-[14px] leading-4" : "text-[20px] leading-6"}`}>NON<br />RETIRÉ</p>
      ) : (
        <p aria-hidden="true" className={`font-semibold tracking-[0.08em] ${petit ? "text-[18px] leading-6" : "text-[26px] leading-8"}`}>{servi ? "SERVI" : "ANNULÉ"}</p>
      )}
      {heure && !petit && <p aria-hidden="true" className="text-[13px] leading-4 font-medium">{heure}</p>}
    </div>
  );
}

/** La marque Vatel, avec un liseré blanc : sur le bleu du ticket, son bandeau bleu se détache. */
const Marque = ({ className }: { className: string }) => <Table className={`w-auto shrink-0 rounded-[2px] ring-2 ring-white ${className}`} />;

export type DonneesTicket = {
  /** Le nom du convive. */
  convive: string;
  plat: string;
  /** « 2026-11-21 » */
  jour: string;
  /** Le prix payé. */
  prix: number;
  /** Le code court, à donner au comptoir si la caméra ne lit pas le QR. */
  code: string;
  reserveLe: string;
  /** Sa file au comptoir (express, reservation, classique) et comment il est payé (src/lib/reservation.ts). */
  file: string;
  paiement: string;
};

/**
 * Le ticket debout, pour son écran : la partie bleue en haut, le talon au QR en bas. Tout ce qui précède le QR est
 * tenu serré : au comptoir, le QR doit se voir sans faire défiler, même dans un navigateur de téléphone.
 */
export function TicketRepas({ ticket, qr, etat, serviLe, tombe = false, className = "" }: {
  ticket: DonneesTicket;
  qr: string;
  etat: EtatAffiche;
  serviLe: string | null;
  /** Le tampon vient d'arriver sous les yeux du convive : on joue sa chute. */
  tombe?: boolean;
  className?: string;
}) {
  return (
    <div className={`ticket-repas ticket-repas--debout mx-auto w-full max-w-[360px] ${eteint(etat) ? "ticket-repas--eteint" : ""} ${className}`}>
      <style>{CSS_CHUTE}</style>
      <div className="ticket-repas__partie px-5 pt-5 pb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[15px] leading-5 font-bold">Ticket repas</p>
            {/* La file où se ranger au comptoir : express (payé), réservation (à payer), classique (pris sur place). */}
            <p className="mt-1 w-fit rounded-full bg-white/55 px-2.5 py-0.5 text-[13px] leading-5 font-semibold">{nomDeLaFile(ticket.file)}</p>
            <p className="mt-2 text-[24px] leading-[30px] font-semibold">{ticket.plat}</p>
            <p className="mt-1 text-[14px] leading-5 opacity-75">{ticket.convive}</p>
          </div>
          <Marque className="h-10" />
        </div>
        {/* Le jour et le prix à gauche ; à droite, la place du tampon, gardée qu'il soit là ou pas encore. Tant que le
            comptoir n'a pas tamponné, un cadre en pointillé l'attend. */}
        <div className="relative mt-5 min-h-[64px] pr-[124px]">
          <p className="text-[18px] leading-6 font-bold first-letter:uppercase">{jourLong(ticket.jour)}</p>
          <p className="mt-0.5 font-mono text-[14px] leading-5 opacity-80">{fcfa(ticket.prix)}</p>
          <p className={`text-[13px] leading-5 ${ticket.paiement === "a_payer" && etat === "reservee" ? "font-semibold" : "opacity-70"}`}>{paiementLisible(ticket.paiement, etat)}</p>
          {etat === "reservee" && (
            <p className="absolute right-0 bottom-0 grid h-[60px] w-[116px] -rotate-8 place-items-center rounded-[10px] border border-dashed border-[#072A5D]/45 px-1 text-center text-[12px] leading-4 opacity-75">
              ici, le tampon du comptoir
            </p>
          )}
          <Tampon etat={etat} serviLe={serviLe} tombe={tombe} className="right-0 bottom-0" />
        </div>
      </div>
      <div className="ticket-repas__talon px-5 pt-6 pb-5">
        <div className="mx-auto size-[196px] [&>svg]:size-full" role="img" aria-label="Le QR de ton ticket" dangerouslySetInnerHTML={{ __html: qr }} />
        <p className="mt-3 pl-[0.3em] text-center font-mono text-[28px] leading-9 font-medium tracking-[0.3em]">{ticket.code}</p>
        <p className="text-center text-[13px] leading-5 opacity-70">Si le QR ne passe pas, donne ce code</p>
        <p className="mt-3 text-center text-[12px] leading-4 opacity-55">Réservé le {dateLongue(ticket.reserveLe)}</p>
      </div>
    </div>
  );
}

/**
 * Le ticket couché, pour la carte « Aujourd'hui » de la liste : le plat et le jour à gauche, le QR et le code court sur
 * le talon. Le tampon tombe en travers du talon : une fois servi, le QR n'a plus rien à dire.
 */
export function TalonTicket({ ticket, qr, etat, serviLe, className = "" }: {
  ticket: Pick<DonneesTicket, "plat" | "jour" | "prix" | "code" | "file" | "paiement">;
  qr: string;
  etat: EtatAffiche;
  serviLe: string | null;
  className?: string;
}) {
  return (
    <div className={`ticket-repas ticket-repas--couche ${eteint(etat) ? "ticket-repas--eteint" : ""} ${className}`}>
      <div className="ticket-repas__partie min-w-0 flex-1 px-4 pt-4 pb-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[14px] leading-5 font-bold">Ticket repas</p>
          <Marque className="h-8" />
        </div>
        <p className="mt-1 line-clamp-2 text-[18px] leading-6 font-semibold">{ticket.plat}</p>
        <p className="mt-3 text-[14px] leading-5 font-bold first-letter:uppercase">{jourLong(ticket.jour)}</p>
        <p className="font-mono text-[13px] leading-5 opacity-80">{fcfa(ticket.prix)}</p>
        <p className="text-[13px] leading-5 font-semibold">{nomDeLaFile(ticket.file)}{ticket.paiement === "a_payer" && etat === "reservee" ? ", à payer" : ""}</p>
      </div>
      <div className="ticket-repas__talon flex w-[112px] shrink-0 flex-col items-center justify-center px-3 py-4">
        <div className="size-[80px] [&>svg]:size-full" role="img" aria-label="Le QR de ton ticket" dangerouslySetInnerHTML={{ __html: qr }} />
        <p className="mt-2 pl-[0.2em] font-mono text-[16px] leading-5 font-semibold tracking-[0.2em]">{ticket.code}</p>
      </div>
      <Tampon etat={etat} serviLe={serviLe} petit className="top-1/2 right-5 -translate-y-1/2" />
    </div>
  );
}
