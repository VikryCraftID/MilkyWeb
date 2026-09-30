const board = document.getElementById('game-board');
const keyboard = document.getElementById('keyboard');
const langSelect = document.getElementById('lang-select');
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalStats = document.getElementById('modal-stats');
const modalStartBtn = document.getElementById('modal-start-btn');
const modalClose = document.getElementById('modal-close');
const messageContainer = document.getElementById('message-container');
const loadingOverlay = document.getElementById('loading');

// API Configuration
const API_BASE = '';

let sessionId = null;
let currentGuess = '';
let currentRow = 0;
let gameOver = false;
let isGuest = false;
let currentLang = 'id';
let deadline = null;       // timestamp (ms) when the round ends
let timerInterval = null;
let busy = false;          // guards against double-submit

// Translations
const dictUI = {
    id: {
        played: "Dimainkan", winrate: "Tingkat Menang", best: "Terbaik", winPct: "Menang %",
        startBtn: "Mulai!", closeBtn: "Tutup",
        startTitle: "Mulai Permainan?", startMsg: "Kamu punya waktu 5 menit untuk menebak kata.",
        errorTitle: "AKSES DITOLAK",
        errorMsg: "Mulai permainan di WhatsApp terlebih dahulu dengan mengetik <code>.wordle id</code> atau <code>.wordle en</code>",
        expTitle: "SESI BERAKHIR", expMsg: "Sesi permainan ini sudah tidak aktif.",
        winTitle: "KEMENANGAN", winMsg: "Luar biasa! Kamu berhasil menebaknya.",
        loseTitle: "GAME OVER", loseMsg: "Katanya adalah ",
        connErr: "Gagal terhubung ke Milky Bot",
        notEnough: "Huruf belum lengkap", notInDict: "Kata tidak ada di kamus",
        guestTitle: "MAIN SEBAGAI TAMU?",
        guestMsg: "Nggak perlu WhatsApp. Pilih bahasa, langsung main — tapi tanpa hadiah Yen & Exp.",
        guestBtn: "Bermain sebagai Tamu",
        guestId: "Bahasa Indonesia",
        guestEn: "English"
    },
    en: {
        played: "Played", winrate: "Win Rate", best: "Best", winPct: "Win %",
        startBtn: "Start!", closeBtn: "Close",
        startTitle: "Start Game?", startMsg: "You have 5 minutes to guess the word.",
        errorTitle: "ACCESS DENIED",
        errorMsg: "Please start a game on WhatsApp first by typing <code>.wordle id</code> or <code>.wordle en</code>",
        expTitle: "SESSION EXPIRED", expMsg: "This game session is no longer active.",
        winTitle: "VICTORY", winMsg: "Magnificent! You guessed it.",
        loseTitle: "GAME OVER", loseMsg: "The word was ",
        connErr: "Failed to connect to Milky Bot",
        notEnough: "Not enough letters", notInDict: "Word not in dictionary",
        guestTitle: "PLAY AS A GUEST?",
        guestMsg: "No WhatsApp needed. Pick a language and play right away — but no Yen & Exp rewards.",
        guestBtn: "Play as a Guest",
        guestId: "Bahasa Indonesia",
        guestEn: "English"
    }
};

function t() { return dictUI[currentLang] || dictUI['id']; }

function applyTranslations(lang) {
    const d = dictUI[lang] || dictUI['id'];
    document.getElementById('lbl-header-played').textContent = d.played;
    document.getElementById('lbl-header-rate').textContent = d.winrate;
    document.getElementById('lbl-header-best').textContent = d.best;
    document.getElementById('lbl-stat-played').textContent = d.played;
    document.getElementById('lbl-stat-wins').textContent = d.winPct;
    modalStartBtn.textContent = d.startBtn;
    modalClose.textContent = d.closeBtn;
}

// Audio System
const sfx = {
    typing: new Audio(`${API_BASE}/assets/sound/wordle_typing.mp3`),
    yes: new Audio(`${API_BASE}/assets/sound/wordle_yes.mp3`),
    no: new Audio(`${API_BASE}/assets/sound/wordle_no.mp3`),
    win: new Audio(`${API_BASE}/assets/sound/wordle_win.ogg`),
    lose: new Audio(`${API_BASE}/assets/sound/wordle_lose.ogg`)
};

function playSFX(name) {
    const a = sfx[name];
    if (!a) return;
    try {
        a.volume = 0.5;
        a.currentTime = 0;
        a.play().catch(() => {});
    } catch (e) {}
}

