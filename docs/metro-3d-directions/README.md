# Réseau du temps : maquettes 3D de la Vue Métro (Ref #452)

Trois maquettes de rendu pour une vue 3D des projets et tâches **orientée temps**, avant tout développement.
**Données fictives uniquement.** Ce fichier n'est pas servi par Netlify.

| Maquette | Axe du temps | Navigation |
|---|---|---|
| 1 · Le Plan en relief | Horizontal, voies empilées par dossier | Orbite, défilement le long de l'axe |
| 2 · La Cabine | Profondeur, faisceau de lignes autour de la caméra | Vue conducteur, on avance dans le temps |
| 3 · L'Étoile | Rayon depuis la gare centrale « Aujourd'hui », passé en souterrain | Orbite, anneau d'horizon et zones de 7 à 120 jours |

Règles communes, reprises de la Vue Métro 2D (`ProjectMetroView`, projection de la fiche PDF) :

- ligne = projet, station = tâche posée à son échéance ;
- échelle de temps linéaire, identique sur toutes les lignes ;
- action de plus de 3 jours = bifurcation depuis sa date de début ;
- jalon = losange, dépendance entre projets = correspondance ;
- train = aujourd'hui, tronçon parcouru grisé ;
- tableau « Prochains départs » et fiche avec station précédente, station suivante et correspondance.

Captures de la vue d'ouverture : `rendu-1-plan.png`, `rendu-2-cabine.png`, `rendu-3-etoile.png`.

`index.html` est une page autonome : l'ouvrir dans un navigateur. three.js r128 est chargé depuis cdnjs.
