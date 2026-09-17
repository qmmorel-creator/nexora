# Widget « Bulles » — planning à bulles descriptives

Nexora sait lire un planning en **barres** (widget Mini-Gantt, vue Gantt). Le
widget « Bulles » le lit en **bulles descriptives** : chaque tâche devient une
carte posée sur l'axe du temps, à sa date et à sa durée, qui porte son titre, son
avancement et les champs choisis **sous** elle ; plusieurs tâches se rassemblent
dans des **macro-bulles**, de grandes enveloppes colorées.

C'est un mode de lecture **narratif** — on lit ce que contient la période — là où
le Gantt est un mode de lecture **métrique**. Le principe est celui de Bubble
Plan ; l'habillage est celui de Nexora, et rien n'a été décalqué.

## Ce n'est pas un second diagramme

Décision structurante, et la seule qui compte ici : **le widget réutilise le
diagramme du Mini-Gantt**. `WidgetBubbles` fait trois lignes —

```jsx
function WidgetBubbles(props) {
  return <WidgetMiniGantt {...props} bubbleMode />;
}
```

— et tout ce qui n'est pas la ligne elle-même reste commun : l'axe et ses trois
niveaux de graduation, le cadrage (automatique, fenêtre glissante, dates fixes),
le zoom, les groupes repliables, les blocs temporels, les encadrés, les jalons et
annotations de configuration, les infobulles, le glisser des dates et de
l'avancement, les plafonds d'affichage, l'état vide.

