-- AlterTable
ALTER TABLE `candidateapplication` ADD COLUMN `currentStageId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `CandidateApplication` ADD CONSTRAINT `CandidateApplication_currentStageId_fkey` FOREIGN KEY (`currentStageId`) REFERENCES `VacancyStage`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
