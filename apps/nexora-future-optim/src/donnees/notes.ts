// Notes des tableaux de bord (Ref #658) : LECTURE seule de nexora:dashboards et
// nexora:todayWidgets (écriture au lot 10, décision de Quentin). Texte du widget
// « note » : widget.content, en Markdown (part-003:3785).
export interface NoteTableau { id: string; titre: string; contenu: string; tableau: string; page: string; }

type Brut = Record<string, unknown>;
const objets = (v: unknown): Brut[] => (Array.isArray(v) ? v.filter((x): x is Brut => !!x && typeof x === "object") : []);
// Un ancien tableau `widgets` à plat se lit comme une page « default ».
const pages = (b: Brut): Brut[] => (Array.isArray(b.pages) ? objets(b.pages) : Array.isArray(b.widgets) ? [{ id: "default", name: "", widgets: b.widgets }] : []);

export function notesTableaux(tableaux: unknown, accueil: unknown): NoteTableau[] {
  const out: NoteTableau[] = [];
  const lire = (nomTableau: string, b: Brut) => pages(b).forEach((p) => objets(p.widgets).forEach((w) => {
    if (w.type !== "note" || typeof w.content !== "string" || !w.content.trim()) return;
    out.push({ id: String(w.id ?? `${nomTableau}-${out.length}`), titre: String(w.title || "Note"), contenu: w.content, tableau: nomTableau, page: String(p.name || "") });
  }));
  if (accueil && typeof accueil === "object") lire("Aujourd'hui", accueil as Brut);
  objets(tableaux).forEach((t) => lire(String(t.name || "Tableau de bord"), t));
  return out;
}

// Markdown minimal (titres, listes, cases, gras, italique, code, liens,
// encadrés « :::callout-x », tableaux) en blocs typés, sans HTML brut.
export type Bloc =
  | { genre: "titre"; niveau: number; texte: string }
  | { genre: "liste"; elements: { texte: string; coche?: boolean }[] }
  | { genre: "encadre"; ton: string; titre: string; blocs: Bloc[] }
  | { genre: "tableau"; lignes: string[][] }
  | { genre: "paragraphe"; texte: string };

export function analyserMarkdown(src: string): Bloc[] {
  const lignes = src.replace(/\r\n?/g, "\n").split("\n");
  const blocs: Bloc[] = [];
  for (let i = 0; i < lignes.length; i++) {
    const l = lignes[i];
    if (!l.trim()) continue;
    const enc = /^:::callout-(\w+)\s*(.*)$/.exec(l.trim());
    if (enc) {
      const corps: string[] = [];
      for (i++; i < lignes.length && lignes[i].trim() !== ":::"; i++) corps.push(lignes[i]);
      blocs.push({ genre: "encadre", ton: enc[1], titre: enc[2], blocs: analyserMarkdown(corps.join("\n")) });
      continue;
    }
    const t = /^(#{1,6})\s+(.*)$/.exec(l);
    if (t) { blocs.push({ genre: "titre", niveau: t[1].length, texte: t[2] }); continue; }
    if (/^\s*[-*+]\s+/.test(l)) {
      const elements: { texte: string; coche?: boolean }[] = [];
      for (; i < lignes.length && /^\s*[-*+]\s+/.test(lignes[i]); i++) {
        const c = /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/.exec(lignes[i]);
        elements.push(c ? { texte: c[2], coche: c[1] !== " " } : { texte: lignes[i].replace(/^\s*[-*+]\s+/, "") });
      }
      i--; blocs.push({ genre: "liste", elements }); continue;
    }
    if (/^\s*\|.*\|\s*$/.test(l)) {
      const rangs: string[][] = [];
      for (; i < lignes.length && /^\s*\|.*\|\s*$/.test(lignes[i]); i++) {
        if (/^\s*\|[\s:|-]+\|\s*$/.test(lignes[i])) continue;
        rangs.push(lignes[i].trim().slice(1, -1).split("|").map((x) => x.trim()));
      }
      i--; blocs.push({ genre: "tableau", lignes: rangs }); continue;
    }
    const para: string[] = [];
    for (; i < lignes.length && lignes[i].trim() && !/^(#{1,6}\s|\s*[-*+]\s|:::|\s*\|)/.test(lignes[i]); i++) para.push(lignes[i].trim());
    i--; blocs.push({ genre: "paragraphe", texte: para.join(" ") });
  }
  return blocs;
}

export type Segment = { genre: "texte" | "gras" | "italique" | "code"; texte: string } | { genre: "lien"; texte: string; url: string };
// Seuls les liens http(s) et mailto sont rendus cliquables.
export function segmentsEnLigne(s: string): Segment[] {
  const out: Segment[] = [];
  const re = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\*([^*]+)\*|_([^_]+)_)/g;
  let dernier = 0; let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > dernier) out.push({ genre: "texte", texte: s.slice(dernier, m.index) });
    if (m[2]) out.push({ genre: "gras", texte: m[2] });
    else if (m[3]) out.push({ genre: "code", texte: m[3] });
    else if (m[4]) out.push(/^(https?:|mailto:)/i.test(m[5]) ? { genre: "lien", texte: m[4], url: m[5] } : { genre: "texte", texte: m[4] });
    else out.push({ genre: "italique", texte: m[6] || m[7] });
    dernier = re.lastIndex;
  }
  if (dernier < s.length) out.push({ genre: "texte", texte: s.slice(dernier) });
  return out;
}
