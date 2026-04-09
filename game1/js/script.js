// INITIALISATION DES VARIABLES ---------------------------------------------------------------------------
const body = document.querySelector("body");

// IMAGES
const fond = document.querySelector("#fond");
const vie = document.querySelector("#vie");
const sol = document.querySelector("#sol");
const perso1 = document.querySelector("#joueur1");
const perso2 = document.querySelector("#joueur2");
const perso3 = document.querySelector("#joueur3");
const bois = document.querySelector("#bois");
const boue1 = document.querySelector("#boue1");
const boue2 = document.querySelector("#boue2");
const piece1 = document.querySelector("#piece1");
const fleche_coeur = document.querySelector("#Arrow_soin");

// SON
const musique_fond = new Audio("sound/musique_fond.mp3"); //Musique de fond
musique_fond.loop = true; 
musique_fond.volume = 0.5;
const dialogue_son = new Audio("sound/dialogue.mp3");
const damage_sound = new Audio ("sound/damage.mp3"); //Son de dommage
const build_sound = new Audio ("sound/build.mp3");
const soin_sound = new Audio("sound/soin.wav");
const win_son = new Audio("sound/win.wav")

// TAILLE --------------------------------------------------------------------------------------------------
let w, h;
function taille() {
    w = window.innerWidth;
    h = window.innerHeight;

    if (w > 932 || h > 430) { //On limite à max 932px de largeur et 430px de hauteur
        w = 1100;
        h = 430;
    }

    body.width = w;
    body.height = h;
    map_leaflet.width = w;
    map_leaflet.width = h;
    canvas.width = w;
    canvas.height = h;
}

taille();
window.addEventListener("resize", () => {
    taille();
    // On actualise la position du personnage, du bois et de la boue
    personnage.y = h - 160;
    bois_t.forEach(planche => {
        planche.y = h - 45;
    });
    boues.forEach(flaque => {
        flaque.y = h - 30;
    });
});

// Voir si l'écran a été rotate (paysage ou portrait)
screen.orientation.addEventListener("change", () => {
    setTimeout(() => {
        taille();
        // On actualise la position du personnage, du bois et de la boue
        personnage.y = h - 160;
        bois_t.forEach(planche => {
            planche.y = h - 45;
        });
        boues.forEach(flaque => {
            flaque.y = h - 30;
        });
    }, 100);
});

// INITIALISATION DU JEU -----------------------------------------------------------------------------------------
function initialisation_jeu() {
    ecran_allumee() //Appel de cette fonction pour que l'écran reste allumée.
    personnage.x = w - 100;
    personnage.y = h - 160;
    personnage.dx = 0;
    personnage.vie = 3;
    personnage.direction = 1;
    personnage.vulnerabilite = true;
    personnage.delai_invincible = 0;
    ecrase = 0;

    nbr_bois = 0;
    pourcentage_moulin = 0;
    index_moulin = 0;
    bois_t = [];    
    planche_bois();
    boues = [];
    pluie = [];
    arrows = [];
    
    creerPluie(); //Appeler la pluie
    
    // SYSTÈME DE FLÈCHES
    delai_spawn_fleche = 500; // délai à 0.5 secondes
    clearTimeout(timer_spawn); // On nettoie les anciens spawn
    creerFleche();   // On lance la première flèche

    clearInterval(intervalDifficulte);
    intervalDifficulte = setInterval(() => {
        if (delai_spawn_fleche > 500) { // Limite max de difficulté : 1 flèche toutes les 0.4s
            delai_spawn_fleche -= 50;  // Le délai réduit de 100ms
        }
    }, 5000); // La difficulté augmente toutes les 5 secondes

    clearInterval(intervalBoue);
    intervalBoue = setInterval(boue, 3500);

    animation_rouage = 0;
    direction_rouage = 1;

    musique_fond.currentTime = 0;
    musique_fond.play();
    dernierTemps = performance.now();

    affichage();
}

// JOUEUR -----------------------------------------------------------------------------------------
let personnage = {
    x: w - 100, //Position x du joueur
    y: h - 160, //Position y du joueur
    dx: 0, //vitesse X du joueur
    vie: 3, //Nombre de vie du joueur (max 3)
    direction: 1,       // le sens ou le personnage regarde
    frameAnim: 0,       // image de l'animation
    compteurAnim: 0,     // Pour ralentir le changement d'image
    vulnerabilite: true, //Si le joueur est touché par une flèche, il possède un petit temps d'invincibilité
    delai_invincible: 0, //Délai d'invincibilité
}
let delai_invincible;
let ecrase = 0; //Si le joueur est touché par une flèche, on ajoute cette valeur à personnage.y et on soustrait la taille du sprite en y

