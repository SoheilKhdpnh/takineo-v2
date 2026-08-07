import "server-only";

import Mux from "@mux/mux-node";

import {
  getMuxApiConfiguration,
} from "@/lib/video/mux-config";

let muxClient: Mux | undefined;

export function getMuxClient(): Mux {
  if (!muxClient) {
    const configuration =
      getMuxApiConfiguration();

    muxClient = new Mux({
      tokenId: configuration.tokenId,
      tokenSecret:
        configuration.tokenSecret,
    });
  }

  return muxClient;
}