function getGameDimensions() {
    // Utilise visualViewport pour ignorer la barre d'adresse mobile
    const vh = window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight;
    const vw = window.visualViewport?.width || window.innerWidth || document.documentElement.clientWidth;
    const ratio = vh / vw;
    const logicWidth = 400;
    const logicHeight = Math.max(600, Math.round(logicWidth * ratio));
    return { logicWidth, logicHeight, vw, vh };
}

let { logicWidth, logicHeight, vw, vh } = getGameDimensions();

const config = {
    type: Phaser.AUTO,
    scale: {
        mode: Phaser.Scale.FIT,
        parent: 'game-container',
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: logicWidth,
        height: logicHeight,
        min: {
            width: 300,
            height: 400
        },
        max: {
            width: 600,
            height: 1200
        }
    },
    width: logicWidth,
    height: logicHeight,
    parent: 'game-container',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 800 },
            debug: false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

let game = null;
let currentScene = null;

// Écran de démarrage
document.addEventListener('DOMContentLoaded', () => {
    const startButton = document.getElementById('start-button');
    const startScreen = document.getElementById('start-screen');
    const geolocScreen = document.getElementById('geoloc-screen');
    const geolocButton = document.getElementById('geoloc-button');
    const geolocStatus = document.getElementById('geoloc-status');
    const showMapBtn = document.getElementById('show-map-btn');
    const mapModal = document.getElementById('map-modal');
    const closeMapBtn = document.getElementById('close-map-btn');
    const mapContainer = document.getElementById('map-container');

    let lMap = null;
    let lRouting = null;
    let lMarker = null;

    function buildLeafletMap(userLat, userLng) {
        if (!lMap) {
            lMap = L.map('leaflet-map');
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(lMap);
        }

        if (lRouting) {
            lRouting.remove();
            lRouting = null;
        }
        if (lMarker) {
            lMarker.remove();
            lMarker = null;
        }

        if (userLat !== null && userLng !== null) {
            lRouting = L.Routing.control({
                waypoints: [
                    L.latLng(userLat, userLng),
                    L.latLng(MUSEUM_LAT, MUSEUM_LNG)
                ],
                routeWhileDragging: false,
                addWaypoints: false,
                fitSelectedRoutes: false, // on désactive le dézoom massif
                show: false, // masque les instructions textuelles
                createMarker: function () { return null; } // on peut optionnellement cacher les marqueurs par defaut
            }).addTo(lMap);

            // on remet quand meme des marqueurs sympas
            L.marker([MUSEUM_LAT, MUSEUM_LNG]).addTo(lMap).bindPopup("Museum of Fine Arts");
            L.marker([userLat, userLng]).addTo(lMap).bindPopup("You are here!").openPopup();

            // On zoom direct sur l'utilisateur "cash"
            lMap.setView([userLat, userLng], 17);
        } else {
            lMap.setView([MUSEUM_LAT, MUSEUM_LNG], 15);
            lMarker = L.marker([MUSEUM_LAT, MUSEUM_LNG]).addTo(lMap)
                .bindPopup("<b>Museum of Fine Arts</b><br>Mulhouse").openPopup();
        }
    }

    if (showMapBtn) {
        showMapBtn.addEventListener('click', () => {
            mapModal.style.display = 'flex';
            if (lMap) {
                setTimeout(() => {
                    lMap.invalidateSize();
                }, 100);
            }
        });
    }

    if (closeMapBtn) {
        closeMapBtn.addEventListener('click', () => {
            mapModal.style.display = 'none';
        });
    }

    // Coordonnées du Musée des Beaux-Arts de Mulhouse
    const MUSEUM_LAT = 47.74583;
    const MUSEUM_LNG = 7.33847;
    const MAX_DISTANCE_KM = 0.5; // Autoriser jusqu'à 500 mètres d'écart pour les GPS imprécis

    // Fonction Haversine pour calculer la distance
    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Rayon de la Terre en km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // Override via l'URL (?localisation ou ?localisation=1)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('localisation') || urlParams.get('debug') === '1' || urlParams.get('dev') === '1') {
        geolocScreen.style.display = 'none';
        startScreen.style.display = 'flex';
    }

    if (geolocButton) {
        geolocButton.addEventListener('click', () => {
            geolocStatus.innerText = "Finding your location...";
            geolocButton.style.display = 'none';

            if ("geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const userLat = position.coords.latitude;
                        const userLng = position.coords.longitude;
                        const dist = calculateDistance(userLat, userLng, MUSEUM_LAT, MUSEUM_LNG);

                        if (dist <= MAX_DISTANCE_KM) {
                            // arrivée au musée
                            geolocScreen.style.display = 'none';
                            startScreen.style.display = 'flex';
                        } else {
                            geolocStatus.innerText = "You are not at the Mulhouse Museum of Fine Arts.\nDistance found: " + dist.toFixed(2) + " km\nGet closer to play!";
                            geolocButton.style.display = 'block';
                            geolocButton.innerText = "Try again";
                            if (showMapBtn) {
                                showMapBtn.style.display = 'block';
                                buildLeafletMap(userLat, userLng);
                            }
                        }
                    },
                    (error) => {
                        geolocStatus.innerText = "Error: " + error.message + ".\nPlease check your location permissions and ensure your GPS is enabled.";
                        geolocButton.style.display = 'block';
                        geolocButton.innerText = "Try again";
                        if (showMapBtn) {
                            showMapBtn.style.display = 'block';
                            buildLeafletMap(null, null);
                        }
                    },
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                );
            } else {
                geolocStatus.innerText = "Geolocation is not supported by your browser.";
                geolocButton.style.display = 'block';
                geolocButton.innerText = "Try again";
                if (showMapBtn) {
                    showMapBtn.style.display = 'block';
                    buildLeafletMap(null, null);
                }
            }
        });
    }

    startButton.addEventListener('click', () => {
        startScreen.style.display = 'none';
        document.getElementById('pause-button').style.display = 'block';
        initAudio();
        if (!game) {
            game = new Phaser.Game(config);
        }
    });

    // Boutons Game Over
    document.getElementById('restart-button-go').addEventListener('click', () => {
        document.getElementById('game-over-screen').style.display = 'none';
        if (currentScene) currentScene.scene.restart();
    });
    document.getElementById('home-button-go').addEventListener('click', () => {
        // Retour à l'accueil
        let menuHome = document.getElementById('menu-home');
        if (menuHome) menuHome.click();
        else window.location.href = 'index.html'; // Fallback
    });

    // Boutons Victoire
    document.getElementById('continue-button-win').addEventListener('click', () => {
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({
                type: 'GAME_CONTINUE',
                payload: { gameId: 3 }
            }, '*');
        } else {
            document.getElementById('victory-screen').style.display = 'none';
            hasWon = false;
            let pb = document.getElementById('pause-button');
            if (pb) pb.style.display = 'block';
            if (currentScene) currentScene.physics.resume();
        }
    });
    document.getElementById('restart-button-win').addEventListener('click', () => {
        document.getElementById('victory-screen').style.display = 'none';
        if (currentScene) currentScene.scene.restart();
    });

    // Bouton Pause HTML
    const pauseBtn = document.getElementById('pause-button');
    if (pauseBtn) {
        // Prévenir l'événement tactile de se propager au jeu
        pauseBtn.addEventListener('touchstart', (e) => { e.stopPropagation(); }, { passive: false });
        pauseBtn.addEventListener('mousedown', (e) => { e.stopPropagation(); });

        pauseBtn.addEventListener('click', (e) => {
            e.stopPropagation();

            if (!isPaused) {
                pauseClickCount++;

                if (pauseClickCount >= 3) {
                    hasWon = true;
                    if (pauseTimer) clearTimeout(pauseTimer);
                    if (currentScene) triggerWin(currentScene);
                    return;
                }

                if (currentScene) currentScene.physics.pause();
                isPaused = true;
                pauseBtn.style.opacity = '0.7';
            } else {
                if (currentScene) currentScene.physics.resume();
                isPaused = false;
                pauseBtn.style.opacity = '1';
            }

            if (pauseTimer) clearTimeout(pauseTimer);
            // On laisse 5 secondes pour réaliser le code de triche (Pause, Reprise, Pause, Reprise, Pause)
            pauseTimer = setTimeout(() => {
                pauseClickCount = 0;
            }, 5000);
        });
    }
});

