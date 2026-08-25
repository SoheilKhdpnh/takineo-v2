/**
 * Iran WebRTC reachability engine.
 * Native WebSocket + RTCPeerConnection only — no CDN, no LiveKit SDK.
 */

export const SESSION_HOLD_MS = 15 * 60 * 1000;

export const TRANSPORTS = [
  { id: "udp-3478", label: "UDP/3478", description: "TURN over UDP port 3478" },
  { id: "udp-443", label: "UDP/443", description: "TURN over UDP port 443" },
  { id: "udp-53", label: "UDP/53", description: "TURN over UDP port 53" },
  { id: "tcp-443-tls", label: "TCP/443 TLS", description: "TURNS (TLS) over TCP 443" },
  { id: "tcp-80", label: "TCP/80", description: "TURN over TCP port 80" },
];

const DEFAULT_TRANSPORT_URLS = {
  "udp-3478": "turn:{host}:3478?transport=udp",
  "udp-443": "turn:{host}:443?transport=udp",
  "udp-53": "turn:{host}:53?transport=udp",
  "tcp-443-tls": "turns:{host}:443?transport=tcp",
  "tcp-80": "turn:{host}:80?transport=tcp",
};

export function redactConfig(config) {
  const copy = { ...config };
  if (copy.turnCredential) {
    copy.turnCredential = "[redacted]";
  }
  return copy;
}

export function turnUrlFor(config, transportId) {
  const templates = { ...DEFAULT_TRANSPORT_URLS, ...(config.transportUrls || {}) };
  const template = templates[transportId];
  if (!template) {
    throw new Error(`Unknown transport: ${transportId}`);
  }
  const host = (config.turnHost || "").trim();
  if (!host) {
    throw new Error("turnHost is required");
  }
  return template.replaceAll("{host}", host);
}

export function iceServersFor(config, { includeStun, transportId }) {
  const servers = [];
  if (includeStun && Array.isArray(config.stunUrls)) {
    const urls = config.stunUrls.map((u) => String(u).trim()).filter(Boolean);
    if (urls.length) {
      servers.push({ urls });
    }
  }
  const username = (config.turnUsername || "").trim();
  const credential = config.turnCredential || "";
  const turnUrl = turnUrlFor(config, transportId);
  if (username && credential) {
    servers.push({ urls: [turnUrl], username, credential });
  } else {
    servers.push({ urls: [turnUrl] });
  }
  return servers;
}

export function classifyCandidate(candidate) {
  if (!candidate) {
    return null;
  }
  if (candidate.type) {
    return candidate.type;
  }
  const line = candidate.candidate || "";
  const match = / typ ([a-z]+)/i.exec(line);
  return match ? match[1].toLowerCase() : "unknown";
}

export function summarizeCandidates(candidates) {
  const counts = { host: 0, srflx: 0, prflx: 0, relay: 0, unknown: 0 };
  const rows = [];
  for (const candidate of candidates) {
    const type = classifyCandidate(candidate) || "unknown";
    counts[type] = (counts[type] || 0) + 1;
    rows.push({
      type,
      protocol: candidate.protocol || parseProtocol(candidate.candidate),
      address: candidate.address || parseAddress(candidate.candidate),
      port: candidate.port || null,
      candidate: candidate.candidate || "",
    });
  }
  return { counts, rows };
}

function parseProtocol(line) {
  const match = /candidate:\S+\s+\d+\s+(\S+)/i.exec(line || "");
  return match ? match[1].toLowerCase() : null;
}

