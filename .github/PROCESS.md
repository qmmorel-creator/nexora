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
   vert. **La fusion publie la production** (builds Git Netlify, depuis #553) : vérifier
   ensuite la production, commenter chaque issue concernée avec l'URL, le SHA et le Deploy ID,
   puis passer en `statut:à-tester`.
5. Pas de préproduction ni de feu vert par version : la PR fusionnée est la publication.
   Retour arrière décrit dans [`docs/PUBLICATION.md`](../docs/PUBLICATION.md).
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
- ne fusionner dans `main` (donc publier) qu'une PR dont le `verdict` est vert ; jamais de
  push direct sur `main` ;
- ne jamais committer de secret (compte de service Firebase, `NEXORA_ASSISTANT_API_KEY`,
  token Todoist personnel, clés Supabase) — les variables restent dans Netlify ;
- ne pas changer les URL publiques, les identifiants de projets Netlify/Firebase ni les
  contrats consommés par le MCP, Todoist et les automatisations ChatGPT sans issue dédiée ;
  l'inventaire figé est dans [`../docs/MIGRATION_GITHUB.md`](../docs/MIGRATION_GITHUB.md) et
  [`../docs/AUTOMATIONS_BASELINE.md`](../docs/AUTOMATIONS_BASELINE.md).

## Déploiement : publication systématique

**Depuis #553 (30/09/2026), chaque fusion dans `main` publie la production** par les builds
Git Netlify. Référence complète : [`docs/PUBLICATION.md`](../docs/PUBLICATION.md).

| Projet Netlify | Composant | Base directory | Reconstruit quand |
|---|---|---|---|
| `nexora-project` | `application` | `apps/nexora` | `apps/nexora`, `config/environnements.mjs` ou `publication/version.json` change |
| `nexora-chatgpt-mcp` | `mcp` | `apps/nexora-mcp` | `apps/nexora-mcp`, `config/environnements.mjs` ou `publication/version.json` change |

Chaque publication de production coûte 15 crédits Netlify par site reconstruit (forfait à
crédits, relevé du 29/09/2026) : regrouper les petites modifications dans une même PR plutôt
que d'en fusionner plusieurs à la suite. GitHub Actions ne coûte rien (dépôt public).

`Nexora CI` tourne sur les pull requests, sur `main` et à la demande ; son statut `verdict`
doit être vert avant fusion. Le banc visuel (`tools/visual-check`) reste local :
`npm run visual:affected` quand l'interface bouge ; une suite non exécutée est annoncée comme
telle, jamais comme réussie.

En cas de problème de production : republier le déploiement précédent dans Netlify
(*Deploys* → *Publish deploy*), puis corriger par PR. Arrêt d'urgence de toute publication :
variable Netlify `NEXORA_BUILDS_GIT_PRODUCTION=arret`.

## Suivi visuel

En plus du tableau Projects, un board en lecture seule (Kanban par statut, filtrable par
zone) peut être publié en artefact Claude : il se synchronise sur demande
(« resynchronise le roadmap ») à partir des issues GitHub, pas en continu. Il comporte une
section **« Versions en ligne »** lue depuis l'API Netlify (`outils/publier etat`), jamais
d'une copie tenue à la main.

## Pourquoi GitHub plutôt qu'un outil propriétaire

Les demandes doivent rester lisibles et modifiables par n'importe quel assistant IA,
pas seulement celui qui les a créées. Des issues + labels + un board Projects, ce sont
des fichiers et des données ouvertes, consultables par navigateur, par API, ou en ligne
de commande (`gh`) — aucune dépendance à une fonctionnalité propre à un seul outil.
