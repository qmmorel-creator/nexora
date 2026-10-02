# Charte 04 — Constructiviste

> Affiche de Rodtchenko : crème, noir et un rouge, titres condensés en capitales, bandeaux d'encre et diagonales.

![Constructiviste — tableau de bord, thème clair](captures/clair-01-dashboard-pilotage.webp)

**Personnalité :** Énergique · Militant · Dense · Typographique  
**Thème par défaut :** clair · **Déclinaison :** sombre  
**Fichier :** [`nexora-constructiviste.css`](nexora-constructiviste.css)

## 1. Intention

*Variante de la famille Bauhaus : le constructivisme russe (Rodtchenko, Lissitzky), contemporain du Bauhaus.*

Une affiche de propagande mise au service de l'efficacité : papier crème, noir et un seul rouge, titres condensés en capitales, en-têtes de widgets en bandeaux d'encre amorcés par une diagonale rouge, navigation noire.

**Pour qui, pour quoi :** Ceux qui veulent une interface qui pousse à l'action ; tableaux de bord de suivi d'exécution.

## 2. Principes

1. Un seul rouge, beaucoup de noir, fond crème.
2. Chaque widget est coiffé d'un bandeau noir (rouge en sombre) et d'une diagonale rouge.
3. Titres en Oswald condensé, capitales : on lit plus de mots par ligne.
4. Angles droits partout : commandes, cartes, puces, fenêtres, menus (rayon 0).
5. Les indicateurs sont des chiffres d'affiche de 58 px, rouges en alternance.

## 3. Couleurs

Les couleurs de **données** (projets, statuts, personnes, types de tâches) ne sont jamais remplacées : elles appartiennent aux réglages de l'utilisateur. La charte ne fixe que les couleurs d'interface ci-dessous.

### Thème clair

![Palette clair](palette-clair.svg)

### Thème sombre

![Palette sombre](palette-sombre.svg)

