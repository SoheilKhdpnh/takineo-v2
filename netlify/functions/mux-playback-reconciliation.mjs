const JOB_PATH = "/api/internal/jobs/mux-playback-reconciliation";
const JOB_LIMIT = 10;
const REQUEST_TIMEOUT_MS = 20_000;
const MONITOR_TIMEOUT_MS = 2_000;

function requiredEnvironmentVariable(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for Mux reconciliation scheduling.`);
  return value;
}

function optionalEnvironmentVariable(name) {
  return process.env[name]?.trim() || null;
}

function safeJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function monitorSignalUrl(baseUrl, signal) {
  const url = new URL(baseUrl);
  if (signal === "success") return url;

  const suffix = signal === "start" ? "/start" : "/fail";
  url.pathname = `${url.pathname.replace(/\/$/, "")}${suffix}`;
  return url;
}

async function pingMonitor(baseUrl, signal) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MONITOR_TIMEOUT_MS);

  try {
    const response = await fetch(monitorSignalUrl(baseUrl, signal), {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Mux reconciliation monitor returned HTTP ${response.status}.`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

function logMonitorFailure(signal, error) {
  console.error(
    JSON.stringify({
      event: "mux_playback_reconciliation_monitor_error",
      signal,
      errorName: error instanceof Error ? error.name : "UnknownError",
    }),
  );
}

const handler = async (request) => {
  const startedAt = new Date();
  const event = safeJson(await request.text());
  const nextRun =
    event && typeof event.next_run === "string" ? event.next_run : null;

  const siteUrl = requiredEnvironmentVariable("URL");
  const secret = requiredEnvironmentVariable("INTERNAL_JOB_SECRET");
  const monitorUrl = optionalEnvironmentVariable(
    "MUX_RECONCILIATION_HEALTHCHECK_URL",
  );
  const endpoint = new URL(JOB_PATH, siteUrl);

  if (monitorUrl) {
    await pingMonitor(monitorUrl, "start").catch((error) => {
      logMonitorFailure("start", error);
    });
  } else {
    console.error(
      JSON.stringify({
        event: "mux_playback_reconciliation_monitor_not_configured",
      }),
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-takineo-job-secret": secret,
      },
      body: JSON.stringify({ limit: JOB_LIMIT }),
      cache: "no-store",
      signal: controller.signal,
    });

    const responseText = await response.text();
    const payload = safeJson(responseText);
    const logEvent = {
      event: "mux_playback_reconciliation_schedule",
      ok: response.ok,
      httpStatus: response.status,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      nextRun,
      result: payload?.result ?? null,
      health: payload?.health ?? null,
      errorCode: payload?.error ?? null,
    };

    console.log(JSON.stringify(logEvent));

    if (!response.ok) {
      throw new Error(`Mux reconciliation job returned HTTP ${response.status}.`);
    }

    if (monitorUrl) {
      await pingMonitor(monitorUrl, "success").catch((error) => {
        logMonitorFailure("success", error);
      });
    }
  } catch (error) {
    if (monitorUrl) {
      await pingMonitor(monitorUrl, "failure").catch(() => undefined);
    }
    console.error(
      JSON.stringify({
        event: "mux_playback_reconciliation_schedule_error",
        startedAt: startedAt.toISOString(),
        failedAt: new Date().toISOString(),
        nextRun,
        errorName: error instanceof Error ? error.name : "UnknownError",
      }),
    );
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

export default handler;
