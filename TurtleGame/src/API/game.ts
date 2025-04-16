import { apiRequest } from './config';
import { GameSession, CreateGameRequest } from '../types/types';

export const gameApi = {
    async getSessions(): Promise<GameSession[]> {
        return apiRequest('/sessions.php/sessions');
    },

    async createSession(data: CreateGameRequest): Promise<{
    }> {
        return apiRequest('/sessions.php/sessions', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async joinSession(sessionId: string, playerName: string): Promise<{
        id: string,
        name: string,
        status: number,
        uuid: string
    }> {
        // Validate sessionId before making the request
        if (!sessionId) {
            throw new Error('Session ID is required');
        }

        console.log(`Joining session ${sessionId} with player ${playerName}`);

        return apiRequest(`/sessions.php/sessions/${sessionId}/join`, {
            method: 'POST',
            body: JSON.stringify({ playerName })
        });
    },

    async leaveSession(sessionId: string, uuid: string): Promise<void> {
        return apiRequest(`/sessions.php/sessions/${sessionId}/leave`, {
            method: 'POST',
            body: JSON.stringify({ uuid })
        });
    },

    async getSessionPlayers(sessionId: number | string): Promise<{
        id: string | number,
        username: string,
        player_state: number
    }[]> {
        // Fix this endpoint too
        return apiRequest(`/sessions.php/sessions/${sessionId}/players`);
    },

    async setPlayerReady(sessionId: number | string, uuid: string): Promise<void> {
        // Fix this endpoint as well
        return apiRequest(`/sessions.php/sessions/${sessionId}/ready`, {
            method: 'POST',
            body: JSON.stringify({ uuid })
        });
    },

    async togglePlayerReady(sessionId: string | number, uuid: string, ready: boolean): Promise<void> {
        return apiRequest(`/sessions.php/sessions/${sessionId}/ready`, {
            method: 'POST',
            body: JSON.stringify({
                uuid,
                ready // Pass whether player should be ready or not
            })
        });
    },

    async getGameStatus(sessionId: string | number): Promise<any> {
        return apiRequest(`/sessions.php/sessions/${sessionId}/status`);
    },

    async checkGameStart(sessionId: string | number): Promise<any> {
        return apiRequest(`/sessions.php/sessions/${sessionId}/checkstart`, {
            method: 'POST',
            body: JSON.stringify({})
        });
    }
};