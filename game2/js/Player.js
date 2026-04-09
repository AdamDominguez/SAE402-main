class Player {
    constructor() {
        this.width = 60;
        this.height = 100;
        // On centre verticalement. Comme this.y correspond au bas du joueur, on ajoute 
        // la moitié de sa hauteur pour que son centre visuel soit au milieu de l'écran.
        this.y = canvas.height / 2 + this.height / 2; 
        this.x = canvas.width / 2;
        this.vx = 0;
        this.speed = 800; // max px par seconde
        this.friction = 0.85;

        // Nouvelles propriétés pour la chute de défaite
        this.state = 'playing'; // 'playing' ou 'falling'
        this.fallTimer = 0;
        this.splatterTimer = 0; // Chrono pour la tomate sur le visage
    }

    triggerSplatter() {
        this.splatterTimer = 1.0; // On affiche la frame "tâchée" pendant 1 seconde
    }

    triggerFall() {
        this.state = 'falling';
        // Conserve la vitesse horizontale pour garder l'inertie de glissade
        input.tiltX = 0;
        shame = maxShame; // Remplit la jauge = Game Over
        
        // Passe le moteur principal en état de chute
        gameState = 'falling'; 

        // Lance le bruitage de chute
        if (typeof sfx !== 'undefined' && sfx.fall) {
            sfx.fall.currentTime = 0;
            sfx.fall.play().catch(e => console.log("Erreur audio chute:", e));
        }
    }

    update(dt) {
        if (this.splatterTimer > 0) {
            this.splatterTimer -= dt;
        }

        if (this.state === 'falling') {
            this.fallTimer += dt;
            
            // On le laisse glisser sur le sol avec son inertie !
            // La friction de 0.95 le fait ralentir doucement comme sur de la terre
            this.vx *= 0.95; 
            this.x += this.vx * dt;

            // Limites des bords de l'écran pour pas qu'il glisse dehors
            const margin = this.width / 2;
            if (this.x < margin) {
                this.x = margin;
                this.vx = 0;
            } else if (this.x > canvas.width - margin) {
                this.x = canvas.width - margin;
                this.vx = 0;
            }
            
            return; // Bloque les nouveaux contrôles du joueur
        }

        // Vitesse cible selon l'inclinaison
        const targetVx = input.tiltX * this.speed;

        // Lissage / accélération simple
        this.vx += (targetVx - this.vx) * 10 * dt;

        // Applique la friction sans entrée
        if (Math.abs(input.tiltX) < 0.05) {
            this.vx *= this.friction;
        }

        this.x += this.vx * dt;

        // Limites
        const margin = this.width / 2;
        if (this.x < margin) {
            this.x = margin;
            this.vx = 0; // Arrêt net contre le mur
        } else if (this.x > canvas.width - margin) {
            this.x = canvas.width - margin;
            this.vx = 0;
        }
    }

    draw(ctx) {
        // --- ANIMATION D'INCLINAISON FLUIDE ---
        // On calcule la vitesse actuelle sous forme de pourcentage (entre 0 et 1)
        // Math.abs(this.vx) enlève le signe négatif quand il va à gauche
        let speedPercent = Math.abs(this.vx) / this.speed;

        // On bloque le pourcentage entre 0% et 100% au maximum
        speedPercent = Math.max(0, Math.min(1, speedPercent));

        // Comme on a 4 cases (0, 1, 2, 3), on multiplie le % par 3 pour avoir un palier d'inclinaison
        // Ex: Arrêté (0%) = case 0 | Lent (33%) = case 1 | Rapide (66%) = case 2 | Vitesse max (100%) = case 3
        let faceFrame = Math.round(speedPercent * 3);

        let isFlipped = false; // Effet miroir désactivé par défaut
        
        // --- NOUVEAU : On prépare l'image à utiliser ---
        let currentImage = assets.heroane;
        let imageCols = 4; // Par défaut (l'image heroane a 4 colonnes)
        let imageRows = 2; // Par défaut (l'image heroane a 2 lignes)

        if (this.state === 'falling') {
            // Animation de chute en deux phases
            
            // Phase aérienne au début de la chute
            // On laisse cette phase pendant environ 0.2 secondes (le temps de "tomber" en l'air)
            if (this.fallTimer <= 0.2) {
                currentImage = assets.heroane; // Fichier "tomber"
                
                // On fige l'image sur l'index 6 (le déséquilibre) avant de toucher le sol
                faceFrame = 5;
            } 
            // Phase au sol : roulade/rebond (fichier "au_sol")
            else {
                currentImage = assets.heroane_sol;
                imageCols = 3; 
                imageRows = 2; // Nécessite 2 lignes pour accéder aux frames utilisées

                // Temps écoulé depuis qu'il a touché le sol
                let timeOnGround = this.fallTimer - 0.2;
                
                // La séquence spéciale d'animation demandée : 4, puis 3, puis 2, puis 1
                const solFrames = [6, 3, 2, 1];
                
                // On avance d'une case dans le tableau toutes les 0.125s (8 fps)
                let step = Math.floor(timeOnGround * 8);
                
                // On s'assure de ne pas dépasser la fin de l'animation
                if (step >= solFrames.length) {
                    step = solFrames.length - 1; // Reste bloqué éternellement sur la dernière image (index 1)
                }
                
                faceFrame = solFrames[step];
            }
        } else {
            // === MOUVEMENT NORMAL ===
            if (this.vx < -5) {
                isFlipped = true; // Va à gauche = on retourne l'inclinaison
            } else if (this.vx > 5) {
                isFlipped = false; // Va à droite = normal
            }

            // Affiche la frame 8 (index 7) si la tomate a atterri sur le joueur
            if (this.splatterTimer > 0) {
                faceFrame = 6;
            }
        }

        // "scale = 2" signifie que l'image fera le double de la taille de base du joueur
        const scale = 2;
        const drawWidth = this.width * scale;
        const drawHeight = this.height * scale;

        const drawn = drawSpriteFrame(
            ctx,
            currentImage, // L'image qui vient d'être décidée (tomber OU sol)
            faceFrame,
            this.x - drawWidth / 2, // Pour bien centrer l'image horizontalement
            this.y - (drawHeight - this.height), // Pour garder les "pieds" au niveau du sol
            drawWidth,
            drawHeight,
            imageCols, // Les colonnes adaptées à l'image
            imageRows, // Les lignes adaptées à l'image
            isFlipped 
        );

        if (drawn) return;

        ctx.fillStyle = '#C0C0C0'; // Couleur grisée temporaire de l'âne/joueur
        // Dessine l'âne (corps)
        ctx.fillRect(this.x - this.width / 2, this.y, this.width, this.height);
        // Dessine la tête
        ctx.fillStyle = '#A0A0A0';
        ctx.fillRect(this.x - 20, this.y - 40, 40, 40);
    }
}
