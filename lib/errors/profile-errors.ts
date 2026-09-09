export class ProfileNotFoundError extends Error {
  constructor() {
    super(
      "The profile for the authenticated user was not found.",
    );

    this.name = "ProfileNotFoundError";
  }
}

export class ProfileRoleMismatchError extends Error {
  constructor() {
    super(
      "The authenticated user cannot modify this profile type.",
    );

    this.name = "ProfileRoleMismatchError";
  }
}