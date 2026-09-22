// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";

const copy = enMessages.Auth;

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const t = (key: string, values?: { username?: string }) => {
      const template = String((copy as Record<string, string>)[key] ?? key);
      return template.replace("{username}", values?.username ?? "");
    };
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

const signInUsername = vi.fn();

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    signIn: {
      username: (...args: unknown[]) => signInUsername(...args),
    },
  },
}));

import { SignInForm } from "@/components/auth/SignInForm";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

beforeEach(() => {
  signInUsername.mockReset();
  router.push.mockReset();
  router.refresh.mockReset();
  window.localStorage.clear();
});

describe("SignInForm", () => {
  it("does not ask for terms of use on sign in", async () => {
    const user = userEvent.setup();
    render(<SignInForm />);

    await user.type(screen.getByLabelText(copy.username), "soheil_n");
    await user.type(screen.getByLabelText(copy.password), "password12");

    expect(screen.queryByRole("checkbox", { name: /Talkinu Terms of Use/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: copy.signIn })).toBeEnabled();
    expect(screen.getByRole("button", { name: copy.showPassword })).toHaveClass("right-2");
  });

  it("signs in with username and shows a welcome message", async () => {
    const user = userEvent.setup();
    signInUsername.mockResolvedValue({ error: null });
    render(<SignInForm />);

    await user.type(screen.getByLabelText(copy.username), "soheil_n");
    await user.type(screen.getByLabelText(copy.password), "password12");
    await user.click(screen.getByRole("button", { name: copy.signIn }));

    await waitFor(() => {
      expect(signInUsername).toHaveBeenCalledWith({
        username: "soheil_n",
        password: "password12",
        rememberMe: false,
      });
    });

    expect(screen.getByText(copy.signInSuccessTitle)).toBeInTheDocument();
    expect(
      screen.getByText("Welcome, soheil_n. We are taking you into Talkinu."),
    ).toBeInTheDocument();
  });
});
