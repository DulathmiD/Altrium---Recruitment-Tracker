-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: recruitment_tracker
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `_prisma_migrations`
--

DROP TABLE IF EXISTS `_prisma_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `_prisma_migrations` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `checksum` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `finished_at` datetime(3) DEFAULT NULL,
  `migration_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `logs` text COLLATE utf8mb4_unicode_ci,
  `rolled_back_at` datetime(3) DEFAULT NULL,
  `started_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `applied_steps_count` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `_prisma_migrations`
--

LOCK TABLES `_prisma_migrations` WRITE;
/*!40000 ALTER TABLE `_prisma_migrations` DISABLE KEYS */;
INSERT INTO `_prisma_migrations` VALUES ('0a08b7f8-e834-47e3-8d8e-c5f53ee33a60','b578d332cf31f3ef4f63c935b687790a594622064f9d6c6a3d10baf4260a7bf4','2026-09-09 19:36:16.171','20260831103000_add_user_phone_number',NULL,NULL,'2026-09-09 19:36:16.016',1),('0b003bf3-1394-4bf7-8f60-dae964ec7945','e3c5d923f0792f4bb7eda35d48f845e9470cde074825a45880a46e7e0e5600e5','2026-09-09 19:36:12.620','20260814101648_panelists_hiring_decision_cleanup',NULL,NULL,'2026-09-09 19:36:11.956',1),('32be860c-4593-40ef-9fbd-6f362a219aff','681401fa44afac42ea50d7e627cd32d414d62fe06e7e63d81464f51bd396c7f0','2026-09-09 19:36:15.319','20260827171541_vacancy_target_fill_date',NULL,NULL,'2026-09-09 19:36:15.212',1),('3d3e2db5-fefd-40f2-bba5-adce42ecd775','77947f36f5006434b2dbe1e032f77bd6227c81121f5f92a157cd253c2e4a1ccd','2026-09-09 19:36:13.642','20260821103323_add_application_hiring_manager',NULL,NULL,'2026-09-09 19:36:13.405',1),('55a63e8a-859a-43f3-91a4-606e4c46cde5','20c88af9c0d4a723c264e50e5e0ad90f60610d20358186d91887fa8709e00d72','2026-09-09 19:36:14.369','20260821164834_pipeline_redesign_universal_stages',NULL,NULL,'2026-09-09 19:36:13.646',1),('86c4fd29-ecc2-4497-97ad-d0228bad0bc8','d6639586f0b3a45b51f42cfbcbe55e3a10dbcd716af0ec7d678402ece43c9ba9','2026-09-09 19:36:11.953','20260810062131_add_vacancy_fields_and_remaining_roles',NULL,NULL,'2026-09-09 19:36:11.773',1),('96bd2327-fe33-4805-a195-d377cf3fe9e4','3c4bd86cdb1a9968259b5c7981db029d7d0be9451d0cbc68d869bf4ae3a26c4a','2026-09-09 19:36:15.380','20260830055223_add_candidate_review_note',NULL,NULL,'2026-09-09 19:36:15.322',1),('9e022b27-5bd3-4864-a3d7-90dc733c6e24','da0b874513f2b270a748b1c7a16e77d0e5af7bcd338ea7f49cf43ed6d0ce0a39','2026-09-09 19:36:16.949','20260909162809_add_last_active_at',NULL,NULL,'2026-09-09 19:36:16.870',1),('9f8736df-4f61-4ced-99bb-461fc20387f0','125ad0937bfbba385378648585d1ce6d2cf1659ac5b95bd7845b2b00cf73dad5','2026-09-09 19:36:16.869','20260909125100_add_interview_panels',NULL,NULL,'2026-09-09 19:36:16.598',1),('b234f3ea-55d5-4e7e-80ef-538f56123b16','acaa252ef8a26eb76054d8ccae75e39a4b75fd08dd38f466d9ba6a25aa48a0df','2026-09-09 19:36:11.770','20260727094652_init',NULL,NULL,'2026-09-09 19:36:10.637',1),('bcc2bcba-cb28-47fc-9e2e-0d163a16ae0e','773308b3985b80fd9ae152b58fd705b0c09a2fd9f478c914adb40a2a33d51e94','2026-09-09 19:36:15.437','20260830065142_widen_vacancy_text_fields',NULL,NULL,'2026-09-09 19:36:15.381',1),('bdc15833-fb4c-49dc-b836-fe6d46ae1c8d','1502260c78e86c9006b5cc7dee11f3d945559b831b1895a7b418d5b96f8078c7','2026-09-09 19:36:13.403','20260821094512_add_cv_review_tracking',NULL,NULL,'2026-09-09 19:36:13.232',1),('c0856d8a-cf9f-4882-a1e7-7c3226ca76c3','63c701a9a0b91ebeb265e0be33b007b0800c9c7d87ab8ccc1a07ab1438687b44','2026-09-09 19:36:12.867','20260821033717_add_feedback_audit_log',NULL,NULL,'2026-09-09 19:36:12.736',1),('c7374db5-44a4-42bd-9af7-141da506f60f','26f80d96bfc8fa5fa8f2472fceab90780bf58483b81dd58f73d9d5d5f9ab9942','2026-09-09 19:36:16.013','20260830080623_interview_slot_split',NULL,NULL,'2026-09-09 19:36:15.439',1),('ce31d90f-6a30-491b-b9d9-079cf3aebf02','0de758226bad4a63608e23a61c145473421d3ca5bb1957f849b383353e326bbd','2026-09-09 19:36:12.735','20260814154416_add_candidate_phone_number',NULL,NULL,'2026-09-09 19:36:12.621',1),('de2c0fe0-d328-4feb-a3b8-ec04fa0a22fd','12cd5eff5bd97358658f87daf5985747eda6e4f1af3fc266c87bcbbcb4026191','2026-09-09 19:36:14.516','20260827094114_add_audit_log',NULL,NULL,'2026-09-09 19:36:14.372',1),('de5d0794-1952-4e10-873e-89cc6b918ae7','d7e36b39806455caa2021bf70e5e65d8c3da6c2963224c5746738521d75c7374','2026-09-09 19:36:13.229','20260821092018_add_application_current_stage',NULL,NULL,'2026-09-09 19:36:12.938',1),('e3bf64f7-8d22-40e8-a9cb-2efaa5de46d2','8178f825308312b4df6ec4dbfc0f651bc6bafaddba4073c5cd5d154f8b76c2f8','2026-09-09 19:36:15.209','20260827153637_configurable_interview_rounds',NULL,NULL,'2026-09-09 19:36:14.518',1),('f0e6ee03-759f-4aa4-8f72-dbe315c659c9','4b39169edb670d79566fbc3b8df4b2b17ed8d36a356e1acc76cf2015bf1240c8','2026-09-09 19:36:16.506','20260831190046_add_notifications_and_reminders',NULL,NULL,'2026-09-09 19:36:16.173',1),('f1ba2a8e-a6e6-4413-a0cb-236eb38e6424','3828ce78ddf4828fc36b03b0d004dcb66a330dffa9e79220f1e664189906909d','2026-09-09 19:36:16.596','20260909105326_add_must_change_password',NULL,NULL,'2026-09-09 19:36:16.508',1),('fabd04a8-6b7a-4b84-baba-ec28c1e051d8','ca9acc533f580694c325da7f5b207448e1a6e3839a283eee941cfd2c1b8c38a3','2026-09-09 19:36:12.936','20260821035541_add_password_reset',NULL,NULL,'2026-09-09 19:36:12.869',1);
/*!40000 ALTER TABLE `_prisma_migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `applicationstagehistory`
--

