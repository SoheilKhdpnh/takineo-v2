export class TeacherProfileIncompleteError extends Error {
  constructor() {
    super(
      "The teacher profile must be completed before uploading a video.",
    );

    this.name =
      "TeacherProfileIncompleteError";
  }
}

export class TeacherApplicationLockedError extends Error {
  constructor() {
    super(
      "The teacher application cannot currently be edited.",
    );

    this.name =
      "TeacherApplicationLockedError";
  }
}

export class TeacherVideoNotFoundError extends Error {
  constructor() {
    super(
      "The teacher introduction video was not found.",
    );

    this.name =
      "TeacherVideoNotFoundError";
  }
}