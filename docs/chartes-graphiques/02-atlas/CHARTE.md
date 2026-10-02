# Charte 02 — Atlas

> Cartographie marine : rail marine profond, sarcelle de navigation, balise ambre.

![Atlas — tableau de bord, thème clair](captures/clair-01-dashboard-pilotage.webp)

**Personnalité :** Technique · Calme · Précis · Ingénierie  
**Thème par défaut :** clair · **Déclinaison :** sombre  
**Fichier :** [`nexora-atlas.css`](nexora-atlas.css)

## 1. Intention

Une table à cartes : un rail de navigation bleu marine profond, des surfaces claires légèrement bleutées, une sarcelle de navigation pour l'action et une balise ambre pour « aujourd'hui ». Les chiffres et les dates sont en chasse fixe, comme des relevés.

**Pour qui, pour quoi :** Un usage professionnel quotidien, longues sessions ; profil ingénierie / BTP. C'est l'évolution la plus naturelle de la charte actuelle (même structure, identité plus affirmée).

## 2. Principes

1. Deux zones de lumière : la navigation sombre encadre, le contenu clair se lit.
2. La sarcelle est la couleur de l'action et de la sélection ; l'ambre ne sert qu'au repère temporel.
3. Tout ce qui se mesure est en IBM Plex Mono : dates, compteurs, valeurs des KPI.
4. Les en-têtes de widgets sont des cartouches : bande teintée, étiquette condensée en capitales.
5. Les puces gardent la teinte de donnée, assombrie pour atteindre la lisibilité.

## 3. Couleurs

Les couleurs de **données** (projets, statuts, personnes, types de tâches) ne sont jamais remplacées : elles appartiennent aux réglages de l'utilisateur. La charte ne fixe que les couleurs d'interface ci-dessous.

### Thème clair

![Palette clair](palette-clair.svg)

### Thème sombre

![Palette sombre](palette-sombre.svg)

