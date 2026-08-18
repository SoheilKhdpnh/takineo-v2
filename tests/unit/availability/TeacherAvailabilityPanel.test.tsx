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

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () =>
    (key: string) => key,
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({
    push: routerMocks.push,
    refresh: routerMocks.refresh,
  }),
}));

vi.mock(
  "@/components/availability/teacher-availability-api",
  async () => {
    const actual =
      await vi.importActual<
        typeof import("@/components/availability/teacher-availability-api")
      >(
        "@/components/availability/teacher-availability-api",
      );

    return {
      ...actual,
      getTeacherAvailabilityReadRange: () => ({
        fromDate: "2026-08-18",
        toDate: "2026-09-17",
      }),
    };
  },
);

import {
  TeacherAvailabilityPanel,
} from "@/components/availability/TeacherAvailabilityPanel";

const rule = {
  id: "rule-1",
  teacherProfileId:
    "teacher-profile-1",
  weekday: "SATURDAY",
  startMinute: 540,
  endMinute: 600,
  isActive: true,
  createdAt:
    "2026-08-18T00:00:00.000Z",
  updatedAt:
    "2026-08-18T00:00:00.000Z",
};

const exception = {
  id: "exception-1",
  teacherProfileId:
    "teacher-profile-1",
  date: "2026-08-20",
  startMinute: 540,
  endMinute: 600,
  type: "UNAVAILABLE",
  note: "Appointment",
  createdAt:
    "2026-08-18T00:00:00.000Z",
  updatedAt:
    "2026-08-18T00:00:00.000Z",
};

function availabilityBody({
  rules = [rule],
  exceptions = [exception],
}: {
  rules?: unknown[];
  exceptions?: unknown[];
} = {}) {
  return {
    availability: {
      rules,
      exceptions,
    },
  };
}

