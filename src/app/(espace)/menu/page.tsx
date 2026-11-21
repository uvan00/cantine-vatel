import type { Metadata } from "next";
import Link from "next/link";
import { BandeauSoldeBas } from "@/components/bandeau-solde-bas";
import { Logo } from "@/components/brand";
import { AlerteIcone } from "@/components/kit-client";
import { SEmpty } from "@/components/sneat";
import { lireReglages, plafondDe, profilDe, soldeDuCompte } from "@/lib/donnees";
import { demandeDuJour, joursAuMenu, mesFavoris, platsAuMenu, prisParCreneau, repasDuJour } from "@/lib/donnees-convive";
import { estNouveau, favoriAuMenu } from "@/lib/favoris";
import { etatsCreneaux } from "@/lib/creneaux";
import { heuresDePassage } from "@/lib/reglages";
import { proposerSemaine } from "@/lib/semaine";
import { fcfa } from "@/lib/format";
import { maintenant } from "@/lib/horloge";
import { cloturePassee, clotureLisible, jourCourt, jourIso, jourLong, jourProche, numeroDuJour } from "@/lib/jours";
import { MARQUE } from "@/lib/marque";
import { etiquettesDuPlat, etiquettesEnCause, incompatibilites } from "@/lib/profil-alimentaire";
import { etatAffiche, peutAnnuler, peutDemanderHorsDelai, peutReserver, portionsRestantes } from "@/lib/reservation";
import { exiger } from "@/lib/session";
import { SEUIL_ALERTE_DEFAUT, mouvementRepas, soldeDe } from "@/lib/solde";
import { MenuDuJour, type CartePlat, type MonRepas } from "./menu-du-jour";
import { TaSemaine } from "./ta-semaine";
import { VoileAttente } from "./voile-attente";

// Le menu de la semaine : l'ardoise en haut (le solde, les jours en onglets), puis le jour choisi. Chaque plat reçoit
// ici son verdict, par la même règle pure que le serveur appliquera à la réservation (peutReserver).
export const metadata: Metadata = { title: "Menu de la semaine" };

const majuscule = (texte: string) => texte.charAt(0).toUpperCase() + texte.slice(1);

/** « Demain, vendredi 20 novembre », ou « Lundi 23 novembre » plus loin. */
function titreDuJour(jour: string, instant: number) {
  const proche = jourProche(jour, instant);
  return majuscule(proche === jourLong(jour) ? proche : `${proche}, ${jourLong(jour)}`);
}