const keys = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'DELETE']
];

const KEY_RANK = { absent: 1, present: 2, correct: 3 };

// 1. URL Parameter Extraction  -> /wordle/{lang}/{uuid}
function parseUrlParams() {
    const parts = window.location.pathname.split('/').filter(p => p);
    if (parts.length >= 2) {
        const uuid = parts[parts.length - 1];
        const lang = parts[parts.length - 2];
        if (['id', 'en'].includes(lang)) return { lang, uuid };
    }
    return null;
}

function initBoard() {
    board.innerHTML = '';
    for (let i = 0; i < 6; i++) {
        const row = document.createElement('div');
        row.className = 'row';
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
    keyboard.innerHTML = '';
    keys.forEach(rowKeys => {
        const row = document.createElement('div');
        row.className = 'kb-row';
        rowKeys.forEach(key => {
            const button = document.createElement('button');
            button.textContent = key === 'DELETE' ? '⌫' : key;
            button.className = 'key';
            if (key === 'ENTER' || key === 'DELETE') button.classList.add('large');
            button.id = `key-${key}`;
            button.onclick = () => handleInput(key);
            row.appendChild(button);
        });
        keyboard.appendChild(row);
    });
}

function setKeyColor(letter, status) {
    const key = document.getElementById(`key-${letter}`);
    if (!key) return;
    const current = key.dataset.state ? KEY_RANK[key.dataset.state] : 0;
    if (KEY_RANK[status] > current) {
        key.classList.remove('correct', 'present', 'absent');
        key.classList.add(status);
        key.dataset.state = status;
    }
}

function hideLoading() {
    if (loadingOverlay) loadingOverlay.classList.add('hidden');
}

// Handle Start Button
modalStartBtn.onclick = async () => {
    modalStartBtn.disabled = true;
    try {
        const response = await fetch(`${API_BASE}/api/wordle/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uuid: sessionId })
        });
        const data = await response.json();
        if (data.success || data.error === 'Game already started') {
            modalOverlay.classList.add('hidden');
            gameOver = false;
            startTimer(300000);
        } else {
            showMessage(t().connErr);
        }
    } catch (e) {
        showMessage(t().connErr);
    } finally {
        modalStartBtn.disabled = false;
    }
};

function showStartModal() {
    modalTitle.textContent = t().startTitle;
    modalTitle.style.color = "var(--accent-purple)";
    modalMessage.innerHTML = t().startMsg;
    modalStats.classList.add('hidden');
    modalStartBtn.classList.remove('hidden');
    modalClose.style.display = 'none';
    modalOverlay.classList.remove('hidden');
}

function showResultModal(title, msg, won, stats) {
    modalTitle.textContent = title;
    modalTitle.style.color = won ? 'var(--correct)' : 'var(--accent-magenta)';
    modalMessage.innerHTML = msg;

    if (stats) {
        document.getElementById('stat-played').textContent = stats.played;
        document.getElementById('stat-wins').textContent = `${stats.winRate}%`;
        document.getElementById('header-played').textContent = stats.played;
        document.getElementById('header-rate').textContent = `${stats.winRate}%`;
        document.getElementById('header-best').textContent = stats.best;
        modalStats.classList.remove('hidden');
    } else {
        modalStats.classList.add('hidden');
    }

    modalStartBtn.classList.add('hidden');
    modalOverlay.classList.remove('hidden');
    modalClose.style.display = 'block';
}

// Guest flow: tawarkan main sebagai tamu saat tidak ada sesi WA
function showGuestOffer(lang) {
    const d = dictUI[lang] || dictUI['id'];
    currentLang = lang;
    langSelect.value = lang;
    applyTranslations(lang);
    initBoard();
    initKeyboard();
    gameOver = true;
    isGuest = false;
    document.getElementById('timer-display').classList.add('hidden');
    modalTitle.textContent = d.guestTitle;
    modalTitle.style.color = "var(--accent-purple)";
    modalMessage.innerHTML = `${d.guestMsg}<br><br>` +
        `<button class="opt-btn" onclick="startGuest('id')">${d.guestId}</button><br><br>` +
        `<button class="opt-btn" onclick="startGuest('en')">${d.guestEn}</button>`;
    modalStats.classList.add('hidden');
    modalStartBtn.classList.add('hidden');
    modalOverlay.classList.remove('hidden');
    modalClose.style.display = 'none';
}

async function startGuest(lang) {
    modalMessage.innerHTML = '...';
    try {
        const response = await fetch(`${API_BASE}/api/wordle/guest/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lang })
        });
        const data = await response.json();
        if (!data.uuid) {
            showMessage(t().connErr);
            return;
        }
        isGuest = true;
        window.history.replaceState({}, '', `/wordle/${data.lang}/${data.uuid}`);
        modalOverlay.classList.add('hidden');
        await loadSession();
    } catch (e) {
        console.error(e);
        showMessage(t().connErr);
    }
}

