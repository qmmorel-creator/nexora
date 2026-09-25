# Réseau du temps : maquettes 3D de la Vue Métro (Ref #452)

Quatre maquettes de rendu pour une vue 3D des projets et tâches **orientée temps**, avant tout développement.
**Données fictives uniquement.** Ce fichier n'est pas servi par Netlify.

| Maquette | Axe du temps | Navigation |
|---|---|---|
| 1 · Le Plan en relief | Horizontal, voies empilées par dossier | Orbite, défilement le long de l'axe |
| 2 · La Cabine | Profondeur, faisceau de lignes autour de la caméra, en plein jour | Vue conducteur ; bouton Rouler, portiques qui s'illuminent, prochain arrêt annoncé |
| 3 · L'Étoile | Rayon depuis la gare centrale « Aujourd'hui », passé en souterrain | Orbite, anneau d'horizon et zones de 7 à 120 jours |
| 4 · Grande Ligne | Horizontal, réseau ferré miniature : voies sur ballast, gares, signaux, passage à niveau | Orbite autour de la table, défilement le long des voies |

Règles communes, reprises de la Vue Métro 2D (`ProjectMetroView`, projection de la fiche PDF) :

- ligne = projet, station = tâche posée à son échéance ;
- échelle de temps linéaire, identique sur toutes les lignes ;
- action de plus de 3 jours = bifurcation depuis sa date de début ;
- jalon = losange, dépendance entre projets = correspondance ;
- train = aujourd'hui, tronçon parcouru grisé ;
- tableau « Prochains départs » et fiche avec station précédente, station suivante et correspondance.

Captures de la vue d'ouverture : `rendu-1-plan.png`, `rendu-2-cabine.png`, `rendu-3-etoile.png`, `rendu-4-grande-ligne.png`, `rendu-4-grande-ligne-lecture.png`, `rendu-4-grande-ligne-gare.png`, `rendu-4-vue-conducteur.png`.

Animations de la Grande Ligne : bouton Lecture (la date avance, les trains à vapeur la suivent, chaque gare desservie réagit), train envoyé vers la gare cliquée, barrières et feux du passage à niveau, voitures qui s'arrêtent, fumée, horloges à l'heure réelle, nuages, voyageurs qui montent à l'arrivée du train, vitesse de lecture (lent, normal, rapide) et vue conducteur depuis la locomotive d'une ligne, avec arrêt à chaque gare pendant la lecture. Page en thème clair uniquement.

`index.html` est une page autonome : l'ouvrir dans un navigateur. three.js r128 est chargé depuis cdnjs.