const animationMarche = [perso2, perso1, perso3, perso1]; //Animation du personnage lorsqu'il marche

// initalisation du Cheat code (toucher 3 fois tout à droite en haut pour finir vite la partie)
let cheat_code = false;
let compteur_triche = 0; // Pour compter les 3 clics
let delai_triche = 0;
// Gestion des mouvements
window.addEventListener("touchstart", (e) => {
    let touchX = e.touches[0].clientX; //longueur du toucher
    let touchY = e.touches[0].clientY; //hauteur du toucher

    // Pour pouvoir activer le chead code (il faut cliquer 3 fois tout en haut à droite)
    if (touchX > w - 100 && touchY < 100) {
        compteur_triche++;
        if (compteur_triche >= 3) {
            cheat_code = true;
            console.log("Cheat code");
        }
    } else {
        compteur_triche = 0; 
    }

    // Les controle du joueur --------------
    if (touchX < w / 2) { //Si l'utilisateur touche la gauche de l'écran
        personnage.dx = -2; //Le perso se déplace à gauche
        personnage.direction = -1; //Le perso regarde à gauche
    } else { //Si l'utilisateur touche la droite de l'écran
        personnage.dx = 2;  //Le perso se déplace à droite
        personnage.direction = 1;  //Le perso regarde à droite
    }
});

window.addEventListener("touchend", () => { //Lorsque l'utilisateur ne touche plus l'écran, le perso ne bouge plus
    personnage.dx = 0;
});

function joueur() {
    if(personnage.x < 0) personnage.x = 0; //éviter que le joueur va en dehors
    else if(personnage.x > w - 80) personnage.x = w - 80;

    let vitesse_finale = personnage.dx;

    if (personnage.vulnerabilite === false) { //Lorsque le joueur est atteint par une flèche, sa vitesse diminue pendant un temps
        vitesse_finale = personnage.dx * 0.2; 
    }

    personnage.x += (vitesse_finale * ratio);
}

// BOIS -----------------------------------------------------------------------------------------

let nbr_bois;
let bois_t = [];
function planche_bois() {
    for(let i = 1; i <= 4; i++) {
        bois_t.push({
            x: 30,
            y: h - 45,
            recup: false,
        });
    }
};

// MOULIN ---------------------------------------------------------------------------

// Images du moulin qui se complètent
const moulin_sprite = [
    document.querySelector("#Moulin_0complete"),
    document.querySelector("#Moulin_25complete"),
    document.querySelector("#Moulin_50complete"),
    document.querySelector("#Moulin_75complete"),
    document.querySelector("#Moulin_100complete")
];
let pourcentage_moulin;
let index_moulin;

// Fonction pour voir à combien de % le moulin est complété
function moulin() {
    if (pourcentage_moulin === 100) {
        index_moulin = 4;
    } else if (pourcentage_moulin === 75) {
        index_moulin = 3;
    } else if (pourcentage_moulin === 50) {
        index_moulin = 2;
    } else if (pourcentage_moulin === 25) {
        index_moulin = 1;
    } else {
        index_moulin = 0;
    }
}

// FLECHES ---------------------------------------------------------------------------
let index = 0;

// les 4 sprite d'une flèche.
const flèches = [
    document.querySelector("#Arrow1"),
    document.querySelector("#Arrow2"),
    document.querySelector("#Arrow3"),
    document.querySelector("#Arrow4")
];


// Ce script permet d'initialiser la position des flèches en fonction de l'orientation du téléphone
let force_vent = 0; // Vitesse horizontale des flèches
window.addEventListener("deviceorientation", (e) => {
    let inclinaison = 0;
    //vérifie dans quel sens le joueur a tourné son téléphone
    let angleEcran = screen.orientation ? screen.orientation.angle : window.orientation;

    if (angleEcran === 90) {
        inclinaison = e.beta; // tourné vers la gauche
    } else if (angleEcran === -90 || angleEcran === 270) {
        inclinaison = -e.beta; // tourné vers la droite
    } else {
        inclinaison = e.gamma; // Portrait
    }

    // Délimiter les limites pour éviter qu'on puisse trop tourner le tel
    if (inclinaison !== null && inclinaison !== undefined) {
        
        //Si inclinaison > 30 ou < -30 on bloque a cette valeur
        if (inclinaison > 30) inclinaison = 30;
        if (inclinaison < -30) inclinaison = -30;

        // les flèches tombent en verticale
        if (inclinaison > -5 && inclinaison < 5) {
            inclinaison = 0;
        }

        force_vent = inclinaison / 6; 
    }
});

