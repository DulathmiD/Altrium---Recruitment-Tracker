/*
  Warnings:

  - You are about to drop the column `currentStageId` on the `candidateapplication` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `candidateapplication` table. All the data in the column will be lost.
  - You are about to drop the column `stageId` on the `interview` table. All the data in the column will be lost.
  - You are about to drop the `vacancystage` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[title,department]` on the table `Vacancy` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `stage` to the `Interview` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `candidateapplication` DROP FOREIGN KEY `CandidateApplication_currentStageId_fkey`;

-- DropForeignKey
ALTER TABLE `interview` DROP FOREIGN KEY `Interview_stageId_fkey`;

-- DropForeignKey
ALTER TABLE `vacancystage` DROP FOREIGN KEY `VacancyStage_vacancyId_fkey`;

-- DropIndex
DROP INDEX `CandidateApplication_currentStageId_fkey` ON `candidateapplication`;

-- DropIndex
DROP INDEX `Interview_stageId_fkey` ON `interview`;

-- AlterTable
ALTER TABLE `candidateapplication` DROP COLUMN `currentStageId`,
    DROP COLUMN `status`,
    ADD COLUMN `stage` ENUM('APPLIED', 'SHORTLISTED', 'INTERVIEW_1', 'INTERVIEW_2', 'FINAL_INTERVIEW', 'HIRED', 'REJECTED') NOT NULL DEFAULT 'APPLIED';

-- AlterTable
ALTER TABLE `interview` DROP COLUMN `stageId`,
    ADD COLUMN `stage` ENUM('APPLIED', 'SHORTLISTED', 'INTERVIEW_1', 'INTERVIEW_2', 'FINAL_INTERVIEW', 'HIRED', 'REJECTED') NOT NULL;

-- DropTable
DROP TABLE `vacancystage`;

-- CreateTable
CREATE TABLE `VacancyInterviewer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `vacancyId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,

    UNIQUE INDEX `VacancyInterviewer_vacancyId_userId_key`(`vacancyId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApplicationStageHistory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `applicationId` INTEGER NOT NULL,
    `stage` ENUM('APPLIED', 'SHORTLISTED', 'INTERVIEW_1', 'INTERVIEW_2', 'FINAL_INTERVIEW', 'HIRED', 'REJECTED') NOT NULL,
    `enteredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `exitedAt` DATETIME(3) NULL,
    `changedByUserId` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StageRecommendation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `applicationId` INTEGER NOT NULL,
    `hiringManagerId` INTEGER NOT NULL,
    `recommendation` ENUM('ADVANCE', 'DO_NOT_PROGRESS') NOT NULL,
    `comments` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Vacancy_title_department_key` ON `Vacancy`(`title`, `department`);

-- AddForeignKey
ALTER TABLE `VacancyInterviewer` ADD CONSTRAINT `VacancyInterviewer_vacancyId_fkey` FOREIGN KEY (`vacancyId`) REFERENCES `Vacancy`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VacancyInterviewer` ADD CONSTRAINT `VacancyInterviewer_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApplicationStageHistory` ADD CONSTRAINT `ApplicationStageHistory_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `CandidateApplication`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApplicationStageHistory` ADD CONSTRAINT `ApplicationStageHistory_changedByUserId_fkey` FOREIGN KEY (`changedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StageRecommendation` ADD CONSTRAINT `StageRecommendation_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `CandidateApplication`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StageRecommendation` ADD CONSTRAINT `StageRecommendation_hiringManagerId_fkey` FOREIGN KEY (`hiringManagerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
