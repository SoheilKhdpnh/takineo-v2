"use client";

import {
  CaptureUpdateAction,
  Excalidraw,
  reconcileElements,
  restoreElements,
} from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type {
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";
import type {
  RemoteExcalidrawElement,
} from "@excalidraw/excalidraw/data/reconcile";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import type {
  WhiteboardHub,
} from "@/components/live-session/whiteboard/whiteboard-hub";
import type {
  BoardElement,
} from "@/components/live-session/whiteboard/whiteboard-sync-model";

/** Coalesces rapid pointer edits into one sync message. */
const PUBLISH_THROTTLE_MS = 80;

type ExcalidrawElements = Parameters<typeof restoreElements>[0];

export function SessionWhiteboard({
  hub,
  locale,
  canDraw,
  canClear,
}: {
  hub: WhiteboardHub;
  locale: string;
  canDraw: boolean;
  canClear: boolean;
}) {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const pendingRef = useRef<readonly BoardElement[] | null>(null);
  const timerRef = useRef<number | null>(null);
  const [initialElements] = useState(() =>
    restoreElements(hub.getElements() as unknown as ExcalidrawElements, null),
  );

  useEffect(() => {
    if (!api) {
      return;
    }

    return hub.subscribe((changed) => {
      const remote = restoreElements(
        changed as unknown as ExcalidrawElements,
        null,
      ) as RemoteExcalidrawElement[];
      const reconciled = reconcileElements(
        api.getSceneElementsIncludingDeleted(),
        remote,
        api.getAppState(),
      );

      api.updateScene({
        elements: reconciled,
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    });
  }, [api, hub]);

  useEffect(() => {
    if (!api || canDraw) {
      return;
    }

    // Edits made while access was being revoked never reached the teacher;
    // fall back to the shared board so both screens match.
    api.updateScene({
      elements: restoreElements(
        hub.getElements() as unknown as ExcalidrawElements,
        null,
      ),
      captureUpdate: CaptureUpdateAction.NEVER,
    });
  }, [api, canDraw, hub]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }

      if (pendingRef.current) {
        void hub.publishLocal(pendingRef.current);
      }
    };
  }, [hub]);

  return (
    <div className="size-full">
      <Excalidraw
        excalidrawAPI={setApi}
        initialData={{ elements: initialElements }}
        langCode={locale === "fa" ? "fa-IR" : "en"}
        viewModeEnabled={!canDraw}
        UIOptions={{
          tools: { image: false },
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
            toggleTheme: false,
            changeViewBackgroundColor: true,
            clearCanvas: canClear,
            saveAsImage: true,
            export: false,
          },
        }}
        onChange={(elements) => {
          if (!canDraw) {
            return;
          }

          pendingRef.current = elements as unknown as readonly BoardElement[];

          if (timerRef.current !== null) {
            return;
          }

          timerRef.current = window.setTimeout(() => {
            timerRef.current = null;
            const latest = pendingRef.current;
            pendingRef.current = null;

            if (latest) {
              void hub.publishLocal(latest);
            }
          }, PUBLISH_THROTTLE_MS);
        }}
      />
    </div>
  );
}
