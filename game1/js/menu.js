// VARIABLES GLOBALES ---------------------------------------------------------------------------
const map_leaflet = document.querySelector("#map");
const menuDialogue = document.querySelector(".menu_dialogue");
const menu1_level1 = document.querySelector(".menu1_level1");
const menu2_level1 = document.querySelector(".menu2_level1");
const menu_defaite = document.querySelector(".menu_défaite_level1");
const menu_fin = document.querySelector(".menu_fin_level1");
const boiteDialogue = document.querySelector(".boite_dialogue");

const touche_gauche = document.querySelector(".touche_gauche");
const touche_droite = document.querySelector(".touche_droite");

const btn_menu1 = document.querySelector("#btn_menu1");
const btn_menu2 = document.querySelector("#btn_menu2");
const btn_recommencer = document.querySelector("#btn_recommencer");
const btn_fin = document.querySelector("#btn_fin");
const btn_suite_dialogue = document.querySelector("#btn_suite_dialogue");

const canvas = document.querySelector("#level1");
const level1 = canvas.getContext("2d", { willReadFrequently: true });
const imgFille = document.querySelector("#fille1");

let etapeDialogue = 1;
let alphaFille = 0;

// Variables pour le GPS
const targetLat = 47.74504815670808;
const targetLng = 7.338904215467176;
const rayonValidation = 30; // rayon en mètres
let map = null;
let userMarker = null;
let watchId = null;

// --- MODE DÉVELOPPEUR ---
const urlParams = new URLSearchParams(window.location.search);
const isDev = urlParams.get('dev') === '1' || urlParams.get('debug') === '1';

// INITIALISATION AU CHARGEMENT ---------------------------------------------------------------------------
window.addEventListener("load", () => {
    // 1. On cache les menus de votre jeu
    menuDialogue.classList.add("invisible");
    menu1_level1.classList.add("invisible");
    menu2_level1.classList.add("invisible");
    menu_defaite.classList.add("invisible");
    menu_fin.classList.add("invisible");

    // Initialisation du canvas en premier (pour le fond)
    alphaFille = 0;
    dessin_menu();

    // Mode développeur : on passe le GPS
    if (isDev) {
        declencherArrivee();
    } else {
        // 2. On initialise la carte UNE SEULE FOIS
        map = L.map('map').setView([targetLat, targetLng], 15);

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
        }).addTo(map);

        // Marqueur de la destination
        L.marker([targetLat, targetLng]).addTo(map).bindPopup("Destination").openPopup();

        // Astuce pour éviter l'écran gris
        setTimeout(() => { if (map) map.invalidateSize(); }, 200);

        // 3. Lancement du GPS
        demarrerGPS();
    }
});


// 3. GESTION DU GPS ---------------------------------------------------------------------------
function calculateDistance(lat1, lon1, lat2, lon2) {
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

function declencherArrivee() {
    navigator.geolocation.clearWatch(watchId);
    document.getElementById('map-container').classList.add('hidden');
    menu1_level1.classList.remove('invisible');
    dessin_menu();
}

function onPositionUpdate(position) {
    const userLat = position.coords.latitude;
    const userLng = position.coords.longitude;
    const accuracy = position.coords.accuracy;

    // Mise à jour du marqueur du joueur sur la carte
    if (!userMarker) {
        userMarker = L.marker([userLat, userLng]).addTo(map).bindPopup("You're here");
        const bounds = L.latLngBounds([[userLat, userLng], [targetLat, targetLng]]);
        map.fitBounds(bounds, { padding: [50, 50] });
    } else {
        userMarker.setLatLng([userLat, userLng]);
    }

    const distance = Math.round(calculateDistance(userLat, userLng, targetLat, targetLng));
    document.getElementById('info-distance').innerText = `Distance: ${distance}m (Precision: ±${Math.round(accuracy)}m)`;

    if (distance <= rayonValidation) {
        declencherArrivee();
    }
}

function onPositionError(err) {
    console.warn(`GPS Error: ${err.message}`);
    if (err.code === 1) {
        document.getElementById('info-distance').innerText = "Please allow the GPS.";
    } else {
        document.getElementById('info-distance').innerText = "Searching your position (go outside)...";
    }
}

function demarrerGPS() {
    if (navigator.geolocation) {
        const options = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };
        watchId = navigator.geolocation.watchPosition(onPositionUpdate, onPositionError, options);
    } else {
        alert("GPS is not authorized on your browser.");
    }
}


