<?php
require_once '../cors.php';
require_once '../database.php';
header('Content-Type: application/json');

handleRequest();

function handleRequest()
{
    $method = $_SERVER['REQUEST_METHOD'];
    $path = isset($_SERVER['PATH_INFO']) ? trim($_SERVER['PATH_INFO'], '/') : '';
    $segments = parse_path($path);

    if ($segments['resource'] === 'sessions') {
        switch ($method) {
            case 'GET':
                if ($segments['action'] === 'verify' && !empty($segments['id'])) {
                    verifyPlayerSession($segments['id'], $_GET['uuid'] ?? '');
                } elseif ($segments['action'] === 'status' && !empty($segments['id'])) {
                    checkGameStatus($segments['id']);
                } else {
                    handleGetRequest($segments);
                }
                break;
            case 'POST':
                handlePostRequest($segments);
                break;
            default:
                sendError('Method not allowed', 405);
        }
    } else {
        sendError('Resource not found', 404);
    }
}

function parse_path($path)
{
    $parts = explode('/', $path);
    return [
        'resource' => isset($parts[0]) ? $parts[0] : '',
        'id' => isset($parts[1]) ? $parts[1] : '',
        'action' => isset($parts[2]) ? $parts[2] : ''
    ];
}

function handleGetRequest($segments)
{
    if (empty($segments['id'])) {
        getAllSessions();
    } elseif ($segments['action'] === 'players') {
        getSessionPlayers($segments['id']);
    } else {
        sendError('Invalid endpoint');
    }
}

function handlePostRequest($segments)
{
    $data = json_decode(file_get_contents('php://input'), true);

    if (empty($segments['id'])) {
        if (isset($data['gameName']) && isset($data['playerName'])) {
            createSession($data);
        } else {
            sendError('Missing required parameters');
        }
    } elseif ($segments['action'] === 'join') {
        if (isset($data['playerName'])) {
            joinSession($segments['id'], $data['playerName']);
        } else {
            sendError('Missing playerName parameter');
        }
    } elseif ($segments['action'] === 'ready') {
        if (isset($data['uuid'])) {
            $ready = isset($data['ready']) ? (bool) $data['ready'] : true;
            setPlayerReady($segments['id'], $data['uuid'], $ready);

            // Check if all players are ready and start game if they are
            if (areAllPlayersReady($segments['id'])) {
                startGameSession($segments['id']);
            }
        } else {
            sendError('Missing uuid parameter');
        }
    } elseif ($segments['action'] === 'checkstart') {
        // New endpoint to check if game should start
        checkAndStartGame($segments['id']);
    } elseif ($segments['action'] === 'leave') {
        if (isset($data['uuid'])) {
            removePlayer($segments['id'], $data['uuid']);
        } else {
            sendError('Missing uuid parameter');
        }
    } else {
        sendError('Invalid endpoint');
    }
}

