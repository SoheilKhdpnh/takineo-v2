export class TeacherAvailabilityStateError
  extends Error {
  constructor() {
    super(
      "Teacher availability can only be managed by an approved teacher.",
    );

    this.name =
      "TeacherAvailabilityStateError";
  }
}

export class TeacherAvailabilityConflictError
  extends Error {
  constructor() {
    super(
      "Teacher availability changed concurrently or conflicts with another availability window.",
    );

    this.name =
      "TeacherAvailabilityConflictError";
  }
}

export class TeacherAvailabilityExceptionNotFoundError
  extends Error {
  constructor() {
    super(
      "The teacher availability exception was not found.",
    );

    this.name =
      "TeacherAvailabilityExceptionNotFoundError";
  }
}

export class TeacherAvailabilityRangeError
  extends Error {
  constructor(
    public readonly reason:
      | "INVALID_DATE_RANGE"
      | "RANGE_TOO_LARGE",
  ) {
    super(
      `Invalid teacher availability date range: ${reason}.`,
    );

    this.name =
      "TeacherAvailabilityRangeError";
  }
}
