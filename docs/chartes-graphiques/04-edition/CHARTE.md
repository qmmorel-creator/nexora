# Charte 04 — Édition

> Registre éditorial : papier ivoire, titres à empattements, vert forêt et filets fins.

![Édition — tableau de bord, thème clair](captures/clair-01-dashboard-pilotage.webp)

**Personnalité :** Posé · Lettré · Chaleureux · Durable  
**Thème par défaut :** clair · **Déclinaison :** sombre  
**Fichier :** [`nexora-edition.css`](nexora-edition.css)

## 1. Intention

Un registre tenu à la main : papier ivoire, titres à empattements, filets doubles sous les en-têtes, vert forêt pour l'action et brique pour le signal. La rigueur vient de la composition éditoriale plutôt que de la technique.

**Pour qui, pour quoi :** Les comptes rendus, la lecture, l'impression ; un usage personnel ou de direction où l'outil doit inspirer confiance plutôt que la technicité.

## 2. Principes

1. Titres en Source Serif 4 (taille optique), texte en Source Sans 3 : une famille, deux voix.
2. Filet double de 3 px sous les en-têtes de widgets et de tableaux, comme dans un registre.
3. Petites capitales pour les onglets, les en-têtes de colonnes et les étiquettes de champs.
4. Les chiffres clés sont composés en serif, en vert forêt.
5. Papier ivoire en fond, blanc cassé en surface : jamais de blanc pur.

## 3. Couleurs

Les couleurs de **données** (projets, statuts, personnes, types de tâches) ne sont jamais remplacées : elles appartiennent aux réglages de l'utilisateur. La charte ne fixe que les couleurs d'interface ci-dessous.

### Thème clair

![Palette clair](palette-clair.svg)

### Thème sombre

![Palette sombre](palette-sombre.svg)

