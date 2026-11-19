// La photo d'un plat. Les photos sont détourées sur fond blanc : on les montre entières (`object-contain`), sur du blanc.
// Sans photo, le nom du plat tient la place, pour que les cartes gardent la même hauteur.

export function PhotoPlat({ photo, nom, className = "" }: { photo: string; nom: string; className?: string }) {
  if (!photo) {
    return (
      <div className={`grid aspect-video w-full place-items-center bg-[color:var(--h-surface)] px-4 text-center text-[14px] leading-5 text-texte-2 ${className}`} aria-hidden="true">
        {nom}
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- images locales déjà légères, servies telles quelles
  return <img src={photo} alt={nom} loading="lazy" className={`aspect-video w-full bg-white object-contain ${className}`} />;
}
