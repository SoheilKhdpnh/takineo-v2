import "dotenv/config";

import {
  getTestDatabaseUrl,
} from "@/tests/support/test-database-url";

const testDatabaseUrl =
  getTestDatabaseUrl();

process.env.DATABASE_URL =
  testDatabaseUrl;

process.env.DIRECT_URL =
  testDatabaseUrl;
