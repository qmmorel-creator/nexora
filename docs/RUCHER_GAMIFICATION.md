# Rucher : comment les projets et tâches deviennent un monde à explorer

> **Note d'hypothèses, à valider par Quentin.** Ref #361.
> Rien ici n'est encore développé dans l'application. Chaque correspondance s'appuie sur un champ
> **réel** de Nexora, relevé dans `apps/nexora/source/index.html.part-*`. Les points à trancher sont
> regroupés en fin de document.

## Principe directeur

Le Rucher est une **lecture** des données Nexora, pas un nouveau système de suivi.

- Le miel, le nectar et les abeilles **montrent** l'état des tâches. Ils ne créent aucun statut métier.
- Marcher, approcher une fleur ou « récolter du nectar » **ne modifie jamais** une tâche.
- Pour changer une tâche, on ouvre sa fiche Nexora (`openEditTask`, la modale habituelle) et on
  l'enregistre par le chemin existant (`saveTask`). Le jeu ne contient aucun bouton qui écrit.
- Aucun lien n'est inventé. Un chemin, un pont ou un vol d'abeille ne relie deux éléments que si
  les données portent ce lien.

## 1. Projet → territoire et ruche

| Champ Nexora | Dans le monde | Valeur manquante |
|---|---|---|
| `id` | Graine de la carte : emplacement, biome (prairie, lavande, verger, bruyère, tournesol, forêt), relief | — |
| `name` | Étiquette au-dessus de la ruche | « Projet sans nom » |
| `color` | Toit et fanion de la ruche, légère teinte du sol du territoire | Ocre neutre |
| `icon` | Pictogramme de l'étiquette et du panneau de détail | Aucun pictogramme |
| `priority` (`low`, `normal`, `high`) | `high` : ruche sur un socle surélevé ; son étiquette passe avant les autres en cas de chevauchement | Traité comme `normal` |
| `folderId` + `projectFolders.parentId` | Les projets d'un même dossier sont **voisins** et reliés par un chemin de terre. Deux dossiers différents sont séparés par de l'eau peu profonde, que l'apiculteur peut traverser à gué. | Dossier « À trier » (`folder-a-trier`) : pas de chemin, car ce n'est pas un lien |

Un territoire est un hexagone de 37 tuiles : la ruche au centre, les tâches autour. Au-delà de
36 tâches, plusieurs tâches partagent une tuile et forment un **bosquet** avec un compteur « +N ».

**Réserve de la ruche.** La ruche compte une hausse (étage) par tranche de 25 % de tâches
terminées, de 1 à 4 hausses. Le panneau de la ruche affiche les nombres exacts, par exemple
« Miel 12 / 30 · Nectar 14 · En cours 4 ».

## 2. Tâche → point d'intérêt

### Statut : ce que produit la tâche

Les statuts sont dynamiques (Réglages › Statuts, éventuellement propres à un projet). Chaque
statut est donc rangé dans une **famille** d'après son nom, avec les mêmes règles que le reste de
Nexora (`isTaskDoneGlobal`, statuts protégés `/termin/` et `/en\s*cours/`).

| Famille | Règle, testée dans cet ordre | Statut par défaut | Objet sur la carte |
|---|---|---|---|
| Terminé | nom contenant `termin` | Terminé (`s5`) | **Pot de miel** doré. Il compte dans la réserve de la ruche. |
| Information | type Information (`restrictedStatusId`) ou nom `information` | Information (`s6`) | **Panneau en bois**. Ni nectar ni miel : c'est une note. |
| En cours | nom contenant `en cours` | En cours (`s3`) | **Ruchette en paille** entourée d'abeilles animées |
| En attente | nom contenant `attente` | Attente tiers (`s2`) | **Fleur en bouton**, fermée, sans abeille |
| À faire | tout autre statut, y compris les statuts personnalisés | À planifier (`s1`) | **Fleur ouverte** : nectar disponible |

