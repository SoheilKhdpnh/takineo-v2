// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthoritativeSlotPicker } from "@/components/booking/AuthoritativeSlotPicker";
import type { BookableSlot } from "@/components/booking/student-booking-api";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () =>
    (key: string, values?: Record<string, unknown>) => {
      if (key === "slotCount" && typeof values?.count === "number") {
        return `${values.count} times`;
      }

      if (key === "selectSlot") {
        return `Select ${String(values?.time ?? "")}`;
      }

      if (key === "selectDate") {
        return `Choose ${String(values?.date ?? "")}`;
      }

      if (key === "slotsForDate") {
        return `slots-${String(values?.date ?? "")}`;
      }

      return key;
    },
}));

afterEach(() => {
  cleanup();
});

function slot(overrides: Partial<BookableSlot> & Pick<BookableSlot, "date" | "startAt" | "startMinute">): BookableSlot {
  return {
    endMinute: overrides.startMinute + 15,
    endAt: overrides.startAt,
    ...overrides,
  };
}

const morning = slot({
  date: "2026-08-20",
  startMinute: 540,
  startAt: "2026-08-20T05:30:00.000Z",
  endAt: "2026-08-20T05:45:00.000Z",
});

const afternoon = slot({
  date: "2026-08-20",
  startMinute: 780,
  startAt: "2026-08-20T08:00:00.000Z",
  endAt: "2026-08-20T08:15:00.000Z",
});

const nextDay = slot({
  date: "2026-08-22",
  startMinute: 600,
  startAt: "2026-08-22T06:30:00.000Z",
  endAt: "2026-08-22T06:45:00.000Z",
});

describe("AuthoritativeSlotPicker", () => {
  it("shows times for one selected day instead of listing every opening at once", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <AuthoritativeSlotPicker
        slots={[morning, afternoon, nextDay]}
        selectedStartAt={null}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByText("chooseDay")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "morning" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "afternoon" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "evening" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Select / })).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "afternoon" }));
    expect(screen.getAllByRole("button", { name: /^Select / })).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: /Choose .*22/ }));

    expect(screen.getAllByRole("button", { name: /^Select / })).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: /^Select / }));
    expect(onSelect).toHaveBeenCalledWith(nextDay);
  });

  it("pages later available days instead of stacking every free day", async () => {
    const user = userEvent.setup();
    const manyDays = Array.from({ length: 8 }, (_, index) => {
      const day = 20 + index;
      const date = `2026-08-${day}`;
      return slot({
        date,
        startMinute: 540,
        startAt: `2026-08-${day}T05:30:00.000Z`,
        endAt: `2026-08-${day}T05:45:00.000Z`,
      });
    });

    render(
      <AuthoritativeSlotPicker
        slots={manyDays}
        selectedStartAt={null}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "nextDays" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /Choose .*27/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "nextDays" }));

    expect(screen.getByRole("button", { name: /Choose .*27/ })).toBeInTheDocument();
  });
});
