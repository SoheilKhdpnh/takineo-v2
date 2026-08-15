import { readdir, rm } from "node:fs/promises";
import path from "node:path";

const E2E_BASE_URL = "http://127.0.0.1:3100";

type WarmupTarget = {
  method?: "GET" | "POST";
  path: string;
  body?: string;
};

const WARMUP_TARGETS: readonly WarmupTarget[] = [
  { path: "/en/sign-in" },
  { path: "/fa/sign-in" },
  { path: "/en/dashboard" },
  { path: "/fa/dashboard" },
  { path: "/en/student/dashboard" },
  { path: "/en/teacher/dashboard" },
  { path: "/fa/teacher/dashboard" },
  { path: "/en/onboarding" },
  { path: "/fa/onboarding" },
  { path: "/fa/teacher/profile" },
  { path: "/en/admin" },
  { path: "/fa/admin" },
  { path: "/en/admin/teachers?status=APPROVED" },
  { path: "/fa/admin/teachers?status=APPROVED" },
  { path: "/en/admin/teacher-applications" },
  { path: "/en/admin/teacher-applications/e2e-warmup" },
  { path: "/api/admin/teacher-applications" },
  { path: "/api/admin/teachers?status=APPROVED" },
  {
    method: "POST",
    path: "/api/auth/sign-in/email",
    body: JSON.stringify({
      email: "e2e-warmup-invalid@takineo.test",
      password: "E2E-warmup-invalid-password",
    }),
  },
  {
    method: "POST",
    path: "/api/admin/teacher-applications/e2e-warmup/reject",
    body: "{}",
  },
];

async function warmTarget(target: WarmupTarget) {
  const response = await fetch(new URL(target.path, E2E_BASE_URL), {
    method: target.method ?? "GET",
    redirect: "manual",
    headers: target.body
      ? {
          "content-type": "application/json",
          origin: E2E_BASE_URL,
        }
      : undefined,
    body: target.body,
  });

  await response.arrayBuffer();

  if (response.status >= 500) {
    throw new Error(
      `E2E route warm-up failed for ${target.method ?? "GET"} ${target.path} with HTTP ${response.status}.`,
    );
  }
}

async function warmE2ERoutes() {
  for (const target of WARMUP_TARGETS) {
    await warmTarget(target);
  }
}

export default async function globalSetup() {
  const authDirectory = path.join(process.cwd(), "playwright", ".auth");

  for (const entry of await readdir(authDirectory).catch(() => [])) {
    if (entry !== ".gitignore") {
      await rm(path.join(authDirectory, entry), { recursive: true, force: true });
    }
  }

  await warmE2ERoutes();
}
