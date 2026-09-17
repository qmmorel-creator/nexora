# Annotations du Mini Gantt — blocs temporels et encadrés

Deux annotations configurables se superposent au Mini Gantt — dans sa vue
principale et dans son widget de tableau de bord —
sans jamais modifier les tâches :

- **bloc temporel** — une grande phase transverse (Études, Gros œuvre, Second
  œuvre…), dessinée comme un rectangle très légèrement teinté sur toute la
  hauteur utile de la zone graphique, borné par deux limites verticales ;
- **encadré** — un cadre qui met en évidence une ou plusieurs tâches.

Le Mini-Gantt en ajoute trois qui lui sont propres — **jalon**, **annotation**
(une bulle courte ancrée à une date, une tâche, un jalon ou un risque) et
**annotation horizontale** (un trait d'une date à une autre, à la hauteur d'une
tâche) — décrites plus bas.

## Où c'est stocké

Les annotations appartiennent à la **configuration de l'affichage**, jamais aux
tâches. Deux emplacements selon le contexte, pour un seul et même composant de
rendu Mini Gantt :

| Contexte | Emplacement | Persistance |
|---|---|---|
| Vue « Gantt » | `viewPrefs.gantt.ganttAnnotations` | clé Firebase `nexora:viewPrefs` |
| Widget « Mini-Gantt » | `widget.ganttAnnotations` | avec le widget, dans son tableau de bord |

Les deux widgets utilisent la **même clé** `widget.ganttAnnotations` et la même
forme de données : changer un widget de type ne perd pas ses annotations.
La vue « Gantt » utilise les préférences de vue ;
`WidgetMiniGantt` lit directement `widget.ganttAnnotations` et écrit par
`onUpdateWidget`. Les autres réglages (zoom, colonnes, bulles, champs de ligne)
restent ce qu'ils étaient.

Comme la configuration vit dans l'objet widget, elle suit la duplication d'un
widget, d'un onglet et d'un tableau de bord — ces trois opérations recopient les
widgets champ par champ. Toutes les écritures sont immuables : une copie ne
partage jamais une liste modifiable avec son original.

## Forme des données

```ts
type TemporalBlock = {
  id: string;
  title: string;
  startDate: string;   // AAAA-MM-JJ
  endDate: string;     // AAAA-MM-JJ, >= startDate
  color?: string;      // défaut #4F6AF5
  borderStyle?: "dashed" | "solid";  // défaut dashed
  opacity?: number;    // 0 à 60 %, défaut 13 (phase) ou 7 (décision)
};

type GanttHighlightFrame = {
  id: string;
  label?: string;
  taskIds: string[];
  color?: string;      // défaut #D64545
  borderStyle?: "dashed" | "solid";  // défaut dashed
  padding?: number;    // 0 à 24 px, défaut 4
};

type GanttAnnotations = {
  temporalBlocks?: TemporalBlock[];
  highlightFrames?: GanttHighlightFrame[];
  // Propres au Mini-Gantt :
  milestones?: MiniGanttMilestone[];
  notes?: MiniGanttNote[];
  spans?: MiniGanttSpan[];
};

// Les risques de délai NE sont pas ici : ils appartiennent à la tâche.
type Task = { /* … */ delayRisks?: MiniGanttTaskRisk[] };
```

## Transparence du remplissage

L'opacité de la bande était figée dans le rendu — 13 % pour une phase, 7 % pour
une fenêtre de décision — et les deux diagrammes la recopiaient chacun de leur
côté, à un point près. Elle devient un réglage du bloc (`opacity`, en pourcent),
avec ces mêmes valeurs par défaut : un bloc enregistré avant ce changement ne
bouge pas d'un pixel.

Le réglage est le même composant dans les **trois** éditeurs de bloc —
annotations d'un widget, méta blocs des Réglages, méta bloc porté par une tâche
calendrier — avec un aperçu qui montre le résultat exact, contour compris.

0 % laisse la bande vide, bornée par ses deux traits : c'est un choix légitime,
pas une valeur refusée. Le plafond de 60 % n'est pas arbitraire — au-delà, la
bande passe devant les barres qu'elle est censée situer, alors qu'elle est
dessinée derrière elles.

`ganttBlockFill(block)` calcule le remplissage en un seul endroit, et les deux
diagrammes l'appellent.

## Traits du bloc : style et épaisseur

Les deux traits qui bornent une bande se règlent, eux aussi, dans les **trois**
éditeurs de bloc :

| Réglage | Propriété | Valeurs | Défaut |
|---|---|---|---|
| Bordure | `borderStyle` | `dashed` (pointillés) ou `solid` (continue) | `dashed` |
| Épaisseur | `borderWidth` | 0 à 6 px, au demi-pixel | `1.5` |

L'épaisseur était codée en dur à 1,5 px aux **quatre** endroits qui dessinent un
bloc — widget, vue Gantt, aperçu de l'éditeur : invisible au réglage, et
impossible à accorder avec la transparence du remplissage, puisqu'un bloc très
transparent avait des traits aussi appuyés qu'un bloc plein.

0 px retire les traits : il ne reste que le lavis de couleur. Le plafond de 6 px
n'est pas arbitraire — au-delà, les deux montants fermeraient une bande courte.
La valeur par défaut reste 1,5 px, donc un bloc enregistré avant ce réglage ne
bouge pas d'un pixel.

`ganttBlockBorder(block)` compose le trait en un seul endroit — épaisseur, style
et couleur — et les quatre rendus l'appellent, l'aperçu de l'éditeur compris.

C'est un **cadre**, pas deux montants : la bande était bornée à gauche et à
droite, sans haut ni bas, et se lisait comme deux traits plutôt que comme une
zone. Le style choisi vaut aussi pour la **pastille du titre** : elle imposait
ses pointillés (fenêtre de décision) ou ses points (méta bloc) par la feuille de
style, si bien que « Continue » ne donnait pas du continu.

### Deux couches, pas une

Le bloc se dessine sur **deux couches distinctes** :

| Couche | Ce qu'elle porte | `z-index` |
|---|---|---|
| `band-layer` | le **remplissage**, translucide | 0 — derrière les lignes |
| `band-frames` | le **cadre**, couleur pleine | 6 — devant tout |

Le remplissage doit rester derrière les barres : c'est une teinte de fond, elle
situe et ne masque pas. Le cadre doit passer devant : posé avec le remplissage,
il était recouvert par la moindre barre qui le traversait, et « Continue » ne
donnait jamais un trait continu **à l'œil**. Séparer les deux est la seule façon
d'obtenir un vrai cadre sans rendre la teinte opaque.

## Icône d'un encadré

La pastille posée dans le coin d'un encadré créé par la **coche** d'une ligne est
un triangle rouge. La tâche peut lui substituer la sienne : un champ **URL dans
sa fiche** (`task.ganttFrameIcon`), laissé vide pour garder le défaut.

`miniGanttFrameCornerIcon(frame, task)` résout l'icône **à l'affichage**, jamais
à la pose. Trois conséquences voulues :

- changer l'URL met à jour l'encadré déjà posé, sans réécrire la configuration
  du widget ;
- décocher puis recocher ne perd pas le réglage, puisqu'il vit sur la tâche ;
- c'est la même icône dans tous les diagrammes qui affichent cette tâche.

