// Gestion du redimensionnement
let isLandscapeBlocked = false;
let gameStateBeforeOrientationLock = 'start';

function isLandscapeMode() {
    return window.innerWidth > window.innerHeight;
}

function applyOrientationLock() {
    const landscape = isLandscapeMode();

    if (landscape) {
        if (!isLandscapeBlocked) {
            isLandscapeBlocked = true;
            gameStateBeforeOrientationLock = gameState;

            if (gameState === 'playing' || gameState === 'falling') {
                gameState = 'orientation-lock';
                bgm.game.pause();
            }
        }

        orientationLockScreen.classList.remove('hidden');
        return;
    }

    if (isLandscapeBlocked) {
        isLandscapeBlocked = false;
        orientationLockScreen.classList.add('hidden');

        if (gameState === 'orientation-lock') {
            gameState = gameStateBeforeOrientationLock;

            if (!isMuted && (gameState === 'playing' || gameState === 'falling')) {
                bgm.game.play().catch(e => console.log("Lecture auto bloquée", e));
            }
        }
    }
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (player) {
        // Maintien du joueur au centre de l'écran en cas de redimensionnement
        player.y = canvas.height / 2 + player.height / 2;
    }

    applyOrientationLock();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', applyOrientationLock);
resize();

const VILLAGE_DIALOGUES = [
    {
        speaker: 'Villager',
        text: "They chained him to that damned rock..."
    },
    {
        speaker: 'Villager',
        text: 'Look at him. He’s making his way through the crowd without missing a step.'
    },
    {
        speaker: 'Villager',
        text: 'If the Klapperstein crushes him, the executioner will finish the job.'
    }
];

const EXECUTIONER_DIALOGUES = [
    {
        speaker: 'Executioner',
        text: 'Your trial begins now.'
    },
    {
        speaker: 'Executioner',
        text: 'Make your way through the crowd... or fall under the weight of the Klapperstein.'
    }
];

let introPhase = 'menu'; // menu | village | blackout | executioner | done
let introLineIndex = 0;
let blackInterludeTimeout = null;
let blackInterludeVibrationInterval = null;
let isAdventureUnlocked = false;
let typewriterTimeouts = [];
let isTypewriterRunning = false;

const pauseIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pause-fill" viewBox="0 0 16 16"><path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5m5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5"/></svg>`;
const playIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-play-fill" viewBox="0 0 16 16"><path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393"/></svg>`;

function updatePauseButtonIcon() {
    if (!pauseBtn) return;

    if (gameState === 'paused') {
        pauseBtn.innerHTML = playIconSvg;
        pauseBtn.title = 'Resume';
        pauseBtn.setAttribute('aria-label', 'Resume');
    } else {
        pauseBtn.innerHTML = pauseIconSvg;
        pauseBtn.title = 'Pause';
        pauseBtn.setAttribute('aria-label', 'Pause');
    }
}

function clearTypewriter() {
    for (const timeoutId of typewriterTimeouts) {
        clearTimeout(timeoutId);
    }
    typewriterTimeouts = [];
}

function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function dialogue(selecteur) {
    document.querySelectorAll(selecteur).forEach(div => {
        clearTypewriter();
        isTypewriterRunning = true;

        let output = '';

        div.innerText.split('').forEach(lettre => {
            const safeLetter = escapeHtml(lettre);
            output += `<span class="lettre">${safeLetter}</span>`;
        });

        div.innerHTML = output;
        afficherTxt.call(div);
    });
}

function stopDialogueSounds() {
    if (typeof sfx !== 'undefined') {
        if (sfx.villageSound) {
            sfx.villageSound.pause();
            sfx.villageSound.currentTime = 0;
        }
        if (sfx.executionerSound) {
            sfx.executionerSound.pause();
            sfx.executionerSound.currentTime = 0;
        }
    }
}

function afficherTxt() {
    const letters = [...this.children];

    // Jouer le son approprié pour la phrase entière
    if (typeof sfx !== 'undefined' && typeof isMuted !== 'undefined' && !isMuted) {
        if (introPhase === 'village' && sfx.villageSound) {
            sfx.villageSound.currentTime = 0;
            sfx.villageSound.play().catch(e => console.log("Erreur audio village:", e));
        } else if (introPhase === 'executioner' && sfx.executionerSound) {
            sfx.executionerSound.currentTime = 0;
            sfx.executionerSound.play().catch(e => console.log("Erreur audio bourreau:", e));
        }
    }

    letters.forEach((lettre, index) => {
        const timeoutId = setTimeout(() => {
            lettre.classList.add('visible');

            if (index === letters.length - 1) {
                isTypewriterRunning = false;
                clearTypewriter();
                stopDialogueSounds();
            }
        }, 50 * index);

        typewriterTimeouts.push(timeoutId);
    });
}

function finishTypewriterInstantly() {
    if (!isTypewriterRunning) return false;

    clearTypewriter();
    const letters = dialogueText.querySelectorAll('.lettre');
    letters.forEach(letter => letter.classList.add('visible'));
    isTypewriterRunning = false;
    stopDialogueSounds();
    return true;
}

function setAdventureUnlocked(unlocked) {
    isAdventureUnlocked = unlocked;
    adventureStartBtn.disabled = !unlocked;
    startBtn.disabled = !unlocked;
}

function clearBlackInterludeTimers() {
    if (blackInterludeTimeout) {
        clearTimeout(blackInterludeTimeout);
        blackInterludeTimeout = null;
    }

    if (blackInterludeVibrationInterval) {
        clearInterval(blackInterludeVibrationInterval);
        blackInterludeVibrationInterval = null;
    }
}

function clearBlackInterludeVibration() {
    if (blackInterludeVibrationInterval) {
        clearInterval(blackInterludeVibrationInterval);
        blackInterludeVibrationInterval = null;
    }
}

function setDialogueAssets() {
    dialogueBackground.src = assets.dialogueBackground.src;
    dialogueVillagerYoung.src = assets.dialogueVillagerYoung.src;
    dialogueCart.src = assets.dialogueCart.src;
    dialogueVillagerOld.src = assets.dialogueVillagerOld.src;
    dialogueExecutioner.src = assets.dialogueExecutioner.src;
}

function showAdventureEntry() {
    introPhase = 'menu';
    startSubtitle.classList.remove('hidden');
    adventureStartBtn.classList.remove('hidden');
    dialogueStage.classList.add('hidden');
    dialogueBlackScreen.classList.add('hidden');
    gpsStatusElement.classList.remove('hidden');
    startBtn.classList.add('hidden');
    setAdventureUnlocked(isAdventureUnlocked);
}

function renderDialogueLine(dialogueLines) {
    const line = dialogueLines[introLineIndex];
    if (!line) return;
    dialogueSpeaker.textContent = line.speaker;
    dialogueText.textContent = line.text;
    dialogueHint.textContent = "Tap the screen to continue";
    dialogue('#dialogue-text');
}

function startVillageDialogues() {
    introPhase = 'village';
    introLineIndex = 0;
    bgm.menu.pause(); // Retire la musique pour le dialogue des villageois
    dialogueBackground.src = assets.dialogueBackground.src;
    startSubtitle.classList.add('hidden');
    adventureStartBtn.classList.add('hidden');
    dialogueStage.classList.remove('hidden');

    dialogueBlackScreen.classList.add('hidden');
    dialogueExecutioner.classList.add('hidden');
    dialogueVillagerYoung.classList.remove('hidden');
    dialogueVillagerOld.classList.remove('hidden');
    dialogueCart.classList.remove('hidden');
    renderDialogueLine(VILLAGE_DIALOGUES);
}

function startExecutionerDialogues() {
    introPhase = 'executioner';
    introLineIndex = 0;
    bgm.gameOver.volume = 0.05; // Baisse le volume pendant que le bourreau parle
    dialogueBackground.src = assets.dialogueExecutionerBackground.src;

    dialogueBlackScreen.classList.add('hidden');
    dialogueExecutioner.classList.remove('hidden');
    dialogueVillagerYoung.classList.add('hidden');
    dialogueVillagerOld.classList.add('hidden');
    dialogueCart.classList.add('hidden');
    renderDialogueLine(EXECUTIONER_DIALOGUES);
}

function startBlackInterlude() {
    introPhase = 'blackout';
    dialogueBlackScreen.classList.remove('hidden');
    dialogueExecutioner.classList.add('hidden');
    dialogueVillagerYoung.classList.add('hidden');
    dialogueVillagerOld.classList.add('hidden');
    dialogueCart.classList.add('hidden');
    dialogueSpeaker.textContent = '';
    dialogueText.textContent = '...';
    clearTypewriter();
    isTypewriterRunning = false;
    dialogueHint.textContent = '';

    bgm.menu.pause();
    bgm.gameOver.currentTime = 0;
    bgm.gameOver.play().catch(e => console.log(e));

    let vibrationCount = 0;
    const triggerPulse = () => {
        vibrationCount += 1;
        if (typeof triggerGameVibration === 'function') {
            triggerGameVibration([140, 80, 180]);
        } else if (navigator.vibrate) {
            navigator.vibrate([140, 80, 180]);
        }
    };

    triggerPulse();
    clearBlackInterludeTimers();
    blackInterludeVibrationInterval = setInterval(() => {
        if (vibrationCount >= 3) {
            clearBlackInterludeVibration();
            return;
        }
        triggerPulse();
    }, 700);

    blackInterludeTimeout = setTimeout(() => {
        clearBlackInterludeTimers();
        startExecutionerDialogues();
    }, 5000);
}

function finishIntroAndLaunchGame() {
    introPhase = 'done';
    clearBlackInterludeTimers();
    clearTypewriter();
    isTypewriterRunning = false;
    startGame();
}

function advanceDialogue() {
    if (introPhase === 'village') {
        introLineIndex += 1;
        if (introLineIndex >= VILLAGE_DIALOGUES.length) {
            startBlackInterlude();
            return;
        }
        renderDialogueLine(VILLAGE_DIALOGUES);
        return;
    }

    if (introPhase === 'executioner') {
        introLineIndex += 1;
        if (introLineIndex >= EXECUTIONER_DIALOGUES.length) {
            finishIntroAndLaunchGame();
            return;
        }
        renderDialogueLine(EXECUTIONER_DIALOGUES);
    }
}

function beginAdventureIntro(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(err => console.log(err));
    }

    if (introPhase !== 'menu') return;
    if (!isAdventureUnlocked) return;
    startVillageDialogues();
}

