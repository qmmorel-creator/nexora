# Dix thèmes sombres pour Nexora — Ref #625

Propositions. **Observatoire (S07) est activable** dans Réglages → Apparence ; les neuf autres ne sont pas activées. Chacune est une feuille CSS posée sur l'application (même mécanisme que les thèmes Bauhaus et Dessau de #621) : un thème retenu s'ajoute au sélecteur de Réglages → Apparence.

Galerie : [`index.html`](index.html).

## Principes de lecture en sombre (communs aux dix)

1. **Jamais de noir ni de blanc purs en grandes surfaces.** Le texte est entre 12 et 17:1, pas 20:1 : le blanc pur sur noir pur « bave » et fatigue (halation).
2. **La profondeur vient de la lumière.** Plus un élément est haut, plus sa surface est claire ; chaque carte s'éclaire vers le haut avec un liseré clair, au lieu d'ombres invisibles sur fond sombre.
3. **Des accents clairs et désaturés.** Sur fond sombre, une couleur saturée vibre ; les accents sont éclaircis et adoucis pour rester lisibles sans scintiller.
4. **Un texte un peu plus gras et plus aéré.** Le texte clair sur fond sombre paraît plus fin : graisse 430 au lieu de 400 et interlettrage légèrement ouvert.
5. **Des données lisibles partout.** Puces teintées avec texte éclairci, aplats de données assombris sous le texte blanc, heat map inversée (vide = discret, plein = lumineux).
6. **Un focus et un « aujourd'hui » lumineux.** Anneau de focus avec halo, fil « aujourd'hui » légèrement rayonnant : on les retrouve d'un coup d'œil.

## Graphiques : audit automatique

Chaque thème a été audité sur 11 vues et 15 widgets (captures réelles) : contraste de chaque texte HTML et SVG contre son fond **affiché** (superpositions et filtres compris), fonds clairs résiduels, repères de graphiques trop proches de leur fond. Corrections appliquées à tous les thèmes sombres (et au mode sombre de Bauhaus et Dessau) :

- **Heat map** : l'échelle calculée pour le clair (vide = crème) est inversée en luminance, teinte conservée : vide = presque noir, beaucoup = vert ou rouge lumineux ; le nombre est posé sur une pastille sombre.
- **Calendrier, heat map mensuelle, avatars, treemap** : les aplats de données qui portent du texte blanc sont assombris (même teinte) pour que le texte passe le seuil.
- **Fenêtres** : le voile autour d'une fenêtre assombrit au lieu d'éclaircir.
- **Anneaux de progression, cases vides, pied de la charge personnel, noms de projets du Planning** : pistes et textes rendus visibles.

