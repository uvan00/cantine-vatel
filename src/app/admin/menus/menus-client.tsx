"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { EtiquetteAliment, EtiquettesAliments } from "@/components/allergene";
import { EnTetePage } from "@/components/fenetre";
import { ChevronLeft, ChevronRight, Plus } from "@/components/icons";
import { SBtn, SChip, STable, STabs, STd, STr } from "@/components/sneat";
import type { VueJourMenu, VueMenuJour, VuePlat } from "@/lib/donnees-admin";
import { fcfa, pluriel } from "@/lib/format";
import { ajouterJours, jourCourt, jourLong, numeroDuJour } from "@/lib/jours";
import { etiquettesAllergenes } from "@/lib/listes";
import { estComplet } from "@/lib/reservation";
import { noteLisible, periode } from "@/lib/statistiques";
import { VignettePlat } from "../vignette-plat";
import { EcartesEnImages, FenetreAjout, FenetrePlat, TiroirMenuJour, etiquetteDuRegime, reservesEnMots } from "./fenetres";

// Les menus : la semaine (du lundi au dimanche, `?semaine=` dans l'adresse) et la carte de tous les plats.
// La semaine se lit d'un coup d'oeil dans la bande des sept jours (plats et réservations de chacun, « À planifier »
// s'il n'a pas de menu) ; dessous, les plats du jour choisi, aujourd'hui d'office (choix du propriétaire du
// 21/11/2026, pour ne plus faire défiler les jours passés). Aujourd'hui et les jours à venir se planifient ; les jours
// passés se lisent seulement.

type Vue = "semaine" | "plats";
type Ouvert = { genre: "ajout"; jour: string } | { genre: "menu"; id: string } | { genre: "plat"; id: string } | null;

const LIEN_ICONE = "grid size-10 shrink-0 place-items-center rounded-[12px] text-encre/90 transition-colors hover:bg-[color:var(--h-survol)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--h-marque-texte))]";
const ANNEAU = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--h-marque-texte))]";

const reservesDu = (j: VueJourMenu) => j.plats.reduce((s, m) => s + m.reservees, 0);

