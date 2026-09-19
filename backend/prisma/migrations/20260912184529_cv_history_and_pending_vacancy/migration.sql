-- AlterTable
ALTER TABLE `candidate` ADD COLUMN `pendingCvIsIdentical` BOOLEAN NULL,
    ADD COLUMN `pendingCvVacancyId` INTEGER NULL;

-- CreateTable
CREATE TABLE `CandidateCvVersion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `candidateId` INTEGER NOT NULL,
    `cvUrl` VARCHAR(191) NOT NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `vacancyTitle` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Candidate` ADD CONSTRAINT `Candidate_pendingCvVacancyId_fkey` FOREIGN KEY (`pendingCvVacancyId`) REFERENCES `Vacancy`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CandidateCvVersion` ADD CONSTRAINT `CandidateCvVersion_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `Candidate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
