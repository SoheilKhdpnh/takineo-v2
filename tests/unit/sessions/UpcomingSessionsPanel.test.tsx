// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import enMessages from "@/messages/en.json";
import faMessages from "@/messages/fa.json";

const mocks = vi.hoisted(() => {
  const push = vi.fn();
  const refresh = vi.fn();

  return {
    push,
    refresh,
    router: {
      push,
      refresh,
    },
  };
});

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () =>
    (key: string) => key,
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () =>
    mocks.router,
}));

import {
  UpcomingSessionsPanel,
} from "@/components/sessions/UpcomingSessionsPanel";

const studentSession = {
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

const teacherSession = {
  id: "session-2",
  startAt: "2026-08-21T10:00:00.000Z",
  endAt: "2026-08-21T10:15:00.000Z",
  status: "SCHEDULED",
  counterparty: {
    type: "STUDENT",
    userId: "student-user",
    name: "Student One",
    image: null,
  },
  cancellation: null,
};

function jsonResponse(
  body: unknown,
  status = 200,
): Response {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        "Content-Type":
          "application/json",
      },
    },
  );
}

beforeEach(() => {
  mocks.push.mockReset();
  mocks.refresh.mockReset();
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("UpcomingSessionsPanel", () => {
  it("loads student sessions from the authoritative upcoming bucket", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          items: [studentSession],
          hasMore: false,
          nextCursor: null,
        }),
      );

    render(
      <UpcomingSessionsPanel
        viewerRole="STUDENT"
      />,
    );

    expect(
      await screen.findByText(
        "Teacher One",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Speaking coach",
      ),
    ).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/sessions?bucket=upcoming&limit=20",
    );
  });


  it("renders the explicit empty state when Track A returns no upcoming sessions", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          items: [],
          hasMore: false,
          nextCursor: null,
        }),
      );

    render(
      <UpcomingSessionsPanel
        viewerRole="STUDENT"
      />,
    );

    expect(
      await screen.findByText(
        "emptyTitle",
      ),
    ).toBeInTheDocument();
  });

  it("fails closed into the load-error state when a successful HTTP response violates the list contract", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          items: "not-an-array",
          hasMore: false,
          nextCursor: null,
        }),
      );

    render(
      <UpcomingSessionsPanel
        viewerRole="STUDENT"
      />,
    );

    expect(
      await screen.findByText(
        "loadErrorTitle",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "tryAgain",
      }),
    ).toBeInTheDocument();
  });

  it("requires a teacher reason in the interface but leaves the server as cancellation authority", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          items: [teacherSession],
          hasMore: false,
          nextCursor: null,
        }),
      );

    const user = userEvent.setup();

    render(
      <UpcomingSessionsPanel
        viewerRole="TEACHER"
      />,
    );

    await screen.findByText(
      "Student One",
    );

    await user.click(
      screen.getByRole("button", {
        name: "cancelAction",
      }),
    );
    await user.click(
      screen.getByRole("button", {
        name: "confirmCancel",
      }),
    );

    expect(
      screen.getByRole("alert"),
    ).toHaveTextContent(
      "reasonRequired",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps a student session visible when the server rejects cancellation at the cutoff", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          items: [studentSession],
          hasMore: false,
          nextCursor: null,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error:
              "CANCELLATION_CUTOFF",
          },
          409,
        ),
      );

    const user = userEvent.setup();

    render(
      <UpcomingSessionsPanel
        viewerRole="STUDENT"
      />,
    );

    await screen.findByText(
      "Teacher One",
    );

    await user.click(
      screen.getByRole("button", {
        name: "cancelAction",
      }),
    );
    await user.click(
      screen.getByRole("button", {
        name: "confirmCancel",
      }),
    );

    expect(
      await screen.findByText(
        "errors.cutoff",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Teacher One",
      ),
    ).toBeInTheDocument();
  });

  it("removes a session only after a matching server-confirmed cancellation payload", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          items: [studentSession],
          hasMore: false,
          nextCursor: null,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
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
        }),
      );

    const user = userEvent.setup();

    render(
      <UpcomingSessionsPanel
        viewerRole="STUDENT"
      />,
    );

    await screen.findByText(
      "Teacher One",
    );

    await user.click(
      screen.getByRole("button", {
        name: "cancelAction",
      }),
    );
    await user.click(
      screen.getByRole("button", {
        name: "confirmCancel",
      }),
    );

    await waitFor(() => {
      expect(
        screen.queryByText(
          "Teacher One",
        ),
      ).not.toBeInTheDocument();
    });

    expect(
      screen.getByRole("status"),
    ).toHaveTextContent(
      "cancelSuccess",
    );

    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/sessions/session-1/cancel",
      expect.objectContaining({
        method: "POST",
        body: "{}",
      }),
    );
  });

  it("does not remove a session when a nominally successful response violates the cancellation contract", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          items: [studentSession],
          hasMore: false,
          nextCursor: null,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          session: {
            id: "another-session",
            status: "CANCELLED",
          },
          cancellation: {
            sessionId:
              "another-session",
            actorType: "STUDENT",
            cancelledAt:
              "2026-08-19T09:00:00.000Z",
          },
          alreadyCancelled: false,
        }),
      );

    const user = userEvent.setup();

    render(
      <UpcomingSessionsPanel
        viewerRole="STUDENT"
      />,
    );

    await screen.findByText(
      "Teacher One",
    );

    await user.click(
      screen.getByRole("button", {
        name: "cancelAction",
      }),
    );
    await user.click(
      screen.getByRole("button", {
        name: "confirmCancel",
      }),
    );

    expect(
      await screen.findByText(
        "errors.invalidResponse",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Teacher One",
      ),
    ).toBeInTheDocument();
  });

  it("uses the server cursor for bounded pagination instead of issuing per-session requests", async () => {
    const secondSession = {
      ...studentSession,
      id: "session-3",
      counterparty: {
        ...studentSession.counterparty,
        name: "Teacher Two",
      },
    };

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          items: [studentSession],
          hasMore: true,
          nextCursor: "cursor-2",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [secondSession],
          hasMore: false,
          nextCursor: null,
        }),
      );

    const user = userEvent.setup();

    render(
      <UpcomingSessionsPanel
        viewerRole="STUDENT"
      />,
    );

    await screen.findByText(
      "Teacher One",
    );

    await user.click(
      screen.getByRole("button", {
        name: "loadMore",
      }),
    );

    expect(
      await screen.findByText(
        "Teacher Two",
      ),
    ).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "/api/sessions?bucket=upcoming&limit=20&cursor=cursor-2",
    );
  });

  it("keeps upcoming-session copy in Persian and English catalog parity", () => {
    expect(
      Object.keys(
        faMessages.UpcomingSessions,
      ).sort(),
    ).toEqual(
      Object.keys(
        enMessages.UpcomingSessions,
      ).sort(),
    );
    expect(
      Object.keys(
        faMessages.UpcomingSessions.errors,
      ).sort(),
    ).toEqual(
      Object.keys(
        enMessages.UpcomingSessions.errors,
      ).sort(),
    );
  });
});
