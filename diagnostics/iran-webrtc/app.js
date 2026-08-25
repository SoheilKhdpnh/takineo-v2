import {
  HoldSession,
  SESSION_HOLD_MS,
  SignallingWatch,
  TRANSPORTS,
  gatherIce,
  iceServersFor,
  probeSignalling,
  redactConfig,
  startMediaLoopback,
  turnUrlFor,
  waitForFirstAudio,
} from "./webrtc-test.js";

const DEFAULTS = {
  signallingUrl: "",
  stunUrls: [],
  turnHost: "",
  turnUsername: "",
  turnCredential: "",
  iceTransportPolicy: "relay",
  transport: "udp-3478",
  holdMs: SESSION_HOLD_MS,
  statsIntervalMs: 5000,
  signallingTimeoutMs: 15000,
  iceGatherTimeoutMs: 12000,
  firstAudioTimeoutMs: 20000,
  signallingKeepalive: false,
  transportUrls: {},
};

const state = {
  config: { ...DEFAULTS },
  events: [],
  lastMedia: null,
  hold: null,
  running: false,
};

const els = {
  form: document.getElementById("config-form"),
  transports: document.getElementById("transports"),
  log: document.getElementById("log"),
  signallingResult: document.getElementById("signalling-result"),
  iceAllResult: document.getElementById("ice-all-result"),
  iceRelayResult: document.getElementById("ice-relay-result"),
  mediaResult: document.getElementById("media-result"),
  holdResult: document.getElementById("hold-result"),
  holdMeter: document.getElementById("hold-meter"),
  status: document.getElementById("run-status"),
  runProbes: document.getElementById("run-probes"),
  startHold: document.getElementById("start-hold"),
  stopHold: document.getElementById("stop-hold"),
  downloadLog: document.getElementById("download-log"),
  clearLog: document.getElementById("clear-log"),
};

function log(level, title, detail = "") {
  const at = new Date().toISOString();
  state.events.push({ at, level, title, detail });
  const line = document.createElement("div");
  line.className = `log-line log-${level}`;
  const time = document.createElement("time");
  time.dateTime = at;
  time.textContent = at.slice(11, 23);
  const head = document.createElement("strong");
  head.textContent = title;
  const body = document.createElement("span");
  body.textContent = detail;
  line.append(time, head, body);
  els.log.append(line);
  els.log.scrollTop = els.log.scrollHeight;
}

function setStatus(text) {
  els.status.textContent = text;
}

function setCard(el, ok, text) {
  el.classList.remove("ok", "fail", "pending");
  el.classList.add(ok === true ? "ok" : ok === false ? "fail" : "pending");
  el.textContent = text;
}

