# Carte : styles de rendu

> **Livré dans la vue Carte** (Ref #387). Réglage *Affichage → Style de la carte*, conservé avec
> les autres préférences de vues. Code : bloc `NEXORA:CARTE` (modèles purs, testés par
> `apps/nexora/tests/carte.test.mjs`) et bloc `NEXORA:CARTE-ENGINE` (ambiance, contour, pluie).
> Maquettes d'origine : [`carte-directions/`](carte-directions/).

## Style ou thème : deux réglages distincts

| | Thème (par dossier) | Style (toute la vue) |
|---|---|---|
| Portée | Une région : les projets d'un dossier | Toute la carte |
| Réglage | *Thèmes par dossier…* ou réglages du dossier (`mapTheme`) | *Affichage → Style de la carte* (`viewPrefs.carte.style`) |
| Exemples | Ville, Désert, Mer… et **Cyberpunk** (#384) | **Classique**, **Archipel d'encre**, **Néon-Grille** |
| Effet | Relief, sol et objets de la région | Sol, mer, ciel, lumière et objets de toute la carte |

- **Classique**, le style par défaut, montre les thèmes de chaque dossier, comme avant.
- En **Archipel d'encre** ou en **Néon-Grille**, le thème d'un dossier ne décide plus que du
  **relief** : sommet, cratère, lac, gorge.
- Changer de style ne déplace aucun territoire, ne modifie aucune donnée et ne touche pas aux
  thèmes enregistrés sur les dossiers.
- Le thème de dossier **Cyberpunk** (#384) et le style **Néon-Grille** sont deux réglages
  indépendants.

Le sens des indices ne change pas d'un style à l'autre : un champ Nexora occupe toujours le
même canal visuel (voir [`CARTE_ANALOGIES.md`](CARTE_ANALOGIES.md)). Les paliers restent ceux
de [`CARTE_THEMES.md`](CARTE_THEMES.md). L'anneau rouge clignotant des tâches urgentes, la
coche des terminées et les routes de convoi s'affichent de la même façon dans tous les styles.

## Archipel d'encre (estampe japonaise)

Aplats en trois tons et contour à l'encre, mer de vagues seigaiha, fond de papier washi,
soleil rouge et bandes de brume dorée au large.

| | |
|---|---|
| Dossier · projet · tâche | Île à falaises ocre · domaine de mousse et de gravier · parcelle |
| Progression du territoire | Rocher nu → ermitage → jardin sec → temple → monastère → **château blanc** |
| À faire | Sable ratissé autour d'une pierre |
| En attente | Fondation de pagode et barrière de bambou fermée |
| En cours (avancement) | Pagode en bois brut : **un toit par palier** (0, 20, 40, 60, 80 %), sous échafaudage de bambou |
| Terminé | Pagode vermillon à cinq toits, faîte doré |
| Information | Planche d'ema |
| Tâche · réunion · planning · jalon | Pagode · maison de thé · clocher (bonshō) · torii |
| Urgente · moyenne | Lanterne de papier rouge · bannière nobori orange |
| En retard · échéance sous 7 j | Nuage d'encre et pluie · lanterne de pierre allumée |
| Début à venir | Bande de brume (kasumi) |
| Responsable | Personnage en kimono à sa couleur, chapeau de paille |
| Récurrence · sous-tâches | Moulinet de papier · bonsaïs (pot vide, puis arbre) |
| Friche | Mousse et feuilles d'érable |
| Pont sur l'eau | Pont vermillon |

Un jalon, une réunion ou un planning pas encore terminé reste en bois brut, puis prend sa
peinture à la fin. La barrière signale l'attente, l'échafaudage le chantier en cours.

## Néon-Grille (cyberpunk)

Mégapole de nuit : sol sombre, mer remplacée par une grille violette, silhouettes d'immeubles
au loin, pluie qui suit la caméra. Chaque dossier est un district bordé d'un néon de couleur
stable, plus vif sur ses frontières.

| | |
|---|---|
| Dossier · projet · tâche | District néon · mégabloc · cellule |
| Progression du territoire | Terrain vague → squat de conteneurs → marché noir → complexe → arcologie → **mégatour** |
| À faire | Plan holographique en fil de fer |
| En attente | Base de tour éteinte, barrière rouge lumineuse |
| En cours (avancement) | Impression 3D : la partie pleine monte avec l'avancement, plateau magenta à la découpe |
| Terminé | Tour pleine, étages allumés à la couleur du projet |
| Information | Panneau holographique |
| Tâche · réunion · planning · jalon | Tour · dôme de verre · antenne radar · flèche et faisceau |
| Urgente · moyenne | Gyrophare rouge · balise ambre |
| En retard · échéance sous 7 j | Glitch rouge autour de la tour · anneau cyan au sol |
| Début à venir | Smog violet |
| Responsable | Drone à sa couleur |
| Récurrence · sous-tâches | Radar qui tourne · caissons (allumés une fois faits) |
| Friche | Enseigne éteinte et rouille |

La durée d'une tâche règle la largeur de la tour : courte, moyenne ou longue.

## Performances

- Les styles gardent l'instanciation par couple géométrie × matériau.
- Le contour à l'encre réutilise les instances existantes (coque inversée) : aucune copie des
  matrices.
- Les ombres portées sont coupées dans les deux styles.
- En qualité basse ou si le mouvement réduit est demandé, la pluie de Néon-Grille est coupée.
- En grands volumes, les plans holographiques perdent leurs arêtes.

## Contrôle visuel

`tools/visual-check` ouvre la carte de démonstration dans chaque style (`&style=estampe`,
`&style=neon`), de près puis en vue d'ensemble. Il vérifie qu'aucun libellé ne se superpose,
puis revient au style Classique par le menu *Affichage*. Captures produites :
`carte-estampe*.png` et `carte-neon*.png`.
