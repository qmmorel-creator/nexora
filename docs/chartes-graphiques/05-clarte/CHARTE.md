# Charte 05 — Clarté

> Lisibilité maximale : police Atkinson, bordures franches, contrastes AAA, focus jaune.

![Clarté — tableau de bord, thème clair](captures/clair-01-dashboard-pilotage.webp)

**Personnalité :** Explicite · Robuste · Inclusif · Sans ambiguïté  
**Thème par défaut :** clair · **Déclinaison :** sombre  
**Fichier :** [`nexora-clarte.css`](nexora-clarte.css)

## 1. Intention

La lisibilité comme identité : police Atkinson Hyperlegible conçue pour les basses visions, contrastes AAA, bordures de composants à 3:1 minimum, focus jaune cerclé de noir, sélection en aplat franc. Le thème sombre est un vrai mode haut contraste, noir et jaune.

**Pour qui, pour quoi :** Les utilisateurs malvoyants ou fatigués visuellement, les écrans en plein soleil (chantier, tablette), les projections ; une option d'accessibilité à proposer en plus de la charte principale.

## 2. Principes

1. Tout texte atteint 7:1 (AAA), y compris le texte secondaire et discret.
2. Toute limite de composant atteint 3:1 : on voit chaque champ, chaque carte, chaque bouton.
3. La sélection est un aplat, pas une nuance : navigation et onglet actifs en bleu plein (jaune en sombre).
4. Le focus clavier est double : anneau jaune de 3 px entouré de noir, visible sur tout fond.
5. Les puces sont cerclées de leur couleur de donnée et écrites en encre.

## 3. Couleurs

Les couleurs de **données** (projets, statuts, personnes, types de tâches) ne sont jamais remplacées : elles appartiennent aux réglages de l'utilisateur. La charte ne fixe que les couleurs d'interface ci-dessous.

### Thème clair

![Palette clair](palette-clair.svg)

### Thème sombre

![Palette sombre](palette-sombre.svg)