export function MenusClient({ aujourdhui, lundi, semaine, plats, photos, cloture, closAujourdhui }: {
  aujourdhui: string; lundi: string; semaine: VueJourMenu[]; plats: VuePlat[]; photos: string[];
  /** L'heure de clôture réglée par la cantine, lisible (« 9 h »). */
  cloture: string;
  /** Vrai quand la clôture d'aujourd'hui est passée. */
  closAujourdhui: boolean;
}) {
  const [vue, setVue] = useState<Vue>("semaine");
  const [ouvert, setOuvert] = useState<Ouvert>(null);
  // Le jour choisi : aujourd'hui quand il est dans cette semaine, sinon le lundi. La page passe `key={lundi}` : changer
  // de semaine repart de là.
  const [choisi, setChoisi] = useState(semaine.some((j) => j.jour === aujourdhui) ? aujourdhui : lundi);
  const fermer = () => setOuvert(null);

  const jourChoisi = semaine.find((j) => j.jour === choisi) ?? semaine[0];
  const menuOuvert = ouvert?.genre === "menu" ? semaine.flatMap((j) => j.plats).find((m) => m.id === ouvert.id) : undefined;
  const platOuvert = ouvert?.genre === "plat" ? plats.find((p) => p.id === ouvert.id) : undefined;
  const jourOuvert = ouvert?.genre === "ajout" ? semaine.find((j) => j.jour === ouvert.jour) : undefined;

  return (
    <div className="w-full space-y-6">
      <EnTetePage titre="Menus" sousTitre="Ce que la cantine sert, jour par jour, et la carte de ses plats" />

      <STabs variant="souligne" value={vue} onChange={setVue} tabs={[
        { id: "semaine", label: "La semaine" },
        { id: "plats", label: "Les plats", badge: plats.length },
      ]} />

      {vue === "semaine" ? (
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                <Link href={`/admin/menus?semaine=${ajouterJours(lundi, -7)}`} aria-label="Semaine précédente" title="Semaine précédente" className={LIEN_ICONE}>
                  <ChevronLeft className="size-5" strokeWidth={1.8} />
                </Link>
                <p className="chiffres min-w-[216px] text-center text-[15px] leading-5 font-semibold text-encre/95">Semaine {periode(lundi, ajouterJours(lundi, 6), false)}</p>
                <Link href={`/admin/menus?semaine=${ajouterJours(lundi, 7)}`} aria-label="Semaine suivante" title="Semaine suivante" className={LIEN_ICONE}>
                  <ChevronRight className="size-5" strokeWidth={1.8} />
                </Link>
              </div>
              {!semaine.some((j) => j.jour === aujourdhui) && <Link href="/admin/menus" className="hb hb--filet hb--petit">Cette semaine</Link>}
            </div>
            <BandeSemaine semaine={semaine} aujourdhui={aujourdhui} choisi={jourChoisi.jour} onChoisir={setChoisi} />
          </div>

          <PanneauJour jour={jourChoisi} aujourdhui={aujourdhui} cloture={cloture} closAujourdhui={closAujourdhui}
            onAjouter={() => setOuvert({ genre: "ajout", jour: jourChoisi.jour })} onOuvrir={(id) => setOuvert({ genre: "menu", id })} />
        </div>
      ) : (
        <CarteDesPlats plats={plats} onOuvrir={(id) => setOuvert({ genre: "plat", id })} />
      )}

      {jourOuvert && <FenetreAjout jour={jourOuvert.jour} plats={plats} dejaAuMenu={jourOuvert.plats.map((m) => m.platId)} photos={photos} onClose={fermer} />}
      {menuOuvert && <TiroirMenuJour key={menuOuvert.id} menu={menuOuvert} onClose={fermer} />}
      {platOuvert && <FenetrePlat key={platOuvert.id} plat={platOuvert} photos={photos} onClose={fermer} />}
    </div>
  );
}

/* ── La bande des sept jours ───────────────────────────────────────────────── */

/**
 * Les sept jours en onglets : le jour, sa date, ses plats et ses réservations, ou « À planifier » quand un jour à venir
 * n'a pas de menu. Les flèches du clavier passent d'un jour à l'autre. Aujourd'hui garde un point quand on regarde
 * ailleurs ; les jours passés sont plus pâles ; un jour à venir sans menu a un bord en pointillé.
 */
