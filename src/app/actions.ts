"use server";

import { redirect } from "next/navigation";
import { COMPTES_DEMO, MOT_DE_PASSE_DEMO, modeDemo, rolesDemo, type RoleDemo } from "@/lib/demo";
import { seConnecter, seDeconnecter } from "@/lib/operations";
import { accueilDe } from "@/lib/session";

/** Ferme la session et revient à l'accueil. */
export async function deconnexion() {
  await seDeconnecter();
  redirect("/");
}

/** « Essayer comme… » : entre avec un compte de démonstration. Sans effet si MODE_DEMO n'est pas activé. */
export async function entrerCommeDemo(role: RoleDemo) {
  if (!modeDemo() || !rolesDemo().includes(role)) redirect("/connexion");
  const r = await seConnecter(COMPTES_DEMO[role].email, MOT_DE_PASSE_DEMO);
  redirect(r.ok ? accueilDe(r.role) : "/connexion");
}
