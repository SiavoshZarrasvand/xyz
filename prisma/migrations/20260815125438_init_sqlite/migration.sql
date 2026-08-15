-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "website" TEXT,
    "address" TEXT,
    "category" TEXT,
    "rating" REAL,
    "reviews" INTEGER,
    "googleMapsUrl" TEXT,
    "inviteCode" TEXT,
    "contacted" BOOLEAN NOT NULL DEFAULT false,
    "contactedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Contact_phone_key" ON "Contact"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_inviteCode_key" ON "Contact"("inviteCode");

-- CreateIndex
CREATE INDEX "Contact_contacted_idx" ON "Contact"("contacted");

-- CreateIndex
CREATE INDEX "Contact_phone_idx" ON "Contact"("phone");