function BandeSemaine({ semaine, aujourdhui, choisi, onChoisir }: {
  semaine: VueJourMenu[]; aujourdhui: string; choisi: string; onChoisir: (jour: string) => void;
}) {
  const boutons = useRef<(HTMLButtonElement | null)[]>([]);
  const aller = (i: number) => {
    const n = (i + semaine.length) % semaine.length;
    onChoisir(semaine[n].jour);
    boutons.current[n]?.focus();
  };
  const ici = semaine.findIndex((j) => j.jour === choisi);
  return (
    <div role="tablist" aria-label="Les jours de la semaine" className="grid grid-cols-7 gap-1.5 @xl/page:gap-2"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") { e.preventDefault(); aller(ici + 1); }
        else if (e.key === "ArrowLeft") { e.preventDefault(); aller(ici - 1); }
      }}>
      {semaine.map((j, i) => {
        const actif = j.jour === choisi;
        const passe = j.jour < aujourdhui;
        const vide = j.plats.length === 0;
        const reserves = reservesDu(j);
        const etat = vide ? (passe ? "Rien au menu" : "À planifier") : pluriel(j.plats.length, "plat");
        return (
          <button key={j.jour} ref={(b) => { boutons.current[i] = b; }} type="button" role="tab" id={`onglet-${j.jour}`}
            aria-selected={actif} aria-controls="panneau-jour" tabIndex={actif ? 0 : -1} onClick={() => onChoisir(j.jour)}
            aria-label={`${jourLong(j.jour)}${j.jour === aujourdhui ? ", aujourd'hui" : ""}, ${vide ? etat.toLowerCase() : `${etat}, ${pluriel(reserves, "repas réservé", "repas réservés")}`}`}
            className={`relative flex min-w-0 flex-col items-center rounded-[16px] border px-1 pt-2 pb-2.5 text-center transition-colors ${ANNEAU} ${
              actif ? "border-[rgb(var(--h-marque-texte))] bg-[rgb(var(--h-marque-teinte)/var(--h-teinte))] text-marque-texte"
              : `bg-surface hover:bg-[color:var(--h-filet-doux)] ${vide && !passe ? "border-dashed border-[color:var(--h-surface-forte)]" : "border-[color:var(--h-filet)]"} ${passe ? "text-encre/55" : "text-encre/90"}`}`}>
            <span aria-hidden="true" className="text-[12px] leading-4">{jourCourt(j.jour).split(" ")[0]}</span>
            <span aria-hidden="true" className="chiffres text-[20px] leading-7 font-semibold">{numeroDuJour(j.jour)}</span>
            {/* Au téléphone, une ligne (la place d'un mot) ; dès qu'il y a la place, le nombre de plats et de réservés. */}
            <span aria-hidden="true" className={`chiffres w-full truncate text-[11px] leading-4 @3xl/page:text-[13px] @3xl/page:leading-5 ${actif ? "" : "text-texte-2"}`}>
              <span className="@3xl/page:hidden">{vide ? (passe ? "Rien" : "À faire") : etat}</span>
              <span className="hidden @3xl/page:inline">{etat}</span>
            </span>
            {!vide && (
              <span aria-hidden="true" className={`chiffres hidden text-[13px] leading-5 @3xl/page:block ${actif ? "" : "text-texte-2"}`}>
                {pluriel(reserves, "réservé")}
              </span>
            )}
            {j.jour === aujourdhui && !actif && <span aria-hidden="true" className="absolute top-2 right-2 size-1.5 rounded-full bg-marque" />}
          </button>
        );
      })}
    </div>
  );
}

/* ── Le jour choisi et ses plats ───────────────────────────────────────────── */

function PanneauJour({ jour, aujourdhui, cloture, closAujourdhui, onAjouter, onOuvrir }: {
  jour: VueJourMenu; aujourdhui: string; cloture: string; closAujourdhui: boolean; onAjouter: () => void; onOuvrir: (id: string) => void;
}) {
  const passe = jour.jour < aujourdhui;
  const ici = jour.jour === aujourdhui;
  const vide = jour.plats.length === 0;
  // Où en sont les réservations de ce jour, d'après l'heure de clôture réglée par la cantine. L'espace insécable garde
  // « 9 h » sur une même ligne.
  const heure = cloture.replace(" ", "\u00a0");
  const reservations = passe ? "jour passé, ses plats se lisent seulement"
    : ici ? (closAujourdhui ? `réservations closes depuis ${heure}` : `on réserve jusqu'à ${heure}`)
    : `on réserve jusqu'à ${heure} le jour même`;
  const resume = vide ? reservations : `${pluriel(jour.plats.length, "plat")}, ${pluriel(reservesDu(jour), "repas réservé", "repas réservés")}, ${reservations}`;
  return (
    <section role="tabpanel" id="panneau-jour" aria-labelledby={`onglet-${jour.jour}`} className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="text-[20px] leading-7 first-letter:uppercase">{jourLong(jour.jour)}</h2>
            {ici && <SChip size="sm">Aujourd&apos;hui</SChip>}
          </div>
          <p className="chiffres mt-1 text-[14px] leading-5 text-texte-2 first-letter:uppercase">{resume}</p>
        </div>
        {!passe && !vide && (
          <SBtn size="sm" variant="outlined" tone="secondary" onClick={onAjouter} aria-label={`Ajouter un plat au menu du ${jourLong(jour.jour)}`}>
            <Plus className="size-4" strokeWidth={1.8} /><span>Ajouter un plat</span>
          </SBtn>
        )}
      </div>

      {vide ? (
        <div className="rounded-[20px] border border-dashed border-[color:var(--h-surface-forte)] px-6 py-12 text-center">
          <p className="text-[15px] leading-6 text-encre/90">{passe ? "Rien n'était au menu ce jour-là" : "Rien au menu ce jour-là pour l'instant"}</p>
          {!passe && (
            <SBtn size="sm" tone="secondary" className="mt-4" onClick={onAjouter} aria-label={`Ajouter un plat au menu du ${jourLong(jour.jour)}`}>
              <Plus className="size-4" strokeWidth={1.8} /><span>Ajouter un plat</span>
            </SBtn>
          )}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 @xl/page:grid-cols-2 @4xl/page:grid-cols-3">
          {jour.plats.map((m) => <li key={m.id} className="flex"><CartePlatDuJour menu={m} lectureSeule={passe} onOuvrir={() => onOuvrir(m.id)} /></li>)}
        </ul>
      )}
    </section>
  );
}

