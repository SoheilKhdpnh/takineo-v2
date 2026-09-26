// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StudentProfileForm } from "@/components/profiles/StudentProfileForm";
import enMessages from "@/messages/en.json";
import faMessages from "@/messages/fa.json";

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => routerMocks,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  routerMocks.push.mockReset();
  routerMocks.replace.mockReset();
  routerMocks.refresh.mockReset();
});

function renderForm() {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <StudentProfileForm
        displayName="Leila"
        image={null}
        initialValue={{
          englishLevel: null,
          learningGoal: "",
          nativeLanguage: "fa",
          timezone: "Asia/Tehran",
        }}
      />
    </NextIntlClientProvider>,
  );
}

describe("StudentProfileForm", () => {
  it("uses a sectioned workspace with a live preview of the learner card", async () => {
    const user = userEvent.setup();
    renderForm();

    expect(
      screen.getByRole("heading", { name: enMessages.StudentProfile.title }),
    ).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: enMessages.StudentProfile.navLabel })).toBeInTheDocument();
    expect(screen.getByText(enMessages.StudentProfile.previewTitle)).toBeInTheDocument();
    expect(screen.getByText(enMessages.StudentProfile.previewLevelEmpty)).toBeInTheDocument();

    await user.click(screen.getByText(enMessages.StudentProfile.levelB1Name));
    await user.type(
      screen.getByLabelText(enMessages.StudentProfile.learningGoal),
      "I want to speak in meetings with more confidence.",
    );

    const preview = screen.getByTestId("profile-preview");
    expect(
      within(preview).getByText(
        enMessages.StudentProfile.previewLevel
          .replace("{level}", "B1")
          .replace("{name}", enMessages.StudentProfile.levelB1Name),
      ),
    ).toBeInTheDocument();
    expect(
      within(preview).getByText("I want to speak in meetings with more confidence."),
    ).toBeInTheDocument();
  });

  it("saves the existing student profile payload", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    vi.stubGlobal("fetch", fetchMock);
    renderForm();

    await user.click(screen.getByText(enMessages.StudentProfile.levelB2Name));
    await user.type(
      screen.getByLabelText(enMessages.StudentProfile.learningGoal),
      "I want clearer pronunciation for work calls.",
    );
    await user.click(
      screen.getByRole("button", { name: enMessages.ProfileCommon.save }),
    );

    expect(fetchMock).toHaveBeenCalledWith("/api/profile/student", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        englishLevel: "B2",
        learningGoal: "I want clearer pronunciation for work calls.",
        nativeLanguage: "fa",
        timezone: "Asia/Tehran",
      }),
    });
    expect(routerMocks.replace).toHaveBeenCalledWith("/student/dashboard");
  });

  it("keeps student profile copy in English and Persian parity", () => {
    expect(Object.keys(faMessages.StudentProfile).sort()).toEqual(
      Object.keys(enMessages.StudentProfile).sort(),
    );
    expect(Object.keys(faMessages.ProfileCommon).sort()).toEqual(
      Object.keys(enMessages.ProfileCommon).sort(),
    );
    expect(Object.keys(faMessages.ProfileCommon.timezoneLabels).sort()).toEqual(
      Object.keys(enMessages.ProfileCommon.timezoneLabels).sort(),
    );
  });
});
