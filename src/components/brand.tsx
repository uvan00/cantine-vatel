import { cn } from "cn";
import { MARQUE } from "@/lib/marque";

// Le logo de la cantine : la marque officielle de Vatel (le bloc noir au « V » et le bandeau bleu « VATEL », relevés sur
// vatel.ci le 21/11/2026 et rangés tels quels dans public/vatel/), suivie de « Cantine de Vatel ». Tablée reste le nom
// du logiciel, discret (l'onglet du navigateur). Choix du propriétaire du 21/11/2026.
// Le logo officiel complet, avec « Hotel & Tourism Business School », est public/vatel/logo-vatel.svg.

/**
 * La marque Vatel seule, pour les petites places (le rail de la cantine). Le nom `Table` est gardé pour les écrans qui
 * l'importent déjà ; `couleur` ne sert plus : le logo garde ses propres couleurs.
 */
export function Table({ className }: { className?: string; couleur?: string }) {
  // Un fichier SVG du dossier public : next/image n'apporte rien ici.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/vatel/vatel-marque.svg" alt="" aria-hidden="true" className={cn("object-contain", className)} />;
}

/**
 * La marque Vatel, puis « Cantine de Vatel » sur deux lignes, en capitales et dans la police du logo (Jost, la version
 * libre de Futura), comme « Hotel & Tourism / Business School » sous le logo officiel. Les deux lignes ont ensemble la
 * hauteur de la marque.
 */
export function Logo({ className }: { className?: string }) {
  const [premiere, ...reste] = MARQUE.cantine.split(" ");
  return (
    <span role="img" aria-label={MARQUE.cantine}
      className={cn("inline-flex items-center gap-[0.45em] leading-none whitespace-nowrap text-encre", className)}>
      <Table className="h-[1.6em] w-auto shrink-0" />
      <span aria-hidden="true" className="flex flex-col justify-center text-[0.66em] leading-[1.15] font-normal uppercase"
        style={{ fontFamily: "var(--police-vatel), var(--font-sneat), sans-serif" }}>
        <span>{premiere}</span>
        <span>{reste.join(" ")}</span>
      </span>
    </span>
  );
}
