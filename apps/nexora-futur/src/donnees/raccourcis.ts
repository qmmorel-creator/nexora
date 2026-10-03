// Raccourcis réglables (Ref #663), comme ShortcutSettingsPane de
// nexora-project : une lettre par action du Cockpit, enregistrée dans
// nexora:futurPrefs (les actions de Futur diffèrent de celles de l'actuel).
export const ACTIONS_CLAVIER = [
  ["creer", "Nouvelle tâche", "c"], ["suivante", "Tâche suivante", "j"], ["precedente", "Tâche précédente", "k"],
  ["terminer", "Terminer / rouvrir", "e"], ["statut", "Statut suivant", "s"], ["focus", "Focus oui / non", "f"],
  ["date", "Modifier la date de fin", "d"], ["responsable", "Changer le responsable", "a"], ["archiver", "Archiver", "x"],
] as const;
export type ActionClavier = (typeof ACTIONS_CLAVIER)[number][0];
// Touches réservées : accord d'espace, palette, aide, lentilles.
export const TOUCHES_RESERVEES = new Set(["g", "/", "?", "1", "2", "3", "4", "5", "6", "7", "8", "n"]);
export const toucheValide = (k: string) => /^[a-z]$/.test(k) && !TOUCHES_RESERVEES.has(k);

export function normaliserRaccourcis(v: unknown): Partial<Record<ActionClavier, string>> {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  const r: Partial<Record<ActionClavier, string>> = {}; const prises = new Set<string>();
  ACTIONS_CLAVIER.forEach(([a]) => { const k = typeof o[a] === "string" ? (o[a] as string).toLowerCase() : ""; if (toucheValide(k) && !prises.has(k)) { r[a] = k; prises.add(k); } });
  return r;
}
// Touche effective de chaque action ; une touche personnalisée prend la place
// de la touche par défaut d'une autre action, qui perd alors son raccourci.
export function touches(perso: Partial<Record<ActionClavier, string>>): Record<ActionClavier, string> {
  const prises = new Set(Object.values(perso));
  return Object.fromEntries(ACTIONS_CLAVIER.map(([a, , def]) => [a, perso[a] ?? (prises.has(def) ? "" : def)])) as Record<ActionClavier, string>;
}
export const actionDeTouche = (t: Record<ActionClavier, string>, k: string): ActionClavier | null => (ACTIONS_CLAVIER.find(([a]) => t[a] === k)?.[0] as ActionClavier | undefined) ?? null;
