// Gestion du quadrillage des sprites

function loadImage(path) {
    const image = new Image();
    image.src = encodeURI(path);
    return image;
}

function isImageReady(image) {
    return !!image && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
}

function drawSpriteFrame(ctx, image, frameIndex, dx, dy, dWidth, dHeight, cols = 3, rows = 2, flipH = false) {
    if (!isImageReady(image)) return false;
    // On divise par le bon nombre de colonnes et de lignes
    const frameWidth = image.naturalWidth / cols;
    const frameHeight = image.naturalHeight / rows;

    // On s'assure que l'index reste dans les bornes (nombre total de cases = cols * rows)
    const totalFrames = cols * rows;
    const clampedFrame = Math.max(0, Math.min(totalFrames - 1, Math.floor(frameIndex)));

    // Calcul intelligent de la colonne (X) et de la ligne (Y)
    const sx = (clampedFrame % cols) * frameWidth;
    const sy = Math.floor(clampedFrame / cols) * frameHeight;

    if (flipH) {
        ctx.save(); // On sauvegarde l'état par défaut (non-inversé)

        // On déplace le point d'origine du Canvas au centre exact de l'image de destination
        ctx.translate(dx + dWidth / 2, dy + dHeight / 2);
        // On inverse l'axe horizontal, ce qui va tout dessiner "en miroir"
        ctx.scale(-1, 1);

        // On dessine l'image avec des coordonnées relatives au centre (puisqu'on a déplacé l'origine)
        ctx.drawImage(
            image,
            sx, sy, frameWidth, frameHeight,
            -dWidth / 2, -dHeight / 2, dWidth, dHeight
        );

        ctx.restore(); // On annule l'inversion et la translation pour ne pas que le reste du jeu dessine à l'envers !
    } else {
        // Comportement normal
        ctx.drawImage(
            image,
            sx,
            sy,
            frameWidth,
            frameHeight,
            dx,
            dy,
            dWidth,
            dHeight
        );
    }

    return true;
}
