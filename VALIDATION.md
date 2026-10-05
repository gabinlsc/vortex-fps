# Validation Vortex 0.4

Validation locale Windows / Node.js 24.19.0, le 5 octobre 2026 :

- 28 tests unitaires : mouvement, codecs, combat, symétrie et spawns, compteur de tirs, validation des réglages.
- 6 tests d'intégration et réseau : replay Rapier, snapshots, stabilité des spawns, accès aux deux parcours de toit, serveur réel, isolation FFA/TDM et chargeurs.
- Build TypeScript, Vite et serveur esbuild.
- 2 scénarios Chromium / WebGL logiciel : partie multijoueur, classement, changement d'arme, tir, rechargement, changement de salon ; réglages persistants et interface sur écran 390 × 844.

Les captures dans `test-results/` sont examinées pour vérifier le lobby, le HUD, l'arène et les réglages mobiles. La CI les conserve dans vortex-browser-review.

Les nouveaux parcours sont traversés avec le contrôleur physique réel en maintenant déplacement et saut. Le test couvre les deux côtés symétriques. Le serveur utilise exactement les mêmes solides que le rendu et la prédiction.

Les effets de tir sont cosmétiques, reconstruits depuis les snapshots existants ; voir README pour leurs limites de synchronisation. Les marqueurs de touche suivent les hits confirmés. Les scénarios navigateur ne mesurent pas la fidélité balistique des traînées.

Le rendu groupe les solides en quatre meshes avec UV à échelle constante et trois groupes de contours instanciés. Les effets utilisent des pools bornés. Cela ne constitue pas un benchmark matériel à 144 FPS ni une qualification de charge à 16 joueurs.

L'API de matchmaking, OIDC et l'infrastructure de publication gardent leur périmètre décrit dans ARCHITECTURE.md.
