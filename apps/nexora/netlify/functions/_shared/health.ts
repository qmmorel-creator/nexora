// Mesures santé (#594) : le CSV publié de l'onglet Santé de la feuille
// (Whoop, balance, nutrition). Fonctions
// PURES, sans import : le test de parité les compare aux résultats des
// fonctions d'origine (`qc`, `osHealthHeader`, `osHealthImportNumber`, `Kc`,
// `A`), figés dans tests/fixtures/parite-sante.json.

export type HealthRecord = { date: string; [metric: string]: number | null | string };

// Clés des mesures, dans l'ordre des colonnes.
export const HEALTH_COLUMNS = [
  "date", "weight", "bodyFat", "muscleMass", "muscleRate", "recovery", "sleepHours", "strain", "calories", "hrv", "restingHr",
  "respRate", "spo2", "skinTemp", "sleepPerf", "sleepEff", "deepSleep", "remSleep", "steps", "stress", "hrZone45", "vo2max",
  "sportDuration", "caloriesIn", "proteins", "carbs",
] as const;

// En-têtes attendus, dans le même ordre — `expected` de `qc`.
export const HEALTH_HEADERS = [
  "Date", "Poids moyen (kg)", "Masse grasse moyenne (%)", "Masse musculaire moyenne (kg)", "Taux de masse musculaire (%)",
  "Récupération Whoop (%)", "Sommeil réel Whoop (h)", "Day Strain Whoop", "Calories dépensées Whoop", "HRV Whoop (ms)",
  "FC repos Whoop (bpm)", "Fréquence respiratoire Whoop (rpm)", "SpO₂ Whoop (%)", "Température cutanée Whoop (°C)",
  "Performance sommeil Whoop (%)", "Efficacité sommeil Whoop (%)", "Sommeil profond Whoop (h)", "Sommeil REM Whoop (h)",
  "Pas Whoop", "Stress moyen Whoop (0–3)", "Temps zones FC 4–5 Whoop (h)", "VO₂ max Whoop (ml/kg/min)", "Durée sport Whoop (h)",
  "Calories consommées", "Protéines Consommées", "Glucides Consommées",
];

// Mesures exprimées en % — seules à accepter « 84,1% » (`Zc[metric].unit`).
const PERCENT = new Set(["bodyFat", "muscleRate", "recovery", "spo2", "sleepPerf", "sleepEff"]);

// En-tête comparé sans casse, accents ni espaces multiples — `osHealthHeader`.
export function healthHeader(value: unknown): string {
  return String(value ?? "").normalize("NFKC").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

// Date civile ISO valide.
function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T12:00:00Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
// JJ/MM/AAAA -> AAAA-MM-JJ, sinon refus.
function healthDate(value: string): string {
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const iso = m ? `${m[3]}-${m[2]}-${m[1]}` : value;
  if (!isIsoDate(iso)) throw new Error("Date civile invalide dans la source Santé.");
  return iso;
}

// Valeur d'une cellule — `osHealthImportNumber` : vide -> null, « % » refusé
// hors mesure en %, tout texte non numérique refusé (jamais ignoré en silence).
export function healthNumber(value: unknown, metric: string, date: string, header: string): number | null {
  const text = String(value ?? "").trim();
  if (!text || /^(—|-|n\/a|null)$/i.test(text)) return null;
  const percent = /%$/.test(text);
  if (percent && !PERCENT.has(metric)) throw new Error("Unité inattendue pour « " + header + " » le " + date + ".");
  const cleaned = (percent ? text.slice(0, -1) : text).replace(/[\s  ]/g, "").replace(",", ".");
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(cleaned) || !Number.isFinite(Number(cleaned))) {
    throw new Error("Valeur non numérique dans « " + header + " » le " + date + " : " + text + ". Les données précédentes sont conservées.");
  }
  return Number(cleaned);
}

// Lignes du CSV -> mesures par jour : colonnes retrouvées par
// en-tête (ordre libre), colonne manquante ou dupliquée refusée, date
// dupliquée refusée, lignes vides sautées, tri par date.
export function healthRecords(rows: unknown[][]): HealthRecord[] {
  if (!Array.isArray(rows) || !rows.length) throw new Error("Source Santé vide.");
  const names = rows[0].map(healthHeader);
  const indices = HEALTH_COLUMNS.map((key, i) => {
    const matches = names.flatMap((name, j) => (name === healthHeader(HEALTH_HEADERS[i]) || name === healthHeader(key) ? [j] : []));
    if (matches.length !== 1) throw new Error("Colonne Santé " + (matches.length ? "dupliquée" : "manquante") + " : " + HEALTH_HEADERS[i] + ".");
    return matches[0];
  });
  const seen = new Set<string>();
  return rows.slice(1)
    .filter((row) => row.some((v) => v != null && String(v).trim()))
    .map((row) => {
      const date = healthDate(String(row[indices[0]] ?? "").trim());
      if (seen.has(date)) throw new Error("Date Santé dupliquée : " + date + ".");
      seen.add(date);
      const record: HealthRecord = { date };
      for (let i = 1; i < HEALTH_COLUMNS.length; i++) record[HEALTH_COLUMNS[i] as string] = healthNumber(row[indices[i]], HEALTH_COLUMNS[i], date, HEALTH_HEADERS[i]);
      return record;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}
