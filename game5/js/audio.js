// ==================== Ressources audio ====================
const audio = {
    bgm: new Audio("audio/backmusic.mp3"),
    thunder: new Audio("audio/thunder.mp3"),
    loseBgm: new Audio("audio/losemusic.mp3"),
    win: new Audio("audio/victory-yell.mp3"),
    spawn: new Audio("audio/spawn.mp3"),
    lose: new Audio("audio/you-lose.mp3"),
    hit: new Audio("audio/hero-damage.mp3"),
    jumpHero: new Audio("audio/jump-hero.mp3"),
    footstep: new Audio("audio/pas-hero.mp3"),
    jumpBoss: new Audio("audio/jump-boss.mp3"),
    bossStep: new Audio("audio/pas-boss.mp3"),
    bossHit: new Audio("audio/boss-hit.mp3"),
    deadBoss: new Audio("audio/deadboss.mp3"),
    epee: new Audio("audio/epee.mp3"),
    swoosh: new Audio("audio/swoosh.mp3"),
    throw: new Audio("audio/throw.mp3"),
    bossLand: new Audio("audio/boss-atterissage.mp3"),
    evilLaugh: new Audio("audio/evil-laugh.mp3"),
    heroFalling: new Audio("audio/crideadhero.mp3"),
    deadHero: new Audio("audio/deadhero.mp3"),
    criDeadHero: new Audio("audio/hero-falling.mp3"),
    bossHurt: new Audio("audio/bossdamage.mp3"),
    fight: new Audio("audio/fight.mp3"),
    rotation: new Audio("audio/rotation.mp3"),
    chronorouage: new Audio("audio/chronorouage.mp3")
};

// ==================== Initialisation des pistes audio ====================
const audioKeys = Object.keys(audio);

audioKeys.forEach(key => {
    const a = audio[key];
    a.preload = "none"; // VITAL POUR IOS : Empêche la saturation RAM au chargement de la page
    a.playsInline = true;
});

audio.bgm.loop = true;
audio.bgm.volume = 0.05;
audio.thunder.loop = true;
audio.thunder.volume = 0.5;
audio.loseBgm.volume = 0.3;

// ==================== Pools de lecture et anti-spam ====================
const audioPools = {};
const soundsToPool = ["hit", "footstep", "bossStep", "epee", "swoosh", "jumpHero"];

audioKeys.forEach(key => {
    if (key === "bgm" || key === "loseBgm") return;

    if (soundsToPool.includes(key)) {
        audioPools[key] = [audio[key], audio[key].cloneNode(), audio[key].cloneNode()];
        audioPools[key].currentIndex = 0;
    }
});

const rateLimits = { footstep: 150, hit: 220, epee: 180, swoosh: 160, jumpHero: 200 };
const lastPlayTime = {};

// ==================== État audio global ====================
let audioEnabled = true;
let audioUnlocked = false;
let audioUnlockPromise = null;

// ==================== API de controle audio ====================
function setAudioEnabled(enabled) {
    audioEnabled = enabled;
    if (!audioEnabled) {
        audioUnlocked = false;
        audioUnlockPromise = null;
        Object.values(audio).forEach(a => {
            try {
                a.pause();
                a.currentTime = 0;
            } catch (e) { /* ignore reset issues */ }
        });
    }
}

function isAudioEnabled() {
    return audioEnabled;
}

function withinRateLimit(snd) {
    const limit = rateLimits[snd];
    if (!limit) return true;
    const now = performance.now();
    if (lastPlayTime[snd] && now - lastPlayTime[snd] < limit) return false;
    lastPlayTime[snd] = now;
    return true;
}

// ==================== Déverrouillage audio (iOS/Safari) ====================
function unlockAudio() {
    if (!audioEnabled) return Promise.resolve(false);
    if (audioUnlocked) return Promise.resolve(true);
    if (audioUnlockPromise) return audioUnlockPromise;

    // Sur iOS moderne, débloquer UN seul audio lors d'un "clic" utilisateur 
    // débloque la capacité de jouer tous les autres éléments de la page ensuite.
    const bgm = audio.bgm;
    bgm.muted = true;

    const playPromise = bgm.play();
    if (playPromise === undefined) {
        bgm.pause();
        bgm.currentTime = 0;
        bgm.muted = false;
        audioUnlocked = true;
        return Promise.resolve(true);
    }

    audioUnlockPromise = playPromise
        .then(() => {
            bgm.pause();
            bgm.currentTime = 0;
            bgm.muted = false;

            // Déverrouille aussi la piste d'orage pour Safari/iOS.
            const thunder = audio.thunder;
            thunder.muted = true;
            const thunderPromise = thunder.play();
            if (thunderPromise !== undefined) {
                return thunderPromise.then(() => {
                    thunder.pause();
                    thunder.currentTime = 0;
                    thunder.muted = false;
                }).catch(() => {
                    thunder.muted = false;
                });
            }

            thunder.pause();
            thunder.currentTime = 0;
            thunder.muted = false;
            return Promise.resolve();
        })
        .then(() => {
            audioUnlocked = true;
            return true;
        })
        .catch(() => {
            audioUnlocked = false; // On réessaiera au prochain clic
            bgm.muted = false;
            return false;
        })
        .finally(() => {
            audioUnlockPromise = null;
        });

    return audioUnlockPromise;
}

