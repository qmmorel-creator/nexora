# Charte 05 — Dessau

> Le Bauhaus tempéré : papier, filets d'encre, ocre, brique et ardoise, la Futura de Jost, un cercle pour l'action.

![Dessau — tableau de bord, thème clair](captures/clair-01-dashboard-pilotage.webp)

**Personnalité :** Chaleureux · Géométrique · Mesuré · Élégant  
**Thème par défaut :** clair · **Déclinaison :** sombre  
**Fichier :** [`nexora-dessau.css`](nexora-dessau.css)

## 1. Intention

*Variante de la famille Bauhaus : les couleurs plus terreuses de l'école de Dessau (1925–1932).*

Le Bauhaus apaisé : même géométrie que la charte 01, mais ocre, brique et ardoise au lieu des primaires pures, filets de 1,5 px au lieu de 2, Jost (une Futura) au lieu d'Outfit, et le cercle comme forme d'action.

**Pour qui, pour quoi :** Ceux qui aiment l'esprit Bauhaus mais veulent un rendu plus doux pour un usage de toute la journée.

## 2. Principes

1. Trois teintes terreuses, trois rôles : ocre = sélection et présent, ardoise = action et structure, brique = alerte.
2. Filets d'encre de 1,5 px : la structure reste visible sans peser.
3. Les indicateurs sont des tuiles ocre, brique, ardoise puis papier.
4. Le cercle signale l'action : bouton de création rond, puces en pilules.
5. Jost en graisses moyennes (500) : géométrie sans dureté.

## 3. Couleurs

Les couleurs de **données** (projets, statuts, personnes, types de tâches) ne sont jamais remplacées : elles appartiennent aux réglages de l'utilisateur. La charte ne fixe que les couleurs d'interface ci-dessous.

### Thème clair

![Palette clair](palette-clair.svg)

### Thème sombre

![Palette sombre](palette-sombre.svg)

