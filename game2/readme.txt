README — GAME 2 (Opération Klapperstein)

1 Fichiers JS et fonction globale

js/utils.js
- Rôle global : fonctions utilitaires partagées.
- Sert notamment au chargement des images et au découpage/affichage des sprites.

js/globals.js
- Rôle global : état central du jeu.
- Contient les variables communes (canvas, assets, score, honte (shame), état de partie, sons, entités, etc.).

js/input.js
- Rôle global : gestion des entrées joueur.
- Gère l’orientation téléphone (gyroscope) + fallback clavier.

js/Player.js
- Rôle global : classe du personnage (âne + porteur).
- Gère déplacement, animations et états visuels.

js/Pendulum.js
- Rôle global : classe de la pierre suspendue.
- Gère le balancement, la physique et les collisions associées.

js/Tomato.js
- Rôle global : classe des tomates ennemies.
- Gère spawn visuel, trajectoire, collisions et cycle de vie.

js/Fragment.js
- Rôle global : classe du fragment de chronorouage (objectif de victoire).
- Gère apparition, chute, collision avec le joueur et désactivation hors écran.

js/integration.js
- Rôle global : pont de communication avec le Hub multi-jeux.
- Expose les fonctions globales :
	- signalGameReady()
	- signalGameState(state)
	- signalVictory(payload)
	- triggerGameVibration(pattern)
- Reçoit aussi le contexte envoyé par le Hub (GAME_CONTEXT).

js/main.js
- Rôle global : moteur principal.
- Contient la boucle de jeu (update/draw), la logique de difficulté, les collisions,
	les écrans (start/game over/victoire), les sons, la vibration et le cheat triple tap.




2 Règles du jeu

- Objectif : survivre aux tomates et récupérer le fragment du chronorouage.
- Contrôle principal : incliner le téléphone à gauche/droite pour esquiver.
- Perte : la jauge de honte monte à chaque tomate reçue ; si elle atteint le max, défaite.
- Victoire : attraper le fragment quand il apparaît à l’écran.
- Le score augmente avec le temps de survie.
- La difficulté augmente progressivement (spawn des tomates + comportement pendule).




3 Activation du cheat (apparition directe du fragment)

- Condition : être en partie (état "playing").
- Action : taper 3 fois rapidement sur l’écran/tactile (triple tap).
- Fenêtre de détection : 900 ms.
- Effet : le fragment du chronorouage apparaît immédiatement s’il n’est pas déjà actif.