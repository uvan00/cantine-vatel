import { Suspense } from "react";
import { MenuArgent } from "./menu-argent";

// La rubrique Recharges et ses comptes : le deuxième menu, puis la page choisie. Dès que la page a la place (le
// conteneur de la page, pas l'écran : l'assistant ouvert la rend plus étroite), le menu passe en colonne à gauche.
export default function LayoutArgent({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-5 @4xl/page:grid-cols-[200px_minmax(0,1fr)] @4xl/page:gap-8">
      <Suspense fallback={null}><MenuArgent /></Suspense>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
