import { ChefHat, Home, Megaphone, MenuRestaurant, QrCode, Settings2, ShoppingBag, Wallet } from "@/components/icons";

// Les rubriques de la cantine, dans un fichier sans « use client » : la coque (côté navigateur) et la page « Plus »
// (côté serveur) lisent la même liste. Exportée depuis la coque, la page serveur ne recevait qu'une référence vers le
// navigateur, pas la liste, et plantait.

export const RUBRIQUES = [
  { href: "/admin", libelle: "Accueil", Icon: Home },
  { href: "/admin/menus", libelle: "Menus", Icon: MenuRestaurant },
  { href: "/admin/commandes", libelle: "Commandes", Icon: ChefHat },
  { href: "/admin/scanner", libelle: "Scanner", Icon: QrCode },
  { href: "/admin/recharges", libelle: "Recharges", Icon: Wallet },
];

/** Les autres rubriques : dans le rail à l'ordinateur ; au téléphone, derrière l'onglet « Plus » (/admin/plus). */
export const AUTRES_RUBRIQUES = [
  { href: "/admin/messages", libelle: "Messages", Icon: Megaphone },
  { href: "/admin/besoins", libelle: "Besoins", Icon: ShoppingBag },
  { href: "/admin/reglages", libelle: "Réglages", Icon: Settings2 },
];
