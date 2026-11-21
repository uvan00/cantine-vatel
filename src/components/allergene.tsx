import { Check } from "@/components/icons";
import type { Etiquette } from "@/lib/listes";

// Le dessin et le nom d'un allergène ou d'un régime, toujours ensemble (le dessin n'est jamais seul) : sur un plat, dans
// un profil, dans un refus, au comptoir. Les dessins sont dans public/allergenes (scripts/allergenes.mjs), les
// étiquettes viennent de src/lib/listes.ts et de src/lib/profil-alimentaire.ts.
// Sans état : ces composants servent dans les pages du serveur comme dans les composants du navigateur.

/** Le dessin seul, pour le poser à côté d'un nom que l'appelant écrit lui-même. */
export function DessinAliment({ image, taille = 24 }: { image: string; taille?: number }) {
  // eslint-disable-next-line @next/next/no-img-element -- petit dessin de public/allergenes, servi tel quel
  return <img src={image} alt="" width={taille} height={taille} style={{ width: taille, height: taille }} className="shrink-0 rounded-md" />;
}

/** Une étiquette : le dessin puis le nom, sur une ligne. */
export function EtiquetteAliment({ etiquette, taille = 24, className = "" }: { etiquette: Etiquette; taille?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <DessinAliment image={etiquette.image} taille={taille} />
      <span>{etiquette.nom}</span>
    </span>
  );
}

/** Plusieurs étiquettes à la suite, qui passent à la ligne ensemble. Rien si la liste est vide. */
export function EtiquettesAliments({ etiquettes, taille = 24, className = "" }: { etiquettes: Etiquette[]; taille?: number; className?: string }) {
  if (etiquettes.length === 0) return null;
  return (
    <span className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${className}`}>
      {etiquettes.map((e) => <EtiquetteAliment key={e.id} etiquette={e} taille={taille} />)}
    </span>
  );
}

/**
 * Une tuile à cocher : le dessin en grand, le nom dessous. Choisie, elle prend le filet bleu et sa coche. C'est une
 * vraie case à cocher (clavier, lecteur d'écran) : la tuile n'en est que l'habit. À ranger dans une grille, par
 * exemple `grid grid-cols-3 gap-2 sm:grid-cols-4`.
 */
export function TuileAliment({ etiquette, coche, onChange }: { etiquette: Etiquette; coche: boolean; onChange: (coche: boolean) => void }) {
  return (
    <label className="relative flex min-h-28 cursor-pointer flex-col items-center gap-2 rounded-[20px] border border-[var(--h-filet)] bg-[rgb(var(--sn-surface))] px-2 py-3 text-center transition-colors hover:bg-[var(--h-fond-2)] has-[:checked]:border-[rgb(var(--sn-primary))] has-[:checked]:bg-[rgb(var(--sn-primary)/0.06)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[rgb(var(--sn-primary))]">
      <input type="checkbox" checked={coche} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      {/* eslint-disable-next-line @next/next/no-img-element -- petit dessin de public/allergenes, servi tel quel */}
      <img src={etiquette.image} alt="" width={56} height={56} className="size-14 shrink-0 rounded-lg" />
      <span className="block text-[14px] leading-5 text-encre/90 first-letter:uppercase">{etiquette.nom}</span>
      <span aria-hidden="true" className="absolute top-2 right-2 grid size-5 place-items-center rounded-full bg-[rgb(var(--sn-primary))] text-white opacity-0 transition-opacity peer-checked:opacity-100">
        <Check className="size-3.5" strokeWidth={2.4} />
      </span>
    </label>
  );
}
