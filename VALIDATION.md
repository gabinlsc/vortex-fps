# Validation de la livraison

Vérifications exécutées le 5 octobre 2026 dans Node.js 24.19.0 sous Windows :

- `npm test` : 20 tests passent, 0 échec. Le codec est exercé sur 10 000 angles pseudo-aléatoires.
- Parsing/transformation syntaxique des 14 fichiers TypeScript des dossiers shared, client,
  server et tests via `node:module.stripTypeScriptTypes` : succès.
- Relecture des signatures publiques Rapier et du cycle de vie REST Agones dans leurs sources officielles.

Ce parsing ne remplace pas `tsc` : il ne vérifie ni les types ni les imports des bibliothèques.
Le point d'entrée NestJS à décorateurs n'est pas inclus dans cette vérification syntaxique.

L'installation npm est bloquée par l'accès réseau (`EACCES` vers registry.npmjs.org).
`npm run typecheck` a été tenté et s'arrête sur l'absence de `tsc`, conséquence des dépendances non installées.
Non exécutés : typecheck TypeScript, build Vite/esbuild, génération/migrations Prisma,
tests d'intégration Rapier/FlatBuffers, rendu navigateur, image Docker et allocation Kubernetes.
Aucun benchmark 144 FPS, aucune mesure de tick p99 et aucun SLA régional n'est revendiqué.

## Vérifications à effectuer avec accès npm

```sh
npm install
npm run prisma:generate
npm test
npm run test:integration
npm run typecheck
npm run build
```

Puis tester deux onglets, crouch sous plafond, collision aux angles, jump/slide sur une pente,
latence 0/30/80/200 ms, jitter, suspend/reprise d'onglet, input flood, ticket expiré/rejoué,
connexion lente et démarrage tardif du sidecar Agones. Les tests d'intégration livrés couvrent
la répétabilité de deux simulations WASM, la restauration/rejeu et l'ABI FlatBuffers.

Mesures de charge : durée du tick p50/p95/p99, dépassements de deadline, pause GC, taille du
snapshot, débit montant/descendant, queue d'inputs, corrections de position et disponibilité
du buffer Ready. Employer des bots réellement connectés, pas uniquement des appels directs.

## Ajout graphique — 5 octobre 2026

- 20 tests autonomes relancés : 20 réussites.
- Décor utilisant les boîtes de collision partagées, avatars et arme procéduraux.
- Recul et flamme cosmétiques séparés de la simulation et du rejeu.
- Installation npm refusée par le réseau de la session. Compilation et rendu WebGL non vérifiés ici.
- CI ajoutée pour génération Prisma, tests autonomes, intégration et build. Elle doit passer après publication.
