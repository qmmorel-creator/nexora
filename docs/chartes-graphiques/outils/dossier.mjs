// Génère, pour chaque charte, CHARTE.md et les planches de palette SVG.
// Couleurs et contrastes sont calculés depuis palettes.mjs : aucune valeur recopiée à la main.
import { writeFileSync } from 'node:fs';
import { CHARTES } from './palettes.mjs';
import { CONTENU } from './contenu.mjs';
import { contrast } from './color.mjs';
import { ensureContrast } from './tokens.mjs';

const racine = new URL('../', import.meta.url);
const ROLES = [
  ['bg', 'Fond de page'], ['surface', 'Surface (cartes, fenêtres)'], ['soft', 'Surface douce (en-têtes, survol)'], ['border', 'Bordure'], ['borderStrong', 'Bordure forte'],
  ['text', 'Encre (texte principal)'], ['secondary', 'Texte secondaire'], ['muted', 'Texte discret'],
  ['accent', 'Accent (action, sélection)'], ['accentHover', 'Accent survolé'], ['accentSoft', 'Accent doux (fond sélectionné)'], ['onAccent', 'Texte sur accent'], ['accentText', 'Accent en texte'],
  ['signal', 'Signal (aujourd\'hui, alerte)'], ['success', 'Succès'], ['warning', 'Avertissement'], ['danger', 'Danger'],
  ['sidebar', 'Navigation — fond'], ['sidebarText', 'Navigation — texte'], ['sidebarActive', 'Navigation — actif'], ['tooltip', 'Info-bulle, aplat d\'encre'], ['focus', 'Anneau de focus'], ['selection', 'Sélection de texte'],
];
const note = (r, grand = false) => (r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : r >= 3 ? (grand ? 'AA (grand texte / composant)' : 'AA grand texte seulement') : 'insuffisant');
const PAIRES = [
  ['Encre / surface', 'text', 'surface'], ['Encre / fond', 'text', 'bg'], ['Secondaire / surface', 'secondary', 'surface'], ['Discret / surface', 'muted', 'surface'], ['Discret / fond', 'muted', 'bg'],
  ['Accent en texte / surface', 'accentText', 'surface'], ['Texte sur accent / accent', 'onAccent', 'accent'], ['Signal texte / surface', 'signalText', 'surface'],
  ['Navigation texte / fond', 'sidebarText', 'sidebar'], ['Navigation discret / fond', 'sidebarMuted', 'sidebar'], ['Navigation active', 'sidebarActiveText', 'sidebarActive'],
];
const VUES = [
  ['01-dashboard-pilotage', 'Tableau de bord « Pilotage »', 'Indicateurs, histogramme, secteurs, liste d\'échéances, Mini-Gantt.'],
  ['02-dashboard-planning-equipe', 'Tableau de bord « Planning & équipe »', 'Calendrier, charge personnel, heat map mensuelle, chemin critique.'],
  ['03-dashboard-suivi', 'Tableau de bord « Suivi & décisions »', 'Priorité du moment, tâches bloquantes, note, treemap, bulles.'],
  ['04-planning-projets', 'Planning Projets (vue métro)', ''], ['05-gantt', 'Gantt', ''], ['06-aujourdhui', 'Aujourd\'hui', ''], ['07-calendrier', 'Calendrier', ''], ['08-tableur', 'Tableur', ''], ['09-fiche-tache', 'Fiche tâche', ''],
];
const WIDGETS = [
  ['taches-actives', 'Indicateur'], ['avancement-moyen', 'Indicateur (pourcentage)'], ['taches-par-projet', 'Graphique en barres'], ['repartition-par-statut', 'Graphique en secteurs'],
  ['prochaines-echeances', 'Liste'], ['mini-gantt-chantiers', 'Mini-Gantt'], ['calendrier', 'Calendrier'], ['charge-personnel', 'Charge personnel'], ['heat-map-mensuelle', 'Heat map mensuelle'],
  ['chemin-critique', 'Chemin critique'], ['priorite-du-moment', 'Next Best Action'], ['taches-bloquantes', 'Domino Effect'], ['note-de-chantier', 'Note libre'], ['treemap-projets', 'Treemap'], ['bulles', 'Bulles'],
];

