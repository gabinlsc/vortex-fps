# Vortex foundation

Base d'ingénierie d'un movement FPS navigateur : Three.js, TypeScript, Vite, Rapier WASM partagé,
serveur Node.js autoritaire 128 Hz, snapshots FlatBuffers 32 Hz et inputs binaires de 12 octets.
La cible est 16 joueurs par match. Ce dépôt est une fondation vérifiable, pas une certification e-sport.

## Démarrage local

Node.js 24 est conseillé. Dans deux terminaux, depuis ce dossier :

```sh
npm install
npm run prisma:generate
npm test
npm run test:integration
npm run typecheck
npm run server:dev
```

Dans le second terminal :

```sh
npm run dev
```

Ouvrir http://localhost:5173 et cliquer sur « Entrer dans l'arène ». Le ticket reste vide en développement.
Ouvrir un second onglet pour tester l'interpolation et la validation serveur. ZQSD ou WASD, Espace,
Shift, clic gauche, 1/2. Échap libère la souris. Après déconnexion, recharger la page.

`server:dev` lie exclusivement 127.0.0.1. Le serveur standard refuse de démarrer sans `TICKET_SECRET`.
Le client en HTTPS exige un endpoint `wss://` via `VITE_GAME_URL`. Le Dockerfile et les manifests
ne terminent pas TLS : un ingress régional dédié doit router le ticket vers le serveur alloué.

```sh
npm run build
docker build -f infra/Dockerfile -t vortex:v1 .
```

## Contenu

| Emplacement | Contrat |
| --- | --- |
| `shared/input.ts` | ABI fixe, quantification, validation, lots, séquences avec wrap |
| `shared/movement.ts` | Air strafing, friction, saut, bonus cadencé, slide |
| `shared/physics.ts` | Capsule Rapier, sweep, plafond, stance, normales de collision |
| `shared/snapshot.fbs` et `.ts` | Snapshots FlatBuffers, ACK et état complet du mouvement |
| `shared/gunplay.ts` | Recul déterministe et intégration de projectiles |
| `client/netcode.ts` | Prédiction, restauration/rejeu, interpolation et correction visuelle |
| `client/main.ts` | Arène Three.js et boucle à pas fixe |
| `client/visuals.ts` | Décor procédural, avatars et arme en vue subjective |
| `server/main.ts` | Autorité, cadences, queues bornées, hitscan, projectiles, admission |
| `server/lag-compensation.ts` | Historique immutable, intersections analytiques, rewind plafonné |
| `server/tickets.ts` | Tickets HMAC de 30 s avec portée match et protection de rejeu serveur |
| `api/` | NestJS/OIDC, Prisma/PostgreSQL, queue, calcul Elo, sélection et allocation |
| `infra/` | Image Node/WASM, Fleet, réserve Ready et allocation Agones |
| `ARCHITECTURE.md` | Les cinq piliers, budgets, mathématiques et conditions de passage en production |
| `VALIDATION.md` | Vérifications réellement exécutées et limites de validation |

## Périmètre de la démo

Déplacements et impacts sont autoritaires. L'arène utilise des boîtes statiques ; les joueurs ne
se bloquent pas entre eux. Les projectiles ont une collision par segment et un dommage direct.
Le client affiche les avatars adverses, la santé et les impacts confirmés. Le décor sci-fi,
le panorama animé du menu et les armes procédurales ne nécessitent aucun modèle externe.
Le recul et la flamme de bouche sont cosmétiques, prédits localement : ils ne confirment pas un tir.
Les tracers et la réplication visuelle des projectiles restent à intégrer.

L'API offre une queue persistante authentifiée. Le worker qui constitue les groupes, détient les
leases, alloue, émet les tickets et publie les résultats est spécifié dans `ARCHITECTURE.md` ; il
n'est pas un service opérationnel livré ici. Aucun compte, abonnement ou portefeuille client
ne peut modifier les dommages, les munitions ou le MMR du serveur de jeu.

## Dépendances et reproductibilité

Les versions directes sont figées. Le registre npm étant inaccessible dans l'environnement de
livraison, aucun lockfile artificiel n'a été fabriqué. Après installation, revoir puis versionner
`package-lock.json`, utiliser `npm ci`, figer le digest de l'image et lancer l'analyse CVE/SBOM.
Le Dockerfile fourni utilise provisoirement `npm install` et ne constitue donc pas encore un build
reproductible de production. L'intégration 3D et la compilation doivent être exécutées avant déploiement.

## API locale

Configurer `DATABASE_URL`, `OIDC_JWKS_URL`, `OIDC_ISSUER` et `OIDC_AUDIENCE`, puis :

```sh
npx prisma migrate dev --schema api/schema.prisma --name initial
npm run api
```

La configuration OIDC est obligatoire. Les endpoints `POST /v1/queue` et `GET /v1/queue` exigent
un JWT vérifié. Les migrations de production passent par `prisma migrate deploy`, après création
et revue de la migration. Le service est lié à 127.0.0.1, derrière son proxy HTTPS.

## Validation

Les tests autonomes couvrent la sérialisation, les accélérations, les intersections, le rewind,
les tickets, la réconciliation et la sélection régionale. Les tests d'intégration Rapier et
FlatBuffers nécessitent les dépendances npm. Les budgets 144 FPS / 128 Hz doivent être mesurés
sur des machines et réseaux représentatifs, avec pertes, jitter, backpressure et charge.
