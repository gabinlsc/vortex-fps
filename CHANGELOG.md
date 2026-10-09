# Vortex 0.6 — Expedition

Les 40 propositions validées reçoivent une première implémentation jouable : nouveaux districts, passerelles et terrasses, deuxième map Harbor, texture illustrée originale, eau et biomes, variantes de lumière, ambiance sonore, entraînement hors ligne, photo et relecture.

Les modes Domination et Capture du drapeau, les ravitaillements, pads, portails et pings sont gérés par le serveur. Les traînées Rail/Pulse suivent les événements et positions autoritaires, avec impacts selon le matériau. Le changement de carte isole mondes physiques, cibles, scores et événements.

La version est publiée par branches et PR. Les détails et limites de chaque ajout sont dans [docs/FEATURES.md](docs/FEATURES.md).

# Vortex 0.5 — Rift Canyon

La map devient un canyon de grès aux falaises facettées, avec place centrale, avant-poste, grottes de cristal, jardins surélevés et chemins courbes. Deux rampes continues rendent le toit accessible à pied. Les rochers et rampes utilisent la même géométrie pour le rendu, les collisions et les rayons de tir.

Les textures cartoon sont générées localement et mises en cache : strates de roche, sable peint, métal, caisses, céramique, grilles et écorce. Leur échelle reste cohérente avec les dimensions de la map. Les façades, bordures et repères visuels ont été retravaillés.

Le décor ajoute ciel dégradé, soleil, nuages, végétation instanciée, arbres dans les jardins et bassins minéraux. Les ombres et la densité des plantes suivent les trois qualités graphiques ; les animations respectent la réduction des animations. La minimap et les secteurs du HUD suivent le nouveau plan.

Validation : 29 tests unitaires, 8 tests d'intégration, 3 scénarios navigateur et build réussi. Cinq vues contrôlées de la map peuvent être reproduites avec `npm run review:map`. Voir [VALIDATION.md](VALIDATION.md) et [docs/CANYON.md](docs/CANYON.md).

Les 40 propositions de suite sont dans [docs/FEATURES.md](docs/FEATURES.md), en attente de validation.

# Vortex 0.4 — Cartoon Outpost

La map conserve ses 128 × 128 m et ses douze spawns. Deux parcours de sept plateformes de saut ouvrent le toit du réacteur ; deux jardins surélevés et des couvertures latérales ajoutent des positions de combat. Les solides sont partagés entre client, serveur, minimap et collisions.

Le rendu adopte des textures peintes générées localement, un ombrage cartoon, des contours sombres, des chemins sable, des repères Azure/Ember, des nuages et de la végétation. Aucun asset distant n'est requis.

Les tirs confirmés déclenchent les traînées Rail/Pulse, le flash, le recul et les sons. Les impacts sur la carte produisent des étincelles. Les dégâts confirmés déclenchent le marqueur de touche et le retour de dégâts. Les traînées demeurent cosmétiques ; elles ne reproduisent pas les collisions serveur avec les joueurs.

Le menu propose FOV, sensibilité, volume, qualité, effets et réduction des animations. Le HUD affiche vitesse, secteur, orientation, état critique et rechargement. Les réglages sont persistants et bornés.

Lancement : `npm run play`. Validation : `npm test`, `npm run test:integration`, `npm run build`, `npm run test:e2e`.
