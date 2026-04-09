// ==================== Importations ====================
import {
    pauseBtn, startBtn, resumeBtn, startOverlay, pauseOverlay,
    audioToggleBtn, audioTogglePauseBtn, controls,
    gpsBtn, gpsInfo, distanceText, compassArrow,
    directionText, openMapBtn, mapPopup, closeMapBtn, mapElement,
    gpsScreen, mainContent
} from "./config.js";
import { audio, unlockAudio, startBgm, playSound, setAudioEnabled } from "./audio.js";
import { gameState } from "./state.js";
import { resetGame, startGameLoop } from "./gameplay.js";
import { initTouchInput, enableCloudTiltControls } from "./input.js";

// ==================== État global (audio/initialisation) ====================
let audioOn = true;
let gameInitialized = false;
let dialogueAudioPrimed = false;
let dialoguePrimePromise = null;

// ==================== Paramètres GPS ====================
const TARGET_LAT = 47.742733;
const TARGET_LNG = 7.348133;
const MAX_DISTANCE = 30; // metres

// ==================== État de suivi GPS/carte ====================
let userLat = null;
let userLng = null;
let userHeading = 0;
let gpsWatchId = null;
let mapPopupShown = false;
let mapInstance = null;
let routingControl = null;
let lastRoutingUpdate = 0;

const locationQuery = new URLSearchParams(window.location.search);
const IS_DEBUG_MODE = locationQuery.get("dev") === "1" || locationQuery.get("debug") === "1";

// ==================== Utilitaires audio des dialogues ====================
function getDialogueTracks() {
    return [
        document.getElementById("dialogue_son"),
        document.getElementById("dialogue_son_boss")
    ].filter(Boolean);
}

function primeDialogueAudio() {
    if (dialogueAudioPrimed) return Promise.resolve();
    if (dialoguePrimePromise) return dialoguePrimePromise;

    const tracks = getDialogueTracks();
    if (!tracks.length) return Promise.resolve();

    let hasUnlockedTrack = false;

    dialoguePrimePromise = Promise.all(tracks.map((track) => {
        track.muted = true;

        const playPromise = track.play();
        if (playPromise === undefined) {
            track.pause();
            track.currentTime = 0;
            track.muted = !audioOn;
            hasUnlockedTrack = true;
            return Promise.resolve(true);
        }

        return playPromise
            .then(() => {
                // Si la piste a deja ete reprise pour un vrai dialogue,
                // ne pas la couper a la fin du priming asynchrone.
                if (track.muted) {
                    track.pause();
                    track.currentTime = 0;
                }
                hasUnlockedTrack = true;
                return true;
            })
            .catch(() => false)
            .finally(() => {
                track.muted = !audioOn;
            });
    }))
        .finally(() => {
            dialogueAudioPrimed = hasUnlockedTrack;
            dialoguePrimePromise = null;
            syncDialogueAudioState();
        });

    return dialoguePrimePromise;
}

// ==================== Adaptation viewport mobile ====================
function syncViewportHeight() {
    const viewportHeight = window.visualViewport && window.visualViewport.height
        ? window.visualViewport.height
        : window.innerHeight;
    document.documentElement.style.setProperty("--app-vh", `${Math.round(viewportHeight)}px`);
}

syncViewportHeight();
window.addEventListener("resize", syncViewportHeight);
window.addEventListener("orientationchange", syncViewportHeight);
if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", syncViewportHeight);
}

// ==================== Références DOM (dialogues/overlays) ====================
const introDialogue = document.getElementById("introDialogue");
const finalDialogueOverlay = document.getElementById("finalDialogue");
const introSprite = document.getElementById("introHero");
const dialogueName = document.getElementById("dialogueName");
const dialogueBox = document.getElementById("dialogueBox");
const dialogueNextBtn = document.getElementById("dialogueNextBtn");
const dialogueCard = introDialogue ? introDialogue.querySelector(".boite_dialogue") : null;
const defaultDialogueNextText = dialogueNextBtn ? dialogueNextBtn.textContent : "Tap to continue";

