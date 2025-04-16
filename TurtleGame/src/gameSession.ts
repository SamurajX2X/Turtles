import { gameApi } from './API/game';
import './style/tailwind.css';

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session');
    const playerId = urlParams.get('player');

    if (!sessionId || !playerId) {
        alert('Blad Danych sssssssql');
        window.location.href = '/';
        return;
    }

    console.log(`Session ID: ${sessionId}, Player ID: ${playerId}`);

    initGamePage(sessionId, playerId);
});

function clearGameCookies() {
    const date = new Date();
    date.setTime(date.getTime() - 1000);
    const expires = `expires=${date.toUTCString()}`;
    document.cookie = `gameSessionId=;${expires};path=/`;
    document.cookie = `gamePlayerId=;${expires};path=/`;
}

async function initGamePage(sessionId: string, playerId: string) {
    try {
        const players = await gameApi.getSessionPlayers(sessionId);
        console.log('Players:', players);

        const gameTitle = document.getElementById('game-title');
        if (gameTitle) {
            gameTitle.textContent = `Game Session: ${sessionId}`;
        }

        const readyBtn = document.getElementById('ready-btn') as HTMLButtonElement;
        let isReady = false;

        function updateReadyButton(ready: boolean) {
            isReady = ready;

            if (!readyBtn) return;

            if (ready) {
                readyBtn.textContent = 'Ready ✓';
                readyBtn.classList.add('bg-success');
                readyBtn.classList.remove('bg-primary');
            } else {
                readyBtn.textContent = 'Ready';
                readyBtn.classList.add('bg-primary');
                readyBtn.classList.remove('bg-success');
            }
        }

        if (readyBtn) {
            readyBtn.addEventListener('click', async () => {
                let originalText = readyBtn.textContent;
                try {
                    readyBtn.disabled = true;
                    readyBtn.textContent = 'Updating...';

                    await gameApi.togglePlayerReady(sessionId, playerId, !isReady);
                    updateReadyButton(!isReady);

                    readyBtn.disabled = false;
                } catch (error) {
                    console.error('Error setting ready status:', error);
                    alert('Failed to update ready status!');
                    readyBtn.disabled = false;
                    readyBtn.textContent = originalText;
                }
            });
        }

        const leaveBtn = document.getElementById('leave-btn');
        if (leaveBtn) {
            leaveBtn.addEventListener('click', async () => {
                if (confirm('Are you sure you want to leave this game?')) {
                    await leaveGame(sessionId, playerId);
                    window.location.href = '/';
                }
            });
        }

        window.addEventListener('beforeunload', function () {
            navigator.sendBeacon(`/server/api/sessions.php/sessions/${sessionId}/leave`,
                JSON.stringify({ uuid: playerId }));
        });

        const checkPlayerStatus = (players: any[]) => {
            const currentPlayer = players.find(p => p.uuid === playerId || p.id === playerId);

            if (currentPlayer) {
                updateReadyButton(currentPlayer.player_state === 1);
            }
        };

        const initialPlayers = await loadPlayers(sessionId);
        checkPlayerStatus(initialPlayers);

        // Start periodic checks for game state
        let gameStarted = false;

        const gameStateInterval = setInterval(async () => {
            try {
                // Check game status
                const gameState = await gameApi.getGameStatus(sessionId);

                if (gameState.status === 1 && !gameStarted) {
                    // Game has started!
                    gameStarted = true;
                    await handleGameStart(sessionId, playerId);
                    clearInterval(gameStateInterval); // Stop checking for game start
                } else if (gameState.status === 1) {
                    // Game is in progress, update UI
                    updateGameState(gameState, playerId);
                }

                const players = await loadPlayers(sessionId);
                checkPlayerStatus(players);

                // Check if all players are ready and auto-start
                if (!gameStarted && areAllPlayersReady(players)) {
                    console.log('All players are ready, checking game start...');
                    const startResponse = await gameApi.checkGameStart(sessionId);

                    if (startResponse.gameStarted) {
                        gameStarted = true;
                        await handleGameStart(sessionId, playerId);
                        clearInterval(gameStateInterval);
                    }
                }
            } catch (error) {
                console.error('Error checking game state:', error);
            }
        }, 1000);

        const setCookie = (name: string, value: string, days = 7) => {
            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            const expires = `expires=${date.toUTCString()}`;
            document.cookie = `${name}=${value};${expires};path=/`;
        };

        setCookie('gameSessionId', sessionId);
        setCookie('gamePlayerId', playerId);

    } catch (error) {
        console.error('Error initializing game page:', error);
    }
}

