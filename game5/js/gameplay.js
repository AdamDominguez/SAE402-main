// ==================== Importations ====================
import {
    canvas,
    ctx,
    bgCanvas,
    bgCtx,
    bossCols,
    BOSS_OFFSET_Y,
    playerCols,
    playerRows,
    PLAYER_OFFSET_Y,
    pierreCols,
    pierreRows,
    gravity,
    friction,
    platform,
    controls,
    pauseBtn
} from "./config.js";
import {
    bgImage,
    bgStormImage,
    bossSpriteDeplacement,
    bossSpriteSaut,
    bossSpritePierre,
    bossSpritePioche,
    bossSpriteMort,
    playerSprite,
    playerDegatSprite,
    pierreSprite,
    cloudSprite,
    stormCloudSprite
} from "./assets.js";
import { audio, startBgm, playSound, isAudioEnabled, startThunder, stopThunder } from "./audio.js";
import { player, boss, input, projectiles, particles, gameState, timepiece, sky } from "./state.js";

// ==================== État global et constantes d'ambiance ====================
let fallSoundPlayed = false;

const CLOUD_MAX_SPEED = 3.4;
const CLOUD_TILT_ACCEL = 4.2;
const CLOUD_TILT_DEADZONE = 0.04;

const clouds = Array.from({ length: 6 }, (_, index) => {
    const scale = 0.55 + Math.random() * 0.75;
    return {
        x: Math.random() * bgCanvas.width,
        y: 22 + Math.random() * 140,
        scale,
        speed: 0.2 + Math.random() * 0.25,
        alpha: 0.45 + Math.random() * 0.35,
        width: 130 * scale,
        height: 75 * scale,
        tiltFactor: 0.9 + (index % 3) * 0.35
    };
});

const rainDrops = Array.from({ length: 170 }, () => ({
    x: Math.random() * bgCanvas.width,
    y: Math.random() * bgCanvas.height,
    len: 10 + Math.random() * 10,
    speed: 7 + Math.random() * 6
}));

// ==================== Easter egg : triple tap sur un nuage ====================
let cloudTapCount = 0;
let lastCloudTapTime = 0;
const CLOUD_TAP_DELAY_MS = 500; // Temps max entre deux clics (500ms)
const cloudInputCanvas = canvas;

function getPointerCanvasPos(clientX, clientY) {
    const rect = cloudInputCanvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
        x: (clientX - rect.left) * (bgCanvas.width / rect.width),
        y: (clientY - rect.top) * (bgCanvas.height / rect.height)
    };
}

function isCloudHit(x, y) {
    for (let i = clouds.length - 1; i >= 0; i--) {
        const c = clouds[i];
        if (x >= c.x && x <= c.x + c.width && y >= c.y && y <= c.y + c.height) {
            return true;
        }
    }
    return false;
}

function handleCloudPointerDown(event) {
    if (event.pointerType && event.pointerType !== "touch") return;
    const pos = getPointerCanvasPos(event.clientX, event.clientY);
    if (!pos) return;

    if (!gameState.gameStarted || gameState.gameOver || gameState.victory || boss.hp <= 0) {
        return;
    }

    if (isCloudHit(pos.x, pos.y)) {
        const now = Date.now();
        if (now - lastCloudTapTime < CLOUD_TAP_DELAY_MS) {
            cloudTapCount++;
        } else {
            cloudTapCount = 1;
        }
        lastCloudTapTime = now;

        if (cloudTapCount >= 3) {
            devKillBoss(); // Déclenche la mort instantanée du boss
            cloudTapCount = 0;
        }
    }
}

cloudInputCanvas.addEventListener("pointerdown", handleCloudPointerDown);

// ==================== Rendu du décor (ciel, nuages, pluie) ====================

function drawBackgroundLayer() {
    const currentBg = sky.isStorm ? bgStormImage : bgImage;
    const currentCloudSprite = sky.isStorm ? stormCloudSprite : cloudSprite;

    if (currentBg.complete && currentBg.naturalWidth > 0) {
        bgCtx.drawImage(currentBg, 0, 0, bgCanvas.width, bgCanvas.height);
    } else {
        bgCtx.fillStyle = "#87CEEB";
        bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
    }

    if (currentCloudSprite.complete && currentCloudSprite.naturalWidth > 0) {
        for (let i = 0; i < clouds.length; i++) {
            const cloud = clouds[i];
            const tilt = Math.abs(sky.cloudTilt) < CLOUD_TILT_DEADZONE ? 0 : sky.cloudTilt;
            const tiltAbs = Math.abs(tilt);
            const tiltBoost = tiltAbs * tiltAbs * CLOUD_TILT_ACCEL * cloud.tiltFactor;
            const baseDrift = cloud.speed + tiltBoost;
            let drift = tilt === 0 ? cloud.speed : Math.sign(tilt) * baseDrift;

            if (drift > CLOUD_MAX_SPEED) drift = CLOUD_MAX_SPEED;
            if (drift < -CLOUD_MAX_SPEED) drift = -CLOUD_MAX_SPEED;

            cloud.x += drift;

            if (cloud.x > bgCanvas.width + cloud.width) {
                cloud.x = -cloud.width;
            } else if (cloud.x < -cloud.width) {
                cloud.x = bgCanvas.width + cloud.width;
            }

            bgCtx.save();
            bgCtx.globalAlpha = cloud.alpha;
            bgCtx.drawImage(
                currentCloudSprite,
                Math.round(cloud.x),
                Math.round(cloud.y),
                Math.round(cloud.width),
                Math.round(cloud.height)
            );
            bgCtx.restore();
        }
    }

    if (!sky.isStorm) return;

    bgCtx.save();
    bgCtx.strokeStyle = "rgba(210, 230, 255, 0.55)";
    bgCtx.lineWidth = 1.3;

    for (let i = 0; i < rainDrops.length; i++) {
        const d = rainDrops[i];
        d.x += sky.cloudTilt * 2.4;
        d.y += d.speed;

        if (d.y > bgCanvas.height + d.len) {
            d.y = -d.len;
            d.x = Math.random() * bgCanvas.width;
        }
        if (d.x < -20) d.x = bgCanvas.width + 20;
        if (d.x > bgCanvas.width + 20) d.x = -20;

        bgCtx.beginPath();
        bgCtx.moveTo(Math.round(d.x), Math.round(d.y));
        bgCtx.lineTo(Math.round(d.x + sky.cloudTilt * 5), Math.round(d.y + d.len));
        bgCtx.stroke();
    }

    bgCtx.restore();
}