// ==================== Helpers interface de combat ====================
function isVisible(element) {
    return !!element && element.style.display !== "none";
}

function canShowCombatHud() {
    return gameState.gameStarted &&
        !gameState.gameOver &&
        !gameState.victory &&
        !isVisible(startOverlay) &&
        !isVisible(introDialogue) &&
        !isVisible(finalDialogueOverlay);
}

function setCombatHudVisible(visible) {
    controls.style.display = visible ? "flex" : "none";
    if (pauseBtn) pauseBtn.style.display = visible ? "block" : "none";
}

function syncDialogueAudioState() {
    const dialogueTracks = getDialogueTracks();

    dialogueTracks.forEach((track) => {
        track.muted = !audioOn;
        if (!audioOn) {
            track.pause();
            track.currentTime = 0;
        }
    });
}

setCombatHudVisible(false);

// ==================== Données et état du dialogue d'introduction ====================
const introLines = [
    {
        speaker: "Hero",
        text: "... Finally! There he is! I can feel his aura from afar.",
        theme: "hero",
        sprite: "./img/hero.png"
    },
    {
        speaker: "The Schweissdissi",
        text: "You still dare to stand against me? I will crush you into nothingness.",
        theme: "boss",
        sprite: "./img/boss.png"
    },
    {
        speaker: "Hero",
        text: "Try it. Every attack you launch brings you closer to your downfall.",
        theme: "hero",
        sprite: "./img/hero.png"
    },
    {
        speaker: "The Schweissdissi",
        text: "Your words ring hollow, little human. Come, I'm waiting for you.",
        theme: "boss",
        sprite: "./img/boss.png"
    }
];

let introStep = 0;
let introDone = false;
let introPromptVisible = false;
let introTransitioning = false;
let dialogueAnimationToken = 0;

// ==================== Moteur du dialogue d'introduction ====================
function runDialogueAnimation(line) {
    const token = ++dialogueAnimationToken;

    const launchDialogueAnimation = () => {
        if (token !== dialogueAnimationToken) return;

        if (typeof dialogue === "function") {
            dialogue("#dialogueBox", {
                playAudio: audioOn,
                audioId: line.theme === "boss" ? "dialogue_son_boss" : "dialogue_son"
            });
        }
    };

    if (audioOn && !dialogueAudioPrimed) {
        primeDialogueAudio().finally(launchDialogueAnimation);
        return;
    }

    launchDialogueAnimation();
}

function showStartMenu() {
    if (introDialogue) introDialogue.style.display = "none";
    pauseOverlay.style.display = "none";
    gameState.isPaused = false;
    setCombatHudVisible(false);
    startOverlay.style.display = "flex";
    if (window.signalGameState) window.signalGameState('menu', 'start');
}

function updateDialogueSpeakerState(line) {
    const isBoss = line.theme === "boss";

    if (dialogueName) {
        dialogueName.textContent = line.speaker;
    }

    if (introSprite) {
        introSprite.src = line.sprite;
        introSprite.alt = line.speaker;
        introSprite.classList.toggle("sprite-boss", isBoss);
        introSprite.classList.toggle("sprite-hero", !isBoss);
    }

    if (dialogueCard) {
        dialogueCard.classList.toggle("boite_dialogue_boss", isBoss);
        dialogueCard.classList.toggle("boite_dialogue_hero", !isBoss);
    }

    if (dialogueNextBtn) {
        dialogueNextBtn.classList.toggle("dialogue_button_boss", isBoss);
        dialogueNextBtn.classList.toggle("dialogue_button_hero", !isBoss);
    }
}

function showIntroStartPrompt() {
    introPromptVisible = true;

    if (typeof stopDialogueAudio === "function") {
        stopDialogueAudio();
    }

    updateDialogueSpeakerState({
        speaker: "Intro",
        theme: "hero",
        sprite: "./img/hero.png"
    });

    if (dialogueBox) {
        dialogueBox.innerText = "Tap to start";
    }

    if (dialogueNextBtn) {
        dialogueNextBtn.textContent = "Tap to start";
        dialogueNextBtn.classList.add("is-visible");
    }
}

