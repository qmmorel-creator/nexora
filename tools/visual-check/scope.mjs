// Portée d'une exécution du banc visuel.
//
// Le banc complet enchaîne les scénarios 2D puis quatre vues 3D (Carte, Cosmos,
// Réunions 3D, Fleuve du temps) sous rendu logiciel, où une vue 3D tourne à 1 ou
// 2 images/s : c'est lui qui coûte. On peut donc n'en lancer qu'une partie :
//
//   --only=2d,carte,cosmos,reunions3d,fleuve   scénarios à exécuter (défaut : tous)
//   --depth=cible|complet                      profondeur des scénarios 3D (défaut : complet)
//
// (ou VISUAL_ONLY / VISUAL_DEPTH dans l'environnement). Sans option, le banc
// reste exhaustif : `npm run visual:check` est la campagne complète.
//
// « cible » garde, pour chaque vue 3D retenue, le parcours qui porte les
// contrôles d'interaction, de données, de persistance et de droits (chargement,
// aucune erreur JS, interaction principale, sélection, fiche, tâche de
// calendrier synchronisé en lecture seule, exploration sans écriture, repli
// sans WebGL). « complet » y ajoute les variantes purement visuelles ou de
// charge : écran mobile, gros volume (12 000 tâches), gestes de la Carte et
// captures 3D. Ce qui n'est pas exécuté est listé en fin de rapport, jamais
// compté comme réussi.

export const SCENARIOS = ["2d", "carte", "cosmos", "reunions3d", "fleuve"];
export const SCENARIOS_3D = SCENARIOS.filter((s) => s !== "2d");
export const DEPTHS = ["cible", "complet"];

// Libellés des sous-parcours que seule la profondeur « complet » exécute.
export const FULL_ONLY = {
  carte: "Carte : écran mobile, gros volume (12 000 tâches), gestes (clic droit, glisser, molette), captures",
  cosmos: "Cosmos : écran étroit, gros volume (12 000 tâches), captures",
  reunions3d: "Réunions 3D : captures",
  fleuve: "Fleuve du temps : captures",
};

const pick = (argv, name) => {
  const prefix = `--${name}=`;
  const hit = argv.find((a) => a.startsWith(prefix));
  return hit === undefined ? undefined : hit.slice(prefix.length);
};

export function parseScope(argv = [], env = {}) {
  const onlyRaw = pick(argv, "only") ?? env.VISUAL_ONLY ?? "";
  const depthRaw = pick(argv, "depth") ?? env.VISUAL_DEPTH ?? "complet";
  const asked = onlyRaw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const unknown = asked.filter((s) => !SCENARIOS.includes(s));
  // Une portée illisible n'est jamais réduite en silence : on refuse.
  if (unknown.length) throw new Error(`Scénario(s) inconnu(s) : ${unknown.join(", ")} — attendus : ${SCENARIOS.join(", ")}`);
  const depth = depthRaw.trim().toLowerCase();
  if (!DEPTHS.includes(depth)) throw new Error(`Profondeur inconnue : « ${depthRaw} » — attendues : ${DEPTHS.join(", ")}`);
  const only = new Set(asked.length ? asked : SCENARIOS);
  const notRun = [
    ...SCENARIOS.filter((s) => !only.has(s)).map((s) => `scénario « ${s} »`),
    ...(depth === "complet" ? [] : SCENARIOS_3D.filter((s) => only.has(s)).map((s) => FULL_ONLY[s])),
  ];
  return { only, depth, full: depth === "complet", exhaustive: only.size === SCENARIOS.length && depth === "complet", notRun };
}
