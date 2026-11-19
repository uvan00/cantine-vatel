import Link from "next/link";
import { EnTetePage } from "@/components/fenetre";
import { SChiffresBande, SStatVertical, STitreSection } from "@/components/sneat";
import { tableauDeBord } from "@/lib/donnees-admin";
import { fcfa, nombre, pluriel } from "@/lib/format";
import { maintenant } from "@/lib/horloge";
import { HEURE_CLOTURE_LISIBLE, jourCourt, jourLong } from "@/lib/jours";
import { exiger } from "@/lib/session";
import { noteLisible, partDeBarre, periode, pourcent } from "@/lib/statistiques";
import { VignettePlat } from "./vignette-plat";

// Le tableau de bord de la cantine : aujourd'hui en chiffres, la semaine en barres (le seul graphique de la page),
// demain par plat, puis les sept derniers jours. Tout est lu dans la base à chaque visite (src/lib/donnees-admin.ts).

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

export default async function PageTableauDeBord() {
  await exiger("admin");
  const t = await tableauDeBord(maintenant());

  const plusHaut = Math.max(0, ...t.semaine.map((j) => j.repas));
  const totalSemaine = t.semaine.reduce((s, j) => s + j.repas, 0);
  const plusDemain = Math.max(0, ...t.demain.plats.map((p) => p.repas));
  const plusReserve = Math.max(0, ...t.septJours.plats.map((p) => p.repas));
  const part = pourcent(t.septJours.nonRetires.nombre, t.septJours.nonRetires.total);

  return (
    <div className="w-full space-y-6">
      <EnTetePage titre="Tableau de bord" sousTitre={<span className="block first-letter:uppercase">{jourLong(t.aujourdhui)}</span>} />

      <SChiffresBande items={[
        { titre: "Réservés aujourd'hui", valeur: nombre(t.service.reserves) },
        { titre: "Servis", valeur: nombre(t.service.servis) },
        { titre: "À servir", valeur: <span className="text-marque-texte">{nombre(t.service.aServir)}</span> },
        { titre: "Recharges à confirmer", valeur: nombre(t.rechargesEnAttente), detail: <span className="underline underline-offset-4">Voir les demandes</span>, href: "/admin/recharges" },
      ]} />

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
            <span>Aujourd&apos;hui. Les jours à venir peuvent encore monter, on réserve jusqu&apos;à {HEURE_CLOTURE_LISIBLE} le jour même</span>
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
              <Link href="/admin/menus" className="hb hb--filet hb--petit mt-4">Planifier les menus</Link>
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
                <p>Ça peut encore monter jusqu&apos;à demain {HEURE_CLOTURE_LISIBLE}</p>
                <Link href="/admin/commandes?jour=demain" className="mt-1 inline-block font-medium text-encre/90 underline underline-offset-4">Voir qui a réservé</Link>
              </div>
            </>
          )}
        </section>
      </div>

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

        <div className="grid grid-cols-1 gap-4 @2xl/page:grid-cols-3 @4xl/page:grid-cols-1">
          <SStatVertical title="Repas non retirés"
            value={t.septJours.nonRetires.total > 0 ? `${nombre(t.septJours.nonRetires.nombre)} sur ${nombre(t.septJours.nonRetires.total)}` : "0"}
            hint={part === null ? "Aucun repas réservé sur ces 7 jours" : `${part} % des repas réservés`} />
          <SStatVertical title="Recharges confirmées" value={fcfa(t.septJours.recharges)}
            hint={<span className="chiffres">Aujourd&apos;hui : {fcfa(t.rechargesAujourdhui)}</span>} />
          <SStatVertical title="Note moyenne des plats"
            value={t.notes.moyenne === null ? "Aucune note" : noteLisible(t.notes.moyenne)}
            hint={t.notes.moyenne === null ? "Les convives notent leur repas une fois servi" : `${pluriel(t.notes.avis, "avis", "avis")} depuis le début`} />
        </div>
      </div>
    </div>
  );
}
