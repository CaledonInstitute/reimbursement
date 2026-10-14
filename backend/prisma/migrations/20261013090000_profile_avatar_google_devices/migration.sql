-- Tambah avatar + google SSO ke User
ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT;
ALTER TABLE "User" ADD COLUMN "googleId" TEXT UNIQUE;

-- Perangkat login
CREATE TABLE "LoginDevice" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "tokenId" TEXT NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginDevice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LoginDevice_tokenId_key" ON "LoginDevice"("tokenId");
CREATE INDEX "LoginDevice_userId_idx" ON "LoginDevice"("userId");

ALTER TABLE "LoginDevice" ADD CONSTRAINT "LoginDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