function getBossSpriteSheet() {
    if (boss.hp <= 0) return bossSpriteMort;
    if (!boss.isGrounded) return bossSpriteSaut;
    if (boss.state === "range") return bossSpritePierre;
    if (boss.state === "melee") return bossSpritePioche;
    return bossSpriteDeplacement;
}

function getBossSpriteMode() {
    if (boss.hp <= 0) return "death";
    if (!boss.isGrounded) return "jump";
    if (boss.state === "range") return "range";
    if (boss.state === "melee") return "melee";
    if (boss.state === "chase" && Math.abs(boss.vx) > 0.5) return "move";
    return "idle";
}

function syncBossSpriteMode() {
    const nextMode = getBossSpriteMode();
    if (boss.spriteMode !== nextMode) {
        boss.spriteMode = nextMode;
    }
}

// ==================== Constantes d'animation (boss + cinématique victoire) ====================
const BOSS_RENDER_WIDTH = 96;
const BOSS_RENDER_HEIGHT = 96;
const BOSS_ATTACK_ANIM_DURATION = bossCols * 8;
const BOSS_DEATH_COLS = bossCols;
const BOSS_DEATH_FRAME_DURATION = 7;
const BOSS_DEATH_HOLD_FRAMES = 0;
const BOSS_DEATH_RENDER_WIDTH = 120;
const BOSS_DEATH_RENDER_HEIGHT = 84;

const FINAL_THROW_DURATION = 1450;
const FINAL_THROW_END = 2500;
const FINAL_MERGE_END = 3650;
const FINAL_FLASH_START = 3950;
const FINAL_FLASH_END = 4550;
const FINAL_REVEAL_END = 6100;
const FINAL_DIALOGUE_END = 7600;
const FINAL_PIECE_SCALE = 0.33;
const FINAL_ROTATION_START = 80;
const FINAL_CHRONOROUAGE_DELAY = 1400;

// ==================== État interne de la cinématique finale ====================
const victoryCinematic = {
    active: false,
    startTime: 0,
    centerX: 0,
    centerY: 0,
    pieces: [],
    pieceImages: [],
    chronoImage: null,
    rotationSfxPlayed: false,
    chronoRevealSfxPlayed: false,
    finalFlash: 0,
    phase: "sequence"
};

// ==================== Éléments DOM de la conclusion ====================
const finalDialogueOverlay = document.getElementById("finalDialogue");
const finalDialogueText = document.getElementById("finalDialogueText");
const finalDialogueNext = document.getElementById("finalDialogueNext");
let finalDialoguePromptTimer = null;
let lastVictoryCinematicInputAt = 0;

// ==================== Gestion de l'overlay de dialogue final ====================
function showFinalDialogueOverlay() {
    if (!finalDialogueOverlay || !finalDialogueText) return;

    finalDialogueOverlay.style.display = "flex";
    finalDialogueText.innerText = "Mulhouse has regained its temporal balance!";

    if (typeof stopDialogueAudio === "function") {
        stopDialogueAudio();
    }

    if (finalDialogueNext) finalDialogueNext.classList.remove("is-visible");

    if (typeof dialogue === "function") {
        dialogue("#finalDialogueText", { playAudio: true, audioId: "dialogue_son" });
    }

    if (finalDialoguePromptTimer) clearTimeout(finalDialoguePromptTimer);
    finalDialoguePromptTimer = setTimeout(() => {
        if (finalDialogueNext) finalDialogueNext.classList.add("is-visible");
    }, finalDialogueText.innerText.length * 50 + 150);
}

function hideFinalDialogueOverlay() {
    if (finalDialogueOverlay) finalDialogueOverlay.style.display = "none";
    if (finalDialogueNext) finalDialogueNext.classList.remove("is-visible");

    if (finalDialoguePromptTimer) {
        clearTimeout(finalDialoguePromptTimer);
        finalDialoguePromptTimer = null;
    }
}

// ==================== Outils mathématiques (interpolation/easing) ====================
function clamp01(v) {
    if (v < 0) return 0;
    if (v > 1) return 1;
    return v;
}

