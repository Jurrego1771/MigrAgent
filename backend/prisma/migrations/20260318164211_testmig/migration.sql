-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "strategy" TEXT NOT NULL,
    "mappings" TEXT NOT NULL,
    "expectedHeaders" TEXT NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Migration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "mediastreamConfigId" TEXT,
    "templateId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'created',
    "strategy" TEXT NOT NULL,
    "mappings" TEXT NOT NULL,
    "csvFileName" TEXT,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "processedItems" INTEGER NOT NULL DEFAULT 0,
    "successItems" INTEGER NOT NULL DEFAULT 0,
    "errorItems" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "lastUpdateAt" DATETIME,
    "retryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "currentRetryCount" INTEGER NOT NULL DEFAULT 0,
    "retryBackoffType" TEXT NOT NULL DEFAULT 'exponential',
    "retryInitialDelay" INTEGER NOT NULL DEFAULT 60000,
    "retryMaxDelay" INTEGER NOT NULL DEFAULT 3600000,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Migration_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ValidationResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "migrationId" TEXT NOT NULL,
    "isValid" BOOLEAN NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "validRows" INTEGER NOT NULL,
    "errorRows" INTEGER NOT NULL,
    "warningRows" INTEGER NOT NULL,
    "errors" TEXT NOT NULL,
    "warnings" TEXT NOT NULL,
    "urlsChecked" INTEGER NOT NULL DEFAULT 0,
    "urlsAccessible" INTEGER NOT NULL DEFAULT 0,
    "urlsWithRateLimit" INTEGER NOT NULL DEFAULT 0,
    "urlDetails" TEXT,
    "duplicates" TEXT,
    "emptyFields" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ValidationResult_migrationId_fkey" FOREIGN KEY ("migrationId") REFERENCES "Migration" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MigrationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "migrationId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MigrationLog_migrationId_fkey" FOREIGN KEY ("migrationId") REFERENCES "Migration" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "migrationId" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" TEXT,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Alert_migrationId_fkey" FOREIGN KEY ("migrationId") REFERENCES "Migration" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StatsHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "migrationId" TEXT NOT NULL,
    "waiting" INTEGER NOT NULL,
    "queued" INTEGER NOT NULL,
    "running" INTEGER NOT NULL,
    "done" INTEGER NOT NULL,
    "error" INTEGER NOT NULL,
    "speed" REAL NOT NULL DEFAULT 0,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StatsHistory_migrationId_fkey" FOREIGN KEY ("migrationId") REFERENCES "Migration" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "mediastreamApiUrl" TEXT NOT NULL DEFAULT 'https://api.mediastream.com',
    "mediastreamAccountId" TEXT,
    "alertOnStalled" BOOLEAN NOT NULL DEFAULT true,
    "stalledThresholdMs" INTEGER NOT NULL DEFAULT 900000,
    "alertOnErrorThreshold" BOOLEAN NOT NULL DEFAULT true,
    "errorThresholdPercent" INTEGER NOT NULL DEFAULT 10,
    "urlCheckTimeout" INTEGER NOT NULL DEFAULT 10000,
    "urlCheckConcurrency" INTEGER NOT NULL DEFAULT 5,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MapperConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "strategy" TEXT,
    "optionsSchema" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "MapperConfig_name_key" ON "MapperConfig"("name");