L'alternative — un composant jumeau — aurait recopié près de mille lignes de
préparation temporelle. Les deux formulaires de réglages du Gantt avaient déjà
divergé de cette façon (#86) : la vue ignorait l'inactivité dans le regroupement
et ne validait pas la fenêtre à dates fixes, sans que personne l'ait décidé. Un
correctif d'axe doit profiter aux deux diagrammes le jour où il est écrit.

Hors du mode bulles, **aucune** branche ajoutée ne s'exécute : `bubbleMode` est
absent du Mini-Gantt, qui rend exactement ce qu'il rendait.

Ce qui est propre aux bulles vit donc à deux endroits, et deux seulement :

| Où | Quoi |
|---|---|
| bloc `NEXORA:BUBBLES` | toute la **logique** sans rendu : normalisation, couleurs, géométrie des macro-bulles, ordre des lignes, avancement agrégé |
| branches `bubbleMode` de `WidgetMiniGantt` | le **rendu d'une ligne** : `BubbleRow`, `BubbleMilestoneRow`, la disposition « sous la bulle », les deux couches de macro-bulles, la légende |

## La bulle

Position et largeur sont celles d'une barre — `dayIndex`, `minIdx`, `span`, même
écrêtage à la fenêtre : une tâche entièrement hors fenêtre n'est pas dessinée.
Trois différences seulement :

- un **plancher de largeur en pixels** (90 px), pour qu'un titre reste lisible
  sur une tâche d'un jour, puis la largeur est ramenée dans la piste — une bulle
  de fin de fenêtre ne doit pas se faire couper par le cadre du widget ;
- l'**avancement en lavis** derrière le texte, plutôt qu'un remplissage de
  barre : la bulle se lit d'un coup d'œil sans qu'un second élément lui vole de
  la hauteur ;
- les **dates aux extrémités** s'écrivent dehors, et chacune seulement s'il
  reste la place de l'écrire dans la piste. Une seule des deux peut manquer.

Un **jalon** n'a qu'une date : sa bulle est compacte et centrée sur cette date —
lui donner une largeur fabriquerait une durée. Tout au bord de la piste, elle
s'aligne sur le bord au lieu d'être coupée en deux.

La **description** de la tâche s'affiche sous le titre, sur **1 à 3 lignes** au choix
(`bubbleDescriptionLines`, défaut 1) — réglage #97. Le texte est coupé au nombre de
lignes demandé, avec ellipsis sur la dernière : une phrase tronquée sans marque se lit
comme une phrase complète.

Les lignes gagnées **se paient en hauteur de bulle**, et c'est tout l'enjeu de ce
réglage. La bulle a une hauteur fixe et `overflow:hidden` : deux lignes de plus sans
hauteur de plus auraient mangé le pied — statut et avancement auraient disparu en
silence, sans que rien ne le signale. `bubbleHeightPx(widget)` est donc **la seule**
fonction qui donne cette hauteur, et elle est appelée par deux appelants qui devaient
absolument s'accorder :

| Appelant | Ce qu'il en fait |
|---|---|
| le rendu | la pose en variable CSS `--lp-bubble-h` sur la racine du widget |
| `onAutoSize` | calcule la hauteur du widget à partir de ses lignes |

Recopier les nombres (34 / 46 / 60 px, 13 px par ligne) dans la feuille de style aurait
donné deux vérités pour un seul nombre, et un widget qui se redimensionne à une hauteur
qui n'est pas celle qu'il dessine. Les classes `.size-*` ne portent donc plus de hauteur,
seulement la règle qui ramène le **titre** à une ligne en densité compacte : c'est la
description qui gagne les lignes demandées, pas le titre.

Le réglage n'apparaît dans le formulaire **que** lorsque la description est affichée, et
il reste inerte si on la décoche — la hauteur revient d'elle-même à celle de la densité
choisie.

Les **champs sous la bulle** sont rendus **en flux**, et c'est important : en
position absolue, ils ne comptaient pas dans la hauteur de la ligne, débordaient
sur la ligne suivante, et la géométrie mesurée dont vivent les macro-bulles et
les encadrés ignorait leur hauteur. Le banc visuel contrôle ce point.

Ils tiennent en outre **exactement la boîte de la bulle** — même bord gauche,
même bord droit (#103). Ils s'étalaient auparavant jusqu'au bord de la piste :
une bulle courte portait une rangée bien plus large qu'elle, qui empiétait sur
la place des voisines et ne se rattachait plus à rien à l'œil. Trop étroits pour
une ligne, ils passent à la ligne, et la ligne du diagramme grandit d'autant.

C'est pour cela que la bulle d'un **jalon** a une largeur **fixe** de 120 px et
non un maximum : sans largeur connue, ses champs ne pouvaient pas tenir la même.

Chaque champ passe par `FieldValue`, le formateur partagé avec tout Nexora : une
pastille de statut est la même pastille partout. Corollaire assumé :
`BUBBLE_ROW_FIELD_OPTIONS` ne propose **que** les clés que `FieldValue` sait
rendre. Les champs personnalisés n'y sont donc pas — les ajouter demanderait
d'étendre `FieldValue`, qui sert à tous les autres widgets. Un test vérifie que
chaque champ proposé est bien rendu.

## La couleur, au sens de « grouper par »

La couleur d'une bulle est celle de **son groupe**, résolue par
`groupTasks(tasks, bubbleColorBy, ctx)` — la fonction qui sert déjà aux en-têtes
de groupe, aux listes et aux graphiques. Elle renvoie la couleur de la valeur
quand celle-ci en a une (statut, projet, type, criticité).

`bubbleColorBy` est **indépendant** de `groupBy` : on groupe les lignes par
projet et on colore par statut, comme dans Bubble Plan.

Pour un champ dont les valeurs n'ont pas de couleur à elles — responsable,
période, texte libre — `groupTasks` renvoie `var(--text-muted)`. Dans ce cas, et
dans ce cas seulement, `bubblePaletteColor` applique une teinte de repli **par
hachage de la clé**, et non par rang dans la liste : le rang change dès qu'une
valeur apparaît ou disparaît, « Jean » changerait de couleur parce qu'un autre
responsable a été ajouté, et deux widgets affichant des sous-ensembles
différents ne s'accorderaient jamais. Deux valeurs peuvent tomber sur la même
teinte : c'est le prix assumé de cette stabilité, et la légende lève
l'ambiguïté.

## Les macro-bulles

Une macro-bulle est une **enveloppe** autour des bulles de tâches choisies à la
main. Elle se règle dans les **réglages du widget** (section « Macro-bulles ») :
libellé, couleur, transparence, bordure, avancement agrégé, et la
**multisélection avec recherche** des tâches rattachées.

Cette multisélection est `GanttTaskMultiSelect`, celle des encadrés du Gantt :
elle groupe par projet, compte les tâches retenues et signale celles qui ont
disparu. Elle a seulement reçu un libellé paramétrable.

### Géométrie

`bubbleMacroSegments(rows, macro, frameSegments, nestLevel)` délègue le découpage
en séries de **lignes contiguës** à `ganttFrameSegments`, la fonction des
encadrés : elle sait qu'un en-tête de groupe coupe la continuité et elle
travaille sur les hauteurs **mesurées** des lignes. Des tâches non successives
donnent donc **plusieurs enveloppes**, jamais une enveloppe géante qui avalerait
les tâches voisines.

Elle est passée en **argument** plutôt qu'appelée directement : le bloc
`NEXORA:BUBBLES` reste ainsi extractible seul, et le test lui donne la **vraie**
fonction — pas un mannequin qui dirait ce qu'on veut entendre.

`nestLevel` est le rang de la macro-bulle dans la liste. Une tâche peut
appartenir à plusieurs macro-bulles ; sans ce décalage, les deux enveloppes
confondraient leurs traits.

### Ce qu'une bulle occupe, et non ce que ses dates disent

L'enveloppe se calculait sur les **dates** des tâches. Mais une bulle n'occupe
pas exactement ses dates : une bulle de tâche ne descend jamais sous 90 px — elle
s'étend donc à droite de sa date de fin quand la tâche est courte — et une bulle
de jalon est **centrée** sur sa date unique — elle s'étend donc des deux côtés.
Les deux sortaient du cadre, et l'enveloppe cessait de dire ce qu'elle contient
(#104).

`bubbleRowExtent(row, pxPerDay)` traduit ces deux largeurs en index de jour, à
partir de la largeur **mesurée** de la piste. Sans mesure — au premier rendu —
elle rend les dates nues plutôt qu'une marge inventée à partir d'un repli.

Les encadrés du Gantt, eux, gardent les dates : ils entourent des **barres**,
dont la géométrie suit exactement les dates, et leur donner la marge d'une bulle
les élargirait pour rien. Un test vérifie que cette étendue ne les a pas
contaminés.

### Deux couches, pas une

Comme un bloc temporel :

| Couche | Ce qu'elle porte | `z-index` |
|---|---|---|
| `lp-bubble-macro-layer` | le **remplissage**, translucide | 0 — derrière les bulles |
| `lp-bubble-macro-frames` | le **cadre**, le libellé, l'avancement | 6 — devant tout |

Le remplissage situe, il ne masque pas. Le cadre posé avec lui serait recouvert
par la moindre bulle qui le traverse, et « bordure continue » ne donnerait pas
un trait continu à l'œil.

### Avancement agrégé

`bubbleMacroProgress(cells)` fait une moyenne **pondérée par la durée** : une
tâche de trois mois à 0 % ne doit pas peser autant qu'un jalon d'un jour à
100 %. Les cellules arrivent réduites à `{ progress, days }`, pour que la
fonction ne dépende ni du calendrier ni du modèle de tâche. Sans durée
exploitable — que des jalons — elle retombe sur une moyenne simple plutôt que
sur une division par zéro.

### Regrouper les lignes

Option `bubbleMacroGrouping`, active par défaut : les lignes d'une macro-bulle
sont amenées côte à côte (`bubbleRowOrder`), macro-bulles dans leur ordre de
déclaration, le reste dans l'ordre du tri. Une macro-bulle forme alors la
**bande** d'un seul tenant de Bubble Plan au lieu d'une enveloppe trouée. Une
tâche réclamée par deux macro-bulles suit la première ; l'autre se segmente
autour.

Le regroupement s'applique **dans** chaque groupe et ne traverse jamais une
frontière de groupe : l'en-tête resterait au-dessus de lignes qui ne lui
appartiennent pas.

Option décochée, l'ordre du tri est rendu tel quel — et les enveloppes se
segmentent.

## Forme des données

Tout vit dans l'objet widget. **Rien n'est écrit sur les tâches.** Les
macro-bulles suivent donc la duplication d'un widget, d'un onglet et d'un
tableau de bord, et toutes les écritures sont immuables.

```ts
type BubbleMacro = {
  id: string;
  label: string;                      // non vide
  color?: string;                     // défaut "#245EDB" (life-blue)
  opacity?: number;                   // 0–60 %, défaut 12
  borderStyle?: "dashed" | "solid";   // défaut "solid"
  borderWidth?: number;               // 0–6 px, défaut 1.5
  taskIds: string[];
  showProgress?: boolean;             // défaut true
};

widget.bubbleMacros?: BubbleMacro[];
widget.bubbleColorBy?: string;                      // défaut "status"
widget.bubbleFields?: string[];                     // défaut ["assignee","status","end","progress"]
widget.bubbleFieldsLayout?: "under" | "inline";     // défaut "under"
widget.bubbleSize?: "compact" | "normal" | "large"; // défaut "normal"
widget.bubbleShowDates?: boolean;                   // défaut true
widget.bubbleShowProgress?: boolean;                // défaut true
widget.bubbleShowDescription?: boolean;             // défaut false
widget.bubbleDescriptionLines?: number;             // 1 à 3, défaut 1
widget.bubbleShowLegend?: boolean;                  // défaut false
widget.bubbleMacroGrouping?: boolean;               // défaut true
```

Les clés du **cadrage et du regroupement** ne sont pas dupliquées : ce sont
celles du Mini-Gantt, aux mêmes noms — `groupBy`, `showMilestones`,
`miniGanttSort`, `miniGanttSortDir`, `miniGanttRange`, `miniGanttWindow`,
`miniGanttZoomLevel`, `ganttAnnotations`. Conséquence voulue, et vérifiée par un
test : **changer un widget de Mini-Gantt à Bulles conserve** sa fenêtre, son
zoom, son tri et ses annotations.

`normalizeBubblesWidget` fait retomber tout réglage absent ou invalide sur son
défaut et **conserve** les propriétés inconnues : un widget enregistré avant
cette fonctionnalité ne bouge pas d'un pixel, et une propriété future n'est pas
détruite par une lecture.

Une macro-bulle vidée de ses tâches est **conservée** — elle porte un libellé et
une couleur choisis à la main, et l'éditeur sait dire qu'elle n'est pas dessinée.
C'est la différence avec `pruneHighlightFrames`, qui supprime un encadré vide. Le
nettoyage n'a lieu qu'à l'**enregistrement**, jamais au rendu : un filtre de
widget ne doit pas détruire une configuration.

## Un décalage de 6 px, et ce qu'il apprend

En retirant la colonne d'étiquettes du mode bulles, j'avais gardé la **gouttière
de 6 px** que le flex mettait entre cette colonne et la piste. Une ligne sans
étiquette n'a qu'un enfant, donc aucune gouttière — mais l'axe et les bandes de
repères gardaient la leur autour d'une cale de largeur nulle. Résultat : les
pistes de l'axe partaient 6 px à droite de celles des lignes, et **toutes** les
couches superposées avec elles — grille, ligne du jour, blocs temporels,
encadrés, cadres de macro-bulles.

Personne ne l'avait vu, parce que 6 px sur une piste de 900 se lisent comme une
approximation de rendu. Il est sorti en cherchant pourquoi des bulles
dépassaient de leur macro-bulle : le cadre n'était pas trop petit, il était
décalé.

Deux conséquences dans le code :

- `layerInsetLeft` est la **seule** définition de ce retrait, et un test vérifie
  qu'il n'est recopié nulle part ;
- le banc visuel compare désormais le bord gauche de la piste d'une ligne, celui
  de l'axe, celui de la grille et celui de la couche des macro-bulles. C'est le
  contrôle qui aurait attrapé le défaut le jour où il a été écrit.

## L'infobulle s'écarte des poignées

L'infobulle se pose 14 px en bas à droite du curseur ; la poignée d'avancement
vit sur le bord inférieur de la bulle. S'en approcher la faisait donc disparaître
sous l'infobulle, et l'on glissait à l'aveugle (#106).

Deux règles, et rien de plus — le placement de `WidgetPointerTooltip`, partagée
par plusieurs widgets, n'est pas touché :

- aucune infobulle pendant un glisser en cours (`openTip` lit `dragStateRef`) ;
- aucune infobulle au survol d'une poignée, qui porte déjà son propre libellé.

La règle vaut pour les six poignées, celles de la barre du Mini-Gantt comprises :
le défaut y est moins visible — une barre fait 9 px de haut — mais il est de même
nature. Quitter la poignée redonne l'infobulle : elle s'écarte le temps du geste,
elle ne disparaît pas.

## Nettoyage au passage

La feuille de style portait des règles `.lp-bubble-card*` et `.lp-gantt-bubble-*`
qu'aucun JSX ne référençait plus — vestiges d'une fonctionnalité retirée. Elles
sont supprimées : laisser un nom de classe libre pour une fonctionnalité morte
aurait été le plus sûr moyen de croire, plus tard, que le widget s'en sert.

De même, la fiche de widget portait une branche « éditeur d'annotations sans
jalons ni notes » que sa condition rendait inatteignable ; elle est retirée, et
l'éditeur complet sert les deux types.

## Ce qui est volontairement hors de ce widget

- **Replier** une macro-bulle en une bulle unique (mode « collapsed » de Bubble
  Plan).
- **Créer ou déplacer** une macro-bulle à la souris sur le diagramme : elle se
  règle dans les réglages du widget.
- Les **liens de dépendance** entre bulles : le Gantt et le chemin critique
  couvrent ce besoin.
- Le **mode Comparaison** et les **couloirs de risque**, qui restent propres au
  Mini-Gantt : ils parlent de dates de référence, pas de contenu de période.
- Une **vue pleine page** « Bulles » : cette livraison est un widget. Le
  formulaire de réglages est déjà un composant partagé, donc la vue serait
  possible sans duplication.

## Comment c'est éprouvé

- `apps/nexora/tests/bubbles.test.mjs` extrait le bloc `NEXORA:BUBBLES` de
  l'interface **réellement construite** et éprouve les fonctions pures, plus le
  câblage au mot près (type au catalogue, rendu appelé, taille par défaut,
  absence de retrait codé en dur).
- `tools/visual-check` monte deux widgets Bulles sur les données de
  démonstration et contrôle ce qu'aucun test d'extraction ne peut dire : les
  champs restent dans leur ligne, les enveloppes ont une surface non nulle,
  restent dans la zone des lignes et se décalent quand elles s'imbriquent, et
  **aucune barre de Mini-Gantt n'est dessinée** en mode bulles.

C'est ce banc qui a attrapé le seul vrai défaut de cette livraison : une
fonction en `const` appelée depuis un `useMemo` situé plus haut, donc une
`ReferenceError` de zone morte qui cassait **aussi** le Mini-Gantt. Aucun test
d'extraction ne l'aurait vue.
