import { DM_Sans, IBM_Plex_Mono, Jost } from "next/font/google";

// DM Sans : la police du kit du tableau de bord (LinkAfr, Tirabo, Elite). IBM Plex Mono : le ticket de caisse seulement.
// Jost : le nom à côté du logo de Vatel seulement, pour qu'il ressemble à « Hotel & Tourism Business School » du logo
// (une géométrique de la famille de Futura ; Jost en est la version libre). Choix du propriétaire du 21/11/2026.
const dmSans = DM_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-sneat" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin", "latin-ext"], variable: "--police-ticket", weight: ["400", "500", "600"] });
const jost = Jost({ subsets: ["latin", "latin-ext"], variable: "--police-vatel", weight: ["400"] });

/** À poser sur <html> dans chaque mise en page racine. */
export const classesPolices = `${dmSans.variable} ${plexMono.variable} ${jost.variable}`;
