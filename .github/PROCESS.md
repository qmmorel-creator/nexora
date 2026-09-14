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

- Tableau : **https://github.com/users/qmmorel-creator/projects/1** — le dépôt `nexora`
  doit être ajouté aux sources de ce board (ou un board dédié créé, auquel cas remplacer
  l'URL ci-dessus). C'est la seule étape qui ne peut pas être versionnée dans le dépôt.
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

## Convention pour l'assistant (Claude ou ChatGPT)

1. Avant de commencer un batch de travail, lire les issues ouvertes labellisées
   `statut:backlog` pour la ou les zones concernées.
2. Passer le label en `statut:en-cours` au démarrage du travail sur une issue.
3. Développer sur une branche, ouvrir une pull request et attendre que `Nexora CI` passe au
   vert. Après fusion dans `main`, Netlify redéploie automatiquement les deux sites depuis
   Git (voir « Déploiement automatique » ci-dessous). Commenter l'issue avec un résumé de ce
   qui a été fait, puis passer en `statut:à-tester`.
4. Ne fermer une issue et passer en `statut:fait` qu'après validation explicite de Quentin
   dans un commentaire.
5. Un commit qui répond à une issue doit le mentionner dans son message
   (`Fixes #12`, `Ref #12`) pour garder le lien visible dans l'historique.
6. Toujours repartir du dernier état de `main` avant de coder, pour éviter d'écraser le
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

## Déploiement automatique

Les deux sites Netlify sont reliés à ce dépôt et se redéploient à chaque publication sur
`main` :

| Projet Netlify | Branche | Base directory |
|---|---|---|
| `nexora-project` | `main` | `apps/nexora` |
| `nexora-chatgpt-mcp` | `main` | `apps/nexora-mcp` |

Livrer une demande = fusionner dans `main` après CI verte. Aucun déclenchement manuel n'est
nécessaire ; en cas d'échec, republier le dernier Deploy ID fonctionnel du projet concerné.

## Suivi visuel

En plus du tableau Projects, un board en lecture seule (Kanban par statut, filtrable par
zone) peut être publié en artefact Claude : il se synchronise sur demande
(« resynchronise le roadmap ») à partir des issues GitHub, pas en continu.

## Pourquoi GitHub plutôt qu'un outil propriétaire

Les demandes doivent rester lisibles et modifiables par n'importe quel assistant IA,
pas seulement celui qui les a créées. Des issues + labels + un board Projects, ce sont
des fichiers et des données ouvertes, consultables par navigateur, par API, ou en ligne
de commande (`gh`) — aucune dépendance à une fonctionnalité propre à un seul outil.
