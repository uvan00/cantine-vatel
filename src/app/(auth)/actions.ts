"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { inscrire, seConnecter } from "@/lib/operations";
import { accueilDe } from "@/lib/session";

// Connexion et inscription. Chaque action valide ce qu'elle reçoit, puis laisse src/lib/operations.ts faire le reste.
// Le rôle n'est jamais lu tel quel : « élève », « employé » ou « parent » seulement, jamais « administrateur ».

/** L'erreur à montrer, et les champs déjà saisis (sauf le mot de passe) pour ne pas tout retaper. */
export type EtatFormulaire = { erreur?: string; champs?: Record<string, string> };

const texte = (f: FormData, nom: string) => String(f.get(nom) ?? "").trim();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const Connexion = z.object({
  email: z.string().min(1, "Il manque ton e-mail").regex(EMAIL, "Cet e-mail n'a pas l'air juste"),
  motDePasse: z.string().min(1, "Il manque ton mot de passe"),
});

export async function connecter(_avant: EtatFormulaire, f: FormData): Promise<EtatFormulaire> {
  const saisi = { email: texte(f, "email"), motDePasse: String(f.get("motDePasse") ?? "") };
  const v = Connexion.safeParse(saisi);
  if (!v.success) return { erreur: v.error.issues[0].message, champs: { email: saisi.email } };
  const r = await seConnecter(v.data.email, v.data.motDePasse);
  if (!r.ok) return { erreur: r.erreur, champs: { email: saisi.email } };
  redirect(accueilDe(r.role));
}

const Inscription = z.object({
  qui: z.enum(["eleve", "employe", "parent"], "Dis-nous qui tu es"),
  nom: z.string().min(2, "Ton prénom et ton nom, en entier").max(60, "Ce nom est trop long"),
  email: z.string().min(1, "Il manque ton e-mail").max(120, "Cet e-mail est trop long").regex(EMAIL, "Cet e-mail n'a pas l'air juste"),
  motDePasse: z.string().min(8, "Un mot de passe d'au moins 8 caractères").max(100, "Ce mot de passe est trop long"),
  classe: z.string().max(60, "Ce nom de classe ou de service est trop long"),
});

export async function creerCompte(_avant: EtatFormulaire, f: FormData): Promise<EtatFormulaire> {
  const saisi = { qui: texte(f, "qui"), nom: texte(f, "nom"), email: texte(f, "email"), motDePasse: String(f.get("motDePasse") ?? ""), classe: texte(f, "classe") };
  const champs = { qui: saisi.qui, nom: saisi.nom, email: saisi.email, classe: saisi.classe };
  const v = Inscription.safeParse(saisi);
  if (!v.success) return { erreur: v.error.issues[0].message, champs };
  const { qui, nom, email, motDePasse, classe } = v.data;
  const r = await inscrire({
    nom,
    email,
    motDePasse,
    role: qui === "parent" ? "parent" : "convive",
    genre: qui === "parent" ? undefined : qui,
    classe: qui === "parent" ? "" : classe,
  });
  if (!r.ok) return { erreur: r.erreur, champs };
  redirect(accueilDe(r.role));
}
