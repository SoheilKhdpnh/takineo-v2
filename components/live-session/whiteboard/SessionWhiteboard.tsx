"use client";

import "@/components/live-session/whiteboard/excalidraw-assets";

import {
  CaptureUpdateAction,
  Excalidraw,
  FONT_FAMILY,
  convertToExcalidrawElements,
  reconcileElements,
  restoreElements,
} from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type {
  ExcalidrawElementSkeleton,
} from "@excalidraw/excalidraw/data/transform";
import type {
  RemoteExcalidrawElement,
} from "@excalidraw/excalidraw/data/reconcile";
import type {
  AppState,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";
import {
  useTranslations,
} from "next-intl";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  Button,
} from "@/components/ui/Button";
import { cn } from "@/lib/ui/cn";

import type {
  WhiteboardHub,
} from "@/components/live-session/whiteboard/whiteboard-hub";
import type {
  BoardElement,
  BoardSettings,
} from "@/components/live-session/whiteboard/whiteboard-sync-model";
import {
  BOARD_TEMPLATES,
  IPA_SYMBOL_GROUPS,
  buildBoardTemplate,
  buildIpaSymbol,
  scrollForCenter,
  viewportCenter,
  type BoardTemplate,
  type IpaSymbolGroup,
  type TemplateFonts,
} from "@/components/live-session/whiteboard/whiteboard-templates";

/** Coalesces rapid pointer edits into one sync message. */
const PUBLISH_THROTTLE_MS = 80;

/** About ten view updates a second while the teacher leads. */
const VIEWPORT_THROTTLE_MS = 100;

const DEFAULT_SETTINGS: BoardSettings = { grid: false, leading: false };

const TEMPLATE_FONTS: TemplateFonts = {
  text: FONT_FAMILY.Nunito,
  ipa: FONT_FAMILY["Liberation Sans"],
};

type ExcalidrawElements = Parameters<typeof restoreElements>[0];

