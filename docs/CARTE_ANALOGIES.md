# Carte d'exploration : une analogie par champ de tâche

> **Livré dans la vue Carte** (Ref #361). Code : blocs `NEXORA:CARTE` (logique pure, testée par
> `apps/nexora/tests/carte.test.mjs`) et `NEXORA:CARTE-ENGINE` (rendu three.js), composant
> `CarteView`. Chaque correspondance repose sur un champ **réel** de Nexora. Les écarts avec la
> première version de cette note sont listés en fin de document ; la lecture des dates dans le
> temps (curseur, période, disposition par échéance) est suivie dans #362.

## Règle de construction : un champ, un canal visuel

Pour que la carte se lise sans légende après quelques minutes, chaque champ utilise un
**canal** qui lui est réservé. Deux champs ne modifient jamais le même aspect d'un objet.

| Canal | Champ qui l'occupe |
|---|---|
| Stade de construction du bâtiment | Statut |
| Nature du bâtiment (sa silhouette) | Type, jalon |
| Signal au sommet (feu, fanion) | Criticité |
| Ciel au-dessus de la tuile | Échéance (retard, proche) |
| Brume sur la tuile | Date de début future |
| Emprise au sol (taille du terrain) | Durée (`end - start`) |
| Hauteur d'échafaudage | Avancement (`progress`) |
| Habitant posté devant | Responsable (`assignee`) |
| Petites annexes autour | Sous-tâches (`checklist`) |
| Végétation envahissante | Fraîcheur (`lastInteraction`) |
| Routes, ponts, convois | Liens (`dependsOn`, `secondaryProjectId`, dossiers) |
| Objets posés au sol | Pièces jointes, compte rendu, origine |

**Thèmes.** Les objets cités dans cette note (beffroi, atelier, échafaudage…) sont ceux du
thème **Ville**. Chaque projet reçoit un thème (ville, campagne, forêt, désert, mer, lac,
montagne, haute montagne, Grand Nord, canyon, marais, jungle, volcan, île tropicale) qui garde le même sens des indices mais change
les objets et la façon de progresser : voir [`CARTE_THEMES.md`](CARTE_THEMES.md).

Principes inchangés :

- la carte est une **lecture** des données. Se déplacer, visiter ou explorer ne modifie jamais
  une tâche ;
- toute modification passe par la fiche Nexora habituelle (`openEditTask`, puis `saveTask`),
  ouverte explicitement ;
- aucun lien n'est inventé ;
- aucune récompense n'est liée au fait de terminer une tâche.

## 1. Projet → territoire

| Champ | Analogie | Valeur manquante |
|---|---|---|
| `id` | Graine de la carte : emplacement, relief, biome (prairie, forêt, lande, dunes, vergers, rizières) | — |
| `name` | Nom gravé sur la bannière du **beffroi**, le bâtiment central du territoire | « Projet sans nom » |
| `icon` | Emblème peint sur la bannière | Bannière unie |
| `color` | Couleur des bannières, des toits et des bornes de frontière | Ocre neutre |
| `priority` `high` | Le beffroi devient une **citadelle** sur une colline | Traité comme `normal` |
| `priority` `low` | Le beffroi est un simple **hameau** (maison et puits) | — |
| Tâches terminées / total | Le territoire **s'urbanise** : plus il y a de tâches terminées, le centre passe par 6 paliers (0, 20, 40, 60, 80, 100 %), propres au thème | Territoire vierge |

## 2. Dossiers → géographie

| Champ | Analogie |
|---|---|
| `folderId` | Les projets d'un même dossier forment une **région** d'un seul tenant, reliée par des routes pavées |
| `projectFolders.parentId` | Les sous-dossiers forment des **provinces** de la région, séparées par une rivière franchie par des ponts |
| Dossiers différents | Séparés par un **bras de mer** peu profond, que l'arpenteur traverse à gué |
| « À trier » (`folder-a-trier`) | Îlots isolés au large, sans route : ce classement n'est pas un lien |

## 3. Tâche → bâtiment

### Statut → stade de construction

