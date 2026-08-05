export class UserNotFoundError extends Error {
  constructor() {
    super("The authenticated user could not be found.");
    this.name = "UserNotFoundError";
  }
}

export class OnboardingAlreadyCompletedError extends Error {
  constructor() {
    super("Onboarding has already been completed.");
    this.name = "OnboardingAlreadyCompletedError";
  }
}

export class OnboardingStateConflictError extends Error {
  constructor() {
    super(
      "The user already has an incompatible profile.",
    );
    this.name = "OnboardingStateConflictError";
  }
}