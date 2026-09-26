import "dotenv/config";

import {
  AdminReviewConflictError,
  AdminTargetNotFoundError,
} from "../lib/errors/admin-errors";
import {
  adminOperatorUsage,
  runAdminOperatorCli,
} from "./admin-operator-cli";

function emitError(code: string, message: string) {
  process.stderr.write(`${JSON.stringify({ error: code, message }, null, 2)}\n`);
  process.exitCode = 1;
}

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
  process.stdout.write(`${adminOperatorUsage()}\n`);
} else {
  try {
    const [
      { bootstrapInitialSuperAdmin },
      { setAccountStatus, setAdministrativeAccess },
      { resolveAdminOperatorUser },
    ] = await Promise.all([
      import("../lib/services/admin-bootstrap.service"),
      import("../lib/services/admin-access.service"),
      import("../lib/services/admin-operator.service"),
    ]);

    await runAdminOperatorCli(args, {
      resolveUser: resolveAdminOperatorUser,
      bootstrapInitialSuperAdmin,
      setAdministrativeAccess,
      setAccountStatus,
      write(value) {
        process.stdout.write(value);
      },
    });
  } catch (error) {
    if (error instanceof AdminTargetNotFoundError) {
      emitError(
        "USER_NOT_FOUND",
        "No Talkinu user exists for that email or user id. Sign up first, then grant admin access.",
      );
    } else if (error instanceof AdminReviewConflictError) {
      emitError(
        "CONFLICT",
        "That command cannot run in the current state. The first SUPER_ADMIN already exists, so use set-admin-access instead of bootstrap-super-admin.",
      );
    } else if (error instanceof Error) {
      emitError("INVALID_REQUEST", error.message);
    } else {
      throw error;
    }
  }
}
