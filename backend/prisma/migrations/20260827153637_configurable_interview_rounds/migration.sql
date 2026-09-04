/*
  Warnings:

  - You are about to alter the column `stage` on the `applicationstagehistory` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(0))` to `Enum(EnumId(4))`.
  - The values [INTERVIEW_1,INTERVIEW_2,FINAL_INTERVIEW] on the enum `ApplicationStageHistory_stage` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `stage` on the `interview` table. All the data in the column will be lost.
  - Added the required column `vacancyStageId` to the `Interview` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `applicationstagehistory` ADD COLUMN `vacancyStageId` INTEGER NULL,
    MODIFY `stage` ENUM('APPLIED', 'SHORTLISTED', 'HIRED', 'REJECTED') NULL;

-- AlterTable
ALTER TABLE `candidateapplication` ADD COLUMN `currentVacancyStageId` INTEGER NULL,
    MODIFY `stage` ENUM('APPLIED', 'SHORTLISTED', 'HIRED', 'REJECTED') NOT NULL DEFAULT 'APPLIED';

-- AlterTable
ALTER TABLE `interview` DROP COLUMN `stage`,
    ADD COLUMN `vacancyStageId` INTEGER NOT NULL;

-- CreateTable
CREATE TABLE `VacancyStage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `vacancyId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL,

    UNIQUE INDEX `VacancyStage_vacancyId_order_key`(`vacancyId`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `VacancyStage` ADD CONSTRAINT `VacancyStage_vacancyId_fkey` FOREIGN KEY (`vacancyId`) REFERENCES `Vacancy`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CandidateApplication` ADD CONSTRAINT `CandidateApplication_currentVacancyStageId_fkey` FOREIGN KEY (`currentVacancyStageId`) REFERENCES `VacancyStage`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApplicationStageHistory` ADD CONSTRAINT `ApplicationStageHistory_vacancyStageId_fkey` FOREIGN KEY (`vacancyStageId`) REFERENCES `VacancyStage`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Interview` ADD CONSTRAINT `Interview_vacancyStageId_fkey` FOREIGN KEY (`vacancyStageId`) REFERENCES `VacancyStage`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
