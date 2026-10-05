# Vortex — Rift Outpost
FPS multijoueur navigateur : Three.js, Rapier WASM, TypeScript, serveur autoritaire 128 Hz.
## Lancer une partie
Node.js 24 recommandé.
```sh
npm install
npm run prisma:generate
npm run server:dev
```
Dans un second terminal :
```sh
npm run dev
```
Ouvrir http://localhost:5173, choisir un pseudo, FFA ou Team Deathmatch, le pilote et l'arme, puis lancer.
Ouvrir un second onglet pour rejoindre la même partie. Si le navigateur refuse la capture initiale de la souris, cliquer sur Reprendre.
Le serveur de développement est limité à 127.0.0.1. Pour une publication, configurer un endpoint WSS via VITE_GAME_URL, ALLOWED_ORIGINS, TICKET_SECRET et MATCH_ID ; les tickets d'admission restent obligatoires hors développement.
## Contrôles
| Action | Contrôle |
|---|---|
| Déplacements | ZQSD / WASD |
| Bunny hop | Espace |
| Slide | Shift |
| Tir | Clic gauche |
| Arsenal | 1 / 2 / molette |
| Recharger | R |
| Classement et joueurs | Maintenir Tab |
| Menu / reprendre | Échap / bouton Reprendre |
## Carte
Rift Outpost mesure 128 × 128 m. Le sol est continu, avec des limites solides, un avant-poste intérieur à quatre entrées, deux grottes avec toit et alcôves, clusters rocheux, plateformes basses et caisses.
Les surfaces utilisent des textures procédurales déterministes, générées localement : aucun téléchargement de modèle ou de texture n'est nécessaire.
Douze spawns validés hors des solides. Le serveur choisit celui qui maximise la distance au plus proche adversaire ; en équipe, il respecte la moitié nord/sud.
Réapparition après deux secondes, protection d'une seconde. Le serveur replace aussi les joueurs tombés hors carte.
## Arsenal
Rail : hitscan, chargeur de 6, 100 dégâts, rechargement 1,5 s.
Pulse : projectiles, chargeur de 24, 35 dégâts, rechargement 1,25 s.
Réserve infinie ; le chargeur et le délai de rechargement sont autoritaires. R recharge un chargeur entamé ; un chargeur vide déclenche automatiquement le rechargement.
Une arme ne peut pas tirer pendant le rechargement. Le cooldown reste commun lors d'un changement d'arme, pour éviter de contourner la cadence.
## Joueurs et modes
Spectre, Ember, Prism : cosmétiques, avec mêmes collisions et déplacements.
Pseudo validé à l'admission, visible sur le classement et au-dessus de l'avatar.
FFA : chacun pour soi. TDM : équipes Azure/Ember équilibrées à l'entrée, sans dégâts alliés.
Les deux modes sont des salons séparés : snapshots, dégâts, projectiles, scores et annonces sont filtrés par mode.
Manches de 10 minutes, résultat annoncé et nouvelle manche automatique. Pas de bots ni de classement persistant de ces parties locales.
Kills, assists et morts calculés par le serveur. Une assistance nécessite au moins 25 dégâts dans les dix dernières secondes, sans compter le kill du tireur.
Mini-carte : vous et vos alliés ; aucun radar révélant les adversaires.
## Validation
```sh
npm test
npm run test:integration
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```
La CI exécute les tests purs, Rapier/FlatBuffers, le serveur WebSocket réel et le navigateur Chromium avec WebGL logiciel. Les captures et traces sont dans l'artefact vortex-browser-review.
L'ABI inputs passe à v2 (bit Reload) ; snapshots VTX2. Client et serveur doivent être mis à jour ensemble.
Les cibles 144 FPS et 128 ticks demandent encore un benchmark matériel et une qualification sous charge ; un workflow vert ne constitue pas ce benchmark.
## Architecture
shared/ : carte, règles, mouvement, armes et ABI. server/ : simulation, combats, admission et Agones.
client/ : lobby, moteur 3D, prédiction, interpolation et interfaces. api/ : fondations NestJS/OIDC et Prisma.
L'API de matchmaking complète et le déploiement public restent des travaux distincts ; voir ARCHITECTURE.md.
