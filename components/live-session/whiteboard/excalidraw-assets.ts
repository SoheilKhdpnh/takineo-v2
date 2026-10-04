declare global {
  interface Window {
    EXCALIDRAW_ASSET_PATH?: string | string[];
  }
}

/**
 * Excalidraw loads fonts from a public CDN unless this is set. Serve the
 * copies in /public/excalidraw-assets first (see scripts/copy-excalidraw-fonts.mjs)
 * so text and IPA symbols do not depend on a third-party host. Excalidraw keeps
 * its CDN as a fallback for anything not copied (the CJK Xiaolai font).
 */
if (typeof window !== "undefined") {
  window.EXCALIDRAW_ASSET_PATH = "/excalidraw-assets/";
}

export {};
