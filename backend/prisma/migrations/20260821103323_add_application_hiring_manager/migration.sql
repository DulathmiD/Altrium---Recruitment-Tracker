-- AlterTable
ALTER TABLE `candidateapplication` ADD COLUMN `hiringManagerId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `CandidateApplication` ADD CONSTRAINT `CandidateApplication_hiringManagerId_fkey` FOREIGN KEY (`hiringManagerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
