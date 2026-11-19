// Capture d'une page de la cantine en Chrome sans fenêtre (repris de Tablée et de cdp-pleine.mjs du skill dashboard-ecosysteme).
// usage : node scripts/capture.mjs <url> <sortie.png>
//   env : LARGEUR, HAUTEUR, MOBILE=1, ATTENTE ms, COOKIE="nom=valeur; nom2=valeur2" (la session d'un compte de démo : scripts/session.mjs),
//         PORT_CDP pour qu'une autre session ait son propre Chrome (9351 par défaut),
//         ACTION="code JS joué avant la capture" (ex. cliquer un onglet), PLEINE=0 pour l'écran seul (sans défiler),
//         GPU=1 pour les pages en 3D (WebGL) : un second Chrome, sur le port 9352, avec la carte graphique.
// Capture PLEINE PAGE (CDP) apres un defilement complet qui declenche les
// revelations GSAP (data-ns-animate). usage : node cdp-pleine.mjs <url> <sortie.png>
//   env : LARGEUR (1440), HAUTEUR (900), MOBILE=1 (390 x 844, tactile), ATTENTE ms (5000),
//         THEME=light|dark (force prefers-color-scheme)
import { spawn } from "node:child_process"
import { writeFileSync } from "node:fs"
const [url, sortie] = process.argv.slice(2)
const GPU = process.env.GPU === "1"
const PORT = Number(process.env.PORT_CDP || (GPU ? 9352 : 9351))
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
const MOBILE = process.env.MOBILE === "1"
const LARGEUR = Number(process.env.LARGEUR || (MOBILE ? 390 : 1440))
const HAUTEUR = Number(process.env.HAUTEUR || (MOBILE ? 844 : 900))
const ATTENTE = Number(process.env.ATTENTE || 5000)
const pause = (ms) => new Promise((r) => setTimeout(r, ms))
async function endpoint() { return (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl }
try { await endpoint() } catch {
    spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, "--remote-allow-origins=*", ...(GPU ? ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] : ["--disable-gpu"]),
        "--hide-scrollbars", "--no-first-run", "--user-data-dir=/tmp/cantine-capture-" + PORT + "-" + Date.now(), "about:blank"], { stdio: "ignore", detached: true }).unref()
    for (let i = 0; i < 40; i++) { try { await endpoint(); break } catch { await pause(250) } }
}
const cible = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })).json()
const ws = new WebSocket(cible.webSocketDebuggerUrl)
let id = 0; const att = new Map(); const erreurs = []
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data)
    if (m.id && att.has(m.id)) { att.get(m.id)(m); att.delete(m.id) }
    if (m.method === "Runtime.exceptionThrown") erreurs.push(m.params.exceptionDetails?.exception?.description?.slice(0, 200))
    if (m.method === "Log.entryAdded" && m.params.entry.level === "error") erreurs.push(m.params.entry.text.slice(0, 200)) })
await new Promise((ok) => ws.addEventListener("open", ok))
const env = (method, params = {}) => new Promise((ok) => { const n = ++id; att.set(n, ok); ws.send(JSON.stringify({ id: n, method, params })) })
await env("Page.enable"); await env("Runtime.enable"); await env("Log.enable")
// THEME=light ou dark : force prefers-color-scheme (le pack NextSaaS suit le systeme).
if (process.env.THEME) await env("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: process.env.THEME }] })
await env("Emulation.setDeviceMetricsOverride", { width: LARGEUR, height: HAUTEUR, deviceScaleFactor: 1, mobile: MOBILE })
if (MOBILE) await env("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 })
await env("Network.enable"); await env("Network.clearBrowserCookies")  // chaque capture part sans session
if (process.env.COOKIE) for (const c of process.env.COOKIE.split(";")) { const [n, ...v] = c.trim().split("="); await env("Network.enable"); await env("Network.setCookie", { name: n, value: v.join("="), url }) }
await env("Page.navigate", { url })
await pause(ATTENTE)
const ev = async (expr) => (await env("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value
await ev(`(async () => { const h = () => document.documentElement.scrollHeight
  for (let y = 0; y < h(); y += Math.round(innerHeight * 0.6)) { scrollTo(0, y); await new Promise(r => setTimeout(r, 180)) }
  scrollTo(0, h()); await new Promise(r => setTimeout(r, 800)); scrollTo(0, 0); await new Promise(r => setTimeout(r, 600)) })()`)
if (process.env.ACTION) { await ev(process.env.ACTION); await pause(1500) }
const hauteur = process.env.PLEINE === "0" ? HAUTEUR : await ev("document.documentElement.scrollHeight")
const invisibles = await ev(`[...document.querySelectorAll('[data-ns-animate]')].filter(e => getComputedStyle(e).opacity === '0').length`)
const debordement = await ev(`document.documentElement.scrollWidth - innerWidth`)
// Écran seul (PLEINE=0) : la taille ne change pas, on ne la repose pas (la reposer referme une fenêtre ouverte par ACTION).
if (hauteur !== HAUTEUR) await env("Emulation.setDeviceMetricsOverride", { width: LARGEUR, height: hauteur, deviceScaleFactor: 1, mobile: MOBILE })
await pause(1200)
// Écran seul : on ne capture que ce qui se voit (capturer « au-delà » redimensionne la page un instant, ce qui
// referme une fenêtre ouverte par ACTION).
const shot = await env("Page.captureScreenshot", { format: "png", captureBeyondViewport: process.env.PLEINE !== "0" })
writeFileSync(sortie, Buffer.from(shot.result.data, "base64"))
console.log(JSON.stringify({ url, hauteur, invisibles, debordementHorizontal: debordement, erreurs: [...new Set(erreurs)].slice(0, 6) }))
await fetch(`http://127.0.0.1:${PORT}/json/close/${cible.id}`).catch(() => {})
ws.close(); process.exit(0)
