# Rift Canyon — géométrie et parcours

La carte conserve 128 × 128 m et les douze spawns. Elle dispose d'une place centrale abritée, d'un toit de réacteur, de deux jardins surélevés, de galeries et de grottes à plusieurs entrées. Les chemins sinueux guident les déplacements au sol entre les rochers.

La géométrie `shared/arena-geometry.ts` décrit les rochers convexes et les rampes. Le rendu, les colliders Rapier, les tirs serveur et les traînées utilisent les mêmes sommets et faces. Les biseaux n'introduisent pas de volume invisible dans les coins. Les rampes s'accèdent en marchant, sans autostep.

Le jeu et la prédiction partagent `rift-canyon-5`. Le client et le serveur doivent être déployés ensemble.

Les tests couvrent les spawns, la symétrie, le replay, les accès au toit et aux jardins sans saut, et comparent 80 raycasts aux colliders Rapier. Les snapshots et le protocole de combat restent compatibles.

Pour contrôler cinq points de vue de la carte :

```sh
node scripts/review-arena.mjs
```

Le script lance un Vite local temporaire et Chromium avec WebGL logiciel, enregistre les captures dans `test-results/map-review`, puis arrête ses processus.

## Matériaux peints

Les huit surfaces de `client/materials.ts` sont générées sur canvas : sable, trois teintes de grès, métal peint, caisses de ravitaillement, céramique et caillebotis. Les aplats, coups de pinceau et strates donnent un style cartoon sans bruit photographique.

Les UV du terrain ont une échelle physique constante. Les falaises utilisent des strates plus larges ; les caisses portent une composition complète sur chaque face. Les textures et matériaux sont mis en cache et les solides sont regroupés par surface. Les avatars et armes partagent le dégradé d'ombrage à quatre tons.