| Rôle | Token | Thème clair | Thème sombre |
|---|---|---|---|
| Fond de page | `--c-bg` | `#ECE6DA` | `#191714` |
| Surface (cartes, fenêtres) | `--c-surface` | `#FAF7F0` | `#221F1B` |
| Surface douce (en-têtes, survol) | `--c-soft` | `#F2EDE3` | `#2A2621` |
| Bordure | `--c-border` | `#D5CBB8` | `#3B362F` |
| Bordure forte | `--c-border-strong` | `#3A3631` | `#D8D0C2` |
| Encre (texte principal) | `--c-text` | `#23201C` | `#EEE7DA` |
| Texte secondaire | `--c-secondary` | `#4A443C` | `#C5BCAD` |
| Texte discret | `--c-muted` | `#665E53` | `#9C9384` |
| Accent (action, sélection) | `--c-accent` | `#34506E` | `#7FA0C4` |
| Accent survolé | `--c-accent-hover` | `#273E57` | `#9BB6D3` |
| Accent doux (fond sélectionné) | `--c-accent-soft` | `#DDE5EE` | `#22303F` |
| Texte sur accent | `--c-on-accent` | `#FFFFFF` | `#191714` |
| Accent en texte | `--c-accent-text` | `#34506E` | `#8EACCD` |
| Signal (aujourd'hui, alerte) | `--c-signal` | `#B5462E` | `#D9694F` |
| Succès | `--c-success` | `#4E7A45` | `#8DBE7F` |
| Avertissement | `--c-warning` | `#9A6A1C` | `#DDB066` |
| Danger | `--c-danger` | `#B5462E` | `#D9694F` |
| Navigation — fond | `--c-sidebar` | `#ECE6DA` | `#191714` |
| Navigation — texte | `--c-sidebar-text` | `#23201C` | `#EEE7DA` |
| Navigation — actif | `--c-sidebar-active` | `#C9922E` | `#C9922E` |
| Info-bulle, aplat d'encre | `--c-tooltip` | `#23201C` | `#2E2A24` |
| Anneau de focus | `--c-focus` | `#C9922E` | `#DDB066` |
| Sélection de texte | `--c-selection` | `#F1DDB0` | `#4A3A18` |
| Aplat propre à la charte : ocre | `--c-ocre` | `#C9922E` | `#D7A445` |
| Aplat propre à la charte : on-ocre | `--c-on-ocre` | `#23201C` | `#191714` |
| Aplat propre à la charte : brique | `--c-brique` | `#B5462E` | `#B84A33` |
| Aplat propre à la charte : on-brique | `--c-on-brique` | `#FFFFFF` | `#FFFFFF` |
| Aplat propre à la charte : ardoise | `--c-ardoise` | `#34506E` | `#4A6A8F` |
| Aplat propre à la charte : on-ardoise | `--c-on-ardoise` | `#FFFFFF` | `#FFFFFF` |
| Aplat propre à la charte : frame | `--c-frame` | `#3A3631` | `#D8D0C2` |

**Aplats et texte posé dessus :** thème clair : ocre 5.9:1, brique 5.4:1, ardoise 8.3:1 · thème sombre : ocre 7.9:1, brique 5.2:1, ardoise 5.6:1.

### Contrastes mesurés (WCAG 2.2)

| Couple | Thème clair | Thème sombre |
|---|---|---|
| Encre / surface | 15.16:1 — AAA | 13.34:1 — AAA |
| Encre / fond | 13.05:1 — AAA | 14.55:1 — AAA |
| Secondaire / surface | 8.99:1 — AAA | 8.73:1 — AAA |
| Discret / surface | 5.96:1 — AA | 5.41:1 — AA |
| Discret / fond | 5.13:1 — AA | 5.89:1 — AA |
| Accent en texte / surface | 7.79:1 — AAA | 6.98:1 — AA |
| Texte sur accent / accent | 8.34:1 — AAA | 6.58:1 — AA |
| Signal texte / surface | 6.40:1 — AA | 6.11:1 — AA |
| Navigation texte / fond | 13.05:1 — AAA | 14.55:1 — AAA |
| Navigation discret / fond | 5.13:1 — AA | 5.89:1 — AA |
| Navigation active | 5.90:1 — AA | 6.50:1 — AA |
| Bordure / surface (composant, seuil 3:1) | 1.50:1 — décorative, doublée par l'écart de surface | 1.37:1 — décorative, doublée par l'écart de surface |
| Statuts en texte (succès / avert. / danger, ajustés auto.) | 5.3 / 5.2 / 5.3 :1 | 7.7 / 8.2 / 4.8 :1 |

## 4. Typographie

| Famille | Usage | Raison |
|---|---|---|
| Jost | Tout | Réinterprétation libre de Futura, la police emblématique du Bauhaus de Dessau. |
| JetBrains Mono | Code | — |

Chargement : `https://fonts.googleapis.com/css2?family=Jost:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap` — chiffres tabulaires (`tabular-nums`) conservés partout.

| Niveau | Réglage |
|---|---|
| Titre de page | 25 px / 500 |
| Titre de widget | 15,5 px / 500 |
| Chiffre clé | 44 px / 500 |
| Corps | 14,5 px |
| Sections de navigation | 11 px / 500 / capitales / +14 % |

## 5. Formes, bordures, profondeur

Rayon 2 px (commandes, cartes), pilules pour les puces, cercle pour le bouton de création. Filets de 1,5 px. Ombre pleine décalée de 4 px pour menus, fenêtres et bouton de création.

| Token | Valeur |
|---|---|
| `--c-r-control` | 2 px |
| `--c-r-card` | 2 px |
| `--c-r-chip` | 999 px |
| `--c-r-modal` | 3 px |
| `--c-base` (corps) | 14.5 px |
| `--c-shadow` (clair) | `none` |
| `--c-menu-shadow` (clair) | `0 0 0 1.5px #3A3631, 4px 4px 0 1.5px #3A3631` |

## 6. Composants

| Composant | Règle |
|---|---|
| **Navigation latérale** | Papier, filet de 1,5 px ; élément actif en aplat ocre. |
| **Onglets de vues** | Soulignement ocre de 3 px. |
| **Widgets** | Filet d'encre 1,5 px, titre 15,5 px / 500, actions estompées. |
| **Indicateurs (KPI)** | Tuiles ocre (texte encre), brique et ardoise (texte blanc), papier. |
| **Tableaux** | En-tête ardoise, capitales blanches espacées. |
| **Puces** | Pilules teintées, texte dans la teinte assombrie. |
| **Aujourd'hui** | Fil brique. |
| **Fiche tâche** | Filet 1,5 px, ombre pleine décalée. |

## 7. À faire / à éviter

**À faire**

- Garder l'ordre ocre, brique, ardoise.
- Préférer le cercle pour toute action isolée.

**À éviter**

- Revenir aux primaires pures (c'est la charte 01).
- Épaissir les filets au-delà de 1,5 px.

## 8. Limites connues

Comme Bauhaus, les tuiles colorées dépendent de l'ordre des indicateurs dans le tableau de bord.

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
2. Ajouter la feuille `nexora-dessau.css` **après** les styles existants.
3. Activer : `<html data-charte="dessau" data-mode="clair">` (ou `sombre`).

La feuille contient : les tokens `--c-*` et leur câblage sur les tokens existants (`--life-*`, `--bg`, `--surface`, `--ink`…), le remappage généré des couleurs codées en dur de Nexora, le socle commun et la signature de la charte. Elle est régénérée par `node docs/chartes-graphiques/outils/gen.mjs`.
