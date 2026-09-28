-- Authentication state is durable in PostgreSQL; BullMQ delivers encrypted OTP messages.
ALTER TABLE "User"
  ADD COLUMN "email" TEXT NOT NULL,
  ADD COLUMN "passwordHash" TEXT,
  ADD COLUMN "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lockedUntil" TIMESTAMP(3);

UPDATE "User" SET "passwordHash" = "password" WHERE "passwordHash" IS NULL;
ALTER TABLE "User" ALTER COLUMN "passwordHash" SET NOT NULL;
ALTER TABLE "User" DROP COLUMN "password";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TYPE "OtpPurpose" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

CREATE TABLE "OtpChallenge" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "purpose" "OtpPurpose" NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "deliveryCount" INTEGER NOT NULL DEFAULT 1,
  "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OtpChallenge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RefreshSession" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "replacedById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RefreshSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthRateLimit" (
  "id" UUID NOT NULL,
  "scope" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuthRateLimit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RefreshSession_tokenHash_key" ON "RefreshSession"("tokenHash");
CREATE UNIQUE INDEX "RefreshSession_replacedById_key" ON "RefreshSession"("replacedById");
CREATE UNIQUE INDEX "AuthRateLimit_scope_keyHash_key" ON "AuthRateLimit"("scope", "keyHash");
CREATE INDEX "OtpChallenge_email_purpose_createdAt_idx" ON "OtpChallenge"("email", "purpose", "createdAt");
CREATE INDEX "OtpChallenge_userId_purpose_expiresAt_idx" ON "OtpChallenge"("userId", "purpose", "expiresAt");
CREATE INDEX "RefreshSession_userId_expiresAt_idx" ON "RefreshSession"("userId", "expiresAt");

ALTER TABLE "OtpChallenge" ADD CONSTRAINT "OtpChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RefreshSession" ADD CONSTRAINT "RefreshSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