export default async function PageMenu({ searchParams }: { searchParams: Promise<{ jour?: string | string[] }> }) {
  const moi = await exiger("convive");
  const { jour: demande } = await searchParams;
  const instant = maintenant();
  const aujourdhui = jourIso(instant);

  const [jours, solde, profil, reglages, favoris] = await Promise.all([joursAuMenu(moi.id, aujourdhui), soldeDuCompte(moi.id), profilDe(moi.id), lireReglages(), mesFavoris(moi.id)]);
  const h = reglages.heureCloture;
  // Le jour de l'adresse s'il a un menu, sinon aujourd'hui, sinon le premier jour servi.
  const choisi = (jours.find((j) => j.jour === demande) ?? jours.find((j) => j.jour === aujourdhui) ?? jours[0])?.jour ?? null;
  // Le plafond se compte sur la semaine du jour choisi, comme à la réservation.
  const [plats, repas, pris, maDemande, plafond] = choisi
    ? await Promise.all([platsAuMenu(choisi), repasDuJour(moi.id, choisi), prisParCreneau(choisi), demandeDuJour(moi.id, choisi), plafondDe(moi.id, choisi)])
    : [[], null, {}, null, null];
  // Les heures de passage, tant que ce jour se réserve encore (src/lib/creneaux.ts).
  const heures = heuresDePassage(reglages);
  const creneaux = choisi && heures.length > 0 && !cloturePassee(choisi, instant, h) ? etatsCreneaux(heures, pris, reglages.creneauCapacite) : null;

  const ceQuIlNeMangePas = { allergenes: profil?.allergenes ?? [], regimes: profil?.regimes ?? [] };
  // « Ta semaine avec ton solde » : les jours à venir encore ouverts où ce convive n'a pas réservé (src/lib/semaine.ts).
  const aProposer = jours.filter((j) => !j.reserve && !cloturePassee(j.jour, instant, h));
  const ouverts = await Promise.all(aProposer.map(async (j) => ({ jour: j.jour, plats: await platsAuMenu(j.jour) })));
  const semaine = proposerSemaine(ouverts, solde, ceQuIlNeMangePas);
  // Un favori au menu d'un jour encore ouvert, autre que celui qu'il regarde : on le lui dit (src/lib/favoris.ts).
  const favori = favoriAuMenu(ouverts, favoris);
  const cartes: CartePlat[] = choisi === null ? [] : plats.map((p) => {
    const verdict = peutReserver({
      maintenant: instant,
      jour: choisi,
      dejaReserve: repas !== null,
      epuise: p.epuise,
      portions: p.portions,
      reservees: p.reservees,
      incompatibilites: incompatibilites(ceQuIlNeMangePas, p),
      solde,
      prix: p.prix,
      heureCloture: h,
      plafond: plafond ? { max: plafond.plafond, depense: plafond.depense } : undefined,
    });
    // Clos aujourd'hui : le plat qui reste peut encore se demander à la cantine (src/lib/reservation.ts).
    const demandable = !verdict.ok && verdict.refus === "cloture" && choisi === aujourdhui && peutDemanderHorsDelai({
      maintenant: instant, jour: choisi, heureCloture: h, dejaReserve: repas !== null, demandeEnCours: maDemande?.etat === "en_attente",
      epuise: p.epuise, portions: p.portions, reservees: p.reservees, incompatibilites: incompatibilites(ceQuIlNeMangePas, p), solde, prix: p.prix,
    }).ok;
    return {
      id: p.id,
      platId: p.platId,
      favori: favoris.has(p.platId),
      nouveau: estNouveau(p.creeLe, instant),
      nom: p.nom,
      description: p.description,
      photo: p.photo,
      prix: p.prix,
      etiquettes: etiquettesDuPlat(p),
      enCause: etiquettesEnCause(ceQuIlNeMangePas, p),
      vegetarien: p.vegetarien,
      note: p.note === null ? null : p.note.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      avis: p.avis,
      restantes: portionsRestantes(p),
      soldeApres: soldeDe([{ montant: solde }, mouvementRepas(p.prix)]),
      refus: verdict.ok ? null : { genre: verdict.refus, phrase: verdict.phrase },
      demandable,
    };
  });
  const monRepas: MonRepas | null = repas && {
    id: repas.id,
    jeton: repas.jeton,
    plat: repas.plat,
    prix: repas.prix,
    etat: etatAffiche(repas, instant),
    annulable: peutAnnuler(repas, instant, h).ok,
    creneau: repas.creneau,
  };

  return (
    <main>
      <header className="ardoise" style={{ "--sn-on": "255 255 255", "--logo-marque": "#67B2E8" } as React.CSSProperties}>
        <div className="px-4 pt-5">
          <Logo className="text-[20px]" />
          <p className="mt-6 text-[15px] leading-5 text-white/65">{MARQUE.ecole}</p>
          <h1 className="mt-1 text-[24px] leading-8">Le menu de la semaine</h1>
          <div className="mt-5 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[14px] leading-5 text-white/65">Ton solde</p>
              <p className="chiffres text-[24px] leading-8 font-medium text-white">{fcfa(solde)}</p>
            </div>
            <Link href="/recharger"
              className="inline-flex h-10 shrink-0 items-center rounded-full bg-white/10 px-4 text-[14px] font-medium text-white transition-[background-color,transform] hover:bg-white/15 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              Recharger
            </Link>
          </div>
        </div>
        {jours.length > 0 && (
          <nav aria-label="Jours au menu" className="mt-5 px-4">
            <ul className="grid auto-cols-[minmax(0,64px)] grid-flow-col gap-1">
              {jours.map((j) => {
                const ici = j.jour === choisi;
                const numero = numeroDuJour(j.jour);
                return (
                  <li key={j.jour}>
                    <Link href={`/menu?jour=${j.jour}`} replace scroll={false} aria-current={ici ? "page" : undefined}
                      className={`relative flex h-16 flex-col items-center justify-center rounded-t-[12px] transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 ${ici
                        ? "bg-white text-[#1c1c1c] focus-visible:outline-[#1c1c1c] before:absolute before:bottom-0 before:-left-3 before:size-3 before:bg-[radial-gradient(circle_at_0_0,transparent_11.5px,#fff_12px)] before:content-[''] after:absolute after:-right-3 after:bottom-0 after:size-3 after:bg-[radial-gradient(circle_at_100%_0,transparent_11.5px,#fff_12px)] after:content-['']"
                        : "text-white/70 hover:bg-white/10 hover:text-white focus-visible:outline-white"}`}>
                      <span className="text-[13px] leading-4">{jourCourt(j.jour).replace(numero, "").trim()}</span>
                      <span className="chiffres text-[18px] leading-6 font-medium">{numero}</span>
                      {/* Le repère des jours déjà réservés ; sa place reste prise pour que les numéros restent alignés. */}
                      <span aria-hidden="true" className={`mt-0.5 size-1.5 rounded-full ${j.reserve ? (ici ? "bg-marque" : "bg-[#67B2E8]") : ""}`} />
                      {j.reserve && <span className="sr-only">, repas réservé</span>}
                      {!ici && <VoileAttente />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </header>

      <div className="space-y-4 px-4 pt-5">
        <BandeauSoldeBas solde={solde} seuil={profil?.seuilAlerte ?? SEUIL_ALERTE_DEFAUT} href="/recharger" />
        {favori && favori.jour !== choisi && (
          <AlerteIcone icone="etoile" action={<Link href={`/menu?jour=${favori.jour}`} replace scroll={false} className="font-medium text-marque-texte underline-offset-4 hover:underline">Voir</Link>}>
            {favori.nom}, ton favori, est au menu {jourProche(favori.jour, instant)}
          </AlerteIcone>
        )}
        <TaSemaine {...semaine} />
        {choisi === null ? (
          <SEmpty title="Pas de menu cette semaine" hint="La cantine n'a encore rien affiché pour les jours qui viennent. Repasse un peu plus tard." />
        ) : (
          <>
            <div>
              <h2 className="text-[20px] leading-7">{titreDuJour(choisi, instant)}</h2>
              <p className="mt-1 text-[15px] leading-5 text-texte-2">
                {cloturePassee(choisi, instant, h)
                  ? choisi === aujourdhui ? "Les réservations sont closes : la cantine peut encore accepter une demande" : "Les réservations de ce jour sont closes"
                  : `Réserve jusqu'à ${clotureLisible(h)} ${choisi === aujourdhui ? "ce matin" : "ce jour-là"}`}
              </p>
            </div>
            <MenuDuJour key={choisi} jourEnLettres={jourLong(choisi)} clotureLisible={clotureLisible(h)} solde={solde} plats={cartes} repas={monRepas}
              creneaux={creneaux} demande={maDemande} />
          </>
        )}
      </div>
    </main>
  );
}