/**
 * Un plat du jour en grande carte : sa photo, son nom, son prix, ses réservations (et la jauge des portions quand la
 * cantine en a prévu), puis qui ne pourra pas le prendre. Cliquée, la carte ouvre « Régler ce plat ».
 */
function CartePlatDuJour({ menu, lectureSeule, onOuvrir }: { menu: VueMenuJour; lectureSeule: boolean; onOuvrir: () => void }) {
  const complet = !menu.epuise && estComplet(menu);
  const part = menu.portions ? Math.min(1, menu.reservees / menu.portions) : null;
  const contenu = (
    <>
      {/* Coins de 20 et marge de 10 : la photo garde les coins de 10 de VignettePlat. */}
      <VignettePlat photo={menu.photo} className="w-full" />
      <span className="mt-3 block px-1.5 text-[16px] leading-6 font-semibold text-encre/95">{menu.nom}</span>
      <span className="chiffres block px-1.5 text-[14px] leading-5 text-texte-2">{fcfa(menu.prix)}</span>
      <span className="chiffres mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 px-1.5 text-[14px] leading-5 text-encre/90">
        <span>{reservesEnMots(menu)}</span>
        {menu.epuise && <SChip tone="warning" size="sm">Épuisé</SChip>}
        {complet && <SChip tone="secondary" size="sm">Complet</SChip>}
      </span>
      {part !== null && (
        <span aria-hidden="true" className="mx-1.5 mt-2 block h-1.5 overflow-hidden rounded-full bg-[color:var(--h-surface)]">
          <span className="block h-full rounded-full bg-marque" style={{ width: `${Math.round(part * 100)}%` }} />
        </span>
      )}
      {!lectureSeule && menu.ecartes.total > 0 && <EcartesEnImages ecartes={menu.ecartes} className="chiffres mt-2 px-1.5 text-[13px] leading-5 text-texte-2" />}
      {!lectureSeule && (
        <span className="mt-auto flex items-center justify-between gap-2 px-1.5 pt-3 text-[14px] leading-5 font-medium text-marque-texte">
          Régler ce plat <ChevronRight aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.8} />
        </span>
      )}
    </>
  );
  const classes = "flex w-full flex-col rounded-[20px] border border-[color:var(--h-filet)] bg-surface p-2.5 pb-3 text-left";
  if (lectureSeule) return <div className={classes}>{contenu}</div>;
  return (
    <button type="button" onClick={onOuvrir}
      className={`${classes} transition-colors hover:bg-[color:var(--h-filet-doux)] ${ANNEAU}`}>
      {contenu}
    </button>
  );
}

