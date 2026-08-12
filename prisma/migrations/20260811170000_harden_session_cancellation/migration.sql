BEGIN;

ALTER TABLE
  "speaking_session_cancellation"
DROP CONSTRAINT
  "session_cancellation_reason_check";

ALTER TABLE
  "speaking_session_cancellation"
ADD CONSTRAINT
  "session_cancellation_reason_check"
CHECK (
  (
    "actorType" = 'STUDENT'
    AND (
      "reason" IS NULL
      OR (
        CHAR_LENGTH(
          BTRIM(
            "reason"
          )
        ) > 0
        AND
        "reason" = BTRIM(
          "reason"
        )
      )
    )
  )
  OR
  (
    "actorType" IN (
      'TEACHER',
      'ADMIN',
      'SYSTEM'
    )
    AND
    "reason" IS NOT NULL
    AND
    CHAR_LENGTH(
      BTRIM(
        "reason"
      )
    ) > 0
    AND
    "reason" = BTRIM(
      "reason"
    )
  )
);

CREATE FUNCTION
  prevent_speaking_session_cancellation_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'speaking_session_cancellation rows are immutable'
    USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER
  speaking_session_cancellation_immutable_rows
BEFORE UPDATE OR DELETE
ON "speaking_session_cancellation"
FOR EACH ROW
EXECUTE FUNCTION
  prevent_speaking_session_cancellation_mutation();

CREATE TRIGGER
  speaking_session_cancellation_immutable_table
BEFORE TRUNCATE
ON "speaking_session_cancellation"
FOR EACH STATEMENT
EXECUTE FUNCTION
  prevent_speaking_session_cancellation_mutation();

COMMIT;