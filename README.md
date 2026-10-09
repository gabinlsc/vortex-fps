# Vortex — Rift Outpost
FPS multijoueur navigateur : Three.js, Rapier WASM, TypeScript, serveur autoritaire 128 Hz.
## Lancer une partie
Node.js 24 recommandé.
```sh
npm install
npm run prisma:generate
npm run play
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
## Nouveautés 0.5

- Canyon à falaises et rochers convexes, place centrale, galeries et grottes à plusieurs entrées.
- Rampes accessibles en marchant vers les toits et les jardins ; couvertures réparties sur les chemins sinueux.
- Huit surfaces peintes et écorce : sable, grès de plusieurs teintes, métal, céramique, ravitaillement et caillebotis.
- Ciel dégradé, soleil, nuages, arbres en jardinières, végétation, bassins minéraux et éclairage des grottes.
- Ombres en qualité équilibrée/haute ; ombres de contact et végétation allégée en qualité légère.
- Géométrie identique pour les collisions, tirs et rendu.
- `npm run review:map` génère neuf captures de contrôle. Détails dans [CANYON.md](docs/CANYON.md), les ajouts validés dans [FEATURES.md](docs/FEATURES.md).

## Nouveautés 0.4

- Textures peintes, ombrage cartoon, contours et environnement lumineux.
- Deux parcours de sept plateformes vers le toit, jardins surélevés et couvertures symétriques.
- Traînées Rail/Pulse, étincelles, sons, recul et marqueur de touche.
- HUD avec vitesse, secteur et orientation ; réglages FOV, souris, volume, qualité et animations sauvegardés.
- `npm run play` lance client et serveur ensemble. Ctrl+C arrête les deux.

## Carte
Rift Canyon mesure 128 × 128 m. Un canyon de grès entoure une place centrale abritée, un réacteur sur le toit, deux jardins surélevés et deux grottes connectées par des galeries.
Les surfaces cartoon sont générées localement, avec des UV à échelle physique constante et une composition complète sur les caisses. Aucun téléchargement d'asset n'est requis.
Les solides convexes sont partagés entre rendu, Rapier et tirs serveur. Les rampes vers les jardins à 2,4 m et le toit à 7 m sont testées sans saut ; les tirs sont comparés aux raycasts Rapier.

Douze spawns validés hors des solides. Le serveur choisit celui qui maximise la distance au plus proche adversaire ; en équipe, il respecte la moitié nord/sud.
Réapparition après deux secondes, protection d'une seconde. Le serveur replace aussi les joueurs tombés hors carte.
## Arsenal
Rail : hitscan, chargeur de 6, 100 dégâts, rechargement 1,5 s.
Pulse : projectiles, chargeur de 24, 35 dégâts, rechargement 1,25 s.
Réserve infinie ; le chargeur et le délai de rechargement sont autoritaires. R recharge un chargeur entamé ; un chargeur vide déclenche automatiquement le rechargement.
Une arme ne peut pas tirer pendant le rechargement. Le cooldown reste commun lors d'un changement d'arme, pour éviter de contourner la cadence.
Les traînées en ligne utilisent les événements serveur : origine et fin du Rail, positions Pulse à 32 Hz et impacts confirmés. L’affichage reste soumis au délai réseau ; les dégâts sont autoritaires. Les effets sont bornés (32 traînées/traces et 128 particules). Le marqueur de touche suit le compteur de hits confirmé.

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
L'ABI inputs passe à v2 (bit Reload) ; snapshots VTX2. Carte `rift-expedition-6` : client et serveur doivent être mis à jour ensemble.
Les cibles 144 FPS et 128 ticks demandent encore un benchmark matériel et une qualification sous charge ; un workflow vert ne constitue pas ce benchmark.
## Architecture
shared/ : carte, règles, mouvement, armes et ABI. server/ : simulation, combats, admission et Agones.
client/ : lobby, moteur 3D, prédiction, interpolation et interfaces. api/ : fondations NestJS/OIDC et Prisma.
L'API de matchmaking complète et le déploiement public restent des travaux distincts ; voir ARCHITECTURE.md.

## Expedition 0.6

Sélectionner **Rift Canyon** ou **Tidal Harbor**, puis FFA, TDM, Domination ou Capture du drapeau. Les cartes ont des salons et collisions séparés. **G** envoie un ping aux alliés. Pads, portails, drapeaux, zones et ravitaillements sont simulés par le serveur. Les tirs sont désormais affichés depuis les événements autoritaires.

Le volet **Exploration et entraînement hors ligne** propose visite, stand de tir, bots et parcours chronométré. Échap ouvre le menu ; le mode photo utilise ZQSD/WASD, Espace/C pour monter/descendre, Shift pour accélérer, et **P** pour exporter un PNG. Le menu permet de régler la focale, exporter une relecture ou ouvrir son JSON. Échap quitte le lecteur de relecture. Pendant la réapparition en multijoueur, les flèches changent le joueur suivi.

Les réglages ajoutent jour/nuit, faune et résolution adaptative. Voir [les 40 ajouts](docs/FEATURES.md), [le contrat réseau](docs/NETWORK-EXPEDITION.md) et [la provenance de la texture](docs/TEXTURE-ART.md). Cette version utilise la carte `rift-expedition-6` : publier client et serveur ensemble.
