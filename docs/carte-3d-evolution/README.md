# Carte 3D : évolution par lots

Avant / après de la vue Carte sur **la même carte** (mêmes territoires, mêmes tâches, même caméra).
Chaque lot s'ajoute au précédent.

| Étape | Image | Contenu |
| --- | --- | --- |
| Maintenant | `etape-0.png` | Rendu actuel : matières mates à facettes, ciel uni, horloges et avatars saturés. |
| Lot 1 | `etape-1.png` | Lumière et matières : reflets du ciel, feuillages lisses, ombres de contact, bloom, étalonnage chaud, signaux harmonisés. |
| Lot 2 | `etape-2.png` | Terrain, eau et ciel : plages et galets, coutures adoucies, herbe dense, eau avec profondeur et écume, ombres de nuages, brume. |
| Lot 3 | `etape-3.png` | Game feel : interface bois et parchemin, panneaux plantés dans le décor, sélection dorée, papillons, oiseaux, lucioles. |
| Lot 4 | `etape-4.png` | Vrais modèles 3D gratuits (Kenney, CC0), recolorés dans la palette. |

`planche.png` rassemble les cinq images, avec un zoom sur le Lot 2B.

Maquette interactive : `index.html?s=0` à `?s=4` (ajouter `&still=1` pour une image fixe).
Elle charge three.js depuis cdn.jsdelivr.net ; il faut donc la servir en HTTP.

## Modèles (`modeles/`)

Tous sous licence **CC0** (domaine public), par Kenney (www.kenney.nl). Ils sont récupérés depuis les kits de démarrage publiés par Kenney sur GitHub :

- `ville/` : Starter Kit City Builder (immeubles recolorés en terre cuite, ocre et crème) ;
- `plateforme/` : Starter Kit 3D Platformer (personnage, pièce, drapeau, buissons) ;
- `arene/` : Mini Arena, via Starter Kit Basic Scene (sapin, bannière, trophée, chevalier, briques).

Pour l'intégration réelle, les packs Kenney *Fantasy Town Kit* / *Nature Kit* et Quaternius *Medieval Village* (également CC0) seraient plus adaptés au style village. Ils n'étaient pas téléchargeables depuis l'environnement de travail.