function handleStartScreenTap(event) {
    if (gameState !== 'start') return;
    if (introPhase === 'village' || introPhase === 'executioner') {
        if (event.target === adventureStartBtn) return;
        if (finishTypewriterInstantly()) return;
        advanceDialogue();
    }
}

setDialogueAssets();
showAdventureEntry();

const CHEAT_TAP_WINDOW_MS = 900;
let cheatTapTimestamps = [];

// -- LOGIQUE AFFICHAGE DES ECLAIRS --

// Fenêtre aléatoire entre deux éclairs (en secondes)
const LIGHTNING_MIN_DELAY = 4.5;
const LIGHTNING_MAX_DELAY = 9.5;
// Délai minimal entre deux vibrations déclenchées par les éclairs
const LIGHTNING_VIBRATION_COOLDOWN = 1.5;

// Liste des éclairs actifs à l'écran
let lightningStrikes = [];
// Chrono global qui avance jusqu'au prochain spawn
let lightningSpawnTimer = 0;
// Prochain délai tiré aléatoirement
let nextLightningDelay = 6;
// Intensité du flash de lumière global
let lightningFlashStrength = 0;
// Cooldown anti-spam des vibrations
let lightningVibrationCooldown = 0;

function randomRange(min, max) {
    // Renvoie un flottant aléatoire dans [min, max]
    return min + Math.random() * (max - min);
}