function easeOutCubic(t) {
    const x = clamp01(t);
    return 1 - Math.pow(1 - x, 3);
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

// ==================== Cycle de vie de la cinématique de victoire ====================
function initVictoryCinematic() {
    victoryCinematic.active = true;
    victoryCinematic.startTime = performance.now();
    victoryCinematic.centerX = canvas.width / 2;
    victoryCinematic.centerY = canvas.height / 2;
    victoryCinematic.rotationSfxPlayed = false;
    victoryCinematic.chronoRevealSfxPlayed = false;
    victoryCinematic.finalFlash = 0;
    victoryCinematic.phase = "sequence";
    gameState.victoryCinematicDone = false;
    sky.isStorm = true;
    hideFinalDialogueOverlay();

    // Repositionne le heros pour cadrer la scene sur la plateforme du combat.
    player.x = platform.x + 140;
    player.y = platform.y - player.height;
    player.vx = 0;
    player.vy = 0;
    player.isGrounded = true;
    player.direction = 1;
    player.isAttacking = false;

    const sources = ["img/piece1.png", "img/piece2.png", "img/piece3.png", "img/piece4.png", "img/piece5.png"];
    victoryCinematic.pieceImages = sources.map((src) => {
        const img = new Image();
        img.src = src;
        img.crossOrigin = "anonymous";
        return img;
    });

    const chronoImage = new Image();
    chronoImage.src = "img/chronorouage.png";
    chronoImage.crossOrigin = "anonymous";
    victoryCinematic.chronoImage = chronoImage;

    console.log("[VictoryCinematic] Initialized at", new Date().toISOString());

    const launchX = player.x + player.width + 12;
    const launchY = player.y + 10;

    victoryCinematic.pieces = sources.map((_, index) => {
        const angle = -Math.PI / 2 + (index * Math.PI * 2) / sources.length;
        return {
            delay: index * 180,
            startX: launchX,
            startY: launchY,
            arcX: victoryCinematic.centerX + Math.cos(angle) * 150,
            arcY: victoryCinematic.centerY - 90 + Math.sin(angle) * 28,
            targetX: victoryCinematic.centerX,
            targetY: victoryCinematic.centerY,
            spinOffset: index * 0.8
        };
    });

    timepiece.active = false;
}

function getVictoryElapsed() {
    return performance.now() - victoryCinematic.startTime;
}

function updateVictoryCinematicState() {
    if (!victoryCinematic.active) return;

    const elapsed = getVictoryElapsed();

    // Log every 1 second to track animation progress
    if (elapsed > 0 && Math.round(elapsed) % 1000 === 0 && victoryCinematic.phase === "sequence") {
        console.log(`[VictoryCinematic] Running... ${Math.round(elapsed)}ms / ${FINAL_DIALOGUE_END}ms`);
    }

    if (!victoryCinematic.rotationSfxPlayed && elapsed >= FINAL_ROTATION_START) {
        console.log("[VictoryCinematic] Playing rotation sound at", elapsed, "ms");
        playSound("rotation");
        victoryCinematic.rotationSfxPlayed = true;
    }

    if (!victoryCinematic.chronoRevealSfxPlayed && elapsed >= FINAL_MERGE_END + FINAL_CHRONOROUAGE_DELAY) {
        console.log("[VictoryCinematic] Playing chronorouage sound at", elapsed, "ms");
        if (audio.rotation) {
            audio.rotation.pause();
            audio.rotation.currentTime = 0;
        }
        playSound("chronorouage");
        victoryCinematic.chronoRevealSfxPlayed = true;
    }

    if (elapsed >= FINAL_FLASH_END) {
        sky.isStorm = false;
    }

    if (elapsed >= FINAL_DIALOGUE_END && victoryCinematic.phase === "sequence") {
        console.log("[VictoryCinematic] Transitioning to dialogue phase at", elapsed, "ms");
        victoryCinematic.phase = "dialogue";
        showFinalDialogueOverlay();
    }
}

function advanceVictoryCinematic() {
    if (!victoryCinematic.active || !gameState.victory) return false;

    const elapsed = getVictoryElapsed();
    if (elapsed < FINAL_DIALOGUE_END) return true;

    if (victoryCinematic.phase === "dialogue") {
        hideFinalDialogueOverlay();
        victoryCinematic.phase = "final";
        return true;
    }

    if (victoryCinematic.phase === "final") {
        if (!gameState.victoryCinematicDone) {
            gameState.victoryCinematicDone = true;
            if (window.signalVictory) window.signalVictory();
            if (window.signalGameState) window.signalGameState('menu', 'victory');
        } else {
            if (window.signalContinueAdventure) window.signalContinueAdventure();
        }
        return true;
    }

    return false;
}

function handleVictoryCinematicPointer(event) {
    if (!gameState.victory || !victoryCinematic.active) return;

    // Toujours consommer les clics pendant la cinematique pour eviter les conflits avec les controles.
    event.preventDefault();
    event.stopImmediatePropagation();

    const now = Date.now();
    if (now - lastVictoryCinematicInputAt < 280) return;
    lastVictoryCinematicInputAt = now;

    advanceVictoryCinematic();
}

window.addEventListener("touchstart", handleVictoryCinematicPointer, { capture: true, passive: false });

// ==================== Rendu de la cinématique de victoire ====================
function drawVictoryCinematic() {
    if (!victoryCinematic.active) return;

    const elapsed = getVictoryElapsed();
    const centerX = victoryCinematic.centerX;
    const centerY = victoryCinematic.centerY;

    if (elapsed === 0) {
        console.log("[drawVictoryCinematic] Started rendering");
    }

    const showPieces = elapsed < FINAL_FLASH_START;

    if (showPieces) {
        victoryCinematic.pieces.forEach((piece, index) => {
            const img = victoryCinematic.pieceImages[index];
            const throwT = clamp01((elapsed - piece.delay) / FINAL_THROW_DURATION);
            const throwEase = easeOutCubic(throwT);

            let x = lerp(piece.startX, piece.arcX, throwEase);
            let y = lerp(piece.startY, piece.arcY, throwEase) - Math.sin(throwT * Math.PI) * 105;

            if (elapsed > FINAL_THROW_END) {
                const assembleT = clamp01((elapsed - FINAL_THROW_END) / (FINAL_MERGE_END - FINAL_THROW_END));
                const aEase = easeOutCubic(assembleT);
                x = lerp(piece.arcX, piece.targetX, aEase);
                y = lerp(piece.arcY, piece.targetY, aEase);
            }

            const spin = elapsed * 0.01 + piece.spinOffset;
            const assembleProgress = elapsed > FINAL_THROW_END
                ? clamp01((elapsed - FINAL_THROW_END) / (FINAL_MERGE_END - FINAL_THROW_END))
                : 0;
            const rotation = lerp(spin, 0, easeOutCubic(assembleProgress));

            const sourceW = img && img.naturalWidth > 0 ? img.naturalWidth : 128;
            const sourceH = img && img.naturalHeight > 0 ? img.naturalHeight : 128;
            const drawScale = FINAL_PIECE_SCALE;
            const drawW = Math.round(sourceW * drawScale);
            const drawH = Math.round(sourceH * drawScale);

            ctx.save();
            ctx.translate(Math.round(x), Math.round(y));
            ctx.rotate(rotation);

            if (img && img.complete && img.naturalWidth > 0) {
                ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
            } else {
                // Fallback: afficher un rectangle jaune doré si l'image ne charge pas
                const fallbackSize = Math.max(drawW, drawH);
                ctx.fillStyle = "#f5d77c";
                ctx.fillRect(-fallbackSize / 2, -fallbackSize / 2, fallbackSize, fallbackSize);
                ctx.strokeStyle = "#d4af37";
                ctx.lineWidth = 2;
                ctx.strokeRect(-fallbackSize / 2, -fallbackSize / 2, fallbackSize, fallbackSize);
                console.warn(`[drawVictoryCinematic] Image piece${index + 1} not loaded (url: ${victoryCinematic.pieceImages[index].src})`);
            }
            ctx.restore();
        });
    }

    const flashProgress = clamp01((elapsed - FINAL_FLASH_START) / (FINAL_FLASH_END - FINAL_FLASH_START));
    if (flashProgress > 0) {
        const pulse = flashProgress < 0.45
            ? flashProgress / 0.45
            : 1 - ((flashProgress - 0.45) / 0.55) * 0.8;
        victoryCinematic.finalFlash = Math.max(victoryCinematic.finalFlash, clamp01(pulse));
    }

    if (victoryCinematic.finalFlash > 0) {
        ctx.save();
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, victoryCinematic.finalFlash)})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
        victoryCinematic.finalFlash = Math.max(0, victoryCinematic.finalFlash - 0.06);
    }

    const revealT = clamp01((elapsed - FINAL_FLASH_END) / (FINAL_REVEAL_END - FINAL_FLASH_END));
    if (revealT > 0) {

        const img = victoryCinematic.chronoImage;
        const revealEase = easeOutCubic(revealT);
        const sourceW = img && img.naturalWidth > 0 ? img.naturalWidth : 256;
        const sourceH = img && img.naturalHeight > 0 ? img.naturalHeight : 256;
        const heroReferenceSize = Math.max(player.width, player.height) * 2;
        const chronoMaxSize = Math.round(heroReferenceSize * 1.2);
        const baseScale = chronoMaxSize / Math.max(sourceW, sourceH);
        const drawScale = baseScale * (0.9 + revealEase * 0.1);
        const drawW = Math.round(sourceW * drawScale);
        const drawH = Math.round(sourceH * drawScale);

        ctx.save();
        ctx.globalAlpha = revealEase;
        ctx.shadowColor = "rgba(255, 244, 188, 0.95)";
        ctx.shadowBlur = 30 + revealEase * 28;

        if (img && img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, Math.round(centerX - drawW / 2), Math.round(centerY - drawH / 2), drawW, drawH);
        } else {
            ctx.fillStyle = "#f5d77c";
            ctx.beginPath();
            ctx.arc(Math.round(centerX), Math.round(centerY), Math.round(50 + revealEase * 22), 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#d4af37";
            ctx.lineWidth = 2;
            ctx.stroke();
            console.warn("[drawVictoryCinematic] Chronorouage image not loaded (url: img/chronorouage.png)");
        }
        ctx.restore();

        ctx.save();
        ctx.globalAlpha = revealEase;
        ctx.textAlign = "center";
        ctx.fillStyle = "#fff6cc";
        ctx.font = "700 30px 'Chakra Petch', sans-serif";
        ctx.fillText("Mulhouse is stable again and shines anew!", canvas.width / 2, Math.round(centerY + drawH / 2 + 48));
        ctx.textAlign = "left";
        ctx.restore();
    }

    if (victoryCinematic.phase === "final") {
        ctx.save();
        ctx.fillStyle = "rgba(4, 8, 12, 0.78)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.textAlign = "center";
        ctx.fillStyle = "#ffd66b";
        ctx.font = "54px 'Bungee', sans-serif";
        ctx.fillText("THE END", canvas.width / 2, 180);

        ctx.fillStyle = "#f3fbff";
        ctx.font = "700 33px 'Chakra Petch', sans-serif";
        ctx.fillText("Mulhouse and its history are saved!", canvas.width / 2, 250);
        ctx.fillText("Thank you for playing.", canvas.width / 2, 300);
    }
}

