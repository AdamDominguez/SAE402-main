const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// Éléments d'interface
const scoreElement = document.getElementById('score');
const shameBarElement = document.getElementById('shame-bar');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const gameWinScreen = document.getElementById('game-win-screen');
const orientationLockScreen = document.getElementById('orientation-lock-screen');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const restartBtn = document.getElementById('restart-btn');
const winRestartBtn = document.getElementById('win-restart-btn');
const winContinueBtn = document.getElementById('win-continue-btn');
const finalScoreElement = document.getElementById('final-score');
const muteBtn = document.getElementById('mute-btn');
const gpsStatusElement = document.getElementById('gps-status');
const startSubtitle = document.getElementById('start-subtitle');
const adventureStartBtn = document.getElementById('adventure-start-btn');
const dialogueStage = document.getElementById('dialogue-stage');
const dialogueBackground = document.getElementById('dialogue-background');
const dialogueVillagerYoung = document.getElementById('dialogue-villager-young');
const dialogueCart = document.getElementById('dialogue-cart');
const dialogueVillagerOld = document.getElementById('dialogue-villager-old');
const dialogueExecutioner = document.getElementById('dialogue-executioner');
const dialogueBlackScreen = document.getElementById('dialogue-black-screen');
const dialogueSpeaker = document.getElementById('dialogue-speaker');
const dialogueText = document.getElementById('dialogue-text');
const dialogueHint = document.getElementById('dialogue-hint');
const openMapBtn = document.getElementById('open-map-btn');
const mapPopup = document.getElementById('map-popup');
const closeMapBtn = document.getElementById('close-map-btn');
const mapContainer = document.getElementById('map');

// Paramètres de géolocalisation pour forcer la marche du joueur
const TARGET_LAT = 47.746745;
const TARGET_LON = 7.338401;
const TARGET_RADIUS = 35; // Rayon de 35 mètres autorisé autour du point GPS
const IS_DEBUG_MODE = window.location.search.includes('debug=1');

let isMuted = false;

// Assets
const assets = {
    klapperstein: loadImage('img/Klapperstein/sprites_klapperstein.png'),
    heroane: loadImage('img/Animation hero et ane/anim_hero_ane_tomber-removebg-preview.png'),
    heroane_sol: loadImage('img/Animation hero et ane/anim_hero_ane_au_sol-removebg-preview.png'),
    tomate: loadImage('img/Tomate/tomate_sprites.png'),
    tomatePourrie: loadImage('img/Tomate/tomate_pourrie_sprites.png'),
    background: loadImage('img/Décor/decor_sans_perso.png'),
    fragment: loadImage('img/Chronorouage/fragement_chronorouage2.png'),
    foule: loadImage('img/Foule/foule-sprites.png'),
    dialogueBackground: loadImage('img/Dialogue/Décor/decor_reunion_dialogue.png'),
    dialogueVillagerYoung: loadImage('img/Dialogue/Villageois/villageoi_jeune.png'),
    dialogueCart: loadImage('img/Dialogue/Villageois/charrette.png'),
    dialogueVillagerOld: loadImage('img/Dialogue/Villageois/villageois_agee.png'),
    dialogueExecutionerBackground: loadImage('img/Dialogue/Bourreau/decor_bourreau.png'),
    dialogueExecutioner: loadImage('img/Dialogue/Bourreau/bourreau-removebg-preview.png')
};

// Musiques
const bgm = {
    game: new Audio('son/Musique/Path_of_the_Valiant.mp3'),
    menu: new Audio('son/Musique/Sword_at_Dawn.mp3'),
    gameOver: new Audio('son/Musique/Le_poids_du_Klapperstein.mp3'),
    win: new Audio('son/Musique/Marche_des_Vainqueurs.mp3')
};

// Lecture en boucle et volume conseillé
bgm.game.loop = true;
bgm.menu.loop = true;
bgm.gameOver.loop = true;
bgm.win.loop = true;

bgm.game.volume = 0.4;
bgm.menu.volume = 0.4;
bgm.gameOver.volume = 0.4;
bgm.win.volume = 0.4;

// Bruitages (SFX)
const sfx = {
    fall: new Audio('son/Bruit/Chute/cri_chute.wav'), // Chute du personnage
    tomatoThrow: new Audio('son/Bruit/Tomate/lancee_tomate.wav'), // Lancer de tomate
    tomatoSplat: new Audio('son/Bruit/Tomate/eclat_tomate_perso.mp3'), // Éclat au sol
    tomatoHit: new Audio('son/Bruit/Tomate/eclat_tomate.mp3'), // Impact sur joueur
    lightning: new Audio('son/eclair/eclair.wav'), // Tonnerre des éclairs
    villageSound: new Audio('son/villageois/creatorshome-video-game-text-330163.mp3'), // Bruit de lettre villageois
    executionerSound: new Audio('son/bourreau/freesound_community-russian-dialogue-intro-44671.mp3') // Voix du bourreau
};
sfx.fall.volume = 0.8;
sfx.tomatoThrow.volume = 0.5;
sfx.tomatoSplat.volume = 0.6;
sfx.tomatoHit.volume = 0.6;
sfx.lightning.volume = 1;

// État du jeu et entités
let gameState = 'start'; // 'start', 'playing', 'gameover'
let lastTime = 0;
let score = 0;
let shame = 0; // de 0 à 100
const maxShame = 100;

let player;
let pendulum;
let tomatoes = [];
let tomatoSpawnTimer = 0;
let tomatoSpawnInterval = 1.5; // Secondes

let fragmentObj = null;
let nextFragmentSpawnScore = 200; // 20 secondes par défaut

let crowdAnimTimer = 0; // Timer global pour boucler l'animation de la foule
let particles = []; // Tableau pour gérer les éclaboussures de tomate (juice)
let hasSentVictorySignal = false;
