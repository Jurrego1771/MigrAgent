-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "mediastreamApiUrl" TEXT NOT NULL DEFAULT 'https://api.mediastream.com',
    "mediastreamAccountId" TEXT,
    "alertOnStalled" BOOLEAN NOT NULL DEFAULT true,
    "stalledThresholdMs" INTEGER NOT NULL DEFAULT 900000,
    "alertOnErrorThreshold" BOOLEAN NOT NULL DEFAULT true,
    "errorThresholdPercent" INTEGER NOT NULL DEFAULT 10,
    "urlCheckTimeout" INTEGER NOT NULL DEFAULT 10000,
    "urlCheckConcurrency" INTEGER NOT NULL DEFAULT 5,
    "notificationEmail" TEXT,
    "notificationWebhookUrl" TEXT,
    "notifyOnComplete" BOOLEAN NOT NULL DEFAULT false,
    "notifyOnError" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Settings" ("alertOnErrorThreshold", "alertOnStalled", "createdAt", "errorThresholdPercent", "id", "mediastreamAccountId", "mediastreamApiUrl", "stalledThresholdMs", "updatedAt", "urlCheckConcurrency", "urlCheckTimeout") SELECT "alertOnErrorThreshold", "alertOnStalled", "createdAt", "errorThresholdPercent", "id", "mediastreamAccountId", "mediastreamApiUrl", "stalledThresholdMs", "updatedAt", "urlCheckConcurrency", "urlCheckTimeout" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
