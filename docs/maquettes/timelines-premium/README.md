# Timelines premium : prototype comparatif des six représentations

Demande de Quentin du 03/10/2026, d'après le prompt ChatGPT « Nexora : huit représentations premium de timeline ».
Concepts conservés par Quentin (retour du 03/10/2026) :
- 21 Briques techniques, 27 Conduite hydraulique, 06 Nuages de points ;
- 07 Courbes de niveau, refaites façon carte IGN ;
- 09 Trajectoires et 10 Prismes plats, refaits d'après les planches ChatGPT.

04 Lentilles et 12 Séquences éditoriales sont retirés.

**Rien n'est déployé et la production n'est pas modifiée** (consigne du prompt).
Ce dossier est une maquette : aucun site Netlify ne le publie.

## Ouvrir

Ouvrir `prototype.html` dans un navigateur. Le fichier est autonome : aucune dépendance, HTML, CSS et SVG.
Seules les polices viennent de Google Fonts, avec repli système.

Réglages :
- représentation : les 6 styles ;
- thème : calendrier, hydraulique, génie civil, pilotage, loisirs, sport ;
- densité : compact ou expressif ;
- zoom : 2 semaines, mois ou trimestre ;
- comparaison : « Un style » ou « Les 6 » empilés.

Interactions :
- survol : dates, durée, avancement, référence et risque ;
- clic : sélection ;
- flèches ↑ ↓ : sélection précédente ou suivante.

Les règles visuelles de chaque style et la recommandation sont en bas de la page.

## Jeu de données (identique pour les 6 styles)

- **14 tâches** sur octobre 2026 : durées de 1 à 18 jours, libellés longs et 3 jalons.
- **Dépendances.**
- **Références de planning** sur 2 tâches seulement.
- **Un risque**, sur une seule tâche.
- **Avancement** : tâches terminées, non commencées, et une tâche sans avancement renseigné (« avancement ? »).
- **Aujourd'hui** : le 18 octobre, sans lien avec l'avancement.

Ce qui encode une information :
- position et longueur : dates, sur une échelle linéaire commune ;
- découpe plein / pâle texturé : avancement (la couleur n'est pas le seul indice) ;
- couleur : projet (couleurs métier conservées) ;
- triangle et libellé « risque » ;
- trait pointillé : référence de planning.

Ce qui est décoratif, identique pour toutes les tâches :
- hauteur des prismes ;
- relief, sommets et nombre de courbes de niveau ;
- nombre de brins et halo des trajectoires ;
- densité des particules ;
- amplitude des trajectoires ;
- facettes.

## Écarts volontaires avec les planches ChatGPT

- **Trajectoires** : la planche écrit une date sous la bille d'avancement. Le prototype y écrit le pourcentage, car l'avancement n'est pas une date (contrainte du prompt).
- **Courbes de niveau** : les isolignes sont calculées sur un relief fictif par *marching squares*. C'est ce qui donne les courbes irrégulières, les petits sommets isolés et les courbes maîtresses d'une carte IGN. Aucune cote n'est affichée, pour ne pas suggérer une valeur.
- **Animations** : seules deux sont implémentées, le flux de la Conduite et le tracé des Trajectoires. Les autres sont décrites comme des propositions.

## Ce qui n'a pas pu être fait

- **ImageGen n'est pas disponible dans cet environnement** : il n'y a donc pas de planches d'images générées. Le prototype interactif tient lieu de maquette. Ses rendus sont exacts (dates et pourcentages calculés), ce qu'une image générée ne garantit pas.
- **Captures de Nexora** : non utilisées. Le prototype reprend les conventions d'Optim, le portage de Nexora (`apps/nexora-future-optim/src/optim/frise.tsx`).
- **Images partagées par ChatGPT** : seules les vignettes d'aperçu de la page ont été récupérées. Elles servent de référence d'intention, pas de modèle.

## Références graphiques (principes retenus)

Ces références viennent de ma connaissance de ces sites. Je ne les ai pas consultées pendant cette session.

- [Linear](https://linear.app) : encre presque noire sur fond chaud, filets fins, densité sans bruit. Retenu pour la grille et la typographie.
- [Things](https://culturedcode.com/things/) : formes douces, peu de couleurs, états lisibles. Retenu pour les bornes pleine / creuse.
- [Stripe Press](https://press.stripe.com) : composition éditoriale, serif de titrage. Retenu pour les titres et les dates des Trajectoires (Fraunces).
- [Edward Tufte, sparklines](https://www.edwardtufte.com) : le minimum d'encre par donnée. Retenu pour les Trajectoires et la règle « pas de forme qui suggère une donnée absente ».
- [Pentagram](https://www.pentagram.com) : systèmes graphiques cohérents d'un support à l'autre. Retenu pour des thèmes qui ne changent que le fond, la grille, le motif et l'accent.

## Intégration prévue dans Optim (après le choix de Quentin)

Le Gantt d'Optim a déjà un sélecteur de style :
- `STYLES_GANTT` dans `apps/nexora-future-optim/src/donnees/prefs.ts`, enregistré dans `nexora:optimPrefs` ;
- rendu par style dans `src/optim/frise.tsx`, moteur temporel commun et lignes en HTML.

Étapes :
1. Ajouter les styles retenus à `STYLES_GANTT`. `normalize` ignore déjà les valeurs inconnues, ce qui permet un retour arrière sans perte.
2. Dans `frise.tsx`, dessiner chaque style dans un petit SVG par barre, aux dimensions de la barre actuelle. On garde le moteur (positions, zoom, dépendances, survol, clic) et le modèle métier.
3. Les fonctions `D.*` du prototype se portent telles quelles. Elles ne dépendent que de `(x0, x1, cy, hauteur, couleur, avancement, tâche)`.
4. Garder les tests de normalisation des préférences et ajouter un test de non-régression par style.