| Rôle | Token | Thème clair | Thème sombre |
|---|---|---|---|
| Fond de page | `--c-bg` | `#ECF1F2` | `#07131D` |
| Surface (cartes, fenêtres) | `--c-surface` | `#FFFFFF` | `#0D1D2A` |
| Surface douce (en-têtes, survol) | `--c-soft` | `#F4F7F8` | `#112434` |
| Bordure | `--c-border` | `#D2DBDE` | `#1C3749` |
| Bordure forte | `--c-border-strong` | `#A6B6BC` | `#2C4F65` |
| Encre (texte principal) | `--c-text` | `#0D2130` | `#E3EDF1` |
| Texte secondaire | `--c-secondary` | `#3C5361` | `#A6BDC9` |
| Texte discret | `--c-muted` | `#5A6F7C` | `#7C95A3` |
| Accent (action, sélection) | `--c-accent` | `#0A7A76` | `#2BC3B6` |
| Accent survolé | `--c-accent-hover` | `#075F5C` | `#5DD6CC` |
| Accent doux (fond sélectionné) | `--c-accent-soft` | `#DCF0EE` | `#0E3436` |
| Texte sur accent | `--c-on-accent` | `#FFFFFF` | `#031D1C` |
| Accent en texte | `--c-accent-text` | `#086F6B` | `#4CD0C4` |
| Signal (aujourd'hui, alerte) | `--c-signal` | `#D9661F` | `#F08A3C` |
| Succès | `--c-success` | `#1E8C5A` | `#3FC487` |
| Avertissement | `--c-warning` | `#C98A1A` | `#E9B44C` |
| Danger | `--c-danger` | `#C93B32` | `#F06A5F` |
| Navigation — fond | `--c-sidebar` | `#0D2130` | `#040D15` |
| Navigation — texte | `--c-sidebar-text` | `#E2EBEE` | `#DCE7EC` |
| Navigation — actif | `--c-sidebar-active` | `#1C3B4D` | `#123044` |
| Info-bulle, aplat d'encre | `--c-tooltip` | `#0D2130` | `#1A3346` |
| Anneau de focus | `--c-focus` | `#0A7A76` | `#4CD0C4` |
| Sélection de texte | `--c-selection` | `#C8ECE8` | `#134A4A` |

### Contrastes mesurés (WCAG 2.2)

| Couple | Thème clair | Thème sombre |
|---|---|---|
| Encre / surface | 16.44:1 — AAA | 14.39:1 — AAA |
| Encre / fond | 14.43:1 — AAA | 15.76:1 — AAA |
| Secondaire / surface | 8.07:1 — AAA | 8.76:1 — AAA |
| Discret / surface | 5.25:1 — AA | 5.45:1 — AA |
| Discret / fond | 4.61:1 — AA | 5.97:1 — AA |
| Accent en texte / surface | 6.01:1 — AA | 9.07:1 — AAA |
| Texte sur accent / accent | 5.17:1 — AA | 8.01:1 — AAA |
| Signal texte / surface | 5.82:1 — AA | 8.47:1 — AAA |
| Navigation texte / fond | 13.58:1 — AAA | 15.54:1 — AAA |
| Navigation discret / fond | 6.32:1 — AA | 6.23:1 — AA |
| Navigation active | 11.78:1 — AAA | 13.71:1 — AAA |
| Bordure / surface (composant, seuil 3:1) | 1.41:1 — décorative, doublée par l'écart de surface | 1.38:1 — décorative, doublée par l'écart de surface |
| Statuts en texte (succès / avert. / danger, ajustés auto.) | 5.2 / 5.2 / 5.3 :1 | 7.7 / 9.0 / 5.7 :1 |

## 4. Typographie

| Famille | Usage | Raison |
|---|---|---|
| IBM Plex Sans | Texte et titres | Grotesque d'ingénieur, très lisible en petit corps. |
| IBM Plex Sans Condensed | Titres de widgets, en-têtes de tableaux, libellés de navigation | Plus étroite que la version normale : les étiquettes en capitales restent compactes. |
| IBM Plex Mono | Chiffres clés, dates, compteurs, colonnes numériques | Chasse fixe : tout se compare verticalement. |

Chargement : `https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Sans+Condensed:wght@500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap` — chiffres tabulaires (`tabular-nums`) conservés partout.

| Niveau | Réglage |
|---|---|
| Titre de page | 21 px / 600 / -1,5 % |
| Titre de widget | 12 px / 600 / capitales condensées / +7 % |
| Chiffre clé | 34 px / 500 mono |
| Corps | 13,5 px / 400–600 |
| Libellés de navigation | 11 px / 600 / capitales condensées / +10 % |

## 5. Formes, bordures, profondeur

Rayons 5 px (commandes), 8 px (cartes), 4 px (puces), 10 px (fenêtres). Ombre courte et douce sur les cartes, ombre ample sur les menus. Bordures 1 px bleu-gris.

| Token | Valeur |
|---|---|
| `--c-r-control` | 5 px |
| `--c-r-card` | 8 px |
| `--c-r-chip` | 4 px |
| `--c-r-modal` | 10 px |
| `--c-base` (corps) | 13.5 px |
| `--c-shadow` (clair) | `0 1px 2px rgba(13,33,48,.06), 0 4px 14px rgba(13,33,48,.05)` |
| `--c-menu-shadow` (clair) | `0 18px 44px rgba(13,33,48,.20)` |

## 6. Composants

| Composant | Règle |
|---|---|
| **Navigation latérale** | Bleu marine profond (thème clair) ou presque noir (thème sombre). Élément actif : fond marine éclairci, liseré sarcelle de 3 px à gauche. Logo inversé pour rester lisible sur le fond sombre. |
| **Onglets de vues** | Onglet actif en sarcelle, soulignement 2 px. |
| **Boutons** | Principal et bouton flottant en sarcelle, texte blanc ; bouton flottant en carré arrondi 14 px. |
| **Widgets** | En-tête en bande teintée (surface douce), titre condensé en capitales gris-bleu. Actions à 45 % d'opacité, pleines au survol. |
| **Indicateurs (KPI)** | Valeur en Plex Mono 34 px sur un cartouche teinté marqué d'un liseré sarcelle à gauche. |
| **Puces** | Fond teinté à 13 % de la couleur de donnée, texte dans la même teinte mélangée à parts égales avec l'encre : la teinte est conservée, le contraste remonte. |
| **Tableaux** | En-têtes condensés en capitales ; dates et nombres en mono. |
| **Fiche tâche** | En-tête de fenêtre en bande teintée, étiquettes condensées. |

## 7. À faire / à éviter

**À faire**

- Garder l'ambre pour « aujourd'hui » et les échéances proches.
- Mettre en mono toute valeur que l'on compare (dates, durées, montants).
- Laisser la navigation sombre même en thème clair : c'est le repère de la charte.

**À éviter**

- Utiliser la sarcelle comme couleur de projet : elle se confondrait avec la sélection.
- Mettre du texte long en Plex Mono.
- Ajouter des ombres fortes : la profondeur vient du rail sombre.

## 8. Limites connues

Trois familles Plex à charger (poids de polices supérieur aux autres chartes). La navigation sombre en thème clair demande que tout nouveau composant de la barre latérale utilise les tokens de navigation, pas ceux du contenu.

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
2. Ajouter la feuille `nexora-atlas.css` **après** les styles existants.
3. Activer : `<html data-charte="atlas" data-mode="clair">` (ou `sombre`).

La feuille contient : les tokens `--c-*` et leur câblage sur les tokens existants (`--life-*`, `--bg`, `--surface`, `--ink`…), le remappage généré des couleurs codées en dur de Nexora, le socle commun et la signature de la charte. Elle est régénérée par `node docs/chartes-graphiques/outils/gen.mjs`.
