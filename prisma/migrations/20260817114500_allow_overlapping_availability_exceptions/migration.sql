-- Wave 2 availability semantics intentionally permit overlapping
-- AVAILABLE and UNAVAILABLE exceptions for the same teacher/date.
--
-- Projection semantics are:
--
--   final =
--     (recurring UNION AVAILABLE)
--     MINUS UNAVAILABLE
--
-- Therefore PostgreSQL must allow those exception rows to coexist;
-- UNAVAILABLE precedence is resolved by the domain projection.
--
-- Exact duplicate windows remain protected by tae_exact_window_key.

ALTER TABLE "teacher_availability_exception"
DROP CONSTRAINT "tae_no_overlap";
