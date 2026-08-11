export class BookableTeacherNotFoundError
  extends Error {
  constructor() {
    super(
      "The requested teacher is not available for public booking.",
    );

    this.name =
      "BookableTeacherNotFoundError";
  }
}

export class BookableSlotsRangeError
  extends Error {
  constructor(
    public readonly reason:
      | "INVALID_DATE_RANGE"
      | "RANGE_TOO_LARGE",
  ) {
    super(
      `Invalid bookable-slots date range: ${reason}.`,
    );

    this.name =
      "BookableSlotsRangeError";
  }
}
