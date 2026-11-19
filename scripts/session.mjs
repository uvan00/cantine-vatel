// Ouvre la session d'un compte de démonstration et écrit ses cookies, pour les captures et les essais :
//   COOKIE="$(node scripts/session.mjs awa@cantine.test)" node scripts/capture.mjs http://localhost:3700/menu captures/menu.png
// usage : node scripts/session.mjs <e-mail> [adresse, par défaut http://localhost:3700]
// Comptes de démonstration seulement (src/lib/demo.ts) : jamais un vrai compte, jamais en production.
import { MOT_DE_PASSE_DEMO } from "../src/lib/demo.ts"

const [email, adresse = "http://localhost:3700"] = process.argv.slice(2)
if (!email) { console.error("usage : node scripts/session.mjs <e-mail> [adresse]"); process.exit(2) }
const res = await fetch(`${adresse}/api/auth/sign-in/email`, {
  method: "POST",
  headers: { "content-type": "application/json", origin: adresse },
  body: JSON.stringify({ email, password: MOT_DE_PASSE_DEMO }),
})
if (!res.ok) { console.error(`Connexion refusée (${res.status}) pour ${email}`); process.exit(1) }
console.log(res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; "))
