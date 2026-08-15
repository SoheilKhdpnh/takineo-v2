import "dotenv/config";

import {
  adminOperatorUsage,
  runAdminOperatorCli,
} from "./admin-operator-cli";

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
  process.stdout.write(`${adminOperatorUsage()}\n`);
} else {
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
}
