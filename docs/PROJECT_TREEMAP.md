# Widget « Treemap projets »

Mosaïque de **projets** : une tuile = un projet, jamais une tâche. Les tâches ne
servent qu'à calculer les métriques du projet auquel elles appartiennent.

- La **surface** d'une tuile vient du `COUNT()` des tâches du projet retenues par le
  *filtre de taille*.
- La **couleur** vient du même comptage, d'un *second filtre* indépendant, ou de la
  *criticité moyenne*.

## Périmètre : trois filtres empilés, jamais interchangeables

1. **Méta-filtres globaux** et **filtre de la page** du tableau de bord — ils décident des
   tâches qui parviennent au widget (comme pour tous les widgets Nexora).
2. **Filtre du widget** (« Filtrer les tâches prises en compte ») — il réduit encore ce
   périmètre. Un projet sans aucune tâche dans ce périmètre n'a rien à mesurer.
3. **Filtre de taille** et **filtre de coloration** — ils ne réduisent pas le périmètre :
   ils comptent *à l'intérieur*. C'est pourquoi `taskCount` (tâches du projet dans le
   périmètre) et `sizeCount` (tâches retenues par le filtre de taille) sont deux chiffres
   distincts, tous deux lisibles dans l'infobulle.

Les filtres de taille et de coloration utilisent le **moteur de filtres avancés existant**
(`TaskFilterFields` + `applyWidgetFilter`, groupes ET/OU compris). Ils sont stockés **en
clair dans la configuration du widget**, et non par identifiant : Nexora n'a pas de
registre de filtres enregistrés, et une référence pointerait vers un objet inexistant dès
la première duplication. Un filtre absent ou illisible compte simplement toutes les tâches
du périmètre — jamais aucune.

## Configuration

```ts
type ProjectTreemapWidgetConfig = {
  treemapSizeFilter?: WidgetFilter | null;   // même forme que widget.filter
  treemapColorFilter?: WidgetFilter | null;
  treemapColorMode: "sizeFilterGradient" | "secondaryFilterGradient" | "averageCriticality";
  treemapPalette: "ember" | "ocean" | "violet" | "slate" | "levels";
  treemapDirection: "lowToHigh" | "highToLow";
  treemapShowZeroProjects: boolean;
  treemapFields: string[];        // l'ORDRE du tableau est l'ordre d'affichage
  treemapShowProgressRing: boolean;
  treemapGroupBy: "none" | "folder" | "priority" | "owner" | "criticality";
  treemapCompact: boolean;
  treemapShowLegend: boolean;
  treemapShowSearch: boolean;
  treemapOpenOnClick: boolean;
  treemapRadius: "sharp" | "medium" | "round";
  treemapGap: number;             // 0–12 px
  treemapBorder: boolean;
};
```

Tout est relu par `normalizeProjectTreemapConfig`, seul juge des valeurs par défaut : une
configuration absente, partielle ou corrompue reste affichable sans migration de données.
`projectName` est réinséré d'office s'il a disparu — sans lui la tuile ne désigne rien.

## Criticité — règle déterministe, jamais une donnée inventée

Nexora n'a **pas** de champ « criticité » sur la tâche. Plutôt que d'en créer un que
personne ne saurait expliquer, le score est composé de faits déjà présents dans le modèle,
avec des poids fixes rappelés dans l'infobulle de chaque tuile et dans la fiche du widget :

| Fait | Source réelle | Poids |
| --- | --- | --- |
| Tâche en retard | `isTaskLate` | 40 |
| Statut urgent | `isTaskUrgent` | 25 |
| Échéance dans 7 jours ou moins | `task.end` | 10 |
| Jalon | `getTaskType(task) === "milestone"` | 10 |
| Sans interaction depuis 14 jours | `taskInteractionAgeDays` | 10 |
| Projet prioritaire / normal | `project.priority` | 15 / 5 |

- Une tâche **terminée vaut 0** : un projet dont tout est fait doit ressortir calme.
- « Échéance proche » ne s'ajoute pas au retard : une tâche déjà en retard n'approche plus
  de son échéance.
- Le score d'une tâche est borné à 100 ; celui d'un projet est la **moyenne** de ses tâches
  retenues par le filtre de taille.
- Niveaux : maîtrisé `< 25`, vigilance `< 50`, élevé `< 70`, critique `≥ 70`.

## Couleur

- Les comptages ont un domaine `[0, max]`, avec un **plancher d'échelle** (`TREEMAP_MIN_COLOR_SPAN = 4`) :
  sans lui, un portefeuille dont le pire projet compte deux tâches afficherait ce projet au
  rouge le plus vif. La couleur forte reste réservée aux valeurs réellement élevées.