function createSession($data)
{
    global $db;

    $name = $db->real_escape_string($data['gameName']);
    $username = $db->real_escape_string($data['playerName']);
    $gameState = 0;
    $playerState = 0;

    $db->begin_transaction();

    try {
        $stmt = $db->prepare("INSERT INTO sessions (id, session_name, active) VALUES (UUID(), ?, ?)");
        $stmt->bind_param("si", $name, $gameState);
        if (!$stmt->execute()) {
            throw new Exception("Failed to create session");
        }

        $result = $db->query("SELECT id FROM sessions WHERE session_name = '$name' ORDER BY id DESC LIMIT 1");
        if (!$result || !($row = $result->fetch_assoc())) {
            throw new Exception("Failed to retrieve session ID");
        }
        $session_id = $row['id'];

        $stmt = $db->prepare("INSERT INTO players (id, username, uuid, last_active, player_state, game_id) 
                              VALUES (UUID(), ?, UUID(), 0, ?, ?)");
        $stmt->bind_param("sis", $username, $playerState, $session_id);
        if (!$stmt->execute()) {
            throw new Exception("Gracz nie moze dolazcuc");
        }

        $result = $db->query("SELECT id, uuid FROM players WHERE username = '$username' AND game_id = '$session_id' ORDER BY id DESC LIMIT 1");
        if (!$result || !($player = $result->fetch_assoc())) {
            throw new Exception("Blad dancy hgracza");
        }

        $db->commit();

        sendResponse([
            'session' => [
                'id' => $session_id,
                'name' => $name,
                'status' => $gameState
            ],
            'player' => [
                'id' => $player['id'],
                'username' => $username,
                'state' => $playerState,
                'uuid' => $player['uuid']
            ]
        ]);
    } catch (Exception $e) {
        $db->rollback();
        sendError($e->getMessage());
    }
}

function getAllSessions()
{
    global $db;

    $result = $db->query("SELECT id, session_name, active FROM sessions");

    if (!$result) {
        sendError("Database error");
        return;
    }

    $sessions = [];
    while ($row = $result->fetch_assoc()) {
        $sessions[] = [
            'id' => $row['id'],
            'name' => $row['session_name'],
            'status' => (int) $row['active']
        ];
    }

    sendResponse($sessions);
}

function getSessionPlayers($sessionId)
{
    global $db;

    $sessionId = $db->real_escape_string($sessionId);

    $result = $db->query("SELECT id, uuid, username, player_state FROM players WHERE game_id = '$sessionId'");

    if (!$result) {
        sendError("Failed to retrieve players");
        return;
    }

    $players = [];
    while ($row = $result->fetch_assoc()) {
        $players[] = [
            'id' => $row['id'],
            'uuid' => $row['uuid'],
            'username' => $row['username'],
            'player_state' => (int) $row['player_state']
        ];
    }

    sendResponse($players);
}

function joinSession($sessionId, $playerName)
{
    global $db;

    $sessionId = $db->real_escape_string($sessionId);
    $playerName = $db->real_escape_string($playerName);
    $playerState = 0;

    $result = $db->query("SELECT id FROM sessions WHERE id = '$sessionId'");
    if (!$result || $result->num_rows === 0) {
        sendError('Session not found');
        return;
    }

    $stmt = $db->prepare("INSERT INTO players (id, username, uuid, last_active, player_state, game_id) 
                         VALUES (UUID(), ?, UUID(), 0, ?, ?)");
    $stmt->bind_param("sis", $playerName, $playerState, $sessionId);

    if (!$stmt->execute()) {
        sendError('Failed to join session');
        return;
    }

    $result = $db->query("SELECT uuid FROM players WHERE username = '$playerName' AND game_id = '$sessionId' ORDER BY id DESC LIMIT 1");
    if (!$result || !($row = $result->fetch_assoc())) {
        sendError('Failed to retrieve player UUID');
        return;
    }

    sendResponse([
        'id' => $sessionId,
        'name' => $playerName,
        'status' => $playerState,
        'uuid' => $row['uuid']
    ]);
}

function setPlayerReady($sessionId, $uuid, $ready = true)
{
    global $db;

    $sessionId = $db->real_escape_string($sessionId);
    $uuid = $db->real_escape_string($uuid);
    $readyState = $ready ? 1 : 0;

    $stmt = $db->prepare("UPDATE players SET player_state = ? WHERE uuid = ? AND game_id = ?");
    $stmt->bind_param("iss", $readyState, $uuid, $sessionId);

    if (!$stmt->execute()) {
        sendError('Failed to update player ready status');
        return;
    }

    sendResponse([
        'success' => true,
        'ready' => $readyState
    ]);
}

function removePlayer($sessionId, $uuid)
{
    global $db;

    $sessionId = $db->real_escape_string($sessionId);
    $uuid = $db->real_escape_string($uuid);

    $stmt = $db->prepare("DELETE FROM players WHERE uuid = ? AND game_id = ?");
    $stmt->bind_param("ss", $uuid, $sessionId);

    if (!$stmt->execute()) {
        sendError('Failed to remove player');
        return;
    }

    $result = $db->query("SELECT COUNT(*) as count FROM players WHERE game_id = '$sessionId'");
    if ($result) {
        $row = $result->fetch_assoc();
        if ($row && $row['count'] == 0) {
            $db->query("DELETE FROM sessions WHERE id = '$sessionId'");
        }
    }

    sendResponse(['success' => true]);
}

function verifyPlayerSession($sessionId, $uuid)
{
    global $db;

    $sessionId = $db->real_escape_string($sessionId);
    $uuid = $db->real_escape_string($uuid);

    $result = $db->query("SELECT s.id, s.session_name, s.active 
                         FROM sessions s
                         WHERE s.id = '$sessionId'");

    if (!$result || $result->num_rows === 0) {
        sendError('Session not found');
        return;
    }

    $session = $result->fetch_assoc();

    $result = $db->query("SELECT id, username, player_state 
                         FROM players 
                         WHERE uuid = '$uuid' AND game_id = '$sessionId'");

    if (!$result || $result->num_rows === 0) {
        sendError('Player not found ');
        return;
    }

    $player = $result->fetch_assoc();

    sendResponse([
        'valid' => true,
        'session' => [
            'id' => $session['id'],
            'name' => $session['session_name'],
            'status' => (int) $session['active']
        ],
        'player' => [
            'id' => $player['id'],
            'username' => $player['username'],
            'player_state' => (int) $player['player_state']
        ]
    ]);
}

function checkAndStartGame($sessionId)
{
    $gameStatus = getGameStatus($sessionId);

    if ($gameStatus === 0 && areAllPlayersReady($sessionId)) {
        // Game is waiting and all players are ready
        if (startGameSession($sessionId)) {
            sendResponse([
                'gameStarted' => true,
                'status' => 1, // Game in progress
                'message' => 'Game started successfully!'
            ]);
        } else {
            sendError('Failed to start game');
        }
    } else if ($gameStatus === 1) {
        // Game is already in progress
        $activePlayer = getActivePlayer($sessionId);
        sendResponse([
            'gameStarted' => true,
            'status' => 1,
            'activePlayer' => $activePlayer ? [
                'uuid' => $activePlayer['uuid'],
                'username' => $activePlayer['username'],
                'timeRemaining' => max(0, $activePlayer['last_active'] - time())
            ] : null
        ]);
    } else {
        // Game is either not ready to start or has finished
        sendResponse([
            'gameStarted' => false,
            'status' => $gameStatus,
            'message' => 'Waiting for all players to be ready'
        ]);
    }
}

function checkGameStatus($sessionId)
{
    $status = getGameStatus($sessionId);
    $players = [];

    $result = query("SELECT id, uuid, username, player_state, last_active FROM players WHERE game_id = '$sessionId'");
    if ($result) {
        while ($player = $result->fetch_assoc()) {
            $players[] = $player;
        }
    }

    $activePlayer = getActivePlayer($sessionId);

    sendResponse([
        'status' => $status,
        'players' => $players,
        'activePlayer' => $activePlayer ? [
            'uuid' => $activePlayer['uuid'],
            'username' => $activePlayer['username'],
            'timeRemaining' => max(0, $activePlayer['last_active'] - time())
        ] : null
    ]);
}

function sendError($message, $code = 400)
{
    http_response_code($code);
    echo json_encode(['error' => $message]);
    exit;
}

function sendResponse($data)
{
    echo json_encode($data);
}
?>