| Rôle | Token | Thème clair | Thème sombre |
|---|---|---|---|
| Fond de page | `--c-bg` | `#F1ECE2` | `#14110C` |
| Surface (cartes, fenêtres) | `--c-surface` | `#FFFDF8` | `#1D1913` |
| Surface douce (en-têtes, survol) | `--c-soft` | `#F8F3E9` | `#241F18` |
| Bordure | `--c-border` | `#DFD6C5` | `#373027` |
| Bordure forte | `--c-border-strong` | `#C2B59D` | `#55493B` |
| Encre (texte principal) | `--c-text` | `#1D1811` | `#EFE7D7` |
| Texte secondaire | `--c-secondary` | `#55493B` | `#C4B8A3` |
| Texte discret | `--c-muted` | `#736656` | `#9B8F7C` |
| Accent (action, sélection) | `--c-accent` | `#1E5E44` | `#6CC39A` |
| Accent survolé | `--c-accent-hover` | `#144632` | `#8BD3B0` |
| Accent doux (fond sélectionné) | `--c-accent-soft` | `#E0EBE2` | `#1C2F25` |
| Texte sur accent | `--c-on-accent` | `#FFFDF8` | `#0F2219` |
| Accent en texte | `--c-accent-text` | `#1E5E44` | `#7CCBA5` |
| Signal (aujourd'hui, alerte) | `--c-signal` | `#B4441F` | `#E07A52` |
| Succès | `--c-success` | `#2E7D4F` | `#6CC39A` |
| Avertissement | `--c-warning` | `#B07A12` | `#E2B55A` |
| Danger | `--c-danger` | `#B4441F` | `#E07A52` |
| Navigation — fond | `--c-sidebar` | `#F1ECE2` | `#14110C` |
| Navigation — texte | `--c-sidebar-text` | `#1D1811` | `#EFE7D7` |
| Navigation — actif | `--c-sidebar-active` | `#FFFDF8` | `#241F18` |
| Info-bulle, aplat d'encre | `--c-tooltip` | `#1D1811` | `#2E281F` |
| Anneau de focus | `--c-focus` | `#1E5E44` | `#7CCBA5` |
| Sélection de texte | `--c-selection` | `#D3E6D8` | `#2C4A39` |

### Contrastes mesurés (WCAG 2.2)

| Couple | Thème clair | Thème sombre |
|---|---|---|
| Encre / surface | 17.34:1 — AAA | 14.23:1 — AAA |
| Encre / fond | 14.98:1 — AAA | 15.32:1 — AAA |
| Secondaire / surface | 8.60:1 — AAA | 8.94:1 — AAA |
| Discret / surface | 5.49:1 — AA | 5.51:1 — AA |
| Discret / fond | 4.74:1 — AA | 5.93:1 — AA |
| Accent en texte / surface | 7.54:1 — AAA | 9.11:1 — AAA |
| Texte sur accent / accent | 7.54:1 — AAA | 7.85:1 — AAA |
| Signal texte / surface | 7.09:1 — AAA | 7.51:1 — AAA |
| Navigation texte / fond | 14.98:1 — AAA | 15.32:1 — AAA |
| Navigation discret / fond | 4.74:1 — AA | 5.93:1 — AA |
| Navigation active | 7.54:1 — AAA | 9.38:1 — AAA |
| Bordure / surface (composant, seuil 3:1) | 1.42:1 — décorative, doublée par l'écart de surface | 1.34:1 — décorative, doublée par l'écart de surface |
| Statuts en texte (succès / avert. / danger, ajustés auto.) | 5.4 / 5.3 / 5.5 :1 | 8.3 / 9.2 / 5.9 :1 |

## 4. Typographie

| Famille | Usage | Raison |
|---|---|---|
| Source Serif 4 (axe optique 8–60) | Titres de page, de widgets, de fenêtres ; chiffres clés ; libellés de navigation (italique) | Serif de texte à taille optique : fin en grand, robuste en petit. |
| Source Sans 3 | Texte courant, commandes | Sans-serif humaniste, jumelle de la serif. |
| Source Code Pro | Code et valeurs techniques | Même famille. |

Chargement : `https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,500..700&family=Source+Sans+3:wght@400..700&family=Source+Code+Pro:wght@400;500;600&display=swap` — chiffres tabulaires (`tabular-nums`) conservés partout.

| Niveau | Réglage |
|---|---|
| Titre de page | 25 px / 600 serif |
| Titre de widget | 15,5 px / 600 serif |
| Chiffre clé | 42 px / 600 serif, vert forêt |
| Corps | 14 px / 400–600 |
| Onglets, en-têtes de colonnes | 13–13,5 px petites capitales / +5 % |
| Navigation (sections) | 12,5 px serif italique |

## 5. Formes, bordures, profondeur

Rayons 3 px (commandes), 4 px (cartes), 2 px (puces), 6 px (fenêtres). Pas d'ombre sur les cartes : des filets. Bouton flottant rond, seule forme circulaire.

| Token | Valeur |
|---|---|
| `--c-r-control` | 3 px |
| `--c-r-card` | 4 px |
| `--c-r-chip` | 2 px |
| `--c-r-modal` | 6 px |
| `--c-base` (corps) | 14 px |
| `--c-shadow` (clair) | `0 1px 0 rgba(29,24,17,.04)` |
| `--c-menu-shadow` (clair) | `0 14px 36px rgba(29,24,17,.18)` |

## 6. Composants

| Composant | Règle |
|---|---|
| **Navigation latérale** | Papier identique au fond ; libellés de section en serif italique ; élément actif en fiche blanche bordée, liseré vert de 2 px. |
| **Onglets de vues** | Petites capitales espacées ; actif en gras, soulignement vert de 2 px. |
| **Widgets** | Titre en serif 15,5 px ; filet double sous l'en-tête ; actions à 40 % d'opacité. |
| **Indicateurs (KPI)** | Grand chiffre serif en vert forêt, sans cadre. |
| **Puces** | Contour fin dans la teinte de donnée (55 %), fond transparent, texte encre. |
| **Tableaux** | En-têtes en petites capitales, filet double, fond blanc cassé. |
| **Fiche tâche** | Titre serif 22 px ; étiquettes en petites capitales. |

## 7. À faire / à éviter

**À faire**

- Réserver la serif aux titres et aux chiffres clés.
- Utiliser les filets plutôt que les fonds pour séparer.
- Garder le vert pour l'action et la brique pour le signal.

**À éviter**

- Composer du texte courant en serif dans les listes denses.
- Introduire du blanc pur ou du gris froid.
- Multiplier les petites capitales au-delà des étiquettes.

## 8. Limites connues

Les petites capitales réduisent la lisibilité des onglets en très petit corps ; la serif occupe un peu plus de largeur dans les titres de widgets étroits (troncature plus fréquente).

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
2. Ajouter la feuille `nexora-edition.css` **après** les styles existants.
3. Activer : `<html data-charte="edition" data-mode="clair">` (ou `sombre`).

La feuille contient : les tokens `--c-*` et leur câblage sur les tokens existants (`--life-*`, `--bg`, `--surface`, `--ink`…), le remappage généré des couleurs codées en dur de Nexora, le socle commun et la signature de la charte. Elle est régénérée par `node docs/chartes-graphiques/outils/gen.mjs`.
