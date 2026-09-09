import "dotenv/config";

import {
  getTestDatabaseUrl,
} from "@/tests/support/test-database-url";

// Fail immediately before any integration test can import
// a database client. Do not rewrite DATABASE_URL or DIRECT_URL.
getTestDatabaseUrl();