function paletteSvg(ch, mode, t) {
  const W = 132, H = 92, cols = 6, rows = Math.ceil(ROLES.length / cols);
  const ink = t.text, bg = t.bg;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * W + 24}" height="${rows * H + 64}" font-family="Inter, Arial, sans-serif">`;
  s += `<rect width="100%" height="100%" fill="${bg}"/><text x="12" y="30" font-size="16" font-weight="700" fill="${ink}">${ch.nom} — thème ${mode}</text>`;
  ROLES.forEach(([k, label], i) => {
    const x = 12 + (i % cols) * W, y = 48 + Math.floor(i / cols) * H;
    s += `<rect x="${x}" y="${y}" width="${W - 10}" height="46" rx="4" fill="${t[k]}" stroke="${t.border}"/>`;
    s += `<text x="${x}" y="${y + 62}" font-size="10.5" fill="${ink}">${label.replace(/&/g, '&amp;').replace(/'/g, '&#39;')}</text><text x="${x}" y="${y + 76}" font-size="10.5" fill="${t.secondary}" font-family="monospace">${t[k]}</text>`;
  });
  return s + '</svg>\n';
}

const modesOrdre = (ch) => Object.keys(ch.modes);
const tableauCaptures = (ch, liste, prefixe, legende) => {
  const [m1, m2] = modesOrdre(ch);
  return `| ${legende} | Thème ${m1} | Thème ${m2} |\n|---|---|---|\n` + liste.map(([f, titre, desc]) =>
    `| **${titre}**${desc ? `<br>${desc}` : ''} | ![${titre} — ${m1}](captures/${m1}-${prefixe}${f}.webp) | ![${titre} — ${m2}](captures/${m2}-${prefixe}${f}.webp) |`).join('\n') + '\n';
};

