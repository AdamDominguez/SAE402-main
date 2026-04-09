class Pendulum {
    constructor(anchorX, anchorY) {
        this.anchorX = anchorX;
        this.anchorY = anchorY;
        this.length = 150; // longueur de corde par défaut

        // Propriétés Verlet pour la pierre (masse)
        this.x = anchorX;
        this.y = anchorY + this.length;
        this.oldX = this.x;
        this.oldY = this.y;

        this.radius = 20; // Taille de la pierre
        this.gravity = 1800; // Gravité vers le bas
        this.damping = 0.99; // Résistance de l'air

        this.hitCooldown = 0;
    }

    update(dt, anchorX, anchorY) {
        // Met à jour l'ancrage pour suivre le cou du joueur
        this.anchorX = anchorX;
        this.anchorY = anchorY;

        // Intégration de Verlet
        const vx = (this.x - this.oldX) * this.damping;
        const vy = (this.y - this.oldY) * this.damping;

        this.oldX = this.x;
        this.oldY = this.y;

        // Applique les forces
        this.x += vx;
        this.y += vy + this.gravity * dt * dt; // La gravité est une accélération, donc dt^2

        // Contrainte : la distance à l'ancrage doit valoir exactement `length`
        const dx = this.x - this.anchorX;
        const dy = this.y - this.anchorY;
        const distance = Math.hypot(dx, dy);

        const difference = this.length - distance;
        const percent = difference / distance / 2; // ajuste de moitié (ancrage fixe, donc correction complète)

        const offsetX = dx * (difference / distance);
        const offsetY = dy * (difference / distance);

        this.x += offsetX;
        this.y += offsetY;

        // Temps de recharge des dégâts
        if (this.hitCooldown > 0) {
            this.hitCooldown -= dt;
        }
    }

    checkCollisionWithPlayer(player) {
        if (this.hitCooldown > 0) return;

        // Si la pierre balance trop haut ou touche les limites du joueur
        // Vérification simple : angle trop extrême
        const dx = this.x - this.anchorX;
        const dy = this.y - this.anchorY;
        const angle = Math.atan2(dx, dy); // 0 = tout droit vers le bas, en radians

        // Si elle dépasse 95 degrés (≈ 1.658 radians)
        if (Math.abs(angle) > 1.658) {
            if (player.state !== 'falling') {
                player.triggerFall();
            }
        }
        // Sinon, si elle dépasse ~60 degrés (≈ 1.05 radians)
        else if (Math.abs(angle) > 1.1) {
            shame += 5; // Dégâts
            this.hitCooldown = 0.5; // Recharge de 0,5 s

            // Vibration plus forte pour l'impact de la pierre (Android)
            if (navigator.vibrate) navigator.vibrate(150);

            // Retour visuel simple
            document.body.style.backgroundColor = 'rgba(255, 0, 0, 0.5)';
            setTimeout(() => document.body.style.backgroundColor = '#1a1a1a', 100);
        }
    }

    draw(ctx) {
        // Dessine la corde
        ctx.beginPath();
        ctx.moveTo(this.anchorX, this.anchorY);
        ctx.lineTo(this.x, this.y);
        ctx.strokeStyle = '#8B4513'; // Brun selle
        ctx.lineWidth = 4;
        ctx.stroke();

        const swing = this.x - this.anchorX;
        let faceFrame = 1;
        if (swing < -10) faceFrame = 0;
        if (swing > 10) faceFrame = 2;

        const drawn = drawSpriteFrame(
            ctx,
            assets.klapperstein,
            faceFrame,
            this.x - this.radius * 1.6,
            this.y - this.radius * 1.6,
            this.radius * 3.2,
            this.radius * 3.2
        );

        if (drawn) return;

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.hitCooldown > 0 ? '#ff3333' : '#696969';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#000';
        ctx.stroke();
    }
}
