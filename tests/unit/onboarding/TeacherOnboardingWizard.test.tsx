// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";

function lookup(source: unknown, key: string) {
  return key.split(".").reduce<unknown>((current, part) => {
    if (current && typeof current === "object" && part in current) {
      return (current as Record<string, unknown>)[part];
    }

    return undefined;
  }, source);
}

vi.mock("next-intl", () => ({
  useTranslations: (namespace: "TeacherOnboarding" | "ProfileCommon") => {
    const table =
      namespace === "ProfileCommon"
        ? enMessages.ProfileCommon
        : enMessages.TeacherOnboarding;

    return (key: string, values?: Record<string, string | number>) => {
      const raw = lookup(table, key);
      let template = typeof raw === "string" ? raw : key;

      if (values) {
        for (const [name, value] of Object.entries(values)) {
          template = template.replaceAll(`{${name}}`, String(value));
        }
      }

      return template;
    };
  },
}));

const router = {
  push: vi.fn(),
  refresh: vi.fn(),
};

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => router,
}));

const updateUser = vi.fn();

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    updateUser: (...args: unknown[]) => updateUser(...args),
  },
}));

import { TeacherOnboardingWizard } from "@/components/onboarding/TeacherOnboardingWizard";
import { CERTIFICATE_OPTIONS } from "@/lib/onboarding/teacher-draft";

const copy = enMessages.TeacherOnboarding;
const longText =
  "I have taught English speaking for several years and I keep the lesson focused on real conversation.";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  window.localStorage.clear();
  updateUser.mockReset();
  router.push.mockReset();
  router.refresh.mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    }),
  );
  vi.stubGlobal(
    "FileReader",
    class {
      result = "data:image/png;base64,cGhvdG8=";
      onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
      readAsDataURL() {
        this.onload?.({} as ProgressEvent<FileReader>);
      }
    },
  );
});

describe("TeacherOnboardingWizard", () => {
  it("renders every split step in order without duplicating panels", async () => {
    const user = userEvent.setup({ delay: null });
    render(<TeacherOnboardingWizard initialName="Soheil" />);

    expect(screen.getByRole("heading", { name: copy.aboutTitle })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: copy.photoTitle })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: copy.videoTitle })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: copy.saveAndContinue }));
    expect(screen.getByRole("heading", { name: copy.photoTitle })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: copy.aboutTitle })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: copy.certTitle })).not.toBeInTheDocument();

    const photo = new File(["photo"], "soheil.png", { type: "image/png" });
    await user.upload(screen.getByLabelText(copy.uploadPhoto), photo);
    await waitFor(() => {
      expect(document.querySelector("img")).not.toBeNull();
    });
    await user.click(screen.getByRole("button", { name: copy.saveAndContinue }));

    expect(screen.getByRole("heading", { name: copy.certTitle })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: copy.eduTitle })).not.toBeInTheDocument();
    await user.selectOptions(
      screen.getByLabelText(copy.certificate),
      CERTIFICATE_OPTIONS[0],
    );
    await user.click(screen.getByRole("button", { name: copy.saveAndContinue }));

    expect(screen.getByRole("heading", { name: copy.eduTitle })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: copy.descTitle })).not.toBeInTheDocument();
    await user.type(screen.getByPlaceholderText(copy.universityPlaceholder), "University of Tehran");
    await user.type(screen.getByPlaceholderText(copy.degreePlaceholder), "Bachelor of English");
    await user.selectOptions(screen.getByLabelText(copy.degreeType), "bachelor");
    await user.click(screen.getByRole("button", { name: copy.saveAndContinue }));

    expect(screen.getByRole("heading", { name: copy.descTitle })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: copy.videoTitle })).not.toBeInTheDocument();
    await user.type(screen.getByPlaceholderText(copy.descSection1Placeholder), longText);
    await user.click(screen.getByRole("button", { name: copy.descContinue }));
    await user.type(screen.getByPlaceholderText(copy.descSection2Placeholder), longText);
    await user.click(screen.getByRole("button", { name: copy.descContinue }));
    await user.type(screen.getByPlaceholderText(copy.descSection3Placeholder), longText);
    await user.click(screen.getByRole("button", { name: copy.descContinue }));
    await user.type(
      screen.getByPlaceholderText(copy.descSection4Placeholder),
      "English speaking coach",
    );
    await user.click(screen.getByRole("button", { name: copy.saveAndContinue }));

    expect(screen.getByRole("heading", { name: copy.videoTitle })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: copy.availabilityTitle })).not.toBeInTheDocument();
    await user.type(
      screen.getByPlaceholderText("https://www.aparat.com/v/..."),
      "https://www.aparat.com/v/talkinu",
    );
    await user.click(screen.getByRole("button", { name: copy.saveAndContinue }));

    expect(screen.getByRole("heading", { name: copy.availabilityTitle })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: copy.pricingTitle })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: copy.saveAndContinue }));

    expect(screen.getByRole("heading", { name: copy.pricingTitle })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: copy.aboutTitle })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: copy.finish })).toBeInTheDocument();
  }, 30000);
});
