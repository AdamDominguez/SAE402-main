class Tomato {
    constructor(targetPlayer, options = {}) {
        this.type = options.type === 'rotten' ? 'rotten' : 'normal';
        this.isRotten = this.type === 'rotten';

        // Apparition depuis le bas de l'écran (derrière la caméra)
        this.startX = Math.random() * canvas.width;
        this.startY = canvas.height + 50;

        // Position actuelle
        this.x = this.startX;
        this.y = this.startY;

        // La cible (où la tomate atterrit)
        // On vise un peu autour du joueur pour que ce ne soit pas un "aimbot" parfait
        this.targetX = targetPlayer ? targetPlayer.x + (Math.random() - 0.5) * 200 : canvas.width / 2;
        this.targetY = targetPlayer ? targetPlayer.y + targetPlayer.height / 2 : canvas.height - 150;

        // Temps de vol (De 1 à 1.8 secondes)
        this.duration = 1.0 + Math.random() * 0.8;
        this.timeAlive = 0;

        // Échelle (La profondeur / perspective 3D)
        this.startScale = 4.0; // Énorme au départ (près de l'écran)
        this.endScale = 0.5;   // Plus petite à l'arrivée (au niveau du joueur)

        this.scale = this.startScale;
        this.radius = 15; // Rayon de base de la tomate
        this.active = true;
        this.splatColor = this.isRotten ? '#2f2f2f' : '#d62828';
        this.particleColor = this.isRotten ? '#3a3a3a' : '#ff0000';

        // État de la tomate
        this.state = 'flying'; // Peut-être 'flying' (vol), 'splattered' (hit le joueur) ou 'missed' (hit le sol)
        this.splatterTimer = 0; // Chrono pour faire disparaître la tache après quelques secondes
    }

    update(dt) {
        // Si la tomate a atteint le sol (raté), elle s'arrête de bouger et on lance son chrono
        if (this.state === 'missed') {
            this.splatterTimer += dt;
            if (this.splatterTimer > 1.5) { // Disparaît au bout de 1,5 seconde
                this.active = false;
            }
            return; // On stoppe l'update de sa trajectoire physique 
        }

        this.timeAlive += dt;
        let progress = this.timeAlive / this.duration; // Évolue de 0 à 1 (début à fin)

        if (progress >= 1) {
            progress = 1;
            this.state = 'missed'; // La tomate a atterri sur le sol sans toucher l'âne 
            
            // Joue le bruitage d'éclat au sol
            if (typeof sfx !== 'undefined' && sfx.tomatoSplat) {
                const splatSound = sfx.tomatoSplat.cloneNode();
                splatSound.volume = sfx.tomatoSplat.volume;
                splatSound.muted = typeof isMuted !== 'undefined' ? isMuted : false;
                splatSound.play().catch(e => console.log("Erreur audio tomate éclat:", e));
            }

            // Particules d'éclaboussure au sol (Stage 2)
            if (typeof createSplatParticles === 'function') {
                createSplatParticles(this.x, this.y, this.splatColor, 8);
            }
        }

        // --- TRAJECTOIRE 3D (Effet de profondeur et d'arc parabolique) ---
        // Déplacement linéaire sur l'axe X (vers la cible)
        this.x = this.startX + (this.targetX - this.startX) * progress;

        // Axe Y + Effet de parabole (la tomate vole en cloche puis redescend vers la cible)
        const arcHeight = 250; // Hauteur de l'arc en pixels
        const arc = Math.sin(progress * Math.PI) * arcHeight;
        this.y = this.startY + (this.targetY - this.startY) * progress - arc;

        // Réduction de la taille de la tomate au fil du vol (elle s'éloigne vers l'arrière-plan)
        // L'utilisation de Math.pow(progress, 1.5) rend le rapetissement plus naturel visuellement
        this.scale = this.startScale - (this.startScale - this.endScale) * Math.pow(progress, 1.5);
    }

    checkCollision(player) {
        if (this.state !== 'flying' || !this.active || !player) return false;

        // --- GESTION 3D DES COLLISIONS ---
        // La tomate ne peut toucher le joueur que si elle est sur le MÊME PLAN DE PROFONDEUR
        // C'est-à-dire si elle est presque arrivée sur le joueur
        const progress = this.timeAlive / this.duration;
        if (progress < 0.75 || progress > 0.95) return false; // Elle vole au-dessus ou a déjà tapé le sol derrière

        const currentRadius = this.radius * this.scale;

        const playerLeft = player.x - player.width / 2;
        const playerRight = player.x + player.width / 2;
        const playerTop = player.y;
        const playerBottom = player.y + player.height;

        const closestX = Math.max(playerLeft, Math.min(this.x, playerRight));
        const closestY = Math.max(playerTop, Math.min(this.y, playerBottom));

        const dx = this.x - closestX;
        const dy = this.y - closestY;

        return (dx * dx + dy * dy) <= currentRadius * currentRadius;
    }

    draw(ctx) {
        if (!this.active) return;

        // Contrairement au joueur, la tomate utilise "this.scale" (pour la 3D) et "this.radius"
        // On définit la taille finale du dessin sur l'écran
        const size = this.radius * 5 * this.scale; 

        // Gestion de l'image (frame) selon l'état de la tomate
        let frame = 0; // Index par défaut (en vol)
        
        if (this.state === 'missed') {
            // Animation de flaque au sol (frames 8 à 10)
            let tacheFrame = 8 + Math.floor(this.splatterTimer * 10); // L'animation avance toutes les 0.1s
            
            // Bloque sur la dernière frame jusqu'à disparition
            if (tacheFrame > 10) tacheFrame = 10; 
            
            frame = tacheFrame;
        } else {
            // ANIMATION EN VOL : Alterne très vite entre la première et la deuxième case
            frame = Math.floor(this.timeAlive * 10) % 2; 
        }

        const spriteAsset = this.isRotten ? assets.tomatePourrie : assets.tomate;
        const drawn = drawSpriteFrame(
            ctx,
            spriteAsset,
            frame, // On utilise la frame calculée en direct !
            this.x - size / 2, // Coordonnée X centrée
            this.y - size / 2, // Coordonnée Y centrée
            size, // Largeur finale
            size, // Hauteur finale
            4, // cols : L'image a 4 colonnes
            4, // rows : L'image a en réalité 4 lignes (grille 4x4)
            false // isFlipped : pas d'effet miroir pour une tomate
        );

        if (drawn) return; // Si le dessin a marché, on s'arrête ici.

        // ----- CODE DE SECOURS (Si l'image ne charge pas) -----
        const currentRadius = this.radius * this.scale;
        ctx.beginPath();
        ctx.arc(this.x, this.y, currentRadius, 0, Math.PI * 2);
        ctx.fillStyle = this.isRotten ? '#151515' : '#ff0000';
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = this.isRotten ? '#5f6b3a' : '#800000';
        ctx.stroke();

        if (this.isRotten) {
            ctx.beginPath();
            ctx.arc(this.x - currentRadius * 0.2, this.y - currentRadius * 0.25, currentRadius * 0.22, 0, Math.PI * 2);
            ctx.fillStyle = '#667a36';
            ctx.fill();
        }
    }
}