Résultat : sur les 10 thèmes, plus aucun texte sous 4,5:1 (3:1 pour les grands textes), hormis les emoji en couleur (indépendants du thème) et les nombres de la heat map, vérifiés à l'œil (pastille sombre, environ 8:1) car l'audit ne modélise pas les filtres imbriqués. Les aplats clairs restants sont voulus (boutons d'action, tuiles jaunes de Cobalt avec texte bleu nuit à 12,6:1).

## Vue d'ensemble

| | Thème | Idée | Police | Texte | Discret | Action |
|---|---|---|---|---|---|---|
| S01 | **Encre** | Encre de Chine et feuille d'or : bleu-noir profond, ivoire, titres à empattements, un or pour l'action. | Newsreader | 14.0:1 | 5.2:1 | 9.6:1 |
| S02 | **Aurore** | Nuit polaire : bleu de fjord, une aurore teintée en haut de page, sarcelle lumineuse et violet boréal. | Figtree | 14.9:1 | 5.8:1 | 11.6:1 |
| S03 | **Ardoise** | Le sombre qui ne fatigue pas : gris ardoise chaud plutôt que noir, contraste modéré, un cuivre pour l'action. | Instrument Sans | 12.1:1 | 5.1:1 | 6.7:1 |
| S04 | **Phosphore** | Cockpit d'avion : chiffres ambrés en afficheur, vert phosphore pour ce qui va bien, tout le reste en retrait. | IBM Plex Sans Condensed | 15.2:1 | 5.7:1 | 10.6:1 |
| S05 | **Velours** | Salon de nuit : aubergine profonde, rose poudré pour agir, or pour aujourd'hui, cartes en verre fumé. | Manrope | 14.7:1 | 5.8:1 | 9.4:1 |
| S06 | **Forêt** | Sous-bois : vert-noir, mousse lumineuse, ambre d'automne, police Lexend conçue pour la fluidité de lecture. | Lexend | 14.8:1 | 6.1:1 | 9.9:1 |
| S07 | **Observatoire** | Coupole de nuit : bleu minuit, champ d'étoiles discret derrière les tableaux de bord, bleu stellaire et or polaire. | Sora | 15.5:1 | 5.5:1 | 8.9:1 |
| S08 | **Carbone** | Écran OLED : noir carbone, cartes à peine relevées, un vert citron électrique, chiffres en Geist Mono. | Geist | 16.4:1 | 5.7:1 | 15.3:1 |
| S09 | **Lecture** | Le sombre fait pour lire : sépia nocturne, Atkinson Hyperlegible en 15 px, interligne généreux, aucun ornement. | Atkinson Hyperlegible Next | 13.1:1 | 6.1:1 | 8.2:1 |
| S10 | **Cobalt** | Le Bauhaus de nuit : bleu cobalt profond, filets crème, aplats jaune et rouge, Outfit et angles droits. | Outfit | 14.6:1 | 6.8:1 | 12.6:1 |

## S01 · Encre

> Encre de Chine et feuille d'or : bleu-noir profond, ivoire, titres à empattements, un or pour l'action.

![Encre](S01-encre/captures/01-dashboard-pilotage.webp)

**Pour :** Lecture du soir, ambiance studieuse et chaleureuse.

- Halo de lampe doré en haut à droite, contre-jour bleuté en bas à gauche.
- Titres en Newsreader (taille optique) : page 27 px, widgets 16 px, chiffres clés de 46 px.
- Liseré or en tête de chaque carte et le long de la navigation ; premier indicateur en or.
- En-têtes de tableau en italique ; bouton de création en dégradé or.

| Fond | Surface | Bordure | Texte | Secondaire | Discret | Accent | Signal |
|---|---|---|---|---|---|---|---|
| `#0F1318` | `#161B22` | `#28303A` | `#ECE7DD` | `#BBB5A9` | `#938D82` | `#E3B567` | `#F08C6C` |

Contrastes : texte 14.0:1 · secondaire 8.5:1 · discret 5.2:1 · accent en texte 10.1:1 · bouton 9.6:1 · navigation 14.6:1. Polices : Newsreader, Public Sans, JetBrains Mono. Feuille : [`nexora-encre.css`](S01-encre/nexora-encre.css).

<details><summary>Toutes les vues</summary>

| | |
|---|---|
| **Tableau de bord Pilotage**<br>![Tableau de bord Pilotage](S01-encre/captures/01-dashboard-pilotage.webp) | **Planning & équipe**<br>![Planning & équipe](S01-encre/captures/02-dashboard-planning-equipe.webp) |
| **Suivi & décisions**<br>![Suivi & décisions](S01-encre/captures/03-dashboard-suivi.webp) | **Planning Projets**<br>![Planning Projets](S01-encre/captures/04-planning-projets.webp) |
| **Gantt**<br>![Gantt](S01-encre/captures/05-gantt.webp) | **Aujourd'hui**<br>![Aujourd'hui](S01-encre/captures/06-aujourdhui.webp) |
| **Calendrier**<br>![Calendrier](S01-encre/captures/07-calendrier.webp) | **Tableur**<br>![Tableur](S01-encre/captures/08-tableur.webp) |
| **Fiche tâche**<br>![Fiche tâche](S01-encre/captures/09-fiche-tache.webp) | **Heat map**<br>![Heat map](S01-encre/captures/10-heatmap.webp) |
| **Pixel Tasks**<br>![Pixel Tasks](S01-encre/captures/11-pixel-tasks.webp) |  |

