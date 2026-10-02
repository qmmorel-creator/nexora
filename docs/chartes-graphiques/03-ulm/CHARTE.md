# Charte 03 — Ulm

> Fonctionnalisme Braun : gris chaud, noir, un seul orange, coins doux et cercles d'appareil.

![Ulm — tableau de bord, thème clair](captures/clair-01-dashboard-pilotage.webp)

**Personnalité :** Calme · Précis · Fonctionnel · Discret  
**Thème par défaut :** clair · **Déclinaison :** sombre  
**Fichier :** [`nexora-ulm.css`](nexora-ulm.css)

## 1. Intention

*Variante de la famille Bauhaus : l'école d'Ulm et les appareils Braun de Dieter Rams, héritiers directs du Bauhaus.*

Un appareil plutôt qu'une affiche : gris chaud, noir, un seul orange (le bouton de création, aujourd'hui), coins doux, commandes en pilules, chiffres fins comme sur un afficheur. La charte la plus calme de la famille, pensée pour les longues journées.

**Pour qui, pour quoi :** Le travail quotidien long ; c'est la variante la moins fatigante et la plus proche d'un outil professionnel classique.

## 2. Principes

1. Moins, mais mieux : une seule couleur, l'orange, pour ce qui doit être trouvé tout de suite.
2. Les étiquettes sont des sérigraphies : capitales espacées, petites, grises.
3. Les commandes sont des touches : pilules arrondies, fond gris, sans bordure.
4. Chiffres clés en graisse fine (300), comme un cadran.
5. Le bouton de création est un cercle orange.

## 3. Couleurs

Les couleurs de **données** (projets, statuts, personnes, types de tâches) ne sont jamais remplacées : elles appartiennent aux réglages de l'utilisateur. La charte ne fixe que les couleurs d'interface ci-dessous.

### Thème clair

![Palette clair](palette-clair.svg)

### Thème sombre

![Palette sombre](palette-sombre.svg)

