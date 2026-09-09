import http from "k6/http";
import {
  check,
} from "k6";

/*
 * Endpoint-agnostic Track D discovery load harness.
 *
 * It deliberately has NO latency threshold because 1k/10k/50k synthetic
 * datasets are complexity probes, not Wave 2 launch SLAs.
 *
 * Bind to the canonical M3 endpoint:
 *
 *   k6 run -e DISCOVERY_TARGET_URL="http://localhost:3000/api/teachers?fromDate=2026-08-18&toDate=2026-08-24" \
 *          -e DISCOVERY_DATASET_LABEL="10k" \
 *          -e VUS="25" \
 *          -e DURATION="30s" \
 *          scripts/load/discovery-load.k6.js
 */

const targetUrl =
  __ENV.DISCOVERY_TARGET_URL;

if (!targetUrl) {
  throw new Error(
    "DISCOVERY_TARGET_URL is required.",
  );
}

const vus =
  Number(
    __ENV.VUS ?? "10",
  );

const duration =
  __ENV.DURATION ??
  "20s";

export const options = {
  vus,
  duration,
};

export default function discoveryLoadIteration() {
  const response =
    http.get(
      targetUrl,
      {
        tags: {
          track:
            "D",

          surface:
            "discovery",

          dataset:
            __ENV.DISCOVERY_DATASET_LABEL ??
            "unspecified",
        },
      },
    );

  check(
    response,
    {
      "discovery does not return 5xx":
        (result) =>
          result.status < 500,
    },
  );
}
