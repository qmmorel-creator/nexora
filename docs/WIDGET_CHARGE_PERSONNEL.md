# Widget « Charge personnel » — qui est où, et quel jour

Nexora sait dire ce qu'il y a à faire et quand. Il ne savait pas dire **qui est
où**. Une tâche a un responsable, pas un lieu ; et « Vincent est au chantier
mardi et jeudi » n'est pas du travail à faire, c'est une affectation.

Ce widget comble ce trou, au format le plus direct qui soit : les **personnes en
lignes**, les **jours en colonnes**, et dans chaque case les **ateliers** de ce
jour-là — plusieurs si besoin.

Issue d'origine : #124. Maquette validée avant développement.

## Ce que ce widget n'est pas

Il ne montre **pas de tâches**. Il n'a donc ni filtre de tâches, ni cadrage
hérité du Mini-Gantt, ni tri. Une affectation ne crée ni ne modifie jamais une
tâche, et réciproquement. C'est une décision, pas un oubli : mêler les deux
aurait donné un troisième calendrier à tenir à jour.

## Le graphisme est celui de la heat map, exprès

Cases arrondies posées sur une trame régulière, liseré d'accent sur aujourd'hui,
week-end atténué, légende en pied. Ce n'est pas une coquetterie : c'est la même
lecture « une case = une journée » que Nexora propose déjà ailleurs, et
l'apprendre deux fois n'apporterait rien.

**Une seule grille CSS** porte l'en-tête, les lignes et le pied. Les colonnes
s'alignent alors d'elles-mêmes, sans qu'aucune largeur n'ait à être tenue en
trois endroits — le défaut classique d'un tableau construit en trois blocs.

## Deux magasins, et pourquoi deux

| Clé | Ce qu'elle porte | Pourquoi elle est seule |
|---|---|---|
| `nexora:workshops` | le **catalogue** d'ateliers : un nom, une couleur, un ordre | c'est un réglage — rarement modifié, lu partout |
| `nexora:staffing` | les **affectations** : une entrée par personne × jour | ce sont des données — beaucoup, et qui changent tout le temps |

Les mêler aurait fait relire tout l'historique d'affectation à chaque renommage
d'atelier.

Le **catalogue** entre dans le contexte partagé (`ctx.workshops`), comme les
statuts ou les types de jalon : n'importe quel widget peut avoir à lire le nom et
la couleur d'un atelier. Les **affectations** n'y entrent pas — seul ce widget
les lit, et les faire transiter par `ctx` aurait fait re-rendre tous les autres à
chaque case cochée.

### L'identifiant d'une case est dérivé, jamais tiré au sort

```
id = "<nom de la personne>|<AAAA-MM-JJ>"
```

Les deux clés sont dans `NEXORA_MERGEABLE_KEYS` : la synchronisation les fusionne
élément par élément. Un identifiant aléatoire aurait fait de deux sessions
affectant la même case **deux affectations concurrentes pour un seul jour**. Avec
un identifiant dérivé, elles produisent la même entrée, et la fusion tranche.

### Une case vide n'est pas une donnée

Elle n'est pas écrite. C'est ce qui garde le magasin proportionnel à ce qui est
réellement affecté, et non au nombre de personnes multiplié par le nombre de
jours. « Tout retirer » efface l'entrée plutôt que d'en laisser une coquille
indiscernable d'une affectation vide.

### Un atelier supprimé quitte les affectations

`normalizeStaffingEntries(list, knownWorkshopIds)` filtre sur le catalogue **à la
lecture**, et non par un balayage séparé qu'on oublierait d'appeler. La
suppression dans les Réglages chiffre d'abord les jours concernés et demande
confirmation.

C'est la différence assumée avec un type de jalon, qui retombe sur le premier du
catalogue pour que le repère reste visible : ici, remplacer silencieusement un
atelier supprimé par « Usine » écrirait une affectation que personne n'a
demandée. `workshopFor` retourne donc `null`, et la bande disparaît.

## La case : les quartiers de la heat map

Les ateliers du jour se partagent la case en **quartiers égaux**, par un
`conic-gradient(from 45deg, …)` — exactement la technique de la heat map
mensuelle, pas une variante.

Elle est passée par des **bandes verticales**, qui disaient la même chose. Le
partage en quartiers le dit mieux : la diagonale saute aux yeux même sur une case
de vingt pixels, là où deux bandes de dix pixels ne se distinguaient plus
(retour de test).

Conséquence agréable : **aucune limite**. Les bandes s'arrêtaient à trois, une
quatrième n'étant plus qu'un trait ; quatre quartiers restent quatre quartiers.

### Ce que la case écrit dépend de la largeur MESURÉE

Un `ResizeObserver` suit la grille, et `staffingCellLabel` reçoit la largeur
réelle d'une case :

