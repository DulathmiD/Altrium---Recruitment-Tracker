-- AlterTable
ALTER TABLE `user` ADD COLUMN `resetTokenExpiresAt` DATETIME(3) NULL,
    ADD COLUMN `resetTokenHash` VARCHAR(191) NULL;