La **couleur réelle du statut** apparaît toujours sur la pastille de l'étiquette et dans le
panneau. Une personne qui a créé ses propres statuts les retrouve donc tels quels, même si le
monde les range dans une famille.

**Avancement.** `progress` (0 à 100) règle le remplissage d'un rayon de cire dessiné dans le
panneau de détail. Sur la carte, il fixe le nombre d'abeilles d'une ruchette : 1 abeille
jusqu'à 33 %, 2 jusqu'à 66 %, 3 au-delà.

### Type : la forme de l'objet

| Donnée | Indice |
|---|---|
| `milestone: true` (jalon) | **Borne en pierre** dressée à côté de l'objet, et losange dans l'étiquette, comme dans le Gantt |
| Type « Réunions » (`isMeetingTask`) | **Petit kiosque** à côté de l'objet |
| Type « Planning » | **Piquet de jardin** gradué |
| Type « Tâches » | Parterre simple |
| Type « Information » | Panneau (voir la famille Information) |
| Type personnalisé | Socle coloré à la couleur du type ; son icône dans l'étiquette |
| `taskTypeId` absent ou inconnu | Parterre simple, sans socle |

### Criticité, qui tient lieu de priorité

Les tâches n'ont pas de champ « priorité ». Nexora utilise `criticality` (`bas`, `moyen`,
`urgent`, ou vide).

| `criticality` | Indice |
|---|---|
| `urgent` | Fanion rouge (`#DC2626`) et tige haute : la fleur se voit de loin |
| `moyen` | Fanion orange (`#D97706`) |
| `bas` | Tige basse, sans fanion |
| vide | Tige standard, sans fanion. Si le **nom du statut** contient « urgent », le fanion rouge s'applique, comme `isTaskUrgent`. |

Les couleurs sont celles de `CRITICALITIES`. Pour ne pas dépendre de la seule couleur, la
criticité est aussi écrite dans l'étiquette et le panneau.

### Dates

| Situation (`start`, `end`, fuseau Europe/Paris) | Indice |
|---|---|
| En retard (`isTaskLate` : `end` passée et tâche non terminée) | Anneau rouge au sol, pétales fanés, mention « En retard de N j » |
| Échéance dans les 7 prochains jours | Anneau ambre |
| `start` future, tâche pas encore commencée | **Jeune pousse** : fleur plus petite, pas encore butinable |
| Horaires `startTime` / `endTime` | Dans le panneau uniquement |
| Date manquante | Aucun anneau ; le panneau indique « Sans échéance » |

### Autres champs, affichés sans effet sur le décor

| Champ | Usage |
|---|---|
| `assignee` | Panneau, et filtre « Personne » |
| `checklist[]` | Panneau : « 3 / 5 sous-tâches ». Pas d'objets supplémentaires sur la carte. |
| `desc` | Panneau, tronqué à 280 caractères |
| `recurrence` | Petite icône de boucle dans l'étiquette |
| `attachments` | Nombre affiché dans le panneau |

## 3. Liens entre éléments : seulement ceux qui existent

| Donnée | Représentation |
|---|---|
| Même dossier (`folderId`) | Territoires voisins et chemin de terre. L'arbre couvrant le plus court évite les chemins redondants. |
| `dependsOn[]` (prédécesseurs) | **Vol d'abeille** en pointillés entre les deux objets, affiché seulement pour la tâche sélectionnée ou survolée, afin de ne pas surcharger la carte. Si le lien franchit deux projets, l'arc va d'un territoire à l'autre et le panneau nomme le projet. |
| `secondaryProjectId` | La tâche reste dans son territoire principal. Un second fanion prend la couleur du projet partenaire ; à la sélection, un arc mène à la ruche partenaire. |
| Aucun lien | Pas de chemin. Deux territoires voisins de dossiers différents ne sont que voisins de carte. La légende le précise. |

## 4. Ce qui reste hors du monde

