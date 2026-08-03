// test-db-connection.js
// Quick standalone script to test the DIRECT_URL connection to Neon
// and surface the raw error the `pg` driver sees (bypassing Prisma's
// generic P1001 wrapper).
//
// Usage:
//   npm install pg --save-dev   (if not already installed)
//   node test-db-connection.js

import { Client } from "pg";

// Try to load .env if dotenv is available; otherwise fall back to
// reading process.env directly (works if you set it in the shell).
try {
  const dotenv = await import("dotenv");
  dotenv.config();
} catch {
  console.log("(dotenv not installed — reading process.env directly)");
}

const connectionString = process.env.DIRECT_URL;

if (!connectionString) {
  console.error(
    "ERROR: DIRECT_URL is not set. Either add it to your .env file " +
      "(and ensure dotenv is installed), or set it in this shell session with:\n" +
      '  $env:DIRECT_URL="postgresql://user:pass@host/db?sslmode=require"'
  );
  process.exit(1);
}

console.log("Attempting connection with DIRECT_URL...");
console.log(
  "Host in use:",
  connectionString.split("@")[1]?.split("/")[0] ?? "(could not parse host)"
);

const client = new Client({
  connectionString,
  connectionTimeoutMillis: 15000, // 15s, generous for cold starts
});

async function main() {
  const start = Date.now();
  try {
    await client.connect();
    const elapsed = Date.now() - start;
    console.log(`✅ Connected successfully in ${elapsed}ms`);

    const res = await client.query("SELECT version();");
    console.log("Postgres version:", res.rows[0].version);

    await client.end();
    console.log("Connection closed cleanly.");
  } catch (err) {
    const elapsed = Date.now() - start;
    console.error(`❌ Connection failed after ${elapsed}ms`);
    console.error("Error name:   ", err.name);
    console.error("Error message:", err.message);
    console.error("Error code:   ", err.code);
    if (err.stack) {
      console.error("\nFull stack trace:\n", err.stack);
    }
    process.exit(1);
  }
}

main();