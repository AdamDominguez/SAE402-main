// ==================== Importations ====================
import { gameState, input, sky } from "./state.js";

// ==================== État interne des contrôles ====================
let orientationEnabled = false;

// ==================== Helpers tactiles ====================
const bindButton = (id, key) => {
    const btn = document.getElementById(id);
    btn.addEventListener("touchstart", (e) => { e.preventDefault(); input[key] = true; }, { passive: false });
    btn.addEventListener("touchend", (e) => { e.preventDefault(); input[key] = false; }, { passive: false });
};

// ==================== Gestion de l'inclinaison pour les nuages ====================
function handleCloudTilt(event) {
    const gamma = typeof event.gamma === "number" ? event.gamma : 0;
    const beta = typeof event.beta === "number" ? event.beta : 0;

    const rawAngle = (screen.orientation && typeof screen.orientation.angle === "number")
        ? screen.orientation.angle
        : (typeof window.orientation === "number" ? window.orientation : 0);
    const angle = ((rawAngle % 360) + 360) % 360;

    const isLandscape = angle === 90 || angle === 270 || window.matchMedia("(orientation: landscape)").matches;

    let axis = gamma;
    if (isLandscape) {
        // En paysage, beta correspond à l'inclinaison gauche/droite.
        axis = angle === 270 ? -beta : beta;
    }

    const normalizedTilt = Math.max(-1, Math.min(1, axis / 35));
    sky.cloudTilt = normalizedTilt;
}

// ==================== API publique : activation de l'inclinaison ====================
export function enableCloudTiltControls() {
    if (orientationEnabled || typeof DeviceOrientationEvent === "undefined") return;

    const attach = () => {
        if (orientationEnabled) return;
        window.addEventListener("deviceorientation", handleCloudTilt);
        orientationEnabled = true;
    };

    if (typeof DeviceOrientationEvent.requestPermission === "function") {
        DeviceOrientationEvent.requestPermission()
            .then((permissionState) => {
                if (permissionState === "granted") {
                    attach();
                }
            })
            .catch(() => { });
        return;
    }

    attach();
}

// ==================== API publique : contrôles tactiles du combat ====================
export function initTouchInput(resetGame, unlockAudio) {
    bindButton("btnLeft", "left");
    bindButton("btnRight", "right");
    bindButton("btnJump", "jump");
    bindButton("btnAttack", "attack");

    window.addEventListener("touchstart", (e) => {
        if (gameState.gameOver || (gameState.victory && gameState.victoryCinematicDone)) {
            e.preventDefault();
            resetGame();
        }
    }, { passive: false });

    window.addEventListener("touchstart", () => {
        unlockAudio();
    }, { passive: true, once: true });
}