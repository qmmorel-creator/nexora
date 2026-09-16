# Annotations du Gantt — blocs temporels et encadrés

Deux annotations configurables se superposent aux diagrammes de Gantt — la vue
Gantt d'un projet, le widget « Gantt (complet) » et le widget « Mini-Gantt » —
sans jamais modifier les tâches :

- **bloc temporel** — une grande phase transverse (Études, Gros œuvre, Second
  œuvre…), dessinée comme un rectangle très légèrement teinté sur toute la
  hauteur utile de la zone graphique, borné par deux limites verticales ;
- **encadré** — un cadre qui met en évidence une ou plusieurs tâches.

## Où c'est stocké

Les annotations appartiennent à la **configuration de l'affichage**, jamais aux
tâches. Deux emplacements selon le contexte, pour un seul et même composant de
rendu (`GanttView`) :

| Contexte | Emplacement | Persistance |
|---|---|---|
| Vue Gantt d'un projet | `viewPrefs.gantt.temporalBlocks` / `.highlightFrames` | clé Firebase `nexora:viewPrefs` |
| Widget « Gantt (complet) » | `widget.ganttAnnotations` | avec le widget, dans son tableau de bord |
| Widget « Mini-Gantt » | `widget.ganttAnnotations` | avec le widget, dans son tableau de bord |

Les deux widgets utilisent la **même clé** `widget.ganttAnnotations` et la même
forme de données : changer un widget de type ne perd pas ses annotations.
`GanttView` reçoit les siennes par les props `annotations` et
`onAnnotationsChange` ; sans ces props, il retombe sur les préférences de vue.
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
  // Propres au Mini-Gantt (ignorés par le Gantt complet) :
  milestones?: MiniGanttMilestone[];
  notes?: MiniGanttNote[];
};

// Les risques de délai NE sont pas ici : ils appartiennent à la tâche.
type Task = { /* … */ delayRisks?: MiniGanttTaskRisk[] };
```

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
  Gantt complet). Les fenêtres de décision et les méta blocs suivent ; la vue n'étant pas un
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

**Stockage** — dans les préférences de la vue (`viewPrefs.projects`), comme le Gantt complet ;
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
  type: "standard" | "decision" | "contractual" | "delivery" | "commissioning";
  color?: string; taskId?: string | null;   // un jalon peut n'être rattaché à rien
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
```

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
  - **Gantt complet** — dessiné dans chaque piste, comme la grille verticale et
    la ligne « aujourd'hui ». Les en-têtes de groupe, opaques, interrompent donc
    la bande.
  - **Mini-Gantt** — **une seule bande continue** en arrière-plan de toutes les
    lignes, en-têtes de groupe et interlignes compris. Le rendre dans la grille
    commune aux lignes le découpait en autant de morceaux que de groupes, avec
    une bande claire à chaque en-tête. Le rail de chaque ligne
    (`.lp-widget-minigantt-track`) est translucide pour la même raison : plein,
    il coupait la bande d'un trait clair par ligne.

- Le **titre** d'un bloc s'affiche différemment selon le diagramme : étiquette
  verticale près du bord gauche dans le Gantt complet ; dans le Mini-Gantt, une
  bande d'en-tête propre, sous le contexte de dates et au-dessus des lignes, où
  chaque titre est un libellé horizontal aligné sur son bloc. Deux blocs qui se
  chevauchent dans le temps occupent deux lignes de cette bande, jamais le même
  emplacement.

- Les éléments de tâche restent lisibles **dans** un bloc : la barre est posée
  sur une base opaque plutôt que de prendre la teinte de la bande, elle porte un
  contour fin, et un jalon à icône reçoit un halo clair.
- Les unités diffèrent parce que les deux diagrammes ne positionnent pas leurs
  barres pareil : pixels et jour de fin inclus dans le Gantt complet,
  pourcentages et bornage à la fenêtre affichée dans le Mini-Gantt. Chaque bloc
  s'aligne donc exactement sur les barres de son propre diagramme.
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

- dans les paramètres des widgets « Gantt (complet) » et « Mini-Gantt », en deux
  sections repliables ;
