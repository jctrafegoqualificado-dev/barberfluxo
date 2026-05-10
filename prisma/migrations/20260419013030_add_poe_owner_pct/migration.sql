-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Barbershop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "description" TEXT,
    "logoUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "poeOwnerPct" REAL NOT NULL DEFAULT 50,
    "ownerId" TEXT NOT NULL,
    CONSTRAINT "Barbershop_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Barbershop" ("active", "address", "city", "createdAt", "description", "id", "logoUrl", "name", "ownerId", "phone", "slug", "state", "updatedAt") SELECT "active", "address", "city", "createdAt", "description", "id", "logoUrl", "name", "ownerId", "phone", "slug", "state", "updatedAt" FROM "Barbershop";
DROP TABLE "Barbershop";
ALTER TABLE "new_Barbershop" RENAME TO "Barbershop";
CREATE UNIQUE INDEX "Barbershop_slug_key" ON "Barbershop"("slug");
CREATE UNIQUE INDEX "Barbershop_ownerId_key" ON "Barbershop"("ownerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
