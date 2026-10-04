import { describe, expect, it } from "vitest";

import {
  BOARD_TEMPLATES,
  IPA_SYMBOL_GROUPS,
  buildBoardTemplate,
  buildIpaSymbol,
  scrollForCenter,
  viewportCenter,
} from "@/components/live-session/whiteboard/whiteboard-templates";

const fonts = { text: 6, ipa: 9 };
const center = { x: 500, y: 300 };

function texts(skeleton: ReturnType<typeof buildBoardTemplate>): string[] {
  return skeleton.flatMap((item) => {
    if (item.type === "text" && "text" in item) {
      return [item.text];
    }

    if ("label" in item && item.label && typeof item.label === "object" && "text" in item.label) {
      return [item.label.text];
    }

    return [];
  });
}

describe("board templates", () => {
  it("builds every template around the requested centre", () => {
    for (const template of BOARD_TEMPLATES) {
      const skeleton = buildBoardTemplate(template, center, fonts);
      const lefts = skeleton.map((item) => item.x ?? 0);
      const rights = skeleton.map(
        (item) => (item.x ?? 0) + ("width" in item && typeof item.width === "number" ? item.width : 0),
      );

      expect(skeleton.length).toBeGreaterThan(0);
      expect(Math.min(...lefts)).toBeLessThan(center.x);
      expect(Math.max(...rights)).toBeGreaterThan(center.x);
    }
  });

  it("locks lined-paper rules so they act as a background", () => {
    const skeleton = buildBoardTemplate("linedPaper", center, fonts);

    expect(skeleton.every((item) => item.type === "line" && item.locked === true)).toBe(true);
  });

  it("labels the tense timeline and verb table with English lesson content", () => {
    expect(texts(buildBoardTemplate("tenseTimeline", center, fonts))).toEqual([
      "PAST",
      "NOW",
      "FUTURE",
    ]);
    expect(texts(buildBoardTemplate("irregularVerbTable", center, fonts))).toEqual([
      "Base form",
      "Past simple",
      "Past participle",
      "go",
      "went",
      "gone",
    ]);
  });

  it("uses the IPA-capable font for the pronunciation field and symbols", () => {
    const card = buildBoardTemplate("vocabularyCard", center, fonts);
    const pronunciation = card.find(
      (item) => item.type === "text" && "text" in item && item.text.startsWith("Pronunciation"),
    );

    expect(pronunciation && "fontFamily" in pronunciation && pronunciation.fontFamily).toBe(fonts.ipa);

    const [symbol] = buildIpaSymbol("θ", center, fonts, 0);
    expect(symbol && "fontFamily" in symbol && symbol.fontFamily).toBe(fonts.ipa);
  });

  it("fans out successive IPA insertions", () => {
    const first = buildIpaSymbol("ʃ", center, fonts, 0)[0];
    const second = buildIpaSymbol("ʒ", center, fonts, 1)[0];

    expect(second?.x).not.toBe(first?.x);
  });

  it("has unique symbols within each IPA group", () => {
    for (const symbols of Object.values(IPA_SYMBOL_GROUPS)) {
      expect(new Set(symbols).size).toBe(symbols.length);
    }
  });
});

describe("viewport helpers", () => {
  it("round-trips a centre point across different screen sizes", () => {
    const teacher = { scrollX: -200, scrollY: 50, width: 1600, height: 900, zoom: { value: 2 } };
    const sharedCenter = viewportCenter(teacher);

    const studentScroll = scrollForCenter(sharedCenter, { width: 390, height: 700 }, 2);
    const studentCenter = viewportCenter({
      ...studentScroll,
      width: 390,
      height: 700,
      zoom: { value: 2 },
    });

    expect(studentCenter.x).toBeCloseTo(sharedCenter.x);
    expect(studentCenter.y).toBeCloseTo(sharedCenter.y);
  });
});
