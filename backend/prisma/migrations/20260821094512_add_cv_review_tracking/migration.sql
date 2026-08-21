-- AlterTable
ALTER TABLE `candidate` ADD COLUMN `lastCvReviewedAt` DATETIME(3) NULL,
    ADD COLUMN `lastCvReviewedByUserId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `Candidate` ADD CONSTRAINT `Candidate_lastCvReviewedByUserId_fkey` FOREIGN KEY (`lastCvReviewedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
