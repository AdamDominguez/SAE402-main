// on configure les constantes et on lit l'url pour les modes debug ou reset
const SAVE_KEY = 'epopee_progress';
const START_LEVEL = 1;
const HUB_QUERY = new URLSearchParams(window.location.search);
const IS_DEBUG_MODE = HUB_QUERY.get('debug') === '1';
const SHOULD_RESET_PROGRESS = HUB_QUERY.get('reset') === '1';
const FORCED_START_LEVEL = Number(HUB_QUERY.get('start'));

// la liste des chapitres du jeu avec leurs infos et chemins de fichiers
const storyData = [
    {
        gameId: 1,
        title: "Chapter 1 — The Origin",
        text: 'The village',
        file: 'game1/index.html?embedded=1&gameId=1'
    },
    {
        gameId: 2,
        title: "Chapter 2 - The Punishment",
        text: "You're holding the stone... Watch out for the tomatoes!",
        file: 'game2/index.html?embedded=1&gameId=2'
    },
    {
        gameId: 3,
        title: "Chapter 3 — The Lost Masterpiece",
        text: 'The villagers are becoming increasingly aggressive.',
        file: 'game3/index.html?embedded=1&gameId=3'
    },
    {
        gameId: 4,
        title: "Chapter 4 — Hope",
        text: 'The border is in sight.',
        file: 'game4/index.html?embedded=1&gameId=4'
    },
    {
        gameId: 5,
        title: 'Chapter 5 — The Guardian',
        text: 'The final showdown.',
        file: 'game5/index.html?embedded=1&gameId=5'
    }
];

// on crée une sauvegarde par défaut si c'est la première fois qu'on joue
function createDefaultProgress() {
    return {
        version: 1,
        currentLevel: START_LEVEL,
        completedLevels: [],
        variables: {
            tomatoesTotal: 0
        },
        updatedAt: new Date().toISOString()
    };
}

// on lit la sauvegarde dans le stockage du navigateur et on vérifie que tout est valide
function readProgress() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return createDefaultProgress();

    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') {
            return createDefaultProgress();
        }

        if (parsed.version !== 1) {
            return createDefaultProgress();
        }

        return {
            version: 1,
            currentLevel: Number(parsed.currentLevel) || START_LEVEL,
            completedLevels: Array.isArray(parsed.completedLevels) ? parsed.completedLevels : [],
            variables: parsed.variables && typeof parsed.variables === 'object' ? parsed.variables : {},
            updatedAt: parsed.updatedAt || new Date().toISOString()
        };
    } catch {
        return createDefaultProgress();
    }
}

// on sauvegarde la progression avec la date actuelle
function saveProgress(progress) {
    progress.updatedAt = new Date().toISOString();
    localStorage.setItem(SAVE_KEY, JSON.stringify(progress));
}

// on récupère tous les éléments html dont on aura besoin pour l'interface
const storyTitle = document.getElementById('story-title');
const storyText = document.getElementById('story-text');
const gameFrame = document.getElementById('game-frame');
const storyOverlay = document.getElementById('story-overlay');
const launchGameBtn = document.getElementById('launch-game-btn');
const continueBtn = document.getElementById('continue-btn');
const resetBtn = document.getElementById('reset-btn');
const hubHeader = document.getElementById('hub-header');
const menuElement = document.querySelector('.menu');
const burgerElement = document.querySelector('.burger');
const fondElement = document.querySelector('.fond');
const gameQuickLinks = document.querySelectorAll('.menu a[data-game-id]');

// on démarre avec les variables de base
let progress = readProgress();
let pendingFrameUrl = '';
let canContinueAdventure = false;
let isSessionForceDebug = false;

// on gère l'affichage des boutons selon si on est dans le menu ou à la fin d'un jeu
function showButtonsForMenuType(menuType) {
    launchGameBtn.style.display = 'inline-block';
    continueBtn.textContent = 'Go to the next game';

    if (menuType === 'victory') {
        continueBtn.style.display = 'inline-block';
        return;
    }

    continueBtn.style.display = 'none';
}

// si on a demandé un reset dans l'url, on efface tout
if (SHOULD_RESET_PROGRESS) {
    localStorage.removeItem(SAVE_KEY);
    progress = createDefaultProgress();
}

// si on force un niveau spécifique via l'url, on met à jour la sauvegarde
if (
    Number.isInteger(FORCED_START_LEVEL) &&
    FORCED_START_LEVEL >= 1 &&
    FORCED_START_LEVEL <= storyData.length
) {
    progress.currentLevel = FORCED_START_LEVEL;
    saveProgress(progress);
}