Les statuts sont dynamiques. Chaque statut est rangé dans une famille d'après son nom, avec
les mêmes règles que Nexora (`isTaskDoneGlobal`, statuts protégés `/termin/` et
`/en\s*cours/`). La couleur réelle du statut reste affichée sur l'étiquette.

| Famille | Règle, dans l'ordre | Analogie |
|---|---|---|
| Terminé | nom contenant `termin` | **Bâtiment achevé**, fenêtres éclairées |
| Information | type Information ou nom `information` | **Panneau d'affichage** en bois, pas de bâtiment |
| En cours | nom contenant `en cours` | **Chantier actif** : échafaudage, grue, fumée de chantier |
| En attente | nom contenant `attente` | **Chantier bâché**, avec une charrette qui attend sur la route |
| À faire | tout autre statut | **Parcelle jalonnée** : piquets, cordeau et tas de matériaux |

### Type → nature du bâtiment

| Donnée | Analogie |
|---|---|
| `milestone: true` (jalon) | **Phare** ou obélisque, visible de loin. Il prime sur le type. |
| Type « Réunions » (`isMeetingTask`) | **Halle** ouverte, avec des bancs |
| Type « Planning » | **Tour de l'horloge** |
| Type « Tâches » | **Atelier** ou maison |
| Type « Information » | Panneau (voir le statut) |
| Type personnalisé | Maison dont la façade prend la couleur du type ; son icône sur l'enseigne |
| Type absent ou inconnu | Atelier générique |

Le statut et le type se combinent. Un jalon en cours est un phare sous échafaudage ; une
réunion à faire est une parcelle jalonnée en forme de halle.

### Criticité → signal au sommet

| `criticality` | Analogie |
|---|---|
| `urgent` | **Feu de signal** rouge au sommet, visible de loin (`#DC2626`) |
| `moyen` | **Fanion** orange (`#D97706`) |
| `bas` | Rien |
| vide | Rien. Si le nom du statut contient « urgent », le feu s'allume, comme `isTaskUrgent`. |

La criticité est aussi écrite dans l'étiquette : la couleur n'est jamais le seul indice.

### Dates → ciel, brume et emprise

| Donnée | Analogie |
|---|---|
| En retard (`isTaskLate`) | **Petit nuage d'orage** au-dessus de la tuile ; l'étiquette indique « En retard de N j » |
| Échéance dans les 7 jours | **Lanterne** allumée devant la porte |
| `start` future, tâche à faire | **Brume** sur la tuile : la tâche est à l'horizon |
| Durée `end - start` | **Taille de l'objet** : moins de 3 jours, petit ; jusqu'à 3 semaines, moyen ; au-delà, grand |
| `startTime` / `endTime` | **Cadran solaire** devant la porte (tâche à heure fixe) |
| Dates manquantes | Ni nuage, ni lanterne, ni brume ; taille moyenne ; « Sans échéance » dans le panneau |

### Réalisation → échafaudage, habitants, annexes

| Donnée | Analogie |
|---|---|
| `progress` (0 à 100) | Hauteur des murs sous l'échafaudage : le chantier monte avec l'avancement |
| `assignee` | Un **habitant** posté devant le bâtiment. Chaque personne a une couleur de tenue stable, indiquée dans la légende. Tâche non attribuée : pas d'habitant. |
| `checklist[]` | **Annexes** autour du bâtiment (jusqu'à 6) : caisses de matériaux pour les sous-tâches à faire, murets et appentis pour celles qui sont faites |
| `recurrence` | Un **moulin à vent** dont les ailes tournent : la tâche revient |

### Fraîcheur et ancienneté → végétation

| Donnée | Analogie |
|---|---|
| `lastInteraction` il y a plus de 30 jours, tâche non terminée | **Friche** : herbes hautes et ronces autour. La tâche est oubliée, pas forcément en retard. |
| `completedAt` récent (moins de 7 jours) | **Guirlandes** sur le bâtiment achevé |
| `completedAt` il y a plus de 30 jours | Le bâtiment rejoint les maisons autour du beffroi. Il reste compté, mais n'est plus dessiné à part (un filtre « Tout l'historique » le ramène). |

### Contenu et provenance → objets au sol

