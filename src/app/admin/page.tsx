import Link from "next/link";
import { EnTetePage } from "@/components/fenetre";
import { ChevronRight } from "@/components/icons";
import { SChiffresBande, SStatVertical, STitreSection } from "@/components/sneat";
import { tableauDeBord } from "@/lib/donnees-admin";
import { aTraiter, argentDuTableau, caisseDuJour, convivesDuTableau, equipeDuJour, type ATraiter, type LigneCaisse } from "@/lib/donnees-cantine";
import { fcfa, liste, nombre, pluriel } from "@/lib/format";
import { maintenant } from "@/lib/horloge";
import { clotureLisible, jourCourt, jourLong } from "@/lib/jours";
import { lireReglages } from "@/lib/donnees";
import { heureH } from "@/lib/reservation";
import { poidsLisible } from "@/lib/restes";
import { nomDuRole } from "@/lib/roles";
import { CANTINE, exiger } from "@/lib/session";
import { noteLisible, partDeBarre, periode, pourcent } from "@/lib/statistiques";
import { RelireEnDirect } from "./relire-en-direct";
import { VignettePlat } from "./vignette-plat";

// Le tableau de bord de la cantine. Pour tous : aujourd'hui en chiffres, ce qui attend, la semaine en barres (le seul
// graphique de la page) et demain par plat. Le responsable de cantine y voit en plus sa caisse du jour ; l'admin,
// l'argent de la cantine (comparé aux mêmes jours du mois d'avant), les convives, l'équipe et les sept derniers jours
// (demande du propriétaire du 21/11/2026). Tout est lu dans la base à chaque visite (src/lib/donnees-admin.ts et
// src/lib/donnees-cantine.ts) ; l'argent vient des mêmes calculs que la rubrique Recharges (src/lib/comptabilite.ts).

const repas = (n: number) => pluriel(n, "repas", "repas");

/** Une ligne d'une liste classée : le nom, sa valeur, et une barre fine à la mesure de la plus grande. */
function LigneClassee({ rang, photo, nom, valeur, part }: { rang?: number; photo?: string; nom: string; valeur: React.ReactNode; part: number }) {
  return (
    <li className="flex items-center gap-3">
      {rang !== undefined && <span className="chiffres w-4 shrink-0 text-[14px] leading-5 text-texte-2">{rang}</span>}
      {photo !== undefined && <VignettePlat photo={photo} className="hidden w-20 @md/page:block" />}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3 text-[14px] leading-5">
          <span className="min-w-0 truncate text-encre/90">{nom}</span>
          <span className="chiffres shrink-0 text-texte-2">{valeur}</span>
        </div>
        <div aria-hidden="true" className="mt-2 h-1 overflow-hidden rounded-full bg-[color:var(--h-surface)]">
          <div className="h-full rounded-full bg-encre/30" style={{ width: `${part * 100}%` }} />
        </div>
      </div>
    </li>
  );
}

const fort = (n: number) => <span className="font-semibold text-encre/95">{nombre(n)}</span>;

