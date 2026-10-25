-- StudyFlow - skema MySQL untuk versi PHP.
-- Impor lewat phpMyAdmin (tab Import) atau:
--   mysql -u USER -p DBNAME < setup/schema.sql
-- Skema ini sama dengan yang dipakai Prisma di versi Node, jadi database
-- yang sudah ada bisa langsung dipakai tanpa migrasi data.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `User` (
  `id`           VARCHAR(191) NOT NULL,
  `email`        VARCHAR(191) NOT NULL,
  `name`         VARCHAR(255) NOT NULL,
  `passwordHash` VARCHAR(255) NOT NULL,
  `createdAt`    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `User_email_key` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Task` (
  `id`            VARCHAR(191) NOT NULL,
  `userId`        VARCHAR(191) NOT NULL,
  `name`          TEXT         NOT NULL,
  `course`        VARCHAR(255) NOT NULL,
  `weight`        DOUBLE       NOT NULL,
  `difficulty`    INT          NOT NULL,
  `hours`         DOUBLE       NOT NULL,
  `deadline`      DATETIME(3)  NOT NULL,
  `startAt`       DATETIME(3)  NULL,
  `completedAt`   DATETIME(3)  NULL,
  `emailReminder` TINYINT(1)   NOT NULL DEFAULT 1,
  `createdAt`     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `Task_userId_deadline_idx` (`userId`, `deadline`),
  CONSTRAINT `Task_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Subtask` (
  `id`        VARCHAR(191) NOT NULL,
  `taskId`    VARCHAR(191) NOT NULL,
  `name`      TEXT         NOT NULL,
  `done`      TINYINT(1)   NOT NULL DEFAULT 0,
  `position`  INT          NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `Subtask_taskId_idx` (`taskId`),
  CONSTRAINT `Subtask_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `NotificationLog` (
  `id`           VARCHAR(191) NOT NULL,
  `userId`       VARCHAR(191) NOT NULL,
  `taskId`       VARCHAR(191) NOT NULL,
  `kind`         VARCHAR(32)  NOT NULL,
  `scheduledFor` DATETIME(3)  NOT NULL,
  `sentAt`       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `NotificationLog_taskId_kind_scheduledFor_key` (`taskId`, `kind`, `scheduledFor`),
  KEY `NotificationLog_userId_sentAt_idx` (`userId`, `sentAt`),
  CONSTRAINT `NotificationLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `NotificationLog_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
