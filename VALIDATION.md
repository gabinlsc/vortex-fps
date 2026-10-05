# Validation Vortex 0.3

La refonte a passé le workflow [37295739333](https://github.com/gabinlsc/vortex-fps/actions/runs/37295739333) sur db42526 : 26 tests purs, 5 tests d'intégration/réseau, build TypeScript/Vite et 1 scénario Chromium/WebGL.

Les tests vérifient la simulation Rapier et son replay, la stabilité des douze spawns, les règles de combat et d'assistance, les chargeurs/rechargements, les pseudos et l'isolation FFA/TDM avec un serveur WebSocket réel.

Le scénario navigateur lance une partie avec un second joueur réseau, ouvre le classement, change d'arme, tire, recharge, quitte et rejoint un salon en équipe. La prédiction coalesce les snapshots avant le replay et borne les commandes en attente pour conserver une session réactive.

Les captures lobby.jpg, spawn.jpg, scoreboard.png et arena.jpg sont collectées dans l'artefact vortex-browser-review. Les résultats du dernier commit restent consultables dans son workflow.

L'exécution complète a lieu sur le runner GitHub ; le terminal local de cette session est indisponible. La CI valide le fonctionnement, sans constituer un benchmark de FPS sur matériel joueur ni une qualification sous charge.
