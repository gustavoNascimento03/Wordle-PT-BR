document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DO JOGO ---
    const gameBoard = document.getElementById('game-board');
    const keyboard = document.getElementById('keyboard');
    const notificationContainer = document.getElementById('notification-container');

    // --- ESTADO DO JOGO ---
    const WORD_LENGTH = 5;
    const MAX_TRIES = 6;
    let currentRow = 0;
    let currentCol = 0;
    let secretWord = { original: '', normalized: '' };
    let wordList = [];
    const blockedLetters = new Set();
    let isGameOver = false;

    // --- FUNÇÕES AUXILIARES ---
    function normalizeWord(word) {
        return word.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    }

    // --- INICIALIZAÇÃO ---
    async function initializeGame() {
        await loadWordList();
        const randomWord = wordList[Math.floor(Math.random() * wordList.length)];
        secretWord = {
            original: randomWord,
            normalized: normalizeWord(randomWord)
        };
        
        console.log(`Palavra secreta: ${secretWord.original} (Normalizada: ${secretWord.normalized})`);
        createGameBoard();
        createKeyboard();
        updateActiveTile(); // Define o cursor inicial
    }

    async function loadWordList() {
        try {
            const response = await fetch('palavras.txt');
            const text = await response.text();
            wordList = text.split('\n')
                .map(word => word.trim().toLowerCase())
                .filter(word => word.length === WORD_LENGTH && !word.includes('-'));
            
            if (wordList.length === 0) {
                showNotification("Dicionário não encontrado ou vazio.");
            }
        } catch (error) {
            console.error("Erro ao carregar o dicionário:", error);
            showNotification("Erro ao carregar dicionário.");
        }
    }

    function createGameBoard() {
        gameBoard.innerHTML = '';
        for (let i = 0; i < MAX_TRIES; i++) {
            const row = document.createElement('div');
            row.className = 'row';
            for (let j = 0; j < WORD_LENGTH; j++) {
                const tile = document.createElement('div');
                tile.className = 'tile';
                row.appendChild(tile);
            }
            gameBoard.appendChild(row);
        }
    }

    function createKeyboard() {
        keyboard.innerHTML = '';
        const keys = [
            'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p',
            'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l',
            'ENTER', 'z', 'x', 'c', 'v', 'b', 'n', 'm', '⌫'
        ];
        const rows = [keys.slice(0, 10), keys.slice(10, 19), keys.slice(19)];
        rows.forEach(rowKeys => {
            const row = document.createElement('div');
            row.className = 'keyboard-row';
            rowKeys.forEach(key => {
                const button = document.createElement('button');
                button.className = 'key';
                button.textContent = key;
                if (key === 'ENTER' || key === '⌫') {
                    button.classList.add('large');
                }
                button.addEventListener('click', () => handleKeyPress(key));
                row.appendChild(button);
            });
            keyboard.appendChild(row);
        });
    }

    // --- LÓGICA ---
    function handleKeyPress(key) {
        if (isGameOver) return;
        const normalizedKey = key.toLowerCase();
        if (blockedLetters.has(normalizedKey)) {
            return;
        }
        if (normalizedKey === 'enter') {
            submitGuess();
        } else if (normalizedKey === 'backspace' || key === '⌫') {
            deleteLetter();
        } else if (normalizedKey.length === 1 && normalizedKey.match(/[a-zç]/)) {
            addLetter(normalizedKey);
        }
    }

    function addLetter(letter) {
        if (currentCol < WORD_LENGTH) {
            const tile = gameBoard.children[currentRow].children[currentCol];
            tile.textContent = letter.toUpperCase();
            tile.classList.add('filled');
            currentCol++;
            updateActiveTile();
        }
    }

    // LÓGICA DE DELETAR
    function deleteLetter() {
        // Pega o tile na posição ATUAL do cursor.
        const currentTile = gameBoard.children[currentRow]?.children[currentCol];

        // Se o cursor estiver em um tile que tem conteúdo,
        // e não estiver no início da linha, apaga o conteúdo desse tile.
        if (currentCol < WORD_LENGTH && currentTile && currentTile.textContent !== '') {
            currentTile.textContent = '';
            currentTile.classList.remove('filled');
            updateActiveTile();
            return;
        }

        // Comportamento padrão do backspace: apaga o caractere à esquerda.
        if (currentCol > 0) {
            currentCol--;
            const tileToDelete = gameBoard.children[currentRow].children[currentCol];
            tileToDelete.textContent = '';
            tileToDelete.classList.remove('filled');
            updateActiveTile();
        }
    }

    function submitGuess() {
        if (currentCol !== WORD_LENGTH) {
            showNotification('Palavra incompleta');
            return;
        }
        const guessArray = Array.from(gameBoard.children[currentRow].children)
            .map(tile => tile.textContent.toLowerCase());
        const normalizedGuess = normalizeWord(guessArray.join(''));
        const isWordInList = wordList.some(word => normalizeWord(word) === normalizedGuess);
        if (!isWordInList) {
            showNotification('Palavra não está na lista');
            return;
        }
        // Remove o cursor antes de revelar
        document.querySelector('.tile.active')?.classList.remove('active');
        revealGuess(guessArray);
    }

    function revealGuess(guessArray) {
        const rowTiles = gameBoard.children[currentRow].children;
        const secretOriginal = secretWord.original.split('');
        const secretNormalizedMutable = secretWord.normalized.split('');
        const states = Array(WORD_LENGTH).fill(null);

        for (let i = 0; i < WORD_LENGTH; i++) {
            const normalizedLetter = normalizeWord(guessArray[i]);
            if (normalizedLetter === secretNormalizedMutable[i]) {
                states[i] = 'correct';
                secretNormalizedMutable[i] = null;
                if (guessArray[i] !== secretOriginal[i]) {
                    rowTiles[i].textContent = secretOriginal[i].toUpperCase();
                }
            }
        }

        for (let i = 0; i < WORD_LENGTH; i++) {
            if (states[i] === null) {
                const normalizedLetter = normalizeWord(guessArray[i]);
                const letterIndex = secretNormalizedMutable.indexOf(normalizedLetter);
                if (letterIndex !== -1) {
                    states[i] = 'present';
                    secretNormalizedMutable[letterIndex] = null;
                } else {
                    states[i] = 'absent';
                }
            }
        }

        states.forEach((state, i) => {
            setTimeout(() => {
                rowTiles[i].classList.add('reveal', state);
                updateKeyboard(normalizeWord(guessArray[i]), state);
            }, i * 300);
        });

        setTimeout(() => checkWinOrLose(normalizeWord(guessArray.join(''))), WORD_LENGTH * 300);
    }
    
    function updateKeyboard(letter, state) {
        const key = Array.from(document.querySelectorAll('.key')).find(k => k.textContent.toLowerCase() === letter);
        if(key){
            const currentState = key.dataset.state;
            const statePriority = { 'correct': 3, 'present': 2, 'absent': 1 };
            const newStatePriority = statePriority[state];
            const currentPriority = statePriority[currentState] || 0;

            if (newStatePriority > currentPriority) {
                 key.style.backgroundColor = `var(--${state}-bg-color)`;
                 key.dataset.state = state;
            }
            
            if (state === 'absent' && !secretWord.normalized.includes(letter)) {
                key.classList.add('blocked');
                blockedLetters.add(letter);
            }
        }
    }

    function checkWinOrLose(normalizedGuess) {
        if (normalizedGuess === secretWord.normalized) {
            showNotification('Você venceu!', 5000);
            isGameOver = true;
        } else {
            currentRow++;
            currentCol = 0;
            if (currentRow === MAX_TRIES) {
                showNotification(`Você perdeu! A palavra era: ${secretWord.original.toUpperCase()}`, 5000);
                isGameOver = true;
            }
        }
        // Atualiza o cursor para a próxima linha ou para lugar nenhum se o jogo acabou
        updateActiveTile();
    }

    function showNotification(message, duration = 1000) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        notificationContainer.appendChild(notification);
        setTimeout(() => {
            notification.remove();
        }, duration);
    }

    // Função para gerenciar o cursor visual
    function updateActiveTile() {
        // Primeiro, remove o cursor de qualquer outro quadrado
        document.querySelectorAll('.tile.active').forEach(t => t.classList.remove('active'));
        
        // Se o jogo não acabou, adiciona o cursor ao quadrado atual
        if (!isGameOver) {
            const activeTile = gameBoard.children[currentRow]?.children[currentCol];
            if (activeTile) {
                activeTile.classList.add('active');
            }
        }
    }

    // --- LISTENERS DE EVENTOS ---

    function handleKeyboardEvent(event) {
        handleKeyPress(event.key);
    }
    document.addEventListener('keydown', handleKeyboardEvent);

    // Listener para cliques no tabuleiro
    gameBoard.addEventListener('click', (event) => {
        if (isGameOver) return;
        const tile = event.target;
        // Verifica se o clique foi em um quadrado e se é da linha atual
        if (tile.classList.contains('tile') && tile.parentElement === gameBoard.children[currentRow]) {
            const newCol = Array.from(tile.parentElement.children).indexOf(tile);
            currentCol = newCol;
            updateActiveTile();
        }
    });

    initializeGame();
});
