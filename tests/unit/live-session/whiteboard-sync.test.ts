import { describe, expect, it, vi } from "vitest";

import { WhiteboardHub } from "@/components/live-session/whiteboard/whiteboard-hub";
import {
  WHITEBOARD_MAX_ELEMENTS,
  WHITEBOARD_MAX_MESSAGE_BYTES,
  elementsToSend,
  encodeWhiteboardMessages,
  mergeBoardElements,
  parseWhiteboardMessage,
  type BoardElement,
} from "@/components/live-session/whiteboard/whiteboard-sync-model";

function element(
  id: string,
  version: number,
  versionNonce = 1,
  extra: Record<string, unknown> = {},
): BoardElement {
  return { id, version, versionNonce, type: "rectangle", ...extra };
}

describe("parseWhiteboardMessage", () => {
  it("accepts updates, snapshots, and snapshot requests", () => {
    expect(
      parseWhiteboardMessage(JSON.stringify({ kind: "update", elements: [element("a", 1)] })),
    ).toEqual({ kind: "update", elements: [element("a", 1)] });
    expect(parseWhiteboardMessage('{"kind":"snapshot-request"}')).toEqual({
      kind: "snapshot-request",
    });
  });

  it("rejects malformed or unknown messages from the counterpart", () => {
    expect(parseWhiteboardMessage("not json")).toBeNull();
    expect(parseWhiteboardMessage('{"kind":"delete-everything"}')).toBeNull();
    expect(parseWhiteboardMessage('{"kind":"update","elements":"x"}')).toBeNull();
    expect(
      parseWhiteboardMessage("x".repeat(WHITEBOARD_MAX_MESSAGE_BYTES + 1)),
    ).toBeNull();
  });

  it("drops elements without a usable identity or version and caps the count", () => {
    const parsed = parseWhiteboardMessage(
      JSON.stringify({
        kind: "update",
        elements: [
          element("ok", 2),
          { id: "", version: 1, versionNonce: 1 },
          { id: "no-version", versionNonce: 1 },
          { id: "x".repeat(65), version: 1, versionNonce: 1 },
          ["not", "an", "object"],
        ],
      }),
    );

    expect(parsed).toEqual({ kind: "update", elements: [element("ok", 2)] });

    const many = Array.from({ length: WHITEBOARD_MAX_ELEMENTS + 10 }, (_, index) =>
      element(`e${index}`, 1),
    );
    const capped = parseWhiteboardMessage(JSON.stringify({ kind: "snapshot", elements: many }));

    expect(capped?.kind === "snapshot" && capped.elements.length).toBe(
      WHITEBOARD_MAX_ELEMENTS,
    );
  });
});

describe("mergeBoardElements", () => {
  it("keeps the higher version and breaks ties with the lower nonce", () => {
    const current = new Map([
      ["a", element("a", 3, 50)],
      ["b", element("b", 2, 10)],
    ]);

    const { next, changed } = mergeBoardElements(current, [
      element("a", 2, 1),
      element("b", 2, 5),
      element("c", 1, 9),
    ]);

    expect(next.get("a")?.version).toBe(3);
    expect(next.get("b")?.versionNonce).toBe(5);
    expect(changed.map((item) => item.id).sort()).toEqual(["b", "c"]);
  });

  it("propagates deletions as versioned updates", () => {
    const current = new Map([["a", element("a", 1)]]);
    const { next } = mergeBoardElements(current, [
      element("a", 2, 1, { isDeleted: true }),
    ]);

    expect(next.get("a")?.isDeleted).toBe(true);
  });
});

describe("elementsToSend and encodeWhiteboardMessages", () => {
  it("skips versions that were already sent or received", () => {
    const known = new Map([
      ["a", 1],
      ["b", 4],
    ]);

    expect(
      elementsToSend([element("a", 1), element("b", 5), element("c", 1)], known).map(
        (item) => item.id,
      ),
    ).toEqual(["b", "c"]);
  });

  it("splits large boards into messages under the byte cap", () => {
    const padding = "p".repeat(40_000);
    const elements = Array.from({ length: 20 }, (_, index) =>
      element(`big${index}`, 1, 1, { padding }),
    );

    const messages = encodeWhiteboardMessages("snapshot", elements);
    const parsedIds = messages.flatMap((message) => {
      const parsed = parseWhiteboardMessage(message);
      return parsed && (parsed.kind === "update" || parsed.kind === "snapshot")
        ? parsed.elements.map((item) => item.id)
        : [];
    });

    expect(messages.length).toBeGreaterThan(1);
    for (const message of messages) {
      expect(new TextEncoder().encode(message).length).toBeLessThanOrEqual(
        WHITEBOARD_MAX_MESSAGE_BYTES,
      );
    }
    expect(parsedIds).toHaveLength(20);
  });

  it("still sends an empty snapshot so the requester knows the board is empty", () => {
    expect(encodeWhiteboardMessages("snapshot", [])).toEqual([
      JSON.stringify({ kind: "snapshot", elements: [] }),
    ]);
  });
});