- La criticité garde un domaine **fixe 0–100** : deux widgets côte à côte donnent la même
  couleur au même score.
- Valeur **absente** et valeur **zéro** ne sont pas la même chose : l'absence donne le gris
  neutre, jamais le bas d'échelle (`Number(null)` vaut 0, d'où le garde-fou explicite).
- La légende découpe le domaine en quatre tranches **entières** au plus, avec le nombre de
  projets de chacune ; cliquer une tranche n'affiche temporairement qu'elle.

## Champs des tuiles

Catalogue : nom du projet (verrouillé), statut dominant des tâches, responsable principal,
compteur du filtre de taille, compteur du filtre de coloration, progression, criticité
moyenne, tâches en retard, tâches urgentes, risques ouverts, prochain jalon, dernière
échéance, budget consommé, priorité du projet, dossier — plus les **champs personnalisés
numériques**, sommés sur les tâches retenues.

Nexora n'ayant ni statut ni responsable au niveau du projet, ces deux champs sont **dérivés
des tâches** : statut le plus fréquent, responsable le plus fréquent. C'est une donnée
réelle et redémontrable, pas un champ nouveau.

La **densité** de chaque tuile est calculée sur sa taille en pixels réellement obtenue
(`treemapTileDensity`) et décide du nombre de champs secondaires affichés : 3 en grande
tuile, 1 en moyenne, 0 en petite. Les textes sont tronqués, jamais superposés ; l'infobulle
et l'attribut `title` donnent le détail complet.

## Prochaines tâches

Réglage facultatif « Afficher les prochaines tâches du projet » : les tâches non terminées
qui portent une échéance, **de la plus ancienne à la plus récente** — les échéances dépassées
viennent donc naturellement en tête, en rouge. Sur une tuile foncée, le rouge plein
deviendrait illisible : c'est sa version claire qui est utilisée.

Le nombre de lignes suit la **hauteur réelle** de la tuile (`treemapUpcomingCapacity`), après
déduction du nom, du bloc principal et de la rangée de capsules. Zéro ligne plutôt qu'une
ligne coupée en deux ; rien non plus sous 110 px de large, où un titre tronqué à trois points
n'apprendrait rien. Le reste est annoncé par un « + N autres », et la liste est plafonnée à
huit à la source — au-delà, la tuile deviendrait une liste.

## Pavage

`squarifyTreemap` implémente l'algorithme *squarified* (Bruls, Huizing, van Wijk) : des
tuiles aussi proches du carré que possible, donc comparables à l'œil. Le pavage est calculé
sur la taille **mesurée** du widget (`ResizeObserver`), jamais estimée — c'est ce qui
garantit qu'aucune tuile ne sort du cadre quand on redimensionne. Un projet dont le
`COUNT()` est nul reçoit un poids plancher (12 % du maximum) pour rester visible en tuile
minimale lorsque le réglage le demande, sans écraser les projets qui portent des tâches.

Avec un regroupement actif, `treemapGroupRects` répartit la hauteur au prorata du poids de
chaque groupe, avec une hauteur minimale utile : quand la place manque, la zone défile
plutôt que d'écraser les tuiles.

## Performance

Les deux filtres sont évalués **une fois** sur tout le périmètre, puis consultés par
identifiant (`Set`) : aucun re-filtrage par projet ni par rendu. Statistiques, domaine,
légende, regroupement et pavage sont mémoïsés séparément, de sorte qu'un simple survol ou
une recherche ne relance pas les comptages.

## Interactions

Clic → ouvre le projet (`selectProjectAndNavigate`). Survol → infobulle complète : les deux
comptages, les métriques du projet et la règle de criticité. Clic droit → ouvrir, modifier
le projet, ou filtrer l'onglet courant sur ce projet. Recherche par nom, légende cliquable,
sélection visuelle d'une tuile.

## Contrôles

- `apps/nexora/tests/project-treemap.test.mjs` — 12 tests extraits des sentinelles
  `NEXORA:PROJECT-TREEMAP` et `NEXORA:COLOR-UTILS` de l'interface réellement construite :
  comptages, indépendance des deux filtres, criticité, échelle de couleur, légende, pavage
  (couverture exacte, aucun chevauchement, aucune tuile hors cadre), répartition des
  groupes, densité, configuration dégradée.
- `npm run visual:check` — le banc hors ligne monte le widget en 700 × 340 puis en
  300 × 150 et vérifie qu'aucune tuile ne déborde ni n'en recouvre une autre, que le clic
  ouvre le bon projet et que la fiche expose les trois modes de coloration, les champs
  réordonnables et le moteur de filtres avancés.