// petites fonctions pour trouver le bon niveau facilement
function findLevelConfig(level) {
    return storyData[level - 1] || null;
}

function findLevelByGameId(gameId) {
    return storyData.find((level) => level.gameId === gameId) || null;
}

// on fabrique l'url du jeu à charger dans l'iframe avec le mode debug si besoin
function buildFrameUrl(levelData, forceDebug = false) {
    const frameUrl = new URL(levelData.file, window.location.href);
    if (IS_DEBUG_MODE || forceDebug || isSessionForceDebug) {
        frameUrl.searchParams.set('debug', '1');
    }

    return frameUrl.toString();
}

// on gère l'ouverture et fermeture du menu latéral (burger)
function burgerToggle() {
    menuElement.classList.toggle('menu-active');
    document.querySelector('.john').classList.toggle('john-active');
    document.querySelector('.joe').classList.toggle('joe-active');
    document.querySelector('.johnny').classList.toggle('johnny-active');
    fondElement.classList.toggle('fond-active');
}

function closeMenu() {
    menuElement.classList.remove('menu-active');
    document.querySelector('.john').classList.remove('john-active');
    document.querySelector('.joe').classList.remove('joe-active');
    document.querySelector('.johnny').classList.remove('johnny-active');
    fondElement.classList.remove('fond-active');
}

// on prépare l'écran pour afficher le niveau en cours ou l'écran de fin total
function loadLevel(level) {
    const data = findLevelConfig(level);
    if (!data) {
        storyTitle.textContent = 'Adventure over';
        storyText.textContent = 'Congratulations! You\'ve completed all 5 games.';
        storyOverlay.classList.remove('hidden');
        hubHeader.classList.remove('hidden');
        launchGameBtn.style.display = 'none';
        continueBtn.style.display = 'none';
        gameFrame.removeAttribute('src');
        return;
    }

    progress.currentLevel = level;
    saveProgress(progress);

    storyTitle.textContent = data.title;
    storyText.textContent = data.text;
    launchGameBtn.style.display = 'inline-block';
    continueBtn.style.display = canContinueAdventure ? 'inline-block' : 'none';
    continueBtn.textContent = 'Go to the next game';

    pendingFrameUrl = buildFrameUrl(data);
    storyOverlay.classList.remove('hidden');
    hubHeader.classList.remove('hidden');
}

// on lance vraiment le niveau dans l'iframe et on cache les menus
function startPendingLevel() {
    if (!pendingFrameUrl) return;

    gameFrame.src = pendingFrameUrl;
    canContinueAdventure = false;

    closeMenu();
    storyOverlay.classList.add('hidden');
    hubHeader.classList.add('hidden');
}

// on joue la petite vidéo de transition avant de charger le niveau
function launchWithTransition() {
    const video = document.getElementById('transition-video');
    if (video) {
        video.style.display = 'block';
        video.currentTime = 0;
        video.play().catch(() => { });
        video.onended = () => {
            video.style.display = 'none';
        };
    }
    startPendingLevel();
}

function returnToCurrentGameView() {
    closeMenu();
    storyOverlay.classList.add('hidden');
    hubHeader.classList.add('hidden');
}

// on vérifie si on doit charger un nouveau niveau ou juste retourner au jeu en pause
function launchGameFromOverlay() {
    const activeSrc = gameFrame.getAttribute('src');
    const shouldLoadPending = pendingFrameUrl && (!activeSrc || gameFrame.src !== pendingFrameUrl);

    if (shouldLoadPending) {
        startPendingLevel();
        return;
    }

    if (activeSrc) {
        returnToCurrentGameView();
    }
}

// on valide un niveau, on compte les stats et on passe au suivant
function markLevelComplete(gameId, payload = {}) {
    if (!progress.completedLevels.includes(gameId)) {
        progress.completedLevels.push(gameId);
    }

    if (payload.stats && typeof payload.stats === 'object') {
        const tomatoesTaken = Number(payload.stats.tomatoesTaken);
        if (!Number.isNaN(tomatoesTaken)) {
            const current = Number(progress.variables.tomatoesTotal) || 0;
            progress.variables.tomatoesTotal = current + tomatoesTaken;
        }
    }

    if (progress.currentLevel <= storyData.length) {
        progress.currentLevel = Math.min(storyData.length + 1, progress.currentLevel + 1);
    }

    canContinueAdventure = true;
    saveProgress(progress);
}

// on envoie la progression actuelle au jeu chargé dans l'iframe
function postContextToGame() {
    const activeData = findLevelConfig(progress.currentLevel);
    if (!activeData || !gameFrame.contentWindow) return;

    gameFrame.contentWindow.postMessage(
        {
            type: 'GAME_CONTEXT',
            payload: {
                currentLevel: progress.currentLevel,
                variables: progress.variables
            }
        },
        window.location.origin
    );
}

