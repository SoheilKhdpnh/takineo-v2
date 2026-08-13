// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

import { AdminReviewDecision } from "@/components/admin/AdminReviewDecision";

const applicationId = "ck12345678901234567890123";
const guard = {
  reviewCycle: 2,
  profileRevision: 3,
  videoId: "ck22345678901234567890123",
  videoRevision: 4,
};

const copy = {
  description: "Decide against the current snapshot.",
  unavailable: "Decision unavailable.",
  approve: "Approve application",
  reject: "Reject application",
  approveHeading: "Confirm approval",
  approveDescription: "Approve the profile and video.",
  approveUnavailable: "Approval unavailable.",
  approveConfirm: "Confirm approval",
  rejectHeading: "Record a rejection",
  rejectDescription: "Choose what failed review.",
  rejectTargetLabel: "Reject",
  rejectProfile: "Profile only",
  rejectVideo: "Video only",
  rejectBoth: "Profile and video",
  profileReasonLabel: "Profile rejection reason",
  profileReasonPlaceholder: "Profile reason",
  videoReasonLabel: "Video rejection reason",
  videoReasonPlaceholder: "Video reason",
  reasonHint: "Specific reasons required.",
  targetRequired: "Choose a target.",
  profileReasonRequired: "Profile reason required.",
  videoReasonRequired: "Video reason required.",
  submitRejection: "Confirm rejection",
  cancel: "Cancel",
  submitting: "Saving decision…",
  approveSuccess: "Application approved.",
  rejectSuccess: "Application rejected.",
  unauthorized: "Session unavailable.",
  forbidden: "Admin access revoked.",
  conflict: "Review changed.",
  invalidRequest: "Invalid decision.",
  genericError: "Decision failed.",
  reload: "Reload review",
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

describe("AdminReviewDecision", () => {
  it("renders no mutation controls when the server-provided snapshot guard is unavailable", () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    render(
      <AdminReviewDecision
        applicationId={applicationId}
        guard={null}
        canApprove={false}
        copy={copy}
      />,
    );

    expect(screen.getByText(copy.unavailable)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires a second approval confirmation and posts the exact stale-review guard once", async () => {
    let resolveFetch!: (value: Response) => void;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    render(
      <AdminReviewDecision
        applicationId={applicationId}
        guard={guard}
        canApprove
        copy={copy}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: copy.approve }));
    expect(fetchMock).not.toHaveBeenCalled();

    const confirm = screen.getByRole("button", { name: copy.approveConfirm });
    fireEvent.click(confirm);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: copy.submitting })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: copy.submitting }));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      `/api/admin/teacher-applications/${applicationId}/approve`,
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
    expect(JSON.parse(String(init?.body))).toEqual(guard);

    resolveFetch(jsonResponse({ application: { id: applicationId } }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      copy.approveSuccess,
    );
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("requires targeted rejection reasons and submits only the selected reasons", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ application: { id: applicationId } }));

    render(
      <AdminReviewDecision
        applicationId={applicationId}
        guard={guard}
        canApprove
        copy={copy}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: copy.reject }));
    fireEvent.click(screen.getByRole("button", { name: copy.submitRejection }));
    expect(screen.getByRole("alert")).toHaveTextContent(copy.targetRequired);
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("radio", { name: copy.rejectBoth }));
    fireEvent.change(screen.getByLabelText(copy.profileReasonLabel), {
      target: { value: "Profile needs clearer teaching experience." },
    });
    fireEvent.click(screen.getByRole("button", { name: copy.submitRejection }));
    expect(screen.getByRole("alert")).toHaveTextContent(copy.videoReasonRequired);
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(copy.videoReasonLabel), {
      target: { value: "Video audio is not clear enough for review." },
    });
    fireEvent.click(screen.getByRole("button", { name: copy.submitRejection }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      `/api/admin/teacher-applications/${applicationId}/reject`,
    );
    expect(JSON.parse(String(init?.body))).toEqual({
      ...guard,
      target: "BOTH",
      profileReason: "Profile needs clearer teaching experience.",
      videoReason: "Video audio is not clear enough for review.",
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      copy.rejectSuccess,
    );
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("keeps rejection available when approval prerequisites are not met", () => {
    render(
      <AdminReviewDecision
        applicationId={applicationId}
        guard={guard}
        canApprove={false}
        copy={copy}
      />,
    );

    expect(screen.getByRole("button", { name: copy.approve })).toBeDisabled();
    expect(screen.getByText(copy.approveUnavailable)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: copy.reject })).toBeEnabled();
  });

  it("treats a 409 stale-review response as a conflict and never refreshes as success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ error: "REVIEW_STATE_CONFLICT" }, 409),
    );

    render(
      <AdminReviewDecision
        applicationId={applicationId}
        guard={guard}
        canApprove
        copy={copy}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: copy.approve }));
    fireEvent.click(screen.getByRole("button", { name: copy.approveConfirm }));

    expect(await screen.findByRole("alert")).toHaveTextContent(copy.conflict);
    expect(
      screen.getByRole("button", { name: copy.approveConfirm }),
    ).toBeDisabled();
    expect(mocks.refresh).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: copy.reload }));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });
});