</details>

## S02 · Aurore

> Nuit polaire : bleu de fjord, une aurore teintée en haut de page, sarcelle lumineuse et violet boréal.

![Aurore](S02-aurore/captures/01-dashboard-pilotage.webp)

**Pour :** Effet le plus spectaculaire, pour les tableaux de bord affichés en continu.

- Fond de fjord traversé de deux lueurs d'aurore (sarcelle à gauche, violet à droite).
- Cartes en verre dépoli (flou de 20 px) : l'aurore transparaît sans gêner la lecture.
- Chiffres clés en dégradé sarcelle → violet ; onglets en pilules lumineuses.
- Barre supérieure et navigation translucides ; fil « aujourd'hui » violet.

| Fond | Surface | Bordure | Texte | Secondaire | Discret | Accent | Signal |
|---|---|---|---|---|---|---|---|
| `#0A1420` | `#0F1C2B` | `#1F3348` | `#E6F0F5` | `#ADC0CE` | `#8399AA` | `#5EEAD4` | `#C4A1FF` |

Contrastes : texte 14.9:1 · secondaire 9.2:1 · discret 5.8:1 · accent en texte 12.1:1 · bouton 11.6:1 · navigation 15.3:1. Polices : Figtree, JetBrains Mono. Feuille : [`nexora-aurore.css`](S02-aurore/nexora-aurore.css).

<details><summary>Toutes les vues</summary>

| | |
|---|---|
| **Tableau de bord Pilotage**<br>![Tableau de bord Pilotage](S02-aurore/captures/01-dashboard-pilotage.webp) | **Planning & équipe**<br>![Planning & équipe](S02-aurore/captures/02-dashboard-planning-equipe.webp) |
| **Suivi & décisions**<br>![Suivi & décisions](S02-aurore/captures/03-dashboard-suivi.webp) | **Planning Projets**<br>![Planning Projets](S02-aurore/captures/04-planning-projets.webp) |
| **Gantt**<br>![Gantt](S02-aurore/captures/05-gantt.webp) | **Aujourd'hui**<br>![Aujourd'hui](S02-aurore/captures/06-aujourdhui.webp) |
| **Calendrier**<br>![Calendrier](S02-aurore/captures/07-calendrier.webp) | **Tableur**<br>![Tableur](S02-aurore/captures/08-tableur.webp) |
| **Fiche tâche**<br>![Fiche tâche](S02-aurore/captures/09-fiche-tache.webp) | **Heat map**<br>![Heat map](S02-aurore/captures/10-heatmap.webp) |
| **Pixel Tasks**<br>![Pixel Tasks](S02-aurore/captures/11-pixel-tasks.webp) |  |

</details>

## S03 · Ardoise

> Le sombre qui ne fatigue pas : gris ardoise chaud plutôt que noir, contraste modéré, un cuivre pour l'action.

![Ardoise](S03-ardoise/captures/01-dashboard-pilotage.webp)

**Pour :** Les longues journées : le sombre le moins fatigant, sans effet.

