import type {
  ExcalidrawElementSkeleton,
} from "@excalidraw/excalidraw/data/transform";

export type BoardPoint = { x: number; y: number };

export type TemplateFonts = {
  /** Font for template labels. */
  text: number;
  /** Font with IPA coverage for phonetic symbols. */
  ipa: number;
};

export const BOARD_TEMPLATES = [
  "linedPaper",
  "tenseTimeline",
  "irregularVerbTable",
  "vocabularyCard",
] as const;

export type BoardTemplate = (typeof BOARD_TEMPLATES)[number];

const INK = "#1e1e1e";
const MUTED = "#6b7280";
const RULE = "#bfd4ea";
const MARGIN = "#f2a7a7";
const HEADER_FILL = "#fde7d6";
const ACCENT = "#c2410c";

// Template text is English lesson content in every UI locale.
const TIMELINE_LABELS = ["PAST", "NOW", "FUTURE"] as const;
const VERB_HEADERS = ["Base form", "Past simple", "Past participle"] as const;
const VERB_EXAMPLE = ["go", "went", "gone"] as const;
const CARD_FIELDS = ["Word:", "Pronunciation: /      /", "Meaning:", "Example:"] as const;

function linedPaper(center: BoardPoint): ExcalidrawElementSkeleton[] {
  const width = 960;
  const lines = 14;
  const spacing = 48;
  const left = center.x - width / 2;
  const top = center.y - ((lines - 1) * spacing) / 2;

  const rules: ExcalidrawElementSkeleton[] = Array.from({ length: lines }, (_, index) => ({
    type: "line",
    x: left,
    y: top + index * spacing,
    width,
    height: 0,
    strokeColor: RULE,
    strokeWidth: 1,
    roughness: 0,
    locked: true,
  }));

  rules.push({
    type: "line",
    x: left + 80,
    y: top - spacing,
    width: 0,
    height: (lines + 1) * spacing,
    strokeColor: MARGIN,
    strokeWidth: 1,
    roughness: 0,
    locked: true,
  });

  return rules;
}

function tenseTimeline(center: BoardPoint, fonts: TemplateFonts): ExcalidrawElementSkeleton[] {
  const span = 840;
  const left = center.x - span / 2;
  const markerSize = 18;
  const positions = [-span / 3, 0, span / 3];

  return [
    {
      type: "arrow",
      x: left,
      y: center.y,
      width: span,
      height: 0,
      strokeColor: INK,
      strokeWidth: 2,
      roughness: 0,
    },
    ...positions.flatMap((offset, index): ExcalidrawElementSkeleton[] => [
      {
        type: "ellipse",
        x: center.x + offset - markerSize / 2,
        y: center.y - markerSize / 2,
        width: markerSize,
        height: markerSize,
        strokeColor: index === 1 ? ACCENT : INK,
        backgroundColor: index === 1 ? ACCENT : INK,
        fillStyle: "solid",
        roughness: 0,
      },
      {
        type: "text",
        x: center.x + offset - 48,
        y: center.y - 64,
        text: TIMELINE_LABELS[index],
        fontSize: 24,
        fontFamily: fonts.text,
        strokeColor: index === 1 ? ACCENT : INK,
      },
    ]),
  ];
}

function irregularVerbTable(center: BoardPoint, fonts: TemplateFonts): ExcalidrawElementSkeleton[] {
  const columnWidth = 220;
  const rowHeight = 56;
  const rows = 5;
  const left = center.x - (columnWidth * VERB_HEADERS.length) / 2;
  const top = center.y - (rowHeight * rows) / 2;
  const cells: ExcalidrawElementSkeleton[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < VERB_HEADERS.length; column += 1) {
      const text =
        row === 0 ? VERB_HEADERS[column] : row === 1 ? VERB_EXAMPLE[column] : "";

      cells.push({
        type: "rectangle",
        x: left + column * columnWidth,
        y: top + row * rowHeight,
        width: columnWidth,
        height: rowHeight,
        strokeColor: INK,
        backgroundColor: row === 0 ? HEADER_FILL : "transparent",
        fillStyle: "solid",
        roughness: 0,
        ...(text
          ? {
              label: {
                text,
                fontSize: row === 0 ? 20 : 22,
                fontFamily: fonts.text,
                strokeColor: row === 1 ? MUTED : INK,
              },
            }
          : {}),
      });
    }
  }

  return cells;
}