// on écoute tous les messages envoyés par le jeu dans l'iframe
window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) return;
    if (event.source !== gameFrame.contentWindow) return;

    const data = event.data;
    if (!data || typeof data !== 'object' || !data.type) return;

    // quand le jeu est prêt, on lui donne son contexte
    if (data.type === 'GAME_READY') {
        postContextToGame();
        return;
    }

    // pour cacher ou afficher le menu selon l'état du jeu
    if (data.type === 'GAME_STATE') {
        const payload = data.payload && typeof data.payload === 'object' ? data.payload : {};
        const state = payload.state;
        const gameId = Number(payload.gameId);
        const menuType = payload.menuType;

        if (state === 'menu') {
            const hasWonThisGame = progress.completedLevels.includes(gameId);
            canContinueAdventure = hasWonThisGame;
            showButtonsForMenuType(menuType);

            hubHeader.classList.remove('hidden');
            storyOverlay.classList.remove('hidden');
        }

        if (state === 'playing') {
            hubHeader.classList.add('hidden');
            storyOverlay.classList.add('hidden');
            closeMenu();
        }

        return;
    }

    // on gère les vibrations demandées par le mini-jeu
    if (data.type === 'GAME_VIBRATE') {
        const payload = data.payload && typeof data.payload === 'object' ? data.payload : {};
        const pattern = payload.pattern;

        if (navigator.vibrate && (typeof pattern === 'number' || Array.isArray(pattern))) {
            navigator.vibrate(pattern);
        }

        return;
    }

    // quand le jeu est gagné, on valide le niveau en arrière-plan
    if (data.type === 'GAME_COMPLETE') {
        const payload = data.payload && typeof data.payload === 'object' ? data.payload : {};
        const gameId = Number(payload.gameId);

        const expectedGame = findLevelConfig(progress.currentLevel);
        if (!expectedGame) return;
        if (gameId !== expectedGame.gameId) return;

        if (progress.completedLevels.includes(gameId)) {
            return;
        }

        markLevelComplete(gameId, payload);
        return;
    }

    // quand le joueur clique sur le bouton "suivant" dans le jeu
    if (data.type === 'GAME_CONTINUE') {
        const payload = data.payload && typeof data.payload === 'object' ? data.payload : {};
        const gameId = Number(payload.gameId);

        if (!progress.completedLevels.includes(gameId)) {
            const expectedGame = findLevelConfig(progress.currentLevel);
            if (!expectedGame || expectedGame.gameId !== gameId) {
                return;
            }

            markLevelComplete(gameId, {});
        } else {
            // on avance quand même si le niveau est déjà validé pour pas rester bloqué
            if (progress.currentLevel === gameId && progress.currentLevel <= storyData.length) {
                progress.currentLevel = Math.min(storyData.length + 1, progress.currentLevel + 1);
                saveProgress(progress);
            }
        }

        const nextLevelData = findLevelConfig(progress.currentLevel);
        if (!nextLevelData) {
            loadLevel(progress.currentLevel);
            return;
        }

        pendingFrameUrl = buildFrameUrl(nextLevelData);
        launchWithTransition();
        return;
    }
});

// on réinitialise tout quand on clique sur le bouton de reset
resetBtn.addEventListener('click', () => {
    localStorage.removeItem(SAVE_KEY);
    progress = createDefaultProgress();
    canContinueAdventure = false;
    loadLevel(progress.currentLevel);
});

continueBtn.addEventListener('click', () => {
    launchWithTransition();
});

// --- SHAMAN CINEMATIC LOGIC ---
// on prépare les éléments et musiques pour la cinématique de début
const cinematicOverlay = document.getElementById('cinematic-overlay');
const cinematicText = document.getElementById('cinematic-text');
const cinematicDialogueBox = document.getElementById('cinematic-dialogue-box');
const cinematicShamanImg = document.getElementById('cinematic-shaman');

const shamanBgm = new Audio('son/musique/szegvaria-abadoned-pyramid-atmo-orchestral-and-drone-sad-mood-9237.mp3');
shamanBgm.loop = true;
shamanBgm.volume = 0.6;

const shamanDialogueSfx = new Audio('son/dialogue/creatorshome-video-game-text-330163.mp3');
shamanDialogueSfx.loop = true;
shamanDialogueSfx.volume = 0.8;

// les phrases que le chaman va nous dire
const shamanIntroLines = [
    "Adventurer... I've been waiting for you. The fate of Mulhouse lies in your hands.",
    "A legendary artifact called Chronorouage has been shattered and scattered! Without it, time is thrown into chaos.",
    "You'll have to overcome many challenges throughout the ages to recover the fragments.",
    "Go find them. The adventure begins now!"
];

