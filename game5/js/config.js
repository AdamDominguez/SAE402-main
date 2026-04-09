// ==================== Canvas principal et calque de fond ====================
export const canvas = document.getElementById("gameCanvas");
export const ctx = canvas.getContext("2d");
export const bgCanvas = document.getElementById("bgCanvas");
export const bgCtx = bgCanvas.getContext("2d");

// ==================== Éléments UI combat ====================
export const pauseBtn = document.getElementById("pauseBtn");
export const startBtn = document.getElementById("startBtn");
export const audioToggleBtn = document.getElementById("audioToggleBtn");
export const audioTogglePauseBtn = document.getElementById("audioTogglePauseBtn");
export const resumeBtn = document.getElementById("resumeBtn");
export const startOverlay = document.getElementById("startOverlay");
export const pauseOverlay = document.getElementById("pauseOverlay");
export const controls = document.getElementById("controls");

// ==================== Éléments UI GPS et carte ====================
export const gpsScreen = document.getElementById("gpsScreen");
export const mainContent = document.getElementById("mainContent");
export const gpsBtn = document.getElementById("gpsBtn");
export const gpsInfo = document.getElementById("gpsInfo");
export const distanceText = document.getElementById("distanceText");
export const compassArrow = document.getElementById("compassArrow");
export const directionText = document.getElementById("directionText");
export const openMapBtn = document.getElementById("openMapBtn");
export const mapPopup = document.getElementById("mapPopup");
export const closeMapBtn = document.getElementById("closeMapBtn");
export const mapElement = document.getElementById("map");

// ==================== Découpage sprites (boss/héros/projectile) ====================
export const bossCols = 8;
export const BOSS_OFFSET_Y = 0;

export const playerCols = 8;
export const playerRows = 4;
export const PLAYER_OFFSET_Y = 5;

export const pierreCols = 4;
export const pierreRows = 2;

// ==================== Constantes physiques ====================
export const gravity = 0.6;
export const friction = 0.8;

// ==================== Géométrie de la plateforme ====================
export const platform = { x: 70, y: 425, width: 860, height: 20 };