// Reset des variables du jeu
function resetGameVariables() {
    score = 0;
    hasStartedClimbing = false;
    isBoosted = false;
    lastBrushLineCounter = 0;
    gameOver = false;
    hasWon = false;
    lastPlatformX = 200;
    lastSpawnedY = 0;
    lineCounter = 0;
    stairDirection = 1;
    lastSpawnedPaintingY = 300;
    lastPaintingId = 0;
    chronorouageSpawned = false;
    chronorouageFlying = false;
    chronorouageStopped = false;
    pauseClickCount = 0;
    isPaused = false;
    if (pauseTimer) clearTimeout(pauseTimer);
}

// Gérer les changements de viewport (barre d'adresse mobile)
function handleViewportResize() {
    const container = document.getElementById('game-container');
    const vh = window.visualViewport?.height || window.innerHeight;
    const vw = window.visualViewport?.width || window.innerWidth;
    document.body.style.height = vh + 'px';
    container.style.height = vh + 'px';
}

if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', handleViewportResize);
    window.visualViewport.addEventListener('scroll', handleViewportResize);
}
window.addEventListener('resize', handleViewportResize);
window.addEventListener('orientationchange', () => {
    setTimeout(handleViewportResize, 100);
});
handleViewportResize();

let player;
let platforms;
let movingPlatforms;
let breakablePlatforms;
let brushes;
let score = 0;
let scoreText;
let highestY;
let isDragging = false;
let lastPointerX = 0;
let hasStartedClimbing = false;
let isBoosted = false;
let lastBrushLineCounter = 0;
let gameOver = false;
let isDialogMode = false;
let hasSeenDialog = false;
let hasWon = false;
let pauseClickCount = 0;
let isPaused = false;
let pauseTimer = null;
let background;
let lastPlatformX = 200;
let deadlyPlatforms;
let lastSpawnedY = 0;
let lineCounter = 0;
let stairDirection = 1;
let paintingsGroup;
let lastSpawnedPaintingY = 300;
let lastPaintingId = 0;
let paintEmitter;
let chronorouage;
let chronorouageText;
let chronorouageSpawned = false;
let chronorouageBubble;
let chronorouageFlying = false;
let chronorouageStopped = false;
let chronorouageTargetY = 0;

// Système de sons
let audioContext = null;

function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
}

function playBounceSound() {
    if (!audioContext) return;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.frequency.setValueAtTime(300, audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(500, audioContext.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.15);
}

function playBreakSound() {
    if (!audioContext) return;
    // Son de bois qui craque avec du bruit
    const bufferSize = audioContext.sampleRate * 0.3;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }
    const noise = audioContext.createBufferSource();
    noise.buffer = buffer;

    const filter = audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, audioContext.currentTime);
    filter.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.2);

    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.5, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.25);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioContext.destination);
    noise.start(audioContext.currentTime);
}

function playBoostSound() {
    if (!audioContext) return;
    // Son de power-up ascendant
    const osc = audioContext.createOscillator();
    const osc2 = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = 'sine';
    osc2.type = 'sine';
    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(audioContext.destination);
    osc.frequency.setValueAtTime(400, audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.3);
    osc2.frequency.setValueAtTime(600, audioContext.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(1800, audioContext.currentTime + 0.3);
    gain.gain.setValueAtTime(0.25, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
    osc.start(audioContext.currentTime);
    osc2.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.4);
    osc2.stop(audioContext.currentTime + 0.4);
}

function playChronorouageSound() {
    if (!audioContext) return;
    // Son magique/mystique pour l'apparition
    const notes = [880, 1100, 880, 1320];
    notes.forEach((freq, i) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.type = 'sine';
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.setValueAtTime(freq, audioContext.currentTime + i * 0.12);
        gain.gain.setValueAtTime(0, audioContext.currentTime + i * 0.12);
        gain.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + i * 0.12 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + i * 0.12 + 0.2);
        osc.start(audioContext.currentTime + i * 0.12);
        osc.stop(audioContext.currentTime + i * 0.12 + 0.25);
    });
}

function playWinSound() {
    if (!audioContext) return;
    const notes = [523, 659, 784, 1047]; // Do Mi Sol Do (accord majeur)
    notes.forEach((freq, i) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.type = 'sine';
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.setValueAtTime(freq, audioContext.currentTime);
        gain.gain.setValueAtTime(0, audioContext.currentTime + i * 0.15);
        gain.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + i * 0.15 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + i * 0.15 + 0.4);
        osc.start(audioContext.currentTime + i * 0.15);
        osc.stop(audioContext.currentTime + i * 0.15 + 0.4);
    });
}

function playGameOverSound() {
    if (!audioContext) return;
    const notes = [400, 350, 300, 200]; // Notes descendantes tristes
    notes.forEach((freq, i) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.type = 'triangle';
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.setValueAtTime(freq, audioContext.currentTime);
        gain.gain.setValueAtTime(0, audioContext.currentTime + i * 0.2);
        gain.gain.linearRampToValueAtTime(0.25, audioContext.currentTime + i * 0.2 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + i * 0.2 + 0.3);
        osc.start(audioContext.currentTime + i * 0.2);
        osc.stop(audioContext.currentTime + i * 0.2 + 0.3);
    });
}

function preload() {
    this.load.image('debout', 'img/Debout.png');
    this.load.image('accroupis', 'img/Accroupis.png');
    this.load.image('chronorouage', 'img/piece3.png');
    this.load.image('fond', 'img/fond.jpg');
}

