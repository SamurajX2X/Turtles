<?php
$db = new mysqli('localhost', 'root', '', 'turtles');

if ($db->connect_error) {
    die("Failed connection " . $db->connect_error);
}

function query($sql)
{
    global $db;
    $result = $db->query($sql);
    if ($result === false) {
        echo "Error with queery" . $db->error;
        return null;
    }
    return $result;
}

function areAllPlayersReady($sessionId)
{
    global $db;
    $sessionId = $db->real_escape_string($sessionId);

    $result = $db->query("SELECT 
        COUNT(*) as total_players,
        SUM(CASE WHEN player_state = 1 THEN 1 ELSE 0 END) as ready_players
        FROM players 
        WHERE game_id = '$sessionId'");

    if (!$result) {
        return false;
    }

    $row = $result->fetch_assoc();

    return ($row['total_players'] >= 2 && $row['total_players'] == $row['ready_players']);
}

function startGameSession($sessionId)
{
    global $db;
    $sessionId = $db->real_escape_string($sessionId);
    $currentTime = time();

    $db->begin_transaction();

    try {
        $db->query("UPDATE sessions SET active = 1 WHERE id = '$sessionId'");

        $playerResult = $db->query("SELECT id, uuid FROM players WHERE game_id = '$sessionId' ORDER BY id LIMIT 1");
        if (!$playerResult || $playerResult->num_rows === 0) {
            throw new Exception("No players found");
        }

        $firstPlayer = $playerResult->fetch_assoc();
        $firstPlayerUuid = $firstPlayer['uuid'];
        $turnEndTime = $currentTime + 50;

        $db->query("UPDATE players SET player_state = 2 WHERE game_id = '$sessionId'");

        $db->query("UPDATE players SET player_state = 3, last_active = $turnEndTime WHERE uuid = '$firstPlayerUuid'");

        $db->commit();
        return true;
    } catch (Exception $e) {
        $db->rollback();
        return false;
    }
}

function getActivePlayer($sessionId)
{
    global $db;
    $sessionId = $db->real_escape_string($sessionId);

    $result = $db->query("SELECT id, uuid, username, last_active 
                         FROM players 
                         WHERE game_id = '$sessionId' AND player_state = 3 
                         LIMIT 1");

    if (!$result || $result->num_rows === 0) {
        return null;
    }

    return $result->fetch_assoc();
}

function advanceToNextTurn($sessionId)
{
    global $db;
    $sessionId = $db->real_escape_string($sessionId);
    $currentTime = time();

    $db->begin_transaction();

    try {
        $activePlayer = getActivePlayer($sessionId);
        if (!$activePlayer) {
            throw new Exception("No active player found");
        }

        $db->query("UPDATE players SET player_state = 2 WHERE uuid = '{$activePlayer['uuid']}'");

        $result = $db->query("SELECT id, uuid FROM players 
                            WHERE game_id = '$sessionId' 
                            AND uuid != '{$activePlayer['uuid']}'
                            ORDER BY id 
                            LIMIT 1");

        if (!$result || $result->num_rows === 0) {
            $result = $db->query("SELECT id, uuid FROM players 
                                WHERE game_id = '$sessionId' 
                                ORDER BY id 
                                LIMIT 1");
        }

        if (!$result || $result->num_rows === 0) {
            throw new Exception("No players found");
        }

        $nextPlayer = $result->fetch_assoc();
        $turnEndTime = $currentTime + 50;

        $db->query("UPDATE players SET player_state = 3, last_active = $turnEndTime WHERE uuid = '{$nextPlayer['uuid']}'");

        $db->commit();
        return true;
    } catch (Exception $e) {
        $db->rollback();
        return false;
    }
}

function isCurrentTurnExpired($sessionId)
{
    $activePlayer = getActivePlayer($sessionId);
    if (!$activePlayer || !isset($activePlayer['last_active'])) {
        return false;
    }

    return time() > $activePlayer['last_active'];
}

function getGameStatus($sessionId)
{
    global $db;
    $sessionId = $db->real_escape_string($sessionId);

    $result = $db->query("SELECT active FROM sessions WHERE id = '$sessionId'");

    if (!$result || $result->num_rows === 0) {
        return null;
    }

    $row = $result->fetch_assoc();
    return (int) $row['active'];
}