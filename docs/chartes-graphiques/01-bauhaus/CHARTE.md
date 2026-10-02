# Charte 01 — Bauhaus

> Fond papier, cadres noirs, aplats primaires rouge, jaune et bleu, angles droits.

![Bauhaus — tableau de bord, thème clair](captures/clair-01-dashboard-pilotage.webp)

**Personnalité :** Franc · Géométrique · Lisible de loin · Joyeux mais rigoureux  
**Thème par défaut :** clair · **Déclinaison :** sombre  
**Fichier :** [`nexora-bauhaus.css`](nexora-bauhaus.css)

## 1. Intention

*Reprise directe du thème de la page « Budget prévisionnel » (artefact Claude) : mêmes couleurs, même police, mêmes cadres.*

Le Bauhaus appliqué au pilotage : un fond papier, des cadres d'encre, et trois aplats primaires qui ont chacun un rôle. Le rouge agit (création, bouton principal, onglet actif), le jaune signale le présent (aujourd'hui, sélection), le bleu structure (en-têtes de tableau). Les chiffres clés deviennent des tuiles pleines, comme le résumé du budget.

**Pour qui, pour quoi :** Un usage quotidien où l'on veut lire l'essentiel d'un coup d'œil, et l'unité visuelle avec vos pages Budget.

## 2. Principes

1. Trois primaires, trois rôles : rouge = action, jaune = présent et sélection, bleu = structure.
2. Cadres d'encre de 2 px autour de chaque widget, filet de 2 px sous chaque en-tête.
3. Angles droits partout : commandes, cartes, puces, fenêtres, menus (rayon 0).
4. Les indicateurs sont des tuiles pleines dans l'ordre rouge, jaune, bleu, papier.
5. Ombres franches et décalées (6 px) pour ce qui flotte : menus, fenêtres, bouton de création.

## 3. Couleurs

Les couleurs de **données** (projets, statuts, personnes, types de tâches) ne sont jamais remplacées : elles appartiennent aux réglages de l'utilisateur. La charte ne fixe que les couleurs d'interface ci-dessous.

### Thème clair

![Palette clair](palette-clair.svg)

### Thème sombre

![Palette sombre](palette-sombre.svg)