- dans la modale ouverte par « + Bloc temporel » / « + Encadré » de la barre
  d'actions du Gantt complet, par « + Bloc » / « + Encadré » sous le zoom du
  Mini-Gantt, et par un clic sur l'étiquette d'une annotation.

Il permet de lister, créer, modifier, dupliquer, supprimer (avec la confirmation
standard) et réordonner. Un bloc dont les dates sont invalides, ou dont la fin
précède le début, affiche l'erreur sous les champs, n'est pas dessiné, et bloque
l'enregistrement de la fiche du widget.

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

### Les références sont un historique

`referenceStart` et `referenceEnd` ne bougent **jamais** toutes seules. Déplacer
une barre dans un Mini-Gantt écrit `start` / `end` et laisse la référence là où
elle est — c'est tout l'intérêt de la comparaison. La seule réécriture possible
est le bouton **Copier les dates actuelles comme référence** de la fiche tâche,
et seulement au clic.

Pour une tâche avec durée, les deux champs sont demandés et la fin doit être
postérieure ou égale au début. Pour un **jalon**, seul *Fin / jalon référence*
est affiché : `referenceEnd` est à la fois le début et la fin de la référence,
aucune durée n'est fabriquée. Une comparaison activée sans les dates nécessaires
affiche l'erreur sous le champ et **bloque l'enregistrement** de la fiche.
Désactiver l'interrupteur masque les champs et retire la barre de référence,
mais conserve les valeurs saisies.

### Ce qui est dessiné

- **Référence** — une barre en arrière-plan, gris bleuté (`#7C8DB5`), remplissage
  très léger et contour visible. Elle déborde de 2 px au-dessus et au-dessous de
  la barre actuelle : sur une superposition parfaite, son contour reste
  discernable. Tout est en position absolue dans la piste — la ligne ne grandit
  pas d'un pixel. Tronquée par le bord de la fenêtre, son trait devient
  pointillé de ce côté.
- **Actuel** — la barre existante, inchangée : couleur métier, point
  d'avancement, glisser-déposer, infobulle.
- **Retard** (`late`) — la part de la période actuelle postérieure à la fin de
  référence, hachures **montantes** rouge corail (`#E4572E`).
- **Avance** (`ahead`) — la part de la période actuelle antérieure au début de
  référence, hachures **descendantes** vertes (`#1F9D6B`).
- **Référence non consommée** (`freed`) — la fin de référence que la tâche
  n'atteint pas, gardée en pointillé dilué plutôt qu'effacée.
- **Jalon comparé** — un losange fantôme gris à la date de référence, le jalon
  actuel inchangé, et un segment fin entre les deux.

La couleur ne porte jamais seule l'information : chaque zone a son **motif**, et
l'écart est écrit en chiffres (`−3 j`, `+8 j`, `0 j` — négatif = avance,
positif = retard). Les écarts de début et de fin sont calculés **séparément** :

```ts
startDeltaDays = currentStart - referenceStart;
endDeltaDays   = currentEnd   - referenceEnd;
```

### Ce qui est écrit

- **Libellés dans la piste** — au centre de la zone d'avance et de la zone de
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
- **Légende** — `Initial`, `Actuel`, `Avance`, `Retard`, avec exactement les
  couleurs, contours et motifs des lignes. Elle n'apparaît que si le widget
  contient réellement au moins une comparaison exploitable.

### Plage temporelle

En mode Comparaison, les dates de référence entrent dans le calcul de la plage
automatique au même titre que les dates actuelles : une barre ou un jalon de
référence antérieur ou postérieur aux dates actuelles n'est jamais coupé. Les
blocs temporels, jalons, risques et annotations continuent d'alimenter la même
plage, inchangés. En mode Standard, la plage ne bouge pas d'un jour.

### Compatibilité

Aucune migration. Une tâche sans `comparison` et un widget sans
`miniGanttComparisonEnabled` rendent exactement comme avant. Rien n'initialise
une référence à partir des dates actuelles, et la normalisation rend `null`
plutôt qu'un objet vide : une tâche d'avant ce changement reste identique à
elle-même après un aller-retour dans la fiche. Les données de comparaison sont
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