| Cas | Ce qui s'écrit |
|---|---|
| un seul atelier, ≥ 62 px | le nom entier — « Chantier » |
| un seul atelier, ≥ 22 px | le code à deux lettres — « CH » |
| un seul atelier, en dessous | rien : la couleur, et l'infobulle prend le relais |
| **plusieurs ateliers** | rien, quelle que soit la place |

Un mot posé sur une case partagée en quartiers chevaucherait deux couleurs et ne
se lirait sur aucune. Le libellé est donc réservé à l'aplat.

Le code court est **dérivé du nom** (`workshopCode`), jamais saisi à part : un
atelier renommé change de code sans que personne ait à y penser.

### L'infobulle est un carton sombre, et son texte doit s'y lire

Les trois lignes du détail héritaient des couleurs de texte de la **page**
(`--text-900`, `--text-600`) alors qu'elles se posent sur le carton **sombre** des
infobulles de Nexora : de l'encre presque noire sur un fond presque noir, où l'on
ne voyait plus que la pastille de couleur (retour de test). Elles prennent
désormais les couleurs du carton, comme son titre et sa date juste au-dessus.

C'est le genre de défaut qu'un test de fonction ne voit pas — il n'y a pas de
fonction fautive. La suite lit donc la **feuille de style construite** et refuse
que ces trois lignes reprennent une couleur de texte de page.

### La couleur ne porte jamais seule l'information

Code dans la bande quand il y a la place, nom dans l'infobulle, nom dans la
légende, et `aria-label` complet sur chaque case. Une grille qui ne se lirait
qu'en couleur serait illisible pour une partie des gens qui la regardent.

## Un atelier se crée aussi depuis la case

Le besoin se découvre en affectant — « tiens, il manque Grue ». Renvoyer dans les
Réglages pour revenir ensuite ferait perdre la case qu'on était en train de
remplir : le sélecteur crée donc l'atelier sur place, avec sa couleur, et le
**pose aussitôt sur la case**. C'est pour elle qu'on l'a créé.

Il entre dans le **même catalogue** que les autres, marqué `custom`. Un second
magasin aurait donné deux endroits où chercher « Grue », et deux règles de
suppression.

Son identifiant est **dérivé de son nom**, comme celui d'une case l'est de la
personne et du jour : deux sessions qui créent « Grue » au même moment écrivent
le même atelier, que la fusion traite comme un seul. Un nom déjà au catalogue ne
crée rien et rend l'atelier **existant** — « Usine » saisi dans le sélecteur est
l'atelier Usine, et deux entrées de même nom ne se distingueraient qu'à la
couleur.

### Le sélecteur range par type, pas par état

Deux groupes : **Ateliers standards** (ceux des Réglages) et **Ateliers
personnalisés** (ceux nés dans un widget). Un seul type au catalogue : pas de
titre, il n'y a rien à distinguer.

Les ateliers cochés remontaient d'abord en tête. C'était une erreur : les lignes
se déplaçaient sous le curseur à chaque clic — on cochait « Usine » et « Bureau »
changeait de place. L'ordre est maintenant celui du catalogue, stable, et la
coche se voit à la coche.

## La fenêtre : mois par défaut

Le décalage se compte en **périodes**, pas en jours : « mois suivant » tombe sur
le mois suivant, quelle que soit sa longueur — février bissextile et passage
d'année compris. Une semaine commence le lundi, et un dimanche appartient à la
semaine qui le précède.

### Une quatrième fenêtre : la plage choisie à la main

Les trois premières granularités sont des **périodes de calendrier** ; « Plage »
est un intervalle que son auteur fixe, par deux dates. Elle se navigue quand
même : les flèches la font glisser de sa **propre durée**, pour que « suivant »
montre l'intervalle d'après, de la même longueur.

Trois décisions à son sujet :

| Cas | Ce qui se passe | Pourquoi |
|---|---|---|
| dates à l'envers (« du 30 au 12 ») | remises à l'endroit | on sait ce que la saisie voulait dire ; une grille vide ne le dirait pas |
| une seule des deux dates | le mois en cours | le widget montre quelque chose pendant qu'on saisit la seconde |
| plus de 120 jours | ramenée à 120 | c'est une grille, pas un export : au-delà, les colonnes tombent sous le pixel |

Le week-end reste **affectable** : il est atténué, pas retiré. Un chantier
travaille le samedi, et une grille qui le cacherait mentirait sur la charge.
L'option « afficher les week-ends » ne fait que masquer les colonnes — jamais les
affectations, qui survivent au masquage et reparaissent dans une autre
granularité.

## Les personnes affichées : deux populations

**Sélection propre au widget**, et c'est le point : deux widgets côte à côte
suivent deux équipes différentes.

