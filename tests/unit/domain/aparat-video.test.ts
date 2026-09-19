import { describe, expect, it } from "vitest";

import {
  aparatEmbedUrl,
  parseAparatVideoUrl,
} from "@/lib/domain/aparat-video";

describe("parseAparatVideoUrl", () => {
  it("accepts www.aparat.com watch URLs", () => {
    const parsed = parseAparatVideoUrl(
      "https://www.aparat.com/v/abcDE12",
    );

    expect(parsed).toEqual({
      hash: "abcDE12",
      canonicalUrl: "https://www.aparat.com/v/abcDE12",
      embedUrl: aparatEmbedUrl("abcDE12"),
    });
  });

  it("accepts embed URLs and canonicalizes them", () => {
    const parsed = parseAparatVideoUrl(
      "https://www.aparat.com/video/video/embed/videohash/xyz99/vt/frame",
    );

    expect(parsed?.hash).toBe("xyz99");
    expect(parsed?.canonicalUrl).toBe("https://www.aparat.com/v/xyz99");
  });

  it("rejects non-Aparat hosts and non-https URLs", () => {
    expect(parseAparatVideoUrl("https://youtube.com/watch?v=abc")).toBeNull();
    expect(parseAparatVideoUrl("http://www.aparat.com/v/abcDE12")).toBeNull();
    expect(parseAparatVideoUrl("https://aparat.ir/v/abcDE12")).toBeNull();
    expect(parseAparatVideoUrl("javascript:alert(1)")).toBeNull();
  });
});