for (const ch of CHARTES) {
  const c = CONTENU[ch.id];
  const dir = new URL(`${ch.num}-${ch.id}/`, racine);
  const modes = modesOrdre(ch);
  for (const m of modes) writeFileSync(new URL(`palette-${m}.svg`, dir), paletteSvg(ch, m, ch.modes[m]));
  const t0 = ch.modes[modes[0]];
  let md = `# Charte ${ch.num} — ${ch.nom}\n\n> ${ch.devise}\n\n`;
  md += `![${ch.nom} — tableau de bord, thème ${modes[0]}](captures/${modes[0]}-01-dashboard-pilotage.webp)\n\n`;
  md += `**Personnalité :** ${c.personnalite.join(' · ')}  \n**Thème par défaut :** ${modes[0]} · **Déclinaison :** ${modes[1]}  \n**Fichier :** [\`nexora-${ch.id}.css\`](nexora-${ch.id}.css)\n\n`;
  md += `## 1. Intention\n\n*${c.source}*\n\n${c.intention}\n\n**Pour qui, pour quoi :** ${c.pour}\n\n`;
  md += `## 2. Principes\n\n${c.principes.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n\n`;
  md += `## 3. Couleurs\n\nLes couleurs de **données** (projets, statuts, personnes, types de tâches) ne sont jamais remplacées : elles appartiennent aux réglages de l'utilisateur. La charte ne fixe que les couleurs d'interface ci-dessous.\n\n`;
  for (const m of modes) md += `### Thème ${m}\n\n![Palette ${m}](palette-${m}.svg)\n\n`;
  md += `| Rôle | Token | ${modes.map((m) => `Thème ${m}`).join(' | ')} |\n|---|---|${modes.map(() => '---').join('|')}|\n`;
  md += ROLES.map(([k, label]) => `| ${label} | \`--c-${k.replace(/[A-Z]/g, (x) => '-' + x.toLowerCase())}\` | ${modes.map((m) => `\`${ch.modes[m][k]}\``).join(' | ')} |`).join('\n') + '\n';
  md += Object.keys(t0.extra || {}).map((k) => `| Aplat propre à la charte : ${k} | \`--c-${k}\` | ${modes.map((m) => `\`${ch.modes[m].extra[k]}\``).join(' | ')} |`).join('\n') + '\n\n';
  const aplats = Object.keys(t0.extra || {}).filter((k) => t0.extra['on-' + k]);
  if (aplats.length) md += `**Aplats et texte posé dessus :** ${modes.map((m) => `thème ${m} : ` + aplats.map((k) => `${k} ${contrast(ch.modes[m].extra['on-' + k], ch.modes[m].extra[k]).toFixed(1)}:1`).join(', ')).join(' · ')}.\n\n`;
  md += `### Contrastes mesurés (WCAG 2.2)\n\n| Couple | ${modes.map((m) => `Thème ${m}`).join(' | ')} |\n|---|${modes.map(() => '---').join('|')}|\n`;
  md += PAIRES.map(([label, a, b]) => `| ${label} | ${modes.map((m) => { const r = contrast(ch.modes[m][a], ch.modes[m][b]); return `${r.toFixed(2)}:1 — ${note(r)}`; }).join(' | ')} |`).join('\n') + '\n';
  md += `| Bordure / surface (composant, seuil 3:1) | ${modes.map((m) => { const r = contrast(ch.modes[m].border, ch.modes[m].surface); return `${r.toFixed(2)}:1${r >= 3 ? ' — conforme 1.4.11' : ' — décorative, doublée par l\'écart de surface'}`; }).join(' | ')} |\n`;
  md += `| Statuts en texte (succès / avert. / danger, ajustés auto.) | ${modes.map((m) => { const t = ch.modes[m]; return ['success', 'warning', 'danger'].map((k) => contrast(ensureContrast(ensureContrast(t[k], t.surface), t.bg), t.surface).toFixed(1)).join(' / ') + ' :1'; }).join(' | ')} |\n\n`;
  md += `## 4. Typographie\n\n| Famille | Usage | Raison |\n|---|---|---|\n${c.typo.map((r) => `| ${r.join(' | ')} |`).join('\n')}\n\n`;
  md += `Chargement : \`https://fonts.googleapis.com/css2?${ch.googleFonts}&display=swap\` — chiffres tabulaires (\`tabular-nums\`) conservés partout.\n\n`;
  md += `| Niveau | Réglage |\n|---|---|\n${c.echelle.map((r) => `| ${r.join(' | ')} |`).join('\n')}\n\n`;
  md += `## 5. Formes, bordures, profondeur\n\n${c.formes}\n\n| Token | Valeur |\n|---|---|\n| \`--c-r-control\` | ${ch.radius.control} px |\n| \`--c-r-card\` | ${ch.radius.card} px |\n| \`--c-r-chip\` | ${ch.radius.chip} px |\n| \`--c-r-modal\` | ${ch.radius.modal} px |\n| \`--c-base\` (corps) | ${ch.base} px |\n| \`--c-shadow\` (${modes[0]}) | \`${t0.shadow}\` |\n| \`--c-menu-shadow\` (${modes[0]}) | \`${t0.menuShadow}\` |\n\n`;
  md += `## 6. Composants\n\n| Composant | Règle |\n|---|---|\n${c.composants.map((r) => `| **${r[0]}** | ${r[1]} |`).join('\n')}\n\n`;
  md += `## 7. À faire / à éviter\n\n**À faire**\n\n${c.faire.map((x) => `- ${x}`).join('\n')}\n\n**À éviter**\n\n${c.eviter.map((x) => `- ${x}`).join('\n')}\n\n`;
  md += `## 8. Limites connues\n\n${c.limites}\n\nLimites communes aux cinq chartes : voir [README](../README.md#limites-communes).\n\n`;
  md += `## 9. Captures — vues\n\nCaptures réelles de l'application (build local, données de démonstration enrichies), 1600 × 1000 px.\n\n` + tableauCaptures(ch, VUES, '', 'Vue');
  md += `\n## 10. Captures — widgets\n\n` + tableauCaptures(ch, WIDGETS.map(([f, l]) => [f, l, '']), 'widget-', 'Widget');
  md += `\n## 11. Mise en œuvre\n\nLa charte est une **couche de présentation pure** : aucun composant, aucune donnée, aucun moteur n'est modifié.\n\n1. Charger les polices (URL ci-dessus).\n2. Ajouter la feuille \`nexora-${ch.id}.css\` **après** les styles existants.\n3. Activer : \`<html data-charte="${ch.id}" data-mode="${modes[0]}">\` (ou \`${modes[1]}\`).\n\nLa feuille contient : les tokens \`--c-*\` et leur câblage sur les tokens existants (\`--life-*\`, \`--bg\`, \`--surface\`, \`--ink\`…), le remappage généré des couleurs codées en dur de Nexora, le socle commun et la signature de la charte. Elle est régénérée par \`node docs/chartes-graphiques/outils/gen.mjs\`.\n`;
  writeFileSync(new URL('CHARTE.md', dir), md);
}
console.log('dossiers écrits');