function parseAddress(line) {
  const match = /candidate:\S+\s+\d+\s+\S+\s+\d+\s+(\S+)/i.exec(line || "");
  return match ? match[1] : null;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function probeSignalling(url, { timeoutMs = 15000, settleMs = 1500 } = {}) {
  if (!url) {
    throw new Error("signallingUrl is required");
  }
  const started = performance.now();
  return new Promise((resolve) => {
    let settled = false;
    let openedMs = null;
    const socket = new WebSocket(url);

    const finish = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      try {
        socket.close();
      } catch {
        // already closed
      }
      resolve(result);
    };

    const timer = setTimeout(() => {
      finish({
        ok: false,
        error: "timeout",
        elapsedMs: Math.round(performance.now() - started),
        openedMs,
      });
    }, timeoutMs);

    socket.addEventListener("open", () => {
      openedMs = Math.round(performance.now() - started);
      setTimeout(() => {
        finish({
          ok: true,
          openedMs,
          elapsedMs: Math.round(performance.now() - started),
          protocol: socket.protocol || "",
          closeCode: null,
        });
      }, settleMs);
    });

    socket.addEventListener("error", () => {
      if (openedMs == null) {
        finish({
          ok: false,
          error: "error",
          elapsedMs: Math.round(performance.now() - started),
          openedMs,
        });
      }
    });

    socket.addEventListener("close", (event) => {
      const elapsedMs = Math.round(performance.now() - started);
      if (openedMs == null) {
        finish({
          ok: false,
          error: "closed_before_open",
          elapsedMs,
          openedMs,
          closeCode: event.code,
          closeReason: event.reason || "",
        });
        return;
      }
      finish({
        ok: true,
        openedMs,
        elapsedMs,
        protocol: socket.protocol || "",
        closeCode: event.code,
        closeReason: event.reason || "",
        note: "Server closed the socket shortly after open (common without a vendor signalling protocol).",
      });
    });
  });
}

export async function gatherIce({
  iceServers,
  iceTransportPolicy = "all",
  timeoutMs = 12000,
} = {}) {
  const pc = new RTCPeerConnection({ iceServers, iceTransportPolicy });
  const candidates = [];
  const started = performance.now();

  try {
    pc.addEventListener("icecandidate", (event) => {
      if (event.candidate) {
        candidates.push(event.candidate);
      }
    });

    const done = new Promise((resolve) => {
      pc.addEventListener("icegatheringstatechange", () => {
        if (pc.iceGatheringState === "complete") {
          resolve();
        }
      });
    });

    pc.addTransceiver("audio", { direction: "sendrecv" });
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    if (pc.iceGatheringState !== "complete") {
      await Promise.race([done, wait(timeoutMs)]);
    }

    return {
      iceTransportPolicy,
      elapsedMs: Math.round(performance.now() - started),
      gatheringState: pc.iceGatheringState,
      ...summarizeCandidates(candidates),
    };
  } finally {
    pc.close();
  }
}

export function createToneStream(frequency = 440) {
  const context = new AudioContext();
  const destination = context.createMediaStreamDestination();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.value = frequency;
  gain.gain.value = 0.18;
  oscillator.connect(gain).connect(destination);
  oscillator.start();
  return {
    stream: destination.stream,
    context,
    async stop() {
      try {
        oscillator.stop();
      } catch {
        // already stopped
      }
      gain.disconnect();
      oscillator.disconnect();
      if (context.state !== "closed") {
        await context.close();
      }
    },
  };
}

export function readAudioStats(report) {
  const byId = new Map();
  for (const stat of report.values()) {
    byId.set(stat.id, stat);
  }

  let rttMs = null;
  let jitterMs = null;
  let packetsLost = 0;
  let packetsReceived = 0;
  let bytesReceived = 0;
  let localType = null;
  let remoteType = null;
  let localProtocol = null;
  let remoteProtocol = null;
  let pairState = null;

  for (const stat of report.values()) {
    const audio =
      stat.kind === "audio" || stat.mediaType === "audio" || stat.kind === undefined;
    if (stat.type === "inbound-rtp" && audio && stat.ssrc != null) {
      packetsLost = Number(stat.packetsLost) || 0;
      packetsReceived = Number(stat.packetsReceived) || 0;
      bytesReceived = Number(stat.bytesReceived) || 0;
      if (typeof stat.jitter === "number") {
        jitterMs = stat.jitter * 1000;
      }
    }
    if (stat.type === "candidate-pair" && (stat.nominated || stat.state === "succeeded")) {
      pairState = stat.state;
      if (typeof stat.currentRoundTripTime === "number") {
        rttMs = stat.currentRoundTripTime * 1000;
      }
      const local = byId.get(stat.localCandidateId);
      const remote = byId.get(stat.remoteCandidateId);
      if (local) {
        localType = local.candidateType || local.type || null;
        localProtocol = local.protocol || null;
      }
      if (remote) {
        remoteType = remote.candidateType || remote.type || null;
        remoteProtocol = remote.protocol || null;
      }
    }
    if (
      stat.type === "remote-inbound-rtp" &&
      audio &&
      typeof stat.roundTripTime === "number" &&
      rttMs == null
    ) {
      rttMs = stat.roundTripTime * 1000;
    }
  }

  const total = packetsReceived + packetsLost;
  const lossPct = total > 0 ? (packetsLost / total) * 100 : 0;
  return {
    rttMs,
    jitterMs,
    packetsLost,
    packetsReceived,
    bytesReceived,
    lossPct,
    localType,
    remoteType,
    localProtocol,
    remoteProtocol,
    pairState,
  };
}