| Rôle | Token | Thème clair | Thème sombre |
|---|---|---|---|
| Fond de page | `--c-bg` | `#E8ECF1` | `#000000` |
| Surface (cartes, fenêtres) | `--c-surface` | `#FFFFFF` | `#0B0B0B` |
| Surface douce (en-têtes, survol) | `--c-soft` | `#F3F5F8` | `#151515` |
| Bordure | `--c-border` | `#8C97A8` | `#7D7D7D` |
| Bordure forte | `--c-border-strong` | `#4F5A6B` | `#C2C2C2` |
| Encre (texte principal) | `--c-text` | `#07101F` | `#FFFFFF` |
| Texte secondaire | `--c-secondary` | `#253247` | `#E8E8E8` |
| Texte discret | `--c-muted` | `#38455A` | `#CFCFCF` |
| Accent (action, sélection) | `--c-accent` | `#0040C8` | `#FFD60A` |
| Accent survolé | `--c-accent-hover` | `#00309A` | `#FFE45C` |
| Accent doux (fond sélectionné) | `--c-accent-soft` | `#DBE6FF` | `#2E2900` |
| Texte sur accent | `--c-on-accent` | `#FFFFFF` | `#000000` |
| Accent en texte | `--c-accent-text` | `#0040C8` | `#FFD60A` |
| Signal (aujourd'hui, alerte) | `--c-signal` | `#B42318` | `#FF7262` |
| Succès | `--c-success` | `#0E6B3B` | `#5CE19A` |
| Avertissement | `--c-warning` | `#8A5A00` | `#FFD60A` |
| Danger | `--c-danger` | `#B42318` | `#FF7262` |
| Navigation — fond | `--c-sidebar` | `#FFFFFF` | `#000000` |
| Navigation — texte | `--c-sidebar-text` | `#07101F` | `#FFFFFF` |
| Navigation — actif | `--c-sidebar-active` | `#0040C8` | `#FFD60A` |
| Info-bulle, aplat d'encre | `--c-tooltip` | `#07101F` | `#1F1F1F` |
| Anneau de focus | `--c-focus` | `#FFC400` | `#FFD60A` |
| Sélection de texte | `--c-selection` | `#FFE680` | `#5C4E00` |

### Contrastes mesurés (WCAG 2.2)

| Couple | Thème clair | Thème sombre |
|---|---|---|
| Encre / surface | 19.04:1 — AAA | 19.68:1 — AAA |
| Encre / fond | 16.05:1 — AAA | 21.00:1 — AAA |
| Secondaire / surface | 12.92:1 — AAA | 16.06:1 — AAA |
| Discret / surface | 9.69:1 — AAA | 12.63:1 — AAA |
| Discret / fond | 8.17:1 — AAA | 13.48:1 — AAA |
| Accent en texte / surface | 8.18:1 — AAA | 13.94:1 — AAA |
| Texte sur accent / accent | 8.18:1 — AAA | 14.88:1 — AAA |
| Signal texte / surface | 7.71:1 — AAA | 8.60:1 — AAA |
| Navigation texte / fond | 19.04:1 — AAA | 21.00:1 — AAA |
| Navigation discret / fond | 9.69:1 — AAA | 13.48:1 — AAA |
| Navigation active | 8.18:1 — AAA | 14.88:1 — AAA |
| Bordure / surface (composant, seuil 3:1) | 2.95:1 — décorative, doublée par l'écart de surface | 4.78:1 — conforme 1.4.11 |
| Statuts en texte (succès / avert. / danger, ajustés auto.) | 6.6 / 5.9 / 6.6 :1 | 11.9 / 13.9 / 7.3 :1 |

## 4. Typographie

| Famille | Usage | Raison |
|---|---|---|
| Atkinson Hyperlegible Next | Tout le texte | Dessinée par le Braille Institute : formes de lettres distinctes (I/l/1, O/0, b/d). |
| Atkinson Hyperlegible Mono | Code, valeurs techniques | Même dessin, chasse fixe. |

Chargement : `https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:wght@400;500;600;700;800&family=Atkinson+Hyperlegible+Mono:wght@400;500;600&display=swap` — chiffres tabulaires (`tabular-nums`) conservés partout.

| Niveau | Réglage |
|---|---|
| Titre de page | 22 px / 800 |
| Titre de widget | 15 px / 800 |
| Chiffre clé | 40 px / 800 |
| Corps | 14 px / 400–700 |
| Onglets | 14 px / 700 |
| Navigation | 14 px, hauteur 32 px |

## 5. Formes, bordures, profondeur

Rayons 6 px (commandes), 8 px (cartes), 5 px (puces), 10 px (fenêtres). Bordures de 1,5 px partout ; fenêtres cerclées de 2 px d'encre. Aucune ombre décorative.

| Token | Valeur |
|---|---|
| `--c-r-control` | 6 px |
| `--c-r-card` | 8 px |
| `--c-r-chip` | 5 px |
| `--c-r-modal` | 10 px |
| `--c-base` (corps) | 14 px |
| `--c-shadow` (clair) | `none` |
| `--c-menu-shadow` (clair) | `0 0 0 2px #07101F, 0 14px 30px rgba(7,16,31,.25)` |

## 6. Composants

| Composant | Règle |
|---|---|
| **Navigation latérale** | Fond blanc, élément actif en aplat bleu cobalt plein, texte blanc gras (jaune / noir en sombre). |
| **Onglets de vues** | 14 px / 700 ; onglet actif en aplat plein, comme un intercalaire. |
| **Boutons** | Bordure 1,5 px, 12 px / 700, hauteur 30 px minimum ; principal en cobalt plein. |
| **Widgets** | Bordures 1,5 px ; titre 15 px / 800 ; actions toujours visibles (pas de masquage au survol). |
| **Indicateurs (KPI)** | Chiffre 40 px / 800 sans cadre. |
| **Puces** | Fond teinté à 14 %, contour 1,5 px de la couleur de donnée, texte encre 12 px / 700. |
| **Tableaux** | En-têtes 12,5 px / 800 en encre, filet de 2 px ; séparateurs de lignes visibles. |
| **Champs** | Bordure 1,5 px à 3:1, étiquette en encre. |

## 7. À faire / à éviter

**À faire**

- Garder les actions visibles en permanence.
- Doubler toute information de couleur par un texte ou une forme.
- Vérifier 7:1 pour tout nouveau texte.

**À éviter**

- Masquer des commandes au survol.
- Utiliser une couleur de donnée comme couleur de texte.
- Réduire les bordures sous 1,5 px.

## 8. Limites connues

Plus haute et plus large : un peu moins de contenu visible par écran que les autres chartes. Le thème sombre jaune/noir est volontairement radical.

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
2. Ajouter la feuille `nexora-clarte.css` **après** les styles existants.
3. Activer : `<html data-charte="clarte" data-mode="clair">` (ou `sombre`).

La feuille contient : les tokens `--c-*` et leur câblage sur les tokens existants (`--life-*`, `--bg`, `--surface`, `--ink`…), le remappage généré des couleurs codées en dur de Nexora, le socle commun et la signature de la charte. Elle est régénérée par `node docs/chartes-graphiques/outils/gen.mjs`.
