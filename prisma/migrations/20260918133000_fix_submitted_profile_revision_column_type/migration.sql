BEGIN;

-- Some databases renamed a timestamp `submittedProfileVersion` column to
-- `submittedProfileRevision` without converting the type. Prisma writes the
-- integer profile revision into that field on application submit, which then
-- fails with: invalid input syntax for type timestamp: "2"
--
-- Fresh databases that already have INTEGER are unchanged.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'teacher_profile'
      AND column_name = 'submittedProfileRevision'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE "teacher_profile"
      ALTER COLUMN "submittedProfileRevision" TYPE INTEGER
      USING (
        CASE
          WHEN "applicationStatus" IN ('PENDING_REVIEW', 'APPROVED', 'SUSPENDED')
            THEN "profileRevision"
          ELSE NULL
        END
      );
  END IF;
END
$$;

COMMIT;
