"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy } from "@/components/icons";
import { EtiquettesAliments, TuileAliment } from "@/components/allergene";
import { SAlert, SBtn, SField, SInput } from "@/components/sneat";
import { DUREE_CODE_MIN } from "@/lib/code-famille";
import { jourLong } from "@/lib/jours";
import { ALLERGENES, REGIMES, type Etiquette } from "@/lib/listes";
import { MARQUE } from "@/lib/marque";
import { heureH } from "@/lib/reservation";
import { RATE } from "@/app/(espace)/menu/annulation";
import { creerMonCodeFamille, enregistrerProfil, enregistrerSeuil, retirerMonParent } from "./actions";

// Les réglages du compte : le profil alimentaire en tuiles à cocher (un dessin et un nom), le seuil d'alerte, et
// « Relier un parent » (un code à usage unique, créé par l'élève). Chaque bloc enregistre à part, et dit en mots si c'est fait.

const CARTE = "rounded-[16px] border border-[color:var(--h-filet)] bg-surface p-4";

type Retour = { ok: boolean; texte: string } | null;

/** Le bouton d'un bloc et ce qui s'est passé : « C'est noté », ou la raison du refus. */
function Enregistrer({ envoi, retour, type = "button", onClick }: { envoi: boolean; retour: Retour; type?: "button" | "submit"; onClick?: () => void }) {
  return (
    <div className="mt-4">
      <div aria-live="polite" className="empty:hidden">
        {retour && !retour.ok && <div className="mb-4"><SAlert tone="error">{retour.texte}</SAlert></div>}
      </div>
      <div className="flex items-center gap-3">
        <SBtn type={type} tone="secondary" disabled={envoi} onClick={onClick}>{envoi ? "Un instant" : "Enregistrer"}</SBtn>
        <p aria-live="polite" className="flex items-center gap-1 text-[14px] leading-5 text-texte-2">
          {retour?.ok && <><Check className="size-5" strokeWidth={1.8} aria-hidden="true" /> {retour.texte}</>}
        </p>
      </div>
    </div>
  );
}

export function ProfilAlimentaire({ allergenes, regimes }: { allergenes: string[]; regimes: string[] }) {
  const [coches, setCoches] = useState({ allergenes, regimes });
  const [retour, setRetour] = useState<Retour>(null);
  const [enCause, setEnCause] = useState<{ jour: string; plat: string; enCause: Etiquette[] }[]>([]);
  const [envoi, lancer] = useTransition();

  const basculer = (liste: "allergenes" | "regimes", id: string, oui: boolean) => {
    setRetour(null);
    setCoches((c) => ({ ...c, [liste]: oui ? [...c[liste], id] : c[liste].filter((v) => v !== id) }));
  };
  const enregistrer = () => lancer(async () => {
    try {
      const r = await enregistrerProfil(coches);
      setRetour(r.ok ? { ok: true, texte: "C'est noté" } : { ok: false, texte: r.erreur });
      setEnCause(r.ok ? r.repasEnCause : []);
    } catch {
      setRetour({ ok: false, texte: RATE });
    }
  });

  return (
    <div className={CARTE}>
      <fieldset>
        <legend className="text-[14px] leading-5 font-semibold text-encre/95">Allergènes</legend>
        <div className="mt-2 grid auto-rows-fr grid-cols-3 gap-2">
          {ALLERGENES.map((a) => (
            <TuileAliment key={a.id} etiquette={a} coche={coches.allergenes.includes(a.id)} onChange={(oui) => basculer("allergenes", a.id, oui)} />
          ))}
        </div>
      </fieldset>
      <fieldset className="mt-4">
        <legend className="text-[14px] leading-5 font-semibold text-encre/95">Régimes</legend>
        <div className="mt-2 grid auto-rows-fr grid-cols-3 gap-2">
          {REGIMES.map((r) => (
            <TuileAliment key={r.id} etiquette={r} coche={coches.regimes.includes(r.id)} onChange={(oui) => basculer("regimes", r.id, oui)} />
          ))}
        </div>
      </fieldset>
      <p className="mt-3 text-[14px] leading-5 text-texte-2">
        D&apos;après ce que la cantine a déclaré : {MARQUE.nom} répète sa liste, elle ne garantit pas la composition des plats
      </p>
      <Enregistrer envoi={envoi} retour={retour} onClick={enregistrer} />
      <RepasEnCause repas={enCause} />
    </div>
  );
}

/**
 * Après l'enregistrement du profil : les repas déjà réservés que ce profil écarte. Ils restent réservés (la cuisine les
 * a peut-être comptés) : on le dit calmement, avec ce que chaque plat contient, et quoi faire.
 */
export function RepasEnCause({ repas, pour = "toi" }: { repas: { jour: string; plat: string; enCause: Etiquette[] }[]; pour?: "toi" | "lui" }) {
  if (repas.length === 0) return null;
  return (
    <div role="status" className="mt-4">
      <SAlert tone="warning">
        <p className="font-semibold text-encre/95">{pour === "toi" ? "Tu as déjà réservé" : "Déjà réservé pour lui"} {repas.length > 1 ? "des repas que ce profil écarte" : "un repas que ce profil écarte"}</p>
        <ul className="mt-2 space-y-2">
          {repas.map((r) => (
            <li key={`${r.jour}-${r.plat}`}>
              <p className="first-letter:uppercase">{jourLong(r.jour)}, {r.plat}</p>
              <EtiquettesAliments etiquettes={r.enCause} taille={20} className="mt-1" />
            </li>
          ))}
        </ul>
        <p className="mt-2">Annule-le au menu si c&apos;est encore possible, sinon préviens la cantine avant de passer au comptoir</p>
      </SAlert>
    </div>
  );
}

