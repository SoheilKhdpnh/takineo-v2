/*
  Warnings:

  - The `nativeLanguage` column on the `student_profile` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `timezone` column on the `student_profile` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `nativeLanguage` column on the `teacher_profile` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `timezone` column on the `teacher_profile` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "NativeLanguage" AS ENUM ('fa', 'en', 'ar', 'tr', 'ku');

-- CreateEnum
CREATE TYPE "Timezone" AS ENUM ('Asia/Tehran', 'Asia/Dubai', 'Europe/Berlin', 'Europe/Istanbul', 'Europe/London', 'America/Toronto', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'UTC');

-- AlterTable
ALTER TABLE "student_profile" DROP COLUMN "nativeLanguage",
ADD COLUMN     "nativeLanguage" "NativeLanguage" NOT NULL DEFAULT 'fa',
DROP COLUMN "timezone",
ADD COLUMN     "timezone" "Timezone" NOT NULL DEFAULT 'Asia/Tehran';

-- AlterTable
ALTER TABLE "teacher_profile" DROP COLUMN "nativeLanguage",
ADD COLUMN     "nativeLanguage" "NativeLanguage" NOT NULL DEFAULT 'fa',
DROP COLUMN "timezone",
ADD COLUMN     "timezone" "Timezone" NOT NULL DEFAULT 'Asia/Tehran';
