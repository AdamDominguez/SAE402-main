// Mapping de gestion des entrées
const input = {
    tiltX: 0, // -1 à 1 (gauche à droite)
};

// Gère l'orientation de l'appareil (gyroscope)
function handleOrientation(event) {
    if (gameState !== 'playing') return;

    let gamma = event.gamma;

    if (gamma !== null) {
        const maxTilt = 45;
        let normalized = gamma / maxTilt;
        normalized = Math.max(-1, Math.min(1, normalized));

        if (Math.abs(normalized) < 0.05) normalized = 0;
        input.tiltX = normalized;
    }
}

// Contrôles clavier de secours (débogage pc)
const keys = {};
window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    updateKeyboardInput();
});
window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
    updateKeyboardInput();
});

function updateKeyboardInput() {
    if (keys['ArrowLeft'] || keys['KeyA']) {
        input.tiltX = -1;
    } else if (keys['ArrowRight'] || keys['KeyD']) {
        input.tiltX = 1;
    } else {
        input.tiltX = 0;
    }
}

function requestDeviceOrientation() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    window.addEventListener('deviceorientation', handleOrientation);
                }
            })
            .catch(console.error);
    } else {
        window.addEventListener('deviceorientation', handleOrientation);
    }
}