- Gris ardoise chaud (#1C1D20) plutôt que noir ; contraste du texte modéré (12:1, pas 20:1).
- En-têtes de widgets en bande légèrement plus claire, bordures visibles.
- Un seul cuivre pour l'action, l'onglet actif et le chiffre en retard.
- Aucun dégradé, aucune lueur : la structure seule.

| Fond | Surface | Bordure | Texte | Secondaire | Discret | Accent | Signal |
|---|---|---|---|---|---|---|---|
| `#1C1D20` | `#242529` | `#36383E` | `#E8E4DD` | `#BFBAB1` | `#9A958D` | `#E0915F` | `#E0915F` |

Contrastes : texte 12.1:1 · secondaire 7.9:1 · discret 5.1:1 · accent en texte 7.4:1 · bouton 6.7:1 · navigation 13.0:1. Polices : Instrument Sans, JetBrains Mono. Feuille : [`nexora-ardoise.css`](S03-ardoise/nexora-ardoise.css).

<details><summary>Toutes les vues</summary>

| | |
|---|---|
| **Tableau de bord Pilotage**<br>![Tableau de bord Pilotage](S03-ardoise/captures/01-dashboard-pilotage.webp) | **Planning & équipe**<br>![Planning & équipe](S03-ardoise/captures/02-dashboard-planning-equipe.webp) |
| **Suivi & décisions**<br>![Suivi & décisions](S03-ardoise/captures/03-dashboard-suivi.webp) | **Planning Projets**<br>![Planning Projets](S03-ardoise/captures/04-planning-projets.webp) |
| **Gantt**<br>![Gantt](S03-ardoise/captures/05-gantt.webp) | **Aujourd'hui**<br>![Aujourd'hui](S03-ardoise/captures/06-aujourdhui.webp) |
| **Calendrier**<br>![Calendrier](S03-ardoise/captures/07-calendrier.webp) | **Tableur**<br>![Tableur](S03-ardoise/captures/08-tableur.webp) |
| **Fiche tâche**<br>![Fiche tâche](S03-ardoise/captures/09-fiche-tache.webp) | **Heat map**<br>![Heat map](S03-ardoise/captures/10-heatmap.webp) |
| **Pixel Tasks**<br>![Pixel Tasks](S03-ardoise/captures/11-pixel-tasks.webp) |  |

</details>

## S04 · Phosphore

> Cockpit d'avion : chiffres ambrés en afficheur, vert phosphore pour ce qui va bien, tout le reste en retrait.

![Phosphore](S04-phosphore/captures/01-dashboard-pilotage.webp)

**Pour :** Pilotage par les chiffres : tout ce qui se mesure ressort comme sur un cockpit.

- Coins de cadran ambrés aux quatre angles de chaque widget, lignes de balayage très discrètes.
- Chiffres clés en JetBrains Mono légère, ambre lumineux ; le troisième en vert phosphore.
- Titres en capitales espacées comme des étiquettes d'instrument ; dates et nombres en chasse fixe.
- Onglet actif ambré avec un léger halo.

| Fond | Surface | Bordure | Texte | Secondaire | Discret | Accent | Signal |
|---|---|---|---|---|---|---|---|
| `#0C0F0D` | `#121714` | `#233027` | `#E4EDE6` | `#ABBDAF` | `#829686` | `#FFB547` | `#FFB547` |

Contrastes : texte 15.2:1 · secondaire 9.2:1 · discret 5.7:1 · accent en texte 11.3:1 · bouton 10.6:1 · navigation 15.4:1. Polices : IBM Plex Sans, IBM Plex Sans Condensed, JetBrains Mono. Feuille : [`nexora-phosphore.css`](S04-phosphore/nexora-phosphore.css).

<details><summary>Toutes les vues</summary>

| | |
|---|---|
| **Tableau de bord Pilotage**<br>![Tableau de bord Pilotage](S04-phosphore/captures/01-dashboard-pilotage.webp) | **Planning & équipe**<br>![Planning & équipe](S04-phosphore/captures/02-dashboard-planning-equipe.webp) |
| **Suivi & décisions**<br>![Suivi & décisions](S04-phosphore/captures/03-dashboard-suivi.webp) | **Planning Projets**<br>![Planning Projets](S04-phosphore/captures/04-planning-projets.webp) |
| **Gantt**<br>![Gantt](S04-phosphore/captures/05-gantt.webp) | **Aujourd'hui**<br>![Aujourd'hui](S04-phosphore/captures/06-aujourdhui.webp) |
| **Calendrier**<br>![Calendrier](S04-phosphore/captures/07-calendrier.webp) | **Tableur**<br>![Tableur](S04-phosphore/captures/08-tableur.webp) |
| **Fiche tâche**<br>![Fiche tâche](S04-phosphore/captures/09-fiche-tache.webp) | **Heat map**<br>![Heat map](S04-phosphore/captures/10-heatmap.webp) |
| **Pixel Tasks**<br>![Pixel Tasks](S04-phosphore/captures/11-pixel-tasks.webp) |  |

