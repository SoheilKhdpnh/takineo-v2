-- AlterTable
ALTER TABLE "user" ADD COLUMN "username" TEXT,
ADD COLUMN "displayUsername" TEXT,
ADD COLUMN "phoneNumber" TEXT,
ADD COLUMN "phoneNumberVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "termsAccepted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "user_phoneNumber_key" ON "user"("phoneNumber");
