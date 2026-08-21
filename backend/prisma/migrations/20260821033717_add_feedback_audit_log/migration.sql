-- CreateTable
CREATE TABLE `FeedbackAuditLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `feedbackId` INTEGER NOT NULL,
    `editedByUserId` INTEGER NOT NULL,
    `previousScore` INTEGER NOT NULL,
    `previousComments` TEXT NOT NULL,
    `newScore` INTEGER NOT NULL,
    `newComments` TEXT NOT NULL,
    `reason` TEXT NOT NULL,
    `editedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `FeedbackAuditLog` ADD CONSTRAINT `FeedbackAuditLog_feedbackId_fkey` FOREIGN KEY (`feedbackId`) REFERENCES `Feedback`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FeedbackAuditLog` ADD CONSTRAINT `FeedbackAuditLog_editedByUserId_fkey` FOREIGN KEY (`editedByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
