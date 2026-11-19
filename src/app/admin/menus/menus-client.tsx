"use client";

import { useState } from "react";
import Link from "next/link";
import { EnTetePage } from "@/components/fenetre";
import { ChevronLeft, ChevronRight, Plus } from "@/components/icons";
import { SBtn, SChip, STable, STabs, STd, STr } from "@/components/sneat";
import type { VueJourMenu, VueMenuJour, VuePlat } from "@/lib/donnees-admin";
import { fcfa, liste, pluriel } from "@/lib/format";
import { ajouterJours, jourLong } from "@/lib/jours";
import { nomAllergene } from "@/lib/listes";
import { estComplet } from "@/lib/reservation";
import { noteLisible, periode } from "@/lib/statistiques";
import { VignettePlat } from "../vignette-plat";
import { FenetreAjout, FenetrePlat, TiroirMenuJour, reservesEnMots } from "./fenetres";

// Les menus : la semaine jour par jour (du lundi au dimanche, `?semaine=` dans l'adresse) et la carte de tous les plats.
// Aujourd'hui et les jours à venir se planifient ; les jours passés se lisent seulement.

type Vue = "semaine" | "plats";
type Ouvert = { genre: "ajout"; jour: string } | { genre: "menu"; id: string } | { genre: "plat"; id: string } | null;

const LIEN_ICONE = "grid size-10 shrink-0 place-items-center rounded-[12px] text-encre/90 transition-colors hover:bg-[color:var(--h-survol)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--h-marque-texte))]";

export function MenusClient({ aujourdhui, lundi, semaine, plats, photos }: {
  aujourdhui: string; lundi: string; semaine: VueJourMenu[]; plats: VuePlat[]; photos: string[];
}) {
  const [vue, setVue] = useState<Vue>("semaine");
  const [ouvert, setOuvert] = useState<Ouvert>(null);
  const fermer = () => setOuvert(null);

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
        <div>
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

          <div className="mt-4 divide-y divide-[color:var(--h-filet)] border-y border-[color:var(--h-filet)]">
            {semaine.map((j) => (
              <JourMenu key={j.jour} jour={j} aujourdhui={aujourdhui}
                onAjouter={() => setOuvert({ genre: "ajout", jour: j.jour })} onOuvrir={(id) => setOuvert({ genre: "menu", id })} />
            ))}
          </div>
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

/* ── Un jour de la semaine et ses plats ────────────────────────────────────── */

function JourMenu({ jour, aujourdhui, onAjouter, onOuvrir }: { jour: VueJourMenu; aujourdhui: string; onAjouter: () => void; onOuvrir: (id: string) => void }) {
  const passe = jour.jour < aujourdhui;
  const ici = jour.jour === aujourdhui;
  const reserves = jour.plats.reduce((s, m) => s + m.reservees, 0);
  return (
    <section aria-labelledby={`jour-${jour.jour}`} className="grid grid-cols-1 items-start gap-x-6 gap-y-3 py-5 @6xl/page:grid-cols-[220px_minmax(0,1fr)]">
      <div className="flex items-start justify-between gap-3 @6xl/page:block">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 id={`jour-${jour.jour}`} className="text-[16px] leading-6 first-letter:uppercase">{jourLong(jour.jour)}</h2>
            {ici && <SChip size="sm">Aujourd&apos;hui</SChip>}
            {passe && <SChip tone="secondary" size="sm">Passé</SChip>}
          </div>
          {jour.plats.length > 0 && (
            <p className="chiffres mt-1 text-[13px] leading-5 text-texte-2">{pluriel(jour.plats.length, "plat")}, {pluriel(reserves, "repas réservé", "repas réservés")}</p>
          )}
        </div>
        {!passe && (
          <SBtn size="sm" variant="outlined" tone="secondary" className="@6xl/page:mt-3" onClick={onAjouter} aria-label={`Ajouter un plat au menu du ${jourLong(jour.jour)}`}>
            <Plus className="size-4" strokeWidth={1.8} /><span>Ajouter un plat</span>
          </SBtn>
        )}
      </div>

      {jour.plats.length === 0 ? (
        <p className="rounded-[16px] border border-dashed border-[color:var(--h-filet)] px-4 py-6 text-center text-[14px] leading-5 text-texte-2">
          {passe ? "Rien n'était au menu ce jour-là" : "Rien au menu ce jour-là pour l'instant"}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 @xl/page:grid-cols-2 @3xl/page:grid-cols-3">
          {jour.plats.map((m) => <li key={m.id} className="flex"><TuilePlat menu={m} lectureSeule={passe} onOuvrir={() => onOuvrir(m.id)} /></li>)}
        </ul>
      )}
    </section>
  );
}

function TuilePlat({ menu, lectureSeule, onOuvrir }: { menu: VueMenuJour; lectureSeule: boolean; onOuvrir: () => void }) {
  const complet = !menu.epuise && estComplet(menu);
  const contenu = (
    <>
      <VignettePlat photo={menu.photo} className="w-20" />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] leading-5 font-semibold text-encre/95">{menu.nom}</span>
        <span className="chiffres mt-0.5 block text-[13px] leading-5 text-texte-2">{fcfa(menu.prix)}</span>
        <span className="chiffres flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-5 text-texte-2">
          <span>{reservesEnMots(menu)}</span>
          {menu.epuise && <SChip tone="warning" size="sm">Épuisé</SChip>}
          {complet && <SChip tone="secondary" size="sm">Complet</SChip>}
        </span>
      </span>
      {!lectureSeule && <span className="sr-only">Régler ce plat</span>}
      {!lectureSeule && <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-texte-2" strokeWidth={1.8} />}
    </>
  );
  const classes = "flex w-full items-center gap-3 rounded-[16px] border border-[color:var(--h-filet)] bg-surface p-3 text-left";
  if (lectureSeule) return <div className={classes}>{contenu}</div>;
  return (
    <button type="button" onClick={onOuvrir}
      className={`${classes} transition-colors hover:bg-[color:var(--h-filet-doux)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--h-marque-texte))]`}>
      {contenu}
    </button>
  );
}

/* ── La carte : tous les plats, avec leur fiche à modifier ─────────────────── */

const regimeDe = (p: VuePlat) => (p.vegetarien ? "Végétarien" : p.porc ? "Contient du porc" : "");
const allergenesDe = (p: VuePlat) => (p.allergenes.length > 0 ? liste(p.allergenes.map(nomAllergene)) : "Aucun déclaré");
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
              <STd className="first-letter:uppercase">{allergenesDe(p)}</STd>
              <STd className="whitespace-nowrap">{regimeDe(p)}</STd>
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
                <span className="chiffres block">{fcfa(p.prix)}{regimeDe(p) ? `, ${regimeDe(p).toLowerCase()}` : ""}</span>
                <span className="block">Allergènes : {allergenesDe(p).toLowerCase()}</span>
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