/** Ce qui attend un geste de la cantine, chaque ligne menant là où on le fait. */
function ATraiterCarte({ a }: { a: ATraiter }) {
  const lignes = [
    a.recharges > 0 ? { href: "/admin/recharges", texte: pluriel(a.recharges, "recharge à confirmer", "recharges à confirmer") } : null,
    a.demandes > 0 ? { href: "/admin/commandes", texte: pluriel(a.demandes, "demande de repas après la clôture", "demandes de repas après la clôture") } : null,
    a.aVerifier.aujourdhui > 0 ? { href: "/admin/commandes", texte: `${repas(a.aVerifier.aujourdhui)} à vérifier avant de servir aujourd'hui (allergie ou régime)` } : null,
    a.aVerifier.demain > 0 ? { href: "/admin/commandes?jour=demain", texte: `${repas(a.aVerifier.demain)} à vérifier pour demain (allergie ou régime)` } : null,
  ].filter((l) => l !== null);
  return (
    <section className="sn-card min-w-0 p-5 @xl/page:p-6" aria-labelledby="titre-attente">
      <h2 id="titre-attente" className="text-[18px] leading-6">À traiter</h2>
      {lignes.length === 0 ? (
        <p className="mt-2 text-[14px] leading-5 text-texte-2">Rien n&apos;attend pour l&apos;instant</p>
      ) : (
        <ul className="mt-2 divide-y divide-[color:var(--h-filet)]">
          {lignes.map((l) => (
            <li key={l.texte}>
              <Link href={l.href} className="flex items-center justify-between gap-3 py-3 text-[14px] leading-5 text-encre/90 hover:text-encre">
                <span className="min-w-0">{l.texte}</span>
                <ChevronRight className="size-4 shrink-0 text-encre/40" strokeWidth={1.8} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** La caisse du jour du responsable : les espèces qu'il a encaissées, une recharge par ligne. */
function CaisseCarte({ caisse }: { caisse: { total: number; lignes: LigneCaisse[] } }) {
  return (
    <section className="sn-card flex min-w-0 flex-col p-5 @xl/page:p-6" aria-labelledby="titre-caisse">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <h2 id="titre-caisse" className="text-[18px] leading-6">Ta caisse du jour</h2>
          <p className="mt-1 text-[14px] leading-5 text-texte-2">Les espèces que tu as encaissées aujourd&apos;hui</p>
        </div>
        <p className="chiffres shrink-0 text-[24px] leading-8 font-semibold text-encre/95">{fcfa(caisse.total)}</p>
      </div>
      {caisse.lignes.length === 0 ? (
        <p className="mt-5 rounded-[16px] border border-dashed border-[color:var(--h-filet)] px-4 py-8 text-center text-[14px] leading-5 text-texte-2">Aucune espèce encaissée aujourd&apos;hui</p>
      ) : (
        <ul className="mt-4 divide-y divide-[color:var(--h-filet)]">
          {caisse.lignes.map((l) => (
            <li key={l.id} className="flex items-baseline justify-between gap-3 py-2.5 text-[14px] leading-5">
              <span className="min-w-0 truncate"><span className="chiffres text-texte-2">{heureH(l.heure)}</span><span className="ml-3 text-encre/90">{l.convive}</span></span>
              <span className="chiffres shrink-0 text-encre/90">{fcfa(l.montant)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-auto pt-4">
        <Link href="/admin/recharges" className="hb hb--filet hb--petit">Encaisser des espèces</Link>
      </div>
    </section>
  );
}

/** Une ligne de l'équipe : qui, ses repas servis, son argent. */
function Ligne({ nom, detail, servis, argent }: { nom: React.ReactNode; detail?: string; servis: string; argent: string }) {
  return (
    <li className="grid grid-cols-1 gap-1 py-3 @md/page:grid-cols-[minmax(0,1fr)_170px_220px] @md/page:items-baseline @md/page:gap-6">
      <span className="min-w-0 text-[15px] leading-5 text-encre/95">{nom}{detail && <span className="ml-2 text-[13px] text-texte-2">{detail}</span>}</span>
      <span className="chiffres text-[14px] leading-5 text-texte-2 @md/page:text-right">{servis}</span>
      <span className="chiffres text-[14px] leading-5 text-encre/90 @md/page:text-right">{argent}</span>
    </li>
  );
}

/** La journée de l'équipe, pour l'admin : chacun, ses repas servis et ses espèces ; la borne et le Mobile Money à part. */
function EquipeCarte({ j }: { j: Awaited<ReturnType<typeof equipeDuJour>> }) {
  return (
    <section className="sn-card min-w-0 p-5 @xl/page:p-6" aria-labelledby="titre-equipe">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h2 id="titre-equipe" className="text-[18px] leading-6">L&apos;équipe aujourd&apos;hui</h2>
          <p className="mt-1 text-[14px] leading-5 text-texte-2">Les repas servis et les espèces encaissées, personne par personne</p>
        </div>
        <Link href="/admin/reglages#equipe" className="hb hb--filet hb--petit shrink-0">Gérer l&apos;équipe</Link>
      </div>
      <ul className="mt-3 divide-y divide-[color:var(--h-filet)]">
        {j.membres.map((p) => (
          <Ligne key={p.id} nom={p.nom} detail={`${nomDuRole(p.role)}${p.actif ? "" : ", désactivé"}`}
            servis={p.servis > 0 ? `${repas(p.servis)} servis` : "Aucun repas servi"}
            argent={p.especes.nombre > 0 ? `${fcfa(p.especes.montant)} en espèces` : "Aucune espèce"} />
        ))}
        <Ligne nom="Borne d'entrée" servis={j.borne > 0 ? `${repas(j.borne)} servis` : "Aucun repas servi"} argent="" />
        <Ligne nom="Mobile Money" detail="confirmé tout seul par Cartflox" servis=""
          argent={j.mobileMoney.nombre > 0 ? `${fcfa(j.mobileMoney.montant)}, ${pluriel(j.mobileMoney.nombre, "paiement")}` : "Aucun paiement"} />
        {j.sansNom > 0 && <Ligne nom="Avant le suivi par personne" detail="servis sans nom" servis={`${repas(j.sansNom)} servis`} argent="" />}
      </ul>
    </section>
  );
}

export default async function PageTableauDeBord() {
  const m = await exiger(...CANTINE);
  const admin = m.role === "admin";
  const instant = maintenant();
  const [t, reglages, attente, caisse, argent, convives, journee] = await Promise.all([
    tableauDeBord(instant),
    lireReglages(),
    aTraiter(instant),
    admin ? null : caisseDuJour(m.id, instant),
    admin ? argentDuTableau(instant) : null,
    admin ? convivesDuTableau(instant) : null,
    admin ? equipeDuJour(instant) : null,
  ]);
  const cloture = clotureLisible(reglages.heureCloture);

  const plusHaut = Math.max(0, ...t.semaine.map((j) => j.repas));
  const totalSemaine = t.semaine.reduce((s, j) => s + j.repas, 0);
  const plusDemain = Math.max(0, ...t.demain.plats.map((p) => p.repas));
  const plusReserve = Math.max(0, ...t.septJours.plats.map((p) => p.repas));
  const part = pourcent(t.septJours.nonRetires.nombre, t.septJours.nonRetires.total);

  return (
    <div className="w-full space-y-6">
      {/* En direct : un ticket servi au comptoir, depuis le site ou l'application mobile, apparaît ici en 5 s au plus. */}
      <RelireEnDirect />
      <EnTetePage titre="Tableau de bord" sousTitre={<span className="block first-letter:uppercase">{jourLong(t.aujourdhui)}</span>}
        actions={admin ? <Link href="/admin/rapport" className="hb hb--filet hb--petit">Rapport de la semaine</Link> : undefined} />

      <SChiffresBande items={[
        { titre: "Réservés aujourd'hui", valeur: nombre(t.service.reserves) },
        { titre: "Servis", valeur: nombre(t.service.servis) },
        { titre: "À servir", valeur: <span className="text-marque-texte">{nombre(t.service.aServir)}</span> },
        { titre: "Recharges à confirmer", valeur: nombre(t.rechargesEnAttente), detail: <span className="underline underline-offset-4">Voir les demandes</span>, href: "/admin/recharges" },
      ]} />

      {caisse ? (
        <div className="grid grid-cols-1 gap-4 @4xl/page:grid-cols-2">
          <CaisseCarte caisse={caisse} />
          <ATraiterCarte a={attente} />
        </div>
      ) : (
        <ATraiterCarte a={attente} />
      )}

      <div className="grid grid-cols-1 gap-4 @4xl/page:grid-cols-[minmax(0,1fr)_340px]">
        {/* Le graphique de la page : les repas réservés de la semaine, aujourd'hui seul en vert. */}
        <section className="sn-card min-w-0 p-5 @xl/page:p-6" aria-labelledby="titre-semaine">
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <div className="min-w-0">
              <h2 id="titre-semaine" className="text-[18px] leading-6">Réservations de la semaine</h2>
              <p className="mt-1 text-[14px] leading-5 text-texte-2 first-letter:uppercase">{periode(t.semaine[0].jour, t.semaine[6].jour)}</p>
            </div>
            <p className="chiffres shrink-0 text-[14px] leading-5 text-texte-2">
              <span className="mr-1 text-[24px] leading-8 font-semibold text-encre/95">{nombre(totalSemaine)}</span>{totalSemaine > 1 ? "repas réservés" : "repas réservé"}
            </p>
          </div>

          <ol className="mt-6 grid grid-cols-7">
            {t.semaine.map((j) => {
              const ici = j.jour === t.aujourdhui;
              const [nom, numero] = jourCourt(j.jour).split(" ");
              return (
                <li key={j.jour} className="flex min-w-0 flex-col items-center" title={`${jourLong(j.jour)} : ${repas(j.repas)}`}>
                  <span className="sr-only">{jourLong(j.jour)}{ici ? ", aujourd'hui" : ""} : {repas(j.repas)}</span>
                  <div aria-hidden="true" className="flex h-[200px] w-full flex-col items-center justify-end">
                    <span className={`chiffres pb-2 text-[14px] leading-5 ${ici ? "font-semibold text-encre/95" : "text-texte-2"}`}>{nombre(j.repas)}</span>
                    <span className={`w-6 rounded-t-[4px] ${ici ? "bg-marque" : "bg-[color:var(--h-surface-forte)]"}`}
                      style={{ height: `calc((100% - 28px) * ${partDeBarre(j.repas, plusHaut)})` }} />
                  </div>
                  <div aria-hidden="true" className={`w-full border-t border-[color:var(--h-filet)] pt-2 text-center text-[13px] leading-5 ${ici ? "font-semibold text-encre/95" : "text-texte-2"}`}>
                    <span className="block">{nom}</span>
                    <span className="chiffres block">{numero}</span>
                  </div>
                </li>
              );
            })}
          </ol>

          <p className="mt-4 flex items-start gap-2 text-[13px] leading-5 text-texte-2">
            <span aria-hidden="true" className="mt-1 size-3 shrink-0 rounded-[4px] bg-marque" />
            <span>Aujourd&apos;hui. Les jours à venir peuvent encore monter, on réserve jusqu&apos;à {cloture} le jour même</span>
          </p>
        </section>

        <section className="sn-card flex min-w-0 flex-col p-5 @xl/page:p-6" aria-labelledby="titre-demain">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 id="titre-demain" className="text-[18px] leading-6">Demain, à préparer</h2>
              <p className="mt-1 text-[14px] leading-5 text-texte-2 first-letter:uppercase">{jourLong(t.demain.jour)}</p>
            </div>
            {t.demain.plats.length > 0 && (
              <p className="chiffres shrink-0 text-[14px] leading-5 text-texte-2">
                <span className="mr-1 text-[24px] leading-8 font-semibold text-encre/95">{nombre(t.demain.total)}</span>repas
              </p>
            )}
          </div>

          {t.demain.plats.length === 0 ? (
            <div className="mt-5 rounded-[16px] border border-dashed border-[color:var(--h-filet)] px-4 py-8 text-center">
              <p className="text-[14px] leading-5 text-texte-2">Rien au menu de demain pour l&apos;instant</p>
              {admin && <Link href="/admin/menus" className="hb hb--filet hb--petit mt-4">Planifier les menus</Link>}
            </div>
          ) : (
            <>
              <ol className="mt-5 space-y-4">
                {t.demain.plats.map((p) => (
                  <LigneClassee key={p.id} nom={p.nom} part={partDeBarre(p.repas, plusDemain)}
                    valeur={p.portions === null ? fort(p.repas) : <>{fort(p.repas)} sur {nombre(p.portions)}</>} />
                ))}
              </ol>
              <div className="mt-auto pt-5 text-[13px] leading-5 text-texte-2">
                <p>Ça peut encore monter jusqu&apos;à demain {cloture}</p>
                <Link href="/admin/commandes?jour=demain" className="mt-1 inline-block font-medium text-encre/90 underline underline-offset-4">Voir qui a réservé</Link>
              </div>
            </>
          )}
        </section>
      </div>

      {argent && (
        <>
          <div className="pt-2">
            <STitreSection>L&apos;argent de la cantine</STitreSection>
            <p className="mt-1 text-[14px] leading-5 text-texte-2">Ce mois-ci, {argent.mois.periode}, comparé aux mêmes jours du mois d&apos;avant</p>
          </div>
          <SChiffresBande items={[
            {
              titre: "Encaissé aujourd'hui", valeur: fcfa(argent.aujourdhui.total), href: "/admin/recharges/encaissements",
              detail: argent.aujourdhui.parMoyen.length > 0 ? liste(argent.aujourdhui.parMoyen.map((p) => `${p.libelle} : ${fcfa(p.montant)}`)) : "Aucune recharge confirmée",
            },
            { titre: "Gagné ce mois", valeur: fcfa(argent.mois.gagne), detail: `${argent.avant.periode} : ${fcfa(argent.avant.gagne)}`, href: "/admin/recharges/ventes?p=mois" },
            { titre: "Dépensé ce mois", valeur: fcfa(argent.mois.depense), detail: `${argent.avant.periode} : ${fcfa(argent.avant.depense)}`, href: "/admin/recharges/depenses?p=mois" },
            { titre: "Bilan du mois", valeur: fcfa(argent.mois.resultat), detail: `${argent.avant.periode} : ${fcfa(argent.avant.resultat)}`, href: "/admin/recharges/bilan?p=mois" },
          ]} />
        </>
      )}

      {convives && argent && (
        <>
          <div className="pt-2">
            <STitreSection>Les convives</STitreSection>
          </div>
          <div className="grid grid-cols-1 gap-4 @2xl/page:grid-cols-2 @5xl/page:grid-cols-4">
            <SStatVertical title="Convives inscrits" value={nombre(convives.inscrits)}
              hint={`${pluriel(convives.eleves, "élève")} et ${pluriel(convives.employes, "employé")}`} />
            <SStatVertical title="Ont réservé cette semaine" value={convives.inscrits > 0 ? `${nombre(convives.actifs)} sur ${nombre(convives.inscrits)}` : "0"}
              hint={convives.nouveaux > 0 ? `${pluriel(convives.nouveaux, "nouveau compte", "nouveaux comptes")} ces 7 derniers jours` : "Aucun nouveau compte ces 7 derniers jours"} />
            <SStatVertical title="Sous leur seuil d'alerte" value={nombre(convives.sousSeuil)} href={convives.sousSeuil > 0 ? "/admin/recharges/soldes" : undefined}
              hint={convives.sousSeuil > 0 ? "Eux et leurs parents sont prévenus de recharger. Voir les soldes" : "Tous les soldes sont au-dessus du seuil"} />
            <SStatVertical title="Argent des convives en dépôt" value={fcfa(argent.enDepot)} href="/admin/recharges/soldes"
              hint="Leurs soldes, à eux tant qu'ils n'ont pas mangé" />
          </div>
        </>
      )}

      {journee && <EquipeCarte j={journee} />}

      {admin && (
        <>
          <div className="pt-2">
            <STitreSection>Les 7 derniers jours</STitreSection>
            <p className="mt-1 text-[14px] leading-5 text-texte-2 first-letter:uppercase">{periode(t.septJours.debut, t.septJours.fin)}</p>
          </div>

          <div className="grid grid-cols-1 gap-4 @4xl/page:grid-cols-[minmax(0,1fr)_340px]">
            <section className="sn-card min-w-0 p-5 @xl/page:p-6" aria-labelledby="titre-plats">
              <h2 id="titre-plats" className="text-[18px] leading-6">Plats les plus réservés</h2>
              {t.septJours.plats.length === 0 ? (
                <p className="mt-5 rounded-[16px] border border-dashed border-[color:var(--h-filet)] px-4 py-8 text-center text-[14px] leading-5 text-texte-2">Aucun repas réservé sur ces 7 jours</p>
              ) : (
                <ol className="mt-5 space-y-4 @md/page:space-y-5">
                  {t.septJours.plats.map((p, i) => (
                    <LigneClassee key={p.platId} rang={i + 1} photo={p.photo} nom={p.nom} part={partDeBarre(p.repas, plusReserve)} valeur={<>{fort(p.repas)} repas</>} />
                  ))}
                </ol>
              )}
            </section>

            <div className="grid grid-cols-1 gap-4 @2xl/page:grid-cols-2 @4xl/page:grid-cols-1">
              <SStatVertical title="Repas non retirés" href={t.septJours.nonRetires.nombre > 0 ? "/admin/non-retires" : undefined}
                value={t.septJours.nonRetires.total > 0 ? `${nombre(t.septJours.nonRetires.nombre)} sur ${nombre(t.septJours.nonRetires.total)}` : "0"}
                hint={part === null ? "Aucun repas réservé sur ces 7 jours" : t.septJours.nonRetires.nombre > 0 ? `${part} % des repas réservés. Voir qui` : `${part} % des repas réservés`} />
              <SStatVertical title="Restes pesés"
                value={t.septJours.restes.parRepas === null ? "Pas encore pesés" : `${poidsLisible(t.septJours.restes.parRepas)} par repas`}
                hint={t.septJours.restes.parRepas === null
                  ? "Pèse les restes de chaque plat dans Commandes, après le service"
                  : t.septJours.restes.plusLaisse
                    ? `Le plus laissé : ${t.septJours.restes.plusLaisse.nom}, ${poidsLisible(t.septJours.restes.plusLaisse.parRepas)} par repas`
                    : `${poidsLisible(t.septJours.restes.grammes)} pour ${repas(t.septJours.restes.servis)} servis`} />
              <SStatVertical title="Recharges confirmées" value={fcfa(t.septJours.recharges)}
                hint={<span className="chiffres">Aujourd&apos;hui : {fcfa(t.rechargesAujourdhui)}</span>} />
              <SStatVertical title="Note moyenne des plats"
                value={t.notes.moyenne === null ? "Aucune note" : noteLisible(t.notes.moyenne)}
                hint={t.notes.moyenne === null ? "Les convives notent leur repas une fois servi" : `${pluriel(t.notes.avis, "avis", "avis")} depuis le début`} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
