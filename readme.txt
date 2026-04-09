Hub multi-jeux — SAE402

Ce projet utilise un Hub qui orchestre une aventure narrative entre 5 jeux.
Le Hub affiche les transitions d'histoire, charge le jeu courant dans une iframe, puis passe au jeu suivant quand un niveau est gagné.

Structure principale

- index.html : page Hub (point d’entrée du site)
- style/hub.css : styles du Hub
- js/hub.js : logique de progression, menu prof, sauvegarde
- gameX/ : jeu actuellement intégré 

Fonctionnement global

1 Le Hub lit la progression depuis localStorage (clé epopee_progress).
2 Le Hub affiche le chapitre courant (overlay narratif).
3 Au clic sur Lancer le jeu, le Hub charge le jeu dans l’iframe.
4 Le jeu envoie des messages au Hub (postMessage) :
   - GAME_READY
   - GAME_STATE (menu ou playing)
   - GAME_COMPLETE (victoire)
5 À la victoire, le Hub valide le niveau et prépare le chapitre suivant.

Sauvegarde

Le Hub stocke un objet JSON dans localStorage avec :
- version
- currentLevel
- completedLevels
- variables (stats partagées)
- updatedAt

Paramètres URL utiles

- ?debug=1 : active le mode debug (et le transmet au jeu lancé, permet d'outrepasser la vérification GPS)
- ?start=1 : force le démarrage au chapitre 1 (ou 2..5)
- ?reset=1 : réinitialise la progression sauvegardée

Exemple :
- index.html?reset=1&start=1

Menu déroulant (accès prof)

Le menu burger du Hub permet de lancer directement un jeu (1 à 5) en mode notation.
Ces accès forcent automatiquement debug=1 pour faciliter les tests.

Comportement visuel :
- Menu Hub visible dans les écrans de transition
- Menu Hub masqué pendant le gameplay
- Menu Hub réaffiché quand le jeu repasse sur ses menus (GAME_STATE = menu)

Intégrer un nouveau jeu (game1, game3, game4, game5)

1 Créer le dossier gameX/ avec son index.html.
2 Ajouter le script d’intégration (même contrat que game2/js/integration.js).
3 Envoyer au minimum :
   - GAME_READY au chargement
   - GAME_COMPLETE à la victoire
   - GAME_STATE pour menu / playing (recommandé)
4 Vérifier le chemin du jeu dans js/hub.js (storyData).


Débogage rapide
- Si le mauvais chapitre se charge : vérifier localStorage (epopee_progress) ou utiliser ?reset=1&start=...
- Si un jeu ne se lance pas : vérifier le chemin du dossier (gameX/index.html)
- Si l’UI mobile varie avec la barre navigateur : le projet utilise 100dvh et viewport-fit=cover
