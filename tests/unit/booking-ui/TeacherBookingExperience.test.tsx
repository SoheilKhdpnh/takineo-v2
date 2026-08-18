// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode, type ReactNode } from "react";
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

const apiMocks = vi.hoisted(() => ({
  getPublicTeacherDetail:
    vi.fn(),
  getBookableSlots:
    vi.fn(),
  createStudentBooking:
    vi.fn(),
  generateBookingIdempotencyKey:
    vi.fn(),
}));

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

      if (
        key === "slotCount" &&
        typeof values?.count === "number"
      ) {
        return `${values.count} slots`;
      }

      if (
        key === "slotsForDate"
      ) {
        return `slots-${String(
          values?.date ?? "",
        )}`;
      }

      if (
        key ===
        "confirmedDescription"
      ) {
        return `confirmed-${String(
          values?.time ?? "",
        )}`;
      }

      return key;
    },
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  }) => (
    <a
      href={href}
      {...props}
    >
      {children}
    </a>
  ),
}));

vi.mock(
  "@/components/booking/student-booking-api",
  async () => {
    const actual =
      await vi.importActual<
        typeof import("@/components/booking/student-booking-api")
      >(
        "@/components/booking/student-booking-api",
      );

    return {
      ...actual,
      getBookingBrowseRange: () => ({
        fromDate: "2026-08-18",
        toDate: "2026-09-17",
      }),
      getPublicTeacherDetail:
        apiMocks.getPublicTeacherDetail,
      getBookableSlots:
        apiMocks.getBookableSlots,
      createStudentBooking:
        apiMocks.createStudentBooking,
      generateBookingIdempotencyKey:
        apiMocks.generateBookingIdempotencyKey,
    };
  },
);

import {
  BookingApiError,
} from "@/components/booking/student-booking-api";
import {
  TeacherBookingExperience,
} from "@/components/booking/TeacherBookingExperience";

const teacher = {
  teacherProfileId:
    "teacher-profile-1",
  name: "Teacher One",
  image: null,
  headline: "Speaking coach",
  bio: "Teacher biography",
  experienceYears: 6,
  nativeLanguage: "fa" as const,
  teachingLanguage: "en" as const,
};

const slotA = {
  date: "2026-08-20",
  startMinute: 540,
  endMinute: 555,
  startAt:
    "2026-08-20T05:30:00.000Z",
  endAt:
    "2026-08-20T05:45:00.000Z",
};

const slotB = {
  date: "2026-08-20",
  startMinute: 555,
  endMinute: 570,
  startAt:
    "2026-08-20T05:45:00.000Z",
  endAt:
    "2026-08-20T06:00:00.000Z",
};

const slotResponse = {
  teacherProfileId:
    "teacher-profile-1",
  timezone:
    "Asia/Tehran" as const,
  fromDate: "2026-08-18",
  toDate: "2026-09-17",
  slots: [slotA, slotB],
};

function scheduledSession(
  startAt = slotA.startAt,
) {
  return {
    id: "session-1",
    teacherProfileId:
      "teacher-profile-1",
    startAt,
    endAt:
      startAt === slotA.startAt
        ? slotA.endAt
        : slotB.endAt,
    status: "SCHEDULED" as const,
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  apiMocks
    .getPublicTeacherDetail
    .mockResolvedValue(teacher);

  apiMocks
    .getBookableSlots
    .mockResolvedValue(
      slotResponse,
    );

  apiMocks
    .generateBookingIdempotencyKey
    .mockReturnValue(
      "booking-request-00000001",
    );
});

afterEach(() => {
  cleanup();
});

function renderBooking() {
  return render(
    <StrictMode>
      <TeacherBookingExperience
        teacherProfileId="teacher-profile-1"
      />
    </StrictMode>,
  );
}