// ==================== Remise à zéro complète de la partie ====================
export function resetGame() {
    audio.win.pause();
    audio.win.currentTime = 0;
    audio.lose.pause();
    audio.lose.currentTime = 0;
    audio.loseBgm.pause();
    audio.loseBgm.currentTime = 0;
    if (audio.rotation) {
        audio.rotation.pause();
        audio.rotation.currentTime = 0;
    }
    if (audio.chronorouage) {
        audio.chronorouage.pause();
        audio.chronorouage.currentTime = 0;
    }
    startBgm({ restart: true });
    playSound("spawn");
    playSound("fight");
    timepiece.active = false;
    timepiece.floatTimer = 0;
    sky.isStorm = true;
    sky.flashAlpha = 0;
    sky.flashStage = 0;
    victoryCinematic.active = false;
    victoryCinematic.pieces = [];
    victoryCinematic.pieceImages = [];
    victoryCinematic.chronoImage = null;
    victoryCinematic.rotationSfxPlayed = false;
    victoryCinematic.chronoRevealSfxPlayed = false;
    victoryCinematic.finalFlash = 0;
    victoryCinematic.phase = "sequence";
    hideFinalDialogueOverlay();

    controls.style.display = "flex";
    if (pauseBtn) pauseBtn.style.display = "block";

    player.lives = 5;
    player.x = 200;
    player.y = 100;
    player.vx = 0;
    player.vy = 0;
    player.invulnerable = 60;
    player.frameX = 0;
    player.frameY = 0;
    player.frameTimer = 0;
    player.isAttacking = false;
    player.isHurt = false;
    player.isDead = false;

    boss.hp = boss.maxHp;
    boss.x = 700;
    boss.y = 100;
    boss.vx = 0;
    boss.vy = 0;
    boss.state = "idle";
    boss.frameX = 0;
    boss.frameTimer = 0;
    boss.spriteMode = "move";
    boss.isAttacking = false;
    boss.invulnerable = 0;
    boss.deathStarted = false;
    boss.deathResolved = false;
    boss.deathHoldTimer = 0;

    projectiles.length = 0;
    particles.length = 0;
    gameState.gameOver = false;
    gameState.victory = false;
    gameState.victoryCinematicDone = false;
    gameState.isPaused = false;
    gameState.lastEvilLaughTime = 0;
}

