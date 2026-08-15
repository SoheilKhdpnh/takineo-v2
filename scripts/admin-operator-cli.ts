import { z } from "zod";

import type {
  AdminOperatorUserIdentifier,
  AdminOperatorUserSnapshot,
} from "../lib/services/admin-operator.service";

const REASON_SCHEMA = z.string().trim().min(3).max(2000);
const PERMISSION_SCHEMA = z.enum(["REVIEWER", "SUPER_ADMIN", "NONE"]);
const ACCOUNT_STATUS_SCHEMA = z.enum(["ACTIVE", "SUSPENDED", "DISABLED"]);

const CONFIRMATIONS = {
  bootstrap: "BOOTSTRAP_INITIAL_SUPER_ADMIN",
  access: "CHANGE_ADMIN_ACCESS",
  account: "CHANGE_ACCOUNT_STATUS",
} as const;

export type AdminOperatorDependencies = {
  resolveUser: (
    identifier: AdminOperatorUserIdentifier,
  ) => Promise<AdminOperatorUserSnapshot>;
  bootstrapInitialSuperAdmin: (input: {
    userId: string;
    confirmation: string;
  }) => Promise<unknown>;
  setAdministrativeAccess: (
    actorUserId: string,
    targetUserId: string,
    permission: "REVIEWER" | "SUPER_ADMIN" | null,
    reason: string,
  ) => Promise<unknown>;
  setAccountStatus: (
    actorUserId: string,
    targetUserId: string,
    accountStatus: "ACTIVE" | "SUSPENDED" | "DISABLED",
    reason: string,
  ) => Promise<unknown>;
  write: (value: string) => void;
};

type ParsedOptions = Map<string, string | true>;

function parseOptions(args: string[]): ParsedOptions {
  const options = new Map<string, string | true>();

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!argument?.startsWith("--")) {
      throw new Error(`Unexpected argument: ${argument ?? ""}`);
    }

    const key = argument.slice(2);
    if (key === "apply") {
      if (options.has(key)) throw new Error(`Duplicate option: --${key}`);
      options.set(key, true);
      continue;
    }

    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`--${key} requires a value.`);
    }
    if (options.has(key)) throw new Error(`Duplicate option: --${key}`);
    options.set(key, value);
    index += 1;
  }

  return options;
}

function value(options: ParsedOptions, key: string): string | undefined {
  const result = options.get(key);
  return typeof result === "string" ? result : undefined;
}

function requiredValue(options: ParsedOptions, key: string): string {
  const result = value(options, key)?.trim();
  if (!result) throw new Error(`--${key} is required.`);
  return result;
}

function identifier(
  options: ParsedOptions,
  prefix: "actor" | "target",
): AdminOperatorUserIdentifier {
  const userId = value(options, `${prefix}-user-id`)?.trim();
  const email = value(options, `${prefix}-email`)?.trim().toLowerCase();

  if (Boolean(userId) === Boolean(email)) {
    throw new Error(
      `Provide exactly one of --${prefix}-user-id or --${prefix}-email.`,
    );
  }

  return userId ? { userId } : { email: email! };
}

function assertOnlyOptions(options: ParsedOptions, allowed: string[]): void {
  const allowedSet = new Set(allowed);
  for (const key of options.keys()) {
    if (!allowedSet.has(key)) throw new Error(`Unknown option: --${key}`);
  }
}

function assertApplyConfirmation(
  options: ParsedOptions,
  confirmation: string,
): boolean {
  const apply = options.get("apply") === true;
  const suppliedConfirmation = value(options, "confirm");

  if (!apply) {
    if (suppliedConfirmation) {
      throw new Error("--confirm may only be used together with --apply.");
    }
    return false;
  }

  if (suppliedConfirmation !== confirmation) {
    throw new Error(
      `--apply requires --confirm ${confirmation}.`,
    );
  }

  return true;
}

function publicUser(user: AdminOperatorUserSnapshot) {
  return {
    id: user.id,
    email: user.email,
    accountStatus: user.accountStatus,
    adminPermission: user.adminPermission,
  };
}

function emit(
  deps: AdminOperatorDependencies,
  payload: Record<string, unknown>,
): void {
  deps.write(`${JSON.stringify(payload, null, 2)}\n`);
}

