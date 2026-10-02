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
labels `statut:*` et `zone:*`, board Projects. Le processus complet est décrit dans [.github/PROCESS.md](.github/PROCESS.md).

## Développement, préproduction et versions

```bash
npm run install:all
npm run verify               # socle, obligatoire avant tout push
npm run local                # interface sur http://127.0.0.1:8888, données fictives, bandeau LOCAL
npm run smoke:production     # lecture seule de la production
outils/publier etat          # versions en ligne, préproduction, garde-fous
```

Chaque site sert un `version.json` public. Une fusion dans `main` ne publie rien : la
production se publie par `outils/publier production`, après feu vert explicite. Versions dans
[CHANGELOG.md](CHANGELOG.md), production réellement servie dans
[publication/registre.json](publication/registre.json), guide complet dans
[docs/PUBLICATION.md](docs/PUBLICATION.md).

Les projets Netlify restent reliés à ce dépôt (base `apps/nexora` et `apps/nexora-mcp`) pour
leur configuration, mais leurs builds Git ne publient plus. Les domaines existants sont
conservés ; les variables d'environnement restent dans Netlify et ne sont jamais recopiées dans
GitHub. Historique de la bascule : [MIGRATION_GITHUB.md](docs/MIGRATION_GITHUB.md).
