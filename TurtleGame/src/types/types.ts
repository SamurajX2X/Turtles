export enum GameStatus {
    WAITING = 0,
    IN_PROGRESS = 1,
    FINISHED = 2
}

export type PlayerState = 0 | 1 | 2 | 3 | 4;

export interface Player {
    id: number;
    username: string;
    uuid: string;
    player_state: PlayerState;
    game_id: number;
    last_active: number | null;
}

export interface GameSession {
    id: number;
    name: string;
    status: GameStatus;
}

export interface CreateGameRequest {
    gameName: string;
    playerName: string;
}

export interface CreateGameResponse {
    session: GameSession;
    player: {
        username: string;
        uuid: string;
        state: PlayerState;
    };
}