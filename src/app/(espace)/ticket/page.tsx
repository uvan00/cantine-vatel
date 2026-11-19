import type { Metadata } from "next";
import Link from "next/link";
import { EnTeteEspace } from "@/components/coque-espace";
import { EtatRepas } from "@/components/etat-repas";
import { ArrowRight } from "@/components/icons";
import { STitreSection } from "@/components/sneat";
import { TalonTicket } from "@/components/ticket-repas";
import { ticketsDe, type Repas } from "@/lib/donnees-convive";
import { fcfa } from "@/lib/format";
import { maintenant } from "@/lib/horloge";
import { jourIso, jourProche } from "@/lib/jours";
import { etatAffiche, heureH } from "@/lib/reservation";
import { exiger } from "@/lib/session";
import { NoterRepas } from "./noter";
import { AucunTicket } from "./vide";

// Les tickets du convive : celui d'aujourd'hui en grand, sur l'ardoise comme à l'accueil, puis les repas qui arrivent
// et les derniers repas passés, avec leur état en mots. Un repas servi se note ici.
export const metadata: Metadata = { title: "Tickets" };

const majuscule = (texte: string) => texte.charAt(0).toUpperCase() + texte.slice(1);

function LigneRepas({ repas, instant }: { repas: Repas; instant: number }) {
  const etat = etatAffiche(repas, instant);
  return (
    <li className="relative grid h-[72px] grid-cols-[minmax(0,1fr)_auto] content-center gap-x-3 gap-y-1 px-4 transition-colors hover:bg-[color:var(--h-filet-doux)]">
      {/* Le lien couvre toute la ligne ; le geste « Noter » passe au-dessus. */}
      <Link href={`/ticket/${repas.jeton}`}
        className="truncate text-[15px] leading-5 font-medium text-encre/95 outline-none after:absolute after:inset-0 after:rounded-[4px] focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-[rgb(var(--h-marque-texte))]">
        {repas.plat}
      </Link>
      <div className="justify-self-end"><EtatRepas etat={etat} taille="sm" /></div>
      <p className="chiffres truncate text-[14px] leading-5 text-texte-2">{majuscule(jourProche(repas.jour, instant))}, {fcfa(repas.prix)}</p>
      <div className="justify-self-end">
        {etat === "servie" && <NoterRepas reservationId={repas.id} plat={repas.plat} note={repas.note} mot={repas.mot} forme="ligne" />}
      </div>
    </li>
  );
}

function ListeRepas({ repas, instant }: { repas: Repas[]; instant: number }) {
  return (
    <ul className="mt-4 divide-y divide-[color:var(--h-filet)] overflow-hidden rounded-[16px] border border-[color:var(--h-filet)] bg-surface">
      {repas.map((r) => <LigneRepas key={r.id} repas={r} instant={instant} />)}
    </ul>
  );
}

export default async function PageTickets() {
  const moi = await exiger("convive");
  const instant = maintenant();
  const { duJour, aVenir, passes } = await ticketsDe(moi.id, jourIso(instant));
  const servi = duJour?.etat === "servie";

  return (
    <main>
      <EnTeteEspace titre="Tes tickets" />
      {!duJour && aVenir.length === 0 && passes.length === 0 ? <AucunTicket /> : (
        <div className="space-y-8 px-4">
          {duJour && (
            <section aria-label="Ton ticket d'aujourd'hui" className="space-y-4">
              <Link href={`/ticket/${duJour.jeton}`} style={{ "--sn-on": "255 255 255" } as React.CSSProperties}
                className="ardoise block rounded-[24px] p-4 transition-transform active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--h-marque-texte))]">
                <div className="flex items-baseline justify-between gap-3 px-1">
                  <h2 className="text-[18px] leading-6">Aujourd&apos;hui</h2>
                  <p className="chiffres text-[14px] leading-5 text-white/70">{servi && duJour.serviLe ? `Servi à ${heureH(duJour.serviLe)}` : servi ? "Servi" : "À montrer au comptoir"}</p>
                </div>
                <TalonTicket className="mt-4" ticket={duJour} etat={etatAffiche(duJour, instant)} serviLe={duJour.serviLe} />
                <span className="mt-5 flex h-12 items-center justify-center gap-2 rounded-full bg-white text-[16px] font-semibold text-[#1c1c1c]">
                  {servi ? "Voir mon ticket" : "Montrer mon ticket"} <ArrowRight className="size-5" strokeWidth={1.8} aria-hidden="true" />
                </span>
              </Link>
              {servi && <NoterRepas reservationId={duJour.id} plat={duJour.plat} note={duJour.note} mot={duJour.mot} forme="bouton" />}
            </section>
          )}
          {aVenir.length > 0 && (
            <section>
              <STitreSection>À venir</STitreSection>
              <ListeRepas repas={aVenir} instant={instant} />
            </section>
          )}
          {passes.length > 0 && (
            <section>
              <STitreSection>Derniers repas</STitreSection>
              <ListeRepas repas={passes} instant={instant} />
            </section>
          )}
        </div>
      )}
    </main>
  );
}
