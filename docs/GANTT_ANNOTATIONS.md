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

Les listes enregistrées sur un widget avant ce changement sont reprises
automatiquement : au premier affichage, chaque risque est reversé sur sa tâche
puis retiré du widget. Un risque dont la tâche n'est pas affichée par ce
widget-là reste en attente, jusqu'à ce qu'un Mini-Gantt qui la montre s'en
charge.

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

## Tests

Contrôle visuel : `npm run visual:check` monte les deux diagrammes hors ligne
(dépendances CDN rebundlées depuis npm, Firebase bouchonné) sur les données de
démonstration, vérifie que blocs et cadres sont bien dessinés, que l'encadré
posé sur des tâches non successives produit deux cadres et qu'aucune étiquette
n'en recouvre une autre, puis écrit une capture. Voir
[tools/visual-check](../tools/visual-check/README.md) — le dossier est installé
séparément pour ne pas alourdir les builds Netlify.

`apps/nexora/tests/gantt-annotations.test.mjs` extrait le bloc de logique pure
de `dist/index.html` entre les sentinelles `NEXORA:GANTT-ANNOTATIONS:START/END`
et l'évalue tel quel : les tests portent sur le code réellement livré dans
l'interface, sans copie à maintenir en parallèle. `scripts/verify-repository.mjs`
vérifie que ces sentinelles et le rendu des annotations restent présents dans le
build.