function create() {
    currentScene = this;
    gameOver = false;
    score = 0;
    hasStartedClimbing = false;
    isBoosted = false;
    hasWon = false;
    chronorouageSpawned = false;
    chronorouageFlying = false;
    chronorouageStopped = false;
    chronorouageTargetY = 0;
    lastBrushLineCounter = -5; // Un pinceau peut apparaître assez tôt au démarrage
    pauseClickCount = 0;
    isPaused = false;
    if (pauseTimer) clearTimeout(pauseTimer);

    let pb = document.getElementById('pause-button');
    if (pb) {
        pb.style.display = 'block';
        pb.style.opacity = '1';
    }

    // L'outil de dessin pour toutes nos créations procédurales
    const graphics = this.make.graphics({ x: 0, y: 0, add: false });
    // ================= FOND MUSÉE DES BEAUX-ARTS (SUPER-DÉTAILLÉ) =================

    // Fonction d'aide pour dessiner de somptueux cadres 3D (avec biseaux / bevels d'éclairage)
    function draw3DFrame(g, x, y, w, h, baseC, lightC, darkC, thick, dropShadow = true) {
        if (dropShadow) {
            g.fillStyle(0x222222, 0.4); g.fillRect(x + 10, y + 10, w, h); // Grosse ombre portée
        }
        g.fillStyle(baseC); g.fillRect(x, y, w, h); // Base
        // Biseau éclairé (Haut et Gauche)
        g.fillStyle(lightC);
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w - thick, y + thick);
        g.lineTo(x + thick, y + thick); g.lineTo(x + thick, y + h - thick); g.lineTo(x, y + h); g.fill();
        // Biseau ombré (Bas et Droite)
        g.fillStyle(darkC);
        g.beginPath(); g.moveTo(x + w, y); g.lineTo(x + w, y + h); g.lineTo(x, y + h);
        g.lineTo(x + thick, y + h - thick); g.lineTo(x + w - thick, y + h - thick); g.lineTo(x + w - thick, y + thick); g.fill();
    }

    graphics.clear();

    // Mur supérieur (Papier peint élégant texturé)
    graphics.fillStyle(0xECE3D1); graphics.fillRect(0, 0, 400, 200);
    // Rayures subtiles et soyeuses
    graphics.fillStyle(0xE5DBCA);
    for (let x = 0; x < 400; x += 20) graphics.fillRect(x, 0, 10, 200);

    // CIMAISE (Moulure horizontale centrale très classique)
    graphics.fillStyle(0xFFFFFF); graphics.fillRect(0, 195, 400, 10);
    graphics.fillStyle(0xDDDDDD); graphics.fillRect(0, 202, 400, 3);
    graphics.fillStyle(0xAAAAAA); graphics.fillRect(0, 205, 400, 2);

    // SOUBASSEMENT (Boiseries blanches en bas du mur)
    graphics.fillStyle(0xFAFAFA); graphics.fillRect(0, 207, 400, 93);
    // Panneaux sculptés en relief
    graphics.lineStyle(3, 0xEEEEEE, 1);
    graphics.strokeRect(35, 220, 130, 60); graphics.strokeRect(235, 220, 130, 60);
    graphics.lineStyle(2, 0xCCCCCC, 1); // Ombre intérieure des moulures de bois
    graphics.beginPath();
    graphics.moveTo(35, 280); graphics.lineTo(165, 280); graphics.lineTo(165, 220);
    graphics.moveTo(235, 280); graphics.lineTo(365, 280); graphics.lineTo(365, 220);
    graphics.strokePath();

    // PILASTRES COLOSSAUX 3D (Côtés)
    graphics.fillStyle(0xFFFFFF);
    graphics.fillRect(0, 0, 25, 300); graphics.fillRect(375, 0, 25, 300);
    // Grande ombre portée des piliers
    graphics.fillStyle(0x111111, 0.1);
    graphics.fillRect(25, 0, 8, 300); graphics.fillRect(367, 0, 8, 300);
    // Cannelures grecques (traits 3D)
    for (let lx of [5, 12, 19, 380, 387, 394]) {
        graphics.fillStyle(0xDDDDDD); graphics.fillRect(lx, 0, 2, 300);
    }

    graphics.generateTexture('museum_bg', 400, 300);

    // Initialisation du mur de fond (tout au fond -> Depth -10)
    background = this.add.tileSprite(200, logicHeight / 2, 400, logicHeight, 'museum_bg').setScrollFactor(0).setDepth(-10);

    // Génération des oeuvres d'art ULTRA-DÉTAILLÉES
    // 1: Grand paysage romantique des Vosges
    graphics.clear();
    draw3DFrame(graphics, 0, 0, 260, 160, 0xDAA520, 0xFFE4B5, 0x8B6508, 15, true); // Or royal massif
    draw3DFrame(graphics, 15, 15, 230, 130, 0xF5F5DC, 0xFFFFFF, 0xCDC0B0, 10, false); // Marie-louise crème
    // Peinture
    graphics.fillStyle(0x87CEEB); graphics.fillRect(25, 25, 210, 110); // Ciel
    graphics.fillStyle(0xFFE4B5); graphics.fillCircle(190, 50, 15); // Soleil vibrant
    graphics.fillStyle(0x708090); graphics.fillTriangle(25, 135, 80, 60, 140, 135); // Montagne roche
    graphics.fillStyle(0xFFFFFF); graphics.fillTriangle(80, 60, 95, 80, 65, 85); // Neige brillante !
    graphics.fillStyle(0x2F4F4F); graphics.fillTriangle(110, 135, 160, 80, 220, 135); // Seconde montagne
    graphics.fillStyle(0x228B22); graphics.fillEllipse(120, 130, 180, 40); // Forêt verte
    graphics.fillStyle(0x006400); graphics.fillEllipse(80, 140, 100, 30); // 1er plan sombre
    // Cartel doré au centre
    graphics.fillStyle(0xDAA520); graphics.fillRect(110, 165, 40, 10);
    graphics.fillStyle(0xFFFFFF); graphics.fillRect(112, 167, 36, 5);
    graphics.generateTexture('painting_1', 280, 180);

    // 2: Portrait Ovale "La Joconde"
    graphics.clear();
    graphics.fillStyle(0x333333, 0.4); graphics.fillEllipse(120, 130, 170, 220); // Ombre du cadre
    graphics.fillStyle(0x654321); graphics.fillEllipse(110, 120, 180, 220); // Bois foncé extérieur
    graphics.fillStyle(0x3E2723); graphics.fillEllipse(110, 120, 160, 200); // Bois très sombre milieu
    graphics.fillStyle(0xDAA520); graphics.fillEllipse(110, 120, 140, 180); // Bague or intérieure
    // Fond mystérieux dégradé
    graphics.fillStyle(0x2F4F4F); graphics.fillEllipse(110, 120, 130, 170); // Gris/Vert
    graphics.fillStyle(0x1F3F3F); graphics.fillEllipse(90, 120, 100, 150); // Plus sombre derrière
    // Corps noble
    graphics.fillStyle(0x330000); graphics.fillEllipse(110, 175, 110, 70); // Robe de pourpre riche
    graphics.fillStyle(0xDAA520); graphics.fillTriangle(110, 140, 80, 180, 140, 180); // Plastron doré brodé
    // Visage mystique
    graphics.fillStyle(0xFFDAB9); graphics.fillEllipse(110, 95, 35, 45); // Tête
    graphics.fillStyle(0x8B4513); graphics.fillEllipse(110, 70, 40, 30); // Chevelure lisse marron
    graphics.fillEllipse(85, 95, 15, 40); graphics.fillEllipse(135, 95, 15, 40); // Cheveux tombants
    graphics.generateTexture('painting_2', 240, 250);

    // 3: Nuit Étoilée (Van Gogh Hyper-Expressif)
    graphics.clear();
    draw3DFrame(graphics, 0, 0, 210, 150, 0x111111, 0x333333, 0x000000, 12); // Ébène
    graphics.fillStyle(0xDAA520); graphics.fillRect(12, 12, 186, 126); // Fin liseré d'or int.
    graphics.fillStyle(0x000044); graphics.fillRect(15, 15, 180, 120); // Nuit
    // Gros tourbillons de vent (simulés)
    graphics.fillStyle(0x000088); graphics.fillCircle(100, 60, 80);
    graphics.fillStyle(0x0044AA); graphics.fillCircle(80, 50, 50);
    // Lune explosive 3 tons
    graphics.fillStyle(0xFF8C00); graphics.fillCircle(160, 45, 22); // Aura
    graphics.fillStyle(0xFFD700); graphics.fillCircle(160, 45, 15); // Astre
    graphics.fillStyle(0xFFFFFF); graphics.fillCircle(160, 45, 8); // Coeur blanc
    // Etoiles avec auras magiques
    [[40, 30], [100, 25], [130, 80], [50, 90], [160, 90]].forEach(pos => {
        graphics.fillStyle(0xDAA520); graphics.fillCircle(pos[0], pos[1], 8);
        graphics.fillStyle(0xFFFFFF); graphics.fillCircle(pos[0], pos[1], 3);
    });
    // Collines lointaines foncées et village endormi
    graphics.fillStyle(0x000022); graphics.fillEllipse(100, 140, 200, 40);
    // Cyprès monstrueux et noueux
    graphics.fillStyle(0x001100);
    graphics.fillTriangle(30, 140, 45, 40, 60, 140);
    graphics.fillTriangle(40, 140, 55, 30, 70, 140);
    graphics.generateTexture('painting_3', 230, 170);

    // 4: Nature Morte Cubiste (Vase en argent et fruits)
    graphics.clear();
    draw3DFrame(graphics, 0, 0, 180, 180, 0x8B4513, 0xA0522D, 0x5C4033, 20, true); // Gros bois de chêne
    // Ombre intérieur
    graphics.fillStyle(0x222222, 0.4); graphics.fillRect(20, 20, 140, 10);
    // Fond de pièce ténébreux
    graphics.fillStyle(0x111111); graphics.fillRect(20, 20, 140, 140);
    // Table avec jolie nappe de velour tombante
    graphics.fillStyle(0x3E2723); graphics.fillRect(20, 100, 140, 60);
    graphics.fillStyle(0x8B0000); graphics.fillEllipse(50, 120, 80, 30);
    // Superbe cruche/vase en argent étincelante
    graphics.fillStyle(0xAAAAAA); graphics.fillEllipse(110, 90, 40, 70);
    graphics.fillStyle(0xDDDDDD); graphics.fillEllipse(100, 80, 15, 60); // Ligne de reflet brillante !
    // Panier ou plat à fruits
    graphics.fillStyle(0xDAA520); graphics.fillEllipse(60, 120, 80, 20);
    // Volumes 3D des fruits
    graphics.fillStyle(0x8B0000); graphics.fillCircle(50, 110, 18); // Pomme ombre
    graphics.fillStyle(0xFF0000); graphics.fillCircle(45, 105, 8); // Reflet pomme
    graphics.fillStyle(0x006400); graphics.fillCircle(80, 115, 16); // Pomme verte ombre
    graphics.fillStyle(0x32CD32); graphics.fillCircle(75, 110, 6); // Reflet pomme verte
    // Grappe de Raisins
    graphics.fillStyle(0x800080);
    for (let gx = 30; gx < 60; gx += 10) { graphics.fillCircle(gx, 125, 6); }
    graphics.generateTexture('painting_4', 200, 200);

    // Groupe pour gérér les peintures de façon procédurale
    paintingsGroup = this.add.group();
    lastSpawnedPaintingY = 700; // Départ beaucoup plus bas pour qu'on en voit directement un dès le démarrage !

    // ================= FIN DU FOND MUSÉE =================

    // 1. Black Platform (Cousue façon textile/cuir)
    graphics.clear();
    graphics.fillStyle(0x222222);
    graphics.fillRoundedRect(0, 0, 90, 15, 5);
    graphics.fillStyle(0x444444); // Reflet haut
    graphics.fillRoundedRect(0, 0, 90, 4, { tl: 5, tr: 5, bl: 0, br: 0 });
    graphics.lineStyle(1, 0xFFFFFF, 0.6); // Petites coutures
    for (let w = 5; w < 85; w += 8) {
        graphics.beginPath();
        graphics.moveTo(w, 7);
        graphics.lineTo(w + 4, 7);
        graphics.strokePath();
    }
    graphics.generateTexture('platform', 90, 15);

    // 2. Brown Platform (Bois de cagette fêlé)
    graphics.clear();
    graphics.fillStyle(0x8B4513);
    graphics.fillRoundedRect(0, 0, 90, 15, 5);
    graphics.lineStyle(2, 0x5C2E0B, 1); // Bordure foncée
    graphics.strokeRoundedRect(1, 1, 88, 13, 4);
    graphics.lineStyle(1, 0x4A2509, 0.8); // Fissure (casse au 1er saut)
    graphics.beginPath();
    graphics.moveTo(40, 0); graphics.lineTo(46, 6); graphics.lineTo(41, 11); graphics.lineTo(47, 15);
    graphics.strokePath();
    graphics.generateTexture('platform_brown', 90, 15);

    // 3. Deadly Platform (Barrière grise avec piques)
    graphics.clear();
    graphics.fillStyle(0x777777); // Gris base
    graphics.fillRoundedRect(0, 5, 90, 10, 2);
    graphics.fillStyle(0xAAAAAA); // Reflet
    graphics.fillRoundedRect(0, 5, 90, 3, 2);
    graphics.fillStyle(0x444444); // Piques sombres
    for (let w = 2; w < 85; w += 10) {
        graphics.fillTriangle(w, 5, w + 5, 0, w + 10, 5);
    }
    graphics.generateTexture('platform_deadly', 90, 15);

    // 4. Platform de départ (toute la largeur)
    graphics.clear();
    graphics.fillStyle(0x222222);
    graphics.fillRoundedRect(0, 0, 400, 20, 5);
    graphics.fillStyle(0x444444); // Reflet haut
    graphics.fillRoundedRect(0, 0, 400, 5, { tl: 5, tr: 5, bl: 0, br: 0 });
    graphics.lineStyle(1, 0xFFFFFF, 0.6); // Petites coutures
    for (let w = 5; w < 395; w += 8) {
        graphics.beginPath();
        graphics.moveTo(w, 10);
        graphics.lineTo(w + 4, 10);
        graphics.strokePath();
    }
    graphics.generateTexture('platform_start', 400, 20);

    // Pinceau plat XXL ultra-reconnaissable (Boost de saut)
    graphics.clear();
    // Grand manche large en bois (Pin)
    graphics.fillStyle(0xDEB887); graphics.fillRoundedRect(10, 25, 20, 25, 4);
    // Trou classique pour l'accrocher au mur
    graphics.fillStyle(0x333333, 0.4); graphics.fillCircle(20, 42, 3); // L'ombre du trou

    // L'attache en métal du manche (Ferrule rectangulaire)
    graphics.fillStyle(0xAAAAAA); graphics.fillRect(8, 15, 24, 10);
    graphics.fillStyle(0xFFFFFF); graphics.fillRect(10, 15, 4, 10); // L'assaut de reflet métallique
    graphics.fillStyle(0x777777); graphics.fillRect(8, 17, 24, 1); graphics.fillRect(8, 22, 24, 1); // Fines rainures

    // Grosse brosse de poils clairs
    graphics.fillStyle(0xFFE4C4); graphics.fillRect(9, 3, 22, 12);
    graphics.fillStyle(0xCDAA7D); // Ombres fines des poils sépares
    for (let i = 10; i < 30; i += 3) { graphics.fillRect(i, 3, 1, 12); }

    // IMMENSE traînée de peinture bleue gluante imbimée
    graphics.fillStyle(0x1E90FF);
    graphics.beginPath();
    graphics.moveTo(9, 8); graphics.lineTo(13, 12); graphics.lineTo(17, 5);
    graphics.lineTo(24, 11); graphics.lineTo(31, 7); graphics.lineTo(31, -2);
    graphics.lineTo(9, -2); graphics.fill(); // Remplissage complet du haut

    // Gouttes épaisses qui fuient sur les poils
    graphics.fillRect(13, 8, 4, 7); graphics.fillCircle(15, 15, 2.5); // Énorme goutte
    graphics.fillRect(23, 7, 3, 5); graphics.fillCircle(24.5, 12, 1.8); // Seconde petite goutte

    graphics.generateTexture('brush', 40, 55);

    // Goutte de peinture BLEUE (pour la traînée de propulsion)
    graphics.clear();
    graphics.fillStyle(0x1E90FF); // Bleu vif
    graphics.fillCircle(6, 6, 6);
    graphics.fillStyle(0x87CEEB); // Reflet mouillé donnant un volume 3D à la goutte
    graphics.fillCircle(4, 4, 2.5);
    graphics.generateTexture('paint_drop', 12, 12);

    // ================= MENUS UI (Cartels de Musée) =================
    // Panneau de menu texturé (Beige avec cadre OR)
    graphics.clear();
    graphics.fillStyle(0x111111, 0.4); graphics.fillRoundedRect(6, 6, 300, 320, 10); // L'ombre portée globale
    graphics.fillStyle(0xDAA520); graphics.fillRoundedRect(0, 0, 300, 320, 10); // Cadre extérieur Or
    graphics.fillStyle(0x8B6508); graphics.fillRoundedRect(5, 5, 290, 310, 8); // Moulure creuse foncée
    graphics.fillStyle(0xFDF5E6); graphics.fillRoundedRect(10, 10, 280, 300, 5); // Fond intérieur (Papier d'Art)
    graphics.generateTexture('ui_panel', 315, 335);

    // Bouton de musée Bleu (Continuer)
    graphics.clear();
    graphics.fillStyle(0x333333, 0.3); graphics.fillRoundedRect(3, 3, 180, 50, 8);
    graphics.fillStyle(0x1E90FF); graphics.fillRoundedRect(0, 0, 180, 50, 8);
    graphics.fillStyle(0x104E8B); graphics.fillRoundedRect(4, 4, 172, 42, 5);
    graphics.generateTexture('ui_button_blue', 185, 55);

    // Bouton de musée Rouge (Accueil)
    graphics.clear();
    graphics.fillStyle(0x333333, 0.3); graphics.fillRoundedRect(3, 3, 180, 50, 8);
    graphics.fillStyle(0xc0392b); graphics.fillRoundedRect(0, 0, 180, 50, 8);
    graphics.fillStyle(0x96281B); graphics.fillRoundedRect(4, 4, 172, 42, 5);
    graphics.generateTexture('ui_button_red', 185, 55);

    // Bouton de musée Doré (Rejouer)
    graphics.clear();
    graphics.fillStyle(0x333333, 0.3); graphics.fillRoundedRect(3, 3, 180, 50, 8);
    graphics.fillStyle(0xDAA520); graphics.fillRoundedRect(0, 0, 180, 50, 8);
    graphics.fillStyle(0x8B6508); graphics.fillRoundedRect(4, 4, 172, 42, 5);
    graphics.generateTexture('ui_button_gold', 185, 55);

    // Groups
    platforms = this.physics.add.staticGroup();
    movingPlatforms = this.physics.add.group({ allowGravity: false, immovable: true });
    breakablePlatforms = this.physics.add.staticGroup();
    brushes = this.physics.add.staticGroup();
    deadlyPlatforms = this.physics.add.staticGroup();

    // Create initial platforms
    platforms.create(200, logicHeight - 50, 'platform_start'); // Plateforme de départ pleine largeur
    lastSpawnedY = logicHeight - 50;
    lineCounter = 0;

    // Astuce : La première plateforme sera toujours générée bien à droite ou bien à gauche
    // pour forcer le joueur à dévier de son rebond sur place
    lastPlatformX = Math.random() < 0.5 ? -100 : 500;
    stairDirection = lastPlatformX < 0 ? 1 : -1;

    let initialPlats = Math.ceil(logicHeight / 90) + 2;
    for (let i = 0; i < initialPlats; i++) { // Un peu plus de plateformes initiales pour combler tout l'écran de départ
        lastSpawnedY = (logicHeight - 160) - (i * 90);
        createLevelLayer(lastSpawnedY);
    }

    // Player (départ posé proprement sur la base)
    player = this.physics.add.sprite(200, logicHeight - 70, 'debout');
    // Scale player
    player.setScale(0.15);
    player.setOrigin(0.5, 1);

    // Ajustement hitbox
    player.body.setSize(player.width * 0.5, player.height * 0.1);
    player.body.setOffset(player.width * 0.25, player.height * 0.7);

    player.body.checkCollision.up = false;
    player.body.checkCollision.left = false;
    player.body.checkCollision.right = false;

    // Altitude de départ
    highestY = player.y;

    // Collisions
    this.physics.add.collider(player, platforms, jumpOnPlatform, null, this);
    this.physics.add.collider(player, movingPlatforms, jumpOnPlatform, null, this);
    this.physics.add.collider(player, breakablePlatforms, jumpOnBreakablePlatform, null, this);

    // Remplacement du 'collider' par 'overlap' pour pouvoir traverser la barrière fatale sous boost !
    this.physics.add.overlap(player, deadlyPlatforms, hitDeadlyPlatform, null, this);

    this.physics.add.overlap(player, brushes, collectBrush, null, this);

    // Camera (lerp Y at 0.1 for smooth vertical follow)
    this.cameras.main.startFollow(player, true, 0, 0.1, 0, 150);
    this.cameras.main.setDeadzone(0, 200);

    // UI
    scoreText = this.add.text(200, 20, '0', {
        fontSize: '48px',
        fontFamily: 'Impact, Arial Black, sans-serif',
        fill: '#ffffff',
        stroke: '#000000',
        strokeThickness: 6
    }).setScrollFactor(0).setOrigin(0.5, 0).setDepth(100);

    // Emetteur de particules pour le boost de peinture
    paintEmitter = this.add.particles(0, 0, 'paint_drop', {
        speed: { min: 20, max: 100 },
        angle: { min: 40, max: 140 }, // Part vers le bas, avec une dispersion
        scale: { start: 1, end: 0 }, // Rapetisse avec le temps
        alpha: { start: 0.8, end: 0 },
        lifespan: 600,
        gravityY: 500, // Gravité locale (la peinture est lourde)
        frequency: 25, // Trainée volumineuse
        emitting: false // Eteint au départ
    });
    paintEmitter.startFollow(player, 0, 10); // Accroché aux pieds
    paintEmitter.setDepth(-1); // Trace en fond de plan

    // ===================================
    // MODE DIALOGUE VISUAL NOVEL
    // ===================================
    if (!hasSeenDialog) {
        hasSeenDialog = true;
        isDialogMode = true;
        this.physics.pause(); // On fige les sauts
        player.setVisible(false); // Cache le petit joueur pendant le dialogue
        scoreText.setVisible(false); // Cache le score

        let dialogGroup = this.add.group();

        // Fond spécifique pour le dialogue
        let dialogBg = this.add.image(200, logicHeight / 2, 'fond').setDepth(199).setScrollFactor(0);
        dialogBg.setDisplaySize(400, logicHeight);
        dialogGroup.add(dialogBg);

        // Filtre sombre sur tout le jeu (réduit légèrement puisque le fond img est déjà là)
        let overlay = this.add.rectangle(200, logicHeight / 2, 400, logicHeight, 0x000000, 0.4).setDepth(200).setScrollFactor(0);
        dialogGroup.add(overlay);

        // Sprite du joueur en très grand
        let vnPlayer = this.add.sprite(90, logicHeight - 140, 'debout').setOrigin(0.5, 1).setScale(0.5).setDepth(201).setScrollFactor(0);
        dialogGroup.add(vnPlayer);

        // Boîte de dialogue
        let dialogBox = this.add.graphics().setDepth(201).setScrollFactor(0);
        dialogBox.fillStyle(0x111111, 0.9);
        dialogBox.lineStyle(4, 0xDAA520, 1);
        dialogBox.fillRoundedRect(10, logicHeight - 150, 380, 140, 10);
        dialogBox.strokeRoundedRect(10, logicHeight - 150, 380, 140, 10);
        dialogGroup.add(dialogBox);

        // Cartel de Nom
        let nameBox = this.add.graphics().setDepth(202).setScrollFactor(0);
        nameBox.fillStyle(0xDAA520, 1);
        nameBox.fillRoundedRect(20, logicHeight - 165, 120, 35, 5);
        dialogGroup.add(nameBox);
        let nameText = this.add.text(80, logicHeight - 147, "Moi", { font: "bold 20px 'Impact', sans-serif", fill: "#000" }).setOrigin(0.5).setDepth(203).setScrollFactor(0);
        dialogGroup.add(nameText);

        // Texte avec Typewriter
        let dialogText = this.add.text(25, logicHeight - 120, "", {
            font: "16px Georgia",
            fill: "#fff",
            wordWrap: { width: 350 },
            lineHeight: 24
        }).setDepth(203).setScrollFactor(0);
        dialogGroup.add(dialogText);

        // Indication de clic
        let clickTexte = this.add.text(380, logicHeight - 20, "▼", { font: "20px Arial", fill: "#DAA520" }).setOrigin(1, 1).setDepth(203).setScrollFactor(0);
        this.tweens.add({ targets: clickTexte, y: logicHeight - 15, yoyo: true, repeat: -1, duration: 400 });
        dialogGroup.add(clickTexte);

        let lines = [
            "Here I am... The prestigious Museum of Fine Arts.",
            "The temporal anomaly is strong here. The rumors were true: it is hiding among these masterworks.",
            "I am here to find the 3rd chronogear, that essential gear of time...",
            "I must climb along the artworks to recover it before the timeline collapses!"
        ];
        let currentLine = 0;
        let isTyping = false;
        let typeTimer;

        const showNextLine = () => {
            if (currentLine >= lines.length) {
                // Fin du dialogue -> Lancement du jeu
                dialogGroup.destroy(true); // Nettoie tout
                isDialogMode = false;
                player.setVisible(true);
                scoreText.setVisible(true);
                this.physics.resume();
                return;
            }

            let line = lines[currentLine];
            dialogText.text = "";
            let currentChar = 0;
            isTyping = true;

            typeTimer = this.time.addEvent({
                delay: 35, // vitesse du texte
                callback: () => {
                    dialogText.text += line[currentChar];
                    currentChar++;
                    if (currentChar >= line.length) {
                        isTyping = false;
                        typeTimer.remove();
                    }
                },
                repeat: line.length - 1
            });
            currentLine++;
        };

        // On crée un input temporaire pour le dialogue
        this.input.on('pointerdown', () => {
            if (!isDialogMode) return;

            if (isTyping) {
                // Force l'affichage du texte entier
                typeTimer.remove();
                dialogText.text = lines[currentLine - 1];
                isTyping = false;
            } else {
                showNextLine();
            }
        });

        showNextLine();
    } else {
        isDialogMode = false; // Par sécurité
    }
}

