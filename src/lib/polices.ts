import { DM_Sans, IBM_Plex_Mono } from "next/font/google";

// DM Sans : la police du kit du tableau de bord (LinkAfr, Tirabo, Elite). IBM Plex Mono : le ticket de caisse seulement.
const dmSans = DM_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-sneat" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin", "latin-ext"], variable: "--police-ticket", weight: ["400", "500", "600"] });

/** À poser sur <html> dans chaque mise en page racine. */
export const classesPolices = `${dmSans.variable} ${plexMono.variable}`;