function renderIntroLine() {
    if (!dialogueBox) return;

    const currentLine = introLines[introStep];
    updateDialogueSpeakerState(currentLine);

    dialogueBox.innerText = currentLine.text;
    if (dialogueNextBtn) {
        dialogueNextBtn.textContent = defaultDialogueNextText;
        dialogueNextBtn.classList.remove("is-visible");
    }
    runDialogueAnimation(currentLine);

    setTimeout(() => {
        if (dialogueNextBtn) dialogueNextBtn.classList.add("is-visible");
    }, currentLine.text.length * 50 + 150);
}

function nextIntroLine(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") {
            event.stopImmediatePropagation();
        }
    }

    if (introDone) return;
    if (introTransitioning) return;

    if (introPromptVisible) {
        introPromptVisible = false;
        renderIntroLine();
        return;
    }

    if (typeof stopDialogueAudio === "function") {
        stopDialogueAudio();
    }

    if (introStep < introLines.length - 1) {
        introStep += 1;
        renderIntroLine();
        return;
    }

    introDone = true;
    introTransitioning = true;
    setTimeout(() => {
        showStartMenu();
        introTransitioning = false;
    }, 80);
}

function startPreMenuDialogue() {
    if (!introDialogue || !dialogueBox || !dialogueNextBtn) {
        showStartMenu();
        return;
    }

    gameState.isPaused = false;
    pauseOverlay.style.display = "none";
    setCombatHudVisible(false);
    startOverlay.style.display = "none";
    introDialogue.style.display = "flex";
    introStep = 0;
    showIntroStartPrompt();
}

if (introDialogue) {
    introDialogue.addEventListener("touchend", nextIntroLine, { passive: false });
}

// ==================== Préférences audio utilisateur ====================
function refreshAudioToggleLabel() {
    if (audioToggleBtn) audioToggleBtn.textContent = audioOn ? "🔊 Sound on" : "🔇 Sound off";
    if (audioTogglePauseBtn) audioTogglePauseBtn.textContent = audioOn ? "🔊 Sound on" : "🔇 Sound off";
}

function applyAudioPreference() {
    setAudioEnabled(audioOn);
    syncDialogueAudioState();
    if (!audioOn) audio.bgm.pause();
    refreshAudioToggleLabel();
}

if (audioToggleBtn) {
    audioToggleBtn.addEventListener("touchend", (e) => {
        e.preventDefault();
        audioOn = !audioOn;
        applyAudioPreference();
    }, { passive: false });
}

if (audioTogglePauseBtn) {
    audioTogglePauseBtn.addEventListener("touchend", (e) => {
        e.preventDefault();
        audioOn = !audioOn;
        applyAudioPreference();
    }, { passive: false });
}

applyAudioPreference();

// ==================== Logique GPS et boussole ====================