function createLevelLayer(y) {
    lineCounter++;
    const previousMainX = lastPlatformX;

    // Algorithme de chemin (Variation organique de l'escalier pour éviter un parcours répétitif)
    let step = Phaser.Math.Between(50, 150); // Ecartement très variable

    // 25% de chances de changer de sens au milieu du parcours
    if (Math.random() < 0.25) {
        stairDirection *= -1;
    }

    let nextX = lastPlatformX + (stairDirection * step);

    // Rebonds plus proches du centre pour éviter que le saut ne soit trop excentré (Confort du joueur)
    if (nextX < 80) {
        nextX = Phaser.Math.Between(80, 130);
        stairDirection = 1;
    } else if (nextX > 320) {
        nextX = Phaser.Math.Between(270, 320);
        stairDirection = -1;
    }

    let mainX = nextX;

    // Évite qu'une planche piégée soit dans le même axe qu'une planche juste en dessous.
    // Le décalage doit être large (>= largeur d'une planche) pour ne pas se la prendre en sautant.
    if (lineCounter % 6 === 0) {
        const minDeadlyOffsetX = 100;
        if (Math.abs(mainX - previousMainX) < minDeadlyOffsetX) {
            const deadlyLeftX = Phaser.Math.Between(80, 150);
            const deadlyRightX = Phaser.Math.Between(250, 320);

            // Force le piège à partir franchement d'un côté ou de l'autre.
            mainX = previousMainX < 200 ? deadlyRightX : deadlyLeftX;
        }
    }

    lastPlatformX = mainX; // Mise à jour pour la suite

    if (lineCounter % 6 === 0) {
        // Toutes les 6 lignes UNIQUEMENT : Plateforme rouge mortelle + Issue de secours
        deadlyPlatforms.create(mainX, y, 'platform_deadly');

        let safeX = mainX > 200 ? Phaser.Math.Between(45, Math.max(45, mainX - 120)) : Phaser.Math.Between(Math.min(355, mainX + 120), 355);
        platforms.create(safeX, y, 'platform'); // Toujours strictement à la même hauteur
    } else {
        // Lignes normales (pas de rouge)
        let rnd = Phaser.Math.Between(1, 100);

        if (rnd <= 20 && lineCounter > 1) {
            // 20% : Planche noire MOBILE (jamais la toute première planche !)
            let p = movingPlatforms.create(mainX, y, 'platform');
            p.setVelocityX(Math.random() < 0.5 ? 70 : -70);
        }
        else if (rnd <= 60 && lineCounter > 1) {
            // 40% : Planche brune cassable (jamais la toute première ! On assure un point de chute)
            breakablePlatforms.create(mainX, y, 'platform_brown');
        } else {
            // Planche noire classique statique (Garantie à 100% pour la première planche)
            platforms.create(mainX, y, 'platform');

            // Pinceau d'artiste (15% de chances ET obligation d'avoir passé 12 plateformes depuis le précédent)
            if (lineCounter - lastBrushLineCounter > 12 && Phaser.Math.Between(1, 100) <= 15) {
                lastBrushLineCounter = lineCounter;
                let brushIcon = brushes.create(mainX, y - 30, 'brush');
                brushIcon.setAngle(30); // Pinceau incliné stylé !
            }
        }
    }
}

