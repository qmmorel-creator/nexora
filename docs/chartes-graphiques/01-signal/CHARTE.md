# Charte 01 — Signal

> Rigueur suisse : encre, papier, un seul signal rouge.

![Signal — tableau de bord, thème clair](captures/clair-01-dashboard-pilotage.webp)

**Personnalité :** Factuel · Dense · Autoritaire · Sans ornement  
**Thème par défaut :** clair · **Déclinaison :** sombre  
**Fichier :** [`nexora-signal.css`](nexora-signal.css)

## 1. Intention

Le style typographique international appliqué à un outil de pilotage. Tout est noir sur papier ; la couleur appartient aux données (projets, statuts, personnes) et à un seul signal rouge, réservé à ce qui exige l'attention : aujourd'hui, le retard, la création, le focus clavier.

**Pour qui, pour quoi :** Les utilisateurs qui veulent un outil neutre, très dense et sans distraction ; l'impression et l'export PDF (rendu quasi identique en noir et blanc).

## 2. Principes

1. Une seule couleur d'interface : le rouge signal. Le reste est encre, gris et papier.
2. Les filets remplacent les ombres : chaque widget est ouvert par un filet d'encre de 2 px en tête.
3. Les titres de widgets sont des étiquettes : capitales, approche +8 %, graisse 800, largeur 92 %.
4. Les chiffres clés sont des affiches : 46 px, graisse 800, largeur 85 %, sans cadre.
5. Angles droits partout (2 px maximum) : la grille se lit, rien ne flotte.

## 3. Couleurs

Les couleurs de **données** (projets, statuts, personnes, types de tâches) ne sont jamais remplacées : elles appartiennent aux réglages de l'utilisateur. La charte ne fixe que les couleurs d'interface ci-dessous.

### Thème clair

![Palette clair](palette-clair.svg)

### Thème sombre

![Palette sombre](palette-sombre.svg)