| Rôle | Token | Thème clair | Thème sombre |
|---|---|---|---|
| Fond de page | `--c-bg` | `#E8E7E3` | `#161616` |
| Surface (cartes, fenêtres) | `--c-surface` | `#F8F7F4` | `#1F1F1F` |
| Surface douce (en-têtes, survol) | `--c-soft` | `#EFEEEA` | `#262626` |
| Bordure | `--c-border` | `#D2D0CA` | `#333333` |
| Bordure forte | `--c-border-strong` | `#9C9A93` | `#555555` |
| Encre (texte principal) | `--c-text` | `#1B1B1B` | `#EDECE8` |
| Texte secondaire | `--c-secondary` | `#44433E` | `#B9B7B1` |
| Texte discret | `--c-muted` | `#5F5D57` | `#8E8C86` |
| Accent (action, sélection) | `--c-accent` | `#1B1B1B` | `#EDECE8` |
| Accent survolé | `--c-accent-hover` | `#3A3A3A` | `#FFFFFF` |
| Accent doux (fond sélectionné) | `--c-accent-soft` | `#E0DED8` | `#2C2C2C` |
| Texte sur accent | `--c-on-accent` | `#F8F7F4` | `#161616` |
| Accent en texte | `--c-accent-text` | `#1B1B1B` | `#EDECE8` |
| Signal (aujourd'hui, alerte) | `--c-signal` | `#E8590C` | `#FF7A2E` |
| Succès | `--c-success` | `#2E7D4F` | `#5CC08A` |
| Avertissement | `--c-warning` | `#A86E14` | `#E5A93F` |
| Danger | `--c-danger` | `#C7362B` | `#F06A5E` |
| Navigation — fond | `--c-sidebar` | `#DCDAD5` | `#111111` |
| Navigation — texte | `--c-sidebar-text` | `#1B1B1B` | `#EDECE8` |
| Navigation — actif | `--c-sidebar-active` | `#F8F7F4` | `#2A2A2A` |
| Info-bulle, aplat d'encre | `--c-tooltip` | `#1B1B1B` | `#2E2E2E` |
| Anneau de focus | `--c-focus` | `#E8590C` | `#FF7A2E` |
| Sélection de texte | `--c-selection` | `#FFD8BF` | `#5A2A0E` |
| Aplat propre à la charte : orange | `--c-orange` | `#E8590C` | `#FF7A2E` |
| Aplat propre à la charte : on-orange | `--c-on-orange` | `#1B1B1B` | `#161616` |

**Aplats et texte posé dessus :** thème clair : orange 4.8:1 · thème sombre : orange 7.0:1.

### Contrastes mesurés (WCAG 2.2)

| Couple | Thème clair | Thème sombre |
|---|---|---|
| Encre / surface | 16.08:1 — AAA | 13.94:1 — AAA |
| Encre / fond | 13.92:1 — AAA | 15.31:1 — AAA |
| Secondaire / surface | 9.25:1 — AAA | 8.22:1 — AAA |
| Discret / surface | 6.14:1 — AA | 4.90:1 — AA |
| Discret / fond | 5.32:1 — AA | 5.38:1 — AA |
| Accent en texte / surface | 16.08:1 — AAA | 13.94:1 — AAA |
| Texte sur accent / accent | 16.08:1 — AAA | 15.31:1 — AAA |
| Signal texte / surface | 5.40:1 — AA | 7.55:1 — AAA |
| Navigation texte / fond | 12.33:1 — AAA | 15.97:1 — AAA |
| Navigation discret / fond | 5.42:1 — AA | 5.62:1 — AA |
| Navigation active | 16.08:1 — AAA | 14.35:1 — AAA |
| Bordure / surface (composant, seuil 3:1) | 1.44:1 — décorative, doublée par l'écart de surface | 1.30:1 — décorative, doublée par l'écart de surface |
| Statuts en texte (succès / avert. / danger, ajustés auto.) | 5.4 / 5.4 / 5.4 :1 | 7.3 / 7.9 / 5.4 :1 |

## 4. Typographie

| Famille | Usage | Raison |
|---|---|---|
| Hanken Grotesk | Tout | Grotesque neutre, graisses fines disponibles pour les cadrans. |
| JetBrains Mono | Code | — |

Chargement : `https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap` — chiffres tabulaires (`tabular-nums`) conservés partout.

| Niveau | Réglage |
|---|---|
| Titre de page | 22 px / 500 |
| Titre de widget | 11,5 px / 600 / capitales / +10 %, gris |
| Chiffre clé | 44 px / 300 |
| Corps | 14 px |
| Onglets | 13 px / 500, pilule noire pour l'actif |

## 5. Formes, bordures, profondeur

Rayons 6 px (champs), 12 px (cartes), 14 px (fenêtres), pilules pour les commandes, onglets et puces, cercle pour le bouton de création. Ombres très douces.

| Token | Valeur |
|---|---|
| `--c-r-control` | 6 px |
| `--c-r-card` | 12 px |
| `--c-r-chip` | 999 px |
| `--c-r-modal` | 14 px |
| `--c-base` (corps) | 14 px |
| `--c-shadow` (clair) | `0 1px 0 rgba(0,0,0,.04), 0 2px 8px rgba(0,0,0,.06)` |
| `--c-menu-shadow` (clair) | `0 12px 32px rgba(0,0,0,.18)` |

## 6. Composants

| Composant | Règle |
|---|---|
| **Navigation latérale** | Panneau gris plus soutenu ; élément actif en carte claire légèrement relevée. |
| **Barre supérieure** | Commandes en pilules grises sans bordure. |
| **Onglets de vues** | Pilules ; l'onglet actif est une pilule noire (blanche en sombre). |
| **Widgets** | Cartes à coins doux, sans séparateur d'en-tête ; titre en petites capitales grises ; actions estompées. |
| **Indicateurs (KPI)** | Chiffres fins de 44 px ; le 2e indicateur (en retard) en orange. |
| **Tableaux** | En-tête gris doux, capitales 10,5 px espacées. |
| **Puces** | Pilules teintées, texte dans la teinte assombrie. |
| **Fiche tâche** | Champs sur fond gris sans bordure, coins 8 px. |

## 7. À faire / à éviter

**À faire**

- Réserver l'orange au bouton de création, à aujourd'hui et au retard.
- Garder les commandes sans bordure.

**À éviter**

- Ajouter une deuxième couleur vive.
- Mettre des titres en gras lourd.

## 8. Limites connues

Moins d'impact visuel que Bauhaus ou De Stijl ; les indicateurs ne sont pas des aplats colorés.

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
2. Ajouter la feuille `nexora-ulm.css` **après** les styles existants.
3. Activer : `<html data-charte="ulm" data-mode="clair">` (ou `sombre`).

La feuille contient : les tokens `--c-*` et leur câblage sur les tokens existants (`--life-*`, `--bg`, `--surface`, `--ink`…), le remappage généré des couleurs codées en dur de Nexora, le socle commun et la signature de la charte. Elle est régénérée par `node docs/chartes-graphiques/outils/gen.mjs`.