// Load Session State from Bot
async function loadSession() {
    const params = parseUrlParams();
    if (!params) {
        applyTranslations('id');
        showGuestOffer('id');
        hideLoading();
        return;
    }

    sessionId = params.uuid;

    try {
        const response = await fetch(`${API_BASE}/api/wordle/state?uuid=${sessionId}`, {
            headers: { 'ngrok-skip-browser-warning': 'true', 'cf-tunnel-no-cookie': '1' }
        });
        const data = await response.json();

        if (response.status !== 200) {
            applyTranslations(params.lang);
            showGuestOffer(params.lang);
            hideLoading();
            return;
        }

        isGuest = !!data.guest;

        // Bahasa website mengikuti segmen URL (bahasa interaksi user), bukan bahasa kamus game
        currentLang = params.lang || data.lang || 'id';
        langSelect.value = currentLang;
        applyTranslations(currentLang);

        langSelect.addEventListener('change', (e) => {
            window.location.href = `/wordle/${e.target.value}/${sessionId}`;
        });

        // Profile
        document.getElementById('user-profile').classList.remove('hidden');
        document.getElementById('user-name').textContent = data.user.name;
        document.getElementById('user-id').textContent = `#${data.user.jid}`;
        const avatarImg = document.getElementById('user-avatar');
        avatarImg.src = data.user.pp.startsWith('http') ? data.user.pp : `${API_BASE}${data.user.pp}`;
        avatarImg.onerror = () => { avatarImg.src = `${API_BASE}/assets/users/avatar/default.png`; };

        document.getElementById('header-played').textContent = data.stats.played;
        document.getElementById('header-rate').textContent = `${data.stats.winRate}%`;
        document.getElementById('header-best').textContent = data.stats.best;

        initBoard();
        initKeyboard();

        // Replay existing guesses (instant)
        (data.board || []).forEach((item, idx) => {
            currentRow = idx;
            currentGuess = item.guess;
            updateBoard();
            const statuses = Array.from(item.result).map(emoji =>
                emoji === '🟩' ? 'correct' : emoji === '🟨' ? 'present' : 'absent'
            );
            revealTiles(statuses, true);
        });

        currentRow = data.tries;
        currentGuess = '';

        if (data.status === 'waiting') {
            gameOver = true;
            showStartModal();
        } else {
            startTimer(data.remainingTime);
            if (currentRow >= 6) {
                gameOver = true;
                stopTimer();
            }
        }
    } catch (err) {
        console.error(err);
        applyTranslations(params ? params.lang : 'id');
        showMessage(t().connErr);
    } finally {
        hideLoading();
    }
}

function startTimer(remainingMs) {
    clearInterval(timerInterval);
    const display = document.getElementById('timer-display');
    display.classList.remove('hidden');
    deadline = Date.now() + Math.max(0, remainingMs);

    function render() {
        const remaining = Math.max(0, deadline - Date.now());
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        display.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        display.classList.toggle('urgent', remaining > 0 && remaining <= 30000);
        if (remaining <= 0) {
            clearInterval(timerInterval);
            display.classList.remove('urgent');
        }
    }

    render();
    timerInterval = setInterval(render, 250);
}

function stopTimer() {
    clearInterval(timerInterval);
}

function showLockedScreen(title, msg) {
    initBoard();
    initKeyboard();
    gameOver = true;
    document.getElementById('timer-display').classList.add('hidden');
    modalTitle.textContent = title;
    modalTitle.style.color = "var(--accent-magenta)";
    modalMessage.innerHTML = msg;
    modalStats.classList.add('hidden');
    modalStartBtn.classList.add('hidden');
    modalOverlay.classList.remove('hidden');
    modalClose.style.display = 'none';
}