function update() {
    if (isDialogMode) return;
    if (gameOver) return;

    // Mettre à jour la bulle du chronorouage
    updateChronorouageBubble();

    if (background) {
        background.tilePositionY = this.cameras.main.scrollY * 0.5; // Parallax effect
    }

    // Player horizontal movement (Slide / Drag)
    let activePointer = this.input.activePointer;
    if (activePointer.isDown) {
        // Initialiser l'audio au premier toucher
        initAudio();

        if (!isDragging) {
            isDragging = true;
            lastPointerX = activePointer.x;
        } else {
            let delta = activePointer.x - lastPointerX;

            // Déplacement relatif très fluide
            player.x += delta * 1.5;

            if (delta < -0.5) player.flipX = true;
            else if (delta > 0.5) player.flipX = false;

            lastPointerX = activePointer.x;
        }
        player.setVelocityX(0);
    } else {
        isDragging = false;
        player.setVelocityX(0);
    }

    // Bloquer le joueur aux bords de l'écran
    if (player.x < 20) {
        player.x = 20;
    } else if (player.x > logicWidth - 20) {
        player.x = logicWidth - 20;
    }

    // Change sprite based on falling vs jumping
    if (player.body.velocity.y > 0) {
        player.setTexture('accroupis');
        isBoosted = false; // Fin nette de l'immunité au moment où on commence à redescendre
        // Coupe l'arrivée de peinture tout de suite dès qu'on commence à retomber
        if (paintEmitter && paintEmitter.emitting) {
            paintEmitter.stop();
        }
    } else {
        player.setTexture('debout');
    }

    // Track highest point for generating new platforms
    if (player.y < highestY) {
        highestY = player.y;

        // Bloquer le score à 0 tant qu'on n'a pas franchi la plateforme de départ
        if (hasStartedClimbing) {
            let startY = logicHeight - 100;
            if (highestY < startY) {
                score = Math.floor(Math.abs(highestY - startY) / 10); // Divisé par 10 pour une progression plus douce
            }
            scoreText.setText(score);

            // À partir de 300, afficher le message et spawner le Chronorouage volant
            if (score >= 300 && !chronorouageSpawned) {
                chronorouageSpawned = true;
                chronorouageFlying = true;

                // Afficher le texte "Attrapez le Chronorouage"
                chronorouageText = this.add.text(200, 80, 'Reach the chronogear!', {
                    fontSize: '22px',
                    fontFamily: 'Impact, Arial Black, sans-serif',
                    fill: '#FFD700',
                    stroke: '#000000',
                    strokeThickness: 4
                }).setScrollFactor(0).setOrigin(0.5, 0).setDepth(100);

                // Animation du texte
                this.tweens.add({
                    targets: chronorouageText,
                    scale: { from: 0.8, to: 1.1 },
                    yoyo: true,
                    repeat: -1,
                    duration: 500
                });

                // Spawner le Chronorouage volant dans une bulle
                playChronorouageSound();
                spawnFlyingChronorouage(this, highestY);
            }

            // Vérifier si le chronorouage est passé (raté par le bas) et le respawn
            if (chronorouage && chronorouage.active && chronorouage.y > this.cameras.main.scrollY + logicHeight + 100) {
                chronorouage.destroy();
                if (chronorouageBubble) chronorouageBubble.destroy();
                // Respawn une nouvelle bulle qui monte
                playChronorouageSound();
                spawnFlyingChronorouage(this, highestY + 200);
            }
        }

        // Generate new platforms fluidly (while loop ensures no gaps if frame drops)
        let nextGenY = highestY - logicHeight;
        while (lastSpawnedY > nextGenY) {
            lastSpawnedY = lastSpawnedY - 90; // Sauts strictement identiques, aucune variation
            createLevelLayer(lastSpawnedY);
        }
    }

    // Generate Background Paintings Procedurally
    let wallTop = this.cameras.main.scrollY * 0.5; // Coordonnée du haut du mur en espace parallaxe (vitesse 0.5)
    while (lastSpawnedPaintingY > wallTop - 300) {
        lastSpawnedPaintingY -= Phaser.Math.Between(350, 500); // 350 à 500 pixels de distance entre les Tableaux sur le mur

        let pId;
        do {
            pId = Phaser.Math.Between(1, 4);
        } while (pId === lastPaintingId);
        lastPaintingId = pId;

        let pX = Phaser.Math.Between(150, 250); // Léger décalage horizontal des cadres pour casser la symétrie

        let painting = this.add.image(pX, lastSpawnedPaintingY, 'painting_' + pId);
        painting.setScrollFactor(0.5); // Magie : s'attache strictement au décor qui défile à 0.5 de vitesse !
        painting.setDepth(-5); // Devant le mur (-10) mais derrière les plateformes (0)
        paintingsGroup.add(painting);
    }

    // Remove old items (plateformes et bobines) et gestion des mouvements
    let despawnY = this.cameras.main.scrollY + logicHeight + 50;
    platforms.getChildren().forEach(p => {
        if (p.y > despawnY) p.destroy();
    });
    movingPlatforms.getChildren().forEach(p => {
        // Gestion du rebond sur les bords
        if (p.x >= 340) { p.setVelocityX(-70); }
        else if (p.x <= 60) { p.setVelocityX(70); }

        // Nettoyage en sortant de l'écran par le bas
        if (p.y > despawnY) p.destroy();
    });
    breakablePlatforms.getChildren().forEach(p => {
        if (p.y > despawnY) p.destroy();
    });
    deadlyPlatforms.getChildren().forEach(p => {
        if (p.y > despawnY) p.destroy();
    });
    brushes.getChildren().forEach(b => {
        if (b.y > despawnY) b.destroy();
    });

    // Remove old paintings
    paintingsGroup.getChildren().forEach(p => {
        let wallBottom = this.cameras.main.scrollY * 0.5 + logicHeight;
        if (p.y > wallBottom + 200) p.destroy();
    });

    // Game Over condition
    if (player.y > despawnY) {
        triggerGameOver(this);
    }
}