- Les **utilisateurs enregistrés** de Nexora, cochés **un par un**. Aucune coche
  veut dire **personne**.
- Des personnes **ajoutées à la main** dans le widget, autant qu'on veut : un
  intérimaire, un sous-traitant, un renfort. Les faire entrer dans l'annuaire
  pour les planifier reviendrait à leur ouvrir Nexora.

Une personne retirée de l'annuaire disparaît d'elle-même ; une personne ajoutée
à la main reste, elle n'était nulle part ailleurs.

### « Aucune coche » a changé de sens, et c'est délibéré

Une sélection vide affichait d'abord **tout le monde**, pour qu'un widget neuf ne
s'ouvre pas sur une grille vide. Le retour de test a tranché dans l'autre sens :
un widget Charge suit une **équipe choisie**, presque toujours une poignée de
gens dans un annuaire qui en compte beaucoup. Déverser l'annuaire entier dans une
grille de trente colonnes donnait une grille qu'il fallait **vider avant de s'en
servir**.

Le risque qu'on voulait éviter n'a pas disparu pour autant — il est traité
autrement : le widget vide **dit** ce qui lui manque et où cocher, et la fiche
porte un bouton **« Tout cocher »**. C'est une grille à remplir, jamais une
panne.

Les personnes ajoutées à la main viennent après les inscrites, dans l'ordre de
saisie. Un nom libre qui existe déjà dans l'annuaire n'est **pas dupliqué** :
c'est la même personne, et deux lignes pour un seul nom rendraient ses
affectations indiscernables, puisqu'elles sont indexées par le nom.

### La couleur d'une personne : choisie, ou dérivée de son nom

La palette est la même que pour les ateliers — **dix teintes**, pas un nuancier
libre : deux bleus voisins ne se distingueraient sur aucune pastille de 22 px.

Sans choix, la couleur vient du **hachage du nom**, jamais du rang : le rang
change dès qu'on ajoute quelqu'un au-dessus, et « Karim » changerait de couleur
sans avoir bougé.

Recolorer quelqu'un ne touche **que** sa couleur. Son nom est la clé de ses
affectations : le réécrire ici les détacherait de leur personne.

Un nom libre qui existe déjà dans l'annuaire n'est **pas dupliqué** : c'est la
même personne, et deux lignes pour un seul nom rendraient ses affectations
indiscernables, puisqu'elles sont indexées par le nom.

## Deux totaux, et ils ne comptent pas la même chose

| Où | Ce qui est compté | Pourquoi |
|---|---|---|
| colonne « Postes », à droite | les **postes** d'une personne | deux ateliers le même jour, c'est deux postes — c'est bien ce qu'on appelle la charge |
| pied « Personnes affectées » | les **personnes** d'un jour | la question y est « qui travaille ce jour-là », pas « combien de postes » |

## Le sélecteur d'ateliers

Cliquer une case ouvre un panneau **en portail sur `document.body`** : le widget
coupe à son bord, et un panneau rendu dedans serait tranché dès la dernière
ligne. Il est ancré sous la case, et ramené dans la fenêtre quand il en
sortirait.

- **À l'ouverture** : les ateliers déjà posés remontent en tête, cochés, puis le
  reste du catalogue dans l'ordre des Réglages.
- **Pendant la recherche** : un seul groupe, filtré sur le nom sans accent ni
  casse. Un atelier coché que le filtre écarte **reste coché**, et le panneau le
  dit — sans cela, chercher « at » donnerait l'impression d'avoir tout perdu.

`staffingPickerGroups` rend exactement ces groupes : le panneau ne décide de
rien, il affiche.

## Comment c'est éprouvé

- `apps/nexora/tests/staffing.test.mjs` extrait le bloc `NEXORA:STAFFING` de
  l'interface **réellement construite** et éprouve les fonctions pures : mois
  bissextile, passage d'année, dimanche rattaché à sa semaine, case vide non
  écrite, atelier supprimé, densité d'une bande, recherche accentuée.

  Le bloc appelle `iso`, `addDays` et `normalizeForMatch` — les briques de date
  et de texte de tout Nexora. Elles ont reçu leurs propres sentinelles
  (`NEXORA:DATE-UTILS`, `NEXORA:TEXT-MATCH`) et sont extraites **avec** lui : les
  éprouver contre des copies écrites dans le fichier de test reviendrait à
  tester deux calendriers différents.

- `tools/visual-check` monte le widget **deux fois**, en semaine et en mois,
  parce que c'est la densité qui décide de ce qu'une bande peut écrire. Un
  widget qui ne serait éprouvé qu'en semaine laisserait passer des lettres
  coupées — et c'est le banc, pas les tests d'extraction, qui attrape une
  fonction appelée avant sa déclaration.