Un encadré posé **à la main** garde la sienne : rien ne la lui impose, et
l'icône d'une tâche qu'il contiendrait ne s'y substitue pas.

## Axe : la métrique, puis les bornes

L'axe porte **deux lignes**, et non une :

| Ligne | Ce qu'elle dit | Style |
|---|---|---|
| haut | l'**unité** de l'axe (années, trimestres, mois…) | 11 px, gras, `--text-900` |
| bas | les **bornes** de la fenêtre, date complète | 8,5 px, `--text-muted`, calée sur son bord |

Elles partageaient la même ligne, dédoublonnées par la seule égalité des dates.
Or une borne au 12/03/2022 et la graduation « 2022 » sont deux dates
différentes : elles se superposaient à quelques pixels près, et l'on lisait
« 20222022 ». Elles n'ont pas non plus le même rôle — l'unité est la **métrique**,
les bornes ne sont qu'un repère de cadrage.

Les étiquettes de l'unité sont en outre **éclaircies** : deux voisines qui se
toucheraient ne sont pas rendues toutes les deux (on garde la première et on
saute la suivante), à partir de la largeur mesurée de la piste et d'une largeur
de texte estimée par `widgetAxisLabelWidth`.

## Sous-grille : jusqu'à trois niveaux

L'axe porte son unité, puis **deux** sous-grilles de plus en plus fines. Un cran,
c'est une case dans `WIDGET_AXIS_SCALE` — `year`, `quarter`, `month`, `week`,
`day` :

| Unité de l'axe | Deuxième niveau | Troisième niveau |
|---|---|---|
| année | trimestre | mois |
| trimestre | mois | semaine |
| mois | semaine | jour |
| semaine | jour | — |

`widgetSubTicks(min, max, crans)` les produit tous ; `widgetSecondaryTicks` et
`widgetTertiaryTicks` en sont les deux appels. Le garde-fou est un garde-fou de
**densité**, pas seulement de boucle : au-delà de `MINIGANTT_SUBGRID_MAX` traits
(180), le niveau se tait. Sous une échelle mensuelle, le troisième niveau est le
jour — jusqu'à 550 traits sur quelques centaines de pixels, soit un aplat gris et
non un repère. L'axe reste donc lisible à tous les zooms sans qu'on ait à le
régler.

Les trois niveaux se distinguent par le **ton**, pas par le comptage :
graduation pleine, sous-grille à 50 % d'opacité, troisième niveau à 22 %.

## Alignement des titres de bloc

Le titre d'un bloc est **centré sur sa bande par `translateX(-50%)`**, donc par
le navigateur, donc exactement. Le centrage se calculait auparavant en pixels, à
partir d'une largeur d'étiquette mesurée une seule fois — avant le chargement de
la police, quand la capsule est encore plus étroite qu'elle ne le sera. Rien ne
provoquant de second rendu à l'arrivée de la police, la valeur restait périmée et
l'étiquette gardait son décalage.

La largeur mesurée ne sert donc plus qu'à répartir les capsules en lignes
lorsqu'elles se recouvriraient, et à retenir dans la piste celles qui en
sortiraient — deux usages qu'une estimation suffit à traiter.

La **largeur de la piste**, elle, se mesurait sur la bande des repères, qui
n'existe que si le widget porte des jalons de configuration ou des annotations.
Sans eux, la mesure ne tombait jamais et tout retombait sur un repli de 420 px :
les titres se centraient sur une piste imaginaire, et les étiquettes de risque et
d'écart avec eux. Elle se prend désormais sur la **première piste présente** —
titres de bloc, repères, ou ligne —, toutes trois de géométrie identique.

## Méta blocs temporels — Réglages

Une période qui ne concerne pas un widget mais l'ensemble du travail — congés,
absences, fermeture de site — se définit une fois dans **Réglages > Méta blocs
temporels** et se dessine dans les Mini-Gantt des tableaux de bord retenus.

Stockage global dans `nexora:metaTemporalBlocks`, à l'image de
`nexora:metaFilters` : ni dans un widget, ni dans une tâche.

```ts
type MetaTemporalBlock = TemporalBlock & {
  dashboardIds?: string[] | null;   // absent = tous, y compris les tableaux à venir
};
```

- `dashboardIds` absent vaut **tous les tableaux de bord**, présents et futurs :
  c'est ce que « tous cochés » signifie à la création. Décocher un tableau
  matérialise la liste ; tout recocher repasse à « tous ».
- Une sélection explicite ne s'applique jamais hors tableau de bord ; la page
  « Aujourd'hui » ne reçoit que les méta blocs valables pour tous.
- Un tableau de bord supprimé reste inoffensif : son identifiant ne correspond
  simplement plus à rien.
- Dans le widget, un méta bloc se dessine comme les autres mais son titre porte
  une bordure pointillée et n'est pas cliquable : il se règle dans les Réglages.
- L'étiquette d'un bloc épouse **son titre**, pas sa bande : une phase de trois
  jours garde une capsule lisible, centrée sur la bande puis ramenée dans la
  piste quand elle touche un bord. Les couloirs d'étiquettes sont calculés sur
  la largeur de l'étiquette, jamais sur celle de la bande.
  Son identifiant est préfixé `meta:` pour ne jamais entrer en collision avec un
  bloc propre au widget.

### Méta blocs portés par une tâche calendrier

Une tâche d'un projet adossé à un calendrier — Google Calendar
(`project.gcalSource`) ou calendrier public synchronisé
(`project.syncedCalendarSource`) — peut devenir un méta bloc depuis **sa propre
fiche**, sans passer par les Réglages : une case à cocher, puis les mêmes
réglages esthétiques et la même liste de tableaux de bord.

```ts
type TaskMetaBlock = {
  enabled: boolean;
  kind?: "phase" | "decision";
  color?: string;
  borderStyle?: "solid" | "dashed";
  dashboardIds?: string[] | null;   // même convention que ci-dessus
};
// stocké dans task.metaBlock
```