function triggerGameOver(scene) {
    if (gameOver) return;
    gameOver = true;
    playGameOverSound();
    player.setTint(0xff0000); // Peint le joueur en rouge
    player.setVelocity(0, 0);

    // Cache le bouton HTML pause
    document.getElementById('pause-button').style.display = 'none';

    // Affiche l'overlay HTML centré via flexbox
    document.getElementById('game-over-score').innerText = 'Score: ' + score;
    document.getElementById('game-over-screen').style.display = 'flex';
}

function triggerWin(scene) {
    hasWon = true;
    playWinSound();

    // Cache le bouton HTML pause
    document.getElementById('pause-button').style.display = 'none';

    // Fige intégralement le moteur physique pour un freeze épique
    scene.physics.pause();

    // Affiche l'overlay HTML centré via flexbox
    document.getElementById('victory-screen').style.display = 'flex';
}

function hitDeadlyPlatform(player, platform) {
    // Si le joueur est en plein boost de peinture et remonte vers le haut
    if (isBoosted && player.body.velocity.y < 0) {
        // Immunisé : On passe simplement au travers sans mourir ni la casser !
        return;
    }

    // Si on n'est pas boosté (ou si on retombe dessus à la fin du boost), Game Over !
    triggerGameOver(this);
}

function jumpOnPlatform(player, platform) {
    // Si le joueur est déjà expédié en haut par un bonus, on ignore
    if (player.body.velocity.y < -100) return;

    if (platform.y < logicHeight - 100) hasStartedClimbing = true;

    playBounceSound();
    player.setVelocityY(-450); // Jump normal
    player.setTexture('debout');
}