| Donnée | Analogie |
|---|---|
| `desc` | Panneau de détail seulement (280 caractères) |
| `attachments[]` | **Coffre** devant la porte, avec le nombre de pièces jointes |
| `meetingReport` renseigné | **Rouleau de parchemin** posé sur un banc de la halle |
| `source` e-mail (`sourceMessageId`) | **Boîte aux lettres** |
| Tâche importée d'un calendrier (`gcalSource` du projet) | **Cadran** sur la tour du beffroi |
| `customFields` | Panneau de détail seulement |

## 4. Liens → routes et convois

| Donnée | Analogie |
|---|---|
| `dependsOn[]` | **Route de convoi** entre le prédécesseur et la tâche. Elle est affichée à la sélection, avec une charrette qui va de l'un à l'autre ; un mode « Routes des dépendances » les montre toutes. Entre deux projets, la route franchit la frontière par un pont. |
| Prédécesseur non terminé | La charrette est arrêtée devant une **barrière** : la tâche est bloquée |
| `secondaryProjectId` | **Comptoir** : un second drapeau aux couleurs du projet partenaire ; à la sélection, un pont en pointillés mène à son beffroi |
| Aucun lien | Aucune route. La légende rappelle que deux territoires voisins de dossiers différents ne sont que voisins de carte. |

## 5. Le personnage et l'exploration

Le personnage devient un **arpenteur**, carnet et bâton de mesure en main.

| Geste | Effet | Écrit dans Nexora ? |
|---|---|---|
| Marcher (clavier, manette tactile, toucher une tuile) | Déplacement ; la caméra suit | Non |
| Approcher un bâtiment | Étiquette et aperçu | Non |
| Entrée ou « Lire » | Panneau de détail avec les champs réels | Non |
| Première visite d'un bâtiment | Il est noté dans le **carnet de relevés** (session) | Non |
| Première visite d'un beffroi | Le territoire est cartographié dans le carnet | Non |
| « Ouvrir la fiche » | Modale Nexora habituelle | Seulement si l'utilisateur enregistre la fiche |

Le carnet mesure ce que l'on a **regardé**, pas ce que l'on a fait. Il ne pousse donc pas à
cocher des tâches pour progresser.

## 6. Hors de la carte

- Tâches archivées ou supprimées (`taskArchive`) : absentes.
- Tâche sans projet, ou dont le projet a disparu : posée dans une **Terre inconnue**, un
  territoire spécial signalé comme tel.
- Filtres de méta-vue (`metaFilteredTasks`) : appliqués, pour que la carte montre le même
  périmètre que les autres vues.

## 7. Grands volumes

| Zoom | Détail |
|---|---|
| Proche | Tous les canaux : habitants, annexes, objets au sol, animations |
| Moyen | Bâtiments, signaux, ciel ; pas d'habitants ni d'objets au sol |
| Éloigné | Beffrois et résumé par territoire (« 12 à faire · 3 en cours · 20 terminées · 2 en retard ») |

- Les animations (moulins, fumées, charrettes) sont plafonnées selon la qualité graphique.
- La qualité est choisie automatiquement d'après le volume, et reste modifiable.
- Les étiquettes ne se chevauchent pas : la plus prioritaire d'abord, les autres masquées.
- Sans WebGL : liste des territoires avec les mêmes informations et les mêmes liens vers les
  fiches.

## 8. Stabilité de la carte

Le moteur des maquettes ne change pas :

- mêmes données, même carte ;
- les projets sont placés par ordre de création, donc un nouveau projet ne déplace aucun
  territoire (vérifié) ;
- les emplacements sont mémorisés sur l'appareil, donc une suppression ne décale pas les voisins
  (vérifié) ;
- une tâche garde sa tuile, sauf si une nouvelle route passe exactement dessus.

## Écarts entre la note et la version livrée

- **Durée** : un grand chantier est agrandi sur sa tuile, il ne déborde pas sur la voisine.
- **Friche** : 30 jours sans interaction (`lastInteraction`), comme proposé.
- **Habitants** : affichés en vue proche seulement (niveau de détail 2), avec la couleur du
  membre de l'équipe, ou une couleur stable tirée du nom.
