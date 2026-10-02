# Charte 02 — De Stijl

> Une toile de Mondrian : blanc pur, grille noire épaisse entre les widgets, rouge, jaune et bleu en aplats.

![De Stijl — tableau de bord, thème clair](captures/clair-01-dashboard-pilotage.webp)

**Personnalité :** Radical · Structuré · Graphique · Immédiatement reconnaissable  
**Thème par défaut :** clair · **Déclinaison :** sombre  
**Fichier :** [`nexora-destijl.css`](nexora-destijl.css)

## 1. Intention

*Variante de la famille Bauhaus : le néoplasticisme de Mondrian et Rietveld.*

Le tableau de bord devient une toile de Mondrian : la grille de placement est peinte en noir, si bien que les intervalles entre widgets forment le réseau de lignes épaisses ; les indicateurs sont des aplats rouge, bleu et jaune, les autres cases restent blanches.

**Pour qui, pour quoi :** Les tableaux de bord de direction et l'affichage mural : la lecture des aplats se fait de loin.

## 2. Principes

1. La grille est le dessin : lignes noires de 5 à 6 px, jamais de bordure fine.
2. Blanc pur pour les contenus, trois primaires pour les aplats, noir pour la structure.
3. Angles droits partout : commandes, cartes, puces, fenêtres, menus (rayon 0).
4. Titres en capitales élargies (Archivo, largeur 112 à 115 %).
5. La sélection est un aplat : jaune dans la navigation, bleu pour l'onglet actif.

## 3. Couleurs

Les couleurs de **données** (projets, statuts, personnes, types de tâches) ne sont jamais remplacées : elles appartiennent aux réglages de l'utilisateur. La charte ne fixe que les couleurs d'interface ci-dessous.

### Thème clair

![Palette clair](palette-clair.svg)

### Thème sombre

![Palette sombre](palette-sombre.svg)

