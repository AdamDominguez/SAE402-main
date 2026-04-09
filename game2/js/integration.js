// --- LOGIQUE DU HUB ---

const HUB_QUERY = new URLSearchParams(window.location.search);
const EMBEDDED_MODE = HUB_QUERY.get('embedded') === '1';
const GAME_ID = Number(HUB_QUERY.get('gameId')) || 1;

window.gameHubContext = {
    currentLevel: GAME_ID,
    variables: {}
};

function postToHub(message) {
    if (!EMBEDDED_MODE) return;
    if (window.parent === window) return;

    window.parent.postMessage(message, window.location.origin);
}

function signalGameReady() {
    postToHub({
        type: 'GAME_READY',
        payload: {
            gameId: GAME_ID
        }
    });
}

function signalVictory(payload = {}) {
    postToHub({
        type: 'GAME_COMPLETE',
        payload: {
            gameId: GAME_ID,
            ...payload
        }
    });
}

function signalGameState(state, menuType = '') {
    postToHub({
        type: 'GAME_STATE',
        payload: {
            gameId: GAME_ID,
            state,
            menuType
        }
    });
}

function signalContinueAdventure() {
    postToHub({
        type: 'GAME_CONTINUE',
        payload: {
            gameId: GAME_ID
        }
    });
}

function triggerGameVibration(pattern) {
    let vibrated = false;

    if (navigator.vibrate) {
        try {
            vibrated = navigator.vibrate(pattern);
        } catch {
            vibrated = false;
        }
    }

    if (!vibrated) {
        postToHub({
            type: 'GAME_VIBRATE',
            payload: {
                gameId: GAME_ID,
                pattern
            }
        });
    }
}

window.signalVictory = signalVictory;
window.signalGameState = signalGameState;
window.signalContinueAdventure = signalContinueAdventure;
window.triggerGameVibration = triggerGameVibration;

window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) return;

    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type !== 'GAME_CONTEXT') return;

    const payload = data.payload && typeof data.payload === 'object' ? data.payload : {};
    window.gameHubContext = {
        currentLevel: Number(payload.currentLevel) || GAME_ID,
        variables: payload.variables && typeof payload.variables === 'object' ? payload.variables : {}
    };
});

window.addEventListener('load', () => {
    signalGameReady();
});
