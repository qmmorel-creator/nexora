# Directions artistiques de la Carte

Trois maquettes de direction artistique pour la vue Carte, avant tout développement.
**Données fictives uniquement** (reprises du jeu d'essai du Rucher). Ce fichier n'est pas servi par Netlify.

| Direction | Maille | Dossier → Projet → Tâche |
|---|---|---|
| I · Le Grimoire des Profondeurs (Donjons & Dragons) | Carrée : salles de 7 × 7 cases | Niveau de donjon → Salle → Case |
| II · Néon-Grille (cyberpunk) | Hexagonale actuelle | District → Mégabloc → Cellule |
| III · L'Archipel d'encre (estampe japonaise) | Hexagonale, en îles | Île → Domaine → Parcelle |

Les trois directions gardent la règle « un champ, un canal » de [`../CARTE_ANALOGIES.md`](../CARTE_ANALOGIES.md)
et les six paliers de territoire de [`../CARTE_THEMES.md`](../CARTE_THEMES.md). Seuls le décor et les objets changent.

`index.html` est une page autonome : ouvrir le fichier dans un navigateur. three.js r128 est chargé depuis cdnjs.
La disposition hexagonale reprend celle du bloc `NEXORA:CARTE` (territoires de rayon 4, pavage sans trou).