let delai_spawn_fleche = 500; // Les flèches apparaissent toutes les 5 secondes au début
let timer_spawn; // Garde en mémoire le chronomètre d'apparition
let intervalDifficulte; // Pour accélérer l'apparition des flèches

// fonction pour calculer la position x de la flèche et de la pluie en fonction de l'inclinaison
function calculerSpawnX() {
    let point_atterrissage = Math.random() * w;
    if (force_vent === 0) {
        return point_atterrissage;
    }
    let temps_de_chute = h / 5;
    let derive_totale = force_vent * temps_de_chute;
    return point_atterrissage - derive_totale;
}

function creerFleche() {
    //Générer si c'est une flèche de coeur ou de degat
    let chance = Math.floor(Math.random() * 10); 
    let type_fleche = (chance === 7) ? "soin" : "degat";

    arrows.push({
        x: calculerSpawnX(), //Position x calculé à partir de calculerSpawnX()
        y: h + 20, //Position Y
        dx: (Math.random() * 4) - 2, //Vitesse sur x
        dy: -(8 + Math.random() * 3), //Vitesse sur y
        indexSprite: 0, //valeur pour voir à quel sprite la flèche est
        compteur: 12,
        toucher_sol: false, //Si la flèche est au sol
        delai: 0, //delai durant lequel la flèche est au sol
        type: type_fleche //Flèche de feu ou de coeur
    });

    timer_spawn = setTimeout(creerFleche, delai_spawn_fleche);
}

// PLUIE -----------------------------------------------------------------------------------------
let pluie = [];
function creerPluie() {
    for(let i = 0; i < 200; i++) {
        pluie.push({
            x: (Math.random() * (w + 400)) - 200, //Position X
            y: Math.random() * h, //Position Y
            dx: 0, //Vitesse sur x
            dy: 5, //Vitesse sur y
        });
    }
}

// BOUE -----------------------------------------------------------------------------------------
let boues = [];
let intervalBoue;
function boue() {
    boues.push({
            x: Math.random() * w - 150, //Position X généré aléatoirement
            y: h - 30, //Position X
            taille: 1, //2 taille : une petit (aucun effet), une grande (ralenti le joueur)
            delai: 0 //Délai durant lequel la boue passe de petite à grande
        });
}

// Gérer les collisions entre le joueur et une flèche ---------------------------------------------------------------------------
function collision_fleche(fleche) {
    let joueurBox = { x: personnage.x + 20, y: personnage.y + 30, w: 40, h: 120 }; //Hitbox du joueur
    let flecheBox = { x: fleche.x + 10, y: fleche.y + 10, w: 30, h: 20 }; //Hitbox de la flèche

    // Si ça se touche
    if (joueurBox.x < flecheBox.x + flecheBox.w &&
        joueurBox.x + joueurBox.w > flecheBox.x &&
        joueurBox.y < flecheBox.y + flecheBox.h &&
        joueurBox.h + joueurBox.y > flecheBox.y) 
    { 
        if (fleche.toucher_sol === false && fleche.dy > 0) {
            
            // Si c'est une flèche de cupidon
            if (fleche.type === "soin") {
                if (personnage.vie < 3) { //On limite à 3 coeurs max
                    personnage.vie++; //le joueur regagne une vie
                }
                soin_sound.play(); 
                
                return true; // Demande la suppression immédiate de la flèche
            } 
            
            // Si c'est une flèche normal et qu'on est pas invinsible
            else if (personnage.vulnerabilite === true) {
                damage_sound.play();
                personnage.vie--;
                personnage.vulnerabilite = false; 
                ecrase = 10;
                
                return true; // Demande la suppression immédiate de la flèche
            }
        }
    }
    return false; // La flèche ne doit pas être supprimée
}

let dernierTemps;
let ratio;

// Animation de la pièce du chronorouage
let animation_rouage;
let direction_rouage;