function scheduleNextLightningDelay() {
    // Recalcule le délai du prochain éclair
    nextLightningDelay = randomRange(LIGHTNING_MIN_DELAY, LIGHTNING_MAX_DELAY);
}

function generateLightningPath(startX, startY, endX, endY, segmentCount, jitter) {
    // Construit un trajet en segments avec une légère irrégularité
    const path = [{ x: startX, y: startY }];

    for (let i = 1; i < segmentCount; i++) {
        const progress = i / segmentCount;
        const x = startX + (endX - startX) * progress + randomRange(-jitter, jitter) * (1 - progress * 0.35);
        const y = startY + (endY - startY) * progress + randomRange(-8, 8);
        path.push({ x, y });
    }

    path.push({ x: endX, y: endY });
    return path;
}

function createLightningStrike() {
    // Position de départ proche du haut + zone d'impact dans le ciel visible
    const startX = randomRange(canvas.width * 0.12, canvas.width * 0.88);
    const startY = randomRange(-30, canvas.height * 0.06);
    const endX = startX + randomRange(-canvas.width * 0.2, canvas.width * 0.2);
    const endY = randomRange(canvas.height * 0.28, canvas.height * 0.62);

    // Trajet principal de l'éclair
    const segmentCount = Math.floor(randomRange(9, 14));
    const mainPath = generateLightningPath(startX, startY, endX, endY, segmentCount, canvas.width * 0.03);
    const branches = [];
    const branchCount = Math.floor(randomRange(1, 4));

    for (let i = 0; i < branchCount; i++) {
        const anchorIndex = Math.floor(randomRange(2, Math.max(3, mainPath.length - 2)));
        const anchor = mainPath[anchorIndex];
        const branchEndX = anchor.x + randomRange(-canvas.width * 0.15, canvas.width * 0.15);
        const branchEndY = anchor.y + randomRange(45, 130);
        const branchSegments = Math.floor(randomRange(4, 7));

        branches.push(generateLightningPath(anchor.x, anchor.y, branchEndX, branchEndY, branchSegments, canvas.width * 0.02));
    }

    // Paramètres visuels et temporels d'un éclair unique
    return {
        age: 0,
        duration: randomRange(0.18, 0.34),
        secondFlashAt: randomRange(0.07, 0.12),
        secondFlashDone: false,
        maxAlpha: randomRange(0.8, 1),
        baseWidth: randomRange(1.8, 2.8),
        glowWidth: randomRange(7, 11),
        mainPath,
        branches
    };
}