let cinematicActive = false;
let currentLineIndex = 0;
let isTyping = false;
let typingTimeouts = [];
let cinematicOnComplete = null;
let hasSeenShamanIntro = false;

// on lance la scène du chaman
function showShamanCinematic(onComplete) {
    if (!cinematicOverlay || !cinematicOverlay.classList.contains('hidden')) return;

    cinematicActive = true;
    cinematicOnComplete = onComplete;
    storyOverlay.classList.add('hidden');
    cinematicOverlay.classList.remove('hidden');
    currentLineIndex = 0;
    cinematicShamanImg.src = 'img/Shaman/shaman.png';

    shamanBgm.currentTime = 0;
    shamanBgm.play().catch(e => console.warn(e));

    playCinematicLine();
}

// on affiche le texte lettre par lettre pour faire un style rpg
function playCinematicLine() {
    if (currentLineIndex >= shamanIntroLines.length) {
        cinematicActive = false;
        cinematicOverlay.classList.add('hidden');
        shamanBgm.pause();
        if (cinematicOnComplete) cinematicOnComplete();
        return;
    }

    if (currentLineIndex === shamanIntroLines.length - 1) {
        cinematicShamanImg.src = 'img/Shaman/shaman_pouvoir.png';
    }

    const line = shamanIntroLines[currentLineIndex];
    let html = "";
    for (let i = 0; i < line.length; i++) {
        let char = line[i];
        if (char === ' ') {
            // on gère les espaces pour les retours à la ligne
            html += `<span class="lettre" style="white-space: pre;"> </span>`;
        } else {
            html += `<span class="lettre">${char}</span>`;
        }
    }
    cinematicText.innerHTML = html;

    const letters = cinematicText.querySelectorAll('.lettre');
    typingTimeouts.forEach(clearTimeout);
    typingTimeouts = [];
    isTyping = true;

    shamanDialogueSfx.currentTime = 0;
    shamanDialogueSfx.play().catch(e => console.warn(e));

    letters.forEach((l, index) => {
        let t = setTimeout(() => {
            l.classList.add('visible');
            if (index === letters.length - 1) {
                isTyping = false;
                shamanDialogueSfx.pause();
            }
        }, 35 * index);
        typingTimeouts.push(t);
    });
}

// si on clique, on affiche toute la phrase d'un coup
function finishTypingInstantly() {
    typingTimeouts.forEach(clearTimeout);
    typingTimeouts = [];
    const letters = cinematicText.querySelectorAll('.lettre');
    letters.forEach(l => l.classList.add('visible'));
    isTyping = false;
    shamanDialogueSfx.pause();
}

// on gère les clics pour avancer dans les dialogues
if (cinematicOverlay) {
    cinematicOverlay.addEventListener('click', () => {
        if (!cinematicActive) return;

        if (isTyping) {
            finishTypingInstantly();
        } else {
            currentLineIndex++;
            playCinematicLine();
        }
    });
}
// --- FIN SHAMAN CINEMATIC LOGIC ---

// le bouton jouer principal : il lance la cinématique si on commence juste
launchGameBtn.addEventListener('click', () => {
    if (progress.currentLevel === 1 && progress.completedLevels.length === 0 && !hasSeenShamanIntro) {
        showShamanCinematic(() => {
            hasSeenShamanIntro = true;
            launchWithTransition();
        });
        return;
    }

    launchGameFromOverlay();
});

burgerElement.addEventListener('click', burgerToggle);
fondElement.addEventListener('click', closeMenu);

// on gère les liens rapides du menu pour que les profs puissent tester facilement
for (const link of gameQuickLinks) {
    link.addEventListener('click', (event) => {
        event.preventDefault();

        const gameId = Number(link.dataset.gameId);
        const levelData = findLevelByGameId(gameId);
        if (!levelData) return;

        progress.currentLevel = gameId;
        saveProgress(progress);
        isSessionForceDebug = true;

        storyTitle.textContent = levelData.title;
        storyText.textContent = `${levelData.text} (Teacher grading mode)`;
        pendingFrameUrl = buildFrameUrl(levelData, true);
        canContinueAdventure = false;

        launchGameBtn.style.display = 'inline-block';
        continueBtn.style.display = 'none';
        continueBtn.textContent = 'Go to the next game';

        closeMenu();
        storyOverlay.classList.remove('hidden');
        hubHeader.classList.remove('hidden');
    });
}

// on charge le bon niveau tout de suite au démarrage de la page
loadLevel(progress.currentLevel);