import { donneesDuRapport } from "@/lib/donnees-admin";
import { maintenant } from "@/lib/horloge";
import { jourIso } from "@/lib/jours";
import { MARQUE } from "@/lib/marque";
import { lundiDuRapport, rapportDeLaSemaine, rapportEnCsv } from "@/lib/rapport";
import { autorise } from "@/lib/session";

// Le rapport de la semaine en CSV (bonus 4 du cahier) : les mêmes tableaux que la page /admin/rapport, pour un tableur.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await autorise("admin"))) return Response.json({ erreur: "Réservé à la cantine" }, { status: 401 });
  const instant = maintenant();
  const lundi = lundiDuRapport(new URL(req.url).searchParams.get("semaine"), jourIso(instant));
  const csv = rapportEnCsv(rapportDeLaSemaine(lundi, await donneesDuRapport(lundi), instant), MARQUE.cantine);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="rapport-semaine-${lundi}.csv"`,
      "cache-control": "no-store",
    },
  });
}