// AFFICHAGE DES ELEMENTS ---------------------------------------------------------------------------------------------------------------------
function affichage(tempsActuel) {
    // FONCTIONNEMENT DU CHEAT CODE ----------------------------
    if (cheat_code === true) {
        fin_du_jeu();
        return;
    }

    if (!tempsActuel) tempsActuel = performance.now(); 
    let deltaTime = tempsActuel - dernierTemps;
    dernierTemps = tempsActuel;
    ratio = deltaTime / 16.66;
    if (ratio > 3) ratio = 3;

    level1.clearRect(0, 0, w, h);

    // AFFICHER LE FOND -------------------------
    level1.drawImage(fond, 0, 0, w, h);

    // AFFICHER LE MOULIN ----------------------------
    moulin();
    level1.drawImage(moulin_sprite[index_moulin], w - 200, h - 230, 150, 200);

    // AFFICHER LE SOL
    level1.drawImage(sol, 0, h - 50, w, 50);

    // AFFICHER LA BOUE ------------------------

    let modificateur_vitesse = 1.0; 
    boues.forEach(boue => {
        if (boue.taille === 1) {
            level1.drawImage(boue1, boue.x, boue.y, 40, 15); //Afficher une petite flaque
        } else {
            level1.drawImage(boue2, boue.x - 20, boue.y - 5, 80, 30); //Afficher une grosse flaque
        }
        boue.delai++;
        
        //Après un certain délai, la boue devient plus grande et peu ralentir le joueur.
        if (boue.delai === 180 && boue.taille === 1) { 
            boue.taille = 2;
        }

        // Si le joueur passe au dessus d'une grosse flaque 
        if (boue.taille === 2) {
            //Si le personnage est dans la hitbox de la flaque de boue
            if (personnage.x + 40 > boue.x && personnage.x + 40 < boue.x + 100) {
                modificateur_vitesse = 0.1;
            }
        }
    });

    if (personnage.dx !== 0) {
        personnage.x += (personnage.dx * modificateur_vitesse * ratio);
    }

    // AFFICHER LES FLECHES ------------------------------------------
    for (let i = arrows.length - 1; i >= 0; i--) {
        let fleche = arrows[i];

        if (fleche.toucher_sol === false) {
            fleche.dy += 0.1 * ratio; 
            
            fleche.x += (fleche.dx + force_vent) * ratio;
            fleche.y += fleche.dy * ratio;
        }

        // Rotation et Dessin
        level1.save();
        level1.translate(fleche.x + 25, fleche.y + 20);
        
        if (fleche.toucher_sol === false) {
            fleche.angle_memoire = Math.atan2(fleche.dy, fleche.dx + force_vent); //Rotation de la flèche en fonction de sa direction
        }
        level1.rotate((fleche.angle_memoire || 0) - (Math.PI / 4));

        // Lorsque la flèche est tirée de loin (monte), elle parait plus petit et plus transparente
        if (fleche.dy < 0) { 
            level1.scale(0.8, 0.8); 
            level1.globalAlpha = 0.2; 
        }
        
        // Choix de l'image (Cupidon ou Normale)
        if (fleche.type === "soin") {
            level1.drawImage(fleche_coeur, -25, -20, 50, 40);
        } else {
            level1.drawImage(flèches[fleche.indexSprite], -25, -20, 50, 40);
        }
        level1.restore();

        // Animation du feu des flèches
        if (fleche.type === "degat" && fleche.toucher_sol === false) {
            fleche.compteur += ratio;
            if (fleche.compteur >= 12) {
                fleche.indexSprite++;
                if (fleche.indexSprite >= flèches.length) fleche.indexSprite = 0; 
                fleche.compteur = 0;
            }
        }

        // Collision avec le sol et Suppression
        if (fleche.y >= h - 60 && fleche.dy > 0) {
            fleche.y = h - 60;
            fleche.toucher_sol = true;
            fleche.delai += ratio;

            // Si le délai au sol est dépassé, la flèche est supprimé
            if (fleche.delai >= 120) { 
                arrows.splice(i, 1); 
                continue; 
            }
        }

        // Collision avec le joueur et Suppression
        let joueurTouche = collision_fleche(fleche); //Appel de la fonction qui vérifie si une flèche touche le joueur
        if (joueurTouche === true) {
            arrows.splice(i, 1); // La flèche disparaît sur le joueur
        }
        
        // si la flèche vole trop loin hors de l'écran par les côtés, on la supprime
        if (fleche.x > w + 100 || fleche.x < -100) {
            arrows.splice(i, 1);
        }
    }

    // AFFICHER LA PLUIE ------------------------------------------
    level1.strokeStyle = "#100F3D"; 
    level1.lineWidth = 2;
    level1.beginPath();
    
    pluie.forEach(goutte => {
        if (goutte.y > h) {
            goutte.y = -20 - (Math.random() * 100);
            goutte.x = calculerSpawnX();
        }

        // Si la pluie part trop à gauche elle réapparaît à droite
        if (goutte.x < -150) {
            goutte.x = w + 150;
            goutte.y = Math.random() * h;
        }
        // Pareil mais vers la droite
        else if (goutte.x > w + 150) {
            goutte.x = -150;
            goutte.y = Math.random() * h;
        }
        
        goutte.y += goutte.dy * ratio;
        goutte.x += (goutte.dx + force_vent) * ratio;
        
        level1.moveTo(goutte.x, goutte.y);
        level1.lineTo(goutte.x - (force_vent * 3), goutte.y - 15); 
    });
    
    level1.stroke();

    // GESTION DU BOIS --------------------------------------------

    if (nbr_bois < bois_t.length) {
        if (bois_t[nbr_bois].recup === false) {
            level1.drawImage(bois, bois_t[nbr_bois].x, bois_t[nbr_bois].y, 70, 40); 
        }
        if (personnage.x < 50 && bois_t[nbr_bois].recup === false) {
            bois_t[nbr_bois].recup = true;
        }
        if (personnage.x > w - 200 && bois_t[nbr_bois].recup === true) {
            build_sound.play();
            bois_t[nbr_bois].recup = false;
            nbr_bois++;
            pourcentage_moulin += 25; 
        }
    }
    // AFFICHER LE JOUEUR ---------------------------------------------
    joueur();
    
    // ANIMATION DU JOUEUR
    let imageActuelle = perso1; 

    if (personnage.dx !== 0) {
        personnage.compteurAnim++;
        if (personnage.compteurAnim >= 18) { 
            personnage.frameAnim++;
            if (personnage.frameAnim >= animationMarche.length) {
                personnage.frameAnim = 0; 
            }
            personnage.compteurAnim = 0;
        }
        imageActuelle = animationMarche[personnage.frameAnim];
    } else {
        personnage.frameAnim = 0;
    }

    // gestion de l'invincibilité (qui dure quelque temps après que le joueur ait été touché par une flèche)
    if (personnage.vulnerabilite === false) {
        personnage.delai_invincible++;
        
        if (personnage.delai_invincible >= 100) { 
            personnage.vulnerabilite = true;
            ecrase = 0;
            personnage.delai_invincible = 0;
        }
    }
    // DESSIN DU JOUEUR ET DU BOIS QU'IL PORTE 
    level1.save();
    //Si le joueur a été touché par une flèche, son sprite devient un peu rouge lorsqu'il est invincible
    if (personnage.vulnerabilite === false) level1.filter = "sepia(100%) saturate(1000%) hue-rotate(-50deg)";
    else level1.filter = "none";

    if (personnage.direction === -1) {
        level1.scale(-1, 1);
        level1.drawImage(imageActuelle, -personnage.x - 80, personnage.y + ecrase, 80, 150 - ecrase);
        level1.filter = "none";
        // Si il regarde vers la gauche
        if (nbr_bois < bois_t.length && bois_t[nbr_bois].recup === true) {
            level1.drawImage(bois, -personnage.x - 60, personnage.y + 55 + ecrase, 70, 40);
        }
    } else {
        level1.drawImage(imageActuelle, personnage.x, personnage.y + ecrase, 80, 150 - ecrase);
        level1.filter = "none";
        // Si il regarde vers la droite
        if (nbr_bois < bois_t.length && bois_t[nbr_bois].recup === true) {
            level1.drawImage(bois, personnage.x + 20, personnage.y + 55 + ecrase, 70, 40);
        }
    }
    level1.restore();
    level1.filter = "none";

    // AFFICHER LES COEURS -----------------------------
    let positionX_coeur = 10;

    for (let i = 0; i < personnage.vie; i++) {
        level1.drawImage(vie, positionX_coeur, 10, 40, 35);
        positionX_coeur += 50; 
    }

    // Si le joueur a encore de la vie
    if (personnage.vie > 0) {
        // Si le joueur a ramené les 4 planches de bois, la pièce du chronorouage apparait
        if (index_moulin === 4) {
            //Ici c'est animation du rouage qui va de haut en bas
            animation_rouage += (direction_rouage * ratio);
            if (animation_rouage >= 20) {
                direction_rouage = -1;
            } 
            else if (animation_rouage <= -20) {
                direction_rouage = 1;
            }
            level1.drawImage(piece1, 30, (h - 130) + animation_rouage, 55, 80);
            if (personnage.x <= 50) {
                fin_du_jeu();
                return;
            }
        }
        // Sinon la boucle continue
        requestAnimationFrame(affichage);
        
    } else {
        menu_defaite.classList.remove("invisible"); // Le joueur n'a plus de vie donc game over
        navigator.vibrate(200);
        musique_fond.pause(); 
        musique_fond.currentTime = 0;
    }
}