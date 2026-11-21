import type { MetadataRoute } from "next";
import { MARQUE } from "@/lib/marque";

// L'application s'installe sur l'écran d'accueil (bonus 3 du cahier) : « Sur l'écran d'accueil » sur le téléphone, ou
// l'icône d'installation de Chrome sur l'ordinateur. Elle s'ouvre alors sans la barre du navigateur, sur l'accueil, qui
// envoie chacun vers celui de son rôle. L'icône est la marque de Vatel, comme l'écran ; les fichiers viennent de
// `node scripts/icones.mjs`. Pas de mode hors ligne : il est hors champ (section 11 du cahier).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: MARQUE.cantine,
    short_name: MARQUE.court,
    lang: "fr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#FFFFFF",
    icons: [
      { src: "/icones/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icones/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icones/icone-masquable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
