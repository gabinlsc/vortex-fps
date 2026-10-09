# Contrat Expedition

L'admission conserve l'ABI binaire VTX2 et exige la version de carte partagée. Le JSON d'admission ajoute `mapId: "canyon" | "harbor"` (canyon par défaut). Une connexion appartient à une seule paire carte/mode ; les collisions, cibles, scores, événements et snapshots sont isolés par cette paire.

Les modes acceptés sont `ffa`, `tdm`, `domination`, `ctf`. Le champ numérique `mode` des snapshots représente leur index dans cette liste. Les commandes de mouvement gardent leur ABI existante. Les nouveaux messages JSON client ne peuvent soumettre ni dégâts, ni score, ni position de projectile, ni position du joueur.

Messages serveur additionnels : `shot` (identifiant, tireur, arme, origine et fin confirmées), `projectiles` (positions autoritaires), `impact` (identifiant et position confirmée), `objectives` (zones, drapeaux et disponibilités des objets), `ping` (position bornée, équipe, expiration). Les messages sont limités au salon et au budget de sortie existant.

Le seul message JSON après admission accepté du client est `ping`, avec une cible finie dans la carte. Le serveur applique délai et contrôle d'équipe. Les clients ne peuvent modifier les objectifs ou objets. Les relectures sont locales, bornées et jamais soumises au serveur comme preuve de résultat.

Les tests réseau doivent vérifier l'isolation des deux cartes, les modes d'équipe, la validation des messages et les positions autoritaires de tir. Les tests Rapier couvrent les chemins et les dispositifs de mouvement sur les deux cartes.