- Les tâches archivées ou supprimées (tableau `taskArchive`) n'apparaissent pas.
- Les tâches **terminées depuis plus de 30 jours** (`completedAt`) sont absorbées dans la ruche :
  elles restent comptées dans le miel, mais ne sont plus dessinées. Sinon, les pots de miel
  étoufferaient les tâches vivantes. Un filtre « Afficher tout l'historique » les ramène.
- Une tâche sans projet, ou dont le projet a disparu, est posée dans une **Clairière des tâches
  sans projet**, un territoire spécial signalé comme tel.
- Les filtres de méta-vue de Nexora (`metaFilteredTasks`) s'appliquent : le Rucher montre le
  même périmètre que les autres vues.

## 5. Mécanique de jeu, sans effet sur les données

| Geste | Effet | Écrit dans Nexora ? |
|---|---|---|
| Marcher (clavier, manette tactile, toucher une tuile) | L'apiculteur se déplace ; la caméra suit | Non |
| Approcher une fleur ouverte | +1 **nectar récolté** et un léger son d'abeille (désactivable) | Non. Le compteur ne vit que pendant la session. |
| Approcher une tâche | Son étiquette et un aperçu apparaissent | Non |
| Entrée, ou toucher « Lire » | Panneau de détail avec les champs réels | Non |
| « Ouvrir la fiche » | Ouvre la modale Nexora habituelle | Seulement si l'utilisateur modifie puis enregistre la fiche |
| Visiter une ruche | Le territoire est coché dans le **carnet d'exploration** (session) | Non |

Aucun score ne récompense le fait de terminer une tâche. Un compteur qui pousserait à cocher
« Terminé » pour faire du miel fausserait les données. Le miel reflète ce qui est fait, il ne le
réclame pas.

## 6. Grands volumes

| Zoom | Ce qui est dessiné |
|---|---|
| Proche | Tous les objets, les étiquettes des tâches proches de l'apiculteur, les abeilles |
| Moyen | Objets sans étiquette de tâche ; étiquettes des projets seules |
| Éloigné (vue d'ensemble) | Un résumé par territoire (« 12 à faire · 3 en cours · 20 ✓ ») ; décor allégé |

- Nombre d'abeilles animées plafonné : 0, 90 ou 240 selon la qualité (basse, moyenne, haute).
- La qualité est choisie automatiquement selon le nombre de tâches, et modifiable à la main.
- Les étiquettes ne se chevauchent jamais : la plus prioritaire est placée d'abord, les autres
  sont masquées.
- Sans WebGL, la vue affiche un message et une **liste des territoires** cliquable, avec les
  mêmes informations et les mêmes liens vers les fiches.

## 7. Stabilité de la carte

- Mêmes données, même carte : placement par hachage des identifiants, sans aléa.
- Les projets sont posés par ordre de création. Un nouveau projet ne déplace donc aucun
  territoire existant (vérifié sur maquette : 0 territoire déplacé).
- Les emplacements de la dernière visite sont mémorisés sur l'appareil. Supprimer un projet
  libère sa place sans décaler ses voisins (vérifié : 0 déplacé).
- Une tâche garde sa tuile. Elle ne bouge que si un nouveau chemin de dossier passe exactement
  sur cette tuile (2 tâches sur 80 dans l'essai).

## Points à trancher

1. **Familles de statuts.** Le classement par nom (`termin`, `en cours`, `attente`, `information`,
   sinon « à faire ») te convient-il ? As-tu d'autres statuts à ranger explicitement ?
2. **Chemins limités aux dossiers**, sans chemin pour « À trier » : d'accord ? Faut-il en tracer
   aussi pour les liens `dependsOn` permanents, au lieu des vols d'abeille affichés à la sélection ?
3. **Terminées depuis plus de 30 jours absorbées dans la ruche** : bon seuil ?
4. **Nectar limité à la session**, ou mémorisé sur l'appareil pour garder un carnet d'une visite à
   l'autre ? Il ne serait jamais synchronisé dans Nexora.
5. **Son** : activé par défaut ou non ?
