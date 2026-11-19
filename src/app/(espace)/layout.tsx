import { CoqueEspace } from "@/components/coque-espace";
import { exiger } from "@/lib/session";

// L'espace du convive et du parent. La mise en page exige seulement une personne connectée : chaque page vérifie
// ensuite son propre rôle avec `exiger("convive")` ou `exiger("parent")`.
export const dynamic = "force-dynamic";

export default async function LayoutEspace({ children }: { children: React.ReactNode }) {
  const m = await exiger();
  return <CoqueEspace role={m.role}>{children}</CoqueEspace>;
}