// ==================== Ambiances (musique et orage) ====================
function startBgm({ restart = false } = {}) {
    if (!audioEnabled) return;
    const bgm = audio.bgm;

    const playNow = () => {
        if (restart) bgm.currentTime = 0;
        const playPromise = bgm.play();
        if (playPromise !== undefined) {
            playPromise.catch(() => { });
        }
    };

    if (audioUnlocked) {
        playNow();
        return;
    }

    unlockAudio().then((ready) => {
        if (!ready || !audioEnabled) return;
        playNow();
    });
}

function startThunder() {
    if (!audioEnabled || !audioUnlocked) return;
    const thunder = audio.thunder;
    if (!thunder.paused) return;

    const playPromise = thunder.play();
    if (playPromise !== undefined) {
        playPromise.catch(() => { });
    }
}

function stopThunder() {
    const thunder = audio.thunder;
    if (thunder.paused && thunder.currentTime === 0) return;
    thunder.pause();
    thunder.currentTime = 0;
}

// ==================== Effets sonores ====================
function playSound(snd) {
    if (!audioEnabled || !audioUnlocked) return;
    if (!withinRateLimit(snd)) return;

    let soundToPlay;

    if (audioPools[snd]) {
        const pool = audioPools[snd];
        soundToPlay = pool[pool.currentIndex];
        pool.currentIndex = (pool.currentIndex + 1) % pool.length;
    } else if (audio[snd]) {
        soundToPlay = audio[snd];
    } else {
        return;
    }

    if (snd === "heroFalling") soundToPlay.currentTime = 0.55;
    else if (snd === "deadBoss") soundToPlay.currentTime = 1.0;
    else if (snd === "bossHurt") soundToPlay.currentTime = 0.4;
    else if (snd === "epee") soundToPlay.currentTime = 0.1;
    else if (snd === "rotation") soundToPlay.currentTime = 6.7;
    else soundToPlay.currentTime = 0;

    if (snd === "jumpHero") soundToPlay.volume = 1.0;
    else if (snd === "footstep") soundToPlay.volume = 0.3;
    else if (snd === "bossStep") soundToPlay.volume = 0.2;
    else if (snd === "bossLand") soundToPlay.volume = 0.2;
    else if (snd === "evilLaugh") soundToPlay.volume = 0.15;
    else if (snd === "hit") soundToPlay.volume = 0.35;
    else if (snd === "bossHit" || snd === "bossHurt" || snd === "epee" || snd === "swoosh") soundToPlay.volume = 0.35;
    else if (snd === "deadBoss") soundToPlay.volume = 0.35;
    else if (snd === "spawn" || snd === "fight") soundToPlay.volume = 0.4;
    else if (snd === "rotation") soundToPlay.volume = 0.36;
    else if (snd === "chronorouage") soundToPlay.volume = 0.45;
    else if (snd === "deadHero" || snd === "criDeadHero" || snd === "heroFalling") soundToPlay.volume = 0.3;
    else if (snd === "win") soundToPlay.volume = 0.4;
    else if (snd === "lose") soundToPlay.volume = 0.3;

    const playPromise = soundToPlay.play();

    // Arrêts stricts pour ne pas saturer les canaux iOS
    if (snd === "jumpHero") {
        setTimeout(() => { try { soundToPlay.pause(); } catch (e) { } }, 250);
    }
    if (snd === "bossStep") {
        setTimeout(() => { try { soundToPlay.pause(); } catch (e) { } }, 200);
    }
    if (snd === "deadBoss") {
        setTimeout(() => { try { soundToPlay.pause(); } catch (e) { } }, 1000);
    }
    if (snd === "hit") {
        setTimeout(() => { try { soundToPlay.pause(); } catch (e) { } }, 650);
    }
    if (snd === "rotation") {
        setTimeout(() => {
            try {
                soundToPlay.pause();
                soundToPlay.currentTime = 0;
            } catch (e) { }
        }, 3600);
    }

    if (playPromise !== undefined) {
        playPromise.catch(() => { }); // Absorbe les erreurs Safari silencieusement
    }
}

// ==================== Exports ====================
export { audio, unlockAudio, startBgm, playSound, setAudioEnabled, isAudioEnabled, startThunder, stopThunder };