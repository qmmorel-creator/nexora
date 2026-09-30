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
3. Développer sur la branche de travail et **y accumuler les commits**, avec
   `npm run install:all && npm run verify` avant chaque push. Pousser sur une branche de
   travail ne déclenche ni CI ni déploiement.
4. Livrer par **pull request vers `main`**, fusionnée quand son `verdict` est terminé et
   vert (une fusion dans `main` ne publie rien), puis mettre le lot en préproduction (`outils/publier preproduction`). Ces étapes ne
   publient rien en production et ne demandent pas de nouvelle autorisation. Commenter chaque
   issue concernée avec l'environnement, l'URL et le SHA testés, puis passer en
   `statut:à-tester`.
5. La **production** ne se publie que par `outils/publier production`, après un feu vert
   explicite de Quentin portant sur la version, le SHA et les composants (voir
   « Déploiement : validation explicite » et [`docs/PUBLICATION.md`](../docs/PUBLICATION.md)).
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
- ne jamais publier la production autrement que par `outils/publier production` après feu
  vert, ni rétablir les builds Git Netlify hors d'une restauration explicitement demandée ;
- ne jamais committer de secret (compte de service Firebase, `NEXORA_ASSISTANT_API_KEY`,
  token Todoist personnel, clés Supabase) — les variables restent dans Netlify ;
- ne pas changer les URL publiques, les identifiants de projets Netlify/Firebase ni les
  contrats consommés par le MCP, Todoist et les automatisations ChatGPT sans issue dédiée ;
  l'inventaire figé est dans [`../docs/MIGRATION_GITHUB.md`](../docs/MIGRATION_GITHUB.md) et
  [`../docs/AUTOMATIONS_BASELINE.md`](../docs/AUTOMATIONS_BASELINE.md).

## Déploiement : validation explicite

**Les publications de production Netlify sont facturées ; elles sont volontaires, tracées et
réversibles.** Référence complète : [`docs/PUBLICATION.md`](../docs/PUBLICATION.md).

| Projet Netlify | Composant | Base directory |
|---|---|---|
| `nexora-project` | `application` | `apps/nexora` |
| `nexora-chatgpt-mcp` | `mcp` | `apps/nexora-mcp` |

Depuis l'issue #544, **une fusion dans `main` ne publie plus rien** : la commande `ignore`
versionnée saute tout build Git de production (`scripts/netlify-ignore.mjs`) et les builds Git
sont arrêtés dans Netlify. Une PR de développement vers `main` n'est donc **pas** une
demande de publication.

### Ce qui coûte, et ce qui ne coûte rien

Le compte est sur un forfait Netlify **à crédits** (vérifié le 29/09/2026) : chaque
**publication de production réussie** coûte (15 crédits), ainsi que le trafic et le calcul des
fonctions. Source : [How credits work](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/)
et [netlify.com/pricing](https://www.netlify.com/pricing/), consultés le 29/09/2026.

| Action | Effet Netlify | Crédits |
|---|---|---|
| Commit et push sur la branche de travail | aucun (et plus de CI) | 0 |
| PR vers `main`, fusion dans `main` | aucun | 0 |
| `outils/publier preproduction` | brouillon non publié, alias `preprod` | aucun crédit de publication annoncé ; trafic compté |
| `outils/publier production` (après feu vert) | une publication **par composant modifié** | 15 par site publié |
| `outils/publier retour` | republication d'un Deploy ID existant | selon Netlify, sans construction |
| Visites, appels d'API, rapports planifiés | trafic et calcul des fonctions | selon l'usage |

GitHub Actions ne coûte rien sur ce dépôt public (runners standard `ubuntu-latest`).

### La règle

1. L'assistant accumule le travail en commits sur sa branche, livre par PR vers `main`
   après `verdict` vert, et met le lot en préproduction : tout cela sans nouvelle autorisation.
2. Il **ne publie pas la production** de sa propre initiative. Il présente en un seul message
   la version, le SHA définitif, le changelog, les composants, la recette et le retour arrière,
   et **demande le feu vert**.
3. Le feu vert vaut pour **ce candidat-là** (version, SHA, contenu, composants). S'il change,
   nouvelle préproduction et nouvel accord.
4. Viser une version officielle par semaine environ : un lot de cinq correctifs coûte autant
   qu'un seul.
5. Exception, et elle seule : une régression avérée qui casse la production autorise le
   **retour** au dernier déploiement connu et compatible (`outils/publier retour`), puis
   information de Quentin.

### Vérification continue

`Nexora CI` tourne sur les pull requests, sur `main` et à la demande ; son statut
final `verdict` est exigé par l'outil sur le SHA exact publié. `npm run install:all && npm run
verify` reste obligatoire avant chaque push. Le banc visuel (`tools/visual-check`) ne tourne
ni dans la CI ni sur Netlify ; il suit la matrice de
[`tools/visual-check/README.md`](../tools/visual-check/README.md#ne-lancer-que-ce-qui-est-concerné) :

- quand l'interface bouge, avant de pousser : `npm run visual:affected` ;
- la campagne complète `npm run visual:check` se passe **une fois, sur le lot stabilisé qui sera
  livré**, quand le sélecteur la réclame.

Une suite visuelle non exécutée est annoncée comme telle, jamais comme réussie.

### En cas de problème de production

`outils/publier retour --version <précédente>` republie les Deploy IDs connus du registre, sans
reconstruction. Un retour Netlify ne restaure ni Firebase, ni les fonctions Todoist, ni les
jetons MCP.

## Suivi visuel

En plus du tableau Projects, un board en lecture seule (Kanban par statut, filtrable par
zone) peut être publié en artefact Claude : il se synchronise sur demande
(« resynchronise le roadmap ») à partir des issues GitHub, pas en continu. Il comporte une
section **« Versions en ligne »** lue depuis `publication/registre.json` (version, commit,
Deploy ID, date par site) et la préproduction depuis l'historique Netlify
(`outils/publier etat`), jamais d'une copie tenue à la main.

## Pourquoi GitHub plutôt qu'un outil propriétaire

Les demandes doivent rester lisibles et modifiables par n'importe quel assistant IA,
pas seulement celui qui les a créées. Des issues + labels + un board Projects, ce sont
des fichiers et des données ouvertes, consultables par navigateur, par API, ou en ligne
de commande (`gh`) — aucune dépendance à une fonctionnalité propre à un seul outil.
