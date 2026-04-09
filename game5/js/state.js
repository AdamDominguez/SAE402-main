// ==================== État global de la partie ====================
export const gameState = {
    gameStarted: false,
    isPaused: false,
    gameOver: false,
    victory: false,
    victoryCinematicDone: false,
    lastEvilLaughTime: 0
};

// ==================== Entrées joueur ====================
export const input = { left: false, right: false, jump: false, attack: false };

// ==================== Collections dynamiques ====================
export const projectiles = [];
export const particles = [];

// ==================== État du ciel et des effets météo ====================
export const sky = {
    cloudTilt: 0,
    isStorm: true,
    flashAlpha: 0,
    flashStage: 0
};

// ==================== Objet de récompense (pièce temporelle) ====================
export const timepiece = {
    x: 0,
    y: 0,
    width: 40,
    height: 40,
    active: false,
    floatTimer: 0,
    image: null
};

// ==================== État du héros ====================
export const player = {
    x: 200,
    y: 100,
    width: 40,
    height: 40,
    vx: 0,
    vy: 0,
    jumpPower: -10.8,
    isGrounded: false,
    direction: 1,
    attackCooldown: 0,
    isAttacking: false,
    invulnerable: 0,
    lives: 5,
    isHurt: false,
    hurtTimer: 0,
    isDead: false,
    frameX: 0,
    frameY: 0,
    frameTimer: 0,
    frameDuration: 5
};

// ==================== État du boss ====================
export const boss = {
    x: 700,
    y: 100,
    width: 60,
    height: 60,
    vx: 0,
    vy: 0,
    speed: 1.2,
    jumpPower: -12,
    isGrounded: false,
    direction: -1,
    actionTimer: 0,
    state: "idle",
    spriteMode: "move",
    attackCooldown: 0,
    isAttacking: false,
    hp: 10,
    maxHp: 10,
    invulnerable: 0,
    deathStarted: false,
    deathResolved: false,
    deathHoldTimer: 0,
    frameX: 0,
    frameTimer: 0
};