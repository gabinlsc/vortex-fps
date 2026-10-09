# Validation Vortex 0.6

Validation Windows / Node.js 24.19.0 du 9 octobre 2026 :

- 37 tests unitaires : ABI, mouvement, collisions convexes, combat et réglages ; zones contestées et capture, drapeaux et retours, soins et cooldowns, validation des cartes/pings, dispositifs de mouvement, navigation bornée, relectures et résolution adaptative.
- 11 tests d’intégration/réseau : replay Rapier, snapshots, spawns, rampes du toit/jardin, nouvelles passerelles/terrasses/wagons/chantier, Harbor, activation réelle des pads/portails, comparaison de 80 rayons et serveur réel avec isolation des deux cartes et des quatre modes, pings et projectiles.
- 6 scénarios navigateur Chromium / SwiftShader : multijoueur et chargeurs ; réglages/mobile ; qualités graphiques ; maps/nuit/visite hors ligne sans socket et PNG photo ; stand/export/import de relecture/bots/parcours ; Harbor en Domination et CTF.
- Build TypeScript, Vite et esbuild réussi. Aucun benchmark matériel ni test de charge à 16 joueurs n’est revendiqué. Vite signale toujours le bundle client supérieur à 500 kB, incluant Three.js/Rapier.

Total : 54 tests. Les captures et traces sont dans test-results/, ignoré par Git et conservé par la CI.

Le script de revue produit neuf points de vue et attend le chargement de la texture illustrée : npm run review:map ; variantes avec -- low, -- night ou -- harbor. Les meshes statiques opaques sont regroupés par matériau. La vue d’ensemble est passée de 287 à 181 appels de rendu lors de cette optimisation locale ; ce nombre décrit la scène, pas les FPS d’un matériel.

La carte conserve les douze spawns et le cœur symétrique. Les nouveaux districts sont distincts ; l’équilibrage compétitif nécessite des parties de jeu. Les bots sont locaux et naviguent au sol. La relecture en ligne conserve poses et événements ; les sessions hors ligne conservent poses et statistiques. Les textures illustrées sont locales ; l’eau reflète un ciel simplifié. Le terrain n’est pas creusé sous le sol : les passages sont abrités par des coques rocheuses.

Le contrat réseau figure dans docs/NETWORK-EXPEDITION.md. Le matchmaking HTTP/OIDC existant n’est pas modifié. Le client et le serveur doivent partager rift-expedition-6.
