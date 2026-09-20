export class InvalidUsernameError extends Error {
  constructor() {
    super("The username is not valid.");
    this.name = "InvalidUsernameError";
  }
}

export class InvalidPhoneNumberError extends Error {
  constructor() {
    super("The phone number is not valid.");
    this.name = "InvalidPhoneNumberError";
  }
}
