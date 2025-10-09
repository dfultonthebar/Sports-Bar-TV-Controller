
-- AlterTable
ALTER TABLE "AudioProcessor" ADD COLUMN "username" TEXT;
ALTER TABLE "AudioProcessor" ADD COLUMN "password" TEXT;

-- Add comment for documentation
COMMENT ON COLUMN "AudioProcessor"."username" IS 'HTTP Basic Auth username for Atlas processor web interface';
COMMENT ON COLUMN "AudioProcessor"."password" IS 'HTTP Basic Auth password (stored encrypted) for Atlas processor web interface';
