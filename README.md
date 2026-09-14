# Nexora Platform

Dépôt canonique de Nexora et de son connecteur ChatGPT MCP.

## Applications

- `apps/nexora` : interface Nexora, API d'automatisation et fonctions planifiées ;
- `apps/nexora-mcp` : serveur MCP OAuth utilisé par ChatGPT.

Les deux applications restent déployées sur leurs projets Netlify existants :

- Nexora : `nexora-project` (`https://nexora-project.org`) ;
- MCP : `nexora-chatgpt-mcp` (`https://nexora-chatgpt-mcp.netlify.app`).

Firebase `nexora-cb20d` reste la source de données. Le dépôt ne contient ni données Firebase, ni comptes de service, ni jetons.

L'interface monofichier est versionnée sous `apps/nexora/source/index.html.part-*`. Le build concatène ces fragments texte, dans l'ordre, pour reconstruire exactement `dist/index.html`.

## Suivi des demandes

Les demandes d'amélioration et de correction sont suivies en issues GitHub : modèle guidé,
labels `statut:*` et `zone:*`, board Projects. Le processus complet, identique à celui
d'OS360, est décrit dans [.github/PROCESS.md](.github/PROCESS.md).

## Validation locale

```bash
npm run install:all
npm run verify
npm run smoke:production
```

## Déploiement Git

Chaque projet Netlify doit être relié à ce même dépôt, avec :

| Projet Netlify | Branche | Base directory |
|---|---|---|
| `nexora-project` | `main` | `apps/nexora` |
| `nexora-chatgpt-mcp` | `main` | `apps/nexora-mcp` |

Les domaines existants doivent être conservés. Les variables d'environnement restent configurées dans Netlify et ne sont jamais recopiées dans GitHub.

Consulter [MIGRATION_GITHUB.md](docs/MIGRATION_GITHUB.md) avant la première bascule.