function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const p1 = lat1 * Math.PI / 180;
    const p2 = lat2 * Math.PI / 180;
    const dp = (lat2 - lat1) * Math.PI / 180;
    const dl = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(dp / 2) * Math.sin(dp / 2) +
        Math.cos(p1) * Math.cos(p2) *
        Math.sin(dl / 2) * Math.sin(dl / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

function getBearing(lat1, lon1, lat2, lon2) {
    const p1 = lat1 * Math.PI / 180;
    const p2 = lat2 * Math.PI / 180;
    const dl = (lon2 - lon1) * Math.PI / 180;

    const y = Math.sin(dl) * Math.cos(p2);
    const x = Math.cos(p1) * Math.sin(p2) -
        Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
    const brng = Math.atan2(y, x);

    return (brng * 180 / Math.PI + 360) % 360;
}

// Fonction centrale qui libère le jeu
function unlockGame() {
    if (gpsWatchId !== null) navigator.geolocation.clearWatch(gpsWatchId);
    window.removeEventListener("deviceorientation", handleOrientation);
    window.removeEventListener("deviceorientationabsolute", handleOrientation);

    gpsScreen.style.display = "none";
    mainContent.style.display = "flex";
    gameState.isPaused = false;
    pauseOverlay.style.display = "none";
    setCombatHudVisible(false);

    if (!gameInitialized) {
        initTouchInput(resetGame, unlockAudio);
        startGameLoop();
        gameInitialized = true;
    }

    if (!introDone) {
        startPreMenuDialogue();
    } else {
        showStartMenu();
    }

    // Alerte CSS pour exiger le mode Paysage
    document.body.classList.remove("gps-pending");
    document.body.classList.add("game-ready");
}

function getDirectionInstruction(bearingFromUser) {
    const directions = ["North", "North-East", "East", "South-East", "South", "South-West", "West", "North-West"];
    const normalized = (bearingFromUser + 360) % 360;
    const index = Math.round(normalized / 45) % 8;
    return `Head towards ${directions[index]}`;
}

function openMapPopup() {
    if (!mapPopup || !mapElement || userLat === null || userLng === null) return;
    if (typeof window.L === "undefined") return;

    mapPopup.classList.remove("hidden");

    if (!mapInstance) {
        mapInstance = window.L.map("map").setView([userLat || TARGET_LAT, userLng || TARGET_LNG], 15);

        window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "© OpenStreetMap contributors"
        }).addTo(mapInstance);

        routingControl = window.L.Routing.control({
            waypoints: [
                window.L.latLng(userLat, userLng),
                window.L.latLng(TARGET_LAT, TARGET_LNG)
            ],
            language: "fr",
            routeWhileDragging: false,
            addWaypoints: false
        }).addTo(mapInstance);

        lastRoutingUpdate = Date.now();
    } else {
        mapInstance.setView([userLat, userLng], 15);
        if (routingControl) {
            routingControl.setWaypoints([
                window.L.latLng(userLat, userLng),
                window.L.latLng(TARGET_LAT, TARGET_LNG)
            ]);
            lastRoutingUpdate = Date.now();
        }
    }

    setTimeout(() => {
        if (mapInstance) mapInstance.invalidateSize();
    }, 150);
}

function closeMapPopup() {
    if (!mapPopup) return;
    mapPopup.classList.add("hidden");
}

function updateGPSUI() {
    if (userLat === null || userLng === null) return;

    const distance = getDistance(userLat, userLng, TARGET_LAT, TARGET_LNG);
    const bearing = getBearing(userLat, userLng, TARGET_LAT, TARGET_LNG);

    if (distance <= MAX_DISTANCE) {
        distanceText.innerHTML = `✅ You have arrived! (${Math.round(distance)}m)`;
        distanceText.style.color = "#2ecc71";
        if (directionText) directionText.textContent = "Direction: objective reached";
        compassArrow.parentElement.style.display = "none";
        if (openMapBtn) openMapBtn.classList.add("hidden");
        closeMapPopup();

        // Un petit délai de 1.5s pour que l'utilisateur lise "Vous êtes sur place" avant que l'écran ne disparaisse
        setTimeout(() => {
            unlockGame();
        }, 1500);
    } else {
        distanceText.innerHTML = `❌ Too far : ${Math.round(distance)}m<br><span style="font-size: 12px; font-weight: normal;">(Required : ${MAX_DISTANCE}m)</span>`;
        distanceText.style.color = "#e74c3c";
        compassArrow.parentElement.style.display = "flex";

        const arrowRotation = bearing - userHeading;
        compassArrow.style.transform = `rotate(${arrowRotation}deg)`;
        if (directionText) directionText.textContent = getDirectionInstruction(arrowRotation);
        if (openMapBtn) openMapBtn.classList.remove("hidden");

        if (!mapPopupShown && !IS_DEBUG_MODE) {
            mapPopupShown = true;
            openMapPopup();
        } else if (mapInstance && mapPopup && !mapPopup.classList.contains("hidden") && routingControl) {
            const now = Date.now();
            if (now - lastRoutingUpdate > 10000) {
                routingControl.setWaypoints([
                    window.L.latLng(userLat, userLng),
                    window.L.latLng(TARGET_LAT, TARGET_LNG)
                ]);
                lastRoutingUpdate = now;
            }
        }
    }
}

