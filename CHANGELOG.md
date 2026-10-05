# Vortex 0.4 — Cartoon Outpost

La map conserve ses 128 × 128 m et ses douze spawns. Deux parcours de sept plateformes de saut ouvrent le toit du réacteur ; deux jardins surélevés et des couvertures latérales ajoutent des positions de combat. Les solides sont partagés entre client, serveur, minimap et collisions.

Le rendu adopte des textures peintes générées localement, un ombrage cartoon, des contours sombres, des chemins sable, des repères Azure/Ember, des nuages et de la végétation. Aucun asset distant n'est requis.

Les tirs confirmés déclenchent les traînées Rail/Pulse, le flash, le recul et les sons. Les impacts sur la carte produisent des étincelles. Les dégâts confirmés déclenchent le marqueur de touche et le retour de dégâts. Les traînées demeurent cosmétiques ; elles ne reproduisent pas les collisions serveur avec les joueurs.

Le menu propose FOV, sensibilité, volume, qualité, effets et réduction des animations. Le HUD affiche vitesse, secteur, orientation, état critique et rechargement. Les réglages sont persistants et bornés.

Lancement : `npm run play`. Validation : `npm test`, `npm run test:integration`, `npm run build`, `npm run test:e2e`.