describe("WhiteboardHub", () => {
  function linkedHubs(now: () => number = Date.now) {
    const teacher = new WhiteboardHub("TEACHER", now);
    const student = new WhiteboardHub("STUDENT", now);
    const teacherSent: string[] = [];
    const studentSent: string[] = [];

    teacher.attachTransport({
      send: async (payload) => {
        teacherSent.push(payload);
        student.receive(payload);
      },
    });
    student.attachTransport({
      send: async (payload) => {
        studentSent.push(payload);
        teacher.receive(payload);
      },
    });

    return { teacher, student, teacherSent, studentSent };
  }

  function update(...elements: BoardElement[]) {
    return JSON.stringify({ kind: "update", elements });
  }

  it("delivers teacher drawing to the student and notifies the student's board", async () => {
    const { teacher, student } = linkedHubs();
    const onChange = vi.fn();
    student.subscribe(onChange);

    await teacher.publishLocal([element("line", 1)]);

    expect(student.getElements()).toEqual([element("line", 1)]);
    expect(onChange).toHaveBeenCalledWith([element("line", 1)]);
  });

  it("keeps the student view-only until the teacher grants drawing", async () => {
    const { teacher, student, studentSent } = linkedHubs();

    expect(student.canDraw()).toBe(false);
    expect(teacher.canDraw()).toBe(true);

    await student.publishLocal([element("student-line", 1)]);

    expect(studentSent).toHaveLength(0);
    expect(teacher.getElements()).toHaveLength(0);
  });

  it("lets the student draw after the teacher grants access and stops after revoke", async () => {
    const { teacher, student } = linkedHubs();
    const onPermission = vi.fn();
    student.subscribePermission(onPermission);

    await teacher.setStudentCanDraw(true);

    expect(student.canDraw()).toBe(true);
    expect(onPermission).toHaveBeenCalledTimes(1);

    await student.publishLocal([element("student-line", 1)]);
    expect(teacher.getElements().map((item) => item.id)).toEqual(["student-line"]);

    await teacher.setStudentCanDraw(false);

    expect(student.canDraw()).toBe(false);
    await student.publishLocal([element("student-line", 2)]);
    expect(teacher.getElements()[0]?.version).toBe(1);
  });

  it("discards edits from a modified student client while drawing is not granted", () => {
    const teacher = new WhiteboardHub("TEACHER");

    teacher.receive(update(element("forged", 1)));

    expect(teacher.getElements()).toHaveLength(0);
  });

  it("does not let the student grant itself drawing", async () => {
    const { teacher, student } = linkedHubs();

    await student.setStudentCanDraw(true);
    teacher.receive(JSON.stringify({ kind: "permission", studentCanDraw: true }));

    expect(student.canDraw()).toBe(false);
    expect(teacher.isStudentDrawingAllowed()).toBe(false);
    teacher.receive(update(element("forged", 1)));
    expect(teacher.getElements()).toHaveLength(0);
  });

  it("does not echo applied remote changes back to the sender", async () => {
    const { teacher, student, studentSent } = linkedHubs();
    await teacher.setStudentCanDraw(true);
    studentSent.length = 0;

    await teacher.publishLocal([element("shape", 3)]);
    await student.publishLocal(student.getElements());

    expect(studentSent).toHaveLength(0);
  });

  it("sends a rejoining student the whole board and the current permission", async () => {
    const { teacher } = linkedHubs();
    await teacher.publishLocal([element("a", 1), element("b", 2)]);
    await teacher.setStudentCanDraw(true);

    const rejoined = new WhiteboardHub("STUDENT");
    rejoined.attachTransport({
      send: async (payload) => {
        teacher.receive(payload);
      },
    });
    teacher.attachTransport({
      send: async (payload) => {
        rejoined.receive(payload);
      },
    });

    await rejoined.announceJoin();
    await vi.waitFor(() => {
      expect(rejoined.getElements().map((item) => item.id).sort()).toEqual(["a", "b"]);
    });
    expect(rejoined.canDraw()).toBe(true);
  });

  it("accepts the student's snapshot only right after the teacher rejoins", async () => {
    let clock = 1_000;
    const teacher = new WhiteboardHub("TEACHER", () => clock);
    const snapshot = JSON.stringify({ kind: "snapshot", elements: [element("kept", 4)] });

    teacher.receive(snapshot);
    expect(teacher.getElements()).toHaveLength(0);

    teacher.attachTransport({ send: async () => {} });
    await teacher.announceJoin();
    teacher.receive(snapshot);
    expect(teacher.getElements().map((item) => item.id)).toEqual(["kept"]);

    clock += 11_000;
    teacher.receive(
      JSON.stringify({ kind: "snapshot", elements: [element("late", 1)] }),
    );
    expect(teacher.getElements().map((item) => item.id)).toEqual(["kept"]);
  });

  it("keeps the board in memory when sending fails while disconnected", async () => {
    const hub = new WhiteboardHub("TEACHER");
    hub.attachTransport({
      send: async () => {
        throw new Error("offline");
      },
    });

    await expect(hub.publishLocal([element("a", 1)])).resolves.toBeUndefined();
    expect(hub.getElements()).toEqual([element("a", 1)]);
  });
});