function spawnLightningStrike() {
    // Ajoute un éclair + déclenche un flash global
    lightningStrikes.push(createLightningStrike());
    lightningFlashStrength = Math.max(lightningFlashStrength, randomRange(0.2, 0.34));
    scheduleNextLightningDelay();

    if (typeof sfx !== 'undefined' && sfx.lightning) {
        // Clone pour autoriser des sons superposés sans couper le précédent
        const lightningSound = sfx.lightning.cloneNode();
        lightningSound.volume = sfx.lightning.volume;
        lightningSound.muted = typeof isMuted !== 'undefined' ? isMuted : false;
        lightningSound.currentTime = 0;
        lightningSound.play().catch(e => console.log(e));

        setTimeout(() => {
            lightningSound.pause();
            lightningSound.currentTime = 0;
        }, 3000);
    }

    if (lightningVibrationCooldown <= 0) {
        if (typeof triggerGameVibration === 'function') {
            triggerGameVibration([20, 30, 45]);
        } else if (navigator.vibrate) {
            navigator.vibrate([20, 30, 45]);
        }

        // Relance le cooldown vibration après un éclair
        lightningVibrationCooldown = LIGHTNING_VIBRATION_COOLDOWN;
    }
}

function updateLightning(dt) {
    // Fait progresser le chrono d'apparition
    lightningSpawnTimer += dt;
    if (lightningSpawnTimer >= nextLightningDelay) {
        lightningSpawnTimer = 0;
        spawnLightningStrike();
    }

    // Dissipe progressivement le flash et le cooldown
    lightningVibrationCooldown = Math.max(0, lightningVibrationCooldown - dt);
    lightningFlashStrength = Math.max(0, lightningFlashStrength - dt * 2.6);

    for (let i = lightningStrikes.length - 1; i >= 0; i--) {
        const strike = lightningStrikes[i];
        strike.age += dt;

        if (!strike.secondFlashDone && strike.age >= strike.secondFlashAt) {
            // Petit second flash pour un rendu plus naturel
            strike.secondFlashDone = true;
            lightningFlashStrength = Math.max(lightningFlashStrength, 0.16);
        }

        if (strike.age >= strike.duration) {
            // Retire les éclairs terminés
            lightningStrikes.splice(i, 1);
        }
    }
}

function drawLightningPath(path) {
    if (!path.length) return;

    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y);
    }
    ctx.stroke();
}

