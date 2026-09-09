import {
  expect,
  test,
} from "@playwright/test";

import {
  BOOKING_SLOT_MINUTES,
} from "@/lib/domain/booking-policy";
import {
  instantToIranDateKey,
  instantToIranMinuteOfDay,
} from "@/lib/time/iran-booking-time";
import {
  e2ePersonas,
  signInThroughUi,
} from "@/tests/e2e/support/personas";

function getFutureBookableSlot() {
  const target =
    new Date(
      Date.now() +
        24 * 60 * 60 * 1000,
    );

  const startMinute =
    Math.floor(
      instantToIranMinuteOfDay(
        target,
      ) /
        BOOKING_SLOT_MINUTES,
    ) *
    BOOKING_SLOT_MINUTES;

  return {
    date:
      instantToIranDateKey(
        target,
      ),
    startMinute,
    endMinute:
      startMinute +
      BOOKING_SLOT_MINUTES,
  };
}

test("teacher availability flows through discovery, booking, cancellation, and a separate rebooking", async ({
  page,
  browser,
}) => {
  test.setTimeout(240_000);

  const slot =
    getFutureBookableSlot();

  await signInThroughUi(
    page,
    e2ePersonas.approvedTeacher,
    "en",
  );
  await page.goto(
    "/en/teacher/dashboard",
  );

  await expect(
    page.getByRole("heading", {
      name:
        "Publish your speaking availability",
    }),
  ).toBeVisible();

  const availabilityEditor =
    page.getByRole("region", {
      name:
        "Open or block a specific date",
    });

  await availabilityEditor
    .getByLabel("Change type")
    .selectOption("AVAILABLE");
  await availabilityEditor
    .getByRole("textbox", {
      name: "Date",
    })
    .fill(slot.date);
  await availabilityEditor
    .getByLabel("Start")
    .selectOption(
      String(
        slot.startMinute,
      ),
    );
  await availabilityEditor
    .getByLabel("End")
    .selectOption(
      String(
        slot.endMinute,
      ),
    );
  await availabilityEditor
    .getByLabel(
      "Note (optional)",
    )
    .fill(
      "Wave 2 browser journey opening",
    );

  const availabilityResponse =
    page.waitForResponse(
      (response) =>
        response.url().endsWith(
          "/api/profile/teacher/availability",
        ) &&
        response
          .request()
          .method() ===
          "POST",
    );

  await availabilityEditor
    .getByRole("button", {
      name:
        "Add one-off change",
    })
    .click();

  await expect(
    (
      await availabilityResponse
    ).status(),
  ).toBe(201);

  await expect(
    page.getByText(
      "The one-off availability change was created and the schedule was refreshed.",
    ),
  ).toBeVisible();

  const studentContext =
    await browser.newContext();

  try {
    const studentPage =
      await studentContext.newPage();

    await signInThroughUi(
      studentPage,
      e2ePersonas.student,
      "en",
    );
    await studentPage.goto(
      "/en/student/dashboard",
    );

    const discoveryCard =
      studentPage
        .getByRole("article")
        .filter({
          hasText:
            e2ePersonas
              .approvedTeacher
              .name,
        })
        .last();

    await expect(
      discoveryCard,
    ).toBeVisible();

    await discoveryCard
      .getByRole("link", {
        name:
          "View profile & book",
      })
      .click();

    await expect(
      studentPage,
    ).toHaveURL(
      /\/en\/teachers\/[^/?#]+\/?$/,
    );
    await expect(
      studentPage.getByRole(
        "heading",
        {
          level: 1,
          name:
            e2ePersonas
              .approvedTeacher
              .name,
        },
      ),
    ).toBeVisible();

    const firstSlot =
      studentPage
        .getByRole("button", {
          name: /^Select /,
        })
        .first();

    await expect(
      firstSlot,
    ).toBeEnabled();
    await firstSlot.focus();
    await studentPage.keyboard.press(
      "Enter",
    );
    await expect(
      firstSlot,
    ).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    const firstBookingResponse =
      studentPage.waitForResponse(
        (response) =>
          response.url().endsWith(
            "/api/sessions",
          ) &&
          response
            .request()
            .method() ===
            "POST",
      );

    await studentPage
      .getByRole("button", {
        name:
          "Confirm this booking",
      })
      .click();

    const firstBooking =
      await firstBookingResponse;

    expect(
      firstBooking.status(),
    ).toBe(200);

    const firstBookingPayload =
      firstBooking
        .request()
        .postDataJSON() as Record<
          string,
          unknown
        >;

    await expect(
      studentPage.getByText(
        "Your speaking session is booked",
      ),
    ).toBeVisible();

    await studentPage
      .getByRole("link", {
        name:
          "View upcoming sessions",
      })
      .click();

    await expect(
      studentPage,
    ).toHaveURL(
      /\/en\/student\/dashboard$/,
    );

    const upcomingPanel =
      studentPage.locator(
        'section[aria-labelledby="upcoming-sessions-heading"]',
      );

    const bookedSession =
      upcomingPanel
        .getByRole("article")
        .filter({
          hasText:
            e2ePersonas
              .approvedTeacher
              .name,
        });

    await expect(
      bookedSession,
    ).toBeVisible();

    await bookedSession
      .getByRole("button", {
        name:
          "Cancel session",
      })
      .click();

    const cancellationResponse =
      studentPage.waitForResponse(
        (response) =>
          /\/api\/sessions\/[^/]+\/cancel$/.test(
            new URL(
              response.url(),
            ).pathname,
          ) &&
          response
            .request()
            .method() ===
            "POST",
      );

    await bookedSession
      .getByRole("button", {
        name:
          "Confirm cancellation",
      })
      .click();

    expect(
      (
        await cancellationResponse
      ).status(),
    ).toBe(200);

    await expect(
      upcomingPanel.getByText(
        "The session was cancelled successfully.",
      ),
    ).toBeVisible();
    await expect(
      bookedSession,
    ).toHaveCount(0);

    await expect(
      upcomingPanel,
    ).toContainText(
      "The cancelled session stays cancelled. Choosing another time starts a separate new booking.",
    );

    await upcomingPanel
      .getByRole("link", {
        name:
          "Choose another time with this teacher",
      })
      .click();

    await expect(
      studentPage,
    ).toHaveURL(
      /\/en\/teachers\/[^/?#]+\/?$/,
    );

    const replacementSlot =
      studentPage
        .getByRole("button", {
          name: /^Select /,
        })
        .first();

    await expect(
      replacementSlot,
    ).toBeEnabled();
    await replacementSlot.click();

    const replacementResponse =
      studentPage.waitForResponse(
        (response) =>
          response.url().endsWith(
            "/api/sessions",
          ) &&
          response
            .request()
            .method() ===
            "POST",
      );

    await studentPage
      .getByRole("button", {
        name:
          "Confirm this booking",
      })
      .click();

    const replacementBooking =
      await replacementResponse;

    expect(
      replacementBooking.status(),
    ).toBe(200);

    const replacementPayload =
      replacementBooking
        .request()
        .postDataJSON() as Record<
          string,
          unknown
        >;

    expect(
      replacementPayload.teacherProfileId,
    ).toBe(
      firstBookingPayload.teacherProfileId,
    );
    expect(
      replacementPayload.startAt,
    ).toBe(
      firstBookingPayload.startAt,
    );
    expect(
      replacementPayload.idempotencyKey,
    ).not.toBe(
      firstBookingPayload.idempotencyKey,
    );

    await expect(
      studentPage.getByText(
        "Your speaking session is booked",
      ),
    ).toBeVisible();
  } finally {
    await studentContext.close();
  }
});
