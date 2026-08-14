-- AlterTable
ALTER TABLE `candidate` ADD COLUMN `phoneNumber` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `Feedback` ADD CONSTRAINT `Feedback_interviewId_fkey` FOREIGN KEY (`interviewId`) REFERENCES `Interview`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
