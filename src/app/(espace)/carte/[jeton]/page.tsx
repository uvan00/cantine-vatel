import { redirect } from "next/navigation";
import { exiger } from "@/lib/session";

// L'adresse que porte le QR d'une carte de cantine. Le comptoir qui l'ouvre avec l'appareil photo de son téléphone part
// au scanner, qui sert le repas du jour ; le titulaire, ou son parent, retrouve ses pages.
export default async function PageCarteOuverte({ params }: { params: Promise<{ jeton: string }> }) {
  const moi = await exiger();
  const { jeton } = await params;
  if (moi.role === "admin") redirect(`/admin/scanner?cle=${encodeURIComponent(`/carte/${jeton}`)}`);
  redirect(moi.role === "parent" ? "/parent" : "/carte");
}