// ==================== Utilitaires de gameplay (particules, collisions, attaques) ====================
function spawnParticles(x, y, color) {
    for (let i = 0; i < 8; i++) {
        particles.push({
            x,
            y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            life: 24 + Math.random() * 16,
            maxLife: 40,
            color
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += gravity * 0.5;
        p.life--;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function loseLife() {
    if (player.invulnerable > 0 || player.isDead) return;
    player.lives--;
    player.invulnerable = 60;
    if (player.lives <= 0) {
        player.isDead = true;
        player.frameX = 0;
        player.frameY = 2;
        player.vx = 0;
        audio.bgm.pause();
        playSound("deadHero");
        playSound("criDeadHero");
    } else {
        player.isHurt = true;
        player.hurtTimer = 25;
        player.frameX = 0;
        player.frameY = 0;
        player.isAttacking = false;
        playSound("hit");
    }
}

function respawnPlayerCenter() {
    playSound("spawn");
    player.x = canvas.width / 2 - player.width / 2;
    player.y = platform.y - player.height;
    player.vx = 0;
    player.vy = 0;
    player.isGrounded = true;
    player.isAttacking = false;
    player.isHurt = false;
    player.frameX = 0;
    player.frameY = 0;
    player.frameTimer = 0;
    player.invulnerable = Math.max(player.invulnerable, 60);
    fallSoundPlayed = false;
}

function playerAttack() {
    let hitBoss = false;
    let hitStone = false;
    const hitbox = { x: player.direction === 1 ? player.x + player.width : player.x - 40, y: player.y + 10, width: 40, height: 20 };
    if (boss.hp > 0 && boss.invulnerable <= 0 && checkRectCollision(hitbox, boss)) {
        boss.invulnerable = 30;
        playSound("epee");
        playSound("bossHurt");
        hitBoss = true;

        // Every valid hit must remove HP; only knockback behavior stays random.
        boss.hp = Math.max(0, boss.hp - 1);

        if (Math.random() < 0.2) {
            boss.vx = -boss.direction * 15;
            boss.state = "idle";
        } else {
            applyKnockback(boss, player.direction, 12);
        }
    }

    for (let i = projectiles.length - 1; i >= 0; i--) {
        if (checkRectCollision(hitbox, projectiles[i])) {
            const p = projectiles[i];
            spawnParticles(p.x + p.width / 2, p.y + p.height / 2, "#95a5a6");
            projectiles.splice(i, 1);
            hitStone = true;
        }
    }

    if (!hitBoss && !hitStone) {
        playSound("swoosh");
    } else if (!hitBoss && hitStone) {
        playSound("epee");
    }
}

function bossAttackMelee() {
    playSound("bossHit");
    const hitbox = { x: boss.direction === 1 ? boss.x + boss.width : boss.x - 50, y: boss.y + 10, width: 50, height: 40 };
    if (player.invulnerable === 0 && !player.isDead && checkRectCollision(hitbox, player)) {
        applyKnockback(player, boss.direction, 10);
        loseLife();
    }
}

function bossAttackRange() {
    playSound("throw");
    projectiles.push({
        x: boss.direction === 1 ? boss.x + boss.width : boss.x - 20,
        y: boss.y + 5,
        width: 25,
        height: 25,
        vx: boss.direction * 5,
        vy: 0,
        frameX: 0,
        frameY: 0,
        frameTimer: 0
    });
}

function applyKnockback(target, direction, force) {
    target.vx = force * direction;
    target.vy = -6;
    target.isGrounded = false;
    spawnParticles(target.x + target.width / 2, target.y + target.height / 2, "#e74c3c");
}

function checkRectCollision(r1, r2) {
    return r1.x < r2.x + r2.width && r1.x + r1.width > r2.x && r1.y < r2.y + r2.height && r1.y + r1.height > r2.y;
}

function checkPlatform(ent) {
    if (ent.vy > 0 && ent.x < platform.x + platform.width && ent.x + ent.width > platform.x && ent.y + ent.height >= platform.y && ent.y + ent.height <= platform.y + ent.vy + 2) {
        ent.isGrounded = true;
        ent.vy = 0;
        ent.y = platform.y - ent.height;
    }
}

// ==================== Boucle d'update (physique, IA, victoire/défaite) ====================
export function update() {
    if (!gameState.gameStarted || gameState.isPaused || gameState.gameOver) return;
    if (gameState.victory) {
        updateVictoryCinematicState();
        return;
    }

    if (player.invulnerable > 0) player.invulnerable--;
    if (player.attackCooldown > 0) player.attackCooldown--;

    if (player.isDead) {
        player.vx *= friction;
        player.x += player.vx;
        const playerGravity = gravity * 0.81;
        player.vy += playerGravity;
        player.y += player.vy;
        checkPlatform(player);
        player.frameTimer++;
        if (player.frameTimer > 8) {
            player.frameTimer = 0;
            if (player.frameX < 7) {
                player.frameX++;
            } else if (!gameState.gameOver) {
                gameState.gameOver = true;
                if (isAudioEnabled()) {
                    audio.loseBgm.currentTime = 0;
                    audio.loseBgm.play();
                }
                playSound("lose");

                controls.style.display = "none";
                if (pauseBtn) pauseBtn.style.display = "none";
            }
        }
    } else if (player.isHurt) {
        player.vx *= friction;
        player.x += player.vx;
        const playerGravity = gravity * 0.81;
        player.vy += playerGravity;
        player.y += player.vy;
        checkPlatform(player);
        player.hurtTimer--;
        if (player.hurtTimer <= 0) player.isHurt = false;
        player.frameTimer++;
        if (player.frameTimer > player.frameDuration) {
            player.frameTimer = 0;
            player.frameX = (player.frameX + 1) % 8;
        }
    } else {
        if (!player.isAttacking) {
            const maxSpeed = 3.6;
            const accel = 0.8;
            if (Math.abs(player.vx) < maxSpeed) {
                if (input.left) {
                    player.vx -= accel;
                    player.direction = -1;
                }
                if (input.right) {
                    player.vx += accel;
                    player.direction = 1;
                }
            }
        }
        player.vx *= friction;
        player.x += player.vx;
        if (input.jump && player.isGrounded && !player.isAttacking) {
            player.vy = player.jumpPower;
            player.isGrounded = false;
            spawnParticles(player.x + player.width / 2, player.y + player.height, "#ecf0f1");
            playSound("jumpHero");
        }
        const playerGravity = gravity * 0.81;
        player.vy += playerGravity;
        player.y += player.vy;

        if (input.attack && player.attackCooldown === 0 && !player.isAttacking) {
            player.isAttacking = true;
            player.attackCooldown = 30;
            player.frameX = 0;
            player.frameY = 3;
            player.frameTimer = 0;
        }

        player.frameTimer++;
        const curDur = (!player.isGrounded && !player.isAttacking) ? 18 : player.frameDuration;
        if (player.frameTimer >= curDur) {
            player.frameTimer = 0;
            if (player.isAttacking) {
                player.frameX++;
                if (player.frameX === 1) playerAttack();
                if (player.frameX >= 8) {
                    player.frameX = 0;
                    player.isAttacking = false;
                }
            } else {
                player.frameX = (player.frameX + 1) % 8;
                if (player.isGrounded && Math.abs(player.vx) > 0.5 && (player.frameX === 1 || player.frameX === 5)) playSound("footstep");
            }
        }

        if (!player.isAttacking) {
            if (!player.isGrounded) {
                player.frameY = 2;
                player.frameX = player.vy < 0 ? 2 : 4;
            } else if (Math.abs(player.vx) > 0.5) {
                player.frameY = 0;
            } else {
                player.frameY = 0;
                player.frameX = 0;
            }
        } else {
            player.frameY = 3;
        }
    }

    if (boss.hp <= 0 || boss.y > canvas.height) {
        boss.hp = 0;
        boss.vx = 0;
        boss.vy = 0;
        boss.isAttacking = false;
        boss.attackCooldown = 0;
        boss.actionTimer = 0;

        if (!boss.deathStarted) {
            boss.deathStarted = true;
            boss.deathResolved = false;
            boss.deathHoldTimer = 0;
            boss.state = "death";
            boss.spriteMode = "death";
            boss.frameX = 0;
            boss.frameTimer = 0;
            playSound("deadBoss");
        }

        if (!boss.deathResolved) {
            boss.frameTimer++;
            if (boss.frameTimer >= BOSS_DEATH_FRAME_DURATION) {
                boss.frameTimer = 0;
                if (boss.frameX < BOSS_DEATH_COLS - 1) {
                    boss.frameX++;
                } else {
                    boss.deathHoldTimer++;
                    if (boss.deathHoldTimer >= BOSS_DEATH_HOLD_FRAMES) {
                        boss.deathResolved = true;
                    }
                }
            }
        }

        if (boss.deathResolved && !timepiece.active) {
            timepiece.x = boss.x + boss.width / 2 - timepiece.width / 2;
            timepiece.y = platform.y - timepiece.height;
            timepiece.active = true;
            timepiece.floatTimer = 0;
            console.log("[Game] Boss death resolved, timepiece activated at", new Date().toISOString());
            if (!timepiece.image) {
                const img = new Image();
                img.src = "img/piece5.png";
                img.crossOrigin = "anonymous";
                img.onload = () => {
                    timepiece.image = img;
                    console.log("[Game] Timepiece image loaded successfully");
                };
                img.onerror = () => {
                    console.error("[Game] Failed to load timepiece image from img/piece5.png");
                };
            }
        }
    } else {
        if (boss.invulnerable > 0) boss.invulnerable--;
        const dist = player.x - boss.x;
        boss.direction = dist > 0 ? 1 : -1;
        if (boss.attackCooldown > 0) boss.attackCooldown--;
        if (boss.state === "melee" || boss.state === "range") {
            boss.actionTimer--;
            if (boss.actionTimer <= 0) {
                boss.state = "idle";
                boss.actionTimer = 1;
            }
        } else {
            boss.actionTimer--;

            if (boss.actionTimer <= 0) {
                const absDist = Math.abs(dist);
                if (absDist < 80 && boss.attackCooldown === 0) {
                    boss.state = "melee";
                    boss.actionTimer = BOSS_ATTACK_ANIM_DURATION;
                    boss.frameX = 0;
                    boss.frameTimer = 0;
                } else if (absDist > 150 && boss.attackCooldown === 0 && Math.random() < 0.6) {
                    boss.state = "range";
                    boss.actionTimer = BOSS_ATTACK_ANIM_DURATION;
                    boss.frameX = 0;
                    boss.frameTimer = 0;
                } else {
                    boss.actionTimer = 80 + Math.random() * 60;
                    boss.state = Math.random() > 0.4 ? "chase" : "idle";
                    if (Math.random() < 0.1 && boss.hp > 0) {
                        const now = Date.now();
                        if (now - gameState.lastEvilLaughTime > 10000) {
                            playSound("evilLaugh");
                            gameState.lastEvilLaughTime = now;
                        }
                    }
                }
                if (boss.isGrounded && Math.random() < 0.35 && boss.state !== "melee" && boss.state !== "range") {
                    boss.vy = boss.jumpPower;
                    boss.isGrounded = false;
                    playSound("jumpBoss");
                }
            }
        }

        boss.isAttacking = false;
        if (boss.state === "chase" && Math.abs(boss.vx) < 4) boss.vx = boss.direction * boss.speed;
        else if (boss.state === "idle") boss.vx *= friction;
        else if (boss.state === "melee") {
            boss.vx *= 0.5;
            if (boss.frameX === 5 && boss.frameTimer === 1) {
                boss.isAttacking = true;
                bossAttackMelee();
                boss.attackCooldown = 52;
            }
        } else if (boss.state === "range") {
            boss.vx *= 0.5;
            if (boss.frameX === 6 && boss.frameTimer === 1) {
                bossAttackRange();
                boss.attackCooldown = 68;
            }
        }

        const bossIsWalking = boss.isGrounded && boss.state === "chase" && Math.abs(boss.vx) > 0.5;
        const bossCanAnimate = !boss.isGrounded || boss.state === "melee" || boss.state === "range" || bossIsWalking;
        const curBossDur = 8;

        if (bossCanAnimate) {
            boss.frameTimer++;
            if (boss.frameTimer >= curBossDur) {
                boss.frameTimer = 0;
                boss.frameX = (boss.frameX + 1) % bossCols;
                if (bossIsWalking && (boss.frameX === 1 || boss.frameX === 5)) playSound("bossStep");
            }
        } else {
            boss.frameTimer = 0;
            boss.frameX = 0;
        }
        syncBossSpriteMode();
        boss.vx *= friction;
        boss.x += boss.vx;
        const bossGravity = gravity * 0.75;
        boss.vy += bossGravity;
        boss.y += boss.vy;
        if (!player.isDead) {
            if (player.y < boss.y + boss.height && player.y + player.height > boss.y && player.x < boss.x + boss.width && player.x + player.width > boss.x) {
                const centerPlayer = player.x + player.width / 2;
                const centerBoss = boss.x + boss.width / 2;
                const overlap = (player.width / 2 + boss.width / 2) - Math.abs(centerPlayer - centerBoss);
                if (overlap > 0) {
                    if (centerPlayer < centerBoss) {
                        player.x -= overlap * 0.9;
                        boss.x += overlap * 0.1;
                    } else {
                        player.x += overlap * 0.9;
                        boss.x -= overlap * 0.1;
                    }
                }
            }
        }
    }

    for (let i = 0; i < projectiles.length; i++) {
        const p = projectiles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.frameTimer++;
        if (p.frameTimer > 4) {
            p.frameTimer = 0;
            p.frameX++;
            if (p.frameX >= pierreCols) {
                p.frameX = 0;
                p.frameY = (p.frameY + 1) % pierreRows;
            }
        }
        let stoneDestroyed = false;
        if (player.isAttacking && !player.isDead && !player.isHurt) {
            const swordHitbox = {
                x: player.direction === 1 ? player.x + player.width - 10 : player.x - 50,
                y: player.y,
                width: 60,
                height: 40
            };
            if (checkRectCollision(swordHitbox, p)) {
                spawnParticles(p.x + p.width / 2, p.y + p.height / 2, "#95a5a6");
                playSound("epee");
                projectiles.splice(i, 1);
                i--;
                stoneDestroyed = true;
            }
        }
        if (stoneDestroyed) continue;
        if (player.invulnerable === 0 && !player.isDead && checkRectCollision(p, player)) {
            applyKnockback(player, p.vx > 0 ? 1 : -1, 8);
            loseLife();
            projectiles.splice(i, 1);
            i--;
            continue;
        }
        if (p.x < 0 || p.x > canvas.width) {
            projectiles.splice(i, 1);
            i--;
        }
    }

    const bossWasGrounded = boss.isGrounded;
    checkPlatform(player);
    if (player.isGrounded) fallSoundPlayed = false;
    checkPlatform(boss);
    if (!bossWasGrounded && boss.isGrounded && boss.hp > 0) playSound("bossLand");

    if (timepiece.active && checkRectCollision(player, timepiece)) {
        if (!gameState.victory) {
            gameState.victory = true;
            gameState.victoryCinematicDone = false;
            audio.bgm.pause();
            playSound("win");

            controls.style.display = "none";
            if (pauseBtn) pauseBtn.style.display = "none";
            console.log("[Game] Victory! Timepiece collected by player at", new Date().toISOString());
            initVictoryCinematic();
        }
        timepiece.active = false;
    }

    if (player.y > canvas.height && !player.isDead) {
        if (!fallSoundPlayed) {
            playSound("heroFalling");
            fallSoundPlayed = true;
        }
        loseLife();
        if (!player.isDead) respawnPlayerCenter();
    }
    updateParticles();
}

// ==================== Outils de rendu ====================
function drawFastShadow(x, y, width) {
    if (width <= 0) return;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(1, 0.2);
    ctx.beginPath();
    ctx.arc(0, 0, width, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function syncStormAmbience() {
    const shouldPlayThunder = sky.isStorm && gameState.gameStarted && !gameState.isPaused && !gameState.gameOver && !gameState.victory;
    if (shouldPlayThunder) startThunder();
    else stopThunder();
}

// ==================== Rendu principal ====================
export function draw() {
    syncStormAmbience();
    drawBackgroundLayer();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";

    const distPlayer = platform.y - (player.y + player.height);
    if (distPlayer >= -10) {
        const playerCenterX = player.x + player.width / 2;
        const shadowWidth = player.width * 0.8 * (1 - Math.min(1, Math.max(0, distPlayer) / 200));
        drawFastShadow(playerCenterX, platform.y, shadowWidth);
    }

    const distBoss = platform.y - (boss.y + boss.height);
    if (distBoss >= -10) {
        const bossCenterX = boss.x + boss.width / 2;
        const shadowWidthBoss = boss.width * 0.8 * (1 - Math.min(1, Math.max(0, distBoss) / 200));
        drawFastShadow(bossCenterX, platform.y, shadowWidthBoss);
    }

    if (pierreSprite.complete && pierreSprite.naturalWidth > 0) {
        const sW = Math.floor(pierreSprite.naturalWidth / pierreCols);
        const sH = Math.floor(pierreSprite.naturalHeight / pierreRows);
        projectiles.forEach(p => {
            const frameIndexX = Math.max(0, Math.min(p.frameX, pierreCols - 1));
            const frameIndexY = Math.max(0, Math.min(p.frameY, pierreRows - 1));
            const sourceX = frameIndexX * sW;
            const sourceY = frameIndexY * sH;
            const sourceWidth = frameIndexX === pierreCols - 1 ? pierreSprite.naturalWidth - sourceX : sW;
            const sourceHeight = frameIndexY === pierreRows - 1 ? pierreSprite.naturalHeight - sourceY : sH;
            ctx.save();
            ctx.translate(Math.round(p.x + p.width / 2), Math.round(p.y + p.height / 2));
            if (p.vx < 0) ctx.scale(-1, 1);
            ctx.drawImage(
                pierreSprite,
                sourceX, sourceY, sourceWidth, sourceHeight,
                Math.round(-p.width / 2 - 10),
                Math.round(-p.height / 2 - 10),
                Math.round(p.width + 20),
                Math.round(p.height + 20)
            );
            ctx.restore();
        });
    }

    const currentBossSprite = getBossSpriteSheet();
    if (currentBossSprite && currentBossSprite.complete && currentBossSprite.naturalWidth > 0) {
        const isDeathSprite = boss.hp <= 0;
        const frameCount = isDeathSprite ? BOSS_DEATH_COLS : bossCols;
        const renderWidth = isDeathSprite ? BOSS_DEATH_RENDER_WIDTH : BOSS_RENDER_WIDTH;
        const renderHeight = isDeathSprite ? BOSS_DEATH_RENDER_HEIGHT : BOSS_RENDER_HEIGHT;
        const frameIndex = Math.max(0, Math.min(boss.frameX, frameCount - 1));
        const frameWidth = Math.floor(currentBossSprite.naturalWidth / frameCount);
        const sourceX = frameIndex * frameWidth;
        const sourceWidth = frameIndex === frameCount - 1 ? currentBossSprite.naturalWidth - sourceX : frameWidth;
        const drawX = Math.round(boss.x + boss.width / 2 - renderWidth / 2);
        const drawY = isDeathSprite
            ? Math.round(boss.y + boss.height - renderHeight + BOSS_OFFSET_Y + 8)
            : Math.round(boss.y + boss.height - renderHeight + BOSS_OFFSET_Y);
        const flipDeathFrame = isDeathSprite && (frameIndex === 0 || frameIndex === 1 || frameIndex === 6 || frameIndex === 7);
        const shouldFlipSprite = boss.direction === -1 !== flipDeathFrame;

        ctx.save();
        if (boss.invulnerable > 0 && boss.invulnerable % 8 < 4) ctx.globalAlpha = 0.3;
        ctx.imageSmoothingEnabled = false;
        if (shouldFlipSprite) {
            ctx.translate(drawX + renderWidth, drawY);
            ctx.scale(-1, 1);
            ctx.drawImage(
                currentBossSprite,
                sourceX, 0, sourceWidth, currentBossSprite.naturalHeight,
                0, 0, renderWidth, renderHeight
            );
        } else {
            ctx.drawImage(
                currentBossSprite,
                sourceX, 0, sourceWidth, currentBossSprite.naturalHeight,
                drawX, drawY, renderWidth, renderHeight
            );
        }
        ctx.restore();
    }

    if (playerSprite.complete && playerDegatSprite.complete) {
        const pW = 80;
        const pH = 80;
        const pX = player.x - (pW - player.width) / 2;
        const pY = player.y - (pH - player.height) + PLAYER_OFFSET_Y;

        const currentPlayerSprite = (player.isHurt || player.isDead) ? playerDegatSprite : playerSprite;
        const frameW = currentPlayerSprite.naturalWidth / playerCols;
        const frameH = currentPlayerSprite.naturalHeight / playerRows;

        ctx.save();
        if (player.invulnerable > 0 && player.invulnerable % 8 < 4 && !player.isDead) ctx.globalAlpha = 0.3;
        ctx.translate(Math.round(pX + pW / 2), Math.round(pY + pH / 2));
        ctx.scale(player.direction === -1 ? -1 : 1, 1);
        ctx.drawImage(
            currentPlayerSprite,
            player.frameX * frameW, player.frameY * frameH, frameW, frameH,
            Math.round(-pW / 2), Math.round(-pH / 2), pW, pH
        );
        ctx.restore();
    }

    if (timepiece.active) {
        timepiece.floatTimer++;
        const floatOffset = Math.sin(timepiece.floatTimer * 0.1) * 8;
        ctx.save();
        ctx.globalAlpha = 0.95;
        ctx.shadowColor = "rgba(255, 215, 0, 0.5)";
        ctx.shadowBlur = 12;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        const posX = Math.round(timepiece.x);
        const posY = Math.round(timepiece.y - floatOffset);

        if (timepiece.image && timepiece.image.complete && timepiece.image.naturalWidth > 0) {
            ctx.drawImage(
                timepiece.image,
                posX,
                posY,
                timepiece.width,
                timepiece.height
            );
        } else {
            // Fallback: afficher une pièce or si l'image ne charge pas
            ctx.fillStyle = "#ffd700";
            ctx.beginPath();
            ctx.arc(posX + timepiece.width / 2, posY + timepiece.height / 2, timepiece.width / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#ffed4e";
            ctx.lineWidth = 2;
            ctx.stroke();
            console.warn("[Game] Timepiece fallback render (image not loaded)");
        }
        ctx.restore();
    }

    particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / p.maxLife;
        const size = Math.round(8 * (p.life / p.maxLife));
        ctx.fillRect(Math.round(p.x - size / 2), Math.round(p.y - size / 2), size, size);
    });
    ctx.globalAlpha = 1;

    const pw = 200;
    ctx.font = "700 16px 'Chakra Petch', sans-serif";

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(20, 20, pw, 20);
    ctx.fillStyle = "#2ecc71";
    ctx.fillRect(20, 20, Math.round(pw * (Math.max(0, player.lives) / 5)), 20);
    ctx.strokeStyle = "white";
    ctx.strokeRect(20, 20, pw, 20);
    ctx.fillStyle = "white";
    ctx.fillText("HERO", 25, 15);

    if (boss.hp > 0) {
        const bw = 300;
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(canvas.width - bw - 20, 20, bw, 20);
        ctx.fillStyle = "#c0392b";
        ctx.fillRect(canvas.width - bw - 20, 20, Math.round(bw * (boss.hp / boss.maxHp)), 20);
        ctx.strokeStyle = "white";
        ctx.strokeRect(canvas.width - bw - 20, 20, bw, 20);
        ctx.fillStyle = "white";
        ctx.fillText("LE SCHWEISSDISSI", canvas.width - bw - 15, 15);
    }

    if (gameState.victory || gameState.gameOver) {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.textAlign = "center";

        if (gameState.victory) {
            drawVictoryCinematic();
        } else {
            ctx.fillStyle = "#ff7f7a";
            ctx.font = "52px 'Bungee', sans-serif";
            ctx.fillText("DEFEAT", canvas.width / 2, 175);

            ctx.fillStyle = "#f6fbff";
            ctx.font = "700 34px 'Chakra Petch', sans-serif";
            ctx.fillText("The Schweissdissi has taken the upper hand.", canvas.width / 2, 240);

            ctx.fillStyle = "#e74c3c";
            ctx.font = "700 30px 'Chakra Petch', sans-serif";
            ctx.fillText("Click to try again", canvas.width / 2, 300);
        }

        ctx.textAlign = "left";
    }

    if (sky.flashAlpha > 0) {
        ctx.save();
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, sky.flashAlpha)})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
        sky.flashAlpha = Math.max(0, sky.flashAlpha - 0.22);
        if (sky.flashAlpha === 0 && sky.flashStage > 0) {
            sky.flashStage--;
            sky.flashAlpha = 0.62;
        }
    }
}

// ==================== Outils debug ====================
export function devKillHero() {
    player.invulnerable = 0;
    player.lives = 1;
    loseLife();
}

export function devKillBoss() {
    if (boss.hp <= 0) return;
    gameState.gameStarted = true;
    gameState.isPaused = false;
    gameState.gameOver = false;
    gameState.victory = false;
    boss.hp = 0;
    boss.vx = 0;
    boss.vy = 0;
}

// ==================== Démarrage de la boucle de jeu ====================
function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

export function startGameLoop() {
    loop();
}
