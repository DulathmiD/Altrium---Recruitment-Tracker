/*
  Warnings:

  - You are about to drop the column `scheduledAt` on the `interview` table. All the data in the column will be lost.
  - You are about to drop the column `vacancyStageId` on the `interview` table. All the data in the column will be lost.
  - You are about to drop the column `interviewId` on the `interviewpanelist` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[slotId,applicationId]` on the table `Interview` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[slotId,userId]` on the table `InterviewPanelist` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `slotId` to the `Interview` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slotId` to the `InterviewPanelist` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `interview` DROP FOREIGN KEY `Interview_vacancyStageId_fkey`;

-- DropForeignKey
ALTER TABLE `interviewpanelist` DROP FOREIGN KEY `InterviewPanelist_interviewId_fkey`;

-- DropIndex
DROP INDEX `Interview_vacancyStageId_fkey` ON `interview`;

-- DropIndex
DROP INDEX `InterviewPanelist_interviewId_userId_key` ON `interviewpanelist`;

-- AlterTable
ALTER TABLE `interview` DROP COLUMN `scheduledAt`,
    DROP COLUMN `vacancyStageId`,
    ADD COLUMN `slotId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `interviewpanelist` DROP COLUMN `interviewId`,
    ADD COLUMN `slotId` INTEGER NOT NULL;

-- CreateTable
CREATE TABLE `InterviewSlot` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `vacancyStageId` INTEGER NOT NULL,
    `scheduledAt` DATETIME(3) NOT NULL,
    `roundLabel` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Interview_slotId_applicationId_key` ON `Interview`(`slotId`, `applicationId`);

-- CreateIndex
CREATE UNIQUE INDEX `InterviewPanelist_slotId_userId_key` ON `InterviewPanelist`(`slotId`, `userId`);

-- AddForeignKey
ALTER TABLE `InterviewSlot` ADD CONSTRAINT `InterviewSlot_vacancyStageId_fkey` FOREIGN KEY (`vacancyStageId`) REFERENCES `VacancyStage`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InterviewPanelist` ADD CONSTRAINT `InterviewPanelist_slotId_fkey` FOREIGN KEY (`slotId`) REFERENCES `InterviewSlot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Interview` ADD CONSTRAINT `Interview_slotId_fkey` FOREIGN KEY (`slotId`) REFERENCES `InterviewSlot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
