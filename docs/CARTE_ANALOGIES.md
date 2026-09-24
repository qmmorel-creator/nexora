# Carte d'exploration : une analogie par champ de tâche

> **Note d'hypothèses, à valider par Quentin.** Ref #361. Cette version remplace la note
> « Rucher ». L'apiculture n'était qu'un exemple : le monde s'appuie maintenant sur tout le
> vocabulaire d'un paysage habité (relief, bâtiments, végétation, météo, routes, habitants).
> Chaque correspondance repose sur un champ **réel** de Nexora, relevé dans
> `apps/nexora/source/index.html.part-*`.

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
montagne, haute montagne, Grand Nord, canyon) qui garde le même sens des indices mais change
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
| Tâches terminées / total | Le territoire **s'urbanise** : plus il y a de tâches terminées, plus de maisons entourent le beffroi (1 à 4 couronnes) | Territoire vierge |

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
| Durée `end - start` | **Emprise au sol** : moins de 3 jours, un petit bâtiment ; jusqu'à 3 semaines, un bâtiment moyen ; au-delà, un grand bâtiment qui déborde sur une tuile voisine libre |
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

## Points à trancher

1. **Thèmes** : voir les points à trancher de [`CARTE_THEMES.md`](CARTE_THEMES.md).
2. **Friche après 30 jours sans interaction** : bon seuil ?
3. **Habitants par responsable** : utile, ou trop chargé ?
4. **Routes de dépendances** : seulement à la sélection (par défaut), ou toutes visibles ?
5. **Carnet de relevés** : gardé le temps de la session ou mémorisé sur l'appareil ?
