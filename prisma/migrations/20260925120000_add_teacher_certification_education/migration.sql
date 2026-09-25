-- Additive only: creates two new teacher-owned tables. No existing table,
-- column, or row is modified. File attachments are intentionally excluded
-- until an image/document storage backend is chosen.

-- CreateTable
CREATE TABLE "teacher_certification" (
    "id" TEXT NOT NULL,
    "teacherProfileId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "subject" VARCHAR(120) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "teacher_certification_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tcert_position_range_check"
    CHECK ("position" >= 0 AND "position" < 20),
    CONSTRAINT "tcert_text_present_check"
    CHECK (length(btrim("subject")) > 0 AND length(btrim("name")) > 0)
);

-- CreateTable
CREATE TABLE "teacher_education" (
    "id" TEXT NOT NULL,
    "teacherProfileId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "university" VARCHAR(160) NOT NULL,
    "degree" VARCHAR(160) NOT NULL,
    "degreeType" VARCHAR(60) NOT NULL,
    "specialization" VARCHAR(160) NOT NULL,
    "startYear" INTEGER NOT NULL,
    "endYear" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "teacher_education_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tedu_position_range_check"
    CHECK ("position" >= 0 AND "position" < 20),
    CONSTRAINT "tedu_year_range_check"
    CHECK (
        "startYear" BETWEEN 1950 AND 2100
        AND ("endYear" IS NULL OR ("endYear" BETWEEN 1950 AND 2100 AND "endYear" >= "startYear"))
    ),
    CONSTRAINT "tedu_text_present_check"
    CHECK (length(btrim("university")) > 0 AND length(btrim("degree")) > 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "tcert_teacher_position_key" ON "teacher_certification"("teacherProfileId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "tedu_teacher_position_key" ON "teacher_education"("teacherProfileId", "position");

-- AddForeignKey
ALTER TABLE "teacher_certification" ADD CONSTRAINT "teacher_certification_teacherProfileId_fkey" FOREIGN KEY ("teacherProfileId") REFERENCES "teacher_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_education" ADD CONSTRAINT "teacher_education_teacherProfileId_fkey" FOREIGN KEY ("teacherProfileId") REFERENCES "teacher_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
