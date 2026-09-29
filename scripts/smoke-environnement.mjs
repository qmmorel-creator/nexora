// Contrôle de fumée d'un environnement explicite — Ref #544.
//
//   node scripts/smoke-environnement.mjs --env preproduction [--url https://preprod--nexora-project.netlify.app] [--commit <sha>]
//   node scripts/smoke-environnement.mjs --env local        [--url http://127.0.0.1:8888]
//
// URL, environnement et projet attendus sont explicites. Un test hors
// production ÉCHOUE s'il atteint la production : origine de production,
// projet Firebase nexora-cb20d ou fonctions servies. La vérification de
// production reste scripts/smoke-production.mjs (lecture seule).
import { environnement, ENVIRONNEMENTS } from "../config/environnements.mjs";
import { controlesComposant, creerLecteurHttp, verifierVersion } from "../outils/publication/lib/verification.mjs";

export async function fumer({ env: nomEnv, url, commit, lire = creerLecteurHttp() }) {
  const env = environnement(nomEnv);
  if (env.nom === "production") throw new Error("Production : utiliser npm run smoke:production (lecture seule).");
  const base = (url || env.origines.application).replace(/\/$/, "");
  const productions = Object.values(ENVIRONNEMENTS.production.origines).filter(Boolean);
  if (productions.some((p) => base.startsWith(p))) throw new Error(`${base} est une origine de production : refusé pour un test ${env.nom}.`);
  const attendu = { composant: "application", environnement: env.nom, ...(commit ? { commit } : {}) };
  const version = await verifierVersion(lire, base, attendu, { tentatives: 3 });
  const controles = await controlesComposant(lire, "application", base, env.nom);
  const resultats = [{ nom: "version.json", ok: version.ok, detail: version.detail || `${version.servi?.version} ${version.servi?.commit?.slice(0, 12)}` }, ...controles.resultats];
  return { ok: resultats.every((r) => r.ok), base, resultats };
}

const principal = process.argv[1] && process.argv[1].endsWith("smoke-environnement.mjs");
if (principal) {
  const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };
  try {
    const r = await fumer({ env: arg("env"), url: arg("url"), commit: arg("commit") });
    for (const x of r.resultats) console.log(`${x.ok ? "OK   " : "ÉCHEC"} ${x.nom}${x.detail ? ` — ${x.detail}` : ""}`);
    console.log(r.ok ? `\n${r.base} : conforme.` : `\n${r.base} : NON conforme.`);
    process.exit(r.ok ? 0 : 1);
  } catch (e) { console.error(`REFUS — ${e.message}`); process.exit(2); }
}