function jumpOnBreakablePlatform(player, platform) {
    if (player.body.velocity.y < -100) return; // Ignorer si propulsé

    if (platform.y < logicHeight - 100) hasStartedClimbing = true;

    playBounceSound();
    player.setVelocityY(-450); // Maintient la hauteur de saut
    player.setTexture('debout');

    // Animation détaillée de la planche brune qui cède
    playBreakSound();
    platform.body.enable = false; // Ne plus bloquer
    this.tweens.add({
        targets: platform,
        y: platform.y + 100,
        alpha: 0,
        angle: 45 * (Math.random() < 0.5 ? 1 : -1), // Tourne en tombant
        duration: 400,
        onComplete: () => { platform.destroy(); }
    });
}

function collectBrush(player, brush) {
    hasStartedClimbing = true;
    isBoosted = true; // Déclenche l'immunité et le pouvoir de traverser les obstacles
    playBoostSound();
    player.setVelocityY(-900); // SUPER PROPULSION D'ARTISTE !
    brush.destroy();

    // Libérez la traînée de peinture !!
    if (paintEmitter) {
        paintEmitter.start();
    }
}

function spawnFlyingChronorouage(scene, yPos) {
    // Position X au centre, spawn en haut de l'écran visible
    let xPos = 200;
    let startY = scene.cameras.main.scrollY - 50; // En haut de l'écran

    // Créer la bulle (cercle transparent)
    const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
    graphics.fillStyle(0x87CEEB, 0.3); // Bleu clair transparent
    graphics.fillCircle(30, 30, 30);
    graphics.lineStyle(2, 0xADD8E6, 0.8);
    graphics.strokeCircle(30, 30, 30);
    // Reflet de la bulle
    graphics.fillStyle(0xFFFFFF, 0.5);
    graphics.fillEllipse(20, 18, 12, 8);
    graphics.generateTexture('bubble', 60, 60);
    graphics.destroy();

    // Créer la bulle
    chronorouageBubble = scene.add.image(xPos, startY, 'bubble');
    chronorouageBubble.setScale(1.2);
    chronorouageBubble.setDepth(49);

    // Spawner le Chronorouage dans la bulle
    chronorouage = scene.physics.add.sprite(xPos, startY, 'chronorouage');
    chronorouage.setScale(0.1);
    chronorouage.body.allowGravity = false;
    chronorouage.setDepth(50);

    // La bulle descend lentement
    chronorouage.body.setVelocityY(20);

    // Collision avec le joueur
    scene.physics.add.overlap(player, chronorouage, collectChronorouage, null, scene);
}