</details>

## S05 · Velours

> Salon de nuit : aubergine profonde, rose poudré pour agir, or pour aujourd'hui, cartes en verre fumé.

![Velours](S05-velours/captures/01-dashboard-pilotage.webp)

**Pour :** Un usage personnel soigné, plus doux que technique.

- Voiles rose et or sur fond aubergine ; cartes en verre fumé à grands rayons (16 px).
- Boutons et bouton de création en dégradé rose → or.
- Onglets en pilules ; chiffres clés de 44 px, un sur deux en rose.
- Navigation translucide.

| Fond | Surface | Bordure | Texte | Secondaire | Discret | Accent | Signal |
|---|---|---|---|---|---|---|---|
| `#15111A` | `#1D1724` | `#33283F` | `#F1E9F2` | `#C8B8CD` | `#A08FA7` | `#F2A7C3` | `#F7C873` |

Contrastes : texte 14.7:1 · secondaire 9.3:1 · discret 5.8:1 · accent en texte 10.1:1 · bouton 9.4:1 · navigation 14.9:1. Polices : Manrope, JetBrains Mono. Feuille : [`nexora-velours.css`](S05-velours/nexora-velours.css).

<details><summary>Toutes les vues</summary>

| | |
|---|---|
| **Tableau de bord Pilotage**<br>![Tableau de bord Pilotage](S05-velours/captures/01-dashboard-pilotage.webp) | **Planning & équipe**<br>![Planning & équipe](S05-velours/captures/02-dashboard-planning-equipe.webp) |
| **Suivi & décisions**<br>![Suivi & décisions](S05-velours/captures/03-dashboard-suivi.webp) | **Planning Projets**<br>![Planning Projets](S05-velours/captures/04-planning-projets.webp) |
| **Gantt**<br>![Gantt](S05-velours/captures/05-gantt.webp) | **Aujourd'hui**<br>![Aujourd'hui](S05-velours/captures/06-aujourdhui.webp) |
| **Calendrier**<br>![Calendrier](S05-velours/captures/07-calendrier.webp) | **Tableur**<br>![Tableur](S05-velours/captures/08-tableur.webp) |
| **Fiche tâche**<br>![Fiche tâche](S05-velours/captures/09-fiche-tache.webp) | **Heat map**<br>![Heat map](S05-velours/captures/10-heatmap.webp) |
| **Pixel Tasks**<br>![Pixel Tasks](S05-velours/captures/11-pixel-tasks.webp) |  |

</details>

## S06 · Forêt

> Sous-bois : vert-noir, mousse lumineuse, ambre d'automne, police Lexend conçue pour la fluidité de lecture.

![Forêt](S06-foret/captures/01-dashboard-pilotage.webp)

**Pour :** Confort de lecture : Lexend a été conçue pour réduire la fatigue visuelle.

- Sous-bois vert-noir, lueur de canopée en bas à gauche, reflet ambré en haut.
- Filet de mousse en dégradé en tête de chaque carte.
- Premier indicateur en vert mousse, deuxième en ambre d'automne.
- Police Lexend, interlettrage plus ouvert.

| Fond | Surface | Bordure | Texte | Secondaire | Discret | Accent | Signal |
|---|---|---|---|---|---|---|---|
| `#0F1411` | `#151C17` | `#26332A` | `#E9EFE6` | `#B6C4B4` | `#8D9D8B` | `#9BD38A` | `#E8B86B` |

Contrastes : texte 14.8:1 · secondaire 9.5:1 · discret 6.1:1 · accent en texte 10.9:1 · bouton 9.9:1 · navigation 15.5:1. Polices : Lexend, JetBrains Mono. Feuille : [`nexora-foret.css`](S06-foret/nexora-foret.css).

