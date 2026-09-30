document.addEventListener('DOMContentLoaded', () => {
    const board = document.getElementById('game-board');
    const keyboard = document.getElementById('keyboard');
    const dialogOverlay = document.getElementById('dialog-overlay');
    const dialogText = document.getElementById('dialog-text');
    const dialogOptions = document.getElementById('dialog-options');
    const fadeOverlay = document.getElementById('fade-overlay');
    const introOverlay = document.getElementById('intro-overlay');
    const introText = document.getElementById('intro-text');
    const introSubtext = document.getElementById('intro-subtext');

    let currentStep = 0;
    let currentGuess = '';
    let currentRow = 0;
    let targetWord = 'CERIA';
    let isTyping = false;
    let canAdvance = false;
    let tutorialOver = false;

    // SFX
    const sfx = {
        typing: new Audio('/assets/sound/wordle_typing.mp3'),
        yes: new Audio('/assets/sound/wordle_yes.mp3'),
        no: new Audio('/assets/sound/wordle_no.mp3'),
        win: new Audio('/assets/sound/wordle_win.ogg'),
        lose: new Audio('/assets/sound/wordle_lose.ogg')
    };

    function playSFX(name) {
        if (sfx[name]) {
            sfx[name].volume = 0.5;
            sfx[name].currentTime = 0;
            sfx[name].play().catch(() => {});
        }
    }

    // Initial UI
    function initBoard() {
        board.innerHTML = '';
        for (let i = 0; i < 6; i++) {
            const row = document.createElement('div');
            row.className = 'row';
            row.id = `row-${i}`;
            for (let j = 0; j < 5; j++) {
                const tile = document.createElement('div');
                tile.className = 'tile';
                tile.id = `tile-${i}-${j}`;
                row.appendChild(tile);
            }
            board.appendChild(row);
        }
    }

    function initKeyboard() {
        const keys = [
            ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
            ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
            ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'DELETE']
        ];
        keyboard.innerHTML = '';
        keys.forEach(rowKeys => {
            const row = document.createElement('div');
            row.className = 'kb-row';
            rowKeys.forEach(key => {
                const button = document.createElement('button');
                button.textContent = key === 'DELETE' ? 'DEL' : key;
                button.className = 'key';
                if (key === 'ENTER' || key === 'DELETE') button.classList.add('large');
                button.id = `key-${key}`;
                button.onclick = (e) => { e.stopPropagation(); handleInput(key); };
                row.appendChild(button);
            });
            keyboard.appendChild(row);
        });
    }

    // Typewriter Effect
    async function typeText(text) {
        isTyping = true;
        canAdvance = false;
        dialogText.textContent = '';
        dialogOptions.innerHTML = '';
        
        const chars = Array.from(text);
        for (let i = 0; i < chars.length; i++) {
            dialogText.textContent += chars[i];
            if (chars[i] !== ' ') playSFX('typing');
            await new Promise(r => setTimeout(r, 45));
        }
        
        isTyping = false;
        const script = scripts[currentStep];
        if (script.options) {
            renderOptions(script.options);
        } else {
            canAdvance = true;
        }
    }

    function renderOptions(options) {
        dialogOptions.innerHTML = '';
        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'opt-btn';
            btn.textContent = opt.text;
            btn.onclick = (e) => {
                e.stopPropagation();
                if (opt.correct === false) {
                    playSFX('no');
                    typeText("Hmm..?");
                    return;
                }
                if (opt.correct === true) playSFX('yes');
                if (opt.action) opt.action();
                if (opt.next !== undefined) {
                    currentStep = opt.next;
                    runStep();
                }
            };
            dialogOptions.appendChild(btn);
        });
    }

    // Tutorial Script
    const scripts = [
        { text: "Hai! Kamu pasti belum terlalu familiar sama Wordle ya?", options: [{ text: "Iya nih", next: 1 }] },
        { text: "Hehe, tenang aja. Wordle itu gampang kok kalau sudah paham cara mainnya.", next: 2 },
        { text: "Aku bakal ngajarin kamu dari awal sampai ngerti.", next: 3 },
        { text: "Mulai sekarang panggil aku...", next: 4 },
        { text: "Milky!", options: [{ text: "Baik!", next: 5 }] },
        { text: "Tujuan Wordle itu sederhana.", next: 6 },
        { text: "Kamu harus menebak sebuah kata yang sudah ditentukan.", next: 7 },
        { text: "Tapi ingat, kamu hanya punya 6 kesempatan untuk menebaknya.", next: 8 },
        { text: "Dan tentu saja, waktumu juga terbatas.", next: 9 },
        { text: "Nanti kamu akan melihat beberapa kotak kosong seperti ini.", pos: 'bottom', action: () => { board.classList.add('highlight-board'); playSFX('yes'); }, next: 10 },
        { text: "Setiap kotak mewakili satu huruf.", pos: 'bottom', next: 11 },
        { text: "Masukkan sebuah kata, lalu Wordle akan memberikan petunjuk.", pos: 'bottom', options: [{ text: "Petunjuk seperti apa?", next: 12 }] },
        { 
            text: "Ayo coba masukkan kata 'Cinta' sebagai tebakan pertama. Dan kita lihat apakah kata tersebut mempunyai petunjuk untuk kita.", 
            pos: 'bottom', 
            action: () => { board.classList.remove('highlight-board'); keyboard.style.pointerEvents = 'auto'; } 
        },
        { text: "Bagus sekali! Ini adalah tebakan pertama yang lumayan", pos: 'bottom', next: 14 },
        { text: "Petunjuknya adalah warna dari kotak-kotak itu.", pos: 'bottom', options: [{ text: "Itu artinya apa?", next: 15 }, { text: "Gimana cara kita tahu kata nya?", next: 15 }] },
        { text: "Kamu lihat warna di tiap huruf itu", pos: 'bottom', action: () => highlightStep(1), next: 16 }, 
        { text: "Warna hijau berarti huruf itu sudah berada di tempat yang benar.", pos: 'bottom', action: () => highlightStep(1), next: 17 },
        { text: "Warna kuning artinya huruf itu ada dari kata yang kamu tebak, tetapi hurufnya berada di tempat yang salah.", pos: 'bottom', action: () => highlightStep(2), next: 18 }, 
        { 
            text: "Namun, jika warna kotaknya adalah hitam, itu berarti huruf itu tidak ada di kata yang harus kamu tebak.", 
            pos: 'bottom', 
            action: () => highlightStep(3), 
            options: [
                { text: "Hah? Ulangi lagi dong!", next: 15 },
                { text: "Dimengerti!", next: 19 }
            ] 
        },
        { text: "Luar biasa! Apakah kamu ingin mencoba untuk menebak kata selanjutnya?", pos: 'bottom', options: [{ text: "Ya!", next: 20 }, { text: "Bantu aku...", next: 21 }] },
        { text: "Bagus sekali. Mencoba sendiri itu lebih baik!", pos: 'bottom', action: () => { tutorialOver = false; } },
        { text: "Baiklah! Biarkan aku membantumu!", pos: 'bottom', next: 22 },
        { text: "(dalam hati) Kita sudah tahu huruf C dan A benar.", pos: 'bottom', action: () => highlightStep(1), next: 23 },
        { text: "(dalam hati) Kita juga tahu ada huruf I di dalam kata.", pos: 'bottom', action: () => highlightStep(2), next: 24 },
        { text: "(dalam hati) Sekarang mari cari huruf lain yang mungkin cocok.", pos: 'bottom', next: 25 },
        { text: "Baiklah, sesuai dengan petunjuk ini...", pos: 'bottom', next: 26 },
        { text: "Ayo coba lagi dengan kata 'Cerah'.", pos: 'bottom' },
        { text: "Wah! Itu berarti kita sudah bisa menebak katanya!", pos: 'bottom', next: 28 },
        { text: "Ayo pikirkan! Inget petunjuknya, dan kamu akan tahu jawabannya!", pos: 'bottom' },
        { text: "Yah kesempatan kamu habis, coba ulang dari awal?", options: [{ text: "Ulangi dari awal.", next: 0 }] },
        { text: "Kamu berhasil! Sepertinya kamu sudah siap untuk permainan yang sebenarnya!", options: [{ text: "Aku siap!", next: 31 }] },
        { text: "Ingat ya! Jika kamu lupa, datang lagi saja kesini...", next: 32 },
        { text: "Aku akan membuatmu mengingat kembali.", next: 33 },
        { 
            text: "Jika kotak berwarna hijau, artinya?", 
            options: [
                { text: "Huruf berada di tempat yang benar", next: 34, correct: true },
                { text: "Huruf tersebut tidak ada", correct: false },
                { text: "Huruf berada di tempat yang salah", correct: false }
            ] 
        },
        { 
            text: "Jika kotak berwarna kuning, artinya?", 
            options: [
                { text: "Huruf berada di tempat yang benar", correct: false },
                { text: "Huruf tersebut tidak ada", correct: false },
                { text: "Huruf berada di tempat yang salah", next: 35, correct: true }
            ] 
        },
        { 
            text: "Jika kotak berwarna hitam, artinya?", 
            options: [
                { text: "Huruf berada di tempat yang benar", correct: false },
                { text: "Huruf tersebut tidak ada", next: 36, correct: true },
                { text: "Huruf berada di tempat yang salah", correct: false }
            ] 
        },
        { text: "Tepat sekali!", next: 37 },
        { text: "Jangan sampai lupa aturan itu ya!", next: 38 },
        { 
            text: "Sampai jumpa!", 
            options: [
                { text: "Sampai jumpa, Milky!", action: () => finishTutorial() },
                { text: "Terima kasih, Milky!", action: () => finishTutorial() }
            ] 
        }
    ];

    function runStep() {
        const script = scripts[currentStep];
        if (!script) return;
        if (script.pos === 'bottom') dialogOverlay.classList.add('at-bottom');
        else dialogOverlay.classList.remove('at-bottom');
        if (script.action) script.action();
        typeText(script.text);
    }

    function advance() {
        if (isTyping || !canAdvance) return;
        const script = scripts[currentStep];
        if (script.next !== undefined) {
            currentStep = script.next;
            runStep();
        }
    }

    function highlightStep(type) {
        playSFX('yes');
        const r = 0; 
        if (type === 1) { 
            highlightTile(r, 0, 'highlight');
            highlightTile(r, 4, 'highlight');
        } else if (type === 2) { 
            highlightTile(r, 1, 'highlight-warn');
        } else if (type === 3) { 
            highlightTile(r, 2, 'highlight-error');
            highlightTile(r, 3, 'highlight-error');
        }
    }

    function highlightTile(r, c, cls) {
        const t = document.getElementById(`tile-${r}-${c}`);
        if (t) {
            t.classList.add(cls);
            setTimeout(() => t.classList.remove(cls), 3000);
        }
    }

    function handleInput(key) {
        if (tutorialOver) return;
        if (key === 'ENTER') {
            submitTutorialGuess();
        } else if (key === 'DELETE' || key === 'BACKSPACE') {
            if (currentGuess.length > 0) {
                currentGuess = currentGuess.slice(0, -1);
                updateBoardDisplay();
                playSFX('typing');
            }
        } else if (/^[A-Z]$/.test(key)) {
            if (currentGuess.length < 5) {
                currentGuess += key;
                updateBoardDisplay();
                playSFX('typing');
                const tile = document.getElementById(`tile-${currentRow}-${currentGuess.length - 1}`);
                tile.classList.add('pop');
                setTimeout(() => tile.classList.remove('pop'), 100);
            }
        }
    }

    function updateBoardDisplay() {
        for (let i = 0; i < 5; i++) {
            const tile = document.getElementById(`tile-${currentRow}-${i}`);
            tile.textContent = currentGuess[i] || '';
        }
    }

    async function submitTutorialGuess() {
        if (currentGuess.length !== 5) {
            playSFX('no');
            return;
        }
        const guess = currentGuess.toUpperCase();
        if (currentStep === 12 && guess !== 'CINTA') {
            playSFX('no');
            typeText("Sensei suruh masukkan kata 'Cinta' dulu ya~");
            return;
        }
        const result = calculateResult(guess, targetWord);
        revealTiles(result);
        if (guess === targetWord) {
            tutorialOver = true;
            setTimeout(() => {
                playSFX('win');
                currentStep = 30; runStep();
            }, 2000);
            return;
        }
        currentRow++;
        currentGuess = '';
        if (currentStep === 12) {
            setTimeout(() => { currentStep = 13; runStep(); }, 1500);
        } else if (currentStep === 26 && guess === 'CERAH') {
            setTimeout(() => { currentStep = 27; runStep(); }, 1500);
        } else if (currentRow >= 6) {
            setTimeout(() => { currentStep = 29; runStep(); }, 1500);
        }
    }

    function calculateResult(guess, answer) {
        let res = Array(5).fill('absent');
        let ansArr = answer.split('');
        let gueArr = guess.split('');
        for (let i = 0; i < 5; i++) {
            if (gueArr[i] === ansArr[i]) { res[i] = 'correct'; ansArr[i] = null; }
        }
        for (let i = 0; i < 5; i++) {
            if (res[i] === 'correct') continue;
            const idx = ansArr.indexOf(gueArr[i]);
            if (idx !== -1) { res[i] = 'present'; ansArr[idx] = null; }
        }
        return res;
    }

    function revealTiles(result) {
        const row = currentRow;
        const guess = currentGuess;
        result.forEach((status, i) => {
            const tile = document.getElementById(`tile-${row}-${i}`);
            const key = document.getElementById(`key-${guess[i]}`);
            setTimeout(() => {
                tile.classList.add('flip');
                playSFX('yes');
                setTimeout(() => {
                    tile.classList.add(status);
                    if (key && !key.classList.contains('correct')) key.className = `key ${status}`;
                }, 300);
            }, i * 200);
        });
    }

    function finishTutorial() {
        fadeOverlay.classList.add('active');
        setTimeout(() => { window.location.href = '/wordle'; }, 1500);
    }

    async function startIntro() {
        introOverlay.style.display = 'flex';
        introOverlay.style.opacity = 1;
        introText.style.opacity = 0;
        introSubtext.style.opacity = 0;

        let clicks = 0;
        introOverlay.onclick = async () => {
            clicks++;
            if (clicks === 1) {
                introText.style.opacity = 1;
                setTimeout(() => { introSubtext.style.opacity = 1; }, 2500);
            } else {
                introOverlay.classList.add('fade-out');
                // Wait for the transition to finish before starting dialog
                setTimeout(() => {
                    introOverlay.style.display = 'none';
                    runStep();
                }, 1500);
            }
        };
    }

    initBoard();
    initKeyboard();
    keyboard.style.pointerEvents = 'none';
    window.onclick = advance;
    window.ontouchstart = advance;
    startIntro();
});