/* ── La carte : tous les plats, avec leur fiche à modifier ─────────────────── */

/** Le régime du plat, son dessin à côté de son nom ; rien s'il n'en déclare aucun. */
function Regime({ plat }: { plat: VuePlat }) {
  const e = etiquetteDuRegime(plat);
  return e ? <EtiquetteAliment etiquette={e} taille={20} /> : null;
}
/** Les allergènes déclarés, chacun avec son dessin, ou « aucun déclaré ». */
function Allergenes({ plat, vide }: { plat: VuePlat; vide: string }) {
  return plat.allergenes.length > 0
    ? <EtiquettesAliments etiquettes={etiquettesAllergenes(plat.allergenes)} taille={20} />
    : <span>{vide}</span>;
}
const noteDe = (p: VuePlat) => (p.note === null ? "Pas encore d'avis" : `${noteLisible(p.note)}, ${pluriel(p.avis, "avis", "avis")}`);

function CarteDesPlats({ plats, onOuvrir }: { plats: VuePlat[]; onOuvrir: (id: string) => void }) {
  if (plats.length === 0) {
    return (
      <p className="rounded-[16px] border border-dashed border-[color:var(--h-filet)] px-4 py-10 text-center text-[14px] leading-5 text-texte-2">
        La carte est vide. Crée ton premier plat en l&apos;ajoutant à un jour de la semaine
      </p>
    );
  }
  return (
    <>
      <div className="sn-card hidden overflow-hidden @4xl/page:block">
        <STable head={["Plat", "Prix proposé", "Allergènes", "Régime", "Note", ""]}>
          {plats.map((p) => (
            <STr key={p.id} onClick={() => onOuvrir(p.id)}>
              <STd>
                <span className="flex items-center gap-3">
                  <VignettePlat photo={p.photo} className="w-16" />
                  <span className="min-w-0">
                    <span className="block font-semibold text-encre/95">{p.nom}</span>
                    <span className="hidden max-w-[440px] text-[13px] text-texte-2 @6xl/page:block">{p.description}</span>
                  </span>
                </span>
              </STd>
              <STd className="chiffres whitespace-nowrap">{fcfa(p.prix)}</STd>
              <STd><Allergenes plat={p} vide="Aucun déclaré" /></STd>
              <STd className="whitespace-nowrap"><Regime plat={p} /></STd>
              <STd className="chiffres whitespace-nowrap">{noteDe(p)}</STd>
              <STd className="text-right">
                <SBtn size="sm" variant="tonal" tone="secondary" aria-label={`Modifier ${p.nom}`} onClick={(e) => { e.stopPropagation(); onOuvrir(p.id); }}>Modifier</SBtn>
              </STd>
            </STr>
          ))}
        </STable>
      </div>

      <ul className="grid grid-cols-1 gap-2 @2xl/page:grid-cols-2 @4xl/page:hidden">
        {plats.map((p) => (
          <li key={p.id} className="flex">
            <button type="button" onClick={() => onOuvrir(p.id)}
              className="flex w-full items-start gap-3 rounded-[16px] border border-[color:var(--h-filet)] bg-surface p-3 text-left transition-colors hover:bg-[color:var(--h-filet-doux)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--h-marque-texte))]">
              <VignettePlat photo={p.photo} className="w-20" />
              <span className="min-w-0 flex-1 text-[13px] leading-5 text-texte-2">
                <span className="block text-[15px] font-semibold text-encre/95">{p.nom}</span>
                <span className="chiffres block">{fcfa(p.prix)}</span>
                {etiquetteDuRegime(p) && <span className="mt-1 block"><Regime plat={p} /></span>}
                <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1"><span>Allergènes :</span><Allergenes plat={p} vide="aucun déclaré" /></span>
                <span className="chiffres block">{noteDe(p)}</span>
                <span className="sr-only">Modifier ce plat</span>
              </span>
              <ChevronRight aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-texte-2" strokeWidth={1.8} />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