function updateChronorouageBubble() {
    // Synchroniser la bulle avec le chronorouage
    if (chronorouageFlying && chronorouage && chronorouage.active && chronorouageBubble) {
        chronorouageBubble.x = chronorouage.x;
        chronorouageBubble.y = chronorouage.y;

        // Petit mouvement horizontal oscillant
        chronorouage.x = 200 + Math.sin(Date.now() / 500) * 40;
    }
}

function spawnChronorouage(scene, yPos) {
    // Position X aléatoire sur une zone jouable
    let xPos = Phaser.Math.Between(80, 320);

    // Créer une plateforme spéciale pour le chronorouage
    let chronoPlatform = platforms.create(xPos, yPos, 'platform');

    // Spawner le Chronorouage juste au-dessus de la plateforme
    chronorouage = scene.physics.add.sprite(xPos, yPos - 25, 'chronorouage');
    chronorouage.setScale(0.1);
    chronorouage.body.allowGravity = false;
    chronorouage.setDepth(50);
    chronorouageLanded = true;

    // Collision avec le joueur
    scene.physics.add.overlap(player, chronorouage, collectChronorouage, null, scene);
}

function collectChronorouage(player, chrono) {
    chrono.destroy();
    if (chronorouageBubble) chronorouageBubble.destroy();
    if (chronorouageText) {
        chronorouageText.destroy();
    }
    hasWon = true;
    triggerWin(player.scene);
}