| Rôle | Token | Thème clair | Thème sombre |
|---|---|---|---|
| Fond de page | `--c-bg` | `#F4F4F2` | `#0A0A0A` |
| Surface (cartes, fenêtres) | `--c-surface` | `#FFFFFF` | `#181818` |
| Surface douce (en-têtes, survol) | `--c-soft` | `#F4F4F2` | `#202020` |
| Bordure | `--c-border` | `#D9D9D6` | `#333333` |
| Bordure forte | `--c-border-strong` | `#111111` | `#F2F2F2` |
| Encre (texte principal) | `--c-text` | `#111111` | `#F2F2F2` |
| Texte secondaire | `--c-secondary` | `#3B3B3B` | `#C4C4C4` |
| Texte discret | `--c-muted` | `#595959` | `#9A9A9A` |
| Accent (action, sélection) | `--c-accent` | `#1F4FA3` | `#5B8BE0` |
| Accent survolé | `--c-accent-hover` | `#173C7D` | `#7AA2E8` |
| Accent doux (fond sélectionné) | `--c-accent-soft` | `#DCE5F6` | `#16233D` |
| Texte sur accent | `--c-on-accent` | `#FFFFFF` | `#0A0A0A` |
| Accent en texte | `--c-accent-text` | `#1F4FA3` | `#8FB0F0` |
| Signal (aujourd'hui, alerte) | `--c-signal` | `#DD1D21` | `#FF3B3F` |
| Succès | `--c-success` | `#1E7A46` | `#4CC47E` |
| Avertissement | `--c-warning` | `#9A7000` | `#FFD02A` |
| Danger | `--c-danger` | `#DD1D21` | `#FF3B3F` |
| Navigation — fond | `--c-sidebar` | `#FFFFFF` | `#0A0A0A` |
| Navigation — texte | `--c-sidebar-text` | `#111111` | `#F2F2F2` |
| Navigation — actif | `--c-sidebar-active` | `#FFD02A` | `#FFD02A` |
| Info-bulle, aplat d'encre | `--c-tooltip` | `#111111` | `#262626` |
| Anneau de focus | `--c-focus` | `#DD1D21` | `#FFD02A` |
| Sélection de texte | `--c-selection` | `#FFD02A` | `#5A4A00` |
| Aplat propre à la charte : red | `--c-red` | `#DD1D21` | `#FF3B3F` |
| Aplat propre à la charte : on-red | `--c-on-red` | `#FFFFFF` | `#0A0A0A` |
| Aplat propre à la charte : yellow | `--c-yellow` | `#FFD02A` | `#FFD02A` |
| Aplat propre à la charte : on-yellow | `--c-on-yellow` | `#111111` | `#0A0A0A` |
| Aplat propre à la charte : blue | `--c-blue` | `#1F4FA3` | `#3D6FD6` |
| Aplat propre à la charte : on-blue | `--c-on-blue` | `#FFFFFF` | `#FFFFFF` |
| Aplat propre à la charte : grid | `--c-grid` | `#111111` | `#000000` |

**Aplats et texte posé dessus :** thème clair : red 4.9:1, yellow 12.9:1, blue 7.8:1 · thème sombre : red 5.6:1, yellow 13.5:1, blue 4.7:1.

### Contrastes mesurés (WCAG 2.2)

| Couple | Thème clair | Thème sombre |
|---|---|---|
| Encre / surface | 18.88:1 — AAA | 15.86:1 — AAA |
| Encre / fond | 17.15:1 — AAA | 17.68:1 — AAA |
| Secondaire / surface | 11.20:1 — AAA | 10.18:1 — AAA |
| Discret / surface | 7.00:1 — AAA | 6.31:1 — AA |
| Discret / fond | 6.36:1 — AA | 7.04:1 — AAA |
| Accent en texte / surface | 7.76:1 — AAA | 8.15:1 — AAA |
| Texte sur accent / accent | 7.76:1 — AAA | 5.86:1 — AA |
| Signal texte / surface | 6.23:1 — AA | 6.41:1 — AA |
| Navigation texte / fond | 18.88:1 — AAA | 17.68:1 — AAA |
| Navigation discret / fond | 7.00:1 — AAA | 7.04:1 — AAA |
| Navigation active | 12.87:1 — AAA | 13.49:1 — AAA |
| Bordure / surface (composant, seuil 3:1) | 1.41:1 — décorative, doublée par l'écart de surface | 1.41:1 — décorative, doublée par l'écart de surface |
| Statuts en texte (succès / avert. / danger, ajustés auto.) | 5.3 / 5.1 / 5.1 :1 | 8.0 / 12.1 / 5.0 :1 |

## 4. Typographie

| Famille | Usage | Raison |
|---|---|---|
| Archivo (axe de largeur 62–125) | Tout | Les capitales élargies donnent l'aplomb typographique de De Stijl ; même famille pour le texte. |
| JetBrains Mono | Code | — |

Chargement : `https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=JetBrains+Mono:wght@400;600&display=swap` — chiffres tabulaires (`tabular-nums`) conservés partout.

| Niveau | Réglage |
|---|---|
| Titre de page | 26 px / 900 / capitales / largeur 115 % |
| Titre de widget | 12,5 px / 900 / capitales / largeur 112 % |
| Chiffre clé | 50 px / 900 / largeur 112 % |
| Corps | 14 px |
| Onglets | 13 px / 800 / capitales |

## 5. Formes, bordures, profondeur

Rayon 0. Lignes structurelles de 5 px (barre supérieure, onglets, en-têtes de widgets, fenêtres) et 6 px (navigation). Aucune ombre : le noir fait la profondeur.

| Token | Valeur |
|---|---|
| `--c-r-control` | 0 px |
| `--c-r-card` | 0 px |
| `--c-r-chip` | 0 px |
| `--c-r-modal` | 0 px |
| `--c-base` (corps) | 14 px |
| `--c-shadow` (clair) | `none` |
| `--c-menu-shadow` (clair) | `0 0 0 3px #111111` |

## 6. Composants

| Composant | Règle |
|---|---|
| **Navigation latérale** | Blanche, fermée par une ligne noire de 6 px. Élément actif en aplat jaune cerné de noir. Bouton de création rouge. |
| **Barre supérieure** | Ligne noire de 5 px ; titre en capitales élargies. |
| **Onglets de vues** | Capitales élargies ; onglet actif en aplat bleu plein. |
| **Widgets** | Sans bordure : posés sur la grille noire. En-tête fermé par 5 px de noir. Actions masquées hors survol. |
| **Indicateurs (KPI)** | 1er rouge, 2e blanc, 3e jaune, 4e bleu ; chiffre 50 px / 900. |
| **Tableaux** | En-tête noir, lignes séparées par 2 px de noir. |
| **Puces** | Fond blanc, contour de 2 px dans la couleur de donnée, texte encre. |
| **Fiche tâche** | Cadre noir de 5 px, bandeau de titre jaune. |

## 7. À faire / à éviter

**À faire**

- Laisser la grille faire le dessin : espacement entre widgets constant.
- Composer les rangées d'indicateurs par quatre.

**À éviter**

- Ajouter des bordures fines grises.
- Mettre des aplats colorés ailleurs que sur les indicateurs, la sélection et les en-têtes.

## 8. Limites connues

Très affirmé : les vues denses (tableur, Gantt) gagnent en structure mais perdent en légèreté. Les lignes épaisses consomment un peu d'espace.

Limites communes aux cinq chartes : voir [README](../README.md#limites-communes).

## 9. Captures — vues

Captures réelles de l'application (build local, données de démonstration enrichies), 1600 × 1000 px.

| Vue | Thème clair | Thème sombre |
|---|---|---|
| **Tableau de bord « Pilotage »**<br>Indicateurs, histogramme, secteurs, liste d'échéances, Mini-Gantt. | ![Tableau de bord « Pilotage » — clair](captures/clair-01-dashboard-pilotage.webp) | ![Tableau de bord « Pilotage » — sombre](captures/sombre-01-dashboard-pilotage.webp) |
| **Tableau de bord « Planning & équipe »**<br>Calendrier, charge personnel, heat map mensuelle, chemin critique. | ![Tableau de bord « Planning & équipe » — clair](captures/clair-02-dashboard-planning-equipe.webp) | ![Tableau de bord « Planning & équipe » — sombre](captures/sombre-02-dashboard-planning-equipe.webp) |
| **Tableau de bord « Suivi & décisions »**<br>Priorité du moment, tâches bloquantes, note, treemap, bulles. | ![Tableau de bord « Suivi & décisions » — clair](captures/clair-03-dashboard-suivi.webp) | ![Tableau de bord « Suivi & décisions » — sombre](captures/sombre-03-dashboard-suivi.webp) |
| **Planning Projets (vue métro)** | ![Planning Projets (vue métro) — clair](captures/clair-04-planning-projets.webp) | ![Planning Projets (vue métro) — sombre](captures/sombre-04-planning-projets.webp) |
| **Gantt** | ![Gantt — clair](captures/clair-05-gantt.webp) | ![Gantt — sombre](captures/sombre-05-gantt.webp) |
| **Aujourd'hui** | ![Aujourd'hui — clair](captures/clair-06-aujourdhui.webp) | ![Aujourd'hui — sombre](captures/sombre-06-aujourdhui.webp) |
| **Calendrier** | ![Calendrier — clair](captures/clair-07-calendrier.webp) | ![Calendrier — sombre](captures/sombre-07-calendrier.webp) |
| **Tableur** | ![Tableur — clair](captures/clair-08-tableur.webp) | ![Tableur — sombre](captures/sombre-08-tableur.webp) |
| **Fiche tâche** | ![Fiche tâche — clair](captures/clair-09-fiche-tache.webp) | ![Fiche tâche — sombre](captures/sombre-09-fiche-tache.webp) |

## 10. Captures — widgets

| Widget | Thème clair | Thème sombre |
|---|---|---|
| **Indicateur** | ![Indicateur — clair](captures/clair-widget-taches-actives.webp) | ![Indicateur — sombre](captures/sombre-widget-taches-actives.webp) |
| **Indicateur (pourcentage)** | ![Indicateur (pourcentage) — clair](captures/clair-widget-avancement-moyen.webp) | ![Indicateur (pourcentage) — sombre](captures/sombre-widget-avancement-moyen.webp) |
| **Graphique en barres** | ![Graphique en barres — clair](captures/clair-widget-taches-par-projet.webp) | ![Graphique en barres — sombre](captures/sombre-widget-taches-par-projet.webp) |
| **Graphique en secteurs** | ![Graphique en secteurs — clair](captures/clair-widget-repartition-par-statut.webp) | ![Graphique en secteurs — sombre](captures/sombre-widget-repartition-par-statut.webp) |
| **Liste** | ![Liste — clair](captures/clair-widget-prochaines-echeances.webp) | ![Liste — sombre](captures/sombre-widget-prochaines-echeances.webp) |
| **Mini-Gantt** | ![Mini-Gantt — clair](captures/clair-widget-mini-gantt-chantiers.webp) | ![Mini-Gantt — sombre](captures/sombre-widget-mini-gantt-chantiers.webp) |
| **Calendrier** | ![Calendrier — clair](captures/clair-widget-calendrier.webp) | ![Calendrier — sombre](captures/sombre-widget-calendrier.webp) |
| **Charge personnel** | ![Charge personnel — clair](captures/clair-widget-charge-personnel.webp) | ![Charge personnel — sombre](captures/sombre-widget-charge-personnel.webp) |
| **Heat map mensuelle** | ![Heat map mensuelle — clair](captures/clair-widget-heat-map-mensuelle.webp) | ![Heat map mensuelle — sombre](captures/sombre-widget-heat-map-mensuelle.webp) |
| **Chemin critique** | ![Chemin critique — clair](captures/clair-widget-chemin-critique.webp) | ![Chemin critique — sombre](captures/sombre-widget-chemin-critique.webp) |
| **Next Best Action** | ![Next Best Action — clair](captures/clair-widget-priorite-du-moment.webp) | ![Next Best Action — sombre](captures/sombre-widget-priorite-du-moment.webp) |
| **Domino Effect** | ![Domino Effect — clair](captures/clair-widget-taches-bloquantes.webp) | ![Domino Effect — sombre](captures/sombre-widget-taches-bloquantes.webp) |
| **Note libre** | ![Note libre — clair](captures/clair-widget-note-de-chantier.webp) | ![Note libre — sombre](captures/sombre-widget-note-de-chantier.webp) |
| **Treemap** | ![Treemap — clair](captures/clair-widget-treemap-projets.webp) | ![Treemap — sombre](captures/sombre-widget-treemap-projets.webp) |
| **Bulles** | ![Bulles — clair](captures/clair-widget-bulles.webp) | ![Bulles — sombre](captures/sombre-widget-bulles.webp) |

## 11. Mise en œuvre

La charte est une **couche de présentation pure** : aucun composant, aucune donnée, aucun moteur n'est modifié.

1. Charger les polices (URL ci-dessus).
2. Ajouter la feuille `nexora-destijl.css` **après** les styles existants.
3. Activer : `<html data-charte="destijl" data-mode="clair">` (ou `sombre`).

La feuille contient : les tokens `--c-*` et leur câblage sur les tokens existants (`--life-*`, `--bg`, `--surface`, `--ink`…), le remappage généré des couleurs codées en dur de Nexora, le socle commun et la signature de la charte. Elle est régénérée par `node docs/chartes-graphiques/outils/gen.mjs`.
