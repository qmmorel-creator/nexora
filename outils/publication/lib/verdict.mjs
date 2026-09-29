// Verdict CI d'un SHA exact — Ref #544.
//
// Seul compte le check run `verdict` du workflow `Nexora CI`, terminé en
// `success`, SUR LE SHA DEMANDÉ. Les résultats `skipped` sont ignorés dans la
// recherche (ils ne valent jamais succès, et ne masquent ni un échec plus
// récent ni un vrai verdict). Absent, en cours, échoué, annulé, neutre : refus.
export const NOM_VERDICT = "verdict";
export const NOM_WORKFLOW = "Nexora CI";

export function evaluerVerdict(runs, sha) {
  const pertinents = (runs || [])
    .filter((r) => r.name === NOM_VERDICT && r.head_sha === sha)
    .filter((r) => !r.app || r.app.slug === "github-actions")
    .filter((r) => r.conclusion !== "skipped")
    .sort((a, b) => String(b.started_at || b.completed_at || "").localeCompare(String(a.started_at || a.completed_at || "")));
  if (!pertinents.length) return { ok: false, raison: `aucun verdict « ${NOM_VERDICT} » concluant sur ${sha.slice(0, 12)} (absent ou seulement sauté)` };
  const dernier = pertinents[0];
  if (dernier.status !== "completed") return { ok: false, raison: `verdict encore en cours (${dernier.status}) sur ${sha.slice(0, 12)}`, url: dernier.html_url };
  if (dernier.conclusion !== "success") return { ok: false, raison: `verdict ${dernier.conclusion} sur ${sha.slice(0, 12)}`, url: dernier.html_url };
  return { ok: true, url: dernier.html_url, date: dernier.completed_at };
}

// Lecture par l'API GitHub (jeton de l'environnement de l'assistant). Toute
// indisponibilité est un refus, jamais un succès supposé.
export async function lireVerdict({ depot = "qmmorel-creator/nexora", sha, jeton = process.env.GITHUB_TOKEN || process.env.GH_TOKEN, fetchImpl = fetch }) {
  if (!jeton) return { ok: false, raison: "aucun jeton GitHub dans l'environnement : verdict impossible à établir" };
  try {
    const r = await fetchImpl(`https://api.github.com/repos/${depot}/commits/${sha}/check-runs?check_name=${NOM_VERDICT}&per_page=100&filter=all`, {
      headers: { Authorization: `Bearer ${jeton}`, Accept: "application/vnd.github+json" }, signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok) return { ok: false, raison: `API GitHub : HTTP ${r.status}` };
    return evaluerVerdict((await r.json()).check_runs, sha);
  } catch (e) {
    return { ok: false, raison: `API GitHub injoignable (${e.message})` };
  }
}