function jsonResponse(
  body: unknown,
  status = 200,
): Response {
  return Response.json(
    body,
    {
      status,
    },
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  routerMocks.push.mockReset();
  routerMocks.refresh.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("TeacherAvailabilityPanel", () => {
  it("loads one authoritative availability snapshot and renders recurring rules plus exceptions", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse(
          availabilityBody(),
        ),
      );

    render(
      <TeacherAvailabilityPanel />,
    );

    expect(
      await screen.findByText(
        "weeklyTitle",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Appointment",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "weekdays.SATURDAY",
      ),
    ).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/profile/teacher/availability?fromDate=2026-08-18&toDate=2026-09-17",
    );
    expect(
      fetchMock.mock.calls[0]?.[1],
    ).toEqual(
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
      }),
    );
  });

  it("saves an empty rules array as an intentional complete weekly replacement", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse(
          availabilityBody(),
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          rules: [],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          availabilityBody({
            rules: [],
          }),
        ),
      );

    const user = userEvent.setup();

    render(
      <TeacherAvailabilityPanel />,
    );

    await screen.findByText(
      "weeklyTitle",
    );

    await user.click(
      screen.getByRole("button", {
        name: "removeWindow",
      }),
    );

    await user.click(
      screen.getByRole("button", {
        name: "saveWeekly",
      }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "/api/profile/teacher/availability",
    );
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          rules: [],
        }),
      }),
    );
    expect(
      await screen.findByText(
        "weeklySaveSuccess",
      ),
    ).toBeInTheDocument();
  });

  it("creates a one-off block through POST and refetches authoritative state", async () => {
    const createdException = {
      ...exception,
      id: "exception-2",
      date: "2026-08-21",
      note: "Appointment two",
    };

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse(
          availabilityBody(),
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            exception:
              createdException,
          },
          201,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          availabilityBody({
            exceptions: [
              exception,
              createdException,
            ],
          }),
        ),
      );

    const user = userEvent.setup();

    render(
      <TeacherAvailabilityPanel />,
    );

    await screen.findByText(
      "weeklyTitle",
    );

    const dateInput =
      screen.getByLabelText(
        "exceptionDate",
      );
    await user.clear(dateInput);
    await user.type(
      dateInput,
      "2026-08-21",
    );

    await user.type(
      screen.getByLabelText(
        "note",
      ),
      "Appointment two",
    );

    await user.click(
      screen.getByRole("button", {
        name: "createException",
      }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          date: "2026-08-21",
          startMinute: 540,
          endMinute: 600,
          type: "UNAVAILABLE",
          note: "Appointment two",
        }),
      }),
    );
    expect(
      await screen.findByText(
        "exceptionCreateSuccess",
      ),
    ).toBeInTheDocument();
  });

  it("deletes a teacher-owned exception through the canonical exception route and refetches", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse(
          availabilityBody(),
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          deleted: true,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          availabilityBody({
            exceptions: [],
          }),
        ),
      );

    const user = userEvent.setup();

    render(
      <TeacherAvailabilityPanel />,
    );

    await screen.findByText(
      "Appointment",
    );

    await user.click(
      screen.getByRole("button", {
        name: "deleteException",
      }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "/api/profile/teacher/availability/exceptions/exception-1",
    );
    expect(fetchMock.mock.calls[1]?.[1]).toEqual({
      method: "DELETE",
    });
    expect(
      await screen.findByText(
        "noExceptions",
      ),
    ).toBeInTheDocument();
  });

  it("does not retry a conflicting weekly write and replaces the draft with the refetched server snapshot", async () => {
    const refreshedRule = {
      ...rule,
      startMinute: 570,
      updatedAt:
        "2026-08-18T00:01:00.000Z",
    };

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse(
          availabilityBody(),
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error:
              "TEACHER_AVAILABILITY_CONFLICT",
          },
          409,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          availabilityBody({
            rules: [refreshedRule],
          }),
        ),
      );

    const user = userEvent.setup();

    render(
      <TeacherAvailabilityPanel />,
    );

    await screen.findByText(
      "weeklyTitle",
    );

    const weeklyStart =
      screen.getAllByLabelText(
        "startTime",
      )[0];

    expect(weeklyStart).toBeDefined();

    await user.selectOptions(
      weeklyStart!,
      "555",
    );

    await user.click(
      screen.getByRole("button", {
        name: "saveWeekly",
      }),
    );

    expect(
      await screen.findByText(
        "errors.conflict",
      ),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    expect(
      fetchMock.mock.calls.filter(
        ([, init]) =>
          init?.method === "PUT",
      ),
    ).toHaveLength(1);

    await waitFor(() => {
      expect(
        screen.getAllByLabelText(
          "startTime",
        )[0],
      ).toHaveValue("570");
    });
  });

  it("disables editing when Track A reports a teacher availability state conflict", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error:
              "TEACHER_AVAILABILITY_STATE_CONFLICT",
          },
          409,
        ),
      );

    render(
      <TeacherAvailabilityPanel />,
    );

    expect(
      await screen.findByText(
        "lockedTitle",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "saveWeekly",
      }),
    ).not.toBeInTheDocument();
  });

  it("fails closed when a nominally successful GET violates the availability DTO", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          availability: {
            rules: "not-an-array",
            exceptions: [],
          },
        }),
      );

    render(
      <TeacherAvailabilityPanel />,
    );

    expect(
      await screen.findByText(
        "loadErrorTitle",
      ),
    ).toBeInTheDocument();
  });

  it("keeps the Persian and English availability catalogs structurally aligned", () => {
    function keys(
      value: Record<string, unknown>,
      prefix = "",
    ): string[] {
      return Object.entries(value).flatMap(
        ([key, child]) => {
          const path = prefix
            ? `${prefix}.${key}`
            : key;

          return (
            typeof child === "object" &&
            child !== null &&
            !Array.isArray(child)
          )
            ? keys(
                child as Record<string, unknown>,
                path,
              )
            : [path];
        },
      );
    }

    expect(
      keys(
        enMessages.TeacherAvailability,
      ).sort(),
    ).toEqual(
      keys(
        faMessages.TeacherAvailability,
      ).sort(),
    );
  });
});