- **Rien n'est recopié** : le titre et les dates du bloc restent ceux de la
  tâche (`title`, `start`, `end` — ou la seule date d'un jalon). Déplacer
  l'événement dans l'agenda déplace le bloc à la synchronisation suivante.
- Identifiant dérivé : `task:<id de la tâche>`, préfixé `meta:` par le widget.
- Les imports calendrier **reconstruisent** entièrement leurs tâches à chaque
  synchronisation (nouvel identifiant Nexora, même événement) :
  `carryOverTaskMetaBlocks` reporte le réglage via la clé stable de l'événement
  (`googleEventId` + calendrier, ou `syncedCalendarKey` + calendrier).
- Un projet qui cesse d'être adossé à un calendrier perd son méta bloc à
  l'enregistrement suivant de la tâche : la période ne serait plus tenue à jour.
- `mergeMetaTemporalBlocks(réglages, tâches)` est la source unique consommée par
  `DashboardView`, avant `metaBlocksForDashboard`.

## Vue Métro — les mêmes objets sur un plan de lignes

La vue **Planning Projets** (Métro) dessine les mêmes annotations, avec les mêmes fonctions
pures : rien n'y est recalculé, seule la **géométrie** change, parce qu'une ligne y est un
**projet** et non une tâche.

- **Blocs temporels** — bande continue sur toute la hauteur utile, derrière les lignes comme
  derrière les tâches, avec une étiquette verticale sur le bord gauche (même parti pris que le
  Mini-Gantt). Les fenêtres de décision et les méta blocs suivent ; la vue n'étant pas un
  tableau de bord, elle reçoit les méta blocs valables pour **tous** — même règle que la page
  « Aujourd'hui ».
- **Encadrés** — `metroFrameSegments` applique la règle du Gantt (un cadre par groupe
  **continu**) à l'ordre d'affichage des **projets** : un encadré couvrant les lignes 1 et 3
  produit deux cadres, jamais un seul qui engloberait la ligne 2 sans la concerner. Les bornes
  horizontales viennent des dates réelles des tâches retenues, les bornes verticales du cumul
  des hauteurs de lignes — aucune mesure du DOM.
- **Jalons et annotations** — ils partagent une bande de repères **au-dessus** des lignes,
  répartie en couloirs sur la largeur réelle. Cette bande réserve sa hauteur dans le flux
  (`ANNOT_TOP_H`) : sans cela elle recouvrirait la première ligne de projet. Sans aucun repère,
  la hauteur réservée vaut zéro et la mise en page reste exactement celle d'avant. Une
  annotation ancrée à une tâche, un jalon ou un risque est ramenée à une **date**, seule chose
  qu'une bande de repères sache placer.
- **Risques de délai** — posés à la suite de la tâche, sur SA ligne. La position verticale vient
  de la mesure déjà faite pour les flèches de dépendance inter-projets : pas de seconde source
  de vérité. Ils apparaissent sans aucun réglage de la vue, puisqu'ils appartiennent aux tâches.

**Stockage** — dans les préférences de la vue (`viewPrefs.projects`) ;
ou dans la configuration du widget quand la vue est embarquée (`widget.ganttAnnotations`), comme
le Gantt embarqué. L'éditeur est celui du Mini-Gantt, réutilisé tel quel.

## Pilotage — Mini-Gantt uniquement

Le Mini-Gantt étend la même clé `widget.ganttAnnotations` avec trois listes, et
ajoute quatre réglages à la racine du widget (`miniGanttFocus`,
`miniGanttPresentation`, `miniGanttEmphasis`, `miniGanttWindow`). Le Gantt
complet ignore ces champs : les deux widgets restent interchangeables.

```ts
type TemporalBlock = { /* … */ kind?: "phase" | "decision" };  // fenêtre de décision

type MiniGanttMilestone = {
  id: string; title: string; date: string;
  type: string;        // identifiant d'un type du catalogue (Réglages)
  color?: string;      // vide = celle du type
  taskId?: string | null;   // un jalon peut n'être rattaché à rien
};

type MilestoneType = {   // Réglages > Types de jalon, clé nexora:milestoneTypes
  id: string; name: string;
  symbol: string;      // une clé de MILESTONE_SYMBOLS
  color: string;
};

type MiniGanttTaskRisk = {   // stocké dans task.delayRisks (sans taskId)
  id: string; title: string;
  color?: string;
  style?: "solid" | "dashed" | "hatched";
  severity?: "low" | "medium" | "high" | "critical";
  startOffset?: number | null;  // jours après la FIN de la tâche
  endOffset?: number | null;
};

type MiniGanttNote = {
  id: string; title: string; text?: string;
  anchor: { kind: "task" | "risk" | "milestone" | "date"; id?: string | null; date?: string | null };
};

type MiniGanttSpan = {          // annotation horizontale (#93)
  id: string;
  label?: string;               // texte libre, facultatif
  startDate: string;            // AAAA-MM-JJ
  endDate: string;              // AAAA-MM-JJ, >= startDate
  taskId: string;               // donne l'emplacement en Y, et RIEN d'autre
  color?: string;               // défaut #0EA5E9
  borderStyle?: "dashed" | "solid";
  thickness?: number;           // 0,5 à 6 px, défaut 2
  opacity?: number;             // 10 à 100 %, défaut 100
  position?: "above" | "center" | "below";   // défaut center
  capStart?: SpanCap;           // bout gauche, défaut circle
  capEnd?: SpanCap;             // bout droit, défaut circle
};

type SpanCap = "circle" | "dot" | "square" | "diamond" | "arrow" | "bar" | "none";
```

## Annotations horizontales — Mini-Gantt uniquement

Entre le bloc temporel — toute la hauteur du diagramme — et le jalon — un point
sur une date —, il manquait l'objet intermédiaire : un trait qui court d'une
date à une autre, **à la hauteur d'une tâche**, avec un petit rond à chaque bout
et un texte libre.

La tâche de rattachement ne sert **qu'à** l'emplacement vertical : les dates du
trait sont les siennes, elles ne suivent jamais celles de la tâche. C'est ce qui
distingue une annotation horizontale d'un risque de délai, qui prolonge la barre.

Tout se règle comme un bloc temporel : couleur, style de trait, épaisseur,
opacité — plus la position dans la ligne (au-dessus de la barre, sur elle, en
dessous).

Géométrie : `miniGanttSpanRows(rows, spans)` donne le Y à partir des lignes
**mesurées** (`rowRects`), exactement comme les encadrés ; le X se calcule en
pourcentage de la piste et se borne à la fenêtre affichée, comme une barre. Une
annotation dont la tâche n'est pas montée — filtrée, groupe replié, hors plafond
d'affichage — ou dont les deux dates tombent hors de la fenêtre n'est pas
dessinée : jamais une erreur de rendu.

Le calque (`.lp-widget-minigantt-span-layer`) passe **au-dessus** des barres :
un trait posé derrière la barre de sa propre ligne serait invisible. Il ne capte
pas le pointeur — seule l'étiquette est cliquable, et elle rouvre l'éditeur sur
cette annotation.

### Les bouts

Le rond creux était figé dans le rendu ; il devient un choix, et un choix **par
extrémité** : rond creux, rond plein, carré, losange, flèche, trait, ou aucun
bout. Un trait `|———▶` ne dit pas la même chose qu'un trait `●———●`. Le rond
creux reste la valeur par défaut, donc une annotation posée avant ce réglage ne
bouge pas.

Comme les symboles de jalon, les bouts sont des tracés SVG dessinés par un seul
composant (`SpanCapGlyph`), lu par le sélecteur **et** par le diagramme : le bout
choisi est exactement celui qui apparaît. La flèche est la seule à dépendre du
côté — elle pointe vers l'extérieur du trait. « Aucun » réserve quand même sa
place : sans cela, le trait s'allongerait selon les bouts choisis et ne
couvrirait plus ses dates.

## Types de jalon — un catalogue, dans les Réglages

La liste des types était figée dans le code : cinq types, cinq couleurs, cinq
formes, impossibles à renommer et impossibles à compléter. Elle est devenue un
**catalogue réglé dans Réglages > Types de jalon**, comme les statuts et les
types de tâche — nom, symbole et couleur par type, ajout, suppression,
réordonnancement. Il vit sous la clé `nexora:milestoneTypes`.

Un jalon enregistre l'**identifiant** de son type. Les cinq identifiants
historiques (`standard`, `decision`, `contractual`, `delivery`,
`commissioning`) sont ceux du catalogue de départ : un jalon posé avant ce
changement garde son type, son nom et sa couleur. Un type supprimé ne casse
rien — `milestoneTypeFor()` retombe sur le **premier** type du catalogue, et le
dernier type ne peut pas être supprimé.

La **couleur d'un jalon est facultative** : vide, il prend celle de son type, et
changer la couleur du type les met tous à jour d'un coup. La normalisation
remplissait autrefois ce champ avec la couleur figée du type ; elle le rend
maintenant aux jalons concernés, et seulement à eux — une couleur qui vaut
exactement celle du type historique n'a pas été choisie, elle a été recopiée.

### Les symboles

`MILESTONE_SYMBOLS` en propose **vingt-huit**, tous distincts : losange, disque,
anneau, demi-disque, carré, triangle, pentagone, hexagone, octogone, étoiles à
quatre, cinq et six branches, croix, drapeau, marque-page, bouclier, éclair,
goutte, flèches, chevron, barre, et leurs variantes creuses.

Ce sont des **tracés SVG** dans une grille de 24×24, et non des icônes d'une
bibliothèque : le repère mesure neuf pixels dans le diagramme, taille à laquelle
un trait fin disparaît. Une silhouette pleine, elle, se lit encore. `hollow`
dessine le contour au lieu du plein, ce qui laisse deux symboles de même
silhouette rester distincts.

`MilestoneSymbol` est le seul composant qui les dessine : la grille de choix des
Réglages, le sélecteur de type, le résumé de la ligne dans l'éditeur, le repère
du Mini-Gantt et celui de la vue Métro l'appellent tous. Ils ne peuvent donc pas
montrer cinq dessins différents pour le même type. La grille de choix les affiche
à leur taille de lecture et dans la couleur du type : choisir sur une vignette
agrandie mène à des repères qu'on ne distingue plus une fois dans le diagramme.

### Les autres sélecteurs

Une option de `SearchableSelect` peut porter un `glyph` — un repère visuel libre
qui remplace la pastille de couleur dans la liste **et** sur le bouton fermé. Les
types de jalon, les bouts d'une annotation horizontale, les natures de bloc, les
ancrages d'une annotation et la gravité d'un risque s'en servent.

Le menu d'un `SearchableSelect` s'ouvre **vers le haut** quand la place manque
vers le bas dans le cadre qui le rogne (une modale, sinon la fenêtre). Sans cela,
un sélecteur posé bas dans un formulaire déroulait sa liste hors du cadre : elle
paraissait vide alors qu'elle était pleine.

## Trait vertical sous un jalon

`milestone.rule` — un booléen porté par **chaque jalon**, coché dans sa propre
fiche (Annotations > Jalons et décisions > « Prolonger ce jalon par un trait
vertical pleine hauteur »).

Le réglage a d'abord été posé à la racine du widget, pour tout le diagramme d'un
coup : il fallait alors accepter le trait sous **tous** les repères ou sous
aucun, alors que l'intérêt est justement d'en marquer un seul (retour de test
#95). Il appartient donc au jalon, là où sa date, son type et sa couleur se
règlent déjà — et il le suit partout : fiche du widget, vue Gantt, duplication,
transfert vers un autre tableau de bord.

Coché, le jalon **prolonge son losange** : le trait part du couloir de son propre
repère dans la bande, à sa couleur, et descend jusqu'au bas des lignes. C'est la
géométrie de la vue Métro (`lp-pm-strip-rule`), reprise à l'identique. Le calque
(`.lp-widget-minigantt-rule-layer`) commence au sommet de la bande de repères et
garde le `z-index: 0` du remplissage d'un bloc temporel : le trait passe donc
**derrière** les lignes (`z-index: 1`), barres et textes compris — il situe, il
ne masque pas.

Absent = décoché : un jalon posé avant ce réglage ne bouge pas d'un pixel, et un
diagramme sans jalon coché n'a pas de calque du tout.

`milestone.ruleThickness` — l'**épaisseur** du trait, réglée au curseur sous la
case, de 0,5 à 6 px au demi-pixel, comme celle d'une annotation horizontale et
celle des traits d'un bloc temporel. Le trait est né à 1 px, puis 1,5 px : trop
fin, il se perdait dans la sous-grille (retour de test #95). Plutôt qu'un
troisième chiffre en dur, il se règle.

Le défaut est un **entier**, 3 px : un navigateur ramène une bordure au pixel de
l'écran, et 2,5 px se peignent 2 px sur un écran ordinaire — le défaut aurait été
plus fin que promis. Les demi-pixels restent utiles sur un écran à haute densité,
et le réglage les garde. `normalizeMiniGanttRuleThickness` borne, arrondit au
demi-pixel et retombe sur le défaut : une valeur absente, vide ou inexploitable
ne peut pas produire un trait invisible.

**Risques** — ils sont portés par la **tâche** (`task.delayRisks`), pas par le
widget : un même risque apparaît donc dans tous les Mini-Gantt qui affichent
cette tâche, quelle que soit la configuration de chacun. C'est la seule donnée
de cet ensemble écrite hors de la configuration du widget, parce qu'un délai
prévisible est une propriété de la tâche, pas d'un cadrage d'affichage. Le
registre de risques de Nexora (`nexora:risks`) reste un objet distinct — projet,
probabilité et impact — et n'est pas touché.

Ils s'éditent donc **dans la fiche de la tâche**, section « Risques de délai », et
nulle part ailleurs : les annotations d'un Mini-Gantt ne proposent plus de les
créer ni de les modifier, puisqu'elles n'appartiennent pas au widget. Le
Mini-Gantt continue de les **dessiner**, sans les posséder.

Les listes enregistrées sur un widget avant ce changement sont reprises
automatiquement : au premier affichage, chaque risque est reversé sur sa tâche
puis retiré du widget. Un risque dont la tâche n'est pas affichée par ce
widget-là reste en attente, jusqu'à ce qu'un Mini-Gantt qui la montre s'en
charge.

Leurs **étiquettes** tiennent sur une seule ligne, posée à la suite de chaque
couloir puis repoussée vers la droite tant qu'elle recouvrirait celle d'un risque
précédent de la même tâche. Le calcul se fait en pixels, sur la largeur réellement
mesurée de la piste. Quand la ligne est pleine jusqu'au bord, l'étiquette passe à
une seconde ligne plutôt que de disparaître ; au-delà elle n'est pas dessinée, et
l'infobulle du couloir reste la source. Les cinq pixels qui séparent deux couloirs
empilés suffisent à deux filets de 9 px de haut, pas à deux textes : c'est
pourquoi les étiquettes ne suivent PAS l'empilement des couloirs.

Chaque risque prolonge la barre de sa tâche. Sans décalage
explicite, il reprend là où le précédent s'arrête et dure le nombre de jours de
sa gravité (2 / 5 / 10 / 15). Deux risques qui se recouvrent malgré tout sont
empilés sur des couloirs distincts. `null` et `""` valent **absent**, jamais
zéro : la normalisation doit rester idempotente, sinon un second passage
transforme « pas de décalage » en « décalage de 0 jour » et tous les couloirs
s'effondrent à une journée.

**Accentuation** — elle se déduit de ce qui est déjà déclaré, sans second
système de marquage : un risque élevé ou critique passe la ligne en rouge, le
chemin critique (même `computeCriticalIds` que la vue Planning) en bleu, un
risque de moindre gravité en ambre. Le focus atténue le reste sans jamais le
masquer.

**Jalons et annotations** partagent une bande de repères sous les titres de
bloc, avec un placement en lignes calculé **en pixels** à partir de la largeur
mesurée de la piste : estimer la largeur d'une étiquette en pourcentage donnait
des collisions dès que le widget était étroit.

**Migration** : l'absence de ces champs vaut listes vides. Une entrée illisible
ou un bloc aux dates invalides est ignoré au rendu plutôt que de casser le
diagramme ; les Gantt existants fonctionnent sans changement.

## Règles de rendu

- Un bloc temporel reste au-dessus du fond du diagramme mais sous les barres,
  les jalons et les dépendances, et il suit sans traitement particulier le zoom,
  le scroll horizontal et tout changement de plage. Les périodes hors bloc
  gardent le fond normal. Le rendu diffère selon le diagramme :
  - **Mini-Gantt** — **une seule bande continue** en arrière-plan de toutes les
    lignes, en-têtes de groupe et interlignes compris. Le rendre dans la grille
    commune aux lignes le découpait en autant de morceaux que de groupes, avec
    une bande claire à chaque en-tête. Le rail de chaque ligne
    (`.lp-widget-minigantt-track`) est translucide pour la même raison : plein,
    il coupait la bande d'un trait clair par ligne.

- Le **titre** d'un bloc s'affiche dans le Mini-Gantt dans une
  bande d'en-tête propre, sous le contexte de dates et au-dessus des lignes, où
  chaque titre est un libellé horizontal aligné sur son bloc. Deux blocs qui se
  chevauchent dans le temps occupent deux lignes de cette bande, jamais le même
  emplacement.

- Les éléments de tâche restent lisibles **dans** un bloc : la barre est posée
  sur une base opaque plutôt que de prendre la teinte de la bande, elle porte un
  contour fin, et un jalon à icône reçoit un halo clair.
- Les unités du Mini-Gantt utilisent pourcentages et bornage à la fenêtre affichée.
  Chaque bloc s'aligne exactement sur ses barres.
- Les encadrés sont calculés à partir de la mise en page **mesurée** de chaque
  ligne visible, pas d'un second calcul de disposition : un zoom, un filtre, un
  repli/dépli, une bulle ouverte ou un déplacement de tâche déplacent les
  lignes, et les cadres suivent.
- Une sélection de tâches non successives produit **un cadre par groupe
  continu** de lignes adjacentes. Une frontière de groupe coupe la continuité.
  Une tâche supprimée, filtrée ou repliée est simplement ignorée ; s'il ne reste
  aucune ligne visible, aucun cadre n'est dessiné.
- Le nettoyage des tâches qui n'existent plus est **explicite** (bouton dans
  l'éditeur, et à l'enregistrement de la fiche du widget) : un simple filtre de
  vue ne détruit jamais une configuration.

## Édition

Un seul éditeur, `GanttAnnotationsEditor`, monté à deux endroits :

- dans les paramètres du widget « Mini-Gantt », en deux
  sections repliables ;
- dans la modale ouverte par « + Bloc » / « + Encadré » depuis le Mini-Gantt,
  et par un clic sur l'étiquette d'une annotation.

Il permet de lister, créer, modifier, dupliquer, supprimer (avec la confirmation
standard) et réordonner. Un bloc dont les dates sont invalides, ou dont la fin
précède le début, affiche l'erreur sous les champs, n'est pas dessiné, et bloque
l'enregistrement de la fiche du widget.

## Barre d'outils du Mini-Gantt

Toutes les commandes d'affichage tiennent sur **une bande pleine largeur au-dessus
de l'axe** : mode Standard / Comparaison, ordre des lignes, étendue temporelle,
zoom, puis les trois boutons d'annotation. Elles étaient empilées en colonne dans
la gouttière de 26 % à gauche de l'axe — trois blocs superposés qui mangeaient la
hauteur du diagramme pendant que la bande du haut restait vide. La barre passe à
la ligne plutôt que de déborder sur un widget étroit.

Chaque commande écrit la **même propriété** que son réglage des paramètres,
jamais un état local : les deux ne peuvent pas se contredire. Le partage des
rôles est celui-ci — la barre d'outils va vite (préréglages, bascules), la fiche
du widget règle finement (mois sur mesure, dates fixes, champs affichés).

Le menu « Étendue » propose quatre préréglages de fenêtre glissante
(`MINIGANTT_RANGE_PRESETS`). Un cadrage réglé à la main dans les paramètres n'en
coche aucun : le menu l'annonce alors en toutes lettres plutôt que de laisser
croire à un préréglage. Choisir un cadrage depuis la barre **relâche toujours la
fenêtre à dates fixes**, sinon elle primerait et le clic resterait sans effet.

Les options d'un menu sont regroupées par section. Ce n'est pas que de la mise en
page : `DropdownButton` ajoute un champ « Rechercher… » au-delà de six enfants
directs, ce qui n'a aucun sens pour six choix figés — le regroupement ramène le
compte sous le seuil.

## Sous-grille temporelle

Entre deux graduations étiquetées, l'axe et la grille de fond portent une
**sous-graduation** : les jours sous les semaines, les semaines sous les mois,
les mois sous les trimestres, et désormais **les trimestres sous les années**.
Le pas annuel n'en avait aucune — sur un diagramme de sept ans, on voyait sept
traits et rien entre eux, impossible de situer une barre au trimestre près. Le
pas journalier reste sans sous-grille : il n'y a rien de plus fin qu'un jour.

La marque est deux fois plus courte et plus pâle que les graduations étiquetées :
elle donne le pas sans jamais rivaliser avec les dates écrites au-dessus.

## Ordre des lignes et étendue temporelle — Mini-Gantt uniquement

Deux réglages du widget, dans ses paramètres, avec pour valeur par défaut
exactement le comportement historique.

### Ordre des lignes

```ts
type MiniGanttWidget = {
  miniGanttSort?: "start" | "end" | "title";  // défaut "start"
  miniGanttSortDir?: "asc" | "desc";          // défaut "asc"
};
```

Barres et jalons sont triés **ensemble**, dans une seule liste. Ils étaient
auparavant rendus en deux blocs — toutes les barres, puis tous les jalons — si
bien qu'un jalon de 2022 se retrouvait sous une tâche de 2026. Le partage ne
sert plus qu'à deux choses : choisir le composant de rendu, et appliquer à
chacun son propre plafond d'affichage (20 barres, 12 jalons).

Un **jalon n'a qu'une date** : elle vaut début comme fin, sinon trier par « date
de début » le renverrait en tête ou en queue selon un champ qu'il ne porte pas.

**À position égale dans le tri, les jalons passent devant les barres**, quel que
soit le sens : c'est une règle de lisibilité — le jalon marque la date, la barre
l'occupe —, pas une seconde clé qu'on retournerait. Le titre départage en
dernier ressort, pour que deux rendus successifs donnent le même ordre.

Le regroupement redistribue les lignes : chaque groupe est retrié, sinon l'ordre
choisi ne vaudrait qu'à l'intérieur du premier d'entre eux.

### Étendue temporelle

```ts
type MiniGanttWidget = {
  miniGanttRange?: {
    mode: "auto" | "rolling" | "fixed";  // défaut "auto"
    includeToday?: boolean;              // mode auto, défaut true
    beforeMonths?: number;               // mode rolling, défaut 3, borné à 120
    afterMonths?: number;                // mode rolling, défaut 12, borné à 120
  };
  miniGanttWindow?: { start: string; end: string };  // mode fixed
};
```

| Mode | Ce que couvre l'axe |
|---|---|
| **Automatique** | l'étendue des tâches retenues, élargie à « Aujourd'hui » si `includeToday` |
| **Fenêtre glissante** | N mois avant et M mois après aujourd'hui — l'axe avance seul, jour après jour, sans dépendre des tâches |
| **Dates fixes** | deux dates arrêtées à la main, stockées dans `miniGanttWindow` |

`includeToday` n'existe que pour le mode automatique : décoché, un widget
entièrement passé ou entièrement futur se cadre sur ses tâches au lieu de
réserver la moitié de la piste au trajet jusqu'à aujourd'hui.

Les dates fixes continuent de vivre dans `miniGanttWindow` — le rendu la lisait
déjà, et un widget qui en portait une (héritée du bouton de cadrage retiré en
#48) ne change pas de forme. `miniGanttPinnedWindow(widget)` est le seul point
d'entrée : elle rend la fenêtre tant qu'**aucun** cadrage explicite n'a été
choisi, ou que le cadrage choisi est « Dates fixes » ; elle rend `null` dès que
le widget demande « Auto » ou une fenêtre glissante. Sans cette règle, un widget
qui avait gardé une fenêtre 2023-2029 cachait le passé et réservait trois années
vides à l'avenir quel que soit le mode, sans que rien dans l'interface ne dise
pourquoi. Les boutons − / Auto / + du widget la relâchent aussi.

### Le cadrage automatique se cale sur les extrêmes réels

Le filtre « X jours dans le passé » choisit les **tâches**, pas le cadrage. Il
bornait aussi le côté **gauche** de l'axe — et lui seul. Comme il ne regarde que
la date de **fin**, une tâche démarrée en 2022 et terminée cette année le
passait, puis se retrouvait amputée de son début, hors cadre, pendant que rien
ne bornait le côté droit : le mode automatique cachait le passé tout en montrant
des années vides à venir. Cette troncature est supprimée — le mode automatique
couvre la plus ancienne et la plus lointaine des dates réellement dessinées,
dates de référence comprises.

Une comparaison activée sans dates fixes valides **bloque l'enregistrement** de
la fiche, avec l'erreur sous les champs.

### Le zoom manuel ne montre plus de vide

Les niveaux − / + restent relatifs à l'étendue automatique, mais la fenêtre
obtenue est désormais **ramenée dans les bornes utiles**. Centrée sur
aujourd'hui et sans borne, elle réservait la moitié de la piste à des années
vides pendant qu'elle coupait les tâches les plus anciennes. Elle **glisse**
jusqu'à rentrer plutôt que de rétrécir : le zoom demandé n'est pas trahi. Plus
large que les bornes, elle les épouse — il n'y a rien à montrer au-delà.

Enfin, une tâche **entièrement hors de la fenêtre affichée n'est plus dessinée**.
Un cadrage glissant ou à dates fixes en exclut forcément, et les écraser contre
le bord donnait une barre de 2 % qui ne voulait rien dire. Les jalons
appliquaient déjà cette règle ; les barres la rejoignent. En mode Comparaison,
une référence encore dans la fenêtre suffit à garder la ligne.

## Mode Comparaison — Mini-Gantt uniquement

Un Mini-Gantt peut afficher, pour chaque tâche qui le déclare, sa **planification
de référence** en arrière-plan de ses **dates actuelles**, avec les écarts en
jours. Le diagramme reste le même — mêmes lignes, mêmes hauteurs, mêmes
regroupements, mêmes annotations : la comparaison n'est qu'une couche de plus
dans la piste existante, jamais un second diagramme.

### Deux interrupteurs, et il faut les deux

| Interrupteur | Où | Stockage | Absent = |
|---|---|---|---|
| Mode du widget | Paramètres du widget (« Mode d'affichage ») **et** sélecteur rapide `Standard \| Comparaison` sous le zoom | `widget.miniGanttComparisonEnabled` | `false` |
| Comparaison de la tâche | Fiche de la tâche | `task.comparison.enabled` | `false` |

Les deux commandes du widget écrivent la **même** propriété : elles ne peuvent
pas se contredire. Le réglage appartient au widget, donc il suit la duplication
d'un widget, d'un onglet et d'un tableau de bord, comme les annotations.

```ts
type MiniGanttWidget = {
  // propriétés existantes…
  miniGanttComparisonEnabled?: boolean;
};

type Task = {
  // propriétés existantes…
  comparison?: {
    enabled: boolean;
    referenceStart?: string | null;  // AAAA-MM-JJ
    referenceEnd?: string | null;    // AAAA-MM-JJ
  };
};
```

Une comparaison n'est dessinée que si `widget.miniGanttComparisonEnabled === true`
**et** `task.comparison.enabled === true` **et** que les dates de référence sont
exploitables. Sinon la ligne garde le rendu standard : pas d'erreur dans le
diagramme, pas de tâche masquée, pas de hauteur de ligne modifiée. Un même
widget mélange donc sans réglage supplémentaire des tâches et des jalons
comparables et non comparables.

### À la création, la référence vaut les dates demandées

Une tâche **nouvelle** naît avec sa planification initiale pour référence : ce
qu'on demande à la création *est* le plan de départ. La fiche de création ouvre
donc la comparaison activée et les deux champs remplis, et la référence **suit**
les dates tant qu'on n'y touche pas — régler le début puis la fin après
l'ouverture aboutit bien à « référence = dates demandées ». Le premier geste sur
le bloc (l'interrupteur, un champ de date, le bouton de copie) arrête
définitivement ce calage, et l'enregistrement le fige.

Rien n'est posé en douce pour autant : la référence est **visible et modifiable**
avant d'enregistrer. Si une dépendance décale la tâche à l'enregistrement, c'est
sur les dates **réellement enregistrées** que la référence se cale — une tâche ne
naît jamais en retard sur son propre plan.

La règle vaut pour les autres créations d'une tâche par l'utilisateur (ajout
rapide, import tabulaire, action de workflow) via `withCreationComparison`.
Deux exceptions, et elles seules :

- une tâche **existante** n'en gagne jamais : ouvrir puis enregistrer une fiche
  ancienne ne lui fabrique aucune référence ;
- les tâches **importées d'un agenda** restent en dehors — leurs dates
  appartiennent à Google Calendar et sont réécrites à chaque synchronisation,
  une « planification initiale » n'y voudrait rien dire.

### Ensuite, les références sont un historique

Une fois la tâche créée, `referenceStart` et `referenceEnd` ne bougent **jamais**
toutes seules. Déplacer une barre dans un Mini-Gantt écrit `start` / `end` et
laisse la référence là où elle est — c'est tout l'intérêt de la comparaison. La
seule réécriture possible est le bouton **Copier les dates actuelles comme
référence** de la fiche tâche, et seulement au clic.

Pour une tâche avec durée, les deux champs sont demandés et la fin doit être
postérieure ou égale au début. Pour un **jalon**, seul *Fin / jalon référence*
est affiché : `referenceEnd` est à la fois le début et la fin de la référence,
aucune durée n'est fabriquée. Une comparaison activée sans les dates nécessaires
affiche l'erreur sous le champ et **bloque l'enregistrement** de la fiche.
Désactiver l'interrupteur masque les champs et retire la barre de référence,
mais conserve les valeurs saisies.

### Ce qui est dessiné

- **Actuel** — la barre existante, **inchangée** : couleur métier, remplissage
  d'avancement, poignée, glisser-déposer, infobulle. Une seule chose s'y ajoute
  en mode Comparaison, un **contour noir** (`.is-compared`) : le contour
  standard, à 12 % d'opacité, se noyait dans la trame du ruban collé dessous.
- **Le ruban** — un **seul bloc continu de 8 px, collé sous la barre**, sans
  interligne. Il ne juxtapose plus trois objets qui se chevauchent : il
  **partitionne** le temps couvert par l'une ou l'autre période, découpé aux
  quatre dates, en segments **disjoints et jointifs**.

| Segment | Ce qu'il dit | Trame |
|---|---|---|
| `reference` | plan et réel coïncident — la période **tenue** | gris bleuté (`#63719A`), hachures à **135°** |
| `late` | le temps que le réel occupe au-delà du plan, ou que le plan réservait avant que le réel ne démarre | rouge corail (`#E4572E`), hachures **montantes** (45°) |
| `ahead` | le temps **rendu** : prévu et non consommé, ou consommé en avance | vert (`#1F9D6B`), hachures **descendantes** (−45°) |

### Une tâche déplacée en bloc garde son plan

La part du plan que le réel n'a pas consommée se peint — départ tardif en rouge,
fin anticipée en vert — **mais seulement si les deux périodes se recoupent
quelque part**.

Sans ce garde-fou, une tâche déplacée **en bloc** (plan du 09/06 au 09/09, réel
du 13/09 au 02/10, aucun recouvrement) voyait ses trois morceaux — plan non
consommé, entre-deux, période réelle — tous classés en retard, puis fusionnés
par la règle des voisins de même nature : un seul pavé rouge d'un bout à
l'autre, dans lequel ni la période initiale ni le glissement ne se lisaient
plus (retour de test).

Un plan abandonné n'a pas « pris du retard » : il est resté où il était. Il
reste donc **gris, en entier**, et le rouge ne couvre que l'entre-deux et la
période réelle.

### La durée initiale se lit toujours

Les trames disent ce qui a **bougé** ; elles ne disent pas combien de temps le
plan **prévoyait**. Dès que le réel sort du plan, la frontière entre « prévu »
et « glissé » se devinait au seul changement de trame — et pas dans tous les
cas : une tâche d'un seul jour au milieu d'un plan de trois mois n'en montrait
aucune.

La période de référence est donc **cerclée à part**, par-dessus les trames,
exactement sur ses deux dates, sans remplissage. Le contour est le **même noir
que la barre réelle** : les deux formes se répondent — le **plein** pour le
réel, au-dessus ; le **creux** pour le prévu, en dessous.

`reference` sort de `miniGanttComparisonStrip` en % de la **piste**, et non du
ruban : le cercle est rendu **à côté** du ruban, pas dedans, avec la même
géométrie (même sommet, même hauteur, même arrondi) et un anneau posé de la même
façon — une ombre portée **à l'extérieur** de la boîte. C'est ce qui fait que
les deux anneaux se **superposent** là où ils coïncident : le noir couvre le
gris, et il ne reste qu'un seul trait. Posé en bordure **intérieure**, son trait
venait s'ajouter à celui du ruban et une tâche conforme portait un liseré épais
sur tout son pourtour.

Le ruban porte le **même contour que la barre réelle, en gris** : les deux
étages se répondent, et le ruban se détache du fond comme du bloc temporel qu'il
traverse. Il est posé par une ombre plutôt qu'une bordure — le conteneur est en
`overflow:hidden` pour arrondir les extrémités, et une bordure y rognerait les
segments.

L'**écart chiffré** se pose sur le bord *extérieur* de sa zone, celui qui
s'éloigne de la barre : un démarrage anticipé à gauche, un retard de fin à
droite. Au centre, il masquait la trame qu'il commente et débordait des deux
côtés d'une zone courte.

**Aucune bordure interne.** C'est le changement de **sens** de la trame, pas un
liseré, qui fait lire les jonctions — un cadre de plus rechargerait ce qu'on
vient d'alléger. Les deux extrémités du ruban sont arrondies par un conteneur en
`overflow:hidden` ; les jonctions internes, jamais. Deux segments consécutifs de
même nature sont **fusionnés** : une tâche repoussée en bloc donne un seul
segment rouge, pas trois morceaux séparés par des jonctions invisibles.

**Deux étages collés, pas une seule bande.** La barre actuelle reste seule sur
sa ligne ; le plan et les écarts vivent sur le ruban, juste en dessous. C'est la
structure qui sépare, pas un habillage. Quatre essais ont précédé celui-ci —
référence en filet de 1 px superposé (invisible), fenêtre à montants épais
(trois objets empilés sur quinze pixels), puis un rail de 4 px à trois objets
qui se chevauchaient, assez sobre pour n'être pas vu. Tous butaient sur le même
reproche : on ne savait plus si la poignée d'avancement était au bout de la
tâche ou s'il restait de la course. Avec le ruban, la question ne se pose plus,
et le plan se voit enfin.

Le ruban est en position absolue dans une piste en `overflow` visible et tient
dans l'interligne : la hauteur de ligne reste **exactement** celle du mode
Standard.

**Le pied du diagramme.** Ce que le ruban fait, les couloirs de risque et leurs
étiquettes le font aussi : ils vivent dans l'interligne, donc **sous** la boîte
de leur ligne. La dernière ligne, elle, n'a pas d'interligne après elle, et le
widget coupe à son bord (`overflow:hidden`, `auto` dans la vue) : sa moitié basse
disparaissait (retour de test). Le rendu mesure donc le débord de la **dernière
ligne** — sur la ligne elle-même, pas d'après les constantes de placement, pour
qu'un habillage ajouté demain soit réservé sans que personne y pense — et pose
exactement autant de hauteur en pied (`.lp-widget-minigantt-rows-tail`). Aucun
débord, aucun élément.

- **Jalon comparé** — un losange fantôme gris à la date de référence, le jalon
  actuel inchangé, et un segment fin entre les deux. Un jalon n'a pas de barre :
  il n'a donc pas de ruban, et tout reste sur sa ligne — l'écart chiffré
  compris. `miniGanttComparisonStrip` rend `null` pour un jalon.

La couleur ne porte jamais seule l'information : chaque segment a son **motif**, et
l'écart est écrit en chiffres (`−3 j`, `+8 j`, `0 j` — négatif = avance,
positif = retard). Les écarts de début et de fin sont calculés **séparément** :

```ts
startDeltaDays = currentStart - referenceStart;
endDeltaDays   = currentEnd   - referenceEnd;
```

### Ce qui est écrit

- **Libellés dans la piste** — au centre de chaque zone d'écart, avance comme
  retard. Ce sont les seuls éléments que la place fait disparaître : ils sont
  masqués quand la zone est trop étroite, quand ils recouvriraient la ligne
  « Aujourd'hui », ou quand la tâche porte des couloirs de risque, dont les
  étiquettes occupent déjà cette bande. **Les barres comparées, elles, restent
  toujours dessinées.**
- **Indicateur latéral** — une pastille avec les autres champs de la ligne,
  portant l'écart de **fin** (ou de jalon), qui est l'écart principal. Elle
  s'affiche même si aucun champ facultatif n'est configuré, et porte un
  `aria-label` en toutes lettres (« Fin : 8 jours de retard »).
- **Infobulle** — quatre lignes ajoutées à celle qui existe déjà (Référence,
  Actuel, Début, Fin ; pour un jalon : Jalon de référence, Jalon actuel, Écart).
  Elle reste portée par le survol, donc elle disparaît à la sortie du pointeur.
Il n'y a **pas de légende**. Elle occupait une ligne pleine largeur pour redire
ce que le diagramme montre déjà — un losange est un jalon, une trame rouge est un
retard — et poussait les barres vers le bas à chaque repère de plus. Les couleurs
et les trames restent expliquées par l'**infobulle** de chaque objet, là où la
question se pose.

### Plage temporelle

En mode Comparaison, les dates de référence entrent dans le calcul de la plage
automatique au même titre que les dates actuelles : une barre ou un jalon de
référence antérieur ou postérieur aux dates actuelles n'est jamais coupé. Les
blocs temporels, jalons, risques et annotations continuent d'alimenter la même
plage, inchangés. En mode Standard, la plage ne bouge pas d'un jour.

### Compatibilité

Aucune migration. Une tâche sans `comparison` et un widget sans
`miniGanttComparisonEnabled` rendent exactement comme avant. Rien n'initialise
une référence au CHARGEMENT — seule la création d'une tâche en pose une, et elle
est affichée avant d'être enregistrée — et la normalisation rend `null` plutôt
qu'un objet vide : une tâche d'avant ce changement reste identique à elle-même
après un aller-retour dans la fiche. Les données de comparaison sont
des propriétés métier ordinaires de la tâche : elles suivent les imports,
exports, sauvegardes et synchronisations comme les autres.

## Tests

Contrôle visuel : `npm run visual:check` monte les deux diagrammes hors ligne
(dépendances CDN rebundlées depuis npm, Firebase bouchonné) sur les données de
démonstration, vérifie que blocs et cadres sont bien dessinés, que l'encadré
posé sur des tâches non successives produit deux cadres et qu'aucune étiquette
n'en recouvre une autre, puis écrit une capture. Voir
[tools/visual-check](../tools/visual-check/README.md) — le dossier est installé
séparément pour ne pas alourdir les builds Netlify.

`apps/nexora/tests/minigantt-comparison.test.mjs` couvre le mode Comparaison de
bout en bout, depuis les mêmes sentinelles : normalisation et validation des
dates de référence, calcul séparé des deux écarts, géométrie des barres
superposées (avance, retard, référence non consommée, décalage intégral,
superposition parfaite), jalons, plage automatique, persistance à la duplication
d'un widget, sérialisation, widget étroit et absence de régression du rendu
standard.

`apps/nexora/tests/gantt-annotations.test.mjs` extrait le bloc de logique pure
de `dist/index.html` entre les sentinelles `NEXORA:GANTT-ANNOTATIONS:START/END`
et l'évalue tel quel : les tests portent sur le code réellement livré dans
l'interface, sans copie à maintenir en parallèle. `scripts/verify-repository.mjs`
vérifie que ces sentinelles et le rendu des annotations restent présents dans le
build.

`apps/nexora/tests/gantt-span-annotations.test.mjs` couvre les annotations
horizontales et le catalogue des types, depuis les mêmes sentinelles :
validation (deux dates valides et une tâche, texte facultatif), normalisation
**idempotente** des réglages et des bouts, placement vertical selon la position
choisie et dans la ligne de la bonne tâche, mise à l'écart d'une annotation dont
la tâche n'est pas affichée ; puis, côté catalogue : au moins vingt symboles tous
distincts (clé et tracé), repli sur le catalogue de départ quand rien n'est
enregistré, conservation des cinq identifiants historiques, nettoyage d'un type
sans le dénaturer, et repli d'un jalon dont le type a disparu sur le premier du
catalogue.

Le contrôle visuel vérifie en plus, sur le rendu réel : le trait posé dans la
ligne de sa tâche, le trait ignoré quand la tâche n'est pas affichée, le calque
des traits au-dessus des barres, **deux bouts réellement différents** quand ils
sont réglés différemment, les traits verticaux de jalon présents uniquement dans
le widget qui coche le réglage et en `z-index: 0`, et des repères tous distincts
à l'écran — y compris celui d'un type ajouté dans les Réglages et celui d'un
jalon dont le type a été supprimé.


## La vue Gantt et le widget : mêmes réglages (#80)

Un même diagramme se pilotait de deux façons selon qu'on le regardait dans un
tableau de bord ou en pleine page. La vue n'avait qu'un extrait de la barre
d'outils dans l'en-tête de page — zoom, regroupement, annotations — et il fallait
ouvrir les réglages pour tout le reste.

La vue porte désormais la **même barre d'outils** que le widget, rendue comme une
bande pleine largeur au-dessus de l'axe : mode Standard / Comparaison, ordre des
lignes, étendue temporelle, zoom, annotations. L'en-tête de page ne garde que ce
qui lui est propre et n'a pas de place dans la bande : le **regroupement** et
l'accès aux **réglages de la vue**.

Les réglages de la vue reprennent aussi le **filtre de tâches** du widget, avec
le même composant de formulaire — donc les mêmes champs et les mêmes règles. Il
s'applique **en plus** des filtres de la page, jamais à leur place : la vue
resserre ce que la page laisse passer.

Reste propre au widget, faute d'objet équivalent dans la vue : la
personnalisation du **cadre** (icône du titre, couleur du titre, couleur du
bandeau, couleur de fond). La vue n'a pas de cadre de widget à habiller.

## Le widget « Bulles » partage ces annotations

Le widget « Bulles » (`docs/WIDGET_BULLES.md`) n'est pas un second diagramme :
c'est le Mini-Gantt rendu en bulles descriptives. Il lit donc la **même** clé
`widget.ganttAnnotations`, dessine les mêmes blocs temporels, encadrés, jalons et
annotations, et se règle avec le **même** éditeur.

Ses **macro-bulles** sont une couche de plus, propre à ce widget
(`widget.bubbleMacros`) — mais leur géométrie ne réimplémente rien : elle appelle
`ganttFrameSegments`, la fonction des encadrés, qui sait déjà qu'un en-tête de
groupe coupe la continuité des lignes.

