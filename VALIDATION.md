# Validation de jouabilité — 15 octobre 2026

Base : `gabinlsc/vortex-fps`, `main` au commit `6114a53876a0cc344b4e86645138b02c7d695c4b`.
Travail local sur `fix/playability-local`. Aucun push, aucune branche distante créée ou modifiée, aucune fusion.

## Diagnostic

La dernière exécution distante existante, Validate Vortex #31 du 9 octobre, est réussie. La refonte Expedition 0.6 est déjà intégrée à cette base : ce travail la vérifie et corrige ses blocages, sans revendiquer avoir recréé les cartes.

Les 37 tests unitaires initiaux passent. Le replay déterministe WASM initial passe également avec Node directement. Le lanceur CLI tsx échoue ici avec EPERM sur son socket IPC ; le lancement via `node --import tsx` permet d'exécuter les intégrations et le serveur.

La première suite navigateur révèle un autre blocage : le watchdog arrête le serveur local quand le rendu logiciel Chromium monopolise la machine plus de 250 ms. Résultat observé : fermeture 1006 puis ECONNREFUSED. Les tests hors ligne et graphiques passent alors que les deux scénarios multijoueurs échouent.

## Corrections

- Lancement des tests d'intégration, du serveur et de l'API par le chargeur Node de tsx, sans serveur IPC du CLI.
- Installation CI reproductible via `npm ci`, avec les versions du lockfile.
- Ensemble d'exclusion des colliders joueurs distinct pour chaque monde Rapier. Les handles sont locaux au monde : un joueur Harbor pouvait masquer un solide Canyon portant le même handle.
- Capsule initiale conforme à l'état accroupi, cohérente avec une restauration du même snapshot.
- En développement, reprise de l'ordonnancement après un retard hôte sans quitter le serveur. Les ticks physiques restent fixes ; la simulation locale peut ralentir pendant la surcharge. Le watchdog de production reste actif.
- Effacement des commandes ponctuelles en attente lors de la perte de focus.
- Restauration du choix des quatre modes enregistrés, y compris Domination et CTF.

## Périmètre jouable vérifié

- Canyon 128 × 128 m : terrain texturé, couvertures, districts, rampes, jardins, passerelles et deux grottes abritées. Les grottes sont des coques au-dessus du sol, pas un terrain excavé.
- Douze spawns sur chaque carte : stabilité sur le sol ; choix éloigné des ennemis et moitié d'équipe.
- Pseudo, lancement, capture souris et retour au menu ; sessions FFA et Team Deathmatch, joueurs et équipes dans le classement.
- Rail et Pulse : chargeur, réserve infinie affichée, tir et rechargement ; kills, assists et morts transportés dans les snapshots. Attribution des kills/assists vérifiée par tests de combat.
- Harbor, Domination et CTF ; visite, bots et stand hors ligne ; export/import de relecture.

## Vérifications de cette session

| Vérification | Résultat |
|---|---|
| `npm ci` | Réussite |
| `npm run prisma:generate` | Réussite |
| `npm test` | 37/37 |
| `npm run test:integration` | 14/14 |
| `npm run typecheck` | Réussite |
| `npm run build` | Réussite : client Vite et serveur esbuild |
| `npm run test:e2e` | 6/6 après corrections |
| `npm run review:map -- low` | Neuf vues générées, aucune erreur de page ; vue d'ensemble et grotte inspectées |
| `git diff --check` | Réussite |

Les intégrations ajoutées comparent les capsules accroupies initialisées/restaurées, la réconciliation WASM à ACK retardé après changements de posture et saut, et la traversée des deux entrées de grottes. Le test réseau suspend réellement le serveur 400 ms sous Linux puis vérifie sa reprise, les snapshots, l'isolation des modes/cartes, les équipes, les noms, les chargeurs et les projectiles. La suspension forcée est omise sous Windows.

Les tests navigateur couvrent les paramètres, le format mobile, les qualités graphiques, les cartes/jour-nuit, le déplacement, le tir, le rechargement, la réserve infinie, les listes de joueurs, les équipes, les outils hors ligne et les relectures. Captures et traces sont produites dans `test-results/` et archivées par la CI lorsqu'elle sera exécutée sur une version approuvée.

## Limites

Validation Chromium avec SwiftShader sous Linux / Node 24.19.0, pas un benchmark GPU. Aucun test de charge à 16 joueurs, aucune mesure de latence Internet ni validation d'équilibrage compétitif. Le bundle client reste volumineux (environ 2,84 Mo, 995 Ko gzip) et Vite le signale. Rapier émet un avertissement interne de dépréciation à l'initialisation ; il ne fait pas échouer les tests.

Aucune nouvelle CI distante n'a été déclenchée et aucun hébergement n'a été déployé.

## Lancement local

Avec Node 24, depuis la racine du dépôt :

```sh
npm ci
npm run prisma:generate
npm run play
```

Ouvrir `http://127.0.0.1:5173`. Pour jouer seul immédiatement, ouvrir les outils d'entraînement puis Bots. Pour le multijoueur local, ouvrir deux onglets, sélectionner la même carte et le même mode, puis lancer. ZQSD/WASD, clic gauche, R, 1/2, Espace, Shift, Tab et Échap.
