import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  runAdminOperatorCli,
  type AdminOperatorDependencies,
} from "@/scripts/admin-operator-cli";

function user(
  id: string,
  email = `${id}@example.test`,
  adminPermission: "REVIEWER" | "SUPER_ADMIN" | null = null,
) {
  return {
    id,
    name: id,
    email,
    accountStatus: "ACTIVE" as const,
    adminPermission,
  };
}

function dependencies() {
  const write = vi.fn();
  const resolveUser = vi.fn(async (identifier: { userId?: string; email?: string }) => {
    const id = identifier.userId ?? identifier.email!.split("@")[0]!;
    return user(id, identifier.email ?? `${id}@example.test`);
  });
  const bootstrapInitialSuperAdmin = vi.fn(async () => ({}));
  const setAdministrativeAccess = vi.fn(async () => ({}));
  const setAccountStatus = vi.fn(async () => ({}));

  return {
    deps: {
      resolveUser,
      bootstrapInitialSuperAdmin,
      setAdministrativeAccess,
      setAccountStatus,
      write,
    } satisfies AdminOperatorDependencies,
    write,
    resolveUser,
    bootstrapInitialSuperAdmin,
    setAdministrativeAccess,
    setAccountStatus,
  };
}

describe("administrative operator CLI", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("prints usage without touching privileged services", async () => {
    const mocks = dependencies();

    await runAdminOperatorCli(["--help"], mocks.deps);

    expect(mocks.write).toHaveBeenCalledOnce();
    expect(mocks.bootstrapInitialSuperAdmin).not.toHaveBeenCalled();
    expect(mocks.setAdministrativeAccess).not.toHaveBeenCalled();
    expect(mocks.setAccountStatus).not.toHaveBeenCalled();
  });

  it("previews bootstrap by default and does not mutate", async () => {
    const mocks = dependencies();

    await runAdminOperatorCli(
      ["bootstrap-super-admin", "--target-email", "FIRST@EXAMPLE.TEST"],
      mocks.deps,
    );

    expect(mocks.resolveUser).toHaveBeenCalledWith({ email: "first@example.test" });
    expect(mocks.bootstrapInitialSuperAdmin).not.toHaveBeenCalled();
    expect(mocks.write.mock.calls.join("\n")).toContain('"mode": "dry-run"');
  });

  it("requires the exact bootstrap confirmation before applying", async () => {
    const mocks = dependencies();

    await expect(
      runAdminOperatorCli(
        [
          "bootstrap-super-admin",
          "--target-user-id",
          "first-admin",
          "--apply",
          "--confirm",
          "WRONG",
        ],
        mocks.deps,
      ),
    ).rejects.toThrow("BOOTSTRAP_INITIAL_SUPER_ADMIN");

    expect(mocks.bootstrapInitialSuperAdmin).not.toHaveBeenCalled();
  });

  it("applies bootstrap only after explicit confirmation", async () => {
    const mocks = dependencies();

    await runAdminOperatorCli(
      [
        "bootstrap-super-admin",
        "--target-user-id",
        "first-admin",
        "--apply",
        "--confirm",
        "BOOTSTRAP_INITIAL_SUPER_ADMIN",
      ],
      mocks.deps,
    );

    expect(mocks.bootstrapInitialSuperAdmin).toHaveBeenCalledWith({
      userId: "first-admin",
      confirmation: "BOOTSTRAP_INITIAL_SUPER_ADMIN",
    });
  });

  it("rejects ambiguous actor or target identifiers", async () => {
    const mocks = dependencies();

    await expect(
      runAdminOperatorCli(
        [
          "set-admin-access",
          "--actor-user-id",
          "actor",
          "--actor-email",
          "actor@example.test",
          "--target-user-id",
          "target",
          "--permission",
          "REVIEWER",
          "--reason",
          "on-call coverage",
        ],
        mocks.deps,
      ),
    ).rejects.toThrow("exactly one");
  });

  it("keeps admin access changes dry-run unless --apply is present", async () => {
    const mocks = dependencies();

    await runAdminOperatorCli(
      [
        "set-admin-access",
        "--actor-email",
        "root@example.test",
        "--target-email",
        "reviewer@example.test",
        "--permission",
        "REVIEWER",
        "--reason",
        "review operations coverage",
      ],
      mocks.deps,
    );

    expect(mocks.setAdministrativeAccess).not.toHaveBeenCalled();
    expect(mocks.write.mock.calls.join("\n")).toContain('"requestedPermission": "REVIEWER"');
  });

  it("maps NONE to an audited admin-access revocation", async () => {
    const mocks = dependencies();

    await runAdminOperatorCli(
      [
        "set-admin-access",
        "--actor-user-id",
        "root",
        "--target-user-id",
        "reviewer",
        "--permission",
        "none",
        "--reason",
        "operator access removed",
        "--apply",
        "--confirm",
        "CHANGE_ADMIN_ACCESS",
      ],
      mocks.deps,
    );

    expect(mocks.setAdministrativeAccess).toHaveBeenCalledWith(
      "root",
      "reviewer",
      null,
      "operator access removed",
    );
  });

  it("requires a meaningful reason for admin access changes", async () => {
    const mocks = dependencies();

    await expect(
      runAdminOperatorCli(
        [
          "set-admin-access",
          "--actor-user-id",
          "root",
          "--target-user-id",
          "reviewer",
          "--permission",
          "REVIEWER",
          "--reason",
          "x",
        ],
        mocks.deps,
      ),
    ).rejects.toThrow();
  });

  it("applies account moderation only with its own confirmation token", async () => {
    const mocks = dependencies();

    await runAdminOperatorCli(
      [
        "set-account-status",
        "--actor-user-id",
        "root",
        "--target-user-id",
        "user-1",
        "--status",
        "suspended",
        "--reason",
        "manual abuse investigation",
        "--apply",
        "--confirm",
        "CHANGE_ACCOUNT_STATUS",
      ],
      mocks.deps,
    );

    expect(mocks.setAccountStatus).toHaveBeenCalledWith(
      "root",
      "user-1",
      "SUSPENDED",
      "manual abuse investigation",
    );
  });

  it("rejects unknown options instead of silently ignoring them", async () => {
    const mocks = dependencies();

    await expect(
      runAdminOperatorCli(
        [
          "bootstrap-super-admin",
          "--target-user-id",
          "first-admin",
          "--force",
          "yes",
        ],
        mocks.deps,
      ),
    ).rejects.toThrow("Unknown option");
  });
});
