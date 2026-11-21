"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "@/components/icons";
import { PhotoPlat } from "@/components/photo-plat";
import { SBtn, SChiffresBande } from "@/components/sneat";
import type { LigneCout, VueCouts } from "@/lib/donnees-stock";
import { fcfa, liste, nombre } from "@/lib/format";
import { FicheRecette } from "./besoins-client";
import { EnTeteBesoins } from "./en-tete";

// Le coût d'un repas (lot 2 des besoins) : pour chaque plat de la carte, ce que coûte la matière d'une portion
// (sa fiche recette fois le prix de ses ingrédients, tiré des dernières livraisons payées), ce qu'il en reste sur son
// prix, et la part du prix qui part dans la matière. Un prix inconnu est nommé : le coût est alors un minimum.

export function CoutsClient({ vue }: { vue: VueCouts }) {
  const router = useRouter();
  const [fiche, setFiche] = useState<LigneCout | null>(null);
  const chiffres = vue.plats.filter((p) => p.cout?.complet && p.marge);
  const coutMoyen = chiffres.length > 0 ? Math.round(chiffres.reduce((s, p) => s + (p.cout?.cout ?? 0), 0) / chiffres.length) : null;
  const parts = chiffres.map((p) => p.marge?.part).filter((x): x is number => x !== null && x !== undefined);
  const partMoyenne = parts.length > 0 ? Math.round(parts.reduce((s, x) => s + x, 0) / parts.length) : null;

  return (
    <div className="w-full space-y-6">
      <EnTeteBesoins vue="couts" sousTitre="Ce que coûte la matière d'une portion, plat par plat, et ce qu'il reste sur son prix" />

      <SChiffresBande items={[
        { titre: "Plats chiffrés", valeur: <span className="chiffres">{nombre(chiffres.length)} sur {nombre(vue.plats.length)}</span> },
        { titre: "Matière par portion, en moyenne", valeur: <span className="chiffres">{coutMoyen === null ? "Pas encore" : fcfa(coutMoyen)}</span> },
        { titre: "Part du prix dans la matière", valeur: <span className="chiffres">{partMoyenne === null ? "Pas encore" : `${partMoyenne} %`}</span> },
      ]} />

      <p className="text-[14px] leading-5 text-texte-2">
        D&apos;après la fiche recette de chaque plat et le prix de ses ingrédients, tiré de leurs dernières livraisons payées.
        Le prix de vente est celui de la carte.
      </p>

      <ul className="grid grid-cols-1 items-start gap-4 @3xl/page:grid-cols-2">
        {vue.plats.map((p) => <CarteCout key={p.platId} p={p} onFiche={() => setFiche(p)} />)}
      </ul>

      {fiche && <FicheRecette plat={fiche} ingredients={vue.ingredients} onClose={() => setFiche(null)} onFait={() => { setFiche(null); router.refresh(); }} />}
    </div>
  );
}

function CarteCout({ p, onFiche }: { p: LigneCout; onFiche: () => void }) {
  const part = p.marge?.part ?? null;
  return (
    <li className="flex break-inside-avoid flex-col rounded-[20px] border border-[color:var(--h-filet)] bg-surface p-4">
      <div className="flex items-center gap-4">
        <div aria-hidden="true" className="w-24 shrink-0 mix-blend-multiply"><PhotoPlat photo={p.photo} nom="" /></div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[16px] leading-6 font-semibold text-encre/95">{p.nom}</h3>
          <p className="chiffres text-[14px] leading-5 text-texte-2">Vendu {fcfa(p.prixVente)}</p>
        </div>
      </div>

      {p.cout === null ? (
        <p className="mt-4 rounded-[12px] border border-dashed border-[color:var(--h-surface-forte)] px-3 py-3 text-[14px] leading-5 text-texte-2">
          Pas de fiche recette : son coût ne se calcule pas
        </p>
      ) : p.cout.complet && p.marge ? (
        <div className="mt-4 space-y-2">
          <dl className="chiffres grid grid-cols-2 gap-3 text-[14px] leading-5">
            <div><dt className="text-texte-2">Matière par portion</dt><dd className="text-[20px] leading-7 font-semibold text-encre/95">{fcfa(p.cout.cout)}</dd></div>
            <div><dt className="text-texte-2">Reste sur le prix</dt><dd className={`text-[20px] leading-7 font-semibold ${p.marge.marge < 0 ? "text-erreur-texte" : "text-encre/95"}`}>{fcfa(p.marge.marge)}</dd></div>
          </dl>
          {part !== null && (
            <div>
              <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-[color:var(--h-surface)]">
                <div className="h-full rounded-full bg-marque" style={{ width: `${Math.min(100, Math.max(0, part))}%` }} />
              </div>
              <p className="chiffres mt-1 text-[13px] leading-5 text-texte-2">{part} % du prix part dans la matière</p>
            </div>
          )}
        </div>
      ) : (
        <p className="chiffres mt-4 text-[14px] leading-5 text-texte-2">
          Au moins <span className="font-semibold text-encre/95">{fcfa(p.cout.cout)}</span> de matière par portion. Prix encore inconnu : {liste(p.cout.manquants)}
        </p>
      )}

      <div className="mt-4 print:hidden">
        <SBtn size="sm" variant="outlined" tone="secondary" onClick={onFiche} aria-label={`${p.cout === null ? "Remplir la fiche recette" : "Fiche recette"} : ${p.nom}`}>
          {p.cout === null ? <><Plus className="size-4" strokeWidth={1.8} />Remplir sa fiche</> : "Fiche recette"}
        </SBtn>
      </div>
    </li>
  );
}