<details><summary>Toutes les vues</summary>

| | |
|---|---|
| **Tableau de bord Pilotage**<br>![Tableau de bord Pilotage](S06-foret/captures/01-dashboard-pilotage.webp) | **Planning & équipe**<br>![Planning & équipe](S06-foret/captures/02-dashboard-planning-equipe.webp) |
| **Suivi & décisions**<br>![Suivi & décisions](S06-foret/captures/03-dashboard-suivi.webp) | **Planning Projets**<br>![Planning Projets](S06-foret/captures/04-planning-projets.webp) |
| **Gantt**<br>![Gantt](S06-foret/captures/05-gantt.webp) | **Aujourd'hui**<br>![Aujourd'hui](S06-foret/captures/06-aujourdhui.webp) |
| **Calendrier**<br>![Calendrier](S06-foret/captures/07-calendrier.webp) | **Tableur**<br>![Tableur](S06-foret/captures/08-tableur.webp) |
| **Fiche tâche**<br>![Fiche tâche](S06-foret/captures/09-fiche-tache.webp) | **Heat map**<br>![Heat map](S06-foret/captures/10-heatmap.webp) |
| **Pixel Tasks**<br>![Pixel Tasks](S06-foret/captures/11-pixel-tasks.webp) |  |

</details>

## S07 · Observatoire

> Coupole de nuit : bleu minuit, champ d'étoiles discret derrière les tableaux de bord, bleu stellaire et or polaire.

![Observatoire](S07-observatoire/captures/01-dashboard-pilotage.webp)

**Pour :** Effet le plus poétique, tout en restant sobre dans les cartes.

- Champ d'étoiles fixe (quatre tailles, quelques étoiles dorées) et nébuleuses bleue et violette sur le fond.
- Cartes légèrement translucides au halo bleuté ; police Sora.
- Chiffres clés fins et lumineux (bleu stellaire, or pour le retard).
- Fil « aujourd'hui » doré.

| Fond | Surface | Bordure | Texte | Secondaire | Discret | Accent | Signal |
|---|---|---|---|---|---|---|---|
| `#090D18` | `#0F1424` | `#222A42` | `#E8ECF7` | `#AEB7CE` | `#848DA7` | `#8AB4FF` | `#F5CE6B` |

Contrastes : texte 15.5:1 · secondaire 9.1:1 · discret 5.5:1 · accent en texte 9.9:1 · bouton 8.9:1 · navigation 15.6:1. Polices : Sora, JetBrains Mono. Feuille : [`nexora-observatoire.css`](S07-observatoire/nexora-observatoire.css).

<details><summary>Toutes les vues</summary>

| | |
|---|---|
| **Tableau de bord Pilotage**<br>![Tableau de bord Pilotage](S07-observatoire/captures/01-dashboard-pilotage.webp) | **Planning & équipe**<br>![Planning & équipe](S07-observatoire/captures/02-dashboard-planning-equipe.webp) |
| **Suivi & décisions**<br>![Suivi & décisions](S07-observatoire/captures/03-dashboard-suivi.webp) | **Planning Projets**<br>![Planning Projets](S07-observatoire/captures/04-planning-projets.webp) |
| **Gantt**<br>![Gantt](S07-observatoire/captures/05-gantt.webp) | **Aujourd'hui**<br>![Aujourd'hui](S07-observatoire/captures/06-aujourdhui.webp) |
| **Calendrier**<br>![Calendrier](S07-observatoire/captures/07-calendrier.webp) | **Tableur**<br>![Tableur](S07-observatoire/captures/08-tableur.webp) |
| **Fiche tâche**<br>![Fiche tâche](S07-observatoire/captures/09-fiche-tache.webp) | **Heat map**<br>![Heat map](S07-observatoire/captures/10-heatmap.webp) |
| **Pixel Tasks**<br>![Pixel Tasks](S07-observatoire/captures/11-pixel-tasks.webp) |  |

