-- AlterTable
ALTER TABLE "houseboat_staff" ADD COLUMN     "address" TEXT,
ADD COLUMN     "designation" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'available';