export function adminOperatorUsage(): string {
  return [
    "Takineo administrative operator CLI",
    "",
    "Dry-run is the default. Add --apply plus the exact confirmation token to mutate.",
    "",
    "bootstrap-super-admin --target-email <email> [--apply --confirm BOOTSTRAP_INITIAL_SUPER_ADMIN]",
    "set-admin-access --actor-email <email> --target-email <email> --permission REVIEWER|SUPER_ADMIN|NONE --reason <text> [--apply --confirm CHANGE_ADMIN_ACCESS]",
    "set-account-status --actor-email <email> --target-email <email> --status ACTIVE|SUSPENDED|DISABLED --reason <text> [--apply --confirm CHANGE_ACCOUNT_STATUS]",
    "",
    "Every actor/target may use --*-user-id instead of --*-email, but never both.",
  ].join("\n");
}

export async function runAdminOperatorCli(
  args: string[],
  deps: AdminOperatorDependencies,
): Promise<void> {
  const [command, ...optionArgs] = args;

  if (!command || command === "--help" || command === "-h") {
    deps.write(`${adminOperatorUsage()}\n`);
    return;
  }

  const options = parseOptions(optionArgs);

  if (command === "bootstrap-super-admin") {
    assertOnlyOptions(options, [
      "target-user-id",
      "target-email",
      "apply",
      "confirm",
    ]);
    const target = await deps.resolveUser(identifier(options, "target"));
    const apply = assertApplyConfirmation(options, CONFIRMATIONS.bootstrap);

    emit(deps, {
      command,
      mode: apply ? "apply" : "dry-run",
      target: publicUser(target),
      requestedPermission: "SUPER_ADMIN",
    });

    if (apply) {
      await deps.bootstrapInitialSuperAdmin({
        userId: target.id,
        confirmation: CONFIRMATIONS.bootstrap,
      });
      emit(deps, { command, result: "applied", targetUserId: target.id });
    }
    return;
  }

  if (command === "set-admin-access") {
    assertOnlyOptions(options, [
      "actor-user-id",
      "actor-email",
      "target-user-id",
      "target-email",
      "permission",
      "reason",
      "apply",
      "confirm",
    ]);
    const permission = PERMISSION_SCHEMA.parse(
      requiredValue(options, "permission").toUpperCase(),
    );
    const reason = REASON_SCHEMA.parse(requiredValue(options, "reason"));
    const [actor, target] = await Promise.all([
      deps.resolveUser(identifier(options, "actor")),
      deps.resolveUser(identifier(options, "target")),
    ]);
    const apply = assertApplyConfirmation(options, CONFIRMATIONS.access);

    emit(deps, {
      command,
      mode: apply ? "apply" : "dry-run",
      actor: publicUser(actor),
      target: publicUser(target),
      requestedPermission: permission,
    });

    if (apply) {
      await deps.setAdministrativeAccess(
        actor.id,
        target.id,
        permission === "NONE" ? null : permission,
        reason,
      );
      emit(deps, { command, result: "applied", targetUserId: target.id });
    }
    return;
  }

  if (command === "set-account-status") {
    assertOnlyOptions(options, [
      "actor-user-id",
      "actor-email",
      "target-user-id",
      "target-email",
      "status",
      "reason",
      "apply",
      "confirm",
    ]);
    const accountStatus = ACCOUNT_STATUS_SCHEMA.parse(
      requiredValue(options, "status").toUpperCase(),
    );
    const reason = REASON_SCHEMA.parse(requiredValue(options, "reason"));
    const [actor, target] = await Promise.all([
      deps.resolveUser(identifier(options, "actor")),
      deps.resolveUser(identifier(options, "target")),
    ]);
    const apply = assertApplyConfirmation(options, CONFIRMATIONS.account);

    emit(deps, {
      command,
      mode: apply ? "apply" : "dry-run",
      actor: publicUser(actor),
      target: publicUser(target),
      requestedAccountStatus: accountStatus,
    });

    if (apply) {
      await deps.setAccountStatus(actor.id, target.id, accountStatus, reason);
      emit(deps, { command, result: "applied", targetUserId: target.id });
    }
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}