| Rôle | Token | Thème clair | Thème sombre |
|---|---|---|---|
| Fond de page | `--c-bg` | `#EDE4CF` | `#110F0D` |
| Surface (cartes, fenêtres) | `--c-surface` | `#FBF6EA` | `#1C1915` |
| Surface douce (en-têtes, survol) | `--c-soft` | `#F3EBD8` | `#24201B` |
| Bordure | `--c-border` | `#D8CBB0` | `#3A342C` |
| Bordure forte | `--c-border-strong` | `#111111` | `#EDE4CF` |
| Encre (texte principal) | `--c-text` | `#111111` | `#EDE4CF` |
| Texte secondaire | `--c-secondary` | `#3D382E` | `#C7BDA8` |
| Texte discret | `--c-muted` | `#5A5345` | `#9C9381` |
| Accent (action, sélection) | `--c-accent` | `#C8102E` | `#D42A35` |
| Accent survolé | `--c-accent-hover` | `#A00C24` | `#E04A54` |
| Accent doux (fond sélectionné) | `--c-accent-soft` | `#F6D9D2` | `#3A1416` |
| Texte sur accent | `--c-on-accent` | `#FFFFFF` | `#FFFFFF` |
| Accent en texte | `--c-accent-text` | `#B00E28` | `#F06A72` |
| Signal (aujourd'hui, alerte) | `--c-signal` | `#C8102E` | `#E2343F` |
| Succès | `--c-success` | `#2F6B3C` | `#6DBF83` |
| Avertissement | `--c-warning` | `#8E6210` | `#E0B45C` |
| Danger | `--c-danger` | `#C8102E` | `#F06A72` |
| Navigation — fond | `--c-sidebar` | `#111111` | `#000000` |
| Navigation — texte | `--c-sidebar-text` | `#EDE4CF` | `#EDE4CF` |
| Navigation — actif | `--c-sidebar-active` | `#C8102E` | `#D42A35` |
| Info-bulle, aplat d'encre | `--c-tooltip` | `#111111` | `#2A251F` |
| Anneau de focus | `--c-focus` | `#C8102E` | `#E2343F` |
| Sélection de texte | `--c-selection` | `#F2B8AE` | `#5A1A1E` |
| Aplat propre à la charte : band | `--c-band` | `#111111` | `#D42A35` |
| Aplat propre à la charte : on-band | `--c-on-band` | `#EDE4CF` | `#FFFFFF` |

**Aplats et texte posé dessus :** thème clair : band 14.9:1 · thème sombre : band 5.0:1.

### Contrastes mesurés (WCAG 2.2)

| Couple | Thème clair | Thème sombre |
|---|---|---|
| Encre / surface | 17.51:1 — AAA | 13.84:1 — AAA |
| Encre / fond | 14.93:1 — AAA | 15.12:1 — AAA |
| Secondaire / surface | 10.80:1 — AAA | 9.40:1 — AAA |
| Discret / surface | 7.06:1 — AAA | 5.76:1 — AA |
| Discret / fond | 6.02:1 — AA | 6.29:1 — AA |
| Accent en texte / surface | 6.62:1 — AA | 5.84:1 — AA |
| Texte sur accent / accent | 5.88:1 — AA | 5.02:1 — AA |
| Signal texte / surface | 7.57:1 — AAA | 5.84:1 — AA |
| Navigation texte / fond | 14.93:1 — AAA | 16.60:1 — AAA |
| Navigation discret / fond | 7.63:1 — AAA | 6.90:1 — AA |
| Navigation active | 5.88:1 — AA | 5.02:1 — AA |
| Bordure / surface (composant, seuil 3:1) | 1.49:1 — décorative, doublée par l'écart de surface | 1.42:1 — décorative, doublée par l'écart de surface |
| Statuts en texte (succès / avert. / danger, ajustés auto.) | 5.9 / 5.4 / 5.5 :1 | 7.9 / 9.0 / 5.8 :1 |

## 4. Typographie

| Famille | Usage | Raison |
|---|---|---|
| Oswald | Titres, onglets, en-têtes de tableaux, étiquettes | Condensée et haute, en capitales : l'affiche constructiviste. |
| Archivo | Texte courant, commandes | Grotesque robuste, lisible en petit. |

Chargement : `https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Archivo:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap` — chiffres tabulaires (`tabular-nums`) conservés partout.

| Niveau | Réglage |
|---|---|
| Titre de page | 30 px / 700 / capitales |
| Titre de widget | 16 px / 600 / capitales / +5 % |
| Chiffre clé | 58 px / 700 |
| Corps | 14 px |
| Onglets | 14,5 px Oswald / capitales ; actif en aplat rouge |

## 5. Formes, bordures, profondeur

Rayon 0. Cadres de 2 px (widgets), 3 px (fenêtres, barres). Diagonale rouge en tête de chaque widget ; bouton de création à coin coupé. Ombre pleine rouge décalée pour menus et fenêtres.

| Token | Valeur |
|---|---|
| `--c-r-control` | 0 px |
| `--c-r-card` | 0 px |
| `--c-r-chip` | 0 px |
| `--c-r-modal` | 0 px |
| `--c-base` (corps) | 14 px |
| `--c-shadow` (clair) | `none` |
| `--c-menu-shadow` (clair) | `0 0 0 3px #111111, 7px 7px 0 3px #C8102E` |

## 6. Composants

| Composant | Règle |
|---|---|
| **Navigation latérale** | Noire, texte crème, sections en Oswald rouge ; élément actif en aplat rouge. |
| **Barre supérieure** | Titre en capitales condensées 30 px ; commandes en capitales 10,5 px. |
| **Onglets de vues** | Oswald capitales ; actif en aplat rouge. |
| **Widgets** | Cadre 2 px ; en-tête en bandeau noir, titre crème en capitales, diagonale rouge à gauche. |
| **Indicateurs (KPI)** | Chiffres de 58 px ; 1er et 3e en rouge. |
| **Tableaux** | En-tête noir, Oswald capitales crème. |
| **Puces** | Barre de 4 px dans la couleur de donnée, texte encre en capitales 10,5 px. |
| **Fiche tâche** | Bandeau de titre noir, cadre 3 px, ombre rouge. |

## 7. À faire / à éviter

**À faire**

- Écrire des titres courts : ils passent en capitales condensées.
- Garder le rouge pour l'action, l'actif et aujourd'hui.

**À éviter**

- Ajouter une deuxième couleur vive.
- Mettre du texte courant en Oswald.

## 8. Limites connues

Les capitales réduisent un peu la vitesse de lecture des noms de personnes et de projets dans les puces ; la page est visuellement chargée.

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
2. Ajouter la feuille `nexora-constructiviste.css` **après** les styles existants.
3. Activer : `<html data-charte="constructiviste" data-mode="clair">` (ou `sombre`).

La feuille contient : les tokens `--c-*` et leur câblage sur les tokens existants (`--life-*`, `--bg`, `--surface`, `--ink`…), le remappage généré des couleurs codées en dur de Nexora, le socle commun et la signature de la charte. Elle est régénérée par `node docs/chartes-graphiques/outils/gen.mjs`.
