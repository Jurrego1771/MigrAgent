-- CreateTable
CREATE TABLE "MigratedItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "migrationId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'report',
    "migratedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "MigratedItem_itemId_idx" ON "MigratedItem"("itemId");
