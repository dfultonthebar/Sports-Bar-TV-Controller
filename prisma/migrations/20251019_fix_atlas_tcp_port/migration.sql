-- Update tcpPort default from 3804 to 5321 (correct Atlas TCP control port)
-- This fixes the incorrect port number that was set in a previous migration

-- Update existing records that have the old default
UPDATE "AudioProcessor" SET "tcpPort" = 5321 WHERE "tcpPort" = 3804 OR "tcpPort" = 23;

-- Note: The schema.prisma file now has the correct default (5321)
-- Future inserts will use the correct port automatically
