# Validation Vortex 0.5

Validation locale Windows / Node.js 24.19.0, le 9 octobre 2026 :

- 29 tests unitaires : mouvement, codecs, combat, symétrie et spawns, compteur de tirs, réglages et intersections des solides convexes.
- 8 tests d'intégration et réseau : replay Rapier, snapshots, stabilité des spawns, accès aux jardins et au toit sans saut dans les deux sens, comparaison de 80 rayons avec les collisions Rapier, serveur réel, isolation FFA/TDM et chargeurs.
- Build TypeScript, Vite et serveur esbuild réussi.
- 3 scénarios Chromium / WebGL logiciel : partie multijoueur, classement, armes, tir, rechargement et changement de salon ; réglages persistants et interface 390 × 844 ; changements de qualité faible, moyenne, haute puis faible.

Soit 40 tests réussis. Les captures du lobby, du HUD et des réglages mobiles sont produites dans `test-results/`. La CI conserve les captures navigateur dans vortex-browser-review.

`npm run review:map` produit cinq vues contrôlées : ensemble du canyon, place, grotte, jardin et toit. Elles ont été examinées pour vérifier les textures, la disposition du décor et les ombres. `npm run review:map -- low` permet une revue sans shadow maps.

La géométrie des rochers et rampes est partagée entre rendu, physique et rayons de tir. Les parcours sont traversés avec le contrôleur physique réel, sans saut ; les deux côtés symétriques et les descentes sont couverts. La végétation décorative reste traversable, à l'exception des quatre troncs des jardins qui ont des collisions partagées.

Les traînées de tir restent cosmétiques, reconstruites depuis les snapshots existants ; voir README pour leurs limites de synchronisation. Les marqueurs de touche suivent les hits confirmés. Les tests navigateur ne mesurent pas la fidélité balistique des traînées.

Le rendu regroupe les solides par matériau et instancie les plantes. La qualité faible désactive les shadow maps et réduit la végétation ; les qualités moyenne et haute utilisent des cartes d'ombres de 1024 et 2048 pixels. Les animations d'ambiance respectent le réglage de réduction des animations. Ces vérifications ne constituent ni un benchmark matériel à 144 FPS ni une qualification de charge à 16 joueurs. Vite signale toujours un bundle client supérieur à 500 kB, incluant Three.js et Rapier.

Le périmètre de matchmaking, OIDC et publication décrit dans ARCHITECTURE.md est conservé.
