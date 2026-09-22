# Ingestion prospect QME — contrat, sécurité, recette

Endpoint dédié aux prospects du site [qmmorel-creator/qme-engineering](https://github.com/qmmorel-creator/qme-engineering), distinct du MCP OAuth/PKCE et de la clé assistant générale (`NEXORA_ASSISTANT_API_KEY`). Voir nexora#279 pour l'avis d'architecture complet et qme-engineering#1 pour le brief d'origine.

## 1. Schéma du flux

```
Visiteur du site QME
  → formulaire (index.html, #contact-form)
  → BFF du site QME (netlify/functions/*, dans qme-engineering)
      - honeypot, requestId, désactive le bouton, état de chargement
      - signe la requête (HMAC-SHA256, secret QME_INTAKE_SIGNING_KEY)
  → POST /api/nexora/qme-intake (nexora-project.org, dans nexora)
      - vérifie signature + horodatage (fenêtre 5 min, dérive tolérée 1 min)
      - anti-rejeu (signature consommée une seule fois)
      - limitation de débit (par IP + globale, fenêtre 10 min)
      - honeypot rempli → rejet silencieux (même réponse qu'un succès)
      - validation stricte des champs, échappement Markdown
      - appendTaskIdempotently() — MÊME logique canonique que
        nexora-create-task.ts, aucune écriture Firestore parallèle
  → tâche créée dans le projet Nexora « QME - Formulaire »
```

Le navigateur n'appelle **jamais** directement Nexora — uniquement le BFF du site QME, sur son propre domaine.

## 2. Modèle de menace (résumé)

| Risque | Mitigation |
|---|---|
| Un tiers rejoue une requête interceptée | Horodatage + signature à usage unique (empreinte stockée, `qme_intake_nonces`) |
| Un bot spam le formulaire | Honeypot (rejet silencieux), limitation de débit par IP et globale |
| Le secret du BFF fuite | Secret **dédié** (`QME_INTAKE_SIGNING_KEY`), distinct de la clé assistant générale — une fuite ne compromet que ce canal |
| Injection Markdown/HTML via un champ du formulaire | Tous les champs utilisateur échappés avant insertion dans la description de la tâche |
| Une requête ne vient pas réellement du site QME | Vérification de `sourceUrl` contre `QME_SITE_ORIGIN` (origine exacte attendue) |
| Fuite d'un secret ou de données prospect dans les logs | Aucune journalisation applicative dans la fonction (pas de `console.*`) ; réponse HTTP limitée à `{ok, status|error}` |
| Doublon de tâche sur rejeu réseau côté visiteur | Idempotence par `requestId` (réutilise `appendTaskIdempotently`, transaction Firestore) |

## 3. Contrat JSON

### Requête — `POST https://nexora-project.org/api/nexora/qme-intake`

En-têtes :

| En-tête | Contenu |
|---|---|
| `Content-Type` | `application/json` |
| `X-QME-Timestamp` | horodatage Unix (secondes), au moment de la signature |
| `X-QME-Signature` | `HMAC-SHA256(QME_INTAKE_SIGNING_KEY, "<timestamp>.<corps brut exact>")`, en hexadécimal |

Corps (tous les champs sauf `name`/`need`/`submittedAt` sont obligatoires) :

```json
{
  "requestId": "6a21a1d0-1234-4abc-89ab-1234567890ab",
  "name": "Jean Dupont",
  "email": "jean@exemple.fr",
  "organization": "Ateliers Ferrand",
  "need": "Audit d'un outil existant",
  "message": "Nous cherchons à fiabiliser notre suivi de commandes.",
  "submittedAt": "2026-09-22T14:32:00.000Z",
  "sourceUrl": "https://qme-engineering.netlify.app/#contact",
  "company_website": ""
}
```

`company_website` est le champ honeypot : doit rester vide côté formulaire réel (masqué en CSS, jamais rempli par un visiteur humain).

### Réponses

| Cas | Statut | Corps |
|---|---|---|
| Créée | 201 | `{"ok":true,"status":"created"}` |
| Doublon idempotent (même `requestId`) | 200 | `{"ok":true,"status":"duplicate"}` |
| Honeypot rempli (rejet silencieux) | 200 | `{"ok":true,"status":"received"}` |
| Validation échouée | 400 | `{"ok":false,"error":"<code>"}` |
| Signature absente/invalide/expirée/rejouée | 401 | `{"ok":false,"error":"<code>"}` |
| Limitation de débit atteinte | 429 | `{"ok":false,"error":"rate_limited"}` |
| Configuration serveur incomplète | 503 | `{"ok":false,"error":"configuration_missing","missing":[...]}` |
| Erreur générique | 502 | `{"ok":false,"error":"qme_intake_failed"}` |

Codes d'erreur de validation possibles : `invalid_request_id`, `email_required` / `invalid_email` / `email_too_long`, `organization_required` / `organization_too_long`, `name_too_long`, `need_too_long`, `message_too_long`, `source_url_required` / `invalid_source_url` / `unexpected_source_origin`.

Aucune réponse ne renvoie jamais le contenu du prospect (nom, email, message) ni un détail technique interne.

### Exemple de requête signée (secret factice, jamais le vrai)

```bash
SECRET="secret-de-demo-jamais-le-vrai"
TIMESTAMP=$(date +%s)
BODY='{"requestId":"6a21a1d0-1234-4abc-89ab-1234567890ab","name":"Jean Dupont","email":"jean@exemple.fr","organization":"Ateliers Ferrand","need":"Audit d'\''un outil existant","message":"Test de recette.","sourceUrl":"https://qme-engineering.netlify.app/#contact","company_website":""}'
SIGNATURE=$(printf '%s.%s' "$TIMESTAMP" "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -hex | sed 's/^.* //')

curl -X POST https://nexora-project.org/api/nexora/qme-intake \
  -H "Content-Type: application/json" \
  -H "X-QME-Timestamp: $TIMESTAMP" \
  -H "X-QME-Signature: $SIGNATURE" \
  -d "$BODY"
```

## 4. Tâche créée — modèle exact

- **Projet** : `QME - Formulaire` (`5a0b2231-9419-4e84-913f-1b1a94114fdc`, vérifié en direct via le MCP).
- **Type** : `Tâches` (`tt1`) — **Statut** : `À planifier` (`s1`).
- **Titre** : `` QME - Demande de l'entreprise {Organisation} ``.
- **Dates** début/fin : date civile Europe/Paris du jour de réception.
- **Source** : `qme-website`. **Idempotence** : `requestId`.
- **Description** : gabarit Markdown du brief (Contact / Besoin / Message / Qualification initiale), tous les champs échappés.
- **Checklist** (jamais cochée à la création) : Qualifier le besoin, Vérifier les coordonnées, Préparer le premier contact, Décider.
- Jamais de changement automatique de statut, jamais d'envoi de message au prospect.

## 5. Variables d'environnement

### Côté Nexora (`nexora-project`, Netlify)

| Variable | Type | Rôle |
|---|---|---|
| `QME_INTAKE_SIGNING_KEY` | secret | Clé HMAC, distincte de `NEXORA_ASSISTANT_API_KEY` |
| `QME_SITE_ORIGIN` | publique | Origine exacte attendue du site QME (ex. `https://qme-engineering.netlify.app`) |
| `NEXORA_USER_UID`, `FIREBASE_SERVICE_ACCOUNT_JSON` | secrets | Déjà existants, réutilisés tels quels |

### Côté site QME (`qme-engineering`, Netlify — à créer)

| Variable | Type | Rôle |
|---|---|---|
| `QME_INTAKE_SIGNING_KEY` | secret | **Même valeur** que côté Nexora — jamais commitée, jamais exposée au navigateur |
| `NEXORA_INTAKE_URL` | publique | `https://nexora-project.org/api/nexora/qme-intake` |

Voir `qme-engineering/.env.example` pour le squelette sans valeur réelle.

## 6. Procédure de recette de bout en bout

1. Configurer les deux variables ci-dessus sur les deux sites Netlify (valeurs réelles, jamais commitées).
2. Déployer l'endpoint Nexora (`nexora-qme-intake.ts`) et le BFF du site QME sur leurs Deploy Previews respectifs.
3. Soumettre le formulaire réel du site QME (Deploy Preview) avec des données de test clairement identifiables (ex. organisation « TEST RECETTE — à supprimer »).
4. Vérifier dans Nexora (interface ou MCP `read_resource`/`get_task`) qu'**exactement une** tâche a été créée dans `QME - Formulaire`, avec le titre, la description, la checklist et les dates attendus.
5. Resoumettre le même formulaire une seconde fois avec un rejeu réseau simulé (ou rejouer manuellement le même `requestId`) : vérifier qu'aucune tâche en double n'est créée (réponse `"status":"duplicate"`).
6. Archiver la tâche de test (bouton d'archivage Nexora, ou `archive_task` côté MCP) — **de façon réversible**, pas de suppression définitive.
7. Vérifier qu'aucun secret n'apparaît dans les logs Netlify des deux fonctions.

## 7. Choix restant à valider par Quentin

- Domaine final du site QME (Netlify par défaut ou domaine personnalisé) — impacte la valeur de `QME_SITE_ORIGIN`.
- Rate limiting : le compteur Firestore maison couvre le besoin immédiat ; à revoir si le volume de soumissions devient significatif.
- Écriture MCP pour les ressources `pro*`/prospects — hors périmètre de ce lot.
