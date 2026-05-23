CREATE TABLE "FeedbackMessage" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "role" TEXT,
    "interest" TEXT,
    "message" TEXT NOT NULL,
    "emailedAt" TIMESTAMP(3),
    "emailError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FeedbackMessage_createdAt_idx" ON "FeedbackMessage"("createdAt");
