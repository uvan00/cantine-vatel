import type { Metadata } from "next";
import { EtiquettesAliments } from "@/components/allergene";
import { Avatar } from "@/components/avatar";
import { BandeauSoldeBas } from "@/components/bandeau-solde-bas";
import { EnTeteEspace } from "@/components/coque-espace";
import { EtatRepas } from "@/components/etat-repas";
import { SBtnLink, STitreSection } from "@/components/sneat";
import { enfantsDuParent, rechargesEnAttenteDe, semaineDesEnfants, type Enfant, type JourDeSemaine } from "@/lib/donnees-parent";
import { fcfa } from "@/lib/format";
import { maintenant } from "@/lib/horloge";
import { jourCourt, jourIso } from "@/lib/jours";
import { etiquettesDuProfil } from "@/lib/profil-alimentaire";
import { exiger, prenomDe } from "@/lib/session";
import { soldeBas } from "@/lib/solde";
import { RechargesEnAttente } from "../recharger/en-attente";
import { AucunEnfant, RelierEnfant } from "./relier-enfant";
import { Transfert } from "./transfert";

export const metadata: Metadata = { title: "Mes enfants" };

// L'accueil du parent : une carte par enfant (ce qu'il ne mange pas, son solde, l'alerte de solde bas, ses repas de la semaine en mots), de
// quoi faire passer de l'argent d'un enfant à l'autre, les recharges qui attendent la cantine, et de quoi relier un
// enfant avec son code famille.

function CarteEnfant({ enfant, semaine, aujourdhui }: { enfant: Enfant; semaine: JourDeSemaine[]; aujourdhui: string }) {
  const recharger = `/recharger?pour=${enfant.id}`;
  const bas = soldeBas(enfant.solde, enfant.seuil);
  const neMangePas = etiquettesDuProfil(enfant);
  return (
    <article className="rounded-[16px] border border-[color:var(--h-filet)] bg-surface p-4">
      <div className="flex items-center gap-3">
        <Avatar id={enfant.id} nom={enfant.nom} photo={enfant.photo} taille={48} />
        <div className="min-w-0">
          <h2 className="truncate text-[17px] leading-6">{enfant.nom}</h2>
          {enfant.classe && <p className="text-[14px] leading-5 text-texte-2">{enfant.classe}</p>}
        </div>
      </div>
      {neMangePas.length > 0 && (
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[14px] leading-5 text-encre/90">
          <span className="text-texte-2">Ne mange pas</span>
          <EtiquettesAliments etiquettes={neMangePas} taille={20} />
        </p>
      )}

      <p className="mt-4 text-[14px] leading-5 text-texte-2">Son solde</p>
      <p className="chiffres mt-1 text-[32px] leading-10 font-medium text-encre/95">{fcfa(enfant.solde)}</p>
      {/* Le bandeau déborde un peu sur la marge de la carte : sur un téléphone, sa phrase a besoin de la place. */}
      {bas && <div className="-mx-2 mt-3"><BandeauSoldeBas solde={enfant.solde} seuil={enfant.seuil} prenom={prenomDe(enfant.nom)} href={recharger} /></div>}

      <h3 className="mt-5 text-[14px] leading-5">Cette semaine</h3>
      {semaine.length === 0 ? (
        <p className="mt-2 text-[14px] leading-5 text-texte-2">La cantine n&apos;a rien mis au menu cette semaine</p>
      ) : (
        <ul className="mt-1 divide-y divide-[color:var(--h-filet)]">
          {semaine.map((j) => (
            <li key={j.jour} className="flex h-10 items-center justify-between gap-3 text-[14px] leading-5">
              <span className={`first-letter:uppercase ${j.jour === aujourdhui ? "font-medium text-encre/95" : "text-encre/75"}`}>
                {j.jour === aujourdhui ? "aujourd'hui" : jourCourt(j.jour)}
              </span>
              {j.etat ? <EtatRepas etat={j.etat} taille="sm" /> : <span className="text-texte-2">Rien de réservé</span>}
            </li>
          ))}
        </ul>
      )}

      {/* Solde bas : le bandeau porte déjà « Recharger », on ne le répète pas dessous. */}
      <div className={`mt-4 grid gap-2 ${bas ? "" : "grid-cols-2"}`}>
        {!bas && <SBtnLink href={recharger} tone="secondary" className="px-3">Recharger</SBtnLink>}
        <SBtnLink href={`/parent/enfant/${enfant.id}`} tone="secondary" variant="outlined" className="px-3">Voir le détail</SBtnLink>
      </div>
    </article>
  );
}

export default async function PageParent() {
  const m = await exiger("parent");
  const instant = maintenant();
  const enfants = await enfantsDuParent(m.id);
  const [semaines, enAttente] = await Promise.all([semaineDesEnfants(enfants.map((e) => e.id), instant), rechargesEnAttenteDe(m.id)]);

  return (
    <>
      <EnTeteEspace titre="Mes enfants"
        sousTitre={enfants.length > 1 ? "Les repas de la semaine et le solde de chacun" : enfants.length === 1 ? "Ses repas de la semaine et son solde" : undefined} />

      {enfants.length === 0 ? (
        <AucunEnfant />
      ) : (
        <div className="space-y-4 px-4">
          {enfants.map((e) => <CarteEnfant key={e.id} enfant={e} semaine={semaines.get(e.id) ?? []} aujourdhui={jourIso(instant)} />)}
        </div>
      )}

      {enfants.length > 1 && (
        <section className="mt-8 px-4">
          <STitreSection>Faire passer de l&apos;argent</STitreSection>
          <p className="mt-2 text-[14px] leading-5 text-texte-2">D&apos;un enfant à l&apos;autre, sans nouvelle recharge</p>
          <div className="mt-3"><Transfert enfants={enfants.map((e) => ({ id: e.id, prenom: prenomDe(e.nom), solde: e.solde }))} /></div>
        </section>
      )}

      {enAttente.length > 0 && (
        <section className="mt-8 px-4">
          <STitreSection>Recharges en attente</STitreSection>
          <div className="mt-3"><RechargesEnAttente recharges={enAttente} moiId={m.id} maintenant={instant} /></div>
        </section>
      )}

      <section className="mt-8 px-4">
        <STitreSection>{enfants.length > 0 ? "Relier un autre enfant" : "Relier un enfant"}</STitreSection>
        {enfants.length > 0 && <p className="mt-2 text-[14px] leading-5 text-texte-2">Demande-lui son code famille : 6 caractères, écrits dans son compte</p>}
        <div className="mt-3"><RelierEnfant /></div>
      </section>
    </>
  );
}
