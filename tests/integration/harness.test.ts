import {
  describe,
  expect,
  it,
} from "vitest";

describe("database integration harness", () => {
  it("maps runtime and migration URLs to the guarded test database", () => {
    expect(
      process.env.TEST_DATABASE_URL,
    ).toBeTruthy();

    expect(
      process.env.DATABASE_URL,
    ).toBe(
      process.env.TEST_DATABASE_URL,
    );

    expect(
      process.env.DIRECT_URL,
    ).toBe(
      process.env.TEST_DATABASE_URL,
    );
  });
});
