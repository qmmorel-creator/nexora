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
};
```

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
