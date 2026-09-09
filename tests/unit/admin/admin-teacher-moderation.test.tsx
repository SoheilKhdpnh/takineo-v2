// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

import { AdminTeacherModeration } from "@/components/admin/AdminTeacherModeration";

const applicationId = "ck12345678901234567890123";

const copy = {
  description: "Moderation is separate from review.",
  restricted: "Super-admin access required.",
  unavailable: "No moderation transition available.",
  suspendAction: "Suspend teacher",
  reinstateAction: "Reinstate teacher",
  suspendHeading: "Confirm teacher suspension",
  suspendDescription: "Suspension description.",
  reinstateHeading: "Confirm teacher reinstatement",
  reinstateDescription: "Reinstatement description.",
  reasonLabel: "Moderation reason",
  suspendReasonPlaceholder: "Suspension reason",
  reinstateReasonPlaceholder: "Reinstatement reason",
  reasonHint: "Specific reason required.",
  reasonRequired: "Moderation reason required.",
  suspendConfirm: "Confirm suspension",
  reinstateConfirm: "Confirm reinstatement",
  cancel: "Cancel",
  submitting: "Saving moderation change…",
  suspendSuccess: "Teacher suspended.",
  reinstateSuccess: "Teacher reinstated.",
  unauthorized: "Session unavailable.",
  forbidden: "Moderation forbidden.",
  conflict: "Teacher state changed.",
  invalidRequest: "Invalid moderation request.",
  genericError: "Moderation failed.",
  reload: "Reload teacher state",
};

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

beforeEach(() => {
  vi.restoreAllMocks();
  mocks.refresh.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("AdminTeacherModeration", () => {
  it("renders no mutation control for an administrator without teacher-moderation capability", () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    render(
      <AdminTeacherModeration
        applicationId={applicationId}
        canModerateTeachers={false}
        guard={{ action: "SUSPEND", reviewCycle: 2 }}
        copy={copy}
      />,
    );

    expect(screen.getByText(copy.restricted)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires a reason and a second confirmation before suspending", async () => {
    let resolveFetch!: (value: Response) => void;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    render(
      <AdminTeacherModeration
        applicationId={applicationId}
        canModerateTeachers
        guard={{ action: "SUSPEND", reviewCycle: 2 }}
        copy={copy}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: copy.suspendAction }));
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: copy.suspendConfirm }));
    expect(screen.getByRole("alert")).toHaveTextContent(copy.reasonRequired);
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(copy.reasonLabel), {
      target: { value: "  Repeated policy violation during active teaching.  " },
    });
    fireEvent.click(screen.getByRole("button", { name: copy.suspendConfirm }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      `/api/admin/teacher-applications/${applicationId}/moderation`,
    );
    expect(init).toMatchObject({
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      action: "SUSPEND",
      reviewCycle: 2,
      reason: "Repeated policy violation during active teaching.",
    });
    expect(
      screen.getByRole("button", { name: copy.submitting }),
    ).toBeDisabled();

    resolveFetch(jsonResponse({ application: { id: applicationId } }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      copy.suspendSuccess,
    );
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("submits the exact reinstate transition against the current review cycle", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ application: { id: applicationId } }));

    render(
      <AdminTeacherModeration
        applicationId={applicationId}
        canModerateTeachers
        guard={{ action: "REINSTATE", reviewCycle: 7 }}
        copy={copy}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: copy.reinstateAction }));
    fireEvent.change(screen.getByLabelText(copy.reasonLabel), {
      target: { value: "Eligibility restored after administrative review." },
    });
    fireEvent.click(screen.getByRole("button", { name: copy.reinstateConfirm }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      action: "REINSTATE",
      reviewCycle: 7,
      reason: "Eligibility restored after administrative review.",
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      copy.reinstateSuccess,
    );
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("keeps validation failures editable instead of forcing a stale-state reload", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ error: "INVALID_REQUEST" }, 400),
    );

    render(
      <AdminTeacherModeration
        applicationId={applicationId}
        canModerateTeachers
        guard={{ action: "SUSPEND", reviewCycle: 2 }}
        copy={copy}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: copy.suspendAction }));
    fireEvent.change(screen.getByLabelText(copy.reasonLabel), {
      target: { value: "Reason that the server rejects for validation." },
    });
    fireEvent.click(screen.getByRole("button", { name: copy.suspendConfirm }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      copy.invalidRequest,
    );
    expect(screen.getByLabelText(copy.reasonLabel)).toBeEnabled();
    expect(
      screen.getByRole("button", { name: copy.suspendConfirm }),
    ).toBeEnabled();
    expect(screen.queryByRole("button", { name: copy.reload })).not.toBeInTheDocument();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("locks a stale moderation editor after a 409 until the administrator reloads", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ error: "REVIEW_STATE_CONFLICT" }, 409),
    );

    render(
      <AdminTeacherModeration
        applicationId={applicationId}
        canModerateTeachers
        guard={{ action: "SUSPEND", reviewCycle: 2 }}
        copy={copy}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: copy.suspendAction }));
    fireEvent.change(screen.getByLabelText(copy.reasonLabel), {
      target: { value: "Teacher state requires suspension." },
    });
    fireEvent.click(screen.getByRole("button", { name: copy.suspendConfirm }));

    expect(await screen.findByRole("alert")).toHaveTextContent(copy.conflict);
    expect(
      screen.getByRole("button", { name: copy.suspendConfirm }),
    ).toBeDisabled();
    expect(mocks.refresh).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: copy.reload }));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });
});