| Rôle | Token | Thème clair | Thème sombre |
|---|---|---|---|
| Fond de page | `--c-bg` | `#F1F1EE` | `#0B0B0B` |
| Surface (cartes, fenêtres) | `--c-surface` | `#FFFFFF` | `#151515` |
| Surface douce (en-têtes, survol) | `--c-soft` | `#F6F6F4` | `#1C1C1C` |
| Bordure | `--c-border` | `#DCDCD7` | `#2C2C2C` |
| Bordure forte | `--c-border-strong` | `#B3B3AC` | `#4A4A4A` |
| Encre (texte principal) | `--c-text` | `#111111` | `#F3F3EF` |
| Texte secondaire | `--c-secondary` | `#43434A` | `#BDBDB7` |
| Texte discret | `--c-muted` | `#64646B` | `#8F8F89` |
| Accent (action, sélection) | `--c-accent` | `#111111` | `#F3F3EF` |
| Accent survolé | `--c-accent-hover` | `#333333` | `#FFFFFF` |
| Accent doux (fond sélectionné) | `--c-accent-soft` | `#EAEAE6` | `#262626` |
| Texte sur accent | `--c-on-accent` | `#FFFFFF` | `#0B0B0B` |
| Accent en texte | `--c-accent-text` | `#111111` | `#F3F3EF` |
| Signal (aujourd'hui, alerte) | `--c-signal` | `#E2231A` | `#FF3B30` |
| Succès | `--c-success` | `#14864A` | `#3DBE78` |
| Avertissement | `--c-warning` | `#C98500` | `#F0B429` |
| Danger | `--c-danger` | `#E2231A` | `#FF3B30` |
| Navigation — fond | `--c-sidebar` | `#F1F1EE` | `#0B0B0B` |
| Navigation — texte | `--c-sidebar-text` | `#111111` | `#F3F3EF` |
| Navigation — actif | `--c-sidebar-active` | `#111111` | `#F3F3EF` |
| Info-bulle, aplat d'encre | `--c-tooltip` | `#111111` | `#2A2A2A` |
| Anneau de focus | `--c-focus` | `#E2231A` | `#FF3B30` |
| Sélection de texte | `--c-selection` | `#FFE2DF` | `#5A1814` |

### Contrastes mesurés (WCAG 2.2)

| Couple | Thème clair | Thème sombre |
|---|---|---|
| Encre / surface | 18.88:1 — AAA | 16.42:1 — AAA |
| Encre / fond | 16.69:1 — AAA | 17.69:1 — AAA |
| Secondaire / surface | 9.81:1 — AAA | 9.68:1 — AAA |
| Discret / surface | 5.87:1 — AA | 5.62:1 — AA |
| Discret / fond | 5.19:1 — AA | 6.05:1 — AA |
| Accent en texte / surface | 18.88:1 — AAA | 16.42:1 — AAA |
| Texte sur accent / accent | 18.88:1 — AAA | 17.69:1 — AAA |
| Signal texte / surface | 6.13:1 — AA | 6.55:1 — AA |
| Navigation texte / fond | 16.69:1 — AAA | 17.69:1 — AAA |
| Navigation discret / fond | 5.19:1 — AA | 6.05:1 — AA |
| Navigation active | 18.88:1 — AAA | 17.69:1 — AAA |
| Bordure / surface (composant, seuil 3:1) | 1.38:1 — décorative, doublée par l'écart de surface | 1.31:1 — décorative, doublée par l'écart de surface |
| Statuts en texte (succès / avert. / danger, ajustés auto.) | 5.2 / 5.2 / 5.3 :1 | 7.7 / 9.8 / 5.1 :1 |

## 4. Typographie

| Famille | Usage | Raison |
|---|---|---|
| Archivo (variable, axe de largeur 62–125) | Texte, titres, chiffres | Grotesque néo-suisse ; l'axe de largeur permet des titres serrés sans changer de famille. |
| JetBrains Mono | Dates, colonnes numériques du tableur, champs du Mini-Gantt | Chiffres à chasse fixe : les colonnes s'alignent. |

Chargement : `https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..125,400..800&family=JetBrains+Mono:wght@400;500;600&display=swap` — chiffres tabulaires (`tabular-nums`) conservés partout.

| Niveau | Réglage |
|---|---|
| Titre de page | 24 px / 800 / -3,5 % / largeur 88 % |
| Titre de widget | 11,5 px / 800 / capitales / +8 % |
| Chiffre clé | 46 px / 800 / -5 % / largeur 85 % |
| Corps | 13,5 px / 400–600 |
| Libellés de section | 10,5 px / 700 / capitales / +9 % |
| Dates | 11 px mono |

## 5. Formes, bordures, profondeur

Rayons 2 px (commandes, cartes) et 0 px (puces, navigation, bouton flottant). Aucune ombre au repos ; les menus ont un contour d'encre de 1 px et une ombre portée nette. Bordures 1 px.

| Token | Valeur |
|---|---|
| `--c-r-control` | 2 px |
| `--c-r-card` | 2 px |
| `--c-r-chip` | 0 px |
| `--c-r-modal` | 3 px |
| `--c-base` (corps) | 13.5 px |
| `--c-shadow` (clair) | `none` |
| `--c-menu-shadow` (clair) | `0 0 0 1px #111111, 0 12px 28px rgba(0,0,0,.14)` |

## 6. Composants

| Composant | Règle |
|---|---|
| **Navigation latérale** | Fond papier identique au fond de page, sans séparation. Élément actif en aplat d'encre plein, texte blanc, sans arrondi. Libellés de section en petites capitales espacées. |
| **Onglets de vues** | Texte 12,5 px ; l'onglet actif passe en graisse 800 et reçoit un soulignement d'encre de 3 px. |
| **Boutons** | Principal : aplat d'encre, texte blanc. Secondaire : contour 1 px, fond blanc. Bouton flottant « + » : carré rouge signal, seul aplat rouge de l'écran. |
| **Widgets** | Filet d'encre de 2 px en tête, pas de séparateur sous l'en-tête. Les 5 actions (style, impression, duplication, réglages, suppression) n'apparaissent qu'au survol ou au focus clavier. |
| **Indicateurs (KPI)** | Le double cadre actuel disparaît : le chiffre est posé directement sur la carte. |
| **Puces (statut, projet, personne)** | Fond transparent, texte encre, barre verticale de 3 px dans la couleur de donnée. La couleur reste lisible même pour les teintes claires (orange, cyan) qui échouaient en texte. |
| **Tableaux** | En-têtes en capitales 10,5 px sur fond blanc, filet d'encre de 2 px sous l'en-tête ; colonnes de dates en chasse fixe. |
| **Fiche tâche (fenêtre)** | Contour d'encre de 1 px, titre 20 px / 800, étiquettes de champs en capitales espacées. |

## 7. À faire / à éviter

**À faire**

- Réserver le rouge au signal : aujourd'hui, retard, création, focus.
- Aligner sur la grille : les filets de tête doivent former une ligne continue d'une carte à l'autre.
- Écrire les titres de widgets courts (2 à 3 mots) : ils passent en capitales.

**À éviter**

- Ajouter une deuxième couleur d'interface (bleu de lien, vert de validation hors statut).
- Arrondir un composant isolé.
- Utiliser le rouge pour décorer un projet : c'est une couleur de donnée possible, mais elle concurrence alors le signal.

## 8. Limites connues

La sobriété extrême rend l'interface austère pour un usage personnel ; l'absence d'ombre impose des bordures nettes partout. En thème sombre, l'accent devient blanc : les boutons principaux sont blancs à texte noir.

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
2. Ajouter la feuille `nexora-signal.css` **après** les styles existants.
3. Activer : `<html data-charte="signal" data-mode="clair">` (ou `sombre`).

La feuille contient : les tokens `--c-*` et leur câblage sur les tokens existants (`--life-*`, `--bg`, `--surface`, `--ink`…), le remappage généré des couleurs codées en dur de Nexora, le socle commun et la signature de la charte. Elle est régénérée par `node docs/chartes-graphiques/outils/gen.mjs`.
