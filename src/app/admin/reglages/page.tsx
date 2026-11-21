import type { Metadata } from "next";
import { lireReglages } from "@/lib/donnees";
import { exiger } from "@/lib/session";
import { ReglagesClient } from "./reglages-client";

export const metadata: Metadata = { title: "Réglages" };

export default async function PageReglages() {
  await exiger("admin");
  return <ReglagesClient initial={await lireReglages()} />;
}
