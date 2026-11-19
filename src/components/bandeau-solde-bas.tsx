import Link from "next/link";
import { AlertTriangle } from "@/components/icons";
import { de, fcfa } from "@/lib/format";
import { soldeBas } from "@/lib/solde";

// L'alerte de solde bas, chez le convive et chez son parent : ce qu'il reste, et le geste « Recharger ».
// Ne rend rien tant que le solde n'est pas sous le seuil. Le seuil se règle dans le compte : il n'est pas répété ici,
// pour que la phrase tienne sur un téléphone à côté du bouton.

export function BandeauSoldeBas({ solde, seuil, prenom, href }: {
  solde: number;
  seuil: number;
  /** Le prénom de l'enfant, quand c'est son parent qui lit. Vide : on parle au convive lui-même. */
  prenom?: string;
  /** L'adresse de la recharge (« /recharger » ou « /recharger?pour=<id> »). */
  href: string;
}) {
  if (!soldeBas(solde, seuil)) return null;
  return (
    <div role="status" className="flex items-center gap-3 rounded-[16px] p-4" style={{ background: "rgb(var(--h-alerte) / 0.14)" }}>
      <AlertTriangle className="size-5 shrink-0 text-attente-texte" strokeWidth={1.8} />
      <p className="min-w-0 flex-1 text-[14px] leading-5 text-encre/90">
        <span className="font-semibold">{prenom ? `Le solde ${de(prenom)} est bas` : "Ton solde est bas"}</span>
        <span className="chiffres block text-texte-2">Il reste {fcfa(solde)}</span>
      </p>
      <Link href={href} className="hb hb--encre hb--petit shrink-0">Recharger</Link>
    </div>
  );
}