export async function waitForFirstAudio(pc, { timeoutMs = 20000 } = {}) {
  const started = performance.now();
  let ontrackMs = null;

  const trackPromise = new Promise((resolve) => {
    pc.addEventListener(
      "track",
      () => {
        ontrackMs = Math.round(performance.now() - started);
        resolve();
      },
      { once: true },
    );
  });

  const deadline = Date.now() + timeoutMs;
  await Promise.race([trackPromise, wait(timeoutMs)]);

  while (Date.now() < deadline) {
    const report = await pc.getStats();
    const stats = readAudioStats(report);
    if (stats.packetsReceived > 0) {
      return {
        ok: true,
        ontrackMs,
        firstPacketMs: Math.round(performance.now() - started),
        stats,
      };
    }
    await wait(100);
  }

  return {
    ok: false,
    ontrackMs,
    firstPacketMs: null,
    error: "timeout",
    elapsedMs: Math.round(performance.now() - started),
  };
}

export async function startMediaLoopback({
  iceServers,
  iceTransportPolicy = "relay",
} = {}) {
  const tone = createToneStream();
  const pcOffer = new RTCPeerConnection({ iceServers, iceTransportPolicy });
  const pcAnswer = new RTCPeerConnection({ iceServers, iceTransportPolicy });
  const iceEvents = [];

  const logIce = (label, pc) => {
    const emit = (kind, detail) => {
      iceEvents.push({ at: new Date().toISOString(), label, kind, detail });
    };
    pc.addEventListener("connectionstatechange", () => emit("connectionState", pc.connectionState));
    pc.addEventListener("iceconnectionstatechange", () =>
      emit("iceConnectionState", pc.iceConnectionState),
    );
  };
  logIce("offer", pcOffer);
  logIce("answer", pcAnswer);

  pcOffer.addEventListener("icecandidate", (event) => {
    if (event.candidate) {
      pcAnswer.addIceCandidate(event.candidate).catch(() => {});
    }
  });
  pcAnswer.addEventListener("icecandidate", (event) => {
    if (event.candidate) {
      pcOffer.addIceCandidate(event.candidate).catch(() => {});
    }
  });

  for (const track of tone.stream.getAudioTracks()) {
    pcOffer.addTrack(track, tone.stream);
  }
  pcAnswer.addTransceiver("audio", { direction: "recvonly" });

  const offer = await pcOffer.createOffer();
  await pcOffer.setLocalDescription(offer);
  await pcAnswer.setRemoteDescription(offer);
  const answer = await pcAnswer.createAnswer();
  await pcAnswer.setLocalDescription(answer);
  await pcOffer.setRemoteDescription(answer);

  return {
    pcOffer,
    pcAnswer,
    tone,
    iceEvents,
    async close() {
      pcOffer.close();
      pcAnswer.close();
      await tone.stop();
    },
  };
}

export class SignallingWatch {
  constructor(url, { log, keepalive = false, pingMs = 15000 } = {}) {
    this.url = url;
    this.log = log;
    this.keepalive = keepalive;
    this.pingMs = pingMs;
    this.stopped = false;
    this.attempt = 0;
    this.reconnectCount = 0;
    this.socket = null;
    this.pingTimer = null;
    this.retryTimer = null;
  }

  start() {
    this.stopped = false;
    this.#connect();
  }

  stop() {
    this.stopped = true;
    this.#clearTimers();
    if (this.socket) {
      try {
        this.socket.close(1000, "diagnostic stop");
      } catch {
        // ignore
      }
      this.socket = null;
    }
  }

  #clearTimers() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  #connect() {
    if (this.stopped) {
      return;
    }
    const started = performance.now();
    if (this.attempt > 0) {
      this.log("Reconnecting", `signalling attempt ${this.attempt + 1}`);
    }
    const socket = new WebSocket(this.url);
    this.socket = socket;

