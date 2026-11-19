"use client";

import { useState, useTransition } from "react";
import { Fenetre, Tiroir } from "@/components/fenetre";
import { Check } from "@/components/icons";
import { PhotoPlat } from "@/components/photo-plat";
import { SBtn, SCheckbox, SField, SInput, SSelect, SSwitch, STabs, STextarea } from "@/components/sneat";
import type { VueMenuJour, VuePlat } from "@/lib/donnees-admin";
import { fcfa, pluriel } from "@/lib/format";
import { jourLong } from "@/lib/jours";
import { ALLERGENES } from "@/lib/listes";
import { DESCRIPTION_MAX, NOM_MAX, PORTIONS_MAX, PRIX_MAX, PRIX_MIN, portionsValables, prixValable } from "@/lib/menu";
import { ajouterPlatAuMenu, creerPlatAuMenu, enregistrerMenuJour, enregistrerPlat, retirerPlatDuMenu, type Retour, type SaisiePlat } from "./actions";

// Les fenêtres de la page des menus : ajouter un plat à un jour, régler un plat du jour, corriger la fiche d'un plat.
// L'écran vérifie la saisie pour dire tout de suite ce qui cloche ; le serveur revérifie tout (./actions.ts).

const AIDE_PRIX = `Entre ${fcfa(PRIX_MIN)} et ${fcfa(PRIX_MAX)}`;
const AIDE_PORTIONS = "Laisse vide s'il n'y a pas de limite";
const chiffres = (texte: string) => texte.replace(/\D/g, "").replace(/^0+/, "");
const nombreOuRien = (texte: string) => (texte === "" ? null : Number(texte));
const prixSaisi = (texte: string) => (texte !== "" && prixValable(Number(texte)) ? Number(texte) : null);

/** « 12 réservés sur 40 », « 23 réservés » */
export const reservesEnMots = (m: { reservees: number; portions: number | null }) =>
  m.portions === null ? pluriel(m.reservees, "réservé") : `${pluriel(m.reservees, "réservé")} sur ${m.portions.toLocaleString("fr-FR")}`;

function Erreur({ children }: { children: React.ReactNode }) {
  return <p role="alert" className="text-[14px] leading-5 text-erreur-texte">{children}</p>;
}

/** Un champ de nombre entier, avec son aide qui passe au rouge quand la saisie ne convient pas. */
function ChampNombre({ label, aide, valeur, onChange, correct, longueur }: {
  label: string; aide: string; valeur: string; onChange: (v: string) => void; correct: boolean; longueur: number;
}) {
  return (
    <SField label={label} hint={<span className={correct ? "" : "text-erreur-texte"}>{aide}</span>}>
      <SInput inputMode="numeric" autoComplete="off" value={valeur} maxLength={longueur} aria-invalid={!correct}
        onChange={(e) => onChange(chiffres(e.target.value))} className="chiffres" />
    </SField>
  );
}

/* ── La fiche d'un plat : les champs partagés par « nouveau plat » et « modifier le plat » ───── */

type FichePlat = { nom: string; description: string; prix: string; allergenes: string[]; porc: boolean; vegetarien: boolean; photo: string };

const FICHE_VIDE: FichePlat = { nom: "", description: "", prix: "", allergenes: [], porc: false, vegetarien: false, photo: "" };
const ficheDe = (p: VuePlat): FichePlat => ({ nom: p.nom, description: p.description, prix: String(p.prix), allergenes: p.allergenes, porc: p.porc, vegetarien: p.vegetarien, photo: p.photo });

/** Ce qu'il manque à la fiche pour partir, en une phrase ; null quand elle est prête. */
function manqueALaFiche(f: FichePlat): string | null {
  const nom = f.nom.trim();
  if (nom.length < 2 || nom.length > NOM_MAX) return `Un nom de plat de 2 à ${NOM_MAX} caractères`;
  if (prixSaisi(f.prix) === null) return `Un prix entre ${fcfa(PRIX_MIN)} et ${fcfa(PRIX_MAX)}`;
  return null;
}

const saisieDe = (f: FichePlat): SaisiePlat => ({ nom: f.nom.trim(), description: f.description.trim(), photo: f.photo, prix: Number(f.prix), allergenes: f.allergenes, porc: f.porc, vegetarien: f.vegetarien });