| Rôle | Token | Thème clair | Thème sombre |
|---|---|---|---|
| Fond de page | `--c-bg` | `#F0EDE6` | `#16150F` |
| Surface (cartes, fenêtres) | `--c-surface` | `#FBFAF6` | `#1F1E19` |
| Surface douce (en-têtes, survol) | `--c-soft` | `#E9E5DC` | `#2A2822` |
| Bordure | `--c-border` | `#CFC8BA` | `#3D3A32` |
| Bordure forte | `--c-border-strong` | `#141414` | `#E8E4DA` |
| Encre (texte principal) | `--c-text` | `#141414` | `#F0EDE6` |
| Texte secondaire | `--c-secondary` | `#45413A` | `#C9C3B6` |
| Texte discret | `--c-muted` | `#5E5A52` | `#A8A296` |
| Accent (action, sélection) | `--c-accent` | `#D9302A` | `#F26A5D` |
| Accent survolé | `--c-accent-hover` | `#B5231E` | `#F58579` |
| Accent doux (fond sélectionné) | `--c-accent-soft` | `#FBE7A6` | `#3A3218` |
| Texte sur accent | `--c-on-accent` | `#FFFFFF` | `#141414` |
| Accent en texte | `--c-accent-text` | `#B5231E` | `#F27B6F` |
| Signal (aujourd'hui, alerte) | `--c-signal` | `#D9302A` | `#F26A5D` |
| Succès | `--c-success` | `#2F7D4A` | `#6CC28A` |
| Avertissement | `--c-warning` | `#A8741A` | `#E0B45C` |
| Danger | `--c-danger` | `#D9302A` | `#F26A5D` |
| Navigation — fond | `--c-sidebar` | `#F0EDE6` | `#16150F` |
| Navigation — texte | `--c-sidebar-text` | `#141414` | `#F0EDE6` |
| Navigation — actif | `--c-sidebar-active` | `#141414` | `#F0EDE6` |
| Info-bulle, aplat d'encre | `--c-tooltip` | `#141414` | `#2A2822` |
| Anneau de focus | `--c-focus` | `#1D4E89` | `#F5C242` |
| Sélection de texte | `--c-selection` | `#F5B400` | `#5A4A10` |
| Aplat propre à la charte : red | `--c-red` | `#D9302A` | `#F26A5D` |
| Aplat propre à la charte : on-red | `--c-on-red` | `#FFFFFF` | `#141414` |
| Aplat propre à la charte : yellow | `--c-yellow` | `#F5B400` | `#F5C242` |
| Aplat propre à la charte : on-yellow | `--c-on-yellow` | `#141414` | `#141414` |
| Aplat propre à la charte : blue | `--c-blue` | `#1D4E89` | `#2B5F9E` |
| Aplat propre à la charte : on-blue | `--c-on-blue` | `#FFFFFF` | `#FFFFFF` |
| Aplat propre à la charte : frame | `--c-frame` | `#141414` | `#E8E4DA` |

**Aplats et texte posé dessus :** thème clair : red 4.8:1, yellow 10.0:1, blue 8.4:1 · thème sombre : red 6.1:1, yellow 11.1:1, blue 6.5:1.

### Contrastes mesurés (WCAG 2.2)

| Couple | Thème clair | Thème sombre |
|---|---|---|
| Encre / surface | 17.64:1 — AAA | 14.28:1 — AAA |
| Encre / fond | 15.76:1 — AAA | 15.64:1 — AAA |
| Secondaire / surface | 9.71:1 — AAA | 9.51:1 — AAA |
| Discret / surface | 6.57:1 — AA | 6.58:1 — AA |
| Discret / fond | 5.87:1 — AA | 7.21:1 — AAA |
| Accent en texte / surface | 6.24:1 — AA | 6.23:1 — AA |
| Texte sur accent / accent | 4.77:1 — AA | 6.14:1 — AA |
| Signal texte / surface | 6.24:1 — AA | 6.23:1 — AA |
| Navigation texte / fond | 15.76:1 — AAA | 15.64:1 — AAA |
| Navigation discret / fond | 5.87:1 — AA | 7.21:1 — AAA |
| Navigation active | 15.76:1 — AAA | 15.64:1 — AAA |
| Bordure / surface (composant, seuil 3:1) | 1.59:1 — décorative, doublée par l'écart de surface | 1.47:1 — décorative, doublée par l'écart de surface |
| Statuts en texte (succès / avert. / danger, ajustés auto.) | 5.0 / 5.2 / 5.2 :1 | 7.7 / 8.6 / 5.6 :1 |

## 4. Typographie

| Famille | Usage | Raison |
|---|---|---|
| Outfit | Tout : texte, titres, chiffres | Géométrique, héritière des alphabets du Bauhaus ; chiffres tabulaires nets. |
| JetBrains Mono | Code uniquement | Les chiffres restent en Outfit, comme dans la page budget. |

Chargement : `https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap` — chiffres tabulaires (`tabular-nums`) conservés partout.

| Niveau | Réglage |
|---|---|
| Titre de page | 27 px / 800 / -2 % |
| Titre de widget | 15 px / 700 |
| Chiffre clé | 46 px / 800 / -3,5 % |
| Corps | 14,5 px / 400–600 |
| Onglets | 14 px / 600, barre rouge de 4 px |
| Sections de navigation | 11 px / 700 / capitales / +9 % |

## 5. Formes, bordures, profondeur

Rayon 0. Cadres de 2 px (widgets, fenêtres), 1,5 px (commandes, champs). Pas d'ombre au repos ; ombre pleine décalée de 6 px pour les menus et fenêtres, de 5 px pour le bouton de création.

| Token | Valeur |
|---|---|
| `--c-r-control` | 0 px |
| `--c-r-card` | 0 px |
| `--c-r-chip` | 0 px |
| `--c-r-modal` | 0 px |
| `--c-base` (corps) | 14.5 px |
| `--c-shadow` (clair) | `none` |
| `--c-menu-shadow` (clair) | `0 0 0 2px #141414, 6px 6px 0 2px #141414` |

## 6. Composants

| Composant | Règle |
|---|---|
| **Navigation latérale** | Fond papier, filet d'encre de 2 px à droite. Élément actif en aplat d'encre, texte papier. Bouton « Nouvelle tâche » rouge avec ombre pleine. |
| **Barre supérieure** | Filet d'encre de 2 px en bas, titre 27 px / 800. Commandes cadrées 1,5 px ; survol en jaune. |
| **Onglets de vues** | Texte 14 px / 600 ; l'onglet actif reçoit une barre rouge de 4 px, comme les segments de la page budget. |
| **Widgets** | Cadre d'encre 2 px, en-tête fermé par un filet de 2 px, titre 15 px / 700. |
| **Indicateurs (KPI)** | Tuiles pleines : 1re rouge (texte blanc), 2e jaune (texte encre), 3e bleue (texte blanc), 4e papier. Chiffre 46 px / 800. |
| **Tableaux** | En-tête bleu plein, capitales blanches 11,5 px ; lignes séparées par un filet clair. |
| **Puces** | Carrées, fond teinté à 18 % de la couleur de donnée, texte encre 600. |
| **Aujourd'hui** | Barre jaune de 3 px cernée d'encre ; étiquette sur fond jaune. |
| **Fiche tâche** | Fenêtre cadrée 2 px, ombre pleine, titre 22 px / 800, champs sur fond grisé. |

## 7. À faire / à éviter

**À faire**

- Garder l'ordre des aplats rouge, jaune, bleu sur les rangées d'indicateurs.
- Réserver le rouge aux actions et le jaune au présent.
- Cadrer en 2 px tout nouveau bloc.

**À éviter**

- Arrondir quoi que ce soit.
- Ajouter une quatrième couleur d'interface.
- Poser du texte blanc sur le jaune.

## 8. Limites connues

Les tuiles colorées dépendent de l'ordre des widgets dans le tableau de bord (1er, 2e, 3e, 4e indicateur). Un tableau de bord sans indicateur n'en montre aucune.

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
2. Ajouter la feuille `nexora-bauhaus.css` **après** les styles existants.
3. Activer : `<html data-charte="bauhaus" data-mode="clair">` (ou `sombre`).

La feuille contient : les tokens `--c-*` et leur câblage sur les tokens existants (`--life-*`, `--bg`, `--surface`, `--ink`…), le remappage généré des couleurs codées en dur de Nexora, le socle commun et la signature de la charte. Elle est régénérée par `node docs/chartes-graphiques/outils/gen.mjs`.
