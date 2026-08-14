/*
  Warnings:

  - The values [ON_HOLD] on the enum `CandidateApplication_status` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `recommendation` on the `feedback` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `feedback` table. All the data in the column will be lost.
  - You are about to drop the column `interviewerId` on the `interview` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[interviewId,interviewerId]` on the table `Feedback` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `feedback` DROP FOREIGN KEY `Feedback_interviewId_fkey`;

-- DropForeignKey
ALTER TABLE `interview` DROP FOREIGN KEY `Interview_interviewerId_fkey`;

-- DropIndex
DROP INDEX `Feedback_interviewId_key` ON `feedback`;

-- DropIndex
DROP INDEX `Interview_interviewerId_fkey` ON `interview`;

-- AlterTable
ALTER TABLE `candidateapplication` ADD COLUMN `decidedAt` DATETIME(3) NULL,
    ADD COLUMN `decidedByUserId` INTEGER NULL,
    ADD COLUMN `hiringDecision` ENUM('HIRE', 'REJECT') NULL,
    MODIFY `status` ENUM('APPLIED', 'SHORTLISTED', 'REJECTED', 'IN_PROGRESS', 'HIRED') NOT NULL DEFAULT 'APPLIED';

-- AlterTable
ALTER TABLE `feedback` DROP COLUMN `recommendation`,
    DROP COLUMN `updatedAt`;

-- AlterTable
ALTER TABLE `interview` DROP COLUMN `interviewerId`;

-- CreateTable
CREATE TABLE `InterviewPanelist` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `interviewId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,

    UNIQUE INDEX `InterviewPanelist_interviewId_userId_key`(`interviewId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Feedback_interviewId_interviewerId_key` ON `Feedback`(`interviewId`, `interviewerId`);


-- AddForeignKey
ALTER TABLE `CandidateApplication` ADD CONSTRAINT `CandidateApplication_decidedByUserId_fkey` FOREIGN KEY (`decidedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InterviewPanelist` ADD CONSTRAINT `InterviewPanelist_interviewId_fkey` FOREIGN KEY (`interviewId`) REFERENCES `Interview`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InterviewPanelist` ADD CONSTRAINT `InterviewPanelist_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
