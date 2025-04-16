  -- phpMyAdmin SQL Dump
  -- version 5.2.1
  -- https://www.phpmyadmin.net/
  --
  -- Host: 127.0.0.1
  -- Generation Time: Apr 06, 2025 at 10:16 PM
  -- Wersja serwera: 10.4.32-MariaDB
  -- Wersja PHP: 8.0.30

  SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
  START TRANSACTION;
  SET time_zone = "+00:00";


  /*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
  /*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
  /*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
  /*!40101 SET NAMES utf8mb4 */;

  --
  -- Database: `turtles`
  --

  -- --------------------------------------------------------

  --
  -- Struktura tabeli dla tabeli `players`
  --

  CREATE TABLE `players` (
    `id` CHAR(36) NOT NULL DEFAULT (UUID()),
    `username` varchar(32) NOT NULL,
    `uuid` CHAR(36) NOT NULL DEFAULT (UUID()),
    `last_active` int(11) NOT NULL DEFAULT 0,
    `player_state` int(11) NOT NULL DEFAULT 0,
    `game_id` CHAR(36) NOT NULL,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`game_id`) REFERENCES `sessions` (`id`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_polish_ci;

  -- --------------------------------------------------------

  --
  -- Struktura tabeli dla tabeli `sessions`
  --

  CREATE TABLE `sessions` (
    `id` CHAR(36) NOT NULL DEFAULT (UUID()),
    `active` int(11) NOT NULL,
    `session_name` varchar(32) NOT NULL,
    PRIMARY KEY (`id`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_polish_ci;

  --
  -- Indeksy dla zrzutów tabel
  --

  --
  -- Indeksy dla tabeli `players`
  --
  ALTER TABLE `players`
    ADD PRIMARY KEY (`id`);

  --
  -- Indeksy dla tabeli `sessions`
  --
  ALTER TABLE `sessions`
    ADD PRIMARY KEY (`id`);
  COMMIT;

  /*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
  /*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
  /*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
