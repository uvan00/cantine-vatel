import type { Metadata } from "next";
import { convivesABadge } from "@/lib/donnees-comptoir";
import { creerCartesManquantes } from "@/lib/operations";
import { qrSvg } from "@/lib/qr";
import { exiger, origine } from "@/lib/session";
import { BadgesClient } from "./badges-client";

export const metadata: Metadata = { title: "Badges" };
export const dynamic = "force-dynamic";

// Les badges de cantine (demande du propriétaire du 21/11/2026) : chaque élève ou employé a le sien dès que son compte
// existe. La cantine les imprime, par classe ou tous ensemble ; un badge perdu se refait, l'ancien ne passe plus.
export default async function PageBadges() {
  await exiger("admin");
  // Les comptes d'avant le 21/11/2026 n'avaient pas encore leur carte : elle se crée ici, une fois.
  await creerCartesManquantes();
  const base = await origine();
  const convives = await convivesABadge();
  const badges = await Promise.all(convives.flatMap((c) => (c.carte
    ? [qrSvg(`${base}/carte/${c.carte}`).then((qr) => ({ id: c.id, nom: c.nom, photo: c.photo, classe: c.classe, genre: c.genre, qr }))]
    : [])));
  return <BadgesClient badges={badges} />;
}
