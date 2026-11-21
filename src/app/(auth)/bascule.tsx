import Link from "next/link";

// La bascule du modèle mobile, au téléphone seulement : « Connexion » ou « Créer un compte », la page choisie en pilule
// blanche sur le rail gris. À l'ordinateur, le lien sous le formulaire fait ce travail (modèle de l'ordinateur).

const ONGLETS = [
  { id: "connexion", href: "/connexion", libelle: "Connexion" },
  { id: "inscription", href: "/inscription", libelle: "Créer un compte" },
] as const;

export function Bascule({ actif }: { actif: (typeof ONGLETS)[number]["id"] }) {
  return (
    <nav aria-label="Connexion ou création de compte" className="mb-6 grid grid-cols-2 gap-1 rounded-full bg-[#F1F1F3] p-1.5 lg:hidden">
      {ONGLETS.map((o) => (
        <Link key={o.id} href={o.href} aria-current={actif === o.id ? "page" : undefined}
          className={`grid h-11 place-items-center rounded-full text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--h-marque-texte))] ${actif === o.id ? "bg-white text-encre shadow-[0_1px_2px_rgb(0_0_0/0.08),0_4px_12px_rgb(0_0_0/0.06)]" : "text-texte-2 hover:text-encre"}`}>
          {o.libelle}
        </Link>
      ))}
    </nav>
  );
}