DROP TABLE IF EXISTS `applicationstagehistory`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `applicationstagehistory` (
  `id` int NOT NULL AUTO_INCREMENT,
  `applicationId` int NOT NULL,
  `stage` enum('APPLIED','SHORTLISTED','HIRED','REJECTED') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `enteredAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `exitedAt` datetime(3) DEFAULT NULL,
  `changedByUserId` int DEFAULT NULL,
  `vacancyStageId` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `ApplicationStageHistory_applicationId_fkey` (`applicationId`),
  KEY `ApplicationStageHistory_changedByUserId_fkey` (`changedByUserId`),
  KEY `ApplicationStageHistory_vacancyStageId_fkey` (`vacancyStageId`),
  CONSTRAINT `ApplicationStageHistory_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `candidateapplication` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ApplicationStageHistory_changedByUserId_fkey` FOREIGN KEY (`changedByUserId`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `ApplicationStageHistory_vacancyStageId_fkey` FOREIGN KEY (`vacancyStageId`) REFERENCES `vacancystage` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `applicationstagehistory`
--

LOCK TABLES `applicationstagehistory` WRITE;
/*!40000 ALTER TABLE `applicationstagehistory` DISABLE KEYS */;
/*!40000 ALTER TABLE `applicationstagehistory` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auditlog`
--

DROP TABLE IF EXISTS `auditlog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auditlog` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `action` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entityType` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entityId` int DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `AuditLog_entityType_entityId_idx` (`entityType`,`entityId`),
  KEY `AuditLog_createdAt_idx` (`createdAt`),
  KEY `AuditLog_userId_fkey` (`userId`),
  CONSTRAINT `AuditLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=114 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auditlog`
--

LOCK TABLES `auditlog` WRITE;
/*!40000 ALTER TABLE `auditlog` DISABLE KEYS */;
INSERT INTO `auditlog` VALUES (1,1,'NOTIFICATION_SENT','Interview',1,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Tomas Reyes for the Backend Engineer role (Technical Interview stage).\\n\\nScheduled for: 13 Sept 2026, 10:30\\n\\nCandidate CV: Tomas_Reyes.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Tomas Reyes for Backend Engineer\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:36:38.593'),(2,1,'NOTIFICATION_SENT','Interview',1,'{\"body\": \"Hi Tomas Reyes,\\n\\nYour Technical Interview interview for the Backend Engineer role has been scheduled.\\n\\nDate/time: 13 Sept 2026, 10:30\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Backend Engineer at Altrium\", \"recipient\": \"tomas.reyes@example.com\"}','2026-09-09 19:36:43.134'),(3,1,'NOTIFICATION_SENT','Interview',2,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Aiko Nakamura for the Backend Engineer role (Technical Interview stage).\\n\\nScheduled for: 8 Sept 2026, 14:00\\n\\nCandidate CV: Aiko_Nakamura.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Aiko Nakamura for Backend Engineer\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:36:47.406'),(4,1,'NOTIFICATION_SENT','Interview',2,'{\"body\": \"Hi Aiko Nakamura,\\n\\nYour Technical Interview interview for the Backend Engineer role has been scheduled.\\n\\nDate/time: 8 Sept 2026, 14:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Backend Engineer at Altrium\", \"recipient\": \"aiko.nakamura@example.com\"}','2026-09-09 19:36:51.182'),(5,1,'NOTIFICATION_SENT','Interview',3,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Rasheed Coker for the Backend Engineer role (Technical Interview stage).\\n\\nScheduled for: 7 Sept 2026, 09:30\\n\\nCandidate CV: Rasheed_Coker.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Rasheed Coker for Backend Engineer\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:36:54.483'),(6,1,'NOTIFICATION_SENT','Interview',3,'{\"body\": \"Hi Rasheed Coker,\\n\\nYour Technical Interview interview for the Backend Engineer role has been scheduled.\\n\\nDate/time: 7 Sept 2026, 09:30\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Backend Engineer at Altrium\", \"recipient\": \"rasheed.coker@example.com\"}','2026-09-09 19:36:58.830'),(7,1,'NOTIFICATION_SENT','Interview',4,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Elias Vogt for the Backend Engineer role (Technical Interview stage).\\n\\nScheduled for: 5 Sept 2026, 11:00\\n\\nCandidate CV: Elias_Vogt.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Elias Vogt for Backend Engineer\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:37:03.291'),(8,1,'NOTIFICATION_SENT','Interview',4,'{\"body\": \"Hi Elias Vogt,\\n\\nYour Technical Interview interview for the Backend Engineer role has been scheduled.\\n\\nDate/time: 5 Sept 2026, 11:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Backend Engineer at Altrium\", \"recipient\": \"dulzxitzy@gmail.com\"}','2026-09-09 19:37:07.010'),(9,1,'NOTIFICATION_SENT','Interview',5,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Elias Vogt for the Backend Engineer role (Panel Interview stage).\\n\\nScheduled for: 9 Sept 2026, 13:30\\n\\nCandidate CV: Elias_Vogt.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Elias Vogt for Backend Engineer\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:37:10.130'),(10,1,'NOTIFICATION_SENT','Interview',5,'{\"body\": \"Hi Elias Vogt,\\n\\nYour Panel Interview interview for the Backend Engineer role has been scheduled.\\n\\nDate/time: 9 Sept 2026, 13:30\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Backend Engineer at Altrium\", \"recipient\": \"dulzxitzy@gmail.com\"}','2026-09-09 19:37:13.328'),(11,1,'NOTIFICATION_SENT','Interview',7,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Baptiste Laurent for the Content Marketing Specialist role (Portfolio Review stage).\\n\\nScheduled for: 1 Sept 2026, 10:00\\n\\nCandidate CV: Baptiste_Laurent.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Baptiste Laurent for Content Marketing Specialist\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:37:17.773'),(12,1,'NOTIFICATION_SENT','Interview',7,'{\"body\": \"Hi Baptiste Laurent,\\n\\nYour Portfolio Review interview for the Content Marketing Specialist role has been scheduled.\\n\\nDate/time: 1 Sept 2026, 10:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Content Marketing Specialist at Altrium\", \"recipient\": \"baptiste.laurent@example.com\"}','2026-09-09 19:37:21.787'),(13,4,'NOTIFICATION_SENT','CandidateApplication',6,'{\"body\": \"Hi Baptiste Laurent,\\n\\nWe\'re pleased to let you know you\'ve been selected for the Content Marketing Specialist role at Altrium. Our HR team will be in touch shortly with next steps and offer details.\\n\\nCongratulations!\", \"reason\": \"hiring_decision_hire\", \"channel\": \"email\", \"subject\": \"Congratulations - offer for Content Marketing Specialist at Altrium\", \"recipient\": \"baptiste.laurent@example.com\"}','2026-09-09 19:37:26.077'),(14,4,'HM_DECISION_COMMENT','CandidateApplication',6,'{\"comments\": \"Strong final round, easy hire.\", \"decision\": \"HIRE\"}','2026-09-09 19:37:26.084'),(15,1,'NOTIFICATION_SENT','Interview',9,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Priya Chandrasekaran for the Content Marketing Specialist role (Portfolio Review stage).\\n\\nScheduled for: 7 Sept 2026, 11:00\\n\\nCandidate CV: Priya_Chandrasekaran.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Priya Chandrasekaran for Content Marketing Specialist\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:37:30.148'),(16,1,'NOTIFICATION_SENT','Interview',9,'{\"body\": \"Hi Priya Chandrasekaran,\\n\\nYour Portfolio Review interview for the Content Marketing Specialist role has been scheduled.\\n\\nDate/time: 7 Sept 2026, 11:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Content Marketing Specialist at Altrium\", \"recipient\": \"priya.chandrasekaran@example.com\"}','2026-09-09 19:37:33.382'),(17,1,'NOTIFICATION_SENT','Interview',10,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Felix Adeyinka for the Account Executive role (Role Play Interview stage).\\n\\nScheduled for: 5 Sept 2026, 10:00\\n\\nCandidate CV: Felix_Adeyinka.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Felix Adeyinka for Account Executive\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:37:37.641'),(18,1,'NOTIFICATION_SENT','Interview',10,'{\"body\": \"Hi Felix Adeyinka,\\n\\nYour Role Play Interview interview for the Account Executive role has been scheduled.\\n\\nDate/time: 5 Sept 2026, 10:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Account Executive at Altrium\", \"recipient\": \"felix.adeyinka@example.com\"}','2026-09-09 19:37:40.966'),(19,1,'NOTIFICATION_SENT','Interview',11,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Dimitri Popescu for the Account Executive role (Role Play Interview stage).\\n\\nScheduled for: 6 Sept 2026, 11:00\\n\\nCandidate CV: Dimitri_Popescu.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Dimitri Popescu for Account Executive\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:37:45.049'),(20,1,'NOTIFICATION_SENT','Interview',11,'{\"body\": \"Hi Dimitri Popescu,\\n\\nYour Role Play Interview interview for the Account Executive role has been scheduled.\\n\\nDate/time: 6 Sept 2026, 11:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Account Executive at Altrium\", \"recipient\": \"dimitri.popescu@example.com\"}','2026-09-09 19:37:49.626'),(21,4,'NOTIFICATION_SENT','CandidateApplication',10,'{\"body\": \"Hi Dimitri Popescu,\\n\\nThank you for taking the time to interview for the Account Executive role at Altrium. After careful consideration, we\'ve decided to move forward with another candidate.\\n\\nWe appreciate your interest in Altrium and encourage you to apply for future openings that match your experience.\", \"reason\": \"hiring_decision_reject\", \"channel\": \"email\", \"subject\": \"Update on your application for Account Executive at Altrium\", \"recipient\": \"dimitri.popescu@example.com\"}','2026-09-09 19:37:53.205'),(22,4,'HM_DECISION_COMMENT','CandidateApplication',10,'{\"comments\": \"Not ready for the role yet.\", \"decision\": \"REJECT\"}','2026-09-09 19:37:53.221'),(23,1,'NOTIFICATION_SENT','Interview',12,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Naledi Khumalo for the Account Executive role (Role Play Interview stage).\\n\\nScheduled for: 9 Sept 2026, 09:00\\n\\nCandidate CV: Naledi_Khumalo.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Naledi Khumalo for Account Executive\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:37:57.231'),(24,1,'NOTIFICATION_SENT','Interview',12,'{\"body\": \"Hi Naledi Khumalo,\\n\\nYour Role Play Interview interview for the Account Executive role has been scheduled.\\n\\nDate/time: 9 Sept 2026, 09:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Account Executive at Altrium\", \"recipient\": \"naledi.khumalo@example.com\"}','2026-09-09 19:38:01.428'),(25,1,'NOTIFICATION_SENT','Interview',13,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Ravi Chowdhury for the Customer Success Manager role (Screening Call stage).\\n\\nScheduled for: 8 Sept 2026, 10:30\\n\\nCandidate CV: Ravi_Chowdhury.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Ravi Chowdhury for Customer Success Manager\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:38:04.935'),(26,1,'NOTIFICATION_SENT','Interview',13,'{\"body\": \"Hi Ravi Chowdhury,\\n\\nYour Screening Call interview for the Customer Success Manager role has been scheduled.\\n\\nDate/time: 8 Sept 2026, 10:30\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Customer Success Manager at Altrium\", \"recipient\": \"ravi.chowdhury@example.com\"}','2026-09-09 19:38:08.261'),(27,1,'NOTIFICATION_SENT','Interview',14,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Camille Dupont for the HR Business Partner role (Screening Call stage).\\n\\nScheduled for: 8 Sept 2026, 13:00\\n\\nCandidate CV: Camille_Dupont.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Camille Dupont for HR Business Partner\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:38:12.092'),(28,1,'NOTIFICATION_SENT','Interview',14,'{\"body\": \"Hi Jordan Blake,\\n\\nYou\'ve been assigned to interview Camille Dupont for the HR Business Partner role (Screening Call stage).\\n\\nScheduled for: 8 Sept 2026, 13:00\\n\\nCandidate CV: Camille_Dupont.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Camille Dupont for HR Business Partner\", \"recipient\": \"dulzxitzy@gmail.com\"}','2026-09-09 19:38:16.161'),(29,1,'NOTIFICATION_SENT','Interview',14,'{\"body\": \"Hi Camille Dupont,\\n\\nYour Screening Call interview for the HR Business Partner role has been scheduled.\\n\\nDate/time: 8 Sept 2026, 13:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for HR Business Partner at Altrium\", \"recipient\": \"camille.dupont@example.com\"}','2026-09-09 19:38:20.271'),(30,1,'NOTIFICATION_SENT','Interview',15,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Ingrid Solberg for the Senior Financial Analyst role (Case Study Interview stage).\\n\\nScheduled for: 7 Sept 2026, 10:00\\n\\nCandidate CV: Ingrid_Solberg.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Ingrid Solberg for Senior Financial Analyst\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:38:23.669'),(31,1,'NOTIFICATION_SENT','Interview',15,'{\"body\": \"Hi Ingrid Solberg,\\n\\nYour Case Study Interview interview for the Senior Financial Analyst role has been scheduled.\\n\\nDate/time: 7 Sept 2026, 10:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Senior Financial Analyst at Altrium\", \"recipient\": \"ingrid.solberg@example.com\"}','2026-09-09 19:38:26.855'),(32,1,'NOTIFICATION_SENT','Interview',16,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Julian Ostrowski for the Senior Financial Analyst role (Case Study Interview stage).\\n\\nScheduled for: 7 Sept 2026, 14:30\\n\\nCandidate CV: Julian_Ostrowski.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Julian Ostrowski for Senior Financial Analyst\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:38:29.950'),(33,1,'NOTIFICATION_SENT','Interview',16,'{\"body\": \"Hi Julian Ostrowski,\\n\\nYour Case Study Interview interview for the Senior Financial Analyst role has been scheduled.\\n\\nDate/time: 7 Sept 2026, 14:30\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Senior Financial Analyst at Altrium\", \"recipient\": \"julian.ostrowski@example.com\"}','2026-09-09 19:38:33.844'),(34,1,'NOTIFICATION_SENT','Interview',17,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Priyanka Deshmukh for the Operations Manager role (Initial Interview stage).\\n\\nScheduled for: 12 Sept 2026, 11:30\\n\\nCandidate CV: Priyanka_Deshmukh.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Priyanka Deshmukh for Operations Manager\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:38:37.295'),(35,1,'NOTIFICATION_SENT','Interview',17,'{\"body\": \"Hi Priyanka Deshmukh,\\n\\nYour Initial Interview interview for the Operations Manager role has been scheduled.\\n\\nDate/time: 12 Sept 2026, 11:30\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Operations Manager at Altrium\", \"recipient\": \"priyanka.deshmukh@example.com\"}','2026-09-09 19:38:41.242'),(36,1,'NOTIFICATION_SENT','Interview',18,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Wei Zhang for the Operations Manager role (Initial Interview stage).\\n\\nScheduled for: 6 Sept 2026, 09:00\\n\\nCandidate CV: Wei_Zhang.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Wei Zhang for Operations Manager\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:38:45.320'),(37,1,'NOTIFICATION_SENT','Interview',18,'{\"body\": \"Hi Wei Zhang,\\n\\nYour Initial Interview interview for the Operations Manager role has been scheduled.\\n\\nDate/time: 6 Sept 2026, 09:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Operations Manager at Altrium\", \"recipient\": \"wei.zhang@example.com\"}','2026-09-09 19:38:48.692'),(38,1,'NOTIFICATION_SENT','Interview',19,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Marguerite Aubin for the Corporate Counsel role (Initial Interview stage).\\n\\nScheduled for: 6 Sept 2026, 10:00\\n\\nCandidate CV: Marguerite_Aubin.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Marguerite Aubin for Corporate Counsel\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:38:52.887'),(39,1,'NOTIFICATION_SENT','Interview',19,'{\"body\": \"Hi Marguerite Aubin,\\n\\nYour Initial Interview interview for the Corporate Counsel role has been scheduled.\\n\\nDate/time: 6 Sept 2026, 10:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Corporate Counsel at Altrium\", \"recipient\": \"marguerite.aubin@example.com\"}','2026-09-09 19:38:55.970'),(40,1,'NOTIFICATION_SENT','Interview',20,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Hassan Malik for the Backend Engineer role (Technical Interview stage).\\n\\nScheduled for: 6 Sept 2026, 10:00\\n\\nCandidate CV: Hassan_Malik.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Hassan Malik for Backend Engineer\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:38:59.531'),(41,1,'NOTIFICATION_SENT','Interview',20,'{\"body\": \"Hi Hassan Malik,\\n\\nYour Technical Interview interview for the Backend Engineer role has been scheduled.\\n\\nDate/time: 6 Sept 2026, 10:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Backend Engineer at Altrium\", \"recipient\": \"hassan.malik@example.com\"}','2026-09-09 19:39:03.367'),(42,1,'NOTIFICATION_SENT','Interview',21,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Lena Fischer for the Backend Engineer role (Technical Interview stage).\\n\\nScheduled for: 7 Sept 2026, 10:00\\n\\nCandidate CV: Lena_Fischer.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Lena Fischer for Backend Engineer\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:39:06.663'),(43,1,'NOTIFICATION_SENT','Interview',21,'{\"body\": \"Hi Lena Fischer,\\n\\nYour Technical Interview interview for the Backend Engineer role has been scheduled.\\n\\nDate/time: 7 Sept 2026, 10:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Backend Engineer at Altrium\", \"recipient\": \"lena.fischer@example.com\"}','2026-09-09 19:39:10.685'),(44,1,'NOTIFICATION_SENT','Interview',22,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Grace Farnham for the Senior Financial Analyst role (Case Study Interview stage).\\n\\nScheduled for: 5 Sept 2026, 10:00\\n\\nCandidate CV: Grace_Farnham.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Grace Farnham for Senior Financial Analyst\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:39:14.796'),(45,1,'NOTIFICATION_SENT','Interview',22,'{\"body\": \"Hi Grace Farnham,\\n\\nYour Case Study Interview interview for the Senior Financial Analyst role has been scheduled.\\n\\nDate/time: 5 Sept 2026, 10:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Senior Financial Analyst at Altrium\", \"recipient\": \"grace.farnham@example.com\"}','2026-09-09 19:39:18.418'),(46,1,'NOTIFICATION_SENT','Interview',23,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Samuel Okoro for the Senior Financial Analyst role (Case Study Interview stage).\\n\\nScheduled for: 4 Sept 2026, 10:00\\n\\nCandidate CV: Samuel_Okoro.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Samuel Okoro for Senior Financial Analyst\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:39:22.335'),(47,1,'NOTIFICATION_SENT','Interview',23,'{\"body\": \"Hi Samuel Okoro,\\n\\nYour Case Study Interview interview for the Senior Financial Analyst role has been scheduled.\\n\\nDate/time: 4 Sept 2026, 10:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Senior Financial Analyst at Altrium\", \"recipient\": \"samuel.okoro@example.com\"}','2026-09-09 19:39:26.429'),(48,1,'NOTIFICATION_SENT','Interview',24,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Anya Petrenko for the Senior Financial Analyst role (Case Study Interview stage).\\n\\nScheduled for: 8 Sept 2026, 10:00\\n\\nCandidate CV: Anya_Petrenko.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Anya Petrenko for Senior Financial Analyst\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:39:29.973'),(49,1,'NOTIFICATION_SENT','Interview',24,'{\"body\": \"Hi Anya Petrenko,\\n\\nYour Case Study Interview interview for the Senior Financial Analyst role has been scheduled.\\n\\nDate/time: 8 Sept 2026, 10:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Senior Financial Analyst at Altrium\", \"recipient\": \"anya.petrenko@example.com\"}','2026-09-09 19:39:33.809'),(50,1,'NOTIFICATION_SENT','Interview',25,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Leo Bennett for the Content Marketing Specialist role (Portfolio Review stage).\\n\\nScheduled for: 4 Sept 2026, 10:00\\n\\nCandidate CV: Leo_Bennett.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Leo Bennett for Content Marketing Specialist\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:39:37.573'),(51,1,'NOTIFICATION_SENT','Interview',25,'{\"body\": \"Hi Leo Bennett,\\n\\nYour Portfolio Review interview for the Content Marketing Specialist role has been scheduled.\\n\\nDate/time: 4 Sept 2026, 10:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Content Marketing Specialist at Altrium\", \"recipient\": \"leo.bennett@example.com\"}','2026-09-09 19:39:41.801'),(52,1,'NOTIFICATION_SENT','Interview',26,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Zara Ahmed for the Content Marketing Specialist role (Portfolio Review stage).\\n\\nScheduled for: 6 Sept 2026, 10:00\\n\\nCandidate CV: Zara_Ahmed.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Zara Ahmed for Content Marketing Specialist\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:39:45.868'),(53,1,'NOTIFICATION_SENT','Interview',26,'{\"body\": \"Hi Zara Ahmed,\\n\\nYour Portfolio Review interview for the Content Marketing Specialist role has been scheduled.\\n\\nDate/time: 6 Sept 2026, 10:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Content Marketing Specialist at Altrium\", \"recipient\": \"zara.ahmed@example.com\"}','2026-09-09 19:39:49.505'),(54,1,'NOTIFICATION_SENT','Interview',27,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Tobias Lindgren for the Content Marketing Specialist role (Portfolio Review stage).\\n\\nScheduled for: 3 Sept 2026, 10:00\\n\\nCandidate CV: Tobias_Lindgren.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Tobias Lindgren for Content Marketing Specialist\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:39:53.620'),(55,1,'NOTIFICATION_SENT','Interview',27,'{\"body\": \"Hi Tobias Lindgren,\\n\\nYour Portfolio Review interview for the Content Marketing Specialist role has been scheduled.\\n\\nDate/time: 3 Sept 2026, 10:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Content Marketing Specialist at Altrium\", \"recipient\": \"tobias.lindgren@example.com\"}','2026-09-09 19:39:56.641'),(56,1,'NOTIFICATION_SENT','Interview',28,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Chidi Obi for the Content Marketing Specialist role (Portfolio Review stage).\\n\\nScheduled for: 7 Sept 2026, 10:00\\n\\nCandidate CV: Chidi_Obi.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Chidi Obi for Content Marketing Specialist\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:40:00.731'),(57,1,'NOTIFICATION_SENT','Interview',28,'{\"body\": \"Hi Chidi Obi,\\n\\nYour Portfolio Review interview for the Content Marketing Specialist role has been scheduled.\\n\\nDate/time: 7 Sept 2026, 10:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Content Marketing Specialist at Altrium\", \"recipient\": \"chidi.obi@example.com\"}','2026-09-09 19:40:04.065'),(58,1,'NOTIFICATION_SENT','Interview',29,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Morgan Wells for the Account Executive role (Role Play Interview stage).\\n\\nScheduled for: 5 Sept 2026, 10:00\\n\\nCandidate CV: Morgan_Wells.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Morgan Wells for Account Executive\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:40:07.557'),(59,1,'NOTIFICATION_SENT','Interview',29,'{\"body\": \"Hi Morgan Wells,\\n\\nYour Role Play Interview interview for the Account Executive role has been scheduled.\\n\\nDate/time: 5 Sept 2026, 10:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Account Executive at Altrium\", \"recipient\": \"morgan.wells@example.com\"}','2026-09-09 19:40:11.237'),(60,1,'NOTIFICATION_SENT','Interview',30,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Selin Aydin for the Account Executive role (Role Play Interview stage).\\n\\nScheduled for: 7 Sept 2026, 10:00\\n\\nCandidate CV: Selin_Aydin.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Selin Aydin for Account Executive\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:40:15.408'),(61,1,'NOTIFICATION_SENT','Interview',30,'{\"body\": \"Hi Selin Aydin,\\n\\nYour Role Play Interview interview for the Account Executive role has been scheduled.\\n\\nDate/time: 7 Sept 2026, 10:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Account Executive at Altrium\", \"recipient\": \"selin.aydin@example.com\"}','2026-09-09 19:40:19.536'),(62,1,'NOTIFICATION_SENT','Interview',31,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Declan Murphy for the Account Executive role (Role Play Interview stage).\\n\\nScheduled for: 4 Sept 2026, 10:00\\n\\nCandidate CV: Declan_Murphy.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Declan Murphy for Account Executive\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:40:22.734'),(63,1,'NOTIFICATION_SENT','Interview',31,'{\"body\": \"Hi Declan Murphy,\\n\\nYour Role Play Interview interview for the Account Executive role has been scheduled.\\n\\nDate/time: 4 Sept 2026, 10:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Account Executive at Altrium\", \"recipient\": \"declan.murphy@example.com\"}','2026-09-09 19:40:27.126'),(64,1,'NOTIFICATION_SENT','Interview',32,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Ines Duarte for the Account Executive role (Role Play Interview stage).\\n\\nScheduled for: 6 Sept 2026, 10:00\\n\\nCandidate CV: Ines_Duarte.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Ines Duarte for Account Executive\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:40:31.027'),(65,1,'NOTIFICATION_SENT','Interview',32,'{\"body\": \"Hi Ines Duarte,\\n\\nYour Role Play Interview interview for the Account Executive role has been scheduled.\\n\\nDate/time: 6 Sept 2026, 10:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Account Executive at Altrium\", \"recipient\": \"ines.duarte@example.com\"}','2026-09-09 19:40:34.279'),(66,1,'NOTIFICATION_SENT','Interview',33,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Yuki Tanaka for the Customer Success Manager role (Screening Call stage).\\n\\nScheduled for: 5 Sept 2026, 10:00\\n\\nCandidate CV: Yuki_Tanaka.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Yuki Tanaka for Customer Success Manager\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:40:38.262'),(67,1,'NOTIFICATION_SENT','Interview',33,'{\"body\": \"Hi Yuki Tanaka,\\n\\nYour Screening Call interview for the Customer Success Manager role has been scheduled.\\n\\nDate/time: 5 Sept 2026, 10:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Customer Success Manager at Altrium\", \"recipient\": \"yuki.tanaka@example.com\"}','2026-09-09 19:40:42.478'),(68,1,'NOTIFICATION_SENT','Interview',34,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Femi Adewale for the Customer Success Manager role (Screening Call stage).\\n\\nScheduled for: 7 Sept 2026, 10:00\\n\\nCandidate CV: Femi_Adewale.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Femi Adewale for Customer Success Manager\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:40:46.170'),(69,1,'NOTIFICATION_SENT','Interview',34,'{\"body\": \"Hi Femi Adewale,\\n\\nYour Screening Call interview for the Customer Success Manager role has been scheduled.\\n\\nDate/time: 7 Sept 2026, 10:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Customer Success Manager at Altrium\", \"recipient\": \"femi.adewale@example.com\"}','2026-09-09 19:40:49.546'),(70,1,'NOTIFICATION_SENT','Interview',35,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Nora Kaminski for the Customer Success Manager role (Screening Call stage).\\n\\nScheduled for: 4 Sept 2026, 10:00\\n\\nCandidate CV: Nora_Kaminski.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Nora Kaminski for Customer Success Manager\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:40:52.671'),(71,1,'NOTIFICATION_SENT','Interview',35,'{\"body\": \"Hi Nora Kaminski,\\n\\nYour Screening Call interview for the Customer Success Manager role has been scheduled.\\n\\nDate/time: 4 Sept 2026, 10:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Customer Success Manager at Altrium\", \"recipient\": \"nora.kaminski@example.com\"}','2026-09-09 19:40:55.894'),(72,1,'NOTIFICATION_SENT','Interview',36,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Ali Hassan for the Customer Success Manager role (Screening Call stage).\\n\\nScheduled for: 6 Sept 2026, 10:00\\n\\nCandidate CV: Ali_Hassan.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Ali Hassan for Customer Success Manager\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:41:00.159'),(73,1,'NOTIFICATION_SENT','Interview',36,'{\"body\": \"Hi Ali Hassan,\\n\\nYour Screening Call interview for the Customer Success Manager role has been scheduled.\\n\\nDate/time: 6 Sept 2026, 10:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Customer Success Manager at Altrium\", \"recipient\": \"ali.hassan@example.com\"}','2026-09-09 19:41:04.222'),(74,1,'NOTIFICATION_SENT','Interview',37,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Beatrice Lund for the HR Business Partner role (Screening Call stage).\\n\\nScheduled for: 6 Sept 2026, 10:00\\n\\nCandidate CV: Beatrice_Lund.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Beatrice Lund for HR Business Partner\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:41:07.554'),(75,1,'NOTIFICATION_SENT','Interview',37,'{\"body\": \"Hi Beatrice Lund,\\n\\nYour Screening Call interview for the HR Business Partner role has been scheduled.\\n\\nDate/time: 6 Sept 2026, 10:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for HR Business Partner at Altrium\", \"recipient\": \"beatrice.lund@example.com\"}','2026-09-09 19:41:11.247'),(76,1,'NOTIFICATION_SENT','Interview',38,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Marcel Dubois for the HR Business Partner role (Screening Call stage).\\n\\nScheduled for: 4 Sept 2026, 10:00\\n\\nCandidate CV: Marcel_Dubois.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Marcel Dubois for HR Business Partner\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:41:15.639'),(77,1,'NOTIFICATION_SENT','Interview',38,'{\"body\": \"Hi Marcel Dubois,\\n\\nYour Screening Call interview for the HR Business Partner role has been scheduled.\\n\\nDate/time: 4 Sept 2026, 10:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for HR Business Partner at Altrium\", \"recipient\": \"marcel.dubois@example.com\"}','2026-09-09 19:41:19.038'),(78,1,'NOTIFICATION_SENT','Interview',39,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Sofia Novak for the HR Business Partner role (Screening Call stage).\\n\\nScheduled for: 8 Sept 2026, 10:00\\n\\nCandidate CV: Sofia_Novak.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Sofia Novak for HR Business Partner\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:41:22.689'),(79,1,'NOTIFICATION_SENT','Interview',39,'{\"body\": \"Hi Sofia Novak,\\n\\nYour Screening Call interview for the HR Business Partner role has been scheduled.\\n\\nDate/time: 8 Sept 2026, 10:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for HR Business Partner at Altrium\", \"recipient\": \"sofia.novak@example.com\"}','2026-09-09 19:41:26.944'),(80,1,'NOTIFICATION_SENT','Interview',40,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Ewan Fraser for the HR Business Partner role (Screening Call stage).\\n\\nScheduled for: 5 Sept 2026, 10:00\\n\\nCandidate CV: Ewan_Fraser.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Ewan Fraser for HR Business Partner\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:41:30.980'),(81,1,'NOTIFICATION_SENT','Interview',40,'{\"body\": \"Hi Ewan Fraser,\\n\\nYour Screening Call interview for the HR Business Partner role has been scheduled.\\n\\nDate/time: 5 Sept 2026, 10:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for HR Business Partner at Altrium\", \"recipient\": \"ewan.fraser@example.com\"}','2026-09-09 19:41:35.117'),(82,1,'NOTIFICATION_SENT','Interview',41,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Ada Okonkwo for the Operations Manager role (Initial Interview stage).\\n\\nScheduled for: 5 Sept 2026, 10:00\\n\\nCandidate CV: Ada_Okonkwo.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Ada Okonkwo for Operations Manager\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:41:38.466'),(83,1,'NOTIFICATION_SENT','Interview',41,'{\"body\": \"Hi Ada Okonkwo,\\n\\nYour Initial Interview interview for the Operations Manager role has been scheduled.\\n\\nDate/time: 5 Sept 2026, 10:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Operations Manager at Altrium\", \"recipient\": \"ada.okonkwo@example.com\"}','2026-09-09 19:41:42.289'),(84,1,'NOTIFICATION_SENT','Interview',42,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Piotr Kowalski for the Operations Manager role (Initial Interview stage).\\n\\nScheduled for: 7 Sept 2026, 10:00\\n\\nCandidate CV: Piotr_Kowalski.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Piotr Kowalski for Operations Manager\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:41:46.247'),(85,1,'NOTIFICATION_SENT','Interview',42,'{\"body\": \"Hi Piotr Kowalski,\\n\\nYour Initial Interview interview for the Operations Manager role has been scheduled.\\n\\nDate/time: 7 Sept 2026, 10:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Operations Manager at Altrium\", \"recipient\": \"piotr.kowalski@example.com\"}','2026-09-09 19:41:50.595'),(86,1,'NOTIFICATION_SENT','Interview',43,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Layla Hussain for the Operations Manager role (Initial Interview stage).\\n\\nScheduled for: 8 Sept 2026, 10:00\\n\\nCandidate CV: Layla_Hussain.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Layla Hussain for Operations Manager\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:41:53.866'),(87,1,'NOTIFICATION_SENT','Interview',43,'{\"body\": \"Hi Layla Hussain,\\n\\nYour Initial Interview interview for the Operations Manager role has been scheduled.\\n\\nDate/time: 8 Sept 2026, 10:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Operations Manager at Altrium\", \"recipient\": \"layla.hussain@example.com\"}','2026-09-09 19:41:57.602'),(88,1,'NOTIFICATION_SENT','Interview',44,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Magnus Berg for the Operations Manager role (Initial Interview stage).\\n\\nScheduled for: 3 Sept 2026, 10:00\\n\\nCandidate CV: Magnus_Berg.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Magnus Berg for Operations Manager\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:42:01.702'),(89,1,'NOTIFICATION_SENT','Interview',44,'{\"body\": \"Hi Magnus Berg,\\n\\nYour Initial Interview interview for the Operations Manager role has been scheduled.\\n\\nDate/time: 3 Sept 2026, 10:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Operations Manager at Altrium\", \"recipient\": \"magnus.berg@example.com\"}','2026-09-09 19:42:05.544'),(90,1,'NOTIFICATION_SENT','Interview',45,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Clara Jensen for the Corporate Counsel role (Initial Interview stage).\\n\\nScheduled for: 6 Sept 2026, 10:00\\n\\nCandidate CV: Clara_Jensen.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Clara Jensen for Corporate Counsel\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:42:09.391'),(91,1,'NOTIFICATION_SENT','Interview',45,'{\"body\": \"Hi Clara Jensen,\\n\\nYour Initial Interview interview for the Corporate Counsel role has been scheduled.\\n\\nDate/time: 6 Sept 2026, 10:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Corporate Counsel at Altrium\", \"recipient\": \"clara.jensen@example.com\"}','2026-09-09 19:42:12.362'),(92,1,'NOTIFICATION_SENT','Interview',46,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Youssef El-Amin for the Corporate Counsel role (Initial Interview stage).\\n\\nScheduled for: 8 Sept 2026, 10:00\\n\\nCandidate CV: Youssef_El_Amin.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Youssef El-Amin for Corporate Counsel\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:42:16.845'),(93,1,'NOTIFICATION_SENT','Interview',46,'{\"body\": \"Hi Youssef El-Amin,\\n\\nYour Initial Interview interview for the Corporate Counsel role has been scheduled.\\n\\nDate/time: 8 Sept 2026, 10:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Corporate Counsel at Altrium\", \"recipient\": \"youssef.el-amin@example.com\"}','2026-09-09 19:42:20.961'),(94,1,'NOTIFICATION_SENT','Interview',47,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Astrid Solheim for the Corporate Counsel role (Initial Interview stage).\\n\\nScheduled for: 5 Sept 2026, 10:00\\n\\nCandidate CV: Astrid_Solheim.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Astrid Solheim for Corporate Counsel\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:42:26.126'),(95,1,'NOTIFICATION_SENT','Interview',47,'{\"body\": \"Hi Astrid Solheim,\\n\\nYour Initial Interview interview for the Corporate Counsel role has been scheduled.\\n\\nDate/time: 5 Sept 2026, 10:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Corporate Counsel at Altrium\", \"recipient\": \"astrid.solheim@example.com\"}','2026-09-09 19:42:33.260'),(96,1,'NOTIFICATION_SENT','Interview',48,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Kwame Mensah for the Corporate Counsel role (Initial Interview stage).\\n\\nScheduled for: 3 Sept 2026, 10:00\\n\\nCandidate CV: Kwame_Mensah.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Kwame Mensah for Corporate Counsel\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:42:37.750'),(97,1,'NOTIFICATION_SENT','Interview',48,'{\"body\": \"Hi Kwame Mensah,\\n\\nYour Initial Interview interview for the Corporate Counsel role has been scheduled.\\n\\nDate/time: 3 Sept 2026, 10:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Corporate Counsel at Altrium\", \"recipient\": \"kwame.mensah@example.com\"}','2026-09-09 19:42:41.797'),(98,1,'NOTIFICATION_SENT','Interview',49,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Jonas Kessler for the QA Engineer role (Technical Interview stage).\\n\\nScheduled for: 7 Sept 2026, 10:00\\n\\nCandidate CV: Jonas_Kessler.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Jonas Kessler for QA Engineer\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:42:46.045'),(99,1,'NOTIFICATION_SENT','Interview',49,'{\"body\": \"Hi Jonas Kessler,\\n\\nYour Technical Interview interview for the QA Engineer role has been scheduled.\\n\\nDate/time: 7 Sept 2026, 10:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for QA Engineer at Altrium\", \"recipient\": \"jonas.kessler@example.com\"}','2026-09-09 19:42:49.726'),(100,1,'NOTIFICATION_SENT','Interview',50,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Imogen Vance for the Social Media Manager role (Portfolio Review stage).\\n\\nScheduled for: 8 Sept 2026, 10:00\\n\\nCandidate CV: Imogen_Vance.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Imogen Vance for Social Media Manager\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:42:54.852'),(101,1,'NOTIFICATION_SENT','Interview',50,'{\"body\": \"Hi Imogen Vance,\\n\\nYour Portfolio Review interview for the Social Media Manager role has been scheduled.\\n\\nDate/time: 8 Sept 2026, 10:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Social Media Manager at Altrium\", \"recipient\": \"imogen.vance@example.com\"}','2026-09-09 19:42:58.657'),(102,1,'NOTIFICATION_SENT','Interview',51,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Tariq Osei for the Sales Development Representative role (Role Play Interview stage).\\n\\nScheduled for: 6 Sept 2026, 10:00\\n\\nCandidate CV: Tariq_Osei.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Tariq Osei for Sales Development Representative\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:43:02.499'),(103,1,'NOTIFICATION_SENT','Interview',51,'{\"body\": \"Hi Tariq Osei,\\n\\nYour Role Play Interview interview for the Sales Development Representative role has been scheduled.\\n\\nDate/time: 6 Sept 2026, 10:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Sales Development Representative at Altrium\", \"recipient\": \"tariq.osei@example.com\"}','2026-09-09 19:43:06.365'),(104,1,'NOTIFICATION_SENT','Interview',52,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Sana Iqbal for the Support Specialist role (Screening Call stage).\\n\\nScheduled for: 8 Sept 2026, 10:00\\n\\nCandidate CV: Sana_Iqbal.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Sana Iqbal for Support Specialist\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:43:10.708'),(105,1,'NOTIFICATION_SENT','Interview',52,'{\"body\": \"Hi Sana Iqbal,\\n\\nYour Screening Call interview for the Support Specialist role has been scheduled.\\n\\nDate/time: 8 Sept 2026, 10:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Support Specialist at Altrium\", \"recipient\": \"sana.iqbal@example.com\"}','2026-09-09 19:43:14.607'),(106,1,'NOTIFICATION_SENT','Interview',53,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Rosalind Pike for the Talent Acquisition Coordinator role (Screening Call stage).\\n\\nScheduled for: 7 Sept 2026, 10:00\\n\\nCandidate CV: Rosalind_Pike.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Rosalind Pike for Talent Acquisition Coordinator\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:43:18.973'),(107,1,'NOTIFICATION_SENT','Interview',53,'{\"body\": \"Hi Rosalind Pike,\\n\\nYour Screening Call interview for the Talent Acquisition Coordinator role has been scheduled.\\n\\nDate/time: 7 Sept 2026, 10:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Talent Acquisition Coordinator at Altrium\", \"recipient\": \"rosalind.pike@example.com\"}','2026-09-09 19:43:24.246'),(108,1,'NOTIFICATION_SENT','Interview',54,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Elliot Nakashima for the Accounts Payable Specialist role (Case Study Interview stage).\\n\\nScheduled for: 8 Sept 2026, 10:00\\n\\nCandidate CV: Elliot_Nakashima.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Elliot Nakashima for Accounts Payable Specialist\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:43:29.590'),(109,1,'NOTIFICATION_SENT','Interview',54,'{\"body\": \"Hi Elliot Nakashima,\\n\\nYour Case Study Interview interview for the Accounts Payable Specialist role has been scheduled.\\n\\nDate/time: 8 Sept 2026, 10:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Accounts Payable Specialist at Altrium\", \"recipient\": \"elliot.nakashima@example.com\"}','2026-09-09 19:43:34.733'),(110,1,'NOTIFICATION_SENT','Interview',55,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Reuben Frost for the Logistics Coordinator role (Initial Interview stage).\\n\\nScheduled for: 6 Sept 2026, 10:00\\n\\nCandidate CV: Reuben_Frost.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Reuben Frost for Logistics Coordinator\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:43:38.457'),(111,1,'NOTIFICATION_SENT','Interview',55,'{\"body\": \"Hi Reuben Frost,\\n\\nYour Initial Interview interview for the Logistics Coordinator role has been scheduled.\\n\\nDate/time: 6 Sept 2026, 10:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Logistics Coordinator at Altrium\", \"recipient\": \"reuben.frost@example.com\"}','2026-09-09 19:43:41.974'),(112,1,'NOTIFICATION_SENT','Interview',56,'{\"body\": \"Hi Marcus Feldman,\\n\\nYou\'ve been assigned to interview Anouk Delacroix for the Compliance Officer role (Initial Interview stage).\\n\\nScheduled for: 7 Sept 2026, 10:00\\n\\nCandidate CV: Anouk_Delacroix.pdf\", \"reason\": \"interview_scheduled_panelist\", \"channel\": \"email\", \"subject\": \"Interview scheduled: Anouk Delacroix for Compliance Officer\", \"recipient\": \"marcus@altrium.com\"}','2026-09-09 19:43:46.701'),(113,1,'NOTIFICATION_SENT','Interview',56,'{\"body\": \"Hi Anouk Delacroix,\\n\\nYour Initial Interview interview for the Compliance Officer role has been scheduled.\\n\\nDate/time: 7 Sept 2026, 10:00\\n\\nWe\'ll be in touch with further details. If you have any questions, reply to this email.\", \"reason\": \"interview_scheduled_candidate\", \"channel\": \"email\", \"subject\": \"Your interview for Compliance Officer at Altrium\", \"recipient\": \"anouk.delacroix@example.com\"}','2026-09-09 19:43:51.005');
/*!40000 ALTER TABLE `auditlog` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `candidate`
--

DROP TABLE IF EXISTS `candidate`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `candidate` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cvUrl` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `phoneNumber` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lastCvReviewedAt` datetime(3) DEFAULT NULL,
  `lastCvReviewedByUserId` int DEFAULT NULL,
  `lastCvReviewNote` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  UNIQUE KEY `Candidate_email_key` (`email`),
  KEY `Candidate_lastCvReviewedByUserId_fkey` (`lastCvReviewedByUserId`),
  CONSTRAINT `Candidate_lastCvReviewedByUserId_fkey` FOREIGN KEY (`lastCvReviewedByUserId`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=68 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `candidate`
--

LOCK TABLES `candidate` WRITE;
/*!40000 ALTER TABLE `candidate` DISABLE KEYS */;
INSERT INTO `candidate` VALUES (1,'Isabelle Marchetti','isabelle.marchetti@example.com','Isabelle_Marchetti.pdf','2026-09-09 19:36:34.753','+44 7700 900112',NULL,NULL,NULL),(2,'Tomas Reyes','tomas.reyes@example.com','Tomas_Reyes.pdf','2026-09-09 19:36:34.784','+44 7700 900113','2026-09-09 19:36:34.781',1,'Strong distributed-systems background, moved to shortlist for the Technical Interview round.'),(3,'Aiko Nakamura','aiko.nakamura@example.com','Aiko_Nakamura.pdf','2026-09-09 19:36:43.210','+44 7700 900114','2026-09-09 19:36:43.207',1,'Solid infrastructure experience, moved to shortlist.'),(4,'Rasheed Coker','rasheed.coker@example.com','Rasheed_Coker.pdf','2026-09-09 19:36:51.265','+44 7700 900120','2026-09-09 19:36:51.260',1,'Strong e-commerce scale experience, moved to shortlist.'),(5,'Elias Vogt','dulzxitzy@gmail.com','Elias_Vogt.pdf','2026-09-09 19:36:58.869','+44 7700 900121','2026-09-09 19:59:15.725',1,'Excellent technical round, advanced straight to Final Interview.'),(6,'Baptiste Laurent','baptiste.laurent@example.com','Baptiste_Laurent.pdf','2026-09-09 19:37:13.570','+44 7700 900115','2026-09-09 19:37:13.566',1,'Excellent portfolio, clear pipeline impact. Fast-tracked through both rounds.'),(7,'Priya Chandrasekaran','priya.chandrasekaran@example.com','Priya_Chandrasekaran.pdf','2026-09-09 19:37:26.109','+44 7700 900130','2026-09-09 19:37:26.108',1,'Strong portfolio, moved to Portfolio Review round.'),(8,'Freya Lindqvist','freya.lindqvist@example.com','Freya_Lindqvist.pdf','2026-09-09 19:37:33.422','+44 7700 900116','2026-09-09 19:37:33.415',1,'Limited long-form content experience relative to what this role needs. Not progressing at this time.'),(9,'Felix Adeyinka','felix.adeyinka@example.com','Felix_Adeyinka.pdf','2026-09-09 19:37:33.575','+44 7700 900131','2026-09-09 19:37:33.574',1,'Consistently strong quota history, moved to Role Play round.'),(10,'Dimitri Popescu','dimitri.popescu@example.com','Dimitri_Popescu.pdf','2026-09-09 19:37:40.994','+44 7700 900117','2026-09-09 19:37:40.992',1,'Solid quota history, moved to Role Play round.'),(11,'Naledi Khumalo','naledi.khumalo@example.com','Naledi_Khumalo.pdf','2026-09-09 19:37:53.295','+44 7700 900118','2026-09-09 19:37:53.293',1,'Well-rounded background spanning sales and support -- worth considering for either open role.'),(12,'Ravi Chowdhury','ravi.chowdhury@example.com','Ravi_Chowdhury.pdf','2026-09-09 19:38:01.535','+44 7700 900133','2026-09-09 19:38:01.533',1,'Strong renewal track record, moved to Screening Call.'),(13,'Oscar Lindberg','oscar.lindberg@example.com','Oscar_Lindberg.pdf','2026-09-09 19:38:08.363','+44 7700 900119',NULL,NULL,NULL),(14,'Camille Dupont','camille.dupont@example.com','Camille_Dupont.pdf','2026-09-09 19:38:08.558','+44 7700 900122','2026-09-09 19:38:08.556',1,'Strong generalist background, moved to Screening Call.'),(15,'Noah Whitaker','noah.whitaker@example.com','Noah_Whitaker.pdf','2026-09-09 19:38:20.326','+44 7700 900123',NULL,NULL,NULL),(16,'Ingrid Solberg','ingrid.solberg@example.com','Ingrid_Solberg.pdf','2026-09-09 19:38:20.486','+44 7700 900124','2026-09-09 19:38:20.485',1,'Strong FP&A track record, moved to Case Study round.'),(17,'Julian Ostrowski','julian.ostrowski@example.com','Julian_Ostrowski.pdf','2026-09-09 19:38:26.880','+44 7700 900125','2026-09-09 19:38:26.878',1,'Solid budgeting background, moved to Case Study round.'),(18,'Priyanka Deshmukh','priyanka.deshmukh@example.com','Priyanka_Deshmukh.pdf','2026-09-09 19:38:33.944','+44 7700 900126','2026-09-09 19:38:33.942',1,'Strong multi-site operations background, moved to Initial Interview.'),(19,'Wei Zhang','wei.zhang@example.com','Wei_Zhang.pdf','2026-09-09 19:38:41.274','+44 7700 900132','2026-09-09 19:38:41.273',1,'Solid multi-site track record, moved to Initial Interview.'),(20,'Connor Ashby','connor.ashby@example.com','Connor_Ashby.pdf','2026-09-09 19:38:48.737','+44 7700 900127',NULL,NULL,NULL),(21,'Marguerite Aubin','marguerite.aubin@example.com','Marguerite_Aubin.pdf','2026-09-09 19:38:48.840','+44 7700 900128','2026-09-09 19:38:48.839',1,'Strong commercial contracts background, moved to Initial Interview.'),(22,'Theo Bergmann','theo.bergmann@example.com','Theo_Bergmann.pdf','2026-09-09 19:38:56.019','+44 7700 900129',NULL,NULL,NULL),(23,'Hassan Malik','hassan.malik@example.com','Hassan_Malik.pdf','2026-09-09 19:38:56.077','+44 7700 900134','2026-09-09 19:38:56.074',1,'Solid background, moved to interview.'),(24,'Lena Fischer','lena.fischer@example.com','Lena_Fischer.pdf','2026-09-09 19:39:03.408','+44 7700 900135','2026-09-09 19:39:03.403',1,'Solid background, moved to interview.'),(25,'Grace Farnham','grace.farnham@example.com','Grace_Farnham.pdf','2026-09-09 19:39:10.727','+44 7700 900136','2026-09-09 19:39:10.719',1,'Solid background, moved to interview.'),(26,'Samuel Okoro','samuel.okoro@example.com','Samuel_Okoro.pdf','2026-09-09 19:39:18.499','+44 7700 900137','2026-09-09 19:39:18.495',1,'Solid background, moved to interview.'),(27,'Anya Petrenko','anya.petrenko@example.com','Anya_Petrenko.pdf','2026-09-09 19:39:26.458','+44 7700 900138','2026-09-09 19:39:26.457',1,'Solid background, moved to interview.'),(28,'Leo Bennett','leo.bennett@example.com','Leo_Bennett.pdf','2026-09-09 19:39:33.845','+44 7700 900139','2026-09-09 19:39:33.841',1,'Solid background, moved to interview.'),(29,'Zara Ahmed','zara.ahmed@example.com','Zara_Ahmed.pdf','2026-09-09 19:39:41.847','+44 7700 900140','2026-09-09 19:39:41.844',1,'Solid background, moved to interview.'),(30,'Tobias Lindgren','tobias.lindgren@example.com','Tobias_Lindgren.pdf','2026-09-09 19:39:49.541','+44 7700 900141','2026-09-09 19:39:49.538',1,'Solid background, moved to interview.'),(31,'Chidi Obi','chidi.obi@example.com','Chidi_Obi.pdf','2026-09-09 19:39:56.690','+44 7700 900142','2026-09-09 19:39:56.688',1,'Solid background, moved to interview.'),(32,'Morgan Wells','morgan.wells@example.com','Morgan_Wells.pdf','2026-09-09 19:40:04.115','+44 7700 900143','2026-09-09 19:40:04.112',1,'Solid background, moved to interview.'),(33,'Selin Aydin','selin.aydin@example.com','Selin_Aydin.pdf','2026-09-09 19:40:11.262','+44 7700 900144','2026-09-09 19:40:11.260',1,'Solid background, moved to interview.'),(34,'Declan Murphy','declan.murphy@example.com','Declan_Murphy.pdf','2026-09-09 19:40:19.575','+44 7700 900145','2026-09-09 19:40:19.573',1,'Solid background, moved to interview.'),(35,'Ines Duarte','ines.duarte@example.com','Ines_Duarte.pdf','2026-09-09 19:40:27.173','+44 7700 900146','2026-09-09 19:40:27.171',1,'Solid background, moved to interview.'),(36,'Yuki Tanaka','yuki.tanaka@example.com','Yuki_Tanaka.pdf','2026-09-09 19:40:34.319','+44 7700 900147','2026-09-09 19:40:34.315',1,'Solid background, moved to interview.'),(37,'Femi Adewale','femi.adewale@example.com','Femi_Adewale.pdf','2026-09-09 19:40:42.511','+44 7700 900148','2026-09-09 19:40:42.508',1,'Solid background, moved to interview.'),(38,'Nora Kaminski','nora.kaminski@example.com','Nora_Kaminski.pdf','2026-09-09 19:40:49.579','+44 7700 900149','2026-09-09 19:40:49.576',1,'Solid background, moved to interview.'),(39,'Ali Hassan','ali.hassan@example.com','Ali_Hassan.pdf','2026-09-09 19:40:55.927','+44 7700 900150','2026-09-09 19:40:55.925',1,'Solid background, moved to interview.'),(40,'Beatrice Lund','beatrice.lund@example.com','Beatrice_Lund.pdf','2026-09-09 19:41:04.263','+44 7700 900151','2026-09-09 19:41:04.256',1,'Solid background, moved to interview.'),(41,'Marcel Dubois','marcel.dubois@example.com','Marcel_Dubois.pdf','2026-09-09 19:41:11.286','+44 7700 900152','2026-09-09 19:41:11.284',1,'Solid background, moved to interview.'),(42,'Sofia Novak','sofia.novak@example.com','Sofia_Novak.pdf','2026-09-09 19:41:19.070','+44 7700 900153','2026-09-09 19:41:19.066',1,'Solid background, moved to interview.'),(43,'Ewan Fraser','ewan.fraser@example.com','Ewan_Fraser.pdf','2026-09-09 19:41:26.987','+44 7700 900154','2026-09-09 19:41:26.985',1,'Solid background, moved to interview.'),(44,'Ada Okonkwo','ada.okonkwo@example.com','Ada_Okonkwo.pdf','2026-09-09 19:41:35.149','+44 7700 900155','2026-09-09 19:41:35.147',1,'Solid background, moved to interview.'),(45,'Piotr Kowalski','piotr.kowalski@example.com','Piotr_Kowalski.pdf','2026-09-09 19:41:42.339','+44 7700 900156','2026-09-09 19:41:42.336',1,'Solid background, moved to interview.'),(46,'Layla Hussain','layla.hussain@example.com','Layla_Hussain.pdf','2026-09-09 19:41:50.625','+44 7700 900157','2026-09-09 19:41:50.623',1,'Solid background, moved to interview.'),(47,'Magnus Berg','magnus.berg@example.com','Magnus_Berg.pdf','2026-09-09 19:41:57.633','+44 7700 900158','2026-09-09 19:41:57.631',1,'Solid background, moved to interview.'),(48,'Clara Jensen','clara.jensen@example.com','Clara_Jensen.pdf','2026-09-09 19:42:05.586','+44 7700 900159','2026-09-09 19:42:05.582',1,'Solid background, moved to interview.'),(49,'Youssef El-Amin','youssef.el-amin@example.com','Youssef_El_Amin.pdf','2026-09-09 19:42:12.478','+44 7700 900160','2026-09-09 19:42:12.477',1,'Solid background, moved to interview.'),(50,'Astrid Solheim','astrid.solheim@example.com','Astrid_Solheim.pdf','2026-09-09 19:42:21.044','+44 7700 900161','2026-09-09 19:42:21.038',1,'Solid background, moved to interview.'),(51,'Kwame Mensah','kwame.mensah@example.com','Kwame_Mensah.pdf','2026-09-09 19:42:33.327','+44 7700 900162','2026-09-09 19:42:33.321',1,'Solid background, moved to interview.'),(52,'Jonas Kessler','jonas.kessler@example.com','Jonas_Kessler.pdf','2026-09-09 19:42:41.891','+44 7700 900163','2026-09-09 19:42:41.887',1,'Solid background, moved to interview.'),(53,'Bethany Coleman','bethany.coleman@example.com','Bethany_Coleman.pdf','2026-09-09 19:42:49.796','+44 7700 900164',NULL,NULL,NULL),(54,'Imogen Vance','imogen.vance@example.com','Imogen_Vance.pdf','2026-09-09 19:42:49.936','+44 7700 900165','2026-09-09 19:42:49.934',1,'Solid background, moved to interview.'),(55,'Rian Doyle','rian.doyle@example.com','Rian_Doyle.pdf','2026-09-09 19:42:58.767','+44 7700 900166',NULL,NULL,NULL),(56,'Tariq Osei','tariq.osei@example.com','Tariq_Osei.pdf','2026-09-09 19:42:58.904','+44 7700 900167','2026-09-09 19:42:58.903',1,'Solid background, moved to interview.'),(57,'Willa Sandberg','willa.sandberg@example.com','Willa_Sandberg.pdf','2026-09-09 19:43:06.419','+44 7700 900168',NULL,NULL,NULL),(58,'Sana Iqbal','sana.iqbal@example.com','Sana_Iqbal.pdf','2026-09-09 19:43:06.568','+44 7700 900169','2026-09-09 19:43:06.567',1,'Solid background, moved to interview.'),(59,'Dexter Holt','dexter.holt@example.com','Dexter_Holt.pdf','2026-09-09 19:43:14.690','+44 7700 900170',NULL,NULL,NULL),(60,'Rosalind Pike','rosalind.pike@example.com','Rosalind_Pike.pdf','2026-09-09 19:43:14.844','+44 7700 900171','2026-09-09 19:43:14.843',1,'Solid background, moved to interview.'),(61,'Gideon Marsh','gideon.marsh@example.com','Gideon_Marsh.pdf','2026-09-09 19:43:24.275','+44 7700 900172',NULL,NULL,NULL),(62,'Elliot Nakashima','elliot.nakashima@example.com','Elliot_Nakashima.pdf','2026-09-09 19:43:24.367','+44 7700 900173','2026-09-09 19:43:24.362',1,'Solid background, moved to interview.'),(63,'Paloma Serrano','paloma.serrano@example.com','Paloma_Serrano.pdf','2026-09-09 19:43:34.771','+44 7700 900174',NULL,NULL,NULL),(64,'Reuben Frost','reuben.frost@example.com','Reuben_Frost.pdf','2026-09-09 19:43:34.914','+44 7700 900175','2026-09-09 19:43:34.912',1,'Solid background, moved to interview.'),(65,'Vera Lindholm','vera.lindholm@example.com','Vera_Lindholm.pdf','2026-09-09 19:43:42.024','+44 7700 900176',NULL,NULL,NULL),(66,'Anouk Delacroix','anouk.delacroix@example.com','Anouk_Delacroix.pdf','2026-09-09 19:43:42.144','+44 7700 900177','2026-09-09 19:43:42.141',1,'Solid background, moved to interview.'),(67,'Silas Radcliffe','silas.radcliffe@example.com','Silas_Radcliffe.pdf','2026-09-09 19:43:51.147','+44 7700 900178',NULL,NULL,NULL);
/*!40000 ALTER TABLE `candidate` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `candidateapplication`
--

DROP TABLE IF EXISTS `candidateapplication`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `candidateapplication` (
  `id` int NOT NULL AUTO_INCREMENT,
  `candidateId` int NOT NULL,
  `vacancyId` int NOT NULL,
  `appliedAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `decidedAt` datetime(3) DEFAULT NULL,
  `decidedByUserId` int DEFAULT NULL,
  `hiringDecision` enum('HIRE','REJECT') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hiringManagerId` int DEFAULT NULL,
  `stage` enum('APPLIED','SHORTLISTED','HIRED','REJECTED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'APPLIED',
  `currentVacancyStageId` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `CandidateApplication_candidateId_vacancyId_key` (`candidateId`,`vacancyId`),
  KEY `CandidateApplication_vacancyId_fkey` (`vacancyId`),
  KEY `CandidateApplication_decidedByUserId_fkey` (`decidedByUserId`),
  KEY `CandidateApplication_hiringManagerId_fkey` (`hiringManagerId`),
  KEY `CandidateApplication_currentVacancyStageId_fkey` (`currentVacancyStageId`),
  CONSTRAINT `CandidateApplication_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `candidate` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `CandidateApplication_currentVacancyStageId_fkey` FOREIGN KEY (`currentVacancyStageId`) REFERENCES `vacancystage` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `CandidateApplication_decidedByUserId_fkey` FOREIGN KEY (`decidedByUserId`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `CandidateApplication_hiringManagerId_fkey` FOREIGN KEY (`hiringManagerId`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `CandidateApplication_vacancyId_fkey` FOREIGN KEY (`vacancyId`) REFERENCES `vacancy` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=69 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `candidateapplication`
--

LOCK TABLES `candidateapplication` WRITE;
/*!40000 ALTER TABLE `candidateapplication` DISABLE KEYS */;
INSERT INTO `candidateapplication` VALUES (1,1,1,'2026-09-08 19:36:34.761',NULL,NULL,NULL,4,'APPLIED',NULL),(2,2,1,'2026-09-05 19:36:34.797',NULL,NULL,NULL,4,'SHORTLISTED',1),(3,3,1,'2026-09-03 19:36:43.224',NULL,NULL,NULL,4,'SHORTLISTED',1),(4,4,1,'2026-09-02 19:36:51.290',NULL,NULL,NULL,4,'SHORTLISTED',1),(5,5,1,'2026-08-28 19:36:58.883',NULL,NULL,NULL,4,'SHORTLISTED',3),(6,6,2,'2026-08-20 19:37:13.584','2026-09-08 19:37:21.861',4,'HIRE',4,'HIRED',5),(7,7,2,'2026-09-03 19:37:26.123',NULL,NULL,NULL,4,'SHORTLISTED',4),(8,8,2,'2026-08-25 19:37:33.446',NULL,NULL,NULL,4,'REJECTED',NULL),(9,9,3,'2026-09-02 19:37:33.584',NULL,NULL,NULL,4,'SHORTLISTED',6),(10,10,3,'2026-08-30 19:37:41.010','2026-09-07 19:37:41.006',4,'REJECT',4,'REJECTED',6),(11,11,3,'2026-09-06 19:37:53.306',NULL,NULL,NULL,4,'SHORTLISTED',6),(12,11,4,'2026-09-07 19:38:01.498',NULL,NULL,NULL,4,'SHORTLISTED',8),(13,12,4,'2026-09-04 19:38:01.545',NULL,NULL,NULL,4,'SHORTLISTED',8),(14,13,4,'2026-09-08 19:38:08.383',NULL,NULL,NULL,4,'APPLIED',NULL),(15,14,5,'2026-09-04 19:38:08.568',NULL,NULL,NULL,4,'SHORTLISTED',10),(16,15,5,'2026-09-08 19:38:20.360',NULL,NULL,NULL,4,'APPLIED',NULL),(17,16,6,'2026-09-03 19:38:20.493',NULL,NULL,NULL,4,'SHORTLISTED',12),(18,17,6,'2026-09-03 19:38:26.894',NULL,NULL,NULL,4,'SHORTLISTED',12),(19,18,7,'2026-09-05 19:38:33.957',NULL,NULL,NULL,4,'SHORTLISTED',14),(20,19,7,'2026-09-03 19:38:41.296',NULL,NULL,NULL,4,'SHORTLISTED',14),(21,20,7,'2026-09-08 19:38:48.751',NULL,NULL,NULL,4,'APPLIED',NULL),(22,21,8,'2026-09-04 19:38:48.848',NULL,NULL,NULL,4,'SHORTLISTED',16),(23,22,8,'2026-09-08 19:38:56.031',NULL,NULL,NULL,4,'APPLIED',NULL),(24,23,1,'2026-08-31 19:38:56.089',NULL,NULL,NULL,4,'SHORTLISTED',1),(25,24,1,'2026-09-01 19:39:03.425',NULL,NULL,NULL,4,'SHORTLISTED',1),(26,25,6,'2026-08-30 19:39:10.737',NULL,NULL,NULL,4,'SHORTLISTED',12),(27,26,6,'2026-08-29 19:39:18.517',NULL,NULL,NULL,4,'SHORTLISTED',12),(28,27,6,'2026-09-02 19:39:26.474',NULL,NULL,NULL,4,'SHORTLISTED',12),(29,28,2,'2026-08-28 19:39:33.856',NULL,NULL,NULL,4,'SHORTLISTED',4),(30,29,2,'2026-08-31 19:39:41.867',NULL,NULL,NULL,4,'SHORTLISTED',4),(31,30,2,'2026-08-26 19:39:49.554',NULL,NULL,NULL,4,'SHORTLISTED',4),(32,31,2,'2026-09-01 19:39:56.700',NULL,NULL,NULL,4,'SHORTLISTED',4),(33,32,3,'2026-08-30 19:40:04.131',NULL,NULL,NULL,4,'SHORTLISTED',6),(34,33,3,'2026-09-02 19:40:11.280',NULL,NULL,NULL,4,'SHORTLISTED',6),(35,34,3,'2026-08-28 19:40:19.587',NULL,NULL,NULL,4,'SHORTLISTED',6),(36,35,3,'2026-08-31 19:40:27.188',NULL,NULL,NULL,4,'SHORTLISTED',6),(37,36,4,'2026-08-29 19:40:34.347',NULL,NULL,NULL,4,'SHORTLISTED',8),(38,37,4,'2026-09-01 19:40:42.523',NULL,NULL,NULL,4,'SHORTLISTED',8),(39,38,4,'2026-08-27 19:40:49.598',NULL,NULL,NULL,4,'SHORTLISTED',8),(40,39,4,'2026-08-30 19:40:55.946',NULL,NULL,NULL,4,'SHORTLISTED',8),(41,40,5,'2026-08-31 19:41:04.279',NULL,NULL,NULL,4,'SHORTLISTED',10),(42,41,5,'2026-08-28 19:41:11.304',NULL,NULL,NULL,4,'SHORTLISTED',10),(43,42,5,'2026-09-02 19:41:19.089',NULL,NULL,NULL,4,'SHORTLISTED',10),(44,43,5,'2026-08-30 19:41:26.999',NULL,NULL,NULL,4,'SHORTLISTED',10),(45,44,7,'2026-08-29 19:41:35.164',NULL,NULL,NULL,4,'SHORTLISTED',14),(46,45,7,'2026-09-01 19:41:42.352',NULL,NULL,NULL,4,'SHORTLISTED',14),(47,46,7,'2026-09-03 19:41:50.643',NULL,NULL,NULL,4,'SHORTLISTED',14),(48,47,7,'2026-08-27 19:41:57.665',NULL,NULL,NULL,4,'SHORTLISTED',14),(49,48,8,'2026-08-31 19:42:05.600',NULL,NULL,NULL,4,'SHORTLISTED',16),(50,49,8,'2026-09-03 19:42:12.497',NULL,NULL,NULL,4,'SHORTLISTED',16),(51,50,8,'2026-08-29 19:42:21.072',NULL,NULL,NULL,4,'SHORTLISTED',16),(52,51,8,'2026-08-26 19:42:33.383',NULL,NULL,NULL,4,'SHORTLISTED',16),(53,52,9,'2026-09-01 19:42:41.913',NULL,NULL,NULL,4,'SHORTLISTED',18),(54,53,9,'2026-09-07 19:42:49.811',NULL,NULL,NULL,4,'APPLIED',NULL),(55,54,10,'2026-09-02 19:42:49.944',NULL,NULL,NULL,4,'SHORTLISTED',19),(56,55,10,'2026-09-08 19:42:58.777',NULL,NULL,NULL,4,'APPLIED',NULL),(57,56,11,'2026-08-31 19:42:58.927',NULL,NULL,NULL,4,'SHORTLISTED',20),(58,57,11,'2026-09-07 19:43:06.430',NULL,NULL,NULL,4,'APPLIED',NULL),(59,58,12,'2026-09-03 19:43:06.575',NULL,NULL,NULL,4,'SHORTLISTED',21),(60,59,12,'2026-09-08 19:43:14.723',NULL,NULL,NULL,4,'APPLIED',NULL),(61,60,13,'2026-09-01 19:43:14.854',NULL,NULL,NULL,4,'SHORTLISTED',22),(62,61,13,'2026-09-07 19:43:24.291',NULL,NULL,NULL,4,'APPLIED',NULL),(63,62,14,'2026-09-04 19:43:24.377',NULL,NULL,NULL,4,'SHORTLISTED',23),(64,63,14,'2026-09-08 19:43:34.794',NULL,NULL,NULL,4,'APPLIED',NULL),(65,64,15,'2026-08-31 19:43:34.925',NULL,NULL,NULL,4,'SHORTLISTED',24),(66,65,15,'2026-09-07 19:43:42.039',NULL,NULL,NULL,4,'APPLIED',NULL),(67,66,16,'2026-09-02 19:43:42.153',NULL,NULL,NULL,4,'SHORTLISTED',25),(68,67,16,'2026-09-08 19:43:51.166',NULL,NULL,NULL,4,'APPLIED',NULL);
/*!40000 ALTER TABLE `candidateapplication` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `feedback`
--

DROP TABLE IF EXISTS `feedback`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `feedback` (
  `id` int NOT NULL AUTO_INCREMENT,
  `interviewId` int NOT NULL,
  `interviewerId` int NOT NULL,
  `score` int NOT NULL,
  `comments` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `Feedback_interviewId_interviewerId_key` (`interviewId`,`interviewerId`),
  KEY `Feedback_interviewerId_fkey` (`interviewerId`),
  CONSTRAINT `Feedback_interviewerId_fkey` FOREIGN KEY (`interviewerId`) REFERENCES `user` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Feedback_interviewId_fkey` FOREIGN KEY (`interviewId`) REFERENCES `interview` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=54 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `feedback`
--

LOCK TABLES `feedback` WRITE;
/*!40000 ALTER TABLE `feedback` DISABLE KEYS */;
INSERT INTO `feedback` VALUES (1,2,2,8,'Strong technical depth, clear communicator. Would advance to final round.','2026-09-09 19:36:43.270'),(2,3,2,6,'Solid fundamentals, less exposure to distributed systems than we\'d like at this level.','2026-09-09 19:36:51.372'),(3,4,2,9,'Excellent technical round, clear ahead-of-the-curve system design instincts. Fast-track to the Panel round.','2026-09-09 19:36:58.953'),(4,5,2,9,'Held up just as well under a full panel format -- consistent, confident, no red flags. Straight through to Final.','2026-09-09 19:37:07.067'),(5,7,2,9,'Outstanding portfolio, clear evidence of pipeline impact. Fast-track to Final Interview.','2026-09-09 19:37:13.626'),(6,8,2,9,'Consistently sharp in the final round too -- confident, well-prepared, clear content strategy for the role.','2026-09-09 19:37:21.829'),(7,8,7,8,'Strong final-round showing, good culture fit. Recommend hire.','2026-09-09 19:37:21.852'),(8,9,2,6,'Good fundamentals, portfolio leaned heavily on one channel (SEO) with less evidence of the broader mix this role needs.','2026-09-09 19:37:26.183'),(9,10,2,8,'Confident, consultative approach in the role play -- handled objections well without over-discounting.','2026-09-09 19:37:33.622'),(10,11,2,4,'Struggled to handle objections in the role play, relied heavily on discounting.','2026-09-09 19:37:41.063'),(11,13,2,8,'Clear examples of driving both renewal and expansion, strong stakeholder-management instincts.','2026-09-09 19:38:01.576'),(12,14,2,7,'Good stakeholder-management examples, comfortable handling a difficult ER scenario we posed.','2026-09-09 19:38:08.603'),(13,15,2,8,'Excellent case study walkthrough, clear and structured reasoning under time pressure.','2026-09-09 19:38:20.521'),(14,16,2,6,'Solid on budgeting mechanics, less confident when asked to defend assumptions under scrutiny.','2026-09-09 19:38:26.940'),(15,18,2,7,'Clear, structured answers on process improvement. Good candidate for the next round.','2026-09-09 19:38:41.331'),(16,19,2,8,'Excellent grasp of commercial risk trade-offs, gave sharp, practical answers throughout.','2026-09-09 19:38:48.878'),(17,20,2,7,'Solid fundamentals, good grasp of API design trade-offs.','2026-09-09 19:38:56.128'),(18,21,2,8,'Strong systems thinking, asked sharp questions about our architecture.','2026-09-09 19:39:03.490'),(19,22,2,8,'Excellent case study walkthrough, clear on variance drivers.','2026-09-09 19:39:10.811'),(20,23,2,7,'Good technical depth, slightly light on stakeholder-facing examples.','2026-09-09 19:39:18.600'),(21,24,2,9,'Best case study of the round -- crisp, structured, owned the numbers.','2026-09-09 19:39:26.519'),(22,25,2,7,'Solid portfolio, good instinct for audience segmentation.','2026-09-09 19:39:33.889'),(23,26,2,8,'Confident presenter, strong grasp of the funnel metrics that matter.','2026-09-09 19:39:41.907'),(24,27,2,6,'Decent writing samples, less experienced with paid channels than others.','2026-09-09 19:39:49.594'),(25,28,2,7,'Creative range stood out, good sense of what makes content shareable.','2026-09-09 19:39:56.733'),(26,29,2,8,'Confident role play, handled objections smoothly.','2026-09-09 19:40:04.177'),(27,30,2,9,'Best role play of the round -- sharp discovery questions, natural close.','2026-09-09 19:40:11.336'),(28,31,2,7,'Strong track record, role play was good but a little script-heavy.','2026-09-09 19:40:19.631'),(29,32,2,6,'Good energy, needs more polish on the negotiation stage of the role play.','2026-09-09 19:40:27.227'),(30,33,2,8,'Calm, structured screening call -- clearly done this before.','2026-09-09 19:40:34.416'),(31,34,2,9,'Excellent screening call -- specific, metrics-led answers throughout.','2026-09-09 19:40:42.569'),(32,35,2,6,'Reasonable answers, less depth on expansion/upsell than others.','2026-09-09 19:40:49.633'),(33,36,2,7,'Good process instincts, solid but not standout screening call.','2026-09-09 19:40:55.990'),(34,37,2,8,'Strong stakeholder-management examples, clearly done this at scale.','2026-09-09 19:41:04.355'),(35,38,2,6,'Solid generalist background, less BP-specific stakeholder experience.','2026-09-09 19:41:11.366'),(36,39,2,9,'Excellent judgment on a tricky restructuring scenario question.','2026-09-09 19:41:19.142'),(37,40,2,7,'Good breadth, a bit generic on the performance-management questions.','2026-09-09 19:41:27.046'),(38,41,2,8,'Concrete, metrics-led examples throughout -- strong process instincts.','2026-09-09 19:41:35.227'),(39,42,2,7,'Strong people-management track record, solid but not exceptional answers.','2026-09-09 19:41:42.391'),(40,43,2,9,'Best interview of the round -- calm under pressure, clear ownership of outcomes.','2026-09-09 19:41:50.686'),(41,44,2,6,'Good reporting instincts, less hands-on floor-management experience.','2026-09-09 19:41:57.711'),(42,45,2,8,'Sharp on contract risk, gave a great example of pushing back on a bad clause.','2026-09-09 19:42:05.638'),(43,46,2,9,'Excellent -- practical, business-minded legal thinking, not just theory.','2026-09-09 19:42:12.530'),(44,47,2,7,'Good regulatory depth, a little less commercial-contract experience.','2026-09-09 19:42:21.212'),(45,48,2,6,'Reasonable interview, answers ran a bit generic under follow-up questions.','2026-09-09 19:42:33.497'),(46,49,2,7,'Good automation instincts, clear about testing trade-offs.','2026-09-09 19:42:41.951'),(47,50,2,8,'Impressive portfolio, clearly understands platform-native content.','2026-09-09 19:42:49.978'),(48,51,2,7,'Energetic, handled objections reasonably well in the role play.','2026-09-09 19:42:58.971'),(49,52,2,8,'Clear communicator, strong troubleshooting examples.','2026-09-09 19:43:06.613'),(50,53,2,7,'Organised, personable, good sense of candidate experience.','2026-09-09 19:43:14.889'),(51,54,2,9,'Meticulous, excellent walkthrough of a three-way-match discrepancy.','2026-09-09 19:43:24.408'),(52,55,2,7,'Solid coordination experience, practical answers throughout.','2026-09-09 19:43:34.973'),(53,56,2,8,'Thorough, calm under scenario-based questioning.','2026-09-09 19:43:42.185');
/*!40000 ALTER TABLE `feedback` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `feedbackauditlog`
--

DROP TABLE IF EXISTS `feedbackauditlog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `feedbackauditlog` (
  `id` int NOT NULL AUTO_INCREMENT,
  `feedbackId` int NOT NULL,
  `editedByUserId` int NOT NULL,
  `previousScore` int NOT NULL,
  `previousComments` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `newScore` int NOT NULL,
  `newComments` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `editedAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `FeedbackAuditLog_feedbackId_fkey` (`feedbackId`),
  KEY `FeedbackAuditLog_editedByUserId_fkey` (`editedByUserId`),
  CONSTRAINT `FeedbackAuditLog_editedByUserId_fkey` FOREIGN KEY (`editedByUserId`) REFERENCES `user` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `FeedbackAuditLog_feedbackId_fkey` FOREIGN KEY (`feedbackId`) REFERENCES `feedback` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `feedbackauditlog`
--

LOCK TABLES `feedbackauditlog` WRITE;
/*!40000 ALTER TABLE `feedbackauditlog` DISABLE KEYS */;
/*!40000 ALTER TABLE `feedbackauditlog` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `interview`
--

DROP TABLE IF EXISTS `interview`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `interview` (
  `id` int NOT NULL AUTO_INCREMENT,
  `applicationId` int NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `slotId` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `Interview_slotId_applicationId_key` (`slotId`,`applicationId`),
  KEY `Interview_applicationId_fkey` (`applicationId`),
  CONSTRAINT `Interview_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `candidateapplication` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Interview_slotId_fkey` FOREIGN KEY (`slotId`) REFERENCES `interviewslot` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=57 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `interview`
--

LOCK TABLES `interview` WRITE;
/*!40000 ALTER TABLE `interview` DISABLE KEYS */;
INSERT INTO `interview` VALUES (1,2,'2026-09-09 19:36:34.887',1),(2,3,'2026-09-09 19:36:43.251',2),(3,4,'2026-09-09 19:36:51.350',3),(4,5,'2026-09-09 19:36:58.935',4),(5,5,'2026-09-09 19:37:07.046',5),(6,5,'2026-09-09 19:37:13.357',6),(7,6,'2026-09-09 19:37:13.618',7),(8,6,'2026-09-09 19:37:21.819',8),(9,7,'2026-09-09 19:37:26.169',9),(10,9,'2026-09-09 19:37:33.616',10),(11,10,'2026-09-09 19:37:41.052',11),(12,11,'2026-09-09 19:37:53.334',12),(13,13,'2026-09-09 19:38:01.567',13),(14,15,'2026-09-09 19:38:08.593',14),(15,17,'2026-09-09 19:38:20.514',15),(16,18,'2026-09-09 19:38:26.925',16),(17,19,'2026-09-09 19:38:33.977',17),(18,20,'2026-09-09 19:38:41.322',18),(19,22,'2026-09-09 19:38:48.867',19),(20,24,'2026-09-09 19:38:56.114',20),(21,25,'2026-09-09 19:39:03.471',21),(22,26,'2026-09-09 19:39:10.784',22),(23,27,'2026-09-09 19:39:18.576',23),(24,28,'2026-09-09 19:39:26.506',24),(25,29,'2026-09-09 19:39:33.880',25),(26,30,'2026-09-09 19:39:41.897',26),(27,31,'2026-09-09 19:39:49.584',27),(28,32,'2026-09-09 19:39:56.725',28),(29,33,'2026-09-09 19:40:04.167',29),(30,34,'2026-09-09 19:40:11.324',30),(31,35,'2026-09-09 19:40:19.619',31),(32,36,'2026-09-09 19:40:27.213',32),(33,37,'2026-09-09 19:40:34.398',33),(34,38,'2026-09-09 19:40:42.559',34),(35,39,'2026-09-09 19:40:49.621',35),(36,40,'2026-09-09 19:40:55.978',36),(37,41,'2026-09-09 19:41:04.325',37),(38,42,'2026-09-09 19:41:11.353',38),(39,43,'2026-09-09 19:41:19.130',39),(40,44,'2026-09-09 19:41:27.034',40),(41,45,'2026-09-09 19:41:35.212',41),(42,46,'2026-09-09 19:41:42.377',42),(43,47,'2026-09-09 19:41:50.673',43),(44,48,'2026-09-09 19:41:57.702',44),(45,49,'2026-09-09 19:42:05.629',45),(46,50,'2026-09-09 19:42:12.525',46),(47,51,'2026-09-09 19:42:21.202',47),(48,52,'2026-09-09 19:42:33.487',48),(49,53,'2026-09-09 19:42:41.940',49),(50,55,'2026-09-09 19:42:49.970',50),(51,57,'2026-09-09 19:42:58.952',51),(52,59,'2026-09-09 19:43:06.592',52),(53,61,'2026-09-09 19:43:14.879',53),(54,63,'2026-09-09 19:43:24.403',54),(55,65,'2026-09-09 19:43:34.959',55),(56,67,'2026-09-09 19:43:42.172',56);
/*!40000 ALTER TABLE `interview` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `interviewpanel`
--

DROP TABLE IF EXISTS `interviewpanel`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `interviewpanel` (
  `id` int NOT NULL AUTO_INCREMENT,
  `vacancyId` int NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `InterviewPanel_vacancyId_name_key` (`vacancyId`,`name`),
  CONSTRAINT `InterviewPanel_vacancyId_fkey` FOREIGN KEY (`vacancyId`) REFERENCES `vacancy` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `interviewpanel`
--

LOCK TABLES `interviewpanel` WRITE;
/*!40000 ALTER TABLE `interviewpanel` DISABLE KEYS */;
/*!40000 ALTER TABLE `interviewpanel` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `interviewpanelist`
--

DROP TABLE IF EXISTS `interviewpanelist`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `interviewpanelist` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `slotId` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `InterviewPanelist_slotId_userId_key` (`slotId`,`userId`),
  KEY `InterviewPanelist_userId_fkey` (`userId`),
  CONSTRAINT `InterviewPanelist_slotId_fkey` FOREIGN KEY (`slotId`) REFERENCES `interviewslot` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `InterviewPanelist_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=61 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `interviewpanelist`
--

LOCK TABLES `interviewpanelist` WRITE;
/*!40000 ALTER TABLE `interviewpanelist` DISABLE KEYS */;
INSERT INTO `interviewpanelist` VALUES (1,2,1),(2,2,2),(3,2,3),(4,2,4),(5,2,5),(6,2,6),(7,3,6),(8,15,6),(9,2,7),(10,2,8),(11,7,8),(12,2,9),(13,2,10),(14,2,11),(15,2,12),(16,2,13),(17,2,14),(18,15,14),(19,2,15),(20,2,16),(21,2,17),(22,2,18),(23,2,19),(24,2,20),(25,2,21),(26,2,22),(27,2,23),(28,2,24),(29,2,25),(30,2,26),(31,2,27),(32,2,28),(33,2,29),(34,2,30),(35,2,31),(36,2,32),(37,2,33),(38,2,34),(39,2,35),(40,2,36),(41,2,37),(42,2,38),(43,2,39),(44,2,40),(45,2,41),(46,2,42),(47,2,43),(48,2,44),(49,2,45),(50,2,46),(51,2,47),(52,2,48),(53,2,49),(54,2,50),(55,2,51),(56,2,52),(57,2,53),(58,2,54),(59,2,55),(60,2,56);
/*!40000 ALTER TABLE `interviewpanelist` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `interviewpanelmember`
--

DROP TABLE IF EXISTS `interviewpanelmember`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `interviewpanelmember` (
  `id` int NOT NULL AUTO_INCREMENT,
  `panelId` int NOT NULL,
  `userId` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `InterviewPanelMember_panelId_userId_key` (`panelId`,`userId`),
  KEY `InterviewPanelMember_userId_fkey` (`userId`),
  CONSTRAINT `InterviewPanelMember_panelId_fkey` FOREIGN KEY (`panelId`) REFERENCES `interviewpanel` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `InterviewPanelMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `interviewpanelmember`
--

LOCK TABLES `interviewpanelmember` WRITE;
/*!40000 ALTER TABLE `interviewpanelmember` DISABLE KEYS */;
/*!40000 ALTER TABLE `interviewpanelmember` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `interviewslot`
--

DROP TABLE IF EXISTS `interviewslot`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `interviewslot` (
  `id` int NOT NULL AUTO_INCREMENT,
  `vacancyStageId` int NOT NULL,
  `scheduledAt` datetime(3) NOT NULL,
  `roundLabel` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `reminderSentAt` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `InterviewSlot_vacancyStageId_fkey` (`vacancyStageId`),
  CONSTRAINT `InterviewSlot_vacancyStageId_fkey` FOREIGN KEY (`vacancyStageId`) REFERENCES `vacancystage` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=57 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `interviewslot`
--

LOCK TABLES `interviewslot` WRITE;
/*!40000 ALTER TABLE `interviewslot` DISABLE KEYS */;
INSERT INTO `interviewslot` VALUES (1,1,'2026-09-13 05:00:00.000',NULL,'2026-09-09 19:36:34.872',NULL),(2,1,'2026-09-08 08:30:00.000',NULL,'2026-09-09 19:36:43.241',NULL),(3,1,'2026-09-07 04:00:00.000',NULL,'2026-09-09 19:36:51.325',NULL),(4,1,'2026-09-05 05:30:00.000',NULL,'2026-09-09 19:36:58.919',NULL),(5,2,'2026-09-09 08:00:00.000',NULL,'2026-09-09 19:37:07.032',NULL),(6,3,'2026-09-14 09:30:00.000',NULL,'2026-09-09 19:37:13.349',NULL),(7,4,'2026-09-01 04:30:00.000',NULL,'2026-09-09 19:37:13.601',NULL),(8,5,'2026-09-08 10:00:00.000',NULL,'2026-09-09 19:37:21.807',NULL),(9,4,'2026-09-07 05:30:00.000',NULL,'2026-09-09 19:37:26.148',NULL),(10,6,'2026-09-05 04:30:00.000',NULL,'2026-09-09 19:37:33.609',NULL),(11,6,'2026-09-06 05:30:00.000',NULL,'2026-09-09 19:37:41.036',NULL),(12,6,'2026-09-09 03:30:00.000',NULL,'2026-09-09 19:37:53.322',NULL),(13,8,'2026-09-08 05:00:00.000',NULL,'2026-09-09 19:38:01.558',NULL),(14,10,'2026-09-08 07:30:00.000',NULL,'2026-09-09 19:38:08.580',NULL),(15,12,'2026-09-07 04:30:00.000',NULL,'2026-09-09 19:38:20.503',NULL),(16,12,'2026-09-07 09:00:00.000',NULL,'2026-09-09 19:38:26.908',NULL),(17,14,'2026-09-12 06:00:00.000',NULL,'2026-09-09 19:38:33.968',NULL),(18,14,'2026-09-06 03:30:00.000',NULL,'2026-09-09 19:38:41.311',NULL),(19,16,'2026-09-06 04:30:00.000',NULL,'2026-09-09 19:38:48.859',NULL),(20,1,'2026-09-06 04:30:00.000',NULL,'2026-09-09 19:38:56.101',NULL),(21,1,'2026-09-07 04:30:00.000',NULL,'2026-09-09 19:39:03.444',NULL),(22,12,'2026-09-05 04:30:00.000',NULL,'2026-09-09 19:39:10.754',NULL),(23,12,'2026-09-04 04:30:00.000',NULL,'2026-09-09 19:39:18.546',NULL),(24,12,'2026-09-08 04:30:00.000',NULL,'2026-09-09 19:39:26.494',NULL),(25,4,'2026-09-04 04:30:00.000',NULL,'2026-09-09 19:39:33.871',NULL),(26,4,'2026-09-06 04:30:00.000',NULL,'2026-09-09 19:39:41.884',NULL),(27,4,'2026-09-03 04:30:00.000',NULL,'2026-09-09 19:39:49.571',NULL),(28,4,'2026-09-07 04:30:00.000',NULL,'2026-09-09 19:39:56.715',NULL),(29,6,'2026-09-05 04:30:00.000',NULL,'2026-09-09 19:40:04.150',NULL),(30,6,'2026-09-07 04:30:00.000',NULL,'2026-09-09 19:40:11.301',NULL),(31,6,'2026-09-04 04:30:00.000',NULL,'2026-09-09 19:40:19.604',NULL),(32,6,'2026-09-06 04:30:00.000',NULL,'2026-09-09 19:40:27.204',NULL),(33,8,'2026-09-05 04:30:00.000',NULL,'2026-09-09 19:40:34.373',NULL),(34,8,'2026-09-07 04:30:00.000',NULL,'2026-09-09 19:40:42.544',NULL),(35,8,'2026-09-04 04:30:00.000',NULL,'2026-09-09 19:40:49.612',NULL),(36,8,'2026-09-06 04:30:00.000',NULL,'2026-09-09 19:40:55.965',NULL),(37,10,'2026-09-06 04:30:00.000',NULL,'2026-09-09 19:41:04.296',NULL),(38,10,'2026-09-04 04:30:00.000',NULL,'2026-09-09 19:41:11.335',NULL),(39,10,'2026-09-08 04:30:00.000',NULL,'2026-09-09 19:41:19.114',NULL),(40,10,'2026-09-05 04:30:00.000',NULL,'2026-09-09 19:41:27.018',NULL),(41,14,'2026-09-05 04:30:00.000',NULL,'2026-09-09 19:41:35.195',NULL),(42,14,'2026-09-07 04:30:00.000',NULL,'2026-09-09 19:41:42.366',NULL),(43,14,'2026-09-08 04:30:00.000',NULL,'2026-09-09 19:41:50.662',NULL),(44,14,'2026-09-03 04:30:00.000',NULL,'2026-09-09 19:41:57.690',NULL),(45,16,'2026-09-06 04:30:00.000',NULL,'2026-09-09 19:42:05.618',NULL),(46,16,'2026-09-08 04:30:00.000',NULL,'2026-09-09 19:42:12.514',NULL),(47,16,'2026-09-05 04:30:00.000',NULL,'2026-09-09 19:42:21.172',NULL),(48,16,'2026-09-03 04:30:00.000',NULL,'2026-09-09 19:42:33.470',NULL),(49,18,'2026-09-07 04:30:00.000',NULL,'2026-09-09 19:42:41.929',NULL),(50,19,'2026-09-08 04:30:00.000',NULL,'2026-09-09 19:42:49.957',NULL),(51,20,'2026-09-06 04:30:00.000',NULL,'2026-09-09 19:42:58.941',NULL),(52,21,'2026-09-08 04:30:00.000',NULL,'2026-09-09 19:43:06.584',NULL),(53,22,'2026-09-07 04:30:00.000',NULL,'2026-09-09 19:43:14.866',NULL),(54,23,'2026-09-08 04:30:00.000',NULL,'2026-09-09 19:43:24.391',NULL),(55,24,'2026-09-06 04:30:00.000',NULL,'2026-09-09 19:43:34.936',NULL),(56,25,'2026-09-07 04:30:00.000',NULL,'2026-09-09 19:43:42.161',NULL);
/*!40000 ALTER TABLE `interviewslot` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notification`
--

DROP TABLE IF EXISTS `notification`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notification` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `type` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `link` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `read` tinyint(1) NOT NULL DEFAULT '0',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `Notification_userId_read_idx` (`userId`,`read`),
  KEY `Notification_createdAt_idx` (`createdAt`),
  CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notification`
--

LOCK TABLES `notification` WRITE;
/*!40000 ALTER TABLE `notification` DISABLE KEYS */;
INSERT INTO `notification` VALUES (1,1,'candidate_applied','New application: Noah Whitaker applied to HR Business Partner',NULL,0,'2026-09-08 19:43:51.187'),(2,1,'candidate_applied','New application: Theo Bergmann applied to Corporate Counsel',NULL,1,'2026-09-08 19:43:51.204'),(3,2,'interview_scheduled_panelist','You\'re on the panel for Tomas Reyes\'s Technical Interview',NULL,0,'2026-09-07 19:43:51.229'),(4,2,'manual_feedback_reminder','Feedback still needed for Camille Dupont\'s interview',NULL,0,'2026-09-08 19:43:51.246'),(5,3,'interview_scheduled_panelist','You\'re on the panel for Elias Vogt\'s Final Interview',NULL,1,'2026-09-06 19:43:51.259'),(6,4,'candidate_shortlisted','Elias Vogt was shortlisted for Backend Engineer',NULL,1,'2026-09-04 19:43:51.267'),(7,4,'hiring_decision_hire','Baptiste Laurent was hired for Content Marketing Specialist',NULL,0,'2026-09-08 19:43:51.278');
/*!40000 ALTER TABLE `notification` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notificationtemplate`
--

DROP TABLE IF EXISTS `notificationtemplate`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notificationtemplate` (
  `id` int NOT NULL AUTO_INCREMENT,
  `key` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `body` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `updatedAt` datetime(3) NOT NULL,
  `updatedByUserId` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `NotificationTemplate_key_key` (`key`),
  KEY `NotificationTemplate_updatedByUserId_fkey` (`updatedByUserId`),
  CONSTRAINT `NotificationTemplate_updatedByUserId_fkey` FOREIGN KEY (`updatedByUserId`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notificationtemplate`
--

LOCK TABLES `notificationtemplate` WRITE;
/*!40000 ALTER TABLE `notificationtemplate` DISABLE KEYS */;
INSERT INTO `notificationtemplate` VALUES (1,'interview_scheduled_panelist','Interview scheduled: {{candidateName}} for {{vacancyTitle}}','Hi {{panelistName}},\n\nYou\'ve been assigned to interview {{candidateName}} for the {{vacancyTitle}} role ({{stageLabel}} stage).\n\nScheduled for: {{when}}\n\nCandidate CV: {{cvUrl}}','2026-09-09 20:18:38.463',NULL),(2,'interview_scheduled_candidate','Your interview for {{vacancyTitle}} at Altrium','Hi {{candidateName}},\n\nYour {{stageLabel}} interview for the {{vacancyTitle}} role has been scheduled.\n\nDate/time: {{when}}\n\nWe\'ll be in touch with further details. If you have any questions, reply to this email.','2026-09-09 20:18:38.490',NULL),(3,'hiring_decision_hire','Congratulations - offer for {{vacancyTitle}} at Altrium','Hi {{candidateName}},\n\nWe\'re pleased to let you know you\'ve been selected for the {{vacancyTitle}} role at Altrium. Our HR team will be in touch shortly with next steps and offer details.\n\nCongratulations!','2026-09-09 20:18:38.502',NULL),(4,'hiring_decision_reject','Update on your application for {{vacancyTitle}} at Altrium','Hi {{candidateName}},\n\nThank you for taking the time to interview for the {{vacancyTitle}} role at Altrium. After careful consideration, we\'ve decided to move forward with another candidate.\n\nWe appreciate your interest in Altrium and encourage you to apply for future openings that match your experience.','2026-09-09 20:18:38.514',NULL),(5,'auth_password_reset','Reset your Recruitment Tracker password','Hi {{userName}},\n\nUse this link to reset your password (expires in 1 hour):\n{{resetLink}}\n\nIf you didn\'t request this, you can ignore this email.','2026-09-09 20:18:38.526',NULL),(6,'interview_reminder_panelist','Reminder: upcoming interview for {{vacancyTitle}}','Hi {{panelistName}},\n\nThis is a reminder that you\'re interviewing {{candidateName}} for the {{vacancyTitle}} role ({{stageLabel}} stage).\n\nScheduled for: {{when}}\n\nCandidate CV: {{cvUrl}}','2026-09-09 20:18:38.536',NULL),(7,'interview_reminder_candidate','Reminder: your upcoming interview for {{vacancyTitle}} at Altrium','Hi {{candidateName}},\n\nThis is a friendly reminder that your {{stageLabel}} interview for the {{vacancyTitle}} role is coming up.\n\nDate/time: {{when}}\n\nWe look forward to speaking with you.','2026-09-09 20:18:38.545',NULL),(8,'pending_cv_review_reminder','{{count}} CV review(s) still pending','Hi {{userName}},\n\nYou have {{count}} candidate application(s) still waiting on an initial CV review. The oldest is {{oldestCandidateName}} for {{oldestVacancyTitle}}.\n\nCheck Follow Ups to review them.','2026-09-09 20:18:38.555',NULL),(9,'feedback_overdue_reminder','Feedback still due: {{candidateName}} for {{vacancyTitle}}','Hi {{panelistName}},\n\nYou haven\'t yet submitted feedback for {{candidateName}}\'s {{stageLabel}} interview for the {{vacancyTitle}} role, held {{when}}.\n\nPlease submit your feedback when you get a chance.','2026-09-09 20:18:38.563',NULL);
/*!40000 ALTER TABLE `notificationtemplate` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stagerecommendation`
--

DROP TABLE IF EXISTS `stagerecommendation`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stagerecommendation` (
  `id` int NOT NULL AUTO_INCREMENT,
  `applicationId` int NOT NULL,
  `hiringManagerId` int NOT NULL,
  `recommendation` enum('ADVANCE','DO_NOT_PROGRESS') COLLATE utf8mb4_unicode_ci NOT NULL,
  `comments` text COLLATE utf8mb4_unicode_ci,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `StageRecommendation_applicationId_fkey` (`applicationId`),
  KEY `StageRecommendation_hiringManagerId_fkey` (`hiringManagerId`),
  CONSTRAINT `StageRecommendation_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `candidateapplication` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `StageRecommendation_hiringManagerId_fkey` FOREIGN KEY (`hiringManagerId`) REFERENCES `user` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stagerecommendation`
--

LOCK TABLES `stagerecommendation` WRITE;
/*!40000 ALTER TABLE `stagerecommendation` DISABLE KEYS */;
/*!40000 ALTER TABLE `stagerecommendation` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user`
--

DROP TABLE IF EXISTS `user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `passwordHash` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('HR','INTERVIEWER','MANAGEMENT','HIRING_MANAGER','IT_ADMIN','LEADERSHIP_MANAGEMENT') COLLATE utf8mb4_unicode_ci NOT NULL,
  `department` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `resetTokenExpiresAt` datetime(3) DEFAULT NULL,
  `resetTokenHash` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phoneNumber` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mustChangePassword` tinyint(1) NOT NULL DEFAULT '0',
  `lastActiveAt` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `User_email_key` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user`
--

LOCK TABLES `user` WRITE;
/*!40000 ALTER TABLE `user` DISABLE KEYS */;
INSERT INTO `user` VALUES (1,'Sharon Whitfield','sharon@altrium.com','$2b$10$.hMBpimI8ogIrvRi6ZcYoO64kpCiWzBYb3RHX/IWGkuqqY7Ul63fS','HR','HR','2026-09-09 19:36:28.977',1,NULL,NULL,NULL,0,'2026-09-09 20:15:23.018'),(2,'Marcus Feldman','marcus@altrium.com','$2b$10$2OL/D.1UcL8QOLktFO2HYOjNL.xcD1sOsgCpb8Ad/7RqH1brQurXu','INTERVIEWER','IT','2026-09-09 19:36:29.116',1,NULL,NULL,NULL,0,'2026-09-09 20:00:51.387'),(3,'Elena Torres','elena@altrium.com','$2b$10$L/jeLb9rP455YY.mMtz5DOlDh5Zq47i97ZiLxjE/oVnjDSS.q3pM.','MANAGEMENT','IT','2026-09-09 19:36:29.202',1,NULL,NULL,NULL,0,'2026-09-09 20:23:59.872'),(4,'Victor Adeyemi','victor@altrium.com','$2b$10$DibnLGVGZqb5YJ4fotmtfOITXjuba7oefKxjQrL6LKcQjqF4EfkAC','HIRING_MANAGER','IT','2026-09-09 19:36:29.286',1,NULL,NULL,NULL,0,NULL),(5,'Naomi Clarke','naomi@altrium.com','$2b$10$5EHiyg6MKQ9fGWrrR6o2FO4ZJsy1FpMIZY2d69JEQJH/Ye8Leriey','IT_ADMIN','IT','2026-09-09 19:36:29.377',1,NULL,NULL,NULL,0,'2026-09-09 20:24:10.302'),(6,'Daniel Osei','daniel@altrium.com','$2b$10$04ABuiidSCDUDyyycRjEt.F86aYIfTG4A.IpVsQtmi0nWQoTiA0T2','LEADERSHIP_MANAGEMENT','Leadership','2026-09-09 19:36:29.478',1,NULL,NULL,NULL,0,NULL),(7,'Bianca Whitmore','bianca@altrium.com','$2b$10$BqRMnv.ZcBPh4a27s7HHMeRckCRI8VY9mnubVhv0a8KuK96Ub5m12','MANAGEMENT','Marketing','2026-09-09 19:36:29.557',1,NULL,NULL,NULL,0,NULL),(8,'Derek Holloway','derek@altrium.com','$2b$10$AeQi97/IL.x7bjZIqWISVOJvXSl7nItppL78h.o8ci9reMDLwLclu','MANAGEMENT','Sales','2026-09-09 19:36:29.656',1,NULL,NULL,NULL,0,NULL),(9,'Fatima Rasheed','fatima@altrium.com','$2b$10$IjvcimZ2abSxJ/CYCnzj8eLLZsb83ANjAkr6qiM/eDuYzLlideOmu','MANAGEMENT','Customer Service','2026-09-09 19:36:29.771',1,NULL,NULL,NULL,0,NULL),(10,'Callum Ferris','callum@altrium.com','$2b$10$iTk76LaOB9Sm3sQY1pF4MOqxu61VToKBTgsNfzgt/VaozszxYj5iW','MANAGEMENT','HR','2026-09-09 19:36:29.882',1,NULL,NULL,NULL,0,NULL),(11,'Nadia Petrov','nadia@altrium.com','$2b$10$9rHTljSswMLqNKXqeJzMfO4TW/FRo4oO0Z.xctooD7m2HHKOrkr3y','MANAGEMENT','Finance and Accounting','2026-09-09 19:36:29.962',1,NULL,NULL,NULL,0,NULL),(12,'Owen Sinclair','owen@altrium.com','$2b$10$S1305Ss1Ywki3VLbAg464.fT5H5ibZGIqT4.J5rSbq6JVXNnCOchW','MANAGEMENT','Operations','2026-09-09 19:36:30.055',1,NULL,NULL,NULL,0,NULL),(13,'Miriam Cole','miriam@altrium.com','$2b$10$iC8BhtvTPPptWmFkEPQDoeBh4vOLXoSS6ehUk/ZdAdZAxuwZj.84.','MANAGEMENT','Legal','2026-09-09 19:36:30.156',1,NULL,NULL,NULL,0,NULL),(14,'Rachel Kim','rachel@altrium.com','$2b$10$qap9g/b82Qz2H.HtRTJKIeg2L8HjqAVQpAWOPkw3i.LbgYNej87dO','HR','Talent Acquisition','2026-09-09 19:36:30.271',0,NULL,NULL,NULL,0,NULL),(15,'Jordan Blake','dulzxitzy@gmail.com','$2b$10$BmwqnCqVH33ppgYx/mXmg.V5SZtTgjXK76sKLJJ8qiuxLKZxdJuB6','INTERVIEWER','IT','2026-09-09 19:36:30.388',1,NULL,NULL,NULL,0,NULL);
/*!40000 ALTER TABLE `user` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vacancy`
--

DROP TABLE IF EXISTS `vacancy`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vacancy` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `department` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('OPEN','CLOSED','ON_HOLD') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'OPEN',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `preferredSkills` text COLLATE utf8mb4_unicode_ci,
  `requirements` text COLLATE utf8mb4_unicode_ci,
  `targetFillDate` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `Vacancy_title_department_key` (`title`,`department`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vacancy`
--

LOCK TABLES `vacancy` WRITE;
/*!40000 ALTER TABLE `vacancy` DISABLE KEYS */;
INSERT INTO `vacancy` VALUES (1,'Backend Engineer','IT','Help scale our core platform services and mentor junior engineers on the team.','OPEN','2026-09-09 19:36:34.641',NULL,NULL,NULL),(2,'Content Marketing Specialist','Marketing','Plan and produce content across blog, social, and email to drive qualified pipeline.','OPEN','2026-09-09 19:37:13.367',NULL,NULL,NULL),(3,'Account Executive','Sales','Own the full sales cycle for mid-market accounts, from first call to close.','OPEN','2026-09-09 19:37:33.466',NULL,NULL,NULL),(4,'Customer Success Manager','Customer Service','Own renewal and expansion relationships for our largest accounts.','OPEN','2026-09-09 19:38:01.441',NULL,NULL,NULL),(5,'HR Business Partner','HR','Partner with department leads on hiring plans, performance processes, and employee relations.','OPEN','2026-09-09 19:38:08.414',NULL,NULL,NULL),(6,'Senior Financial Analyst','Finance and Accounting','Lead monthly forecasting and variance analysis, partnering closely with department heads.','OPEN','2026-09-09 19:38:20.395',NULL,NULL,NULL),(7,'Operations Manager','Operations','Own day-to-day operational performance across our fulfilment and logistics teams.','OPEN','2026-09-09 19:38:33.857',NULL,NULL,NULL),(8,'Corporate Counsel','Legal','Advise the business on commercial contracts, compliance, and risk.','OPEN','2026-09-09 19:38:48.763',NULL,NULL,NULL),(9,'QA Engineer','IT','Own manual and automated test coverage across our core platform releases.','OPEN','2026-09-09 19:42:41.808',NULL,NULL,NULL),(10,'Social Media Manager','Marketing','Own the brand\'s voice and growth across all social channels.','OPEN','2026-09-09 19:42:49.833',NULL,NULL,NULL),(11,'Sales Development Representative','Sales','Generate and qualify new-business pipeline for the Account Executive team.','OPEN','2026-09-09 19:42:58.796',NULL,NULL,NULL),(12,'Support Specialist','Customer Service','Frontline technical support for our self-serve customer base.','OPEN','2026-09-09 19:43:06.447',NULL,NULL,NULL),(13,'Talent Acquisition Coordinator','HR','Coordinate scheduling and candidate communication across the full recruitment pipeline.','OPEN','2026-09-09 19:43:14.753',NULL,NULL,NULL),(14,'Accounts Payable Specialist','Finance and Accounting','Own the end-to-end accounts payable process, from invoice intake to payment run.','OPEN','2026-09-09 19:43:24.306',NULL,NULL,NULL),(15,'Logistics Coordinator','Operations','Coordinate inbound and outbound freight schedules across 2 fulfilment sites.','OPEN','2026-09-09 19:43:34.824',NULL,NULL,NULL),(16,'Compliance Officer','Legal','Own regulatory compliance monitoring and reporting across the business.','OPEN','2026-09-09 19:43:42.089',NULL,NULL,NULL);
/*!40000 ALTER TABLE `vacancy` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vacancyinterviewer`
--

DROP TABLE IF EXISTS `vacancyinterviewer`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vacancyinterviewer` (
  `id` int NOT NULL AUTO_INCREMENT,
  `vacancyId` int NOT NULL,
  `userId` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `VacancyInterviewer_vacancyId_userId_key` (`vacancyId`,`userId`),
  KEY `VacancyInterviewer_userId_fkey` (`userId`),
  CONSTRAINT `VacancyInterviewer_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `VacancyInterviewer_vacancyId_fkey` FOREIGN KEY (`vacancyId`) REFERENCES `vacancy` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vacancyinterviewer`
--

LOCK TABLES `vacancyinterviewer` WRITE;
/*!40000 ALTER TABLE `vacancyinterviewer` DISABLE KEYS */;
INSERT INTO `vacancyinterviewer` VALUES (1,1,2),(2,1,3),(3,2,2),(4,2,7),(5,3,2),(6,3,8),(7,4,2),(8,4,9),(9,5,2),(10,5,10),(11,6,2),(12,6,11),(13,7,2),(14,7,12),(15,8,2),(16,8,13);
/*!40000 ALTER TABLE `vacancyinterviewer` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vacancystage`
--

DROP TABLE IF EXISTS `vacancystage`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vacancystage` (
  `id` int NOT NULL AUTO_INCREMENT,
  `vacancyId` int NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `order` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `VacancyStage_vacancyId_order_key` (`vacancyId`,`order`),
  CONSTRAINT `VacancyStage_vacancyId_fkey` FOREIGN KEY (`vacancyId`) REFERENCES `vacancy` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vacancystage`
--

LOCK TABLES `vacancystage` WRITE;
/*!40000 ALTER TABLE `vacancystage` DISABLE KEYS */;
INSERT INTO `vacancystage` VALUES (1,1,'Technical Interview',1),(2,1,'Panel Interview',2),(3,1,'Final Interview',3),(4,2,'Portfolio Review',1),(5,2,'Final Interview',2),(6,3,'Role Play Interview',1),(7,3,'Final Interview',2),(8,4,'Screening Call',1),(9,4,'Final Interview',2),(10,5,'Screening Call',1),(11,5,'Final Interview',2),(12,6,'Case Study Interview',1),(13,6,'Final Interview',2),(14,7,'Initial Interview',1),(15,7,'Final Interview',2),(16,8,'Initial Interview',1),(17,8,'Final Interview',2),(18,9,'Technical Interview',1),(19,10,'Portfolio Review',1),(20,11,'Role Play Interview',1),(21,12,'Screening Call',1),(22,13,'Screening Call',1),(23,14,'Case Study Interview',1),(24,15,'Initial Interview',1),(25,16,'Initial Interview',1);
/*!40000 ALTER TABLE `vacancystage` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'recruitment_tracker'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-09-10  1:54:22
