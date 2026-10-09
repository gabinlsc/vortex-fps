# Expedition 0.6 — les 40 features validées

Les 40 propositions ont été validées par l’utilisateur. La version 0.6 en livre une première version jouable. Les branches suivent les dépendances : maps, districts, art, objectifs, combat, entraînement et validation. Les détails ci-dessous décrivent les implémentations livrées.

| N° | Feature | Livraison 0.6 |
|---|---|---|
| 1 | Rivière et cascade | Ruisseau peu profond sur sol solide, cascade extérieure et bassins animés. |
| 2 | Ponts suspendus | Deux passerelles fixes avec cordages décoratifs et rampes physiques aux accès. |
| 3 | Village d'avant-poste | Deux bâtiments à cour ouverte, murs biseautés, portes larges et toits solides. |
| 4 | Gare de fret | Deux wagons visitables, rails, roues, rampes d’accès et repères de fret. |
| 5 | Temple de la faille | Colonnade couverte, socle et cristal dans le secteur nord-est. |
| 6 | Réseau souterrain | Deux passages couverts sous des coques rocheuses, connectés aux grottes. |
| 7 | Terrasses de canyon | Deux plateformes latérales accessibles par des rampes continues. |
| 8 | Serre visitable | Jardins couverts de serres, poteaux solides et panneaux de verre décoratifs. |
| 9 | Zone de chantier | Plateforme de chantier, rampe orientale et grue statique décorative. |
| 10 | Deuxième map | Tidal Harbor : autre disposition, sélection au lobby, monde physique et salons séparés. |
| 11 | Façades arrondies | Murs de village facettés avec angles biseautés ; aucun volume invisible supplémentaire. |
| 12 | Arches naturelles | Deux arches rocheuses traversables avec piliers et linteaux physiques partagés. |
| 13 | Textures illustrées | Texture originale de grès illustrée, stockée localement, avec les matériaux procéduraux existants. |
| 14 | Graffitis et affiches | Affiches de l’expédition et panneaux colorés sur les façades du village. |
| 15 | Sols par secteur | Terre au fret/chantier, pavés au village/temple et mousse dans les jardins. |
| 16 | Végétation variée | Cactus, fougères, lianes, fleurs et arbres, avec petites plantes instanciées. |
| 17 | Palette nocturne | Choix jour/nuit persistant, lune colorée, éclairage froid et lampes locales. |
| 18 | Brume locale | Voiles de brume radiaux dans les grottes, transparence faible. |
| 19 | Eau plus travaillée | Ondulations, mousse et reflet simplifié du ciel par shader léger. |
| 20 | Décor animé | Turbines, plantes, nuages, insectes et oiseaux animés ; réduction des animations respectée. |
| 21 | Faune d'ambiance | Oiseaux et insectes décoratifs ; case dédiée pour les masquer. |
| 22 | Ambiance sonore | Vent, eau et machines synthétisés, filtrage par secteur et réverbération des pas en grotte. |
| 23 | Pas par matériau | Timbres de pas distincts sur terrain, pierre et métal, avec cadence selon la vitesse. |
| 24 | Impacts par surface | Poussière, étincelles, couleur selon matériau et traces temporaires bornées. |
| 25 | Projectiles synchronisés | Rail depuis origine/fin serveur ; Pulse depuis positions serveur, avec traînée et impacts confirmés. |
| 26 | Armes plus détaillées | Armes avec cellules d’énergie, rails et détails supplémentaires ; cellule mobile au rechargement. |
| 27 | Visite hors ligne | Visite libre utilisant Rapier, sans WebSocket ni serveur. |
| 28 | Mode photo | Caméra libre hors ligne, focale, HUD masqué et export PNG avec P. |
| 29 | Stand de tir | Cibles déplaçables après touche, compteur de tirs/touches et réaction mesurée. |
| 30 | Bots d'entraînement | Bots locaux avec grille de navigation, collisions Rapier, tirs et trois difficultés. |
| 31 | Parcours de mouvement | Cinq portes de mouvement, toit à atteindre, chronomètre et meilleur temps local par map. |
| 32 | Jump pads | Deux pads simulés dans le moteur partagé, sans commande de téléportation client. |
| 33 | Téléporteurs | Deux portails à sortie hors du déclencheur ; changement d’epoch serveur pour éviter le rewind entre positions. |
| 34 | Domination | Trois zones, capture de trois secondes, contestation et score autoritaire par seconde. |
| 35 | Capture du drapeau | Deux drapeaux, transport, capture exigeant le drapeau allié à la base, chute et retour automatique. |
| 36 | Armes et soins au sol | Soins et ravitaillements Rail/Pulse, collecte serveur et réapparition après vingt secondes. |
| 37 | Spectateur | Vue d’un autre joueur pendant la réapparition ; flèches gauche/droite pour changer. |
| 38 | Ping d'équipe | G pour signaler une position ; validation des bornes, délai et diffusion aux seuls alliés du salon. |
| 39 | Qualité adaptative | Résolution adaptative optionnelle, baisse progressive, remontée avec hystérésis et limites bornées. |
| 40 | Relecture de partie | Export/import JSON des poses, scores et événements de combat/objectifs en ligne ; lecteur local et validation de fichier. |


Les bots sont un entraînement local avec navigation au sol, pas des participants aux salons publics. Les relectures en ligne incluent les événements autoritaires ; les sessions hors ligne enregistrent les poses et statistiques. Le rendu de l’eau utilise le reflet du ciel et des ondulations, sans réflexion complète des objets. Les galeries sont sous des toitures rocheuses sur le sol existant, sans excavation du terrain.
