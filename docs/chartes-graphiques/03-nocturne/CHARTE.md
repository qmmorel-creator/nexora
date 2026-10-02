# Charte 03 — Nocturne

> Console de pilotage : sombre par défaut, violet électrique, profondeur par paliers de surface.

![Nocturne — tableau de bord, thème sombre](captures/sombre-01-dashboard-pilotage.webp)

**Personnalité :** Concentré · Moderne · Silencieux · Technologique  
**Thème par défaut :** sombre · **Déclinaison :** clair  
**Fichier :** [`nexora-nocturne.css`](nexora-nocturne.css)

## 1. Intention

Une console de pilotage pensée d'abord pour le sombre : profondeur par paliers de surface plutôt que par ombres, violet électrique pour l'action, ambre pour le temps. La barre d'outils s'efface : les commandes n'ont ni fond ni bordure tant qu'on ne les survole pas.

**Pour qui, pour quoi :** Les sessions longues, en soirée ou en environnement peu éclairé ; les écrans OLED ; l'usage en salle de réunion projetée (thème clair).

## 2. Principes

1. Sombre par défaut, clair en déclinaison ; les deux partagent les mêmes paliers.
2. Quatre paliers : fond, surface, surface douce, bordure ; aucune ombre décorative.
3. Le chrome s'efface : boutons de barre d'outils fantômes, titres de widgets en gris secondaire, actions masquées hors survol.
4. Une trame de points (22 px) sous les tableaux de bord rappelle la grille de placement.
5. Le violet signale l'action, l'ambre le temps (aujourd'hui), les couleurs de données restent intactes.

## 3. Couleurs

Les couleurs de **données** (projets, statuts, personnes, types de tâches) ne sont jamais remplacées : elles appartiennent aux réglages de l'utilisateur. La charte ne fixe que les couleurs d'interface ci-dessous.

### Thème sombre

![Palette sombre](palette-sombre.svg)

### Thème clair

![Palette clair](palette-clair.svg)

| Rôle | Token | Thème sombre | Thème clair |
|---|---|---|---|
| Fond de page | `--c-bg` | `#0A0B0F` | `#F4F4F6` |
| Surface (cartes, fenêtres) | `--c-surface` | `#121318` | `#FFFFFF` |
| Surface douce (en-têtes, survol) | `--c-soft` | `#181A20` | `#F8F8FA` |
| Bordure | `--c-border` | `#22252D` | `#E2E3E8` |
| Bordure forte | `--c-border-strong` | `#333743` | `#C4C6CF` |
| Encre (texte principal) | `--c-text` | `#ECEDF1` | `#14151A` |
| Texte secondaire | `--c-secondary` | `#A2A7B4` | `#4E515C` |
| Texte discret | `--c-muted` | `#7B808D` | `#696C77` |
| Accent (action, sélection) | `--c-accent` | `#6A5AE0` | `#5A4AD6` |
| Accent survolé | `--c-accent-hover` | `#7E70F0` | `#4939BE` |
| Accent doux (fond sélectionné) | `--c-accent-soft` | `#1E1B3B` | `#EDEBFC` |
| Texte sur accent | `--c-on-accent` | `#FFFFFF` | `#FFFFFF` |
| Accent en texte | `--c-accent-text` | `#ABA2FF` | `#5040C8` |
| Signal (aujourd'hui, alerte) | `--c-signal` | `#F5A524` | `#C77700` |
| Succès | `--c-success` | `#3FC98A` | `#14875A` |
| Avertissement | `--c-warning` | `#F5A524` | `#C77700` |
| Danger | `--c-danger` | `#F0616D` | `#D63B4A` |
| Navigation — fond | `--c-sidebar` | `#0A0B0F` | `#FBFBFC` |
| Navigation — texte | `--c-sidebar-text` | `#D9DBE2` | `#14151A` |
| Navigation — actif | `--c-sidebar-active` | `#1B1D24` | `#EDEBFC` |
| Info-bulle, aplat d'encre | `--c-tooltip` | `#24262E` | `#14151A` |
| Anneau de focus | `--c-focus` | `#9A8CFF` | `#5A4AD6` |
| Sélection de texte | `--c-selection` | `#3A3270` | `#DCD7FB` |

### Contrastes mesurés (WCAG 2.2)

| Couple | Thème sombre | Thème clair |
|---|---|---|
| Encre / surface | 15.86:1 — AAA | 18.23:1 — AAA |
| Encre / fond | 16.81:1 — AAA | 16.60:1 — AAA |
| Secondaire / surface | 7.71:1 — AAA | 7.91:1 — AAA |
| Discret / surface | 4.69:1 — AA | 5.23:1 — AA |
| Discret / fond | 4.98:1 — AA | 4.77:1 — AA |
| Accent en texte / surface | 8.25:1 — AAA | 7.22:1 — AAA |
| Texte sur accent / accent | 5.06:1 — AA | 6.20:1 — AA |
| Signal texte / surface | 10.62:1 — AAA | 5.38:1 — AA |
| Navigation texte / fond | 14.22:1 — AAA | 17.63:1 — AAA |
| Navigation discret / fond | 4.98:1 — AA | 5.06:1 — AA |
| Navigation active | 16.83:1 — AAA | 7.85:1 — AAA |
| Bordure / surface (composant, seuil 3:1) | 1.21:1 — décorative, doublée par l'écart de surface | 1.28:1 — décorative, doublée par l'écart de surface |
| Statuts en texte (succès / avert. / danger, ajustés auto.) | 8.8 / 9.1 / 5.9 :1 | 5.1 / 5.0 / 5.0 :1 |

## 4. Typographie

| Famille | Usage | Raison |
|---|---|---|
| Geist | Texte et titres | Grotesque géométrique moderne, aperture large, excellente en 13 px sur fond sombre. |
| Geist Mono | Dates, compteurs, colonnes numériques | Même dessin que Geist, chasse fixe. |

Chargement : `https://fonts.googleapis.com/css2?family=Geist:wght@400..700&family=Geist+Mono:wght@400..600&display=swap` — chiffres tabulaires (`tabular-nums`) conservés partout.

| Niveau | Réglage |
|---|---|
| Titre de page | 19 px / 600 / -2,5 % |
| Titre de widget | 13 px / 600, gris secondaire |
| Chiffre clé | 38 px / 600 / -4,5 % |
| Corps | 13 px / 400–500 |
| Libellés de navigation | 11 px / 500 |

## 5. Formes, bordures, profondeur

Rayons 7 px (commandes), 11 px (cartes), 6 px (puces), 14 px (fenêtres). Pas d'ombre au repos ; menus et fenêtres : contour 1 px et ombre profonde. Le bouton flottant diffuse un halo violet.

| Token | Valeur |
|---|---|
| `--c-r-control` | 7 px |
| `--c-r-card` | 11 px |
| `--c-r-chip` | 6 px |
| `--c-r-modal` | 14 px |
| `--c-base` (corps) | 13 px |
| `--c-shadow` (sombre) | `0 0 0 1px rgba(255,255,255,.02) inset, 0 8px 24px rgba(0,0,0,.35)` |
| `--c-menu-shadow` (sombre) | `0 0 0 1px #2C2F38, 0 24px 56px rgba(0,0,0,.6)` |

## 6. Composants

| Composant | Règle |
|---|---|
| **Navigation latérale** | Même fond que la page ; élément actif sur surface relevée avec un liseré violet de 2 px. |
| **Barre supérieure** | Boutons d'outils fantômes (sans fond ni bordure), révélés au survol : la barre la plus chargée de Nexora devient calme. |
| **Onglets de vues** | Onglet actif en violet clair avec soulignement de 2 px. |
| **Widgets** | Pas de séparateur sous l'en-tête ; titre en gris secondaire ; actions masquées hors survol et focus. |
| **Indicateurs (KPI)** | Chiffre de 38 px posé sur la carte, sans cadre. |
| **Puces** | Fond teinté à 15 % ; texte éclairci (55 % de la teinte + 45 % de blanc) en sombre, assombri en clair. |
| **Tableaux** | En-têtes 11,5 px / 500, dates en Geist Mono. |
| **Fiche tâche** | Fenêtre sur surface, contour 1 px, ombre profonde. |

## 7. À faire / à éviter

**À faire**

- Créer la profondeur par les paliers de surface.
- Laisser la barre d'outils fantôme : seul le bouton principal est plein.
- Vérifier chaque nouvelle couleur de donnée sur le fond #0A0B0F.

**À éviter**

- Mettre du blanc pur en grande surface dans le thème sombre.
- Ajouter des ombres aux cartes.
- Utiliser le violet pour une donnée (statut, projet).

## 8. Limites connues

Le Gantt et les vues 3D gardent leurs propres aplats colorés ; certaines teintes de données claires (jaune, cyan) ressortent fortement sur fond noir. Le dégradé figé des curseurs d'avancement (`sliderGradientBg`) ne peut pas suivre le thème : la piste devient neutre en sombre.

Limites communes aux cinq chartes : voir [README](../README.md#limites-communes).

## 9. Captures — vues

Captures réelles de l'application (build local, données de démonstration enrichies), 1600 × 1000 px.

| Vue | Thème sombre | Thème clair |
|---|---|---|
| **Tableau de bord « Pilotage »**<br>Indicateurs, histogramme, secteurs, liste d'échéances, Mini-Gantt. | ![Tableau de bord « Pilotage » — sombre](captures/sombre-01-dashboard-pilotage.webp) | ![Tableau de bord « Pilotage » — clair](captures/clair-01-dashboard-pilotage.webp) |
| **Tableau de bord « Planning & équipe »**<br>Calendrier, charge personnel, heat map mensuelle, chemin critique. | ![Tableau de bord « Planning & équipe » — sombre](captures/sombre-02-dashboard-planning-equipe.webp) | ![Tableau de bord « Planning & équipe » — clair](captures/clair-02-dashboard-planning-equipe.webp) |
| **Tableau de bord « Suivi & décisions »**<br>Priorité du moment, tâches bloquantes, note, treemap, bulles. | ![Tableau de bord « Suivi & décisions » — sombre](captures/sombre-03-dashboard-suivi.webp) | ![Tableau de bord « Suivi & décisions » — clair](captures/clair-03-dashboard-suivi.webp) |
| **Planning Projets (vue métro)** | ![Planning Projets (vue métro) — sombre](captures/sombre-04-planning-projets.webp) | ![Planning Projets (vue métro) — clair](captures/clair-04-planning-projets.webp) |
| **Gantt** | ![Gantt — sombre](captures/sombre-05-gantt.webp) | ![Gantt — clair](captures/clair-05-gantt.webp) |
| **Aujourd'hui** | ![Aujourd'hui — sombre](captures/sombre-06-aujourdhui.webp) | ![Aujourd'hui — clair](captures/clair-06-aujourdhui.webp) |
| **Calendrier** | ![Calendrier — sombre](captures/sombre-07-calendrier.webp) | ![Calendrier — clair](captures/clair-07-calendrier.webp) |
| **Tableur** | ![Tableur — sombre](captures/sombre-08-tableur.webp) | ![Tableur — clair](captures/clair-08-tableur.webp) |
| **Fiche tâche** | ![Fiche tâche — sombre](captures/sombre-09-fiche-tache.webp) | ![Fiche tâche — clair](captures/clair-09-fiche-tache.webp) |

## 10. Captures — widgets

| Widget | Thème sombre | Thème clair |
|---|---|---|
| **Indicateur** | ![Indicateur — sombre](captures/sombre-widget-taches-actives.webp) | ![Indicateur — clair](captures/clair-widget-taches-actives.webp) |
| **Indicateur (pourcentage)** | ![Indicateur (pourcentage) — sombre](captures/sombre-widget-avancement-moyen.webp) | ![Indicateur (pourcentage) — clair](captures/clair-widget-avancement-moyen.webp) |
| **Graphique en barres** | ![Graphique en barres — sombre](captures/sombre-widget-taches-par-projet.webp) | ![Graphique en barres — clair](captures/clair-widget-taches-par-projet.webp) |
| **Graphique en secteurs** | ![Graphique en secteurs — sombre](captures/sombre-widget-repartition-par-statut.webp) | ![Graphique en secteurs — clair](captures/clair-widget-repartition-par-statut.webp) |
| **Liste** | ![Liste — sombre](captures/sombre-widget-prochaines-echeances.webp) | ![Liste — clair](captures/clair-widget-prochaines-echeances.webp) |
| **Mini-Gantt** | ![Mini-Gantt — sombre](captures/sombre-widget-mini-gantt-chantiers.webp) | ![Mini-Gantt — clair](captures/clair-widget-mini-gantt-chantiers.webp) |
| **Calendrier** | ![Calendrier — sombre](captures/sombre-widget-calendrier.webp) | ![Calendrier — clair](captures/clair-widget-calendrier.webp) |
| **Charge personnel** | ![Charge personnel — sombre](captures/sombre-widget-charge-personnel.webp) | ![Charge personnel — clair](captures/clair-widget-charge-personnel.webp) |
| **Heat map mensuelle** | ![Heat map mensuelle — sombre](captures/sombre-widget-heat-map-mensuelle.webp) | ![Heat map mensuelle — clair](captures/clair-widget-heat-map-mensuelle.webp) |
| **Chemin critique** | ![Chemin critique — sombre](captures/sombre-widget-chemin-critique.webp) | ![Chemin critique — clair](captures/clair-widget-chemin-critique.webp) |
| **Next Best Action** | ![Next Best Action — sombre](captures/sombre-widget-priorite-du-moment.webp) | ![Next Best Action — clair](captures/clair-widget-priorite-du-moment.webp) |
| **Domino Effect** | ![Domino Effect — sombre](captures/sombre-widget-taches-bloquantes.webp) | ![Domino Effect — clair](captures/clair-widget-taches-bloquantes.webp) |
| **Note libre** | ![Note libre — sombre](captures/sombre-widget-note-de-chantier.webp) | ![Note libre — clair](captures/clair-widget-note-de-chantier.webp) |
| **Treemap** | ![Treemap — sombre](captures/sombre-widget-treemap-projets.webp) | ![Treemap — clair](captures/clair-widget-treemap-projets.webp) |
| **Bulles** | ![Bulles — sombre](captures/sombre-widget-bulles.webp) | ![Bulles — clair](captures/clair-widget-bulles.webp) |

## 11. Mise en œuvre

La charte est une **couche de présentation pure** : aucun composant, aucune donnée, aucun moteur n'est modifié.

1. Charger les polices (URL ci-dessus).
2. Ajouter la feuille `nexora-nocturne.css` **après** les styles existants.
3. Activer : `<html data-charte="nocturne" data-mode="sombre">` (ou `clair`).

La feuille contient : les tokens `--c-*` et leur câblage sur les tokens existants (`--life-*`, `--bg`, `--surface`, `--ink`…), le remappage généré des couleurs codées en dur de Nexora, le socle commun et la signature de la charte. Elle est régénérée par `node docs/chartes-graphiques/outils/gen.mjs`.
