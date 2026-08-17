// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen,
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

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () =>
    (
      key: string,
      values?: Record<string, unknown>,
    ) => {
      if (
        key === "experienceYears" &&
        typeof values?.years === "number"
      ) {
        return `${values.years} years`;
      }

      return key;
    },
}));

vi.mock(
  "@/components/teachers/teacher-discovery-api",
  async () => {
    const actual =
      await vi.importActual<
        typeof import("@/components/teachers/teacher-discovery-api")
      >(
        "@/components/teachers/teacher-discovery-api",
      );

    return {
      ...actual,
      getTeacherDiscoveryRange: () => ({
        fromDate:
          "2026-08-18",
        toDate:
          "2026-09-17",
      }),
    };
  },
);

import {
  TeacherDiscoveryPanel,
} from "@/components/teachers/TeacherDiscoveryPanel";

const teacherA = {
  teacherProfileId:
    "teacher-profile-a",
  name:
    "Teacher A",
  image:
    null,
  headline:
    "Conversation teacher",
  experienceYears:
    6,
  nativeLanguage:
    "fa",
  teachingLanguage:
    "en",
  nextAvailableAt:
    "2026-08-20T14:30:00.000Z",
};

const teacherB = {
  teacherProfileId:
    "teacher-profile-b",
  name:
    "Teacher B",
  image:
    "https://images.example.test/teacher-b.jpg",
  headline:
    null,
  experienceYears:
    null,
  nativeLanguage:
    "tr",
  teachingLanguage:
    "en",
  nextAvailableAt:
    null,
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
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("TeacherDiscoveryPanel", () => {
  it("loads a teacher page with one batched discovery request regardless of card count", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          teachers: [
            teacherA,
            teacherB,
          ],
          nextCursor:
            null,
        }),
      );

    render(
      <TeacherDiscoveryPanel />,
    );

    expect(
      await screen.findByText(
        "Teacher A",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Teacher B",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Conversation teacher",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "headlineFallback",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "noAvailability",
      ),
    ).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/teachers?fromDate=2026-08-18&toDate=2026-09-17",
    );
  });

  it("preserves Track A's page order instead of ranking teachers in the client", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          teachers: [
            {
              ...teacherA,
              nextAvailableAt:
                null,
            },
            {
              ...teacherB,
              nextAvailableAt:
                "2026-08-19T10:00:00.000Z",
            },
          ],
          nextCursor:
            null,
        }),
      );

    render(
      <TeacherDiscoveryPanel />,
    );

    await screen.findByText(
      "Teacher A",
    );

    expect(
      screen
        .getAllByRole("heading", {
          level: 3,
        })
        .map((heading) =>
          heading.textContent,
        ),
    ).toEqual([
      "Teacher A",
      "Teacher B",
    ]);
  });

  it("keeps the original discovery window and uses Track A's cursor for the next page", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          teachers: [teacherA],
          nextCursor:
            "teacher-profile-a",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          teachers: [teacherB],
          nextCursor:
            null,
        }),
      );

    const user = userEvent.setup();

    render(
      <TeacherDiscoveryPanel />,
    );

    await screen.findByText(
      "Teacher A",
    );

    await user.click(
      screen.getByRole("button", {
        name: "loadMore",
      }),
    );

    expect(
      await screen.findByText(
        "Teacher B",
      ),
    ).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "/api/teachers?fromDate=2026-08-18&toDate=2026-09-17&cursor=teacher-profile-a",
    );
  });

  it("renders the explicit empty discovery state", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          teachers: [],
          nextCursor:
            null,
        }),
      );

    render(
      <TeacherDiscoveryPanel />,
    );

    expect(
      await screen.findByText(
        "emptyTitle",
      ),
    ).toBeInTheDocument();
  });

  it("fails closed when a successful response violates the public DTO", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          teachers: [
            {
              ...teacherA,
              nextAvailableAt:
                "not-a-date",
            },
          ],
          nextCursor:
            null,
        }),
      );

    render(
      <TeacherDiscoveryPanel />,
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

  it("keeps already loaded teachers visible when a later page fails", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          teachers: [teacherA],
          nextCursor:
            "teacher-profile-a",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error:
              "INTERNAL_SERVER_ERROR",
          },
          500,
        ),
      );

    const user = userEvent.setup();

    render(
      <TeacherDiscoveryPanel />,
    );

    await screen.findByText(
      "Teacher A",
    );

    await user.click(
      screen.getByRole("button", {
        name: "loadMore",
      }),
    );

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent(
      "loadMoreError",
    );
    expect(
      screen.getByText(
        "Teacher A",
      ),
    ).toBeInTheDocument();
  });

  it("keeps the Persian and English discovery catalogs structurally aligned", () => {
    expect(
      Object.keys(
        enMessages.TeacherDiscovery,
      ).sort(),
    ).toEqual(
      Object.keys(
        faMessages.TeacherDiscovery,
      ).sort(),
    );
  });
});
