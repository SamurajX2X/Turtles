import { GameSession } from './types/types';
import { gameApi } from './API/game';
import './style/tailwind.css';

interface CreateSessionResponse {
    session: {
        id: string;
        name: string;
    };
    player: {
        uuid: string;
    };
}

document.addEventListener('DOMContentLoaded', () => {
    checkForExistingSession();
    setupForm();
    setupModals();
    refreshGameList();
    setInterval(refreshGameList, 1000);
});

function checkForExistingSession() {
    const sessionId = getCookie('gameSessionId');
    const playerId = getCookie('gamePlayerId');

    if (sessionId && playerId) {
        const rejoinDiv = document.createElement('div');
        rejoinDiv.className = 'bg-primary text-white p-4 rounded-lg mb-6 flex justify-between items-center';
        rejoinDiv.innerHTML = `
            <div>You have an active game session. Would you like to rejoin?</div>
            <div>
                <button id="rejoin-btn" class="bg-white text-primary font-medium px-4 py-2 rounded mr-2">
                    Rejoin Game
                </button>
                <button id="forget-session-btn" class="bg-transparent border border-white text-white px-4 py-2 rounded">
                    Forget Session
                </button>
            </div>
        `;

        const container = document.querySelector('.max-w-6xl');
        if (container && container.firstChild) {
            container.insertBefore(rejoinDiv, container.firstChild);
        }

        document.getElementById('rejoin-btn')?.addEventListener('click', () => {
            window.location.href = `/game.html?session=${sessionId}&player=${playerId}`;
        });

        document.getElementById('forget-session-btn')?.addEventListener('click', () => {
            clearGameCookies();
            rejoinDiv.remove();
        });
    }
}

function setCookie(name: string, value: string, days = 7) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = `expires=${date.toUTCString()}`;
    document.cookie = `${name}=${value};${expires};path=/`;
}

function getCookie(name: string): string | null {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

function clearGameCookies() {
    setCookie('gameSessionId', '', -1);
    setCookie('gamePlayerId', '', -1);
}

function setupForm() {
    const form = document.getElementById('create-game') as HTMLFormElement;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const gameNameInput = document.getElementById('game-name') as HTMLInputElement;
        const playerNameInput = document.getElementById('player-name') as HTMLInputElement;

        const gameName = gameNameInput.value;
        const playerName = playerNameInput.value;

        if (!gameName || !playerName) {
            alert('Proszę wypełnić wszystkie pola!');
            return;
        }

        const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating...';

        try {
            await createGameSession(gameName, playerName);
        } catch (error) {
            console.error('Błąd tworzenia gry:', error);
            alert('Błąd tworzenia gry!');

            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });
}

function setupModals() {
    const modal = document.getElementById('join-modal') as HTMLDivElement;
    const closeBtn = document.querySelector('.close-modal') as HTMLSpanElement;
    const joinForm = document.getElementById('join-game-form') as HTMLFormElement;

    closeBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.classList.add('hidden');
        }
    });

    joinForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const joinNameInput = document.getElementById('join-name') as HTMLInputElement;
        const playerName = joinNameInput.value.trim();
        const sessionId = joinForm.getAttribute('data-session-id');

        if (!playerName) {
            alert('Please enter your name!');
            return;
        }

        const submitBtn = joinForm.querySelector('button[type="submit"]') as HTMLButtonElement;
        const originalText = submitBtn.textContent;

        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Joining...';

            console.log(`Attempting to join session: ${sessionId} with name: ${playerName}`);
            const response = await gameApi.joinSession(sessionId!, playerName);
            console.log('Join response:', response);

            if (!response || !response.uuid) {
                throw new Error('Invalid server response - missing UUID');
            }

            setCookie('gameSessionId', sessionId!);
            setCookie('gamePlayerId', response.uuid);

            modal.classList.add('hidden');

            window.location.href = `/game.html?session=${sessionId}&player=${response.uuid}`;
        } catch (error) {
            console.error('Error joining game:', error);
            alert(`Failed to join the game: ${error instanceof Error ? error.message : 'Unknown error'}`);

            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });
}

async function createGameSession(gameName: string, playerName: string) {
    const response = await gameApi.createSession({
        gameName,
        playerName
    }) as CreateSessionResponse;

    console.log(response);

    if (!response) {
        throw new Error('Nie udało się utworzyć sesji gry!');
    }

    setCookie('gameSessionId', response.session.id);
    setCookie('gamePlayerId', response.player.uuid);

    window.location.href = `/game.html?session=${response.session.id}&player=${response.player.uuid}`;

    return response;
}

async function getActiveSessions(): Promise<GameSession[]> {
    const response = await gameApi.getSessions();

    return response;
}

async function refreshGameList() {
    const gamesList = document.getElementById('games-list')!;

    try {
        const sessions = await getActiveSessions();
        console.log("Available sessions:", sessions);

        gamesList.innerHTML = sessions.length > 0
            ? sessions.map(session => {
                console.log(`Rendering session: ${session.id}, name: ${session.name}`);

                return `
                <li class="py-4 px-3 flex justify-between items-center">
                    <div>
                        <span class="text-lg font-medium">${session.name}</span>
                        <span class="ml-2 inline-block w-3 h-3 rounded-full ${session.status === 0 ? 'bg-yellow-400' : 'bg-green-500'
                    }"></span>
                    </div>
                    <button class="join-btn px-4 py-2 bg-secondary text-white rounded hover:bg-opacity-80 transition-colors" 
                            data-session-id="${session.id || ''}"
                            ${session.status !== 0 ? 'disabled class="opacity-50 cursor-not-allowed"' : ''}>
                        Join
                    </button>
                </li>
            `}).join('')
            : '<li class="py-4 px-3 text-center text-gray-500">No active games</li>';

        document.querySelectorAll('.join-btn').forEach(btn => {
            const sessionId = btn.getAttribute('data-session-id');
            console.log(`Adding listener for session: ${sessionId}`);
            btn.addEventListener('click', handleJoinGame);
        });
    } catch (error) {
        console.error('Error loading games:', error);
        gamesList.innerHTML = '<li class="py-4 px-3 text-center text-red-500">Failed to load games</li>';
    }
}

function handleJoinGame(event: Event) {
    event.preventDefault();
    const button = event.target as HTMLButtonElement;
    const sessionId = button.getAttribute('data-session-id');

    if (!sessionId) {
        console.error('No session ID found on button');
        alert('Error: No session ID found');
        return;
    }

    console.log(`Handling join for session ID: ${sessionId}`);

    const modal = document.getElementById('join-modal') as HTMLDivElement;
    const joinForm = document.getElementById('join-game-form') as HTMLFormElement;

    joinForm.setAttribute('data-session-id', sessionId);

    const joinNameInput = document.getElementById('join-name') as HTMLInputElement;
    joinNameInput.value = '';

    modal.classList.remove('hidden');

    setTimeout(() => joinNameInput.focus(), 100);
}