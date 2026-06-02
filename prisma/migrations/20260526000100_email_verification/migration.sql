ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "emailVerificationTokenHash" TEXT;
ALTER TABLE "User" ADD COLUMN "emailVerificationTokenExpiresAt" TIMESTAMP(3);

UPDATE "User"
SET "emailVerifiedAt" = NOW()
WHERE "emailVerifiedAt" IS NULL;

CREATE UNIQUE INDEX "User_emailVerificationTokenHash_key" ON "User"("emailVerificationTokenHash");
