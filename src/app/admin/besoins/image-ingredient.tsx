import Image from "next/image";
import { imageIngredient } from "@/lib/besoins";

/**
 * L'image d'un ingrédient (dessinée par Codex, détourée sur blanc : `mix-blend-multiply` fond ce blanc dans la carte),
 * ou sa première lettre sur une tuile neutre quand il n'en a pas.
 */
export function ImageIngredient({ nom, taille }: { nom: string; taille: number }) {
  const src = imageIngredient(nom);
  if (!src) {
    return (
      <span aria-hidden="true" className="grid shrink-0 place-items-center rounded-[10px] bg-[color:var(--h-surface)] text-[14px] font-semibold text-texte-2" style={{ width: taille, height: taille }}>
        {nom.charAt(0).toUpperCase()}
      </span>
    );
  }
  return <Image src={src} alt="" width={taille * 2} height={taille * 2} className="shrink-0 object-contain mix-blend-multiply" style={{ width: taille, height: taille }} />;
}
