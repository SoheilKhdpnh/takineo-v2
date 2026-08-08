import "dotenv/config";

const args = process.argv.slice(2);
const allowedArguments = new Set(["--help", "-h", "--id", "--limit"]);
const unknownArgument = args.find((argument) => argument.startsWith("-") && !allowedArguments.has(argument));
if (unknownArgument) throw new Error(`Unknown argument: ${unknownArgument}`);
if (args.includes("--help") || args.includes("-h")) {
  process.stdout.write("Usage: npm run ops:mux-reconcile -- [--id <reconciliation-id> | --limit <1-50>]\n--id forces immediate verification, including terminal SUCCEEDED intent.\n");
  process.exit(0);
}

const idIndex = args.indexOf("--id");
const limitIndex = args.indexOf("--limit");
if (idIndex >= 0 && limitIndex >= 0) throw new Error("Use either --id or --limit, not both.");
if (idIndex >= 0 && (!args[idIndex + 1] || args[idIndex + 1].startsWith("-"))) throw new Error("--id requires a reconciliation ID.");
if (limitIndex >= 0 && (!args[limitIndex + 1] || args[limitIndex + 1].startsWith("-"))) throw new Error("--limit requires a number from 1 to 50.");
const reconciliationId = idIndex >= 0 ? args[idIndex + 1] : undefined;
const limit = Number.parseInt(limitIndex >= 0 ? args[limitIndex + 1] ?? "20" : "20", 10);
if (!reconciliationId && (!Number.isInteger(limit) || limit < 1 || limit > 50)) throw new Error("--limit must be an integer from 1 to 50.");

const { processDueMuxPlaybackReconciliations, reconcileMuxPlayback } = await import("../lib/services/mux-playback-reconciliation.service");
const result = reconciliationId
  ? await reconcileMuxPlayback(reconciliationId, { force: true })
  : await processDueMuxPlaybackReconciliations(limit);

process.stdout.write(`${JSON.stringify(result)}\n`);