function vocabularyCard(center: BoardPoint, fonts: TemplateFonts): ExcalidrawElementSkeleton[] {
  const width = 560;
  const height = 300;
  const left = center.x - width / 2;
  const top = center.y - height / 2;

  return [
    {
      type: "rectangle",
      x: left,
      y: top,
      width,
      height,
      strokeColor: ACCENT,
      backgroundColor: "#fffaf6",
      fillStyle: "solid",
      strokeWidth: 2,
      roughness: 0,
      roundness: { type: 3 },
    },
    ...CARD_FIELDS.map((field, index): ExcalidrawElementSkeleton => ({
      type: "text",
      x: left + 28,
      y: top + 28 + index * 66,
      text: field,
      fontSize: 24,
      fontFamily: index === 1 ? fonts.ipa : fonts.text,
      strokeColor: INK,
    })),
  ];
}

export function buildBoardTemplate(
  template: BoardTemplate,
  center: BoardPoint,
  fonts: TemplateFonts,
): ExcalidrawElementSkeleton[] {
  switch (template) {
    case "linedPaper":
      return linedPaper(center);
    case "tenseTimeline":
      return tenseTimeline(center, fonts);
    case "irregularVerbTable":
      return irregularVerbTable(center, fonts);
    case "vocabularyCard":
      return vocabularyCard(center, fonts);
  }
}

/** Common English IPA symbols, grouped for the palette. */
export const IPA_SYMBOL_GROUPS = {
  shortVowels: ["ɪ", "e", "æ", "ʌ", "ɒ", "ʊ", "ə"],
  longVowels: ["iː", "ɑː", "ɔː", "uː", "ɜː"],
  diphthongs: ["eɪ", "aɪ", "ɔɪ", "əʊ", "aʊ", "ɪə", "eə", "ʊə"],
  consonants: ["θ", "ð", "ʃ", "ʒ", "tʃ", "dʒ", "ŋ", "j", "w", "r", "h"],
  marks: ["ˈ", "ˌ", "ː", "/ /"],
} as const;

export type IpaSymbolGroup = keyof typeof IPA_SYMBOL_GROUPS;

export function buildIpaSymbol(
  symbol: string,
  center: BoardPoint,
  fonts: TemplateFonts,
  index: number,
): ExcalidrawElementSkeleton[] {
  // Fan successive insertions out so symbols do not land on top of each other.
  const offset = (index % 6) * 36;

  return [
    {
      type: "text",
      x: center.x - 18 + offset,
      y: center.y - 24 + offset,
      text: symbol,
      fontSize: 40,
      fontFamily: fonts.ipa,
      strokeColor: INK,
    },
  ];
}

/** Scene coordinates of the centre of the visible canvas. */
export function viewportCenter(appState: {
  scrollX: number;
  scrollY: number;
  width: number;
  height: number;
  zoom: { value: number };
}): BoardPoint {
  return {
    x: appState.width / 2 / appState.zoom.value - appState.scrollX,
    y: appState.height / 2 / appState.zoom.value - appState.scrollY,
  };
}

/** Scroll values that put `center` in the middle of a canvas of this size. */
export function scrollForCenter(
  center: BoardPoint,
  canvas: { width: number; height: number },
  zoom: number,
): { scrollX: number; scrollY: number } {
  return {
    scrollX: canvas.width / 2 / zoom - center.x,
    scrollY: canvas.height / 2 / zoom - center.y,
  };
}
