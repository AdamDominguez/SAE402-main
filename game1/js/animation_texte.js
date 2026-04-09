let timer_arret_son;

function dialogue(selecteur) {
    const div = document.querySelector(selecteur);
    const texteBrut = div.innerText;
    let output = "";
    
    texteBrut.split("").forEach(lettre => {
        output += `<span class="lettre">${lettre}</span>`;
    });
    
    div.innerHTML = output;
    
    dialogue_son.currentTime = 0;
    dialogue_son.play();
    
    clearTimeout(timer_arret_son); 
    
    timer_arret_son = setTimeout(() => {
        dialogue_son.pause();
    }, texteBrut.length * 50);
    
    // Animation des lettres
    [...div.children].forEach((lettre, index) => {
        setTimeout(() => {
            lettre.classList.add("visible");
        }, 50 * index);
    });
}

function afficherTxt() {
    [...this.children].forEach((lettre, index) => {
        setTimeout(() => { 
            lettre.classList.add("visible"); 
        }, 50 * index); // 50ms entre chaque lettre
    });
}