function handleOrientation(event) {
    if (event.webkitCompassHeading) {
        userHeading = event.webkitCompassHeading;
    } else if (event.alpha !== null) {
        userHeading = 360 - event.alpha;
    }
    updateGPSUI();
}

function bindTouchAndClick(element, handler) {
    if (!element) return;

    let lastTouchTimestamp = 0;

    element.addEventListener("touchend", (e) => {
        e.preventDefault();
        lastTouchTimestamp = Date.now();
        handler(e);
    }, { passive: false });

    element.addEventListener("click", (e) => {
        if (Date.now() - lastTouchTimestamp < 450) return;
        e.preventDefault();
        handler(e);
    });
}

function startGpsTracking() {
    if (audioOn) unlockAudio();
    primeDialogueAudio();
    gpsBtn.style.display = "none";
    gpsInfo.style.display = "flex";

    if (navigator.geolocation) {
        gpsWatchId = navigator.geolocation.watchPosition(
            (position) => {
                userLat = position.coords.latitude;
                userLng = position.coords.longitude;
                updateGPSUI();
            },
            () => {
                distanceText.innerHTML = "⚠️ GPS error. Please allow location access.";
                gpsBtn.style.display = "block";
                gpsInfo.style.display = "none";
            },
            { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
        );
    } else {
        distanceText.innerHTML = "⚠️ GPS not supported by your browser.";
    }

    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    window.addEventListener('deviceorientation', handleOrientation);
                }
            })
            .catch(console.error);
    } else {
        window.addEventListener('deviceorientationabsolute', handleOrientation);
        window.addEventListener('deviceorientation', handleOrientation);
    }
}

bindTouchAndClick(gpsBtn, startGpsTracking);

if (openMapBtn) {
    bindTouchAndClick(openMapBtn, () => {
        if (userLat !== null && userLng !== null) openMapPopup();
    });
}

if (closeMapBtn) {
    bindTouchAndClick(closeMapBtn, () => {
        closeMapPopup();
    });
}

if (IS_DEBUG_MODE) {
    distanceText.innerHTML = "Dev mode: GPS is ignored";
    if (directionText) directionText.textContent = "Direction : direct access";
    unlockGame();
}

// ==================== Contrôles de combat et pause ====================

startBtn.addEventListener("touchend", (e) => {
    e.preventDefault();
    if (!introDone || !isVisible(startOverlay) || isVisible(introDialogue) || isVisible(finalDialogueOverlay)) return;
    primeDialogueAudio();
    startOverlay.style.display = "none";
    gameState.gameStarted = true;
    gameState.isPaused = false;
    setCombatHudVisible(true);
    if (window.signalGameState) window.signalGameState('playing');

    // DEMANDE DES PERMISSIONS AU CLIC (VITAL POUR IOS)
    enableCloudTiltControls();

    if (audioOn && canShowCombatHud()) {
        unlockAudio();
        startBgm({ restart: true });
        playSound("spawn");
        playSound("fight");
    }
}, { passive: false });

pauseBtn.addEventListener("touchend", (e) => {
    e.preventDefault();
    if (!canShowCombatHud()) return;
    gameState.isPaused = true;
    pauseOverlay.style.display = "flex";
    setCombatHudVisible(false);
    audio.bgm.pause();
}, { passive: false });

resumeBtn.addEventListener("touchend", (e) => {
    e.preventDefault();
    if (!gameState.isPaused) return;
    gameState.isPaused = false;
    pauseOverlay.style.display = "none";

    if (!canShowCombatHud()) {
        setCombatHudVisible(false);
        audio.bgm.pause();
        return;
    }

    setCombatHudVisible(true);
    if (audioOn) {
        startBgm();
    }
}, { passive: false });

// ==================== Pré-déverrouillage audio au premier touch ====================
window.addEventListener("touchstart", () => {
    primeDialogueAudio();
}, { once: true, passive: true });