</details>

## S08 · Carbone

> Écran OLED : noir carbone, cartes à peine relevées, un vert citron électrique, chiffres en Geist Mono.

![Carbone](S08-carbone/captures/01-dashboard-pilotage.webp)

**Pour :** Écrans OLED et goût du minimalisme technique.

- Noir carbone, cartes à peine relevées, aucun séparateur d'en-tête.
- Un seul vert citron, réservé à l'action, l'onglet actif et le fil « aujourd'hui ».
- Barre d'outils fantôme ; actions des widgets masquées hors survol.
- Chiffres en Geist Mono ; puces en contour fin.

| Fond | Surface | Bordure | Texte | Secondaire | Discret | Accent | Signal |
|---|---|---|---|---|---|---|---|
| `#060606` | `#0F0F0F` | `#232323` | `#EDEDED` | `#B5B5B5` | `#8C8C8C` | `#C6F432` | `#C6F432` |

Contrastes : texte 16.4:1 · secondaire 9.3:1 · discret 5.7:1 · accent en texte 15.4:1 · bouton 15.3:1 · navigation 16.2:1. Polices : Geist, Geist Mono. Feuille : [`nexora-carbone.css`](S08-carbone/nexora-carbone.css).

<details><summary>Toutes les vues</summary>

| | |
|---|---|
| **Tableau de bord Pilotage**<br>![Tableau de bord Pilotage](S08-carbone/captures/01-dashboard-pilotage.webp) | **Planning & équipe**<br>![Planning & équipe](S08-carbone/captures/02-dashboard-planning-equipe.webp) |
| **Suivi & décisions**<br>![Suivi & décisions](S08-carbone/captures/03-dashboard-suivi.webp) | **Planning Projets**<br>![Planning Projets](S08-carbone/captures/04-planning-projets.webp) |
| **Gantt**<br>![Gantt](S08-carbone/captures/05-gantt.webp) | **Aujourd'hui**<br>![Aujourd'hui](S08-carbone/captures/06-aujourdhui.webp) |
| **Calendrier**<br>![Calendrier](S08-carbone/captures/07-calendrier.webp) | **Tableur**<br>![Tableur](S08-carbone/captures/08-tableur.webp) |
| **Fiche tâche**<br>![Fiche tâche](S08-carbone/captures/09-fiche-tache.webp) | **Heat map**<br>![Heat map](S08-carbone/captures/10-heatmap.webp) |
| **Pixel Tasks**<br>![Pixel Tasks](S08-carbone/captures/11-pixel-tasks.webp) |  |

</details>

## S09 · Lecture

> Le sombre fait pour lire : sépia nocturne, Atkinson Hyperlegible en 15 px, interligne généreux, aucun ornement.

![Lecture](S09-lecture/captures/01-dashboard-pilotage.webp)

**Pour :** Lire beaucoup de texte le soir : descriptions, notes, comptes rendus.

- Sépia nocturne, aucun dégradé, aucune lueur, aucune ombre.
- Atkinson Hyperlegible en 15 px, interligne 1,55 à 1,6 dans les widgets et les fenêtres.
- Lignes de tableau plus hautes, titres de widgets 15,5 px gras.
- Puces à repère de couleur et texte d'encre.

| Fond | Surface | Bordure | Texte | Secondaire | Discret | Accent | Signal |
|---|---|---|---|---|---|---|---|
| `#1B1915` | `#22201B` | `#3A362E` | `#EFE6D6` | `#CCC2B0` | `#A79D8E` | `#8DBBEA` | `#E9A86A` |

Contrastes : texte 13.1:1 · secondaire 9.2:1 · discret 6.1:1 · accent en texte 8.9:1 · bouton 8.2:1 · navigation 13.8:1. Polices : Atkinson Hyperlegible Next, Atkinson Hyperlegible Mono. Feuille : [`nexora-lecture.css`](S09-lecture/nexora-lecture.css).

