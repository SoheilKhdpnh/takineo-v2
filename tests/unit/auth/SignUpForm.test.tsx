// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";
import faMessages from "@/messages/fa.json";

const copy = enMessages.Auth;

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const t = (key: keyof typeof copy) => copy[key];
    t.rich = (
      key: keyof typeof copy,
      handlers: Record<string, (chunks: ReactNode) => ReactNode>,
    ) => {
      const template = String(copy[key]);
      const match = template.match(/^(.*)<terms>(.*)<\/terms>(.*)$/);

      if (!match || !handlers.terms) {
        return template;
      }

      return (
        <>
          {match[1]}
          {handlers.terms(match[2])}
          {match[3]}
        </>
      );
    };
    return t;
  },
}));

const router = {
  push: vi.fn(),
  refresh: vi.fn(),
};

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
  }: {
    href: string;
    children: ReactNode;
  }) => <a href={href}>{children}</a>,
  useRouter: () => router,
}));

const signUpEmail = vi.fn();

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    signUp: {
      email: (...args: unknown[]) => signUpEmail(...args),
    },
  },
}));

import { SignUpForm } from "@/components/auth/SignUpForm";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

beforeEach(() => {
  signUpEmail.mockReset();
  router.push.mockReset();
  router.refresh.mockReset();
  window.localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      json: async () => ({ available: true }),
    }),
  );
});

describe("SignUpForm", () => {
  it("keeps Persian and English auth copy in structural parity", () => {
    expect(Object.keys(faMessages.Auth).sort()).toEqual(
      Object.keys(enMessages.Auth).sort(),
    );
    expect(Object.keys(faMessages.Terms).sort()).toEqual(
      Object.keys(enMessages.Terms).sort(),
    );
    expect(Object.keys(faMessages.Terms.sections).sort()).toEqual(
      Object.keys(enMessages.Terms.sections).sort(),
    );
  });

  it("does not submit until the terms of use are accepted", async () => {
    const user = userEvent.setup();
    render(<SignUpForm />);

    await user.type(screen.getByLabelText(copy.username), "soheil_n");
    await user.type(screen.getByLabelText(copy.email), "soheil@example.com");
    await user.type(screen.getByLabelText(copy.password), "Password123");

    expect(screen.getByRole("button", { name: copy.showPassword })).toHaveClass("right-2");
    expect(screen.getByRole("button", { name: copy.createAccount })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: copy.createAccount }));
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  it("shows that an exclusive username is already taken", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          available: false,
          error: "USERNAME_TAKEN",
        }),
      }),
    );

    const user = userEvent.setup();
    render(<SignUpForm />);

    await user.type(screen.getByLabelText(copy.username), "taken_user");

    await waitFor(() => {
      expect(screen.getByText(copy.usernameTaken)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: copy.createAccount })).toBeDisabled();
  });

  it("switches the box to Iranian phone signup with +98 and a national-number example", async () => {
    const user = userEvent.setup();
    render(<SignUpForm />);

    await user.click(
      screen.getByRole("button", { name: copy.signUpWithPhone }),
    );

    expect(screen.queryByLabelText(copy.email)).not.toBeInTheDocument();
    expect(screen.getByLabelText(copy.phoneLabel)).toHaveAttribute(
      "placeholder",
      "9142928321",
    );
    expect(screen.getByText("+98")).toBeInTheDocument();
    expect(screen.getByText(copy.phoneHint)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: copy.signUpWithEmail }),
    ).toBeInTheDocument();
  });

  it("creates an account after terms are accepted and can remember the identifier", async () => {
    signUpEmail.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const user = userEvent.setup();
    render(<SignUpForm />);

    await user.type(screen.getByLabelText(copy.username), "soheil_n");
    await user.type(screen.getByLabelText(copy.email), "soheil@example.com");
    await user.type(screen.getByLabelText(copy.password), "Password123");
    await waitFor(() => {
      expect(screen.getByText(copy.usernameAvailable)).toBeInTheDocument();
    });
    await user.click(
      screen.getByRole("checkbox", { name: /Talkinu Terms of Use/ }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: new RegExp(copy.rememberMe) }),
    );
    await user.click(screen.getByRole("button", { name: copy.createAccount }));

    await waitFor(() => {
      expect(signUpEmail).toHaveBeenCalled();
    });

    expect(signUpEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        username: "soheil_n",
        email: "soheil@example.com",
        termsAccepted: true,
        rememberMe: true,
      }),
    );
    expect(window.localStorage.getItem("talkinu.auth.remembered-signup")).toContain(
      "soheil_n",
    );
  });
});
