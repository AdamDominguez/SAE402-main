// ==================== État interne ====================
let timer_arret_son;

// ==================== Utilitaire : couper les sons de dialogue ====================
function stopDialogueAudio() {
    clearTimeout(timer_arret_son);

    ["dialogue_son", "dialogue_son_boss"].forEach((audioId) => {
        const snd = document.getElementById(audioId);
        if (!snd) return;
        snd.pause();
        snd.currentTime = 0;
    });
}

// ==================== Animation typewriter + audio optionnel ====================
function dialogue(selecteur, options = {}) {
    const { playAudio = true, audioId = "dialogue_son" } = options;
    const div = document.querySelector(selecteur);
    if (!div) return;

    const texteBrut = div.innerText;
    let output = "";

    texteBrut.split("").forEach(lettre => {
        output += `<span class="lettre">${lettre}</span>`;
    });

    div.innerHTML = output;

    const dialogueSon = document.getElementById(audioId);
    stopDialogueAudio();

    const dialogueDurationMs = Math.max(900, texteBrut.length * 50);

    if (playAudio && dialogueSon) {
        dialogueSon.currentTime = 0;
        const playPromise = dialogueSon.play();

        if (playPromise !== undefined) {
            playPromise.then(() => {
                timer_arret_son = setTimeout(() => {
                    if (!dialogueSon.paused) {
                        dialogueSon.pause();
                        dialogueSon.currentTime = 0;
                    }
                }, dialogueDurationMs);
            }).catch(() => { });
        } else {
            timer_arret_son = setTimeout(() => {
                if (!dialogueSon.paused) {
                    dialogueSon.pause();
                    dialogueSon.currentTime = 0;
                }
            }, dialogueDurationMs);
        }
    }

    // Animation des lettres
    [...div.children].forEach((lettre, index) => {
        setTimeout(() => {
            lettre.classList.add("visible");
        }, 50 * index);
    });
}

// ==================== Exposition globale ====================
window.stopDialogueAudio = stopDialogueAudio;