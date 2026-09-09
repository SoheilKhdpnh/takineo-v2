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

export class BookingStudentNotEligibleError
  extends Error {
  constructor() {
    super(
      "The authenticated user is not eligible to create a student booking.",
    );

    this.name =
      "BookingStudentNotEligibleError";
  }
}

export class BookingSelfBookingError
  extends Error {
  constructor() {
    super(
      "A user cannot book a speaking session with their own teacher profile.",
    );

    this.name =
      "BookingSelfBookingError";
  }
}

export class BookingSlotUnavailableError
  extends Error {
  constructor() {
    super(
      "The requested speaking-session slot is no longer available.",
    );

    this.name =
      "BookingSlotUnavailableError";
  }
}

export class BookingLimitExceededError
  extends Error {
  constructor() {
    super(
      "The student has reached the maximum number of upcoming speaking sessions.",
    );

    this.name =
      "BookingLimitExceededError";
  }
}

export class BookingIdempotencyConflictError
  extends Error {
  constructor() {
    super(
      "The booking idempotency key was already used with a different request.",
    );

    this.name =
      "BookingIdempotencyConflictError";
  }
}

export class BookingConflictError
  extends Error {
  constructor() {
    super(
      "The booking changed concurrently. The request should be retried.",
    );

    this.name =
      "BookingConflictError";
  }
}
