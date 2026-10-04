import type { Room } from "livekit-client";

import type {
  SessionViewerRole,
} from "@/components/live-session/session-join-model";
import {
  WHITEBOARD_MAX_MESSAGE_BYTES,
  WHITEBOARD_TOPIC,
  elementsToSend,
  encodeWhiteboardMessages,
  mergeBoardElements,
  parseWhiteboardMessage,
  type BoardElement,
  type BoardSettings,
  type BoardViewport,
} from "@/components/live-session/whiteboard/whiteboard-sync-model";

type Listener = (changed: readonly BoardElement[]) => void;

type ViewportListener = (viewport: BoardViewport) => void;

type BoardTransport = {
  send: (payload: string) => Promise<void>;
};

/** How long after asking for a snapshot the teacher accepts one from the student. */
const SNAPSHOT_REPLY_WINDOW_MS = 10_000;

/**
 * Owns the in-memory board for one session page. It outlives the board UI
 * (so remote drawing is kept while the board is closed) and individual rooms
 * (so a rejoin keeps what was already drawn).
 *
 * The teacher controls the board: the student is view-only until the teacher
 * grants drawing. In this two-party room the teacher's hub also discards
 * student edits while drawing is not granted, so a modified student client
 * cannot change the teacher's board.
 */
export class WhiteboardHub {
  private elements = new Map<string, BoardElement>();

  private knownVersions = new Map<string, number>();

  private listeners = new Set<Listener>();

  private controlListeners = new Set<() => void>();

  private viewportListeners = new Set<ViewportListener>();

  private transport: BoardTransport | null = null;

  private studentCanDraw = false;

  private settings: BoardSettings = { grid: false, leading: false };

  private lastViewport: BoardViewport | null = null;

  private snapshotAcceptedUntil = 0;

  constructor(
    private readonly role: SessionViewerRole,
    private readonly now: () => number = Date.now,
  ) {}

  getElements(): BoardElement[] {
    return [...this.elements.values()];
  }

  /** Whether this viewer may edit the board right now. */
  readonly canDraw = (): boolean =>
    this.role === "TEACHER" || this.studentCanDraw;

  readonly isStudentDrawingAllowed = (): boolean => this.studentCanDraw;

  /** Returns the same object until settings change, for `useSyncExternalStore`. */
  readonly getSettings = (): BoardSettings => this.settings;

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Permission and settings changes; stable identity for `useSyncExternalStore`. */
  readonly subscribeControls = (listener: () => void): (() => void) => {
    this.controlListeners.add(listener);

    return () => {
      this.controlListeners.delete(listener);
    };
  };

  /** Student only: the teacher's view while the teacher is leading. */
  subscribeViewport(listener: ViewportListener): () => void {
    this.viewportListeners.add(listener);

    return () => {
      this.viewportListeners.delete(listener);
    };
  }

  /** Registers the receiver; call before `room.connect` so nothing is missed. */
  attach(room: Room) {
    room.registerTextStreamHandler(WHITEBOARD_TOPIC, async (reader) => {
      if (
        reader.info.size !== undefined &&
        reader.info.size > WHITEBOARD_MAX_MESSAGE_BYTES
      ) {
        return;
      }

      try {
        this.receive(await reader.readAll());
      } catch {
        // A truncated or aborted stream is dropped; the next update resyncs.
      }
    });

    this.transport = {
      send: async (payload) => {
        await room.localParticipant.sendText(payload, {
          topic: WHITEBOARD_TOPIC,
        });
      },
    };
  }

  /** Test seam: drive the hub without a LiveKit room. */
  attachTransport(transport: BoardTransport) {
    this.transport = transport;
  }

  detach() {
    this.transport = null;
  }

  /** After (re)joining: ask for the board, and as teacher restate the permission. */
  async announceJoin() {
    this.snapshotAcceptedUntil = this.now() + SNAPSHOT_REPLY_WINDOW_MS;
    await this.sendRaw(JSON.stringify({ kind: "snapshot-request" }));

    if (this.role === "TEACHER") {
      await this.sendControls();
    }
  }

  /** Teacher only: grant or revoke student drawing. */
  async setStudentCanDraw(allowed: boolean) {
    if (this.role !== "TEACHER" || this.studentCanDraw === allowed) {
      return;
    }

    this.studentCanDraw = allowed;
    this.notifyControls();
    await this.sendPermission();
  }

