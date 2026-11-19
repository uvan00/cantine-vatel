import { dateLongue, fcfa } from "@/lib/format";
import { jourLong } from "@/lib/jours";
import { MARQUE } from "@/lib/marque";
import { heureH, type EtatAffiche } from "@/lib/reservation";

// LE TICKET REPAS : le moment de la cantine. Il est dessiné comme un vrai ticket de caisse (papier, chasse fixe, bord
// dentelé : classes .ticket et .ticket-ombre de globals.css). Le comptoir scanne son QR, et le tampon « SERVI » tombe
// dessus. Un ticket annulé porte « ANNULÉ » en gris, un repas jamais retiré « NON RETIRÉ ». Le tampon a sa place
// réservée : rien ne bouge quand il arrive.
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

function Tampon({ etat, serviLe, tombe = false, petit = false, className = "" }: {
  etat: EtatAffiche;
  serviLe: string | null;
  tombe?: boolean;
  /** Sur le talon : le mot seul, en plus petit (l'heure est écrite à côté). */
  petit?: boolean;
  className?: string;
}) {
  if (etat === "reservee") return null;
  const servi = etat === "servie";
  const heure = servi && serviLe ? `à ${heureH(serviLe)}` : null;
  return (
    <div role="img" aria-label={servi ? `Servi ${heure ?? ""}`.trim() : etat === "annulee" ? "Annulé" : "Non retiré"}
      className={`pointer-events-none absolute -rotate-8 text-center opacity-80 mix-blend-multiply ${petit ? "rounded-[8px] border-2 px-2 py-0.5" : "rounded-[10px] border-[3px] px-3 py-1"} ${servi ? "border-marque text-marque" : "border-encre/45 text-encre/45"} ${tombe ? "tampon-tombe" : ""} ${className}`}>
      {etat === "non_retiree" ? (
        // Deux mots : sur deux lignes, un peu plus petits, pour tenir dans la place du tampon.
        <p aria-hidden="true" className="text-[20px] leading-6 font-semibold tracking-[0.08em]">NON<br />RETIRÉ</p>
      ) : (
        <p aria-hidden="true" className={`font-semibold tracking-[0.08em] ${petit ? "text-[18px] leading-6" : "text-[26px] leading-8"}`}>{servi ? "SERVI" : "ANNULÉ"}</p>
      )}
      {heure && !petit && <p aria-hidden="true" className="text-[13px] leading-4 font-medium">{heure}</p>}
    </div>
  );
}

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
};

/**
 * Le ticket entier, avec son QR (le SVG de qrSvg, fabriqué par le serveur) et son code court. Tout ce qui précède le QR
 * est tenu serré : au comptoir, le QR doit se voir sans faire défiler, même dans un navigateur de téléphone.
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
    <div className={`ticket-ombre mx-auto w-full max-w-[340px] ${className}`}>
      <style>{CSS_CHUTE}</style>
      <div className="ticket px-5 pt-4 text-[14px] leading-5">
        <p className="text-center text-[16px] leading-6 font-medium">{MARQUE.cantine}</p>
        <p className="text-center text-encre/65">Ticket repas</p>

        <div className="ticket-filet my-3" />

        <dl className="space-y-1">
          <div className="flex justify-between gap-3">
            <dt className="shrink-0 text-encre/65">Convive</dt>
            <dd className="min-w-0 text-right">{ticket.convive}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="shrink-0 text-encre/65">Pour</dt>
            <dd className="min-w-0 text-right">{jourLong(ticket.jour)}</dd>
          </div>
        </dl>

        <div className="ticket-filet my-3" />

        {/* Le plat et son prix à gauche ; à droite, la place du tampon, gardée qu'il soit là ou pas encore : rien ne
            bouge quand il tombe. Tant que le comptoir n'a pas tamponné, un cadre en pointillé l'attend. */}
        <div className="relative min-h-[68px] pr-[120px]">
          <p className="text-[16px] leading-6 font-medium">{ticket.plat}</p>
          <p className="text-[16px] leading-6 font-medium">{fcfa(ticket.prix)}</p>
          <p className="text-encre/65">{etat === "annulee" ? "Rendu sur ton solde" : "Payé avec ton solde"}</p>
          {etat === "reservee" && (
            <p className="absolute top-1 right-0 grid h-[60px] w-[116px] -rotate-8 place-items-center rounded-[10px] border border-dashed border-encre/30 px-1 text-center text-[12px] leading-4 text-encre/55">
              ici, le tampon du comptoir
            </p>
          )}
          <Tampon etat={etat} serviLe={serviLe} tombe={tombe} className="top-1 right-0" />
        </div>

        <div className="ticket-filet my-3" />

        <div className="mx-auto size-[180px] [&>svg]:size-full" role="img" aria-label="Le QR de ton ticket" dangerouslySetInnerHTML={{ __html: qr }} />
        <p className="mt-3 pl-[0.3em] text-center text-[28px] leading-9 font-medium tracking-[0.3em]">{ticket.code}</p>
        <p className="text-center text-[13px] leading-5 text-encre/65">Si le QR ne passe pas, donne ce code</p>

        <div className="ticket-filet my-3" />

        <p className="text-center text-[13px] leading-5 text-encre/65">Réservé le {dateLongue(ticket.reserveLe)}</p>
      </div>
    </div>
  );
}

/** Le talon du ticket, pour la liste : le plat, le jour, le code court, et le tampon s'il est déjà servi. Sans QR. */
export function TalonTicket({ ticket, etat, serviLe, className = "" }: {
  ticket: Pick<DonneesTicket, "plat" | "jour" | "prix" | "code">;
  etat: EtatAffiche;
  serviLe: string | null;
  className?: string;
}) {
  return (
    <div className={`ticket-ombre ${className}`}>
      <div className="ticket relative px-4 pt-4 text-[14px] leading-5">
        <div className="flex justify-between gap-3 text-encre/65">
          <p>Ticket repas</p>
          <p className="tracking-[0.12em]">{ticket.code}</p>
        </div>
        <div className="ticket-filet my-3" />
        <div className="flex justify-between gap-3 text-[16px] leading-6 font-medium">
          <p className="min-w-0">{ticket.plat}</p>
          <p className="shrink-0">{fcfa(ticket.prix)}</p>
        </div>
        <p className="mt-1 text-encre/65">{jourLong(ticket.jour)}</p>
        <Tampon etat={etat} serviLe={serviLe} petit className="right-4 bottom-3" />
      </div>
    </div>
  );
}