// 4. GESTION DE L'ÉCRAN (éviter la mise en veille) ---------------------------------------------------------------------------
let wakeLock = null;
async function ecran_allumee() {
    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => {
                console.log("Wake Lock deactivated");
            });
        } catch (err) {
            console.error("Error:", err.name, err.message);
        }
    } else {
        console.log("Your browser does not support the Wake Lock API.");
    }
}

document.addEventListener('visibilitychange', async () => { //Si l'écran commence a s'assombrir
    if (wakeLock !== null && document.visibilityState === 'visible') {
        await ecran_allumee();
    }
});


// GESTION DES MENUS & DIALOGUES ---------------------------------------------------------------------------
function dessin_menu() {
    // Si w et h ne sont pas encore définis, on ne dessine rien
    if (typeof w === 'undefined' || typeof h === 'undefined') return;

    level1.drawImage(fond, 0, 0, w, h);
    level1.drawImage(sol, 0, h - 50, w, 50);

    if (!menuDialogue.classList.contains("invisible")) {
        level1.save();
        level1.globalAlpha = alphaFille;
        level1.drawImage(imgFille, w / 2 - 150, h / 2 - 100, 280, 450);
        level1.restore();
    }
}

const actualiserAffichageMenu = () => {
    setTimeout(() => {
        if (!menuDialogue.classList.contains("invisible") || !menu1_level1.classList.contains("invisible")) {
            dessin_menu();
        }
    }, 100);
};
window.addEventListener("resize", actualiserAffichageMenu);
if (screen.orientation) screen.orientation.addEventListener("change", actualiserAffichageMenu);


// Passage du Chapitre 1 au Dialogue (avec fondu) 
btn_menu1.addEventListener("click", () => {
    menu1_level1.classList.add("invisible");
    menuDialogue.classList.remove("invisible");
    boiteDialogue.style.opacity = 0;

    let startTime = null;

    function fonduApparition(timestamp) {
        if (!startTime) startTime = timestamp;
        let progress = (timestamp - startTime) / 1000;

        if (progress < 1) {
            alphaFille = progress;
            boiteDialogue.style.opacity = progress;
            dessin_menu();
            requestAnimationFrame(fonduApparition);
        } else {
            alphaFille = 1;
            boiteDialogue.style.opacity = 1;
            dessin_menu();

            document.querySelector("#texte_dialogue").textContent = "Hello traveler! My father needs wood to repair the mill before winter."; dialogue("#texte_dialogue");
            dialogue_son.play();

            setTimeout(() => { btn_suite_dialogue.style.opacity = 1; }, 4000);
        }
    }
    requestAnimationFrame(fonduApparition);
});

// Suite et Fin du Dialogue ------------------------------------
btn_suite_dialogue.addEventListener("click", () => {
    if (etapeDialogue === 1) {
        btn_suite_dialogue.style.opacity = 0;
        document.querySelector("#texte_dialogue").textContent = "Help us collect the wooden planks so we can help you."; dialogue("#texte_dialogue");

        setTimeout(() => { btn_suite_dialogue.style.opacity = 1; }, 3700);
        etapeDialogue = 2;
    }
    else if (etapeDialogue === 2) {
        menuDialogue.classList.add("invisible");
        menu2_level1.classList.remove("invisible");
        alphaFille = 0;
        dessin_menu();
    }
});


// FONCTIONS GLOBALES DU JEU ---------------------------------------------------------------------------
btn_menu2.addEventListener("click", demarrer);
btn_recommencer.addEventListener("click", demarrer);
btn_fin.addEventListener("click", signalVictory);
btn_fin.addEventListener("touchstart", signalVictory);

function demarrer() {
    if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(err => console.log(err));
    }
    menu2_level1.classList.add("invisible");
    menu_defaite.classList.add("invisible");
    ecran_allumee();
    initialisation_jeu(); // Fonction venant de script.js
}

function animerEtJouer(e) {
    e.preventDefault();
    const touche = e.currentTarget;

    touche.classList.remove("anime-touche");
    void touche.offsetWidth;
    touche.classList.add("anime-touche");
}

touche_droite.addEventListener("pointerdown", animerEtJouer);
touche_gauche.addEventListener("pointerdown", animerEtJouer);

//Fonction pour la fin du jeu ------------------------------------
function fin_du_jeu() {
    dessin_menu();
    musique_fond.pause();
    musique_fond.currentTime = 0;
    win_son.play();
    menu_fin.classList.remove("invisible");
}

function signalVictory() {
    window.parent.postMessage({
        type: 'GAME_CONTINUE',
        payload: {
            gameId: 1
        }
    }, '*');
}