function drawLightning(ctx) {
    if (!lightningStrikes.length && lightningFlashStrength <= 0) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const strike of lightningStrikes) {
        // Alpha décroît dans le temps avec un léger scintillement
        const progress = Math.min(1, strike.age / strike.duration);
        const flicker = 0.8 + Math.abs(Math.sin(progress * Math.PI * 7)) * 0.2;
        const alpha = Math.max(0, (1 - progress) * strike.maxAlpha * flicker);

        // Couche externe (glow)
        ctx.strokeStyle = `rgba(165, 215, 255, ${alpha * 0.45})`;
        ctx.lineWidth = strike.glowWidth;
        drawLightningPath(strike.mainPath);

        // Coeur de l'éclair plus blanc et plus fin
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.lineWidth = strike.baseWidth;
        drawLightningPath(strike.mainPath);

        for (const branch of strike.branches) {
            // Même principe de double couche pour les branches
            ctx.strokeStyle = `rgba(173, 220, 255, ${alpha * 0.32})`;
            ctx.lineWidth = strike.glowWidth * 0.55;
            drawLightningPath(branch);

            ctx.strokeStyle = `rgba(245, 250, 255, ${alpha * 0.75})`;
            ctx.lineWidth = strike.baseWidth * 0.6;
            drawLightningPath(branch);
        }
    }

    if (lightningFlashStrength > 0) {
        // Flash d'écran en mode additif pour simuler l'illumination globale
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = `rgba(215, 230, 255, ${Math.min(0.32, lightningFlashStrength)})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.restore();
}

function handleCheatTouchStart() {
    if (gameState !== 'playing') return;

    const now = performance.now();
    cheatTapTimestamps.push(now);
    cheatTapTimestamps = cheatTapTimestamps.filter((time) => now - time <= CHEAT_TAP_WINDOW_MS);

    if (cheatTapTimestamps.length >= 3) {
        cheatTapTimestamps = [];

        if (!fragmentObj) {
            fragmentObj = new Fragment();
        }
    }
}

// Boucle principale du jeu
function gameLoop(timestamp) {
    const deltaTime = Math.min((timestamp - lastTime) / 1000, 0.1) || 0; // Limite dt à 100 ms
    lastTime = timestamp;

    if (gameState === 'paused') {
        requestAnimationFrame(gameLoop);
        return;
    }

    // Continue d'afficher et de calculer la chute même si on n'est plus "playing"
    if (gameState === 'playing' || gameState === 'falling') {
        update(deltaTime);
        draw();
    }

    requestAnimationFrame(gameLoop);
}

function spawnTomatoBurst(count, targetPlayer, type = 'normal') {
    for (let i = 0; i < count; i++) {
        tomatoes.push(new Tomato(targetPlayer, { type }));
    }

    if (typeof sfx !== 'undefined' && sfx.tomatoThrow) {
        const burstSound = sfx.tomatoThrow.cloneNode();
        burstSound.volume = sfx.tomatoThrow.volume;
        burstSound.muted = typeof isMuted !== 'undefined' ? isMuted : false;
        burstSound.play().catch(e => console.log(e));
    }
}

function update(dt) {
    // Incrément simple du score dans le temps (survie)
    score += dt * 10;
    scoreElement.innerText = `Score: ${Math.floor(score)}`;

    // Met à jour les entités
    if (player) {
        player.update(dt);
        if (pendulum) {
            // --- POINT D'ATTACHE DE LA CORDE ---
            // Avec un scale de 2, le sprite fait 200px de haut. 
            const neckOffsetY = -30;

            // Ancre le pendule au cou du joueur avec le décalage
            pendulum.update(dt, player.x, player.y + neckOffsetY);
            pendulum.checkCollisionWithPlayer(player);
        }
    }

    // Avancement de l'animation de la foule
    crowdAnimTimer += dt;
    updateLightning(dt);

    // Logique du chronorouage
    if (score >= nextFragmentSpawnScore && !fragmentObj) {
        fragmentObj = new Fragment();
    }

    if (fragmentObj) {
        if (fragmentObj.active) {
            fragmentObj.update(dt);
            if (player && fragmentObj.checkCollision(player)) {
                fragmentObj = null; // On supprime l'objet activement
                gameWin();
            }
        } else {
            // Le fragment a été manqué (tombé hors de l'écran et désactivé)
            // On prévoit le prochain essai dans 100 secondes (100 score)
            fragmentObj = null;
            nextFragmentSpawnScore = score + 100;
        }
    }

    // Logique des tomates
    tomatoSpawnTimer += dt;
    if (tomatoSpawnTimer >= tomatoSpawnInterval) {
        tomatoSpawnTimer = 0;

        const rottenChance = 0.12;
        const isRottenTomato = Math.random() < rottenChance;
        tomatoes.push(new Tomato(player, { type: isRottenTomato ? 'rotten' : 'normal' }));

        // Joue le bruitage du lancer de tomate
        if (typeof sfx !== 'undefined' && sfx.tomatoThrow) {
            // Un cloneNode() permet que le son puisse se jouer 2-3 fois en même temps si le joueur arrive loin dans la partie et que les tomates spawnent vite.
            const sound = sfx.tomatoThrow.cloneNode();
            sound.volume = sfx.tomatoThrow.volume;
            sound.muted = isMuted;
            sound.play().catch(e => console.log(e));
        }

        // Augmente doucement la difficulté en réduisant l'intervalle d'apparition
        tomatoSpawnInterval = Math.max(0.3, tomatoSpawnInterval * 0.98);
    }

    for (let i = tomatoes.length - 1; i >= 0; i--) {
        const t = tomatoes[i];
        t.update(dt);

        // Collision
        if (player && t.checkCollision(player)) {
            shame += 10;
            // On fait disparaître la tomate instantanément au lieu d'afficher sa flaque
            t.active = false;

            if (t.isRotten) {
                spawnTomatoBurst(3, player, 'normal');
            }

            // On informe le joueur qu'il s'est pris une tomate sur le visage
            player.triggerSplatter();

            // Joue le bruitage d'impact sur le joueur
            if (typeof sfx !== 'undefined' && sfx.tomatoHit) {
                const hitSnd = sfx.tomatoHit.cloneNode();
                hitSnd.volume = sfx.tomatoHit.volume;
                hitSnd.muted = typeof isMuted !== 'undefined' ? isMuted : false;
                hitSnd.play().catch(e => console.log(e));
            }

            // Vibration légère sur impact (marche sur Android, IOS c'est une autre histoire...)
            if (typeof triggerGameVibration === 'function') {
                triggerGameVibration(50);
            } else if (navigator.vibrate) {
                navigator.vibrate(50);
            }

            // Particules d'éclaboussure rouge
            createSplatParticles(
                player.x,
                player.y + player.height / 2,
                t.particleColor || '#ff0000',
                t.isRotten ? 18 : 15
            );

            // Retour visuel d'impact
            document.body.style.backgroundColor = 'rgba(255, 100, 0, 0.4)';
            setTimeout(() => document.body.style.backgroundColor = '#1a1a1a', 100);
        }

        // Nettoyage des tomates inactives (sorties d'écran ou touchées)
        if (!t.active) {
            tomatoes.splice(i, 1);
        }
    }

    // Mise à jour de la jauge de honte (shame)
    shame = Math.max(0, Math.min(shame, maxShame));
    updateUI();

    // Difficulté dynamique : gravité du pendule
    if (pendulum && gameState === 'playing') {
        // La gravité diminue progressivement (de 1800 à 800) pour rendre le pendule plus flottant et instable
        const minGrav = 800;
        const maxGrav = 1800;
        // On atteint la difficulté max à 500 de score
        pendulum.gravity = Math.max(minGrav, maxGrav - (score * 1.4));
    }

    // Au lieu de faire un écran noir brutal, on déclenche l'animation de chute 
    if (shame >= maxShame && gameState === 'playing') {
        if (player.state !== 'falling') {
            player.triggerFall();
            // Vibration longue sur défaite (Android)
            if (typeof triggerGameVibration === 'function') {
                triggerGameVibration([100, 50, 200]);
            } else if (navigator.vibrate) {
                navigator.vibrate([100, 50, 200]);
            }
        }
    }

    // Le vrai Game Over apparaît 1.5 seconde après le début de la chute
    if (gameState === 'falling' && player.fallTimer > 1.5) {
        gameOver();
    }

    // Mise à jour des particules (Stage 2)
    updateParticles(dt);
}

function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 800 * dt; // Gravité des particules
        p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function createSplatParticles(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 50 + Math.random() * 200;
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 150, // Poussée vers le haut au début
            color: color,
            radius: 2 + Math.random() * 4,
            life: 0.5 + Math.random() * 0.5
        });
    }
}

function draw() {
    // Effacement et arrière-plan
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dessin du décor avec ratio préservé (façon "object-fit: cover")
    if (assets.background && assets.background.complete && assets.background.naturalWidth > 0) {
        const imgW = assets.background.naturalWidth;
        const imgH = assets.background.naturalHeight;

        // Calcul des ratios
        const imgRatio = imgW / imgH;
        const canvasRatio = canvas.width / canvas.height;

        let drawW, drawH, offsetX, offsetY;

        // Si l'écran est plus large (proportionnellement) que l'image
        if (canvasRatio > imgRatio) {
            drawW = canvas.width;
            drawH = canvas.width / imgRatio;
            offsetX = 0;
            offsetY = (canvas.height - drawH) / 2; // Centre verticalement
        }
        // Si l'écran est plus fin (proportionnellement) que l'image (ex: mobile vertical)
        else {
            drawH = canvas.height;
            drawW = canvas.height * imgRatio;
            offsetX = (canvas.width - drawW) / 2; // Centre horizontalement
            offsetY = 0;
        }

        // On dessine l'image normalement (sans opacité réduite)
        ctx.drawImage(assets.background, offsetX, offsetY, drawW, drawH);

        // On dessine un calque noir semi-transparent pour assombrir le background et faire ressortir les éléments de jeu
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
        // Écran de secours (gris foncé) si le décor n'est pas encore prêt
        ctx.fillStyle = '#2d2d2d';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // --- DESSIN DE LA FOULE PAVÉE (en bas de l'écran) ---
    if (assets.foule && assets.foule.complete && assets.foule.naturalWidth > 0) {
        // L'image fait 577x432 (4 colonnes, 4 lignes) => 16 cases
        const totalFrames = 16;
        // L'animation boucle à 8 images par seconde
        let crowdFrame = Math.floor(crowdAnimTimer * 6) % totalFrames;

        // Échelle légèrement agrandie pour bien habiller le bas de l'écran
        const crowdScale = 1.3;
        const crowdWidth = 144 * crowdScale;
        const crowdHeight = 108 * crowdScale;
        // Position en Y pour que ça colle parfaitement au bas de l'écran
        const groundY = canvas.height - crowdHeight;

        // On répète l'image sur toute la largeur de l'écran
        for (let x = 0; x < canvas.width; x += crowdWidth) {
            drawSpriteFrame(
                ctx,
                assets.foule,
                crowdFrame,
                x,
                groundY,
                crowdWidth,
                crowdHeight,
                4, // 4 colonnes
                4, // 4 lignes
                false
            );
        }
    }

    // Dessine d'abord les objets lointains
    for (const t of tomatoes) {
        if (t.scale < 0.6) t.draw(ctx);
    }

    // Affiche d'abord la corde la pierre pour qu'elle soit "derrière" l'image du joueur
    if (pendulum) pendulum.draw(ctx);

    // Et par-dessus, affiche l'entité du joueur pour cacher intelligemment la corde avec la tête et ses épaules
    if (player) player.draw(ctx);

    // Dessine les objets proches en dernier (devant le joueur)
    for (const t of tomatoes) {
        if (t.scale >= 0.6) t.draw(ctx);
    }

    if (fragmentObj) {
        fragmentObj.draw(ctx);
    }

    // Déssin des particules (Stage 2)
    drawParticles(ctx);
    drawLightning(ctx);
}

function drawParticles(ctx) {
    for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life; // Fondu en sortie
        ctx.fill();
    }
    ctx.globalAlpha = 1.0;
}

function startGame() {
    clearBlackInterludeTimers();

    if (isLandscapeMode()) {
        applyOrientationLock();
        return;
    }

    if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(err => console.log(err));
    }

    requestDeviceOrientation();
    gameState = 'playing';
    hasSentVictorySignal = false;
    pauseBtn.classList.remove('hidden');
    updatePauseButtonIcon();

    if (typeof signalGameState === 'function') {
        signalGameState('playing');
    }

    // Musique : coupe les menus, démarre le jeu
    bgm.menu.pause();
    bgm.menu.currentTime = 0;
    bgm.gameOver.pause();
    bgm.gameOver.currentTime = 0;
    bgm.win.pause();
    bgm.win.currentTime = 0;

    bgm.game.currentTime = 0;
    bgm.game.play().catch(e => console.log("Lecture auto bloquée", e));

    score = 0;
    shame = 0;
    input.tiltX = 0;

    tomatoes = [];
    tomatoSpawnTimer = 0;
    tomatoSpawnInterval = 1.5;

    lightningStrikes = [];
    lightningSpawnTimer = 0;
    lightningFlashStrength = 0;
    lightningVibrationCooldown = 0;
    scheduleNextLightningDelay();

    fragmentObj = null;
    nextFragmentSpawnScore = 200; // Reset à 20s au début d'une nouvelle partie

    // Initialise les entités centrées sur le canvas
    player = new Player();
    pendulum = new Pendulum(player.x, player.y - 30); // Initialise avec le même offset que neckOffsetY (-30)

    updateUI();

    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    gameWinScreen.classList.add('hidden');

    lastTime = performance.now();
}

function gameOver() {
    gameState = 'gameover';
    pauseBtn.classList.add('hidden');
    finalScoreElement.innerText = Math.floor(score);
    gameOverScreen.classList.remove('hidden');

    if (typeof signalGameState === 'function') {
        signalGameState('menu', 'defeat');
    }

    // Musique : coupe le jeu, lance le thème de game over
    bgm.game.pause();
    bgm.gameOver.volume = 0.4; // S'assure de remettre le volume par défaut
    bgm.gameOver.currentTime = 0;
    bgm.gameOver.play().catch(e => console.log(e));
}

function gameWin() {
    gameState = 'gamewin';
    pauseBtn.classList.add('hidden');
    gameWinScreen.classList.remove('hidden');

    if (!hasSentVictorySignal && typeof signalVictory === 'function') {
        hasSentVictorySignal = true;
        signalVictory({
            score: Math.floor(score),
            stats: {
                tomatoesTaken: Math.floor(shame / 10)
            }
        });
    }

    if (typeof signalGameState === 'function') {
        signalGameState('menu', 'victory');
    }

    // Musique : coupe le jeu, lance le thème de victoire
    bgm.game.pause();
    bgm.win.currentTime = 0;
    bgm.win.play().catch(e => console.log(e));
}

function updateUI() {
    shameBarElement.style.width = `${(shame / maxShame) * 100}%`;
}

// Événements
startBtn.addEventListener('click', startGame);
adventureStartBtn.addEventListener('click', beginAdventureIntro);
startScreen.addEventListener('click', handleStartScreenTap);
restartBtn.addEventListener('click', startGame);
winRestartBtn.addEventListener('click', startGame);
winContinueBtn.addEventListener('click', () => {
    if (typeof signalContinueAdventure === 'function') {
        signalContinueAdventure();
    }
});
pauseBtn.addEventListener('click', () => {
    if (gameState === 'playing' || gameState === 'falling') {
        gameState = 'paused';
        updatePauseButtonIcon();
        bgm.game.pause();
        return;
    }

    if (gameState === 'paused') {
        gameState = 'playing';
        updatePauseButtonIcon();
        if (!isMuted) {
            bgm.game.play().catch(e => console.log("Lecture auto bloquée", e));
        }
    }
});
canvas.addEventListener('touchstart', handleCheatTouchStart, { passive: true });

const soundIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-volume-down-fill" viewBox="0 0 16 16"><path d="M9 4a.5.5 0 0 0-.812-.39L5.825 5.5H3.5A.5.5 0 0 0 3 6v4a.5.5 0 0 0 .5.5h2.325l2.363 1.89A.5.5 0 0 0 9 12zm3.025 4a4.5 4.5 0 0 1-1.318 3.182L10 10.475A3.5 3.5 0 0 0 11.025 8 3.5 3.5 0 0 0 10 5.525l.707-.707A4.5 4.5 0 0 1 12.025 8"/></svg>`;
const muteIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-volume-mute" viewBox="0 0 16 16"><path d="M6.717 3.55A.5.5 0 0 1 7 4v8a.5.5 0 0 1-.812.39L3.825 10.5H1.5A.5.5 0 0 1 1 10V6a.5.5 0 0 1 .5-.5h2.325l2.363-1.89a.5.5 0 0 1 .529-.06M6 5.04 4.312 6.39A.5.5 0 0 1 4 6.5H2v3h2a.5.5 0 0 1 .312.11L6 10.96zm7.854.606a.5.5 0 0 1 0 .708L12.207 8l1.647 1.646a.5.5 0 0 1-.708.708L11.5 8.707l-1.646 1.647a.5.5 0 0 1-.708-.708L10.793 8 9.146 6.354a.5.5 0 1 1 .708-.708L11.5 7.293l1.646-1.647a.5.5 0 0 1 .708 0"/></svg>`;

function updateMuteButtonIcon() {
    muteBtn.innerHTML = isMuted ? muteIconSvg : soundIconSvg;
}

updateMuteButtonIcon();

// Gestion de la coupure du son
muteBtn.addEventListener('click', () => {
    isMuted = !isMuted;

    // Muted est une propriété HTML5 Audio qui coupe le son sans mettre en pause
    bgm.game.muted = isMuted;
    bgm.menu.muted = isMuted;
    bgm.gameOver.muted = isMuted;
    bgm.win.muted = isMuted;

    // Mute aussi les bruitages
    sfx.fall.muted = isMuted;
    sfx.tomatoThrow.muted = isMuted;
    sfx.tomatoSplat.muted = isMuted;
    sfx.tomatoHit.muted = isMuted;
    sfx.lightning.muted = isMuted;

    updateMuteButtonIcon();
});


// --- GESTION DU GPS ---
let watchId = null;
let lastKnownUserLat = null;
let lastKnownUserLon = null;
let mapPopupShown = false;
let mapInstance = null;
let routingControl = null;
let lastRoutingUpdate = 0;

function openMapPopup() {
    mapPopup.classList.remove('hidden');
    if (!mapInstance) {
        mapInstance = L.map('map').setView([lastKnownUserLat || TARGET_LAT, lastKnownUserLon || TARGET_LON], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(mapInstance);

        routingControl = L.Routing.control({
            waypoints: [
                L.latLng(lastKnownUserLat, lastKnownUserLon),
                L.latLng(TARGET_LAT, TARGET_LON)
            ],
            language: 'fr',
            routeWhileDragging: false,
            addWaypoints: false
        }).addTo(mapInstance);
        lastRoutingUpdate = Date.now();
    } else {
        routingControl.setWaypoints([
            L.latLng(lastKnownUserLat, lastKnownUserLon),
            L.latLng(TARGET_LAT, TARGET_LON)
        ]);
        lastRoutingUpdate = Date.now();
    }
    setTimeout(() => mapInstance.invalidateSize(), 150);
}

function closeMapPopup() {
    mapPopup.classList.add('hidden');
}

if (openMapBtn) {
    openMapBtn.addEventListener('click', () => {
        if (lastKnownUserLat !== null) openMapPopup();
    });
}
if (closeMapBtn) {
    closeMapBtn.addEventListener('click', closeMapPopup);
}

// Formule de Haversine pour calculer la distance en mètres entre deux points GPS
function getDistanceFromLatLonInM(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Rayon de la terre en mètres
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function initGPS() {
    // Ignore la contrainte GPS en mode debug (?debug=1)
    if (IS_DEBUG_MODE) {
        gpsStatusElement.textContent = "Simulation mode enabled (GPS ignored)";
        gpsStatusElement.className = "gps-ok";
        if (openMapBtn) openMapBtn.classList.add('hidden');
        setAdventureUnlocked(true);
        return;
    }

    // Vérifie le support de la géolocalisation
    if (!navigator.geolocation) {
        gpsStatusElement.textContent = "GPS is not supported by your browser.";
        gpsStatusElement.className = "gps-error";
        setAdventureUnlocked(false);
        return;
    }

    // Démarre la vérification GPS en temps réel
    watchId = navigator.geolocation.watchPosition((position) => {
        const userLat = position.coords.latitude;
        const userLon = position.coords.longitude;

        lastKnownUserLat = userLat;
        lastKnownUserLon = userLon;

        const distance = Math.round(getDistanceFromLatLonInM(userLat, userLon, TARGET_LAT, TARGET_LON));

        if (distance <= TARGET_RADIUS) {
            gpsStatusElement.textContent = `Position confirmed ! (${distance}m)`;
            gpsStatusElement.className = "gps-ok";
            if (openMapBtn) openMapBtn.classList.add('hidden');
            closeMapPopup();
            setAdventureUnlocked(true);
        } else {
            gpsStatusElement.textContent = `Come closer ! You are at ${distance}m (max: ${TARGET_RADIUS}m)`;
            gpsStatusElement.className = "gps-waiting";
            if (openMapBtn) openMapBtn.classList.remove('hidden');
            setAdventureUnlocked(false);

            if (!mapPopupShown && !IS_DEBUG_MODE) {
                mapPopupShown = true;
                openMapPopup();
            } else if (mapInstance && !mapPopup.classList.contains('hidden')) {
                const now = Date.now();
                if (now - lastRoutingUpdate > 10000) {
                    routingControl.setWaypoints([
                        L.latLng(lastKnownUserLat, lastKnownUserLon),
                        L.latLng(TARGET_LAT, TARGET_LON)
                    ]);
                    lastRoutingUpdate = now;
                }
            }
        }
    }, (error) => {
        console.warn('Erreur GPS:', error);
        gpsStatusElement.textContent = "Please allow access to GPS to play the game.";
        gpsStatusElement.className = "gps-error";
        setAdventureUnlocked(false);
    }, {
        enableHighAccuracy: true,
        maximumAge: 3000
    });
}

// On lance le check GPS dès que la page s'ouvre
initGPS();

// Tente de lancer la musique du menu au chargement
if (gameState === 'start') {
    bgm.menu.play().catch(e => console.log("Autoplay bloqué (normal s'il n'y a pas eu de clic) :", e));
}

if (typeof signalGameState === 'function') {
    signalGameState('menu', 'start');
}

// Démarre la boucle
requestAnimationFrame(gameLoop);