- **Routes de dépendances** : affichées à la sélection seulement, avec une charrette animée et
  une barrière rouge si la tâche précédente n'est pas terminée.
- **Carnet de relevés** : compté pour la session (tâches approchées, territoires visités), jamais
  enregistré.
- **Emplacements mémorisés** : clé `nexora:carte:layout` du `localStorage` de l'appareil, jamais
  synchronisée.
- **Dates dans le temps** : pas encore de curseur ni de filtre de période, voir #362.

## Évolutions après les premiers tests (#364 à #369)

- **Filtre général** (#364) : le bouton « Filtres » de la carte ouvre le moteur de filtre de
  Nexora (celui des widgets et du Calendrier). Les tâches écartées disparaissent ; les
  territoires restent en place.
- **Panneau de droite** (#365) : en entrant dans une région (dossier), la liste de ses projets
  avec leur palier ; le projet où se trouve l'arpenteur déplie ses tâches, en retard d'abord.
  Un clic conduit à la tâche et ouvre son détail. Replié par défaut sur mobile.
- **Icônes** (#366) : les étiquettes 3D n'affichent que les emoji ; ruban et panneau passent
  par l'affichage d'icônes de Nexora (`tabler:`, `iconify:`, images).
- **Criticité urgente** (#367) : anneau au sol et fanal rouges qui clignotent ; fixes si les
  animations sont réduites.
- **Thème par dossier** (#368) : réglable dans *Réglages › Dossiers de projets › Réglages du
  dossier*. Enregistré sur le dossier (`mapTheme`), donc synchronisé entre appareils ; la carte
  écrit au même endroit.
- **Altitude** (#369) : chaque tâche repose sur un socle de 0,24 unité par palier (0 à 5) ;
  une tâche terminée culmine, une tâche à faire reste au sol. Le cœur du projet s'élève aussi
  avec le palier du territoire.

## Modification depuis le volet (#371) et tâches terminées (#372)

- **Le volet de droite est modifiable** : titre, statut, criticité, dates, responsable,
  description, et un curseur d'avancement. Pendant le glissement du curseur, la construction
  évolue en direct sur la carte ; la valeur est enregistrée au lâcher. Chaque modification est
  un geste explicite et passe par les mécanismes de Nexora (`setTasks`) ; « Terminé » passe par
  `markTaskDone`, récurrence comprise. Une tâche Google Calendar et un type à statut imposé
  gardent leurs règles habituelles. Se déplacer sur la carte ne modifie toujours rien.
- **Tâches terminées** : une coche verte flotte au-dessus de chacune. Dans la carte, le filtre
  « Terminées » décide seul de leur affichage, même si le bouton « Montrer les tâches
  terminées » de l'en-tête est désactivé ; les autres filtres de la page s'appliquent. Les
  tâches terminées depuis plus de 30 jours restent visibles, sauf si l'option « Masquer les
  tâches terminées depuis plus de 30 jours » est cochée.

## Territoires écartés par les filtres (#374)

Un projet qui a des tâches mais dont aucune ne ressort des filtres (page, carte, filtre
général) est grisé : sol, décor, cœur du projet, étiquette, pastille du ruban et ligne du
panneau. Une région dont tous les projets sont écartés paraît donc grisée en entier. Un projet
sans tâche n'est pas grisé. Les territoires ne bougent pas.

## Feu des tâches critiques (#375) et construction continue (#376)

- **Criticité urgente** : un brasier (pied, vasque, braises) porte trois flammes rouge, orange
  et jaune qui vacillent. L'anneau rouge clignotant au sol reste. Flammes fixes en qualité basse
  ou si les animations sont réduites.
- **Construction continue** : le chantier et son socle montent de façon continue avec
  l'avancement (0,24 unité par tranche de 20 %, soit 1,2 unité à 100 %), et chaque cran du
  curseur du volet se voit en direct. Une tâche « À faire » dont l'avancement dépasse 0 %
  s'affiche en chantier ; son statut ne change pas. Les paliers restent la mesure affichée dans
  le volet et la progression des territoires.
