export class KavenegarNotConfiguredError extends Error {
  constructor() {
    super("Kavenegar SMS credentials are not configured.");
    this.name = "KavenegarNotConfiguredError";
  }
}

export class InvalidSmsPhoneNumberError extends Error {
  constructor() {
    super("The phone number is not a valid Iranian mobile number.");
    this.name = "InvalidSmsPhoneNumberError";
  }
}

export class KavenegarDeliveryError extends Error {
  constructor() {
    super("Kavenegar could not deliver the SMS.");
    this.name = "KavenegarDeliveryError";
  }
}