    socket.addEventListener("open", () => {
      const ms = Math.round(performance.now() - started);
      if (this.attempt === 0) {
        this.log("Signalling open", `${ms}ms`);
      } else {
        this.reconnectCount += 1;
        this.log("Reconnected", `signalling in ${ms}ms (reconnect #${this.reconnectCount})`);
      }
      this.attempt += 1;
      if (this.keepalive) {
        this.pingTimer = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "ping", t: Date.now() }));
          }
        }, this.pingMs);
      }
    });

    socket.addEventListener("close", (event) => {
      this.#clearTimers();
      if (this.stopped) {
        return;
      }
      this.log(
        "Reconnecting",
        `signalling closed code=${event.code} reason=${event.reason || ""}`,
      );
      const delay = Math.min(8000, 500 * 2 ** Math.min(this.attempt, 4));
      this.retryTimer = setTimeout(() => this.#connect(), delay);
    });

    socket.addEventListener("error", () => {
      this.log("Signalling error", "websocket error event");
    });
  }
}

export class HoldSession {
  constructor({
    media,
    signalling,
    holdMs = SESSION_HOLD_MS,
    statsIntervalMs = 5000,
    log,
    onStats,
    onDone,
  }) {
    this.media = media;
    this.signalling = signalling;
    this.holdMs = holdMs;
    this.statsIntervalMs = statsIntervalMs;
    this.log = log;
    this.onStats = onStats;
    this.onDone = onDone;
    this.samples = [];
    this.reconnects = [];
    this.startedAt = null;
    this.timer = null;
    this.endTimer = null;
    this.stopped = false;
    this.lastIceState = null;
    this.lastConnState = null;
  }

  start() {
    this.stopped = false;
    this.startedAt = performance.now();
    this.log("Hold start", `duration ${this.holdMs / 1000}s (full 15-minute session)`);
    this.#watchPeer(this.media.pcAnswer);
    this.signalling?.start();
    this.timer = setInterval(() => this.#sample(), this.statsIntervalMs);
    this.endTimer = setTimeout(() => this.stop("completed"), this.holdMs);
    this.#sample();
  }

  async stop(reason = "stopped") {
    if (this.stopped) {
      return this.summary(reason);
    }
    this.stopped = true;
    if (this.timer) {
      clearInterval(this.timer);
    }
    if (this.endTimer) {
      clearTimeout(this.endTimer);
    }
    this.signalling?.stop();
    await this.media.close();
    const summary = this.summary(reason);
    this.log("Hold end", reason);
    this.onDone?.(summary);
    return summary;
  }

  summary(reason) {
    return {
      reason,
      holdMs: this.holdMs,
      elapsedMs: this.startedAt ? Math.round(performance.now() - this.startedAt) : 0,
      sampleCount: this.samples.length,
      reconnects: this.reconnects,
      samples: this.samples,
    };
  }

  #watchPeer(pc) {
    pc.addEventListener("iceconnectionstatechange", () => {
      const state = pc.iceConnectionState;
      const previous = this.lastIceState;
      this.lastIceState = state;
      if (state === "disconnected" || state === "failed") {
        this.reconnects.push({
          at: new Date().toISOString(),
          event: "Reconnecting",
          source: "ice",
          state,
        });
        this.log("Reconnecting", `iceConnectionState ${previous} → ${state}`);
      }
      if (
        (state === "connected" || state === "completed") &&
        (previous === "disconnected" || previous === "failed" || previous === "checking")
      ) {
        this.reconnects.push({
          at: new Date().toISOString(),
          event: "Reconnected",
          source: "ice",
          state,
        });
        this.log("Reconnected", `iceConnectionState ${previous} → ${state}`);
      }
    });
    pc.addEventListener("connectionstatechange", () => {
      const state = pc.connectionState;
      const previous = this.lastConnState;
      this.lastConnState = state;
      if (state === "disconnected" || state === "failed") {
        this.reconnects.push({
          at: new Date().toISOString(),
          event: "Reconnecting",
          source: "peer",
          state,
        });
        this.log("Reconnecting", `connectionState ${previous} → ${state}`);
      }
      if (state === "connected" && previous && previous !== "connected" && previous !== "new") {
        this.reconnects.push({
          at: new Date().toISOString(),
          event: "Reconnected",
          source: "peer",
          state,
        });
        this.log("Reconnected", `connectionState ${previous} → ${state}`);
      }
    });
  }

  async #sample() {
    if (this.stopped) {
      return;
    }
    const elapsedMs = Math.round(performance.now() - this.startedAt);
    const report = await this.media.pcAnswer.getStats();
    const stats = readAudioStats(report);
    const sample = {
      at: new Date().toISOString(),
      elapsedMs,
      ...stats,
    };
    this.samples.push(sample);
    this.onStats?.(sample, this.holdMs);
  }
}
