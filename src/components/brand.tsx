import { cn } from "cn";

// Logo de Tablée : une table ronde vue d'en haut et ses convives autour. Le mot « tablée » en Public Sans.
// Couleur : --logo-marque (le vert feuille de bananier).

export function Table({ className, couleur = "currentColor" }: { className?: string; couleur?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <circle cx="32" cy="32" r="15" fill={couleur} />
      <circle cx="32" cy="7.5" r="5.5" fill={couleur} />
      <circle cx="56.5" cy="32" r="5.5" fill={couleur} />
      <circle cx="32" cy="56.5" r="5.5" fill={couleur} />
      <circle cx="7.5" cy="32" r="5.5" fill={couleur} />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span role="img" aria-label="Tablée"
      className={cn("inline-flex items-center gap-[0.3em] leading-none font-semibold tracking-[-0.02em] whitespace-nowrap text-encre", className)}>
      <Table className="size-[0.95em] shrink-0 text-[var(--logo-marque)]" />
      <span aria-hidden="true">tablée</span>
    </span>
  );
}
