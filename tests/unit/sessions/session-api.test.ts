import {
  describe,
  expect,
  it,
} from "vitest";

import {
  parseSessionApiError,
  parseSessionCancellationSuccess,
  parseSessionListResponse,
} from "@/components/sessions/session-api";
import {
  serializeSpeakingSessionList,
} from "@/lib/errors/session-read-http";
import {
  sessionPrivateJson,
} from "@/lib/errors/session-cancellation-http";
import type {
  SessionCancellationResult,
} from "@/lib/services/session-cancellation.service";

const serializedSessionFixture = {
  id: "session-1",
  startAt: "2026-08-20T14:30:00.000Z",
  endAt: "2026-08-20T14:45:00.000Z",
  status: "SCHEDULED",
  counterparty: {
    type: "TEACHER",
    userId: "teacher-user",
    teacherProfileId: "teacher-profile",
    name: "Teacher One",
    image: null,
    headline: "Speaking coach",
  },
  cancellation: null,
};

describe("session API transport parsing", () => {
  it("accepts Track A's actual speaking-session list serializer output", () => {
    const serialized =
      serializeSpeakingSessionList({
        items: [
          {
            id: "session-1",
            startAt:
              new Date(
                "2026-08-20T14:30:00.000Z",
              ),
            endAt:
              new Date(
                "2026-08-20T14:45:00.000Z",
              ),
            status: "SCHEDULED",
            counterparty: {
              type: "TEACHER",
              userId: "teacher-user",
              teacherProfileId:
                "teacher-profile",
              name: "Teacher One",
              image: null,
              headline:
                "Speaking coach",
            },
            cancellation: null,
          },
        ],
        hasMore: true,
        nextCursor: "cursor-2",
      });

    expect(
      parseSessionListResponse(
        serialized,
      ),
    ).toEqual({
      items: [
        serializedSessionFixture,
      ],
      hasMore: true,
      nextCursor: "cursor-2",
    });
  });

  it("rejects malformed session payloads rather than guessing missing contract fields", () => {
    expect(
      parseSessionListResponse({
        items: [
          {
            ...serializedSessionFixture,
            startAt: "not-a-date",
          },
        ],
        hasMore: false,
        nextCursor: null,
      }),
    ).toBeNull();

    expect(
      parseSessionListResponse({
        items: [
          {
            ...serializedSessionFixture,
            counterparty: {
              type: "TEACHER",
              name: "Teacher One",
            },
          },
        ],
        hasMore: false,
        nextCursor: null,
      }),
    ).toBeNull();
  });

  it("requires a usable cursor whenever Track A says another page exists", () => {
    expect(
      parseSessionListResponse({
        items: [
          serializedSessionFixture,
        ],
        hasMore: true,
        nextCursor: null,
      }),
    ).toBeNull();

    expect(
      parseSessionListResponse({
        items: [
          serializedSessionFixture,
        ],
        hasMore: true,
        nextCursor: "",
      }),
    ).toBeNull();
  });

  it("accepts the JSON shape produced when the Track A cancellation result crosses the HTTP boundary", async () => {
    const cancellationResult:
      SessionCancellationResult = {
        session: {
          id: "session-1",
          teacherProfileId:
            "teacher-profile",
          studentUserId:
            "student-user",
          startAt:
            new Date(
              "2026-08-20T14:30:00.000Z",
            ),
          endAt:
            new Date(
              "2026-08-20T14:45:00.000Z",
            ),
          status: "CANCELLED",
          createdAt:
            new Date(
              "2026-08-18T10:00:00.000Z",
            ),
          updatedAt:
            new Date(
              "2026-08-19T09:00:00.000Z",
            ),
        },
        cancellation: {
          id: "cancellation-1",
          sessionId: "session-1",
          actorType: "STUDENT",
          actorUserId:
            "student-user",
          reason: null,
          cancelledAt:
            new Date(
              "2026-08-19T09:00:00.000Z",
            ),
          createdAt:
            new Date(
              "2026-08-19T09:00:00.000Z",
            ),
        },
        alreadyCancelled: false,
      };

    const response =
      sessionPrivateJson(
        cancellationResult,
      );

    expect(
      parseSessionCancellationSuccess(
        await response.json(),
      ),
    ).toEqual({
      session: {
        id: "session-1",
        status: "CANCELLED",
      },
      cancellation: {
        sessionId: "session-1",
        actorType: "STUDENT",
        cancelledAt:
          "2026-08-19T09:00:00.000Z",
      },
      alreadyCancelled: false,
    });
  });

  it("rejects a nominal cancellation success that does not confirm cancelled state", () => {
    expect(
      parseSessionCancellationSuccess({
        session: {
          id: "session-1",
          status: "SCHEDULED",
        },
        cancellation: {
          sessionId: "session-1",
          actorType: "STUDENT",
          cancelledAt:
            "2026-08-19T09:00:00.000Z",
        },
        alreadyCancelled: false,
      }),
    ).toBeNull();
  });

  it("extracts only stable error and state fields", () => {
    expect(
      parseSessionApiError({
        error:
          "SESSION_STATE_CONFLICT",
        state: "STARTED",
        secret:
          "must-not-drive-ui",
      }),
    ).toEqual({
      error:
        "SESSION_STATE_CONFLICT",
      state: "STARTED",
    });
  });
});