/** « /plats/riz-sauce-arachide.jpg » → « riz sauce arachide », pour nommer la photo à un lecteur d'écran. */
const nomDePhoto = (photo: string) => photo.replace(/^.*\//, "").replace(/\.[a-z]+$/i, "").replace(/-/g, " ");

function ChampsPlat({ fiche, onChange, photos }: { fiche: FichePlat; onChange: (f: FichePlat) => void; photos: string[] }) {
  const cocher = (id: string, coche: boolean) =>
    onChange({ ...fiche, allergenes: coche ? [...fiche.allergenes, id] : fiche.allergenes.filter((a) => a !== id) });
  // Une photo déjà choisie reste proposée, même si son fichier n'est plus dans le dossier.
  const proposees = fiche.photo && !photos.includes(fiche.photo) ? [fiche.photo, ...photos] : photos;
  return (
    <div className="space-y-5">
      <SField label="Nom du plat">
        <SInput value={fiche.nom} maxLength={NOM_MAX} autoComplete="off" onChange={(e) => onChange({ ...fiche, nom: e.target.value })} />
      </SField>
      <SField label="Description" hint="Ce qu'il y a dans l'assiette, en quelques mots. Tu peux laisser vide">
        <STextarea value={fiche.description} maxLength={DESCRIPTION_MAX} rows={2} onChange={(e) => onChange({ ...fiche, description: e.target.value })} />
      </SField>
      <ChampNombre label="Prix proposé, en francs CFA" aide={AIDE_PRIX} valeur={fiche.prix} longueur={5}
        correct={fiche.prix === "" || prixSaisi(fiche.prix) !== null} onChange={(prix) => onChange({ ...fiche, prix })} />

      <fieldset>
        <legend className="mb-3 pl-0.5 text-[14px] leading-5 font-semibold text-encre/95">Allergènes</legend>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          {ALLERGENES.map((a) => (
            <SCheckbox key={a.id} checked={fiche.allergenes.includes(a.id)} onChange={(coche) => cocher(a.id, coche)}
              label={<span className="inline-block first-letter:uppercase">{a.nom}</span>} />
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-3 pl-0.5 text-[14px] leading-5 font-semibold text-encre/95">Régimes</legend>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          <SCheckbox checked={fiche.porc} onChange={(porc) => onChange({ ...fiche, porc, vegetarien: porc ? false : fiche.vegetarien })} label="Contient du porc" />
          <SCheckbox checked={fiche.vegetarien} onChange={(vegetarien) => onChange({ ...fiche, vegetarien, porc: vegetarien ? false : fiche.porc })} label="Végétarien" />
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-3 pl-0.5 text-[14px] leading-5 font-semibold text-encre/95">Photo</legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {["", ...proposees].map((photo) => {
            const choisie = fiche.photo === photo;
            return (
              <button key={photo || "sans"} type="button" aria-pressed={choisie} onClick={() => onChange({ ...fiche, photo })}
                aria-label={photo ? `Photo : ${nomDePhoto(photo)}` : undefined}
                className={`relative overflow-hidden rounded-[12px] bg-surface transition-shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--h-marque-texte))] ${choisie ? "shadow-[0_0_0_2px_rgb(var(--sn-cta))]" : "shadow-[0_0_0_1px_var(--h-filet)] hover:shadow-[0_0_0_1px_var(--h-surface-forte)]"}`}>
                {photo
                  ? <PhotoPlat photo={photo} nom="" />
                  : <span className="grid aspect-video w-full place-items-center px-2 text-center text-[13px] leading-4 text-texte-2">Sans photo</span>}
                {choisie && (
                  <span aria-hidden="true" className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-[rgb(var(--sn-cta))] text-white">
                    <Check className="size-3.5" strokeWidth={2.4} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}

/* ── Ajouter un plat au menu d'un jour ─────────────────────────────────────── */

type Source = "carte" | "nouveau";

export function FenetreAjout({ jour, plats, dejaAuMenu, photos, onClose }: {
  jour: string; plats: VuePlat[];
  /** Les plats déjà au menu de ce jour : ils ne se proposent pas une seconde fois. */
  dejaAuMenu: string[];
  photos: string[]; onClose: () => void;
}) {
  const libres = plats.filter((p) => !dejaAuMenu.includes(p.id));
  const [source, setSource] = useState<Source>(libres.length > 0 ? "carte" : "nouveau");
  const [platId, setPlatId] = useState("");
  const [prix, setPrix] = useState("");
  const [portions, setPortions] = useState("");
  const [fiche, setFiche] = useState<FichePlat>(FICHE_VIDE);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const choisi = libres.find((p) => p.id === platId);
  const portionsOk = portionsValables(nombreOuRien(portions));
  const manque = source === "carte"
    ? (!choisi ? "Choisis un plat de la carte" : prixSaisi(prix) === null ? `Un prix entre ${fcfa(PRIX_MIN)} et ${fcfa(PRIX_MAX)}` : null)
    : manqueALaFiche(fiche);

  const choisir = (id: string) => {
    setPlatId(id);
    // Le prix proposé du plat se pose dans le champ : il se corrige pour ce jour-là.
    setPrix(String(libres.find((p) => p.id === id)?.prix ?? ""));
  };

  const ajouter = () => {
    if (manque || !portionsOk) { setErreur(manque ?? `Des portions entre 1 et ${PORTIONS_MAX.toLocaleString("fr-FR")}, ou rien`); return; }
    setErreur(null);
    demarrer(async () => {
      const r: Retour = source === "carte"
        ? await ajouterPlatAuMenu({ jour, platId, prix: Number(prix), portions: nombreOuRien(portions) })
        : await creerPlatAuMenu({ jour, plat: saisieDe(fiche), portions: nombreOuRien(portions) });
      if (!r.ok) { setErreur(r.erreur); return; }
      onClose();
    });
  };

  const champPortions = (
    <ChampNombre label="Portions prévues" aide={AIDE_PORTIONS} valeur={portions} longueur={4} correct={portionsOk} onChange={setPortions} />
  );

  return (
    <Fenetre titre="Ajouter un plat" sousTitre={`Au menu du ${jourLong(jour)}`} onClose={onClose} large>
      <STabs value={source} onChange={(s) => { setSource(s); setErreur(null); }} tabs={[
        { id: "carte", label: "Un plat de la carte" },
        { id: "nouveau", label: "Un nouveau plat" },
      ]} />

      <div className="mt-5">
        {source === "carte" ? (
          libres.length === 0 ? (
            <p className="rounded-[16px] border border-dashed border-[color:var(--h-filet)] px-4 py-8 text-center text-[14px] leading-5 text-texte-2">
              Tous les plats de la carte sont déjà au menu ce jour-là. Il reste à en créer un nouveau
            </p>
          ) : (
            <div className="space-y-5">
              <SField label="Le plat">
                <SSelect value={platId} onChange={(e) => choisir(e.target.value)}>
                  <option value="" disabled>Choisis un plat de la carte</option>
                  {libres.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
                </SSelect>
              </SField>
              {choisi && (
                <div className="flex items-center gap-4 rounded-[16px] bg-[color:var(--h-surface)] p-3">
                  <div className="w-[120px] shrink-0 overflow-hidden rounded-[10px]"><PhotoPlat photo={choisi.photo} nom={choisi.nom} /></div>
                  <p className="min-w-0 text-[14px] leading-5 text-encre/80">{choisi.description || "Pas de description pour ce plat"}</p>
                </div>
              )}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <ChampNombre label="Prix ce jour-là, en francs CFA" aide={AIDE_PRIX} valeur={prix} longueur={5}
                  correct={prix === "" || prixSaisi(prix) !== null} onChange={setPrix} />
                {champPortions}
              </div>
            </div>
          )
        ) : (
          <div className="space-y-5">
            <ChampsPlat fiche={fiche} onChange={setFiche} photos={photos} />
            {champPortions}
          </div>
        )}
      </div>

      {erreur && <div className="mt-5"><Erreur>{erreur}</Erreur></div>}
      <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
        <SBtn tone="secondary" className="sm:flex-1" disabled={enCours || (source === "carte" && libres.length === 0)} onClick={ajouter}>
          {enCours ? "Un instant" : "Ajouter au menu"}
        </SBtn>
        <SBtn variant="text" tone="secondary" disabled={enCours} onClick={onClose}>Fermer</SBtn>
      </div>
    </Fenetre>
  );
}

/* ── Régler un plat du jour : prix, portions, épuisé ; le retirer ──────────── */

export function TiroirMenuJour({ menu, onClose }: { menu: VueMenuJour; onClose: () => void }) {
  const [prix, setPrix] = useState(String(menu.prix));
  const [portions, setPortions] = useState(menu.portions === null ? "" : String(menu.portions));
  const [epuise, setEpuise] = useState(menu.epuise);
  const [aRetirer, setARetirer] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const prixOk = prixSaisi(prix) !== null;
  const prevues = nombreOuRien(portions);
  const portionsOk = portionsValables(prevues);
  // Moins de portions que de repas déjà réservés : le plat devient complet, et l'aide le dit avant d'enregistrer.
  const aidePortions = portionsOk && prevues !== null && prevues <= menu.reservees && menu.reservees > 0
    ? `Déjà ${pluriel(menu.reservees, "réservé")} : avec ${pluriel(prevues, "portion")}, le plat sera complet`
    : AIDE_PORTIONS;

  const agir = (geste: () => Promise<Retour>) => {
    setErreur(null);
    demarrer(async () => {
      const r = await geste();
      if (!r.ok) { setErreur(r.erreur); setARetirer(false); return; }
      onClose();
    });
  };

  return (
    <Tiroir titre={menu.nom} onClose={onClose}>
      <p className="text-[14px] leading-5 text-texte-2 first-letter:uppercase">{jourLong(menu.jour)}</p>
      <div className="mx-auto mt-4 max-w-[360px] overflow-hidden rounded-[16px] shadow-[0_0_0_1px_var(--h-filet)]"><PhotoPlat photo={menu.photo} nom={menu.nom} /></div>
      <p className="chiffres mt-4 text-[16px] leading-6 font-semibold text-encre/95">{reservesEnMots(menu)}</p>

      <div className="mt-6 space-y-5">
        <ChampNombre label="Prix du jour, en francs CFA" valeur={prix} longueur={5} correct={prixOk} onChange={setPrix}
          aide={`${AIDE_PRIX}. Les repas déjà réservés gardent leur prix`} />
        <ChampNombre label="Portions prévues" aide={aidePortions} valeur={portions} longueur={4} correct={portionsOk} onChange={setPortions} />
        <div className="rounded-[16px] bg-[color:var(--h-surface)] p-4">
          <SSwitch checked={epuise} onChange={setEpuise} label="Épuisé"
            hint="Plus personne ne peut le réserver. Ceux qui l'ont déjà réservé gardent leur repas" />
        </div>
      </div>

      {erreur && <div className="mt-5"><Erreur>{erreur}</Erreur></div>}

      <div className="mt-6 space-y-2">
        <SBtn tone="secondary" block disabled={enCours || !prixOk || !portionsOk}
          onClick={() => agir(() => enregistrerMenuJour({ id: menu.id, prix: Number(prix), portions: prevues, epuise }))}>
          {enCours && !aRetirer ? "Un instant" : "Enregistrer"}
        </SBtn>
        {!menu.retirable ? (
          <>
            <SBtn variant="text" tone="error" block disabled>Retirer du menu</SBtn>
            <p className="text-center text-[13px] leading-5 text-texte-2">Déjà réservé : marque-le épuisé</p>
          </>
        ) : aRetirer ? (
          <div className="flex gap-2">
            <SBtn tone="error" className="flex-1" disabled={enCours} onClick={() => agir(() => retirerPlatDuMenu(menu.id))}>Oui, le retirer</SBtn>
            <SBtn variant="text" tone="secondary" disabled={enCours} onClick={() => setARetirer(false)}>Non</SBtn>
          </div>
        ) : (
          <SBtn variant="text" tone="error" block disabled={enCours} onClick={() => setARetirer(true)}>Retirer du menu</SBtn>
        )}
      </div>
    </Tiroir>
  );
}

/* ── Corriger la fiche d'un plat ───────────────────────────────────────────── */

export function FenetrePlat({ plat, photos, onClose }: { plat: VuePlat; photos: string[]; onClose: () => void }) {
  const [fiche, setFiche] = useState<FichePlat>(() => ficheDe(plat));
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const enregistrer = () => {
    const manque = manqueALaFiche(fiche);
    if (manque) { setErreur(manque); return; }
    setErreur(null);
    demarrer(async () => {
      const r = await enregistrerPlat({ id: plat.id, plat: saisieDe(fiche) });
      if (!r.ok) { setErreur(r.erreur); return; }
      onClose();
    });
  };

  return (
    <Fenetre titre="Modifier le plat" sousTitre="Son prix est celui proposé quand tu l'ajoutes à un jour : les jours déjà planifiés gardent le leur" onClose={onClose} large>
      <ChampsPlat fiche={fiche} onChange={setFiche} photos={photos} />
      {erreur && <div className="mt-5"><Erreur>{erreur}</Erreur></div>}
      <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
        <SBtn tone="secondary" className="sm:flex-1" disabled={enCours} onClick={enregistrer}>{enCours ? "Un instant" : "Enregistrer"}</SBtn>
        <SBtn variant="text" tone="secondary" disabled={enCours} onClick={onClose}>Fermer</SBtn>
      </div>
    </Fenetre>
  );
}
