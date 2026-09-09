import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

import { Client } from "pg";

import {
  expectedE2EDatabaseIdentity,
  getE2EDatabaseUrl,
  requireE2EDatabaseResetAcknowledgement,
} from "@/tests/e2e/support/e2e-database-url";

async function verifyConnectedIdentity(client: Client) {
  const result = await client.query<{
    database_name: string;
    user_name: string;
    server_address: string;
    server_port: number;
  }>(`
    SELECT
      current_database()::text AS database_name,
      current_user::text AS user_name,
      host(inet_server_addr())::text AS server_address,
      inet_server_port()::int AS server_port
  `);

  const [identity] = result.rows;
  if (
    !identity ||
    identity.database_name !== expectedE2EDatabaseIdentity.databaseName ||
    identity.user_name !== expectedE2EDatabaseIdentity.userName ||
    identity.server_address !== expectedE2EDatabaseIdentity.serverAddress ||
    identity.server_port !== expectedE2EDatabaseIdentity.serverPort
  ) {
    throw new Error(
      "Connected E2E database identity does not match the isolated local target.",
    );
  }
}

function runPrismaMigrateDeploy(connectionString: string) {
  const executable =
    process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : "npx";
  const args =
    process.platform === "win32"
      ? ["/d", "/s", "/c", "npx.cmd prisma migrate deploy"]
      : ["prisma", "migrate", "deploy"];

  return new Promise<void>((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: process.cwd(),
      stdio: "inherit",
      env: {
        ...process.env,
        DATABASE_URL: connectionString,
        DIRECT_URL: connectionString,
      },
    });

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else {
        reject(
          new Error(
            `prisma migrate deploy exited with code ${code ?? "unknown"}.`,
          ),
        );
      }
    });
  });
}

export async function prepareE2EDatabase() {
  const connectionString = getE2EDatabaseUrl();
  requireE2EDatabaseResetAcknowledgement();

  const client = new Client({ connectionString });
  await client.connect();

  try {
    await verifyConnectedIdentity(client);
    await client.query("DROP SCHEMA public CASCADE");
    await client.query("CREATE SCHEMA public AUTHORIZATION CURRENT_USER");
  } finally {
    await client.end();
  }

  await runPrismaMigrateDeploy(connectionString);

  const verificationClient = new Client({ connectionString });
  await verificationClient.connect();
  try {
    await verifyConnectedIdentity(verificationClient);
  } finally {
    await verificationClient.end();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await prepareE2EDatabase();
}
