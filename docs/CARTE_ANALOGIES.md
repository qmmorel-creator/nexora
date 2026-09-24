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
montagne, haute montagne, Grand Nord, canyon, marais, jungle, volcan, île tropicale, Cyberpunk) qui garde le même sens des indices mais change
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

## Lisibilité (#377, #378, #379)

- **Nom du dossier au sol** : chaque région porte le nom de son dossier en grandes lettres,
  écrit au sol à son pied, comme une légende de carte. Il pivote avec la caméra et grise quand
  toute la région est écartée par les filtres. Pas de légende pour les projets sans dossier ou
  « À trier ».
- **Étiquettes** : le nom du palier du thème (« Crique », « Point d'eau »…) n'apparaît plus
  dans les étiquettes, le ruban ni le panneau : seulement le nom, l'avancement et les retards.
  Le thème reste dans la légende contextuelle.
- **Tâches au sol** : une dalle claire bordée de la couleur du statut marque l'emplacement de
  chaque tâche restée au sol ; une tâche à faire porte en plus un jalon au fanion de la couleur
  de son statut ; empreinte et repères du thème plus contrastés.

## Taille de la construction = pourcentage (#380)

- La hauteur construite d'une tâche est exactement le pourcentage d'avancement de sa hauteur
  finale (à 50 %, la moitié). Les bâtiments sont agrandis en hauteur (hauteur finale visée
  ~1,6 avant l'échelle de la carte) pour que l'écart se voie de loin. Le socle d'avancement a été retiré (#383) : seul le bâtiment monte.
  L'étiquette de la tâche affiche son pourcentage.
- La vue se décale pour que la tâche sélectionnée ne passe ni sous le volet (ordinateur) ni
  sous la fiche (téléphone) ; sur téléphone, la barre d'outils tient sur une ligne défilante.

## Météo, responsables et relief (#381, #382, #383)

- **Orages** : une tâche en retard porte un petit nuage d'orage, avec éclairs et pluie qui tombe
  sur elle. En retard **et** urgente : un énorme orage (nuage bien plus large, pluie dense) et un
  tourbillon qui tourne sous le nuage. Le feu des tâches critiques (#375) est retiré ; une tâche
  urgente garde son anneau rouge clignotant et un fanion rouge plus haut. En qualité basse ou
  avec « réduire les animations », les nuages restent immobiles et sans pluie.
- **Responsable** : chaque tâche porte un petit badge rond, dans la couleur du membre définie
  dans Réglages, avec ses initiales (« Maïa Sonnier » → MS). Pas de photo. Au survol de la
  souris, une bulle affiche « Responsable : Nom ».
- **Relief** : l'altitude du **sol** d'une tâche dépend de sa date de fin, la hauteur du
  **bâtiment** dépend de son avancement.
  - En retard, échéance sous 7 jours ou tâche terminée : niveau de la mer.
  - Au-delà, le sol monte progressivement (plus vite les premières semaines, racine carrée)
    jusqu'à son maximum à 90 jours, sans exagération.
  - Sans date de fin : altitude moyenne.
  Une case d'eau qui porte une tâche plus haute que le niveau de la mer devient une terre.

## Incendie des tâches urgentes (#385)

- Une tâche ouverte de criticité **urgente** brûle : plusieurs foyers de flammes (rouge, orange,
  jaune) au pied et sur la construction, des braises et une colonne de fumée noire, en plus de
  l'anneau rouge clignotant.
- En retard **et** urgente, l'énorme orage avec tourbillon prend le dessus : pas d'incendie
  dessous. Une tâche terminée ou « info » ne porte aucun aléa.
- En qualité basse ou avec « réduire les animations », le feu reste visible mais figé, sans
  braises.

## Horloge, éclairs, relief, lave, récurrence et jalon (#406 à #409, #414, #416)

- **En retard** (#414) : le petit nuage est remplacé par un réveil rouge qui flotte au-dessus
  de la tâche, face à la caméra. Sa trotteuse avance d'un cran par seconde et il bascule à
  chaque tic ; figé si les animations sont réduites.
- **En retard et urgente** (#406) : le tourbillon est retiré. Un nuage noir se forme très haut
  dans le ciel, et trois gros éclairs en zigzag, entourés d'un halo, tombent jusqu'au pied de la
  tâche sous une pluie dense. Chaque éclat dessine un tracé nouveau. Si les animations sont
  réduites, les éclairs restent allumés et immobiles.
- **Plus d'altitude selon l'échéance** (#407) : le sol garde le relief de son thème (terrasses,
  dunes, cratère…) quelle que soit la date de fin. Le retard reste lisible par l'orage et
  l'imminence par la lanterne.
- **Lave du Volcan** (#408) : deux coulées incandescentes descendent du cratère et des poches
  affleurent autour du sommet. La lave luit et pulse doucement. Aucune tâche ni aucun décor ne
  s'y pose.
- **Récurrence** (#409) : le mécanisme qui tournait (moulin, roue, éolienne) et la ligne
  « Récurrente » de la légende sont retirés. La récurrence reste visible dans la fiche.
- **Jalon** (#416, remplacé par #419) : le faisceau de lumière prenait trop de place en
  hauteur. Un jalon est désormais une **borne milliaire**, la même dans tous les thèmes : socle,
  fût de pierre clair, tête arrondie à la couleur du **type de jalon** de Nexora, surmontée
  d'une pierre qui rappelle son symbole (losange, disque, carré, triangle, étoile…). Une fois
  le jalon terminé, une couronne de laurier dorée entoure la tête et la pierre s'illumine. La
  borne reste basse (environ un tiers d'un bâtiment achevé).

## Animations persistantes (#425 à #437)

Elles tournent en continu, lisent une donnée de Nexora et se coupent ensemble dans
*Affichage → Animations d'ambiance* (l'anneau des jalons reste toujours affiché).

| Animation | Ce qu'elle dit |
|---|---|
| Convois entre tâches dépendantes (#425) | Une charrette circule du prédécesseur vers la tâche ; arrêtée devant une barrière rouge si le prédécesseur n'est pas terminé. |
| Barque (#428) | L'arpenteur rame sur l'eau hors des ponts. |
| Ouvriers (#429) | Marteau qui frappe : tâche en cours. Assis, le pied qui tapote : en attente. |
| Pigeon voyageur (#430) | Tâche en attente ; il vole de plus en plus lentement à mesure que l'attente dure. |
| Lanterne (#431) | Échéance sous 7 jours ; elle pulse de plus en plus vite à l'approche de la date. |
| Drapeau (#433) | Hissé sur son mât à la hauteur du pourcentage d'avancement du projet. |
| Jour et nuit (#436) | Lumière à l'heure réelle ; le soir, les bâtiments des échéances du jour s'allument. |
| Anneau des jalons (#437) | Au sol autour de la borne : part allumée = avancement ; complet et vert quand le jalon est terminé. |

La météo par dossier (#426), la tournée du jour (#427), l'éolienne (#432) et la pile de
dossiers (#434) ont été retirées après essai.

## Mode Fil d'Ariane (#435)

Bouton *Fil d'Ariane* de la barre : la carte ne garde que les 8 prochaines échéances
ouvertes (parmi les tâches retenues par les filtres), la caméra les cadre, chacune porte
son numéro d'ordre et un chemin de points lumineux les relie dans l'ordre. La pastille
« Fil d'Ariane » en bas de la vue permet d'en sortir. Le mode ne dépend pas des animations
d'ambiance.
