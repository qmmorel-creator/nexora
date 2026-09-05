# Nexora MCP

Serveur MCP Streamable HTTP avec trois outils : list_projects, create_task, get_task. `create_task` accepte les liens de fichiers et dossiers Google Drive validés. Authentification OAuth authorization-code avec PKCE S256, connexion initiale via Firebase, jetons opaques hachés dans Firestore, accès 1 heure, refresh 30 jours avec rotation transactionnelle.

Hébergement dédié créé : nexora-chatgpt-mcp, site Netlify 2c0b2293-8b71-471b-8288-21f641256aa2.

## Configuration

Variables serveur requises : MCP_PUBLIC_ORIGIN, FIREBASE_WEB_API_KEY (configuration client publique), MCP_CLIENT_SIGNING_KEY, NEXORA_ASSISTANT_API_KEY, NEXORA_USER_UID, FIREBASE_SERVICE_ACCOUNT_JSON. Ne jamais committer les valeurs. Les collections nexora_mcp_codes/access/refresh doivent rester interdites aux clients Firestore ; règles existantes vérifiées : aucune règle client ne donne accès à ces collections (uniquement users/{uid}/kv_store et ancienne kv_store en lecture). Configurer un TTL sur expiresAt pour nettoyer les entrées expirées.

## Vérification

`npm ci --ignore-scripts` puis `node tests/protocol.mjs`. Le test oauth-live.mjs attend sur stdin un objet des variables de configuration : ne pas les écrire dans un fichier partagé. Il ne teste pas la connexion interactive utilisateur.

## Rattachement ChatGPT

Après publication vérifiée, ajouter dans ChatGPT un connecteur MCP vers https://nexora-chatgpt-mcp.netlify.app/mcp, authentification OAuth, puis effectuer la connexion initiale Nexora. La connexion doit être réalisée dans l’interface ChatGPT ; ce code ne rattache pas automatiquement une application au compte. Vérifier ensuite depuis une nouvelle conversation la création et relecture d’une tâche.

## Limites

Première connexion par e-mail/mot de passe Firebase ; connexion par fournisseur social/MFA non implémentée. L’API publique Firebase est celle déjà publiée par Nexora, sans secret. Ne pas annoncer une compatibilité MFA ou connexion Google si non testée. Pas de token dans l’URL, pas de secret dans les résultats MCP. La révocation d’un refresh empêche son renouvellement ; les access tokens associés expirent au plus tard une heure après émission.

Le service ne donne accès qu’au propriétaire NEXORA_USER_UID. Il dépend de l’API Nexora existante. Les opérations financières, suppression et archivage ne sont pas exposées.

## Recette du 5 septembre 2026

Contrôles locaux de protocole réussis. Test réel OAuth sur Firestore réussi : PKCE, usage unique du code, initialisation MCP, liste des trois outils, lecture des projets Nexora, rotation de refresh et refus du rejeu. Documents de test supprimés. Règles Firestore lues et vérifiées ; accès anonyme aux collections OAuth refusé (403). Connexion utilisateur et rattachement ChatGPT non testés à ce stade.

La configuration Netlify a été relue après enregistrement. Les secrets restent dans les variables Netlify et ne sont pas inclus dans cette archive. L’option de masquage is_secret du connecteur n’a pas permis l’enregistrement ; les variables sont stockées comme variables d’environnement Netlify standard, accessibles aux administrateurs du projet. Aucun code client ne publie ces secrets ; seule FIREBASE_WEB_API_KEY est volontairement publique pour Firebase Authentication.

Publication confirmée : déploiement Netlify 6a9c410356bb082cd3d9b3e9. Endpoint https://nexora-chatgpt-mcp.netlify.app/mcp. Création MCP en production, relecture, réessai sans doublon et archivage du test validés. Accès de test supprimé. Le rattachement au compte ChatGPT reste à effectuer dans l’interface du compte.

Recette OAuth distante également réussie après publication : PKCE, code à usage unique, initialisation MCP, liste des outils, lecture Nexora et rotation de refresh avec rejet du rejeu. Tous les documents techniques de recette ont été supprimés.
