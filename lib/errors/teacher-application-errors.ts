export class TeacherApplicationNotReadyError extends Error {
  constructor(
    public readonly reason:
      | "PROFILE_INCOMPLETE"
      | "VIDEO_MISSING"
      | "VIDEO_NOT_READY",
  ) {
    super(
      `The teacher application is not ready: ${reason}.`,
    );

    this.name =
      "TeacherApplicationNotReadyError";
  }
}

export class TeacherApplicationStateError extends Error {
  constructor() {
    super(
      "The teacher application cannot be submitted from its current state.",
    );

    this.name =
      "TeacherApplicationStateError";
  }
}