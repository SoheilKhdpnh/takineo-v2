import { isErrorCorrectionType, type ProposedCorrection } from "./types";
import { normalizeComparableText } from "./transcript";

export type TextSpan = {
  start: number;
  end: number;
};

type EditCluster = {
  original: string;
  corrected: string;
};

function tokens(text: string): string[] {
  return text
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

function comparableToken(token: string): string {
  return token.toLowerCase();
}

function joinTokens(parts: string[]): string {
  return parts.join(" ");
}

function editClusters(originalText: string, correctedText: string): EditCluster[] {
  const original = tokens(originalText);
  const corrected = tokens(correctedText);
  const originalCount = original.length;
  const correctedCount = corrected.length;
  const longest: number[][] = Array.from({ length: originalCount + 1 }, () =>
    Array<number>(correctedCount + 1).fill(0),
  );

  for (let originalIndex = originalCount - 1; originalIndex >= 0; originalIndex -= 1) {
    for (
      let correctedIndex = correctedCount - 1;
      correctedIndex >= 0;
      correctedIndex -= 1
    ) {
      longest[originalIndex][correctedIndex] =
        comparableToken(original[originalIndex]) ===
        comparableToken(corrected[correctedIndex])
          ? longest[originalIndex + 1][correctedIndex + 1] + 1
          : Math.max(
              longest[originalIndex + 1][correctedIndex],
              longest[originalIndex][correctedIndex + 1],
            );
    }
  }

  const clusters: EditCluster[] = [];
  let originalIndex = 0;
  let correctedIndex = 0;
  let originalRun: string[] = [];
  let correctedRun: string[] = [];

  const flush = () => {
    if (originalRun.length === 0 && correctedRun.length === 0) {
      return;
    }
    clusters.push({
      original: joinTokens(originalRun),
      corrected: joinTokens(correctedRun),
    });
    originalRun = [];
    correctedRun = [];
  };

  while (originalIndex < originalCount && correctedIndex < correctedCount) {
    if (
      comparableToken(original[originalIndex]) ===
      comparableToken(corrected[correctedIndex])
    ) {
      flush();
      originalIndex += 1;
      correctedIndex += 1;
      continue;
    }
    if (
      longest[originalIndex + 1][correctedIndex] >=
      longest[originalIndex][correctedIndex + 1]
    ) {
      originalRun.push(original[originalIndex]);
      originalIndex += 1;
    } else {
      correctedRun.push(corrected[correctedIndex]);
      correctedIndex += 1;
    }
  }

  while (originalIndex < originalCount) {
    originalRun.push(original[originalIndex]);
    originalIndex += 1;
  }
  while (correctedIndex < correctedCount) {
    correctedRun.push(corrected[correctedIndex]);
    correctedIndex += 1;
  }
  flush();
  return clusters;
}

export function findCaseInsensitiveSpans(
  haystack: string,
  needle: string,
): TextSpan[] {
  const trimmed = needle.trim();
  if (trimmed.length === 0) {
    return [];
  }
  const hay = haystack.toLowerCase();
  const need = trimmed.toLowerCase();
  const spans: TextSpan[] = [];
  let from = 0;
  while (from <= hay.length - need.length) {
    const start = hay.indexOf(need, from);
    if (start < 0) {
      break;
    }
    spans.push({ start, end: start + need.length });
    from = start + 1;
  }
  return spans;
}

function citationWindow(
  segmentText: string,
  item: ProposedCorrection,
): TextSpan | null {
  if (
    item.charStart === null ||
    item.charEnd === null ||
    item.charStart < 0 ||
    item.charEnd > segmentText.length ||
    item.charStart >= item.charEnd
  ) {
    return null;
  }
  const sliced = segmentText.slice(item.charStart, item.charEnd);
  if (
    !normalizeComparableText(sliced).includes(
      normalizeComparableText(item.originalText),
    )
  ) {
    return null;
  }
  return { start: item.charStart, end: item.charEnd };
}

export function locateUniqueCitation(
  segmentText: string,
  originalText: string,
  item: ProposedCorrection,
): TextSpan | null {
  const window = citationWindow(segmentText, item);
  const haystack = window
    ? segmentText.slice(window.start, window.end)
    : segmentText;
  const base = window?.start ?? 0;
  const spans = findCaseInsensitiveSpans(haystack, originalText);
  if (spans.length !== 1) {
    return null;
  }
  return { start: base + spans[0].start, end: base + spans[0].end };
}

function clusterToCorrection(
  item: ProposedCorrection,
  cluster: EditCluster,
): ProposedCorrection | null {
  if (cluster.original.length === 0) {
    return null;
  }
  if (
    normalizeComparableText(cluster.original) ===
    normalizeComparableText(cluster.corrected)
  ) {
    return null;
  }
  return {
    ...item,
    originalText: cluster.original,
    correctedText: cluster.corrected,
    charStart: null,
    charEnd: null,
  };
}

export function expandErrorCorrectionCitations(
  proposed: ProposedCorrection[],
  segmentText: (index: number) => string | undefined,
): ProposedCorrection[] {
  const expanded: ProposedCorrection[] = [];

  for (const item of proposed) {
    if (!isErrorCorrectionType(item.type)) {
      expanded.push(item);
      continue;
    }

    const segment = segmentText(item.transcriptSegmentIndex);
    if (segment === undefined) {
      continue;
    }

    const clusters = editClusters(item.originalText, item.correctedText);
    if (clusters.length <= 1) {
      expanded.push(item);
      continue;
    }

    for (const cluster of clusters) {
      const split = clusterToCorrection(item, cluster);
      if (split) {
        expanded.push(split);
      }
    }
  }

  return expanded;
}
