# Rift Canyon — géométrie et parcours

La carte conserve 128 × 128 m et les douze spawns. Elle dispose d'une place centrale abritée, d'un toit de réacteur, de deux jardins surélevés, de galeries et de grottes à plusieurs entrées. Les chemins sinueux guident les déplacements au sol entre les rochers.

La géométrie `shared/arena-geometry.ts` décrit les rochers convexes et les rampes. Le rendu, les colliders Rapier, les tirs serveur et les traînées utilisent les mêmes sommets et faces. Les biseaux n'introduisent pas de volume invisible dans les coins. Les rampes s'accèdent en marchant, sans autostep.

Le jeu et la prédiction partagent `rift-expedition-6`. Le client et le serveur doivent être déployés ensemble.

Les tests couvrent les spawns, la symétrie, le replay, les accès au toit et aux jardins sans saut, et comparent 80 raycasts aux colliders Rapier. Les snapshots et le protocole de combat restent compatibles.

Pour contrôler neuf points de vue de la carte :

```sh
node scripts/review-arena.mjs
```

Le script lance un Vite local temporaire et Chromium avec WebGL logiciel, enregistre les captures dans `test-results/map-review`, puis arrête ses processus.

## Matériaux peints

Les neuf surfaces de `client/materials.ts` sont générées sur canvas : sable, trois teintes de grès, métal peint, caisses de ravitaillement, céramique, caillebotis et écorce. Les aplats, coups de pinceau et strates donnent un style cartoon sans bruit photographique.

Les UV du terrain ont une échelle physique constante. Les falaises utilisent des strates plus larges ; les caisses portent une composition complète sur chaque face. Les textures et matériaux sont mis en cache et les solides sont regroupés par surface. Les avatars et armes partagent le dégradé d'ombrage à quatre tons.

## Ambiance et qualité

Les jardins ont des jardinières et des troncs solides ; les feuilles sont du feuillage pénétrable. Les petites plantes restent dans les marges des routes et de la place centrale. Les bassins des grottes sont des surfaces peu profondes au niveau du sol, sans danger ni trou de collision.

Le ciel dégradé, les nuages lents et les ondulations se figent avec la réduction des animations. Les ombres directionnelles utilisent 1024 px en qualité équilibrée et 2048 px en haute qualité. La qualité légère conserve les ombres de contact et réduit le nombre de plantes, sans shadow map. Les faces avant des solides produisent les ombres afin de conserver des plafonds propres dans les grottes.

`npm run review:map -- low` contrôle le rendu léger ; la commande sans argument contrôle le rendu haut. Les captures sont également disponibles via les scénarios navigateur. Les nombres de draw calls et de triangles sont des mesures de scène, pas une garantie de FPS matériel.

## Expedition

Les districts, ponts, terrasses, wagons et chantier sont définis dans shared/districts.ts. La seconde carte et les sélecteurs partagés sont dans shared/maps.ts. La texture illustrée locale complète les matériaux procéduraux. Voir [FEATURES.md](FEATURES.md) pour les 40 ajouts et [NETWORK-EXPEDITION.md](NETWORK-EXPEDITION.md) pour les modes et événements serveur.
