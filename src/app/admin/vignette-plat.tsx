import { Plat } from "@/components/icons";
import { PhotoPlat } from "@/components/photo-plat";

/**
 * La photo d'un plat en petit, dans une liste où son nom est déjà écrit à côté (l'image n'a donc pas de texte de
 * remplacement). Sans photo : une tuile grise de la même taille, avec une assiette.
 */
export function VignettePlat({ photo, className = "w-[72px]" }: { photo: string; className?: string }) {
  return (
    <span aria-hidden="true" className={`block shrink-0 overflow-hidden rounded-[10px] ${className}`}>
      {photo ? <PhotoPlat photo={photo} nom="" /> : (
        <span className="grid aspect-video w-full place-items-center bg-[color:var(--h-surface)] text-texte-2">
          <Plat className="size-5" strokeWidth={1.8} />
        </span>
      )}
    </span>
  );
}