export function SessionWhiteboard({
  hub,
  locale,
  canDraw,
  isTeacher,
}: {
  hub: WhiteboardHub;
  locale: string;
  canDraw: boolean;
  isTeacher: boolean;
}) {
  const t = useTranslations("LiveSessionJoin");
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [ipaOpen, setIpaOpen] = useState(false);
  const pendingRef = useRef<readonly BoardElement[] | null>(null);
  const timerRef = useRef<number | null>(null);
  const viewportTimerRef = useRef<number | null>(null);
  const insertCountRef = useRef(0);
  const [initialElements] = useState(() =>
    restoreElements(hub.getElements() as unknown as ExcalidrawElements, null),
  );
  const settings = useSyncExternalStore(
    hub.subscribeControls,
    hub.getSettings,
    () => DEFAULT_SETTINGS,
  );
  const following = !isTeacher && settings.leading;

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
    if (!api || isTeacher) {
      return;
    }

    return hub.subscribeViewport((viewport) => {
      const appState = api.getAppState();

      api.updateScene({
        appState: {
          ...scrollForCenter(
            { x: viewport.centerX, y: viewport.centerY },
            { width: appState.width, height: appState.height },
            viewport.zoom,
          ),
          zoom: { value: viewport.zoom as AppState["zoom"]["value"] },
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    });
  }, [api, hub, isTeacher]);

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

      if (viewportTimerRef.current !== null) {
        window.clearTimeout(viewportTimerRef.current);
      }

      if (pendingRef.current) {
        void hub.publishLocal(pendingRef.current);
      }
    };
  }, [hub]);

  function insertSkeleton(skeleton: ExcalidrawElementSkeleton[]) {
    if (!api || !canDraw) {
      return;
    }

    const created = convertToExcalidrawElements(skeleton, {
      regenerateIds: true,
    });

    api.updateScene({
      elements: [...api.getSceneElementsIncludingDeleted(), ...created],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  }

  function insertTemplate(template: BoardTemplate) {
    if (!api) {
      return;
    }

    insertSkeleton(
      buildBoardTemplate(template, viewportCenter(api.getAppState()), TEMPLATE_FONTS),
    );
  }

  function insertSymbol(symbol: string) {
    if (!api) {
      return;
    }

    insertSkeleton(
      buildIpaSymbol(
        symbol,
        viewportCenter(api.getAppState()),
        TEMPLATE_FONTS,
        insertCountRef.current,
      ),
    );
    insertCountRef.current += 1;
  }

  function shareViewport() {
    if (!api || !isTeacher || viewportTimerRef.current !== null) {
      return;
    }

    viewportTimerRef.current = window.setTimeout(() => {
      viewportTimerRef.current = null;
      const appState = api.getAppState();
      const center = viewportCenter(appState);

      void hub.publishViewport({
        centerX: center.x,
        centerY: center.y,
        zoom: appState.zoom.value,
      });
    }, VIEWPORT_THROTTLE_MS);
  }

  const showToolbar = canDraw || isTeacher || following;

  return (
    <div className="relative flex size-full flex-col">
      {showToolbar ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-canvas px-3 py-2">
          {canDraw ? (
            <>
              <label className="sr-only" htmlFor="board-template">
                {t("board.tools.templates")}
              </label>
              <select
                id="board-template"
                value=""
                onChange={(event) => {
                  const value = event.target.value as BoardTemplate;

                  if ((BOARD_TEMPLATES as readonly string[]).includes(value)) {
                    insertTemplate(value);
                  }
                }}
                className="min-h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink"
              >
                <option value="" disabled>
                  {t("board.tools.templates")}
                </option>
                {BOARD_TEMPLATES.map((template) => (
                  <option key={template} value={template}>
                    {t(`board.tools.template.${template}`)}
                  </option>
                ))}
              </select>
              <Button
                variant="ghost"
                size="sm"
                aria-expanded={ipaOpen}
                aria-controls="board-ipa-palette"
                onClick={() => {
                  setIpaOpen((open) => !open);
                }}
              >
                {t("board.tools.ipa")}
              </Button>
            </>
          ) : null}

          {isTeacher ? (
            <>
              <Button
                variant={settings.grid ? "secondary" : "ghost"}
                size="sm"
                aria-pressed={settings.grid}
                onClick={() => {
                  void hub.setSettings({ grid: !settings.grid });
                }}
              >
                {t("board.tools.grid")}
              </Button>
              <Button
                variant={settings.leading ? "secondary" : "ghost"}
                size="sm"
                aria-pressed={settings.leading}
                onClick={() => {
                  void hub.setSettings({ leading: !settings.leading });
                  shareViewport();
                }}
              >
                {t("board.tools.lead")}
              </Button>
            </>
          ) : null}

          {following ? (
            <p className="rounded-full bg-mint px-3 py-1 text-xs font-medium text-primary" role="status">
              {t("board.tools.following")}
            </p>
          ) : null}
        </div>
      ) : null}

      {ipaOpen && canDraw ? (
        <div
          id="board-ipa-palette"
          role="group"
          aria-label={t("board.tools.ipa")}
          className="absolute inset-x-3 top-14 z-20 max-h-[60%] overflow-y-auto rounded-lg border border-line bg-surface p-3 shadow-[0_18px_50px_-30px_rgba(20,34,31,0.45)] sm:inset-x-auto sm:start-3 sm:w-[22rem]"
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">{t("board.tools.ipa")}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIpaOpen(false);
              }}
            >
              {t("board.tools.closeIpa")}
            </Button>
          </div>
          {(Object.keys(IPA_SYMBOL_GROUPS) as IpaSymbolGroup[]).map((group) => (
            <div key={group} className="mt-2">
              <p className="mb-1 text-xs text-ink-muted">
                {t(`board.tools.ipaGroup.${group}`)}
              </p>
              <div className="flex flex-wrap gap-1" dir="ltr">
                {IPA_SYMBOL_GROUPS[group].map((symbol) => (
                  <button
                    key={symbol}
                    type="button"
                    lang="en-fonipa"
                    aria-label={t("board.tools.insertSymbol", { symbol })}
                    onClick={() => {
                      insertSymbol(symbol);
                    }}
                    className="min-h-9 min-w-9 rounded-md border border-line bg-canvas px-2 text-lg text-ink transition hover:border-primary"
                  >
                    {symbol}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className={cn("min-h-0 flex-1", following && !canDraw && "pointer-events-none")}>
        <Excalidraw
          excalidrawAPI={setApi}
          initialData={{ elements: initialElements }}
          langCode={locale === "fa" ? "fa-IR" : "en"}
          viewModeEnabled={!canDraw}
          gridModeEnabled={settings.grid}
          UIOptions={{
            tools: { image: false },
            canvasActions: {
              loadScene: false,
              saveToActiveFile: false,
              toggleTheme: false,
              changeViewBackgroundColor: true,
              clearCanvas: isTeacher,
              saveAsImage: true,
              export: false,
            },
          }}
          onScrollChange={() => {
            if (settings.leading) {
              shareViewport();
            }
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
    </div>
  );
}
