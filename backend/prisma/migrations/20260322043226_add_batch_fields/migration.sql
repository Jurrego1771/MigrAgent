-- AlterTable
ALTER TABLE "Migration" ADD COLUMN "batchGroupId" TEXT;
ALTER TABLE "Migration" ADD COLUMN "batchIndex" INTEGER;
ALTER TABLE "Migration" ADD COLUMN "batchMode" TEXT;
ALTER TABLE "Migration" ADD COLUMN "batchNamePrefix" TEXT;
ALTER TABLE "Migration" ADD COLUMN "batchSize" INTEGER;
ALTER TABLE "Migration" ADD COLUMN "batchTotal" INTEGER;
