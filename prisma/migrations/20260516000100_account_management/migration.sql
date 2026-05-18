ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "deleteRequestedAt" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "deleteScheduledAt" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "name" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deleteRequestedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deleteScheduledAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Company_deleteScheduledAt_idx" ON "Company"("deleteScheduledAt");
CREATE INDEX IF NOT EXISTS "Company_deletedAt_idx" ON "Company"("deletedAt");
CREATE INDEX IF NOT EXISTS "User_deleteScheduledAt_idx" ON "User"("deleteScheduledAt");
CREATE INDEX IF NOT EXISTS "User_deletedAt_idx" ON "User"("deletedAt");
