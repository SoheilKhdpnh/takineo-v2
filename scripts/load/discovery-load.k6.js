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
 * Bind only after Track A M3 exists:
 *
 *   k6 run -e DISCOVERY_TARGET_URL="http://localhost:3000/<actual-m3-route>" \
 *          -e DISCOVERY_DATASET_LABEL="10k" \
 *          -e VUS="25" \
 *          -e DURATION="30s" \
 *          scripts/load/discovery-load.k6.js
 */

const targetUrl =
  __ENV.DISCOVERY_TARGET_URL;

if (!targetUrl) {
  throw new Error(
    "DISCOVERY_TARGET_URL is required. Do not guess the M3 discovery route.",
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

export default function () {
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
