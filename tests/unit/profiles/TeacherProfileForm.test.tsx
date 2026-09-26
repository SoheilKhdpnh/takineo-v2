// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TeacherProfileForm } from "@/components/profiles/TeacherProfileForm";
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

const longBio =
  "I help intermediate learners speak clearly in 15-minute sessions. We focus on real workplace conversations, correction that does not interrupt flow, and vocabulary you can reuse the same week.";

function renderForm(
  initialValue?: Partial<{
    headline: string;
    bio: string;
    experienceYears: number | null;
    nativeLanguage: "fa";
    timezone: "Asia/Tehran";
  }>,
) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <TeacherProfileForm
        displayName="Sasan"
        image={null}
        initialValue={{
          headline: "",
          bio: "",
          experienceYears: 4,
          nativeLanguage: "fa",
          timezone: "Asia/Tehran",
          ...initialValue,
        }}
      />
    </NextIntlClientProvider>,
  );
}

describe("TeacherProfileForm", () => {
  it("uses a sectioned workspace with a live public-profile preview", async () => {
    const user = userEvent.setup();
    renderForm();

    expect(
      screen.getByRole("heading", { name: enMessages.TeacherProfile.title }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: enMessages.TeacherProfile.navLabel }),
    ).toBeInTheDocument();
    expect(screen.getByText(enMessages.TeacherProfile.previewTitle)).toBeInTheDocument();
    expect(
      screen.getByText(enMessages.TeacherProfile.previewHeadlineEmpty),
    ).toBeInTheDocument();

    await user.type(
      screen.getByLabelText(enMessages.TeacherProfile.headline),
      "English speaking coach for busy professionals",
    );

    expect(
      within(screen.getByTestId("profile-preview")).getByText(
        "English speaking coach for busy professionals",
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText(enMessages.ProfileCommon.studentsSeeThis).length).toBeGreaterThan(0);
  });

  it("saves the existing teacher profile payload", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    vi.stubGlobal("fetch", fetchMock);
    renderForm({
      headline: "English speaking coach for busy professionals",
      bio: longBio,
    });

    await user.click(
      screen.getByRole("button", { name: enMessages.ProfileCommon.save }),
    );

    expect(fetchMock).toHaveBeenCalledWith("/api/profile/teacher", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        headline: "English speaking coach for busy professionals",
        bio: longBio,
        experienceYears: 4,
        nativeLanguage: "fa",
        teachingLanguage: "en",
        timezone: "Asia/Tehran",
      }),
    });
    expect(routerMocks.replace).toHaveBeenCalledWith("/teacher/dashboard");
  });

  it("keeps teacher profile copy in English and Persian parity", () => {
    expect(Object.keys(faMessages.TeacherProfile).sort()).toEqual(
      Object.keys(enMessages.TeacherProfile).sort(),
    );
  });
});
