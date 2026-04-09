class Fragment {
    constructor() {
        // Le fragment aura une dimension raisonnable à l'écran
        this.width = 60;
        this.height = 60;

        // Apparition aléatoire en haut, au-dessus de l'écran visible
        this.x = Math.random() * (canvas.width - this.width) + this.width / 2;
        this.y = -100;

        // Vitesse de chute modérée et facile à attraper (pixels par seconde)
        this.vy = 120;
        this.active = true;
    }

    update(dt) {
        if (!this.active) return;
        this.y += this.vy * dt;

        // Si le joueur le manque et que le fragment tombe tout en bas de l'écran :
        // Il se désactive, ce qui signalera à main.js de relancer un délai de 15 secondes
        if (this.y > canvas.height + 100) {
            this.active = false;
        }
    }

    checkCollision(player) {             // Teste de collision rectangle contre rectangle 
        if (!this.active || !player) return false;

        const playerLeft = player.x - player.width / 2;
        const playerRight = player.x + player.width / 2;
        const playerTop = player.y;
        const playerBottom = player.y + player.height;

        const thisLeft = this.x - this.width / 2;
        const thisRight = this.x + this.width / 2;
        const thisTop = this.y - this.height / 2;
        const thisBottom = this.y + this.height / 2;

        return !(playerLeft > thisRight ||
            playerRight < thisLeft ||
            playerTop > thisBottom ||
            playerBottom < thisTop);
    }

    draw(ctx) {
        if (!this.active) return;

        if (assets.fragment && assets.fragment.complete && assets.fragment.naturalWidth > 0) {
            ctx.drawImage(
                assets.fragment,
                this.x - this.width / 2,
                this.y - this.height / 2,
                this.width,
                this.height
            );
        } else {
            // Code de secours si l'image n'est pas chargée 
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);
        }
    }
}