export function SeuilAlerte({ seuil }: { seuil: number }) {
  const [valeur, setValeur] = useState(String(seuil));
  const [retour, setRetour] = useState<Retour>(null);
  const [envoi, lancer] = useTransition();

  const enregistrer = () => {
    if (valeur === "") { setRetour({ ok: false, texte: "Écris un montant, ou zéro pour ne pas avoir d'alerte" }); return; }
    lancer(async () => {
      try {
        const r = await enregistrerSeuil(Number(valeur));
        setRetour(r.ok ? { ok: true, texte: "C'est noté" } : { ok: false, texte: r.erreur });
      } catch {
        setRetour({ ok: false, texte: RATE });
      }
    });
  };

  return (
    <form className={CARTE} onSubmit={(e) => { e.preventDefault(); enregistrer(); }} noValidate>
      <SField label="Préviens-moi quand mon solde passe sous" hint="Ton parent est prévenu lui aussi">
        <span className="relative block">
          <SInput name="seuil" inputMode="numeric" autoComplete="off" value={valeur} className="chiffres pr-20"
            onChange={(e) => { setRetour(null); setValeur(e.target.value.replace(/\D/g, "").slice(0, 6)); }} />
          <span aria-hidden="true" className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-[14px] leading-5 text-texte-2">F CFA</span>
        </span>
      </SField>
      <Enregistrer envoi={envoi} retour={retour} type="submit" />
    </form>
  );
}

/**
 * Relier un parent : l'élève crée un code, valable 15 minutes et pour un seul parent, et le lui donne. Créer le code,
 * c'est donner son accord. Les parents déjà reliés se voient ici, et se retirent.
 */
export function RelierParent({ parents }: { parents: { id: string; nom: string }[] }) {
  const router = useRouter();
  const [code, setCode] = useState<{ code: string; expire: number } | null>(null);
  const [copie, setCopie] = useState<"repos" | "copie" | "echec">("repos");
  const [aRetirer, setARetirer] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, lancer] = useTransition();

  const creer = () => lancer(async () => {
    setErreur(null);
    try {
      const r = await creerMonCodeFamille();
      if (r.ok) { setCode({ code: r.code, expire: r.expire }); setCopie("repos"); } else setErreur(r.erreur);
    } catch {
      setErreur(RATE);
    }
  });
  const copier = async () => {
    if (!code) return;
    // Le presse-papiers ne répond qu'en https ou sur localhost : sinon, on le dit et le code se recopie à la main.
    try { await navigator.clipboard.writeText(code.code); setCopie("copie"); } catch { setCopie("echec"); }
    setTimeout(() => setCopie("repos"), 2500);
  };
  // Retirer un parent se fait en deux touches : la première demande confirmation sur la même ligne.
  const retirer = (id: string) => {
    if (aRetirer !== id) { setARetirer(id); return; }
    lancer(async () => {
      setErreur(null);
      try {
        const r = await retirerMonParent(id);
        if (!r.ok) setErreur(r.erreur);
        setARetirer(null);
        router.refresh();
      } catch {
        setErreur(RATE);
      }
    });
  };

  return (
    <div className={CARTE}>
      {parents.length > 0 && (
        <ul className="mb-4 divide-y divide-[color:var(--h-filet)]">
          {parents.map((p) => (
            <li key={p.id} className="flex min-h-[52px] items-center justify-between gap-3 py-2">
              <p className="min-w-0 text-[15px] leading-5 text-encre/95"><span className="font-medium">{p.nom}</span> suit ton compte</p>
              <SBtn variant="outlined" size="sm" disabled={envoi} onClick={() => retirer(p.id)}>{aRetirer === p.id ? "Confirmer" : "Retirer"}</SBtn>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[14px] leading-5 text-texte-2">
        Un parent relié voit ton solde et tes repas, règle ton profil et recharge ton compte. Pour en relier un, crée un code et donne-le-lui : il vaut {DUREE_CODE_MIN} minutes, pour un seul parent
      </p>
      {code && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="font-mono text-[24px] leading-8 font-medium tracking-[0.2em] text-encre/95 select-all">{code.code}</p>
          <SBtn variant="outlined" size="sm" onClick={copier}>
            {copie === "copie" ? <><Check className="size-4" strokeWidth={1.8} aria-hidden="true" /> Copié</> : <><Copy className="size-4" strokeWidth={1.8} aria-hidden="true" /> Copier</>}
          </SBtn>
        </div>
      )}
      <div aria-live="polite" className="empty:hidden">
        {code && (
          <p className="chiffres mt-2 text-[14px] leading-5 text-texte-2">
            {copie === "echec" ? "La copie n'a pas marché, recopie-le à la main" : `Valable jusqu'à ${heureH(new Date(code.expire))}. Ton parent le saisit dans son espace, sous « Relier un enfant »`}
          </p>
        )}
        {erreur && <div className="mt-4"><SAlert tone="error">{erreur}</SAlert></div>}
      </div>
      <div className="mt-4">
        <SBtn tone="secondary" disabled={envoi} onClick={creer}>{envoi ? "Un instant" : code ? "Créer un autre code" : "Créer un code"}</SBtn>
      </div>
    </div>
  );
}