<details><summary>Toutes les vues</summary>

| | |
|---|---|
| **Tableau de bord Pilotage**<br>![Tableau de bord Pilotage](S09-lecture/captures/01-dashboard-pilotage.webp) | **Planning & équipe**<br>![Planning & équipe](S09-lecture/captures/02-dashboard-planning-equipe.webp) |
| **Suivi & décisions**<br>![Suivi & décisions](S09-lecture/captures/03-dashboard-suivi.webp) | **Planning Projets**<br>![Planning Projets](S09-lecture/captures/04-planning-projets.webp) |
| **Gantt**<br>![Gantt](S09-lecture/captures/05-gantt.webp) | **Aujourd'hui**<br>![Aujourd'hui](S09-lecture/captures/06-aujourdhui.webp) |
| **Calendrier**<br>![Calendrier](S09-lecture/captures/07-calendrier.webp) | **Tableur**<br>![Tableur](S09-lecture/captures/08-tableur.webp) |
| **Fiche tâche**<br>![Fiche tâche](S09-lecture/captures/09-fiche-tache.webp) | **Heat map**<br>![Heat map](S09-lecture/captures/10-heatmap.webp) |
| **Pixel Tasks**<br>![Pixel Tasks](S09-lecture/captures/11-pixel-tasks.webp) |  |

</details>

## S10 · Cobalt

> Le Bauhaus de nuit : bleu cobalt profond, filets crème, aplats jaune et rouge, Outfit et angles droits.

![Cobalt](S10-cobalt/captures/01-dashboard-pilotage.webp)

**Pour :** Le Bauhaus que vous aimez, version nuit.

- Bleu cobalt profond, filets crème de 2 px, angles droits, police Outfit.
- Indicateurs en tuiles jaune, rouge et crème ; en-têtes de tableau jaunes.
- Onglet actif souligné de jaune ; navigation active en aplat jaune.
- Ombres pleines décalées pour les menus et le bouton de création.

| Fond | Surface | Bordure | Texte | Secondaire | Discret | Accent | Signal |
|---|---|---|---|---|---|---|---|
| `#0A1430` | `#0F1C40` | `#213466` | `#F4F0E6` | `#C6CADA` | `#9CA5C0` | `#FFD23F` | `#FF5A4E` |

Contrastes : texte 14.6:1 · secondaire 10.2:1 · discret 6.8:1 · accent en texte 12.1:1 · bouton 12.6:1 · navigation 15.9:1. Polices : Outfit, JetBrains Mono. Feuille : [`nexora-cobalt.css`](S10-cobalt/nexora-cobalt.css).

<details><summary>Toutes les vues</summary>

| | |
|---|---|
| **Tableau de bord Pilotage**<br>![Tableau de bord Pilotage](S10-cobalt/captures/01-dashboard-pilotage.webp) | **Planning & équipe**<br>![Planning & équipe](S10-cobalt/captures/02-dashboard-planning-equipe.webp) |
| **Suivi & décisions**<br>![Suivi & décisions](S10-cobalt/captures/03-dashboard-suivi.webp) | **Planning Projets**<br>![Planning Projets](S10-cobalt/captures/04-planning-projets.webp) |
| **Gantt**<br>![Gantt](S10-cobalt/captures/05-gantt.webp) | **Aujourd'hui**<br>![Aujourd'hui](S10-cobalt/captures/06-aujourdhui.webp) |
| **Calendrier**<br>![Calendrier](S10-cobalt/captures/07-calendrier.webp) | **Tableur**<br>![Tableur](S10-cobalt/captures/08-tableur.webp) |
| **Fiche tâche**<br>![Fiche tâche](S10-cobalt/captures/09-fiche-tache.webp) | **Heat map**<br>![Heat map](S10-cobalt/captures/10-heatmap.webp) |
| **Pixel Tasks**<br>![Pixel Tasks](S10-cobalt/captures/11-pixel-tasks.webp) |  |

</details>

