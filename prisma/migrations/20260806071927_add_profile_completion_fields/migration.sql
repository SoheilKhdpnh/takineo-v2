-- CreateEnum
CREATE TYPE "EnglishLevel" AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');

-- AlterTable
ALTER TABLE "student_profile" ADD COLUMN     "englishLevel" "EnglishLevel",
ADD COLUMN     "learningGoal" TEXT,
ADD COLUMN     "nativeLanguage" TEXT NOT NULL DEFAULT 'fa',
ADD COLUMN     "profileCompletedAt" TIMESTAMP(3),
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Asia/Tehran';

-- AlterTable
ALTER TABLE "teacher_profile" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "experienceYears" INTEGER,
ADD COLUMN     "headline" TEXT,
ADD COLUMN     "nativeLanguage" TEXT NOT NULL DEFAULT 'fa',
ADD COLUMN     "profileCompletedAt" TIMESTAMP(3),
ADD COLUMN     "teachingLanguage" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Asia/Tehran';
