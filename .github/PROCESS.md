# Suivi des demandes — Nexora

Ce dépôt centralise toutes les demandes d'amélioration et de nouvelles fonctionnalités
pour Nexora et son connecteur MCP, qu'elles soient traitées avec Claude ou avec ChatGPT.
Les règles sont identiques à celles d'OS360 : une demande = une issue, un label de statut,
aucune fermeture sans validation explicite.

## Déposer une demande

- **Nouvelle issue** → utiliser le modèle "Demande d'amélioration / nouvelle fonctionnalité"
  (champs guidés : zone, contexte, comportement attendu, captures d'écran, priorité).
- Plusieurs demandes en une fois : une issue par demande, même si elles sont créées dans
  la foulée (« un batch »).
- Les captures d'écran se glissent-déposent directement dans le corps de l'issue.

## Suivre l'avancement

- Tableau : **https://github.com/users/qmmorel-creator/projects/2** — board dédié à
  Nexora, distinct de celui d'OS360 : là-bas `zone:nexora` désigne l'intégration Nexora
  *dans* OS360, ce qui n'a pas le même sens que les `zone:*` de ce dépôt.
- Chaque issue porte un label `statut:*` :
  - `statut:backlog` — collectée, pas encore commencée
  - `statut:en-cours` — en cours de développement
  - `statut:à-tester` — déployé, en attente de validation par Quentin
  - `statut:fait` — validé et terminé
- Un label `zone:*` indique le module concerné :

| Zone du formulaire | Label | Périmètre |
|---|---|---|
| Interface Nexora | `zone:interface` | `apps/nexora/source/index.html.part-*` |
| Tâches & projets | `zone:taches` | tâches, projets, statuts, archivage |
| Rapports & briefs | `zone:rapports` | `nexora-reports`, rapports matin/soir planifiés |
| MCP ChatGPT | `zone:mcp` | `apps/nexora-mcp` (OAuth, outils MCP) |
| Intégrations (Todoist, Google) | `zone:integrations` | Todoist, Google Calendar, Drive, Gmail |
| Finance | `zone:finance` | `finance-catalogs`, `finance-transactions` |
| API & automatisations | `zone:api` | fonctions Netlify `nexora-*`, OpenAPI, routines ChatGPT |
| Déploiement / CI | `zone:deploiement` | `Nexora CI`, Netlify, build monofichier |
| Design / esthétique | `zone:design` | mise en page, couleurs, ergonomie |
| Autre | `zone:autre` | hors des zones ci-dessus |

Les labels sont versionnés dans [`labels.json`](labels.json) et créés/mis à jour
automatiquement par le workflow `Synchronisation des labels` à chaque push sur `main` qui
touche ce fichier (ou manuellement via *Run workflow*). Le workflow ne supprime jamais un
label : ajouter une zone = ajouter une entrée dans `labels.json` et une option dans
`.github/ISSUE_TEMPLATE/demande.yml`.

## Configuration du board

Le board n'est pas versionnable dans le dépôt ; sa configuration attendue est donc
consignée ici, pour être rétablie à l'identique si elle se perd :

- le dépôt `nexora` est relié au board (onglet *Projects* du dépôt → *Link a project*) ;
- le workflow *Auto-add to project* du board y ajoute les nouvelles issues, avec le
  filtre `repo:qmmorel-creator/nexora is:issue is:open` ;
- les colonnes suivent les labels `statut:*`, qui restent la source de vérité : rien ne
  synchronise automatiquement un label vers le champ *Status* de GitHub, faute d'un jeton
  à portée `project` — déplacer une carte ne remplace donc jamais le changement de label.

## Convention pour l'assistant (Claude ou ChatGPT)

1. Avant de commencer un batch de travail, lire les issues ouvertes labellisées
   `statut:backlog` pour la ou les zones concernées.
2. Passer le label en `statut:en-cours` au démarrage du travail sur une issue.
3. Développer sur la branche de travail et **y accumuler les commits**. Pousser sur cette
   branche ne déclenche aucun déploiement : c'est gratuit, et c'est là que le travail attend.
4. **Ne jamais ouvrir de pull request ni fusionner sans le feu vert explicite de Quentin**
   (voir « Déploiement : validation explicite » ci-dessous). Quand plusieurs correctifs sont
   prêts, les annoncer et demander l'autorisation de publier le lot.
5. Une fois le feu vert donné : **une seule** pull request pour tout le lot, `Nexora CI`
   verte, **une seule** fusion. Commenter chaque issue concernée avec un résumé, puis passer
   en `statut:à-tester`.
6. Ne fermer une issue et passer en `statut:fait` qu'après validation explicite de Quentin
   dans un commentaire.
7. Un commit qui répond à une issue doit le mentionner dans son message
   (`Ref #12`) pour garder le lien visible dans l'historique.
   **Ne jamais utiliser de mot-clé de fermeture** (`Closes #12`, `Fixes #12`, `Resolves #12`)
   dans un message de commit ni dans une description de pull request : GitHub fermerait
   l'issue à la fusion, alors que la fermeture appartient à Quentin après validation (point 6).
   Une issue fermée mais encore étiquetée `statut:à-tester` est le symptôme de cette erreur —
   la rouvrir.
8. Toujours repartir du dernier état de `main` avant de coder, pour éviter d'écraser le
   travail d'un autre assistant.

## Garde-fous propres à Nexora

Ces contraintes s'ajoutent aux règles de suivi et priment sur toute demande d'issue :

- exécuter `npm run install:all && npm run verify` avant de pousser ;
- ne jamais committer de secret (compte de service Firebase, `NEXORA_ASSISTANT_API_KEY`,
  token Todoist personnel, clés Supabase) — les variables restent dans Netlify ;
- ne pas changer les URL publiques, les identifiants de projets Netlify/Firebase ni les
  contrats consommés par le MCP, Todoist et les automatisations ChatGPT sans issue dédiée ;
  l'inventaire figé est dans [`../docs/MIGRATION_GITHUB.md`](../docs/MIGRATION_GITHUB.md) et
  [`../docs/AUTOMATIONS_BASELINE.md`](../docs/AUTOMATIONS_BASELINE.md).

## Déploiement : validation explicite

**Les déploiements Netlify sont facturés. Ils ne se déclenchent donc plus au fil de l'eau.**

Les deux sites sont reliés à ce dépôt :

| Projet Netlify | Branche | Base directory |
|---|---|---|
| `nexora-project` | `main` | `apps/nexora` |
| `nexora-chatgpt-mcp` | `main` | `apps/nexora-mcp` |

### Ce qui coûte, et ce qui ne coûte rien

| Action | Construction Netlify |
|---|---|
| Commit et push sur la branche de travail | **aucune** — tant qu'aucune pull request n'est ouverte |
| **Ouvrir une pull request** | une *Deploy Preview* **par site** |
| **Fusionner dans `main`** | une construction de production **par site** |

Le coût est donc porté par l'**ouverture d'une pull request** et par la **fusion**, jamais par
le fait de committer. C'est exactement là que la validation s'impose.

### La règle

1. L'assistant accumule le travail en commits sur la branche, autant de fois qu'il le faut.
2. Il **n'ouvre pas** de pull request et **ne fusionne pas** de sa propre initiative. Il
   annonce ce qui est prêt et **demande le feu vert**.
3. Sur feu vert : **une** pull request pour tout le lot, CI verte, **une** fusion. Un lot de
   cinq correctifs coûte alors autant qu'un seul.
4. Le feu vert vaut pour **ce lot-là**. Il ne se reporte pas au suivant.
5. Exception, et elle seule : une régression qui casse la production en ligne. Là, publier
   tout de suite et le dire — laisser le site cassé coûte plus cher qu'une construction.

### Ce qui remplace la CI au fil de l'eau

Comme `Nexora CI` ne tournait qu'à l'ouverture d'une pull request, elle tourne désormais aussi
**à chaque push sur une branche de travail** : la vérification reste continue, sans qu'aucun
déploiement Netlify ne soit déclenché. `npm run install:all && npm run verify` (plus
`npm run visual:check` quand l'interface bouge) reste obligatoire avant chaque push : c'est ce
qui garantit qu'un lot entier est publiable d'un coup.

### Chaque site ne se construit que s'il est concerné

Les deux sites vivent dans le même dépôt. Sans garde-fou, un correctif d'interface
reconstruisait **aussi** le site MCP, et inversement : deux constructions facturées là où une
seule était utile. Chaque `netlify.toml` porte donc une commande `ignore` qui saute la
construction quand son propre dossier n'a pas changé :

```toml
ignore = "git diff --quiet $CACHED_COMMIT_REF $COMMIT_REF -- ."
```

Netlify l'exécute depuis le *base directory* : « `.` » désigne donc `apps/nexora` ou
`apps/nexora-mcp`. Code de sortie 0 = rien n'a changé, on saute ; non nul = on construit. Au
premier build ou après un vidage de cache, `$CACHED_COMMIT_REF` est vide, la commande échoue,
et la construction a lieu — le repli sûr est bien « construire ».

Vérifié sur des fusions réelles :

| Modification | `nexora-project` | `nexora-chatgpt-mcp` |
|---|---|---|
| Correctif d'interface (`apps/nexora`) | construit | **sauté** |
| Documentation ou CI uniquement | **sauté** | **sauté** |

**Conséquence à connaître** : une fusion qui ne touche ni `apps/nexora` ni `apps/nexora-mcp`
ne déploie plus rien, et c'est voulu. Un site qui « ne se redéploie pas » après une fusion de
documentation n'est pas une panne.

### En cas d'échec de construction

Republier le dernier Deploy ID fonctionnel du projet concerné.

## Suivi visuel

En plus du tableau Projects, un board en lecture seule (Kanban par statut, filtrable par
zone) peut être publié en artefact Claude : il se synchronise sur demande
(« resynchronise le roadmap ») à partir des issues GitHub, pas en continu.

## Pourquoi GitHub plutôt qu'un outil propriétaire

Les demandes doivent rester lisibles et modifiables par n'importe quel assistant IA,
pas seulement celui qui les a créées. Des issues + labels + un board Projects, ce sont
des fichiers et des données ouvertes, consultables par navigateur, par API, ou en ligne
de commande (`gh`) — aucune dépendance à une fonctionnalité propre à un seul outil.