  /** Teacher only: change the grid or start/stop leading the student's view. */
  async setSettings(patch: Partial<BoardSettings>) {
    if (this.role !== "TEACHER") {
      return;
    }

    const next = { ...this.settings, ...patch };

    if (next.grid === this.settings.grid && next.leading === this.settings.leading) {
      return;
    }

    this.settings = next;
    this.notifyControls();
    await this.sendSettings();

    if (next.leading && this.lastViewport) {
      await this.sendViewport(this.lastViewport);
    }
  }

  /** Teacher only: share the current view; sent only while leading. */
  async publishViewport(viewport: BoardViewport) {
    if (this.role !== "TEACHER") {
      return;
    }

    this.lastViewport = viewport;

    if (this.settings.leading) {
      await this.sendViewport(viewport);
    }
  }

  /** Publishes local edits; unchanged and already-received versions are skipped. */
  async publishLocal(elements: readonly BoardElement[]) {
    if (!this.canDraw()) {
      return;
    }

    const outgoing = elementsToSend(elements, this.knownVersions);

    if (outgoing.length === 0) {
      return;
    }

    this.remember(outgoing);
    const { next } = mergeBoardElements(this.elements, outgoing);
    this.elements = next;

    for (const payload of encodeWhiteboardMessages("update", outgoing)) {
      await this.sendRaw(payload);
    }
  }

  receive(raw: string) {
    const message = parseWhiteboardMessage(raw);

    if (!message) {
      return;
    }

    switch (message.kind) {
      case "snapshot-request": {
        if (this.elements.size > 0) {
          void this.sendSnapshot();
        }

        if (this.role === "TEACHER") {
          void this.sendControls();
        }
        return;
      }

      case "permission": {
        // Only the teacher grants drawing; a student cannot grant itself.
        if (this.role === "STUDENT" && this.studentCanDraw !== message.studentCanDraw) {
          this.studentCanDraw = message.studentCanDraw;
          this.notifyControls();
        }
        return;
      }

      case "settings": {
        if (
          this.role === "STUDENT" &&
          (this.settings.grid !== message.grid ||
            this.settings.leading !== message.leading)
        ) {
          this.settings = { grid: message.grid, leading: message.leading };
          this.notifyControls();
        }
        return;
      }

      case "viewport": {
        if (this.role !== "STUDENT" || !this.settings.leading) {
          return;
        }

        const viewport = {
          centerX: message.centerX,
          centerY: message.centerY,
          zoom: message.zoom,
        };

        for (const listener of this.viewportListeners) {
          listener(viewport);
        }
        return;
      }

      case "update":
      case "snapshot": {
        if (!this.acceptsElementsFromCounterpart(message.kind)) {
          return;
        }

        this.applyRemote(message.elements);
        return;
      }
    }
  }

  private acceptsElementsFromCounterpart(kind: "update" | "snapshot"): boolean {
    if (this.role === "STUDENT" || this.studentCanDraw) {
      return true;
    }

    // Teacher with student drawing off: only a snapshot it asked for after a rejoin.
    return kind === "snapshot" && this.now() <= this.snapshotAcceptedUntil;
  }

  private applyRemote(incoming: readonly BoardElement[]) {
    const { next, changed } = mergeBoardElements(this.elements, incoming);
    this.elements = next;

    if (changed.length === 0) {
      return;
    }

    this.remember(changed);

    for (const listener of this.listeners) {
      listener(changed);
    }
  }

  private async sendControls() {
    await this.sendPermission();
    await this.sendSettings();

    if (this.settings.leading && this.lastViewport) {
      await this.sendViewport(this.lastViewport);
    }
  }

  private async sendPermission() {
    await this.sendRaw(
      JSON.stringify({ kind: "permission", studentCanDraw: this.studentCanDraw }),
    );
  }

  private async sendSettings() {
    await this.sendRaw(JSON.stringify({ kind: "settings", ...this.settings }));
  }

  private async sendViewport(viewport: BoardViewport) {
    await this.sendRaw(JSON.stringify({ kind: "viewport", ...viewport }));
  }

  private notifyControls() {
    for (const listener of this.controlListeners) {
      listener();
    }
  }

  private async sendSnapshot() {
    for (const payload of encodeWhiteboardMessages("snapshot", this.getElements())) {
      await this.sendRaw(payload);
    }
  }

  private remember(elements: readonly BoardElement[]) {
    for (const element of elements) {
      this.knownVersions.set(element.id, element.version);
    }
  }

  private async sendRaw(payload: string) {
    const transport = this.transport;

    if (!transport) {
      return;
    }

    try {
      await transport.send(payload);
    } catch {
      // Sending fails while disconnected; the snapshot on rejoin resyncs.
    }
  }
}