describe("TeacherBookingExperience", () => {
  it("loads one public profile and one authoritative slot projection", async () => {
    renderBooking();

    expect(
      await screen.findByText(
        "Teacher One",
      ),
    ).toBeInTheDocument();

    expect(
      apiMocks.getPublicTeacherDetail,
    ).toHaveBeenCalledTimes(1);
    expect(
      apiMocks.getBookableSlots,
    ).toHaveBeenCalledTimes(1);
    expect(
      apiMocks.getBookableSlots,
    ).toHaveBeenCalledWith(
      "teacher-profile-1",
      {
        fromDate:
          "2026-08-18",
        toDate:
          "2026-09-17",
      },
      expect.any(AbortSignal),
    );

    expect(
      screen.getAllByRole("button", { name: "selectSlot" }),
    ).toHaveLength(2);
  });

  it("books only the selected authoritative startAt and confirms only after the persisted session result", async () => {
    apiMocks
      .createStudentBooking
      .mockResolvedValueOnce(
        scheduledSession(),
      );

    const user = userEvent.setup();

    renderBooking();

    await screen.findByText(
      "Teacher One",
    );

    await user.click(
      screen.getAllByRole("button", { name: "selectSlot" })[0],
    );

    expect(
      apiMocks.generateBookingIdempotencyKey,
    ).toHaveBeenCalledTimes(1);

    await user.click(
      screen.getByRole("button", {
        name: "confirmBooking",
      }),
    );

    expect(
      apiMocks.createStudentBooking,
    ).toHaveBeenCalledWith({
      teacherProfileId:
        "teacher-profile-1",
      startAt: slotA.startAt,
      idempotencyKey:
        "booking-request-00000001",
    });

    expect(
      await screen.findByText(
        "confirmedTitle",
      ),
    ).toBeInTheDocument();
  });

  it("reuses the exact same idempotency key and payload after an ambiguous transport failure", async () => {
    apiMocks
      .createStudentBooking
      .mockRejectedValueOnce(
        new TypeError("network"),
      )
      .mockResolvedValueOnce(
        scheduledSession(),
      );

    const user = userEvent.setup();

    renderBooking();

    await screen.findByText(
      "Teacher One",
    );

    await user.click(
      screen.getAllByRole("button", { name: "selectSlot" })[0],
    );
    await user.click(
      screen.getByRole("button", {
        name: "confirmBooking",
      }),
    );

    expect(
      await screen.findByText(
        "notices.networkRetry.title",
      ),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "retrySameAttempt",
      }),
    );

    expect(
      apiMocks.createStudentBooking,
    ).toHaveBeenCalledTimes(2);
    expect(
      apiMocks.createStudentBooking.mock.calls[0]?.[0],
    ).toEqual(
      apiMocks.createStudentBooking.mock.calls[1]?.[0],
    );
    expect(
      apiMocks.generateBookingIdempotencyKey,
    ).toHaveBeenCalledTimes(1);
  });

  it("clears a stale slot and refetches authoritative slots after SLOT_UNAVAILABLE", async () => {
    apiMocks
      .createStudentBooking
      .mockRejectedValueOnce(
        new BookingApiError(
          "SLOT_UNAVAILABLE",
          409,
        ),
      );

    apiMocks
      .getBookableSlots
      .mockResolvedValueOnce(
        slotResponse,
      )
      .mockResolvedValueOnce({
        ...slotResponse,
        slots: [slotB],
      });

    const user = userEvent.setup();

    renderBooking();

    await screen.findByText(
      "Teacher One",
    );

    await user.click(
      screen.getAllByRole("button", { name: "selectSlot" })[0],
    );
    await user.click(
      screen.getByRole("button", {
        name: "confirmBooking",
      }),
    );

    expect(
      await screen.findByText(
        "notices.slotUnavailable.title",
      ),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        apiMocks.getBookableSlots,
      ).toHaveBeenCalledTimes(2);
    });

    expect(
      screen.queryByText(
        "selectedSlot",
      ),
    ).not.toBeInTheDocument();
    expect(
      apiMocks.generateBookingIdempotencyKey,
    ).toHaveBeenCalledTimes(1);
  });

  it("requires a new explicit slot selection after an idempotency conflict", async () => {
    apiMocks
      .createStudentBooking
      .mockRejectedValueOnce(
        new BookingApiError(
          "IDEMPOTENCY_CONFLICT",
          409,
        ),
      );

    const user = userEvent.setup();

    renderBooking();

    await screen.findByText(
      "Teacher One",
    );

    await user.click(
      screen.getAllByRole("button", { name: "selectSlot" })[0],
    );
    await user.click(
      screen.getByRole("button", {
        name: "confirmBooking",
      }),
    );

    expect(
      await screen.findByText(
        "notices.idempotencyConflict.title",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "retrySameAttempt",
      }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getAllByRole("button", { name: "selectSlot" })[0],
    );

    expect(
      apiMocks.generateBookingIdempotencyKey,
    ).toHaveBeenCalledTimes(2);
  });

  it("stops the flow when Track A reports that the teacher is no longer public", async () => {
    apiMocks
      .getPublicTeacherDetail
      .mockRejectedValueOnce(
        new BookingApiError(
          "TEACHER_NOT_FOUND",
          404,
        ),
      );

    renderBooking();

    expect(
      await screen.findByText(
        "teacherUnavailableTitle",
      ),
    ).toBeInTheDocument();
  });

  it("keeps Persian and English booking catalogs structurally aligned", () => {
    expect(
      JSON.stringify(
        Object.keys(
          enMessages.StudentBooking,
        ).sort(),
      ),
    ).toBe(
      JSON.stringify(
        Object.keys(
          faMessages.StudentBooking,
        ).sort(),
      ),
    );

    expect(
      Object.keys(
        enMessages.StudentBooking.notices,
      ).sort(),
    ).toEqual(
      Object.keys(
        faMessages.StudentBooking.notices,
      ).sort(),
    );
  });
});
