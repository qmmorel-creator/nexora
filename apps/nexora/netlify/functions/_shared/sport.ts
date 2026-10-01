// Journal sportif (#578) : le CSV publié de la feuille « Activités Strava »,
// lu comme OS360 (commit 13197da). Fonctions PURES, sans import : le test de
// parité les compare aux résultats des fonctions d'origine d'OS360 (`_e`,
// `Jc`, `Kc`, `ve`, `S`, `A`), figés dans tests/fixtures/os360-parite-sport.json
// avant le retrait du moteur (#597).

export type SportActivity = {
  // Champs produits par `Jc` d'OS360, à l'identique.
  id: string;
  date: string;
  sport: string;
  title: string;
  total: number | null;
  moving: number | null;
  distance: number | null;
  elevation: number | null;
  hr: number | null;
  maxHr: number | null;
  url: string | null;
  // Colonnes que `Jc` ne lit pas, gardées pour la liste « tous les champs ».
  start: string;
  end: string;
  eventId: string;
  calendarId: string;
  extra: Record<string, string>;
};

// Les 14 en-têtes exigés par `Jc`, dans l'ordre.
export const SPORT_HEADERS = [
  "Date", "Sport", "Titre", "Durée totale (min)", "Durée en mouvement (min)", "Distance (km)", "Dénivelé positif (m)",
  "FC moyenne (bpm)", "FC maximale (bpm)", "Début ISO", "Fin ISO", "ID événement", "Calendrier ID", "Lien événement",
];

// CSV -> lignes de cellules — `_e` d'OS360.
export function sportCsvRows(text: string): string[][] {
  if (/^\s*</.test(text)) throw new Error("La source a renvoyé du HTML au lieu du CSV.");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw new Error("CSV incomplet : guillemet non fermé.");
  row.push(cell);
  if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}

// Date civile ISO valide — `A` d'OS360.
function isIsoDate(value: string): boolean {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T12:00:00Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

// JJ/MM/AAAA -> AAAA-MM-JJ, sinon refus du fichier — `Kc` d'OS360.
function sportDate(value: string): string {
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const iso = m ? `${m[3]}-${m[2]}-${m[1]}` : value;
  if (!isIsoDate(iso)) throw new Error("Date civile invalide dans la source Santé.");
  return iso;
}

// Nombre à la française ou vide — `ve` d'OS360.
function sportNumber(value: unknown): number | null {
  if (value == null || String(value).trim() === "" || /^(—|-|n\/a|null)$/i.test(String(value).trim())) return null;
  const n = Number(String(value).replace(/[\s  ]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// Lien HTTPS sans identifiants, sinon vide — `S` d'OS360.
export function sportUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && !url.username && !url.password ? url.href : "";
  } catch {
    return "";
  }
}

// Lignes du CSV -> activités — `Jc` d'OS360 : mêmes refus, même saut des
// lignes vides, même clé de dédoublonnage, mêmes conversions.
export function sportActivities(rows: unknown[][]): SportActivity[] {
  if (!rows.length || SPORT_HEADERS.some((h, i) => String(rows[0][i] ?? "").trim() !== h)) {
    throw new Error("Colonnes du journal sportif incompatibles.");
  }
  const extraHeaders = rows[0].slice(SPORT_HEADERS.length).map((h) => String(h ?? "").trim());
  const seen = new Set<string>();
  const out: SportActivity[] = [];
  let index = 0;
  for (const row of rows.slice(1)) {
    index++;
    if (!row.some((v) => v != null && String(v).trim())) continue;
    const id = row[11] && row[12] ? String(row[12]) + "|" + String(row[11]) : `manual-${index}|${String(row[0])}|${String(row[1])}|${String(row[2] || "")}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const extra: Record<string, string> = {};
    extraHeaders.forEach((h, i) => { if (h) extra[h] = String(row[SPORT_HEADERS.length + i] ?? ""); });
    out.push({
      id,
      date: sportDate(String(row[0])),
      sport: String(row[1]),
      title: String(row[2] || ""),
      total: sportNumber(row[3]),
      moving: sportNumber(row[4]),
      distance: sportNumber(row[5]),
      elevation: sportNumber(row[6]),
      hr: sportNumber(row[7]),
      maxHr: sportNumber(row[8]),
      url: sportUrl(row[13]) || null,
      start: String(row[9] ?? ""),
      end: String(row[10] ?? ""),
      eventId: String(row[11] ?? ""),
      calendarId: String(row[12] ?? ""),
      extra,
    });
  }
  return out;
}
