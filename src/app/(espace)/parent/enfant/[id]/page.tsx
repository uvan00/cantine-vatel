import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BandeauSoldeBas } from "@/components/bandeau-solde-bas";
import { ChoixAvatar } from "@/components/choix-avatar";
import { EnTeteEspace } from "@/components/coque-espace";
import { EtatRepas } from "@/components/etat-repas";
import { PlafondSemaine } from "@/components/plafond-semaine";
import { SBtnLink, STitreSection } from "@/components/sneat";
import { estParentDe, plafondDe } from "@/lib/donnees";
import { Identifiant, JOURS_PASSES, ficheEnfant, type LigneHistorique, type RepasEnfant } from "@/lib/donnees-parent";
import { dateLongue, de, fcfa } from "@/lib/format";
import { maintenant } from "@/lib/horloge";
import { jourIso, jourLong } from "@/lib/jours";
import { heureH } from "@/lib/reservation";
import { exiger, prenomDe } from "@/lib/session";
import { soldeBas } from "@/lib/solde";
import { LienCarte } from "../../../carte/lien-carte";
import { reglerPlafondEnfant } from "../../actions";
import { ProfilAlimentaire, SeuilAlerte } from "./reglages";

export const metadata: Metadata = { title: "Mon enfant" };

// La page d'un enfant, pour son parent seulement : son solde, ses repas (14 derniers jours et jours à venir), son
// profil alimentaire, son seuil d'alerte et son plafond de la semaine à régler, ses 20 derniers mouvements. Pour tout autre parent : introuvable.

const CARTE = "rounded-[16px] border border-[color:var(--h-filet)] bg-surface";
const LISTE = `divide-y divide-[color:var(--h-filet)] ${CARTE}`;

/**
 * Deux lignes, toujours la même hauteur : le jour et le prix, puis le plat et l'état. À côté de l'état, ce qu'il faut
 * savoir de plus : la note d'un repas servi, ou qu'un repas annulé a été remboursé (annuler rembourse toujours).
 */
function Repas({ r }: { r: RepasEnfant }) {
  const plus = r.etat === "annulee" ? "remboursé" : r.note !== null ? `noté ${r.note} sur 5` : null;
  return (
    <li className="flex h-16 flex-col justify-center gap-1 px-4">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-[15px] leading-5 font-medium text-encre/95 first-letter:uppercase">{jourLong(r.jour)}</span>
        <span className="chiffres shrink-0 text-[14px] leading-5 text-encre/90">{fcfa(r.prix)}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-[14px] leading-5 text-texte-2">{r.plat}</span>
        <span className="flex shrink-0 items-center gap-2">
          {plus && <span className="chiffres text-[13px] leading-5 text-texte-2">{plus}</span>}
          <EtatRepas etat={r.etat} taille="sm" />
        </span>
      </div>
    </li>
  );
}

function ListeRepas({ titre, repas, vide }: { titre: string; repas: RepasEnfant[]; vide: string }) {
  return (
    <div className="mt-4">
      <p className="text-[14px] leading-5 text-texte-2">{titre}</p>
      {repas.length === 0
        ? <p className={`mt-2 px-4 py-5 text-[15px] leading-5 text-texte-2 ${CARTE}`}>{vide}</p>
        : <ul className={`mt-2 ${LISTE}`}>{repas.map((r) => <Repas key={r.id} r={r} />)}</ul>}
    </div>
  );
}

/** Les mêmes lignes que dans le compte du convive : le libellé sur deux lignes au plus, la date, le montant signé. */
function Mouvement({ m }: { m: LigneHistorique }) {
  return (
    <li className="flex h-[76px] items-center justify-between gap-3 px-4">
      <div className="min-w-0">
        <p className="line-clamp-2 text-[14px] leading-5 text-encre/95">{m.libelle}</p>
        <p className="chiffres text-[13px] leading-4 text-texte-2">{dateLongue(m.creeLe)} à {heureH(m.creeLe)}</p>
      </div>
      <p className={`chiffres shrink-0 text-[15px] leading-5 font-medium ${m.montant > 0 ? "text-marque-texte" : "text-encre/95"}`}>
        {m.montant > 0 ? "+" : ""}{fcfa(m.montant)}
      </p>
    </li>
  );
}

