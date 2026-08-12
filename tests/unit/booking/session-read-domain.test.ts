import {
  describe,
  expect,
  it,
} from "vitest";

import {
  decodeSessionReadCursor,
  encodeSessionReadCursor,
} from "@/lib/domain/session-read-cursor";
import {
  buildSessionBucketWhere,
  isSessionInReadBucket,
} from "@/lib/domain/session-read-policy";
import {
  SessionReadCursorError,
} from "@/lib/errors/session-read-errors";

const asOf =
  new Date(
    "2026-08-12T09:30:00.000Z",
  );

describe(
  "speaking-session read domain",
  () => {
    describe(
      "bucket policy",
      () => {
        it(
          "defines upcoming as SCHEDULED with endAt strictly after asOf",
          () => {
            expect(
              buildSessionBucketWhere(
                "upcoming",
                asOf,
              ),
            ).toEqual({
              status:
                "SCHEDULED",

              endAt: {
                gt:
                  asOf,
              },
            });
          },
        );

        it(
          "defines history as terminal status or endAt at-or-before asOf",
          () => {
            expect(
              buildSessionBucketWhere(
                "history",
                asOf,
              ),
            ).toEqual({
              OR: [
                {
                  status: {
                    in: [
                      "COMPLETED",
                      "CANCELLED",
                    ],
                  },
                },
                {
                  endAt: {
                    lte:
                      asOf,
                  },
                },
              ],
            });
          },
        );

        it(
          "keeps a currently-running scheduled session upcoming",
          () => {
            expect(
              isSessionInReadBucket(
                {
                  status:
                    "SCHEDULED",

                  endAt:
                    new Date(
                      "2026-08-12T09:31:00.000Z",
                    ),
                },
                "upcoming",
                asOf,
              ),
            ).toBe(
              true,
            );
          },
        );

        it(
          "moves a scheduled session to history exactly at endAt",
          () => {
            const session = {
              status:
                "SCHEDULED" as const,

              endAt:
                new Date(
                  asOf,
                ),
            };

            expect(
              isSessionInReadBucket(
                session,
                "upcoming",
                asOf,
              ),
            ).toBe(
              false,
            );

            expect(
              isSessionInReadBucket(
                session,
                "history",
                asOf,
              ),
            ).toBe(
              true,
            );
          },
        );

        it(
          "puts a future cancelled session in history immediately",
          () => {
            const session = {
              status:
                "CANCELLED" as const,

              endAt:
                new Date(
                  "2026-08-13T09:30:00.000Z",
                ),
            };

            expect(
              isSessionInReadBucket(
                session,
                "upcoming",
                asOf,
              ),
            ).toBe(
              false,
            );

            expect(
              isSessionInReadBucket(
                session,
                "history",
                asOf,
              ),
            ).toBe(
              true,
            );
          },
        );

        it(
          "puts a future completed session in history by terminal status",
          () => {
            expect(
              isSessionInReadBucket(
                {
                  status:
                    "COMPLETED",

                  endAt:
                    new Date(
                      "2026-08-13T09:30:00.000Z",
                    ),
                },
                "history",
                asOf,
              ),
            ).toBe(
              true,
            );
          },
        );

        it(
          "keeps stale past SCHEDULED rows in history before completion processing",
          () => {
            expect(
              isSessionInReadBucket(
                {
                  status:
                    "SCHEDULED",

                  endAt:
                    new Date(
                      "2026-08-12T09:29:59.999Z",
                    ),
                },
                "history",
                asOf,
              ),
            ).toBe(
              true,
            );
          },
        );

        it(
          "rejects an invalid asOf date",
          () => {
            expect(
              () =>
                buildSessionBucketWhere(
                  "upcoming",
                  new Date(
                    Number.NaN,
                  ),
                ),
            ).toThrow(
              RangeError,
            );
          },
        );
      },
    );

    describe(
      "cursor codec",
      () => {
        it(
          "round-trips an upcoming cursor",
          () => {
            const encoded =
              encodeSessionReadCursor({
                bucket:
                  "upcoming",

                asOf,

                startAt:
                  new Date(
                    "2026-08-13T10:00:00.000Z",
                  ),

                id:
                  "session-123",
              });

            expect(
              decodeSessionReadCursor(
                encoded,
                "upcoming",
              ),
            ).toEqual({
              bucket:
                "upcoming",

              asOf,

              startAt:
                new Date(
                  "2026-08-13T10:00:00.000Z",
                ),

              id:
                "session-123",
            });
          },
        );

        it(
          "round-trips a history cursor",
          () => {
            const encoded =
              encodeSessionReadCursor({
                bucket:
                  "history",

                asOf,

                startAt:
                  new Date(
                    "2026-08-10T10:00:00.000Z",
                  ),

                id:
                  "session-456",
              });

            expect(
              decodeSessionReadCursor(
                encoded,
                "history",
              ).bucket,
            ).toBe(
              "history",
            );
          },
        );

        it(
          "rejects a cursor used against a different bucket",
          () => {
            const encoded =
              encodeSessionReadCursor({
                bucket:
                  "upcoming",

                asOf,

                startAt:
                  new Date(
                    "2026-08-13T10:00:00.000Z",
                  ),

                id:
                  "session-123",
              });

            expect(
              () =>
                decodeSessionReadCursor(
                  encoded,
                  "history",
                ),
            ).toThrow(
              SessionReadCursorError,
            );
          },
        );

        it(
          "rejects malformed base64url",
          () => {
            expect(
              () =>
                decodeSessionReadCursor(
                  "not valid base64!",
                  "upcoming",
                ),
            ).toThrow(
              SessionReadCursorError,
            );
          },
        );

        it(
          "rejects valid base64url containing invalid JSON",
          () => {
            const encoded =
              Buffer
                .from(
                  "not-json",
                  "utf8",
                )
                .toString(
                  "base64url",
                );

            expect(
              () =>
                decodeSessionReadCursor(
                  encoded,
                  "upcoming",
                ),
            ).toThrow(
              SessionReadCursorError,
            );
          },
        );

        it(
          "rejects an unsupported cursor version",
          () => {
            const encoded =
              Buffer
                .from(
                  JSON.stringify({
                    v:
                      2,

                    bucket:
                      "upcoming",

                    asOf:
                      asOf.toISOString(),

                    startAt:
                      asOf.toISOString(),

                    id:
                      "session-123",
                  }),
                  "utf8",
                )
                .toString(
                  "base64url",
                );

            expect(
              () =>
                decodeSessionReadCursor(
                  encoded,
                  "upcoming",
                ),
            ).toThrow(
              SessionReadCursorError,
            );
          },
        );

        it(
          "rejects cursor session identifiers containing whitespace",
          () => {
            expect(
              () =>
                encodeSessionReadCursor({
                  bucket:
                    "upcoming",

                  asOf,

                  startAt:
                    asOf,

                  id:
                    "bad session id",
                }),
            ).toThrow(
              SessionReadCursorError,
            );
          },
        );

        it(
          "encodes the same cursor deterministically",
          () => {
            const cursor = {
              bucket:
                "upcoming" as const,

              asOf,

              startAt:
                new Date(
                  "2026-08-13T10:00:00.000Z",
                ),

              id:
                "session-123",
            };

            expect(
              encodeSessionReadCursor(
                cursor,
              ),
            ).toBe(
              encodeSessionReadCursor(
                cursor,
              ),
            );
          },
        );
      },
    );
  },
);