// Handle Inputs
function handleInput(key) {
    if (gameOver || busy) return;

    if (key === 'ENTER') {
        submitGuess();
    } else if (key === 'DELETE' || key === 'BACKSPACE') {
        if (currentGuess.length > 0) {
            currentGuess = currentGuess.slice(0, -1);
            updateBoard();
            playSFX('typing');
        }
    } else if (/^[A-Z]$/.test(key)) {
        if (currentGuess.length < 5) {
            currentGuess += key;
            updateBoard();
            playSFX('typing');
            const tile = document.getElementById(`tile-${currentRow}-${currentGuess.length - 1}`);
            if (tile) {
                tile.classList.add('pop');
                setTimeout(() => tile.classList.remove('pop'), 120);
            }
        }
    }
}

function updateBoard() {
    for (let i = 0; i < 5; i++) {
        const tile = document.getElementById(`tile-${currentRow}-${i}`);
        if (!tile) continue;
        const ch = currentGuess[i] || '';
        tile.textContent = ch;
        tile.classList.toggle('filled', ch !== '');
    }
}

async function submitGuess() {
    if (currentGuess.length !== 5) {
        shakeRow();
        showMessage(t().notEnough);
        playSFX('no');
        return;
    }

    busy = true;
    try {
        const response = await fetch(`${API_BASE}/api/wordle/guess`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true',
                'cf-tunnel-no-cookie': '1'
            },
            body: JSON.stringify({ uuid: sessionId, guess: currentGuess })
        });
        const data = await response.json();

        if (data.status === 'error') {
            shakeRow();
            showMessage(data.message === 'Word not in dictionary' ? t().notInDict : data.message);
            playSFX('no');
            return;
        }

        const rowBeingRevealed = currentRow;
        revealTiles(data.result);

        if (data.won) {
            gameOver = true;
            stopTimer();
            setTimeout(() => winBounce(rowBeingRevealed), 1100);
            showGameSummary(t().winTitle);
            setTimeout(() => {
                showResultModal(t().winTitle, t().winMsg, true, data.stats);
                playSFX('win');
            }, 1800);
        } else if (data.lost) {
            gameOver = true;
            stopTimer();
            showGameSummary(t().loseTitle);
            setTimeout(() => {
                showResultModal(t().loseTitle, `${t().loseMsg} <b>${data.answer}</b>`, false, data.stats);
                playSFX('lose');
            }, 1800);
        } else {
            currentRow++;
            currentGuess = '';
        }
    } catch (err) {
        console.error(err);
        showMessage(`${t().connErr}`);
        playSFX('no');
    } finally {
        busy = false;
    }
}

function showGameSummary(text) {
    const timer = document.getElementById('timer-display');
    const summary = document.getElementById('game-summary');
    timer.classList.add('hidden');
    summary.textContent = text;
    summary.classList.remove('hidden');
}

function revealTiles(result, instant = false) {
    const row = currentRow;
    const guess = currentGuess;

    result.forEach((status, i) => {
        const tile = document.getElementById(`tile-${row}-${i}`);
        if (!tile) return;
        const letter = guess[i];

        if (instant) {
            tile.classList.remove('filled');
            tile.classList.add(status);
            setKeyColor(letter, status);
        } else {
            setTimeout(() => {
                tile.classList.add('reveal');
                playSFX('yes');
                setTimeout(() => {
                    tile.classList.remove('filled');
                    tile.classList.add(status);
                    setKeyColor(letter, status);
                }, 270);
            }, i * 220);
        }
    });
}

function winBounce(row) {
    for (let i = 0; i < 5; i++) {
        const tile = document.getElementById(`tile-${row}-${i}`);
        if (!tile) continue;
        setTimeout(() => {
            tile.classList.add('win-bounce');
            setTimeout(() => tile.classList.remove('win-bounce'), 600);
        }, i * 90);
    }
}

function shakeRow() {
    for (let i = 0; i < 5; i++) {
        const tile = document.getElementById(`tile-${currentRow}-${i}`);
        if (!tile) continue;
        tile.classList.add('shake');
        setTimeout(() => tile.classList.remove('shake'), 500);
    }
}

function showMessage(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    messageContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

window.addEventListener('keydown', (e) => {
    if (modalOverlay && !modalOverlay.classList.contains('hidden')) return;
    const key = e.key.toUpperCase();
    if (key === 'BACKSPACE') handleInput('DELETE');
    else if (key === 'ENTER') handleInput('ENTER');
    else if (/^[A-Z]$/.test(key)) handleInput(key);
});

modalClose.onclick = () => modalOverlay.classList.add('hidden');

loadSession();
