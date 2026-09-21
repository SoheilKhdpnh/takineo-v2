export class TeacherProfileIncompleteError extends Error {
  constructor() {
    super(
      "The teacher profile must be completed before submitting an introduction video.",
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

export class TeacherVideoInvalidAparatUrlError extends Error {
  constructor() {
    super(
      "The introduction video URL must be an https aparat.com link.",
    );

    this.name =
      "TeacherVideoInvalidAparatUrlError";
  }
}