function readForm() {
  const data = new FormData(els.form);
  const stunRaw = String(data.get("stunUrls") || "").trim();
  return {
    signallingUrl: String(data.get("signallingUrl") || "").trim(),
    stunUrls: stunRaw
      ? stunRaw
          .split(/[\n,]+/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
    turnHost: String(data.get("turnHost") || "").trim(),
    turnUsername: String(data.get("turnUsername") || "").trim(),
    turnCredential: String(data.get("turnCredential") || ""),
    iceTransportPolicy: String(data.get("iceTransportPolicy") || "relay"),
    transport: String(data.get("transport") || "udp-3478"),
    holdMs: Number(data.get("holdMs") || SESSION_HOLD_MS),
    statsIntervalMs: Number(data.get("statsIntervalMs") || 5000),
    signallingTimeoutMs: state.config.signallingTimeoutMs,
    iceGatherTimeoutMs: state.config.iceGatherTimeoutMs,
    firstAudioTimeoutMs: state.config.firstAudioTimeoutMs,
    signallingKeepalive: Boolean(data.get("signallingKeepalive")),
    transportUrls: state.config.transportUrls || {},
  };
}

function writeForm(config) {
  els.form.signallingUrl.value = config.signallingUrl || "";
  els.form.stunUrls.value = (config.stunUrls || []).join("\n");
  els.form.turnHost.value = config.turnHost || "";
  els.form.turnUsername.value = config.turnUsername || "";
  els.form.turnCredential.value = config.turnCredential || "";
  els.form.iceTransportPolicy.value = config.iceTransportPolicy || "relay";
  els.form.holdMs.value = String(config.holdMs || SESSION_HOLD_MS);
  els.form.statsIntervalMs.value = String(config.statsIntervalMs || 5000);
  els.form.signallingKeepalive.checked = Boolean(config.signallingKeepalive);
  const transport = config.transport || "udp-3478";
  const radio = els.form.querySelector(`input[name="transport"][value="${transport}"]`);
  if (radio) {
    radio.checked = true;
  }
}

function parseQuery(config) {
  const params = new URLSearchParams(window.location.search);
  const next = { ...config };
  const strKeys = [
    "signallingUrl",
    "turnHost",
    "turnUsername",
    "turnCredential",
    "iceTransportPolicy",
    "transport",
  ];
  for (const key of strKeys) {
    if (params.has(key)) {
      next[key] = params.get(key);
    }
  }
  if (params.has("stunUrls")) {
    next.stunUrls = params
      .get("stunUrls")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  for (const key of ["holdMs", "statsIntervalMs", "signallingTimeoutMs"]) {
    if (params.has(key)) {
      next[key] = Number(params.get(key));
    }
  }
  if (params.has("signallingKeepalive")) {
    next.signallingKeepalive = params.get("signallingKeepalive") === "1";
  }
  return next;
}

async function loadJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${path} ${response.status}`);
  }
  return response.json();
}

async function loadConfig() {
  let config = { ...DEFAULTS };
  try {
    const file = await loadJson("./config.json");
    config = { ...config, ...file };
    log("info", "Loaded config.json");
  } catch {
    log("warn", "config.json not loaded", "using built-in defaults");
  }
  try {
    const local = await loadJson("./config.local.json");
    config = { ...config, ...local };
    log("info", "Loaded config.local.json", "overrides applied; do not commit this file");
  } catch {
    // optional
  }
  config = parseQuery(config);
  if (config.holdMs !== SESSION_HOLD_MS) {
    log(
      "warn",
      "holdMs override",
      `config holdMs=${config.holdMs}; product session length is still ${SESSION_HOLD_MS}ms`,
    );
  }
  state.config = config;
  writeForm(config);
}

function formatCounts(counts) {
  return `host ${counts.host || 0} / srflx ${counts.srflx || 0} / relay ${counts.relay || 0}` +
    (counts.prflx ? ` / prflx ${counts.prflx}` : "");
}

function formatMs(value) {
  if (value == null || Number.isNaN(value)) {
    return "n/a";
  }
  return `${Math.round(value)}ms`;
}

function formatPct(value) {
  if (value == null || Number.isNaN(value)) {
    return "n/a";
  }
  return `${value.toFixed(2)}%`;
}

async function runProbes() {
  if (state.running) {
    return;
  }
  state.running = true;
  els.runProbes.disabled = true;
  setStatus("Running probes…");
  const config = readForm();
  state.config = config;
  log("info", "Probe start", `transport=${config.transport} policy(media)=${config.iceTransportPolicy}`);

  try {
    setCard(els.signallingResult, null, "Connecting…");
    const signalling = await probeSignalling(config.signallingUrl, {
      timeoutMs: config.signallingTimeoutMs,
    });
    if (signalling.ok) {
      const extra = signalling.closeCode
        ? ` then closed code=${signalling.closeCode}`
        : "";
      setCard(
        els.signallingResult,
        true,
        `Open in ${formatMs(signalling.openedMs)}${extra}`,
      );
      log("ok", "Signalling", `time-to-connect ${formatMs(signalling.openedMs)}${extra}`);
    } else {
      setCard(
        els.signallingResult,
        false,
        `Failed (${signalling.error}) in ${formatMs(signalling.elapsedMs)}`,
      );
      log("fail", "Signalling", `${signalling.error} after ${formatMs(signalling.elapsedMs)}`);
    }
  } catch (error) {
    setCard(els.signallingResult, false, error.message);
    log("fail", "Signalling", error.message);
  }

  const transportId = config.transport;
  try {
    const url = turnUrlFor(config, transportId);
    log("info", "Isolated TURN URL", url);
  } catch (error) {
    log("fail", "TURN URL", error.message);
  }

  const serversAll = iceServersFor(config, { includeStun: true, transportId });
  const serversRelay = iceServersFor(config, { includeStun: false, transportId });

  try {
    setCard(els.iceAllResult, null, "Gathering…");
    const all = await gatherIce({
      iceServers: serversAll,
      iceTransportPolicy: "all",
      timeoutMs: config.iceGatherTimeoutMs,
    });
    setCard(els.iceAllResult, true, `${formatCounts(all.counts)} in ${formatMs(all.elapsedMs)}`);
    log("ok", "ICE gather (all)", formatCounts(all.counts));
    for (const row of all.rows) {
      log("info", `  ${row.type}`, `${row.protocol || "?"} ${row.address || ""}:${row.port || ""}`);
    }
  } catch (error) {
    setCard(els.iceAllResult, false, error.message);
    log("fail", "ICE gather (all)", error.message);
  }

  const hasTurnAuth = Boolean(config.turnUsername && config.turnCredential);
  if (!hasTurnAuth) {
    setCard(els.iceRelayResult, false, "TURN username/credential required for relay");
    setCard(els.mediaResult, false, "Skipped — no TURN credential");
    log("warn", "Relay skipped", "Set turnUsername and turnCredential (query param or config.local.json)");
    state.running = false;
    els.runProbes.disabled = false;
    setStatus("Probes finished (relay skipped).");
    return;
  }

  try {
    setCard(els.iceRelayResult, null, "Gathering relay…");
    const relay = await gatherIce({
      iceServers: serversRelay,
      iceTransportPolicy: "relay",
      timeoutMs: config.iceGatherTimeoutMs,
    });
    const ok = (relay.counts.relay || 0) > 0;
    setCard(
      els.iceRelayResult,
      ok,
      `${formatCounts(relay.counts)} in ${formatMs(relay.elapsedMs)}`,
    );
    log(ok ? "ok" : "fail", "ICE gather (relay)", formatCounts(relay.counts));
    for (const row of relay.rows) {
      log("info", `  ${row.type}`, `${row.protocol || "?"} ${row.address || ""}:${row.port || ""}`);
    }
  } catch (error) {
    setCard(els.iceRelayResult, false, error.message);
    log("fail", "ICE gather (relay)", error.message);
  }

  try {
    setCard(els.mediaResult, null, "Establishing loopback…");
    if (state.lastMedia) {
      await state.lastMedia.close();
      state.lastMedia = null;
    }
    const media = await startMediaLoopback({
      iceServers: serversRelay,
      iceTransportPolicy: config.iceTransportPolicy,
    });
    const first = await waitForFirstAudio(media.pcAnswer, {
      timeoutMs: config.firstAudioTimeoutMs,
    });
    if (first.ok) {
      const pair = `${first.stats.localType || "?"}→${first.stats.remoteType || "?"}`;
      setCard(
        els.mediaResult,
        true,
        `First audio ${formatMs(first.firstPacketMs)} (ontrack ${formatMs(first.ontrackMs)}; pair ${pair})`,
      );
      log(
        "ok",
        "Time-to-first-audio",
        `${formatMs(first.firstPacketMs)}; selected ${pair} ${first.stats.localProtocol || ""}`,
      );
      if (config.iceTransportPolicy === "relay" && first.stats.localType && first.stats.localType !== "relay") {
        log("fail", "Path not isolated", `expected relay, selected ${pair}`);
      }
      state.lastMedia = media;
    } else {
      setCard(els.mediaResult, false, `No audio in ${formatMs(first.elapsedMs)}`);
      log("fail", "Time-to-first-audio", first.error || "timeout");
      await media.close();
    }
  } catch (error) {
    setCard(els.mediaResult, false, error.message);
    log("fail", "Media loopback", error.message);
  }

  state.running = false;
  els.runProbes.disabled = false;
  setStatus("Probes finished. 15-minute hold is not started until you click Start hold.");
}

async function startHold() {
  if (state.hold) {
    return;
  }
  const config = readForm();
  state.config = config;
  if (!config.turnUsername || !config.turnCredential) {
    log("fail", "Hold blocked", "TURN credentials required");
    return;
  }

  els.startHold.disabled = true;
  els.stopHold.disabled = false;
  els.runProbes.disabled = true;
  setCard(els.holdResult, null, "Starting full 15-minute hold…");
  els.holdMeter.value = 0;

  if (state.lastMedia) {
    await state.lastMedia.close();
    state.lastMedia = null;
  }

  const serversRelay = iceServersFor(config, {
    includeStun: false,
    transportId: config.transport,
  });
  const media = await startMediaLoopback({
    iceServers: serversRelay,
    iceTransportPolicy: config.iceTransportPolicy,
  });
  const first = await waitForFirstAudio(media.pcAnswer, {
    timeoutMs: config.firstAudioTimeoutMs,
  });
  if (!first.ok) {
    await media.close();
    setCard(els.holdResult, false, "Hold aborted — no first audio");
    log("fail", "Hold aborted", "media never produced audio packets");
    els.startHold.disabled = false;
    els.stopHold.disabled = true;
    els.runProbes.disabled = false;
    return;
  }

  const signalling = config.signallingUrl
    ? new SignallingWatch(config.signallingUrl, {
        log: (title, detail) => {
          const reconnect = title === "Reconnecting" || title === "Reconnected";
          log(reconnect ? "warn" : "info", title, detail);
          if (reconnect && state.hold) {
            state.hold.reconnects.push({
              at: new Date().toISOString(),
              event: title,
              source: "signalling",
              detail,
            });
          }
        },
        keepalive: config.signallingKeepalive,
      })
    : null;

  state.hold = new HoldSession({
    media,
    signalling,
    holdMs: config.holdMs || SESSION_HOLD_MS,
    statsIntervalMs: config.statsIntervalMs,
    log: (title, detail) => log("info", title, detail),
    onStats: (sample, holdMs) => {
      const remaining = Math.max(0, holdMs - sample.elapsedMs);
      els.holdMeter.max = holdMs;
      els.holdMeter.value = sample.elapsedMs;
      setCard(
        els.holdResult,
        null,
        `${Math.floor(sample.elapsedMs / 1000)}s / ${Math.floor(holdMs / 1000)}s  RTT ${formatMs(sample.rttMs)}  jitter ${formatMs(sample.jitterMs)}  loss ${formatPct(sample.lossPct)}  pair ${sample.localType || "?"}→${sample.remoteType || "?"}`,
      );
      log(
        "info",
        "getStats",
        `t=${Math.floor(sample.elapsedMs / 1000)}s rtt=${formatMs(sample.rttMs)} jitter=${formatMs(sample.jitterMs)} loss=${formatPct(sample.lossPct)} rx=${sample.packetsReceived} lost=${sample.packetsLost} remaining=${Math.ceil(remaining / 1000)}s`,
      );
    },
    onDone: (summary) => {
      const ok = summary.reason === "completed";
      setCard(
        els.holdResult,
        ok,
        `Hold ${summary.reason}: ${Math.round(summary.elapsedMs / 1000)}s, ${summary.sampleCount} samples, ${summary.reconnects.length} reconnect events`,
      );
      els.startHold.disabled = false;
      els.stopHold.disabled = true;
      els.runProbes.disabled = false;
      state.hold = null;
      setStatus(ok ? "15-minute hold completed." : "Hold stopped.");
    },
  });
  state.hold.start();
  setStatus("15-minute hold running. Leave this tab open.");
}

async function stopHold() {
  if (!state.hold) {
    return;
  }
  await state.hold.stop("stopped");
}

function downloadLog() {
  const payload = {
    exportedAt: new Date().toISOString(),
    config: redactConfig(readForm()),
    events: state.events,
    hold: state.hold ? state.hold.summary("in-progress") : null,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `iran-webrtc-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function renderTransports() {
  for (const transport of TRANSPORTS) {
    const id = `transport-${transport.id}`;
    const label = document.createElement("label");
    label.className = "transport";
    label.htmlFor = id;
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "transport";
    input.id = id;
    input.value = transport.id;
    if (transport.id === "udp-3478") {
      input.checked = true;
    }
    const title = document.createElement("span");
    title.className = "transport-label";
    title.textContent = transport.label;
    const hint = document.createElement("span");
    hint.className = "transport-hint";
    hint.textContent = transport.description;
    label.append(input, title, hint);
    els.transports.append(label);
  }
}

renderTransports();
els.runProbes.addEventListener("click", (event) => {
  event.preventDefault();
  runProbes().catch((error) => {
    log("fail", "Probe crash", error.message);
    state.running = false;
    els.runProbes.disabled = false;
  });
});
els.startHold.addEventListener("click", (event) => {
  event.preventDefault();
  startHold().catch((error) => {
    log("fail", "Hold crash", error.message);
    els.startHold.disabled = false;
    els.stopHold.disabled = true;
    els.runProbes.disabled = false;
  });
});
els.stopHold.addEventListener("click", (event) => {
  event.preventDefault();
  stopHold();
});
els.downloadLog.addEventListener("click", (event) => {
  event.preventDefault();
  downloadLog();
});
els.clearLog.addEventListener("click", (event) => {
  event.preventDefault();
  els.log.replaceChildren();
  state.events = [];
});

loadConfig().catch((error) => log("fail", "Config load", error.message));
setStatus("Idle. Probes and the 15-minute hold never start on page load.");
