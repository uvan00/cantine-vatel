import Link from "next/link";
import { ChevronRight, IdCard } from "@/components/icons";

/** La ligne qui mène à la carte de cantine, depuis les tickets du convive ou la page d'un enfant. */
export function LienCarte({ href, titre, phrase }: { href: string; titre: string; phrase: string }) {
  return (
    <Link href={href} className="flex min-h-16 items-center gap-3 rounded-[16px] border border-[color:var(--h-filet)] bg-surface px-4 py-3 transition-colors hover:bg-[color:var(--h-filet-doux)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--h-marque-texte))]">
      <IdCard className="size-5 shrink-0 text-encre/75" strokeWidth={1.8} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] leading-5 font-medium text-encre/95">{titre}</span>
        <span className="block text-[13px] leading-5 text-texte-2">{phrase}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-encre/40" strokeWidth={1.8} aria-hidden="true" />
    </Link>
  );
}