export default async function PageEnfant({ params }: { params: Promise<{ id: string }> }) {
  const m = await exiger("parent");
  const id = Identifiant.safeParse((await params).id);
  if (!id.success || !(await estParentDe(m.id, id.data))) notFound();
  const instant = maintenant();
  const [fiche, plafond] = await Promise.all([ficheEnfant(id.data, instant), plafondDe(id.data, jourIso(instant))]);
  if (!fiche) notFound();

  const { nom, profil, solde, repas, historique } = fiche;
  const prenom = prenomDe(nom);
  const recharger = `/recharger?pour=${id.data}`;
  const bas = soldeBas(solde, profil.seuilAlerte);
  const aujourdhui = jourIso(instant);
  // Les repas arrivent du plus récent au plus ancien : ceux qui viennent se lisent dans l'ordre du calendrier.
  const aVenir = repas.filter((r) => r.jour >= aujourdhui).reverse();
  const passes = repas.filter((r) => r.jour < aujourdhui);

  return (
    <>
      <EnTeteEspace titre={nom} retour={{ href: "/parent", libelle: "Mes enfants" }}
        action={<ChoixAvatar id={id.data} nom={nom} photo={fiche.photo} titre={`L'avatar ${de(prenom)}`} sousTitre={`Touche celui qui ressemble le plus à ${prenom}`} />}
        sousTitre={[profil.genre === "employe" ? "Employé" : "Élève", profil.classe].filter(Boolean).join(", ")} />

      <section className="space-y-4 px-4">
        <div className={`p-4 ${CARTE}`}>
          <p className="text-[14px] leading-5 text-texte-2">Son solde</p>
          <p className="chiffres mt-1 text-[36px] leading-[44px] font-medium text-encre/95">{fcfa(solde)}</p>
          {/* Solde bas : le bandeau, juste dessous, porte déjà « Recharger ». */}
          {!bas && <SBtnLink href={recharger} tone="secondary" block className="mt-4">Recharger</SBtnLink>}
        </div>
        <BandeauSoldeBas solde={solde} seuil={profil.seuilAlerte} prenom={prenom} href={recharger} />
        <LienCarte href={`/carte?pour=${id.data}`} titre={`La carte de cantine ${de(prenom)}`} phrase="À imprimer pour un enfant sans téléphone : au comptoir, elle vaut son ticket" />
      </section>

      <section className="mt-8 px-4">
        <STitreSection>Ses repas</STitreSection>
        <ListeRepas titre="Aujourd'hui et les jours qui viennent" repas={aVenir} vide="Rien de réservé pour l'instant" />
        <ListeRepas titre={`Les ${JOURS_PASSES} derniers jours`} repas={passes} vide="Aucun repas sur cette période" />
      </section>

      <section className="mt-8 px-4">
        <STitreSection>Profil alimentaire</STitreSection>
        <p className="mt-2 mb-4 text-[15px] leading-5 text-texte-2">Coche ce que ton enfant ne mange pas : au menu, un plat qui ne lui convient pas est signalé et ne se réserve pas</p>
        <ProfilAlimentaire enfantId={id.data} allergenes={profil.allergenes} regimes={profil.regimes} />
      </section>

      <section className="mt-8 px-4">
        <STitreSection>Seuil d&apos;alerte</STitreSection>
        <div className="mt-4"><SeuilAlerte enfantId={id.data} seuil={profil.seuilAlerte} prenom={prenom} /></div>
      </section>

      <section className="mt-8 px-4">
        <STitreSection>Plafond de la semaine</STitreSection>
        <div className="mt-4">
          <PlafondSemaine plafond={plafond.plafond} depense={plafond.depense} qui={`${prenom} a réservé`} enregistrer={reglerPlafondEnfant.bind(null, id.data)} />
        </div>
      </section>

      <section className="mt-8 px-4">
        <STitreSection>Son historique</STitreSection>
        {historique.length === 0
          ? <p className="mt-2 text-[15px] leading-5 text-texte-2">Aucun mouvement pour l&apos;instant : sa première recharge s&apos;affichera ici</p>
          : <ul className={`mt-4 ${LISTE}`}>{historique.map((l) => <Mouvement key={l.id} m={l} />)}</ul>}
      </section>
    </>
  );
}