function areAllPlayersReady(players: any[]): boolean {
    if (players.length < 2) return false;
    return players.every(player => player.player_state === 1);
}

async function handleGameStart(sessionId: string, playerId: string) {
    console.log('Game is starting!');

    // Update UI to show game started
    const readyBtn = document.getElementById('ready-btn') as HTMLButtonElement;
    if (readyBtn) {
        readyBtn.style.display = 'none'; // Hide ready button
    }

    const gameBoard = document.getElementById('game-board');
    if (gameBoard) {
        gameBoard.innerHTML = '<h2 class="text-2xl font-bold text-primary mb-4">Game in Progress</h2>';
        gameBoard.style.display = 'block';
    }

    // Create turn indicator
    const turnIndicator = document.createElement('div');
    turnIndicator.id = 'turn-indicator';
    turnIndicator.className = 'bg-yellow-100 p-4 rounded-lg text-center mb-4';
    gameBoard?.prepend(turnIndicator);

    // Start game loop
    startGameLoop(sessionId, playerId);
}

function updateGameState(gameState: any, playerId: string) {
    const turnIndicator = document.getElementById('turn-indicator');
    if (!turnIndicator) return;

    if (gameState.activePlayer) {
        const isMyTurn = gameState.activePlayer.uuid === playerId;
        const timeRemaining = gameState.activePlayer.timeRemaining;

        if (isMyTurn) {
            turnIndicator.className = 'bg-success text-white p-4 rounded-lg text-center mb-4';
            turnIndicator.innerHTML = `
                <div class="font-bold">Your Turn!</div>
                <div>Time remaining: ${timeRemaining} seconds</div>
            `;
        } else {
            turnIndicator.className = 'bg-yellow-100 p-4 rounded-lg text-center mb-4';
            turnIndicator.innerHTML = `
                <div class="font-bold">${gameState.activePlayer.username}'s Turn</div>
                <div>Time remaining: ${timeRemaining} seconds</div>
            `;
        }
    }
}

async function startGameLoop(sessionId: string, playerId: string) {
    // Poll the game state every second
    const gameLoop = setInterval(async () => {
        try {
            const gameState = await gameApi.getGameStatus(sessionId);

            if (gameState.status !== 1) {
                // Game is no longer in progress
                clearInterval(gameLoop);
                if (gameState.status === 2) {
                    // Game has finished
                    handleGameEnd(gameState);
                }
                return;
            }

            updateGameState(gameState, playerId);
        } catch (error) {
            console.error('Error in game loop:', error);
        }
    }, 1000);
}

function handleGameEnd(gameState: any) {
    const gameBoard = document.getElementById('game-board');
    if (gameBoard) {
        gameBoard.innerHTML = `
            <h2 class="text-2xl font-bold text-primary mb-4">Game Over</h2>
            <div class="bg-yellow-100 p-4 rounded-lg text-center">
                <p>The game has ended.</p>
            </div>
        `;
    }
}

async function leaveGame(sessionId: string, playerId: string) {
    try {
        await gameApi.leaveSession(sessionId, playerId);
        clearGameCookies();
        console.log('Successfully left the game');
    } catch (error) {
        console.error('Error leaving game:', error);
    }
}

async function loadPlayers(sessionId: string) {
    try {
        const players = await gameApi.getSessionPlayers(sessionId);
        const playersContainer = document.getElementById('players-container');

        if (playersContainer) {
            playersContainer.innerHTML = players.map(player => `
                <div class="p-4 border-2 border-gray-300 rounded-lg ${player.player_state === 1 ? 'bg-success text-white' : 'bg-yellow-100'
                }">
                    <div class="font-bold">${player.username}</div>
                    <div class="text-sm mt-1">${player.player_state === 1 ? 'Ready' : 'Waiting'
                }</div>
                </div>
            `).join('');
        }

        return players;
    } catch (error) {
        console.error('Error loading players:', error);
        return [];